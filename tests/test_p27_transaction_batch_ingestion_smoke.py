"""
P27: production transaction ingestion.

Before this, the only way to get a transaction into the pipeline was
one-at-a-time via POST /transactions (whether from the UI or an API-key
caller) -- no batch path existed for a real core-banking/payments feed
or a one-off bulk upload. This adds:

  POST /transactions/batch          -- programmatic JSON batch ingestion
  GET  /transactions/import/template
  GET  /transactions/import/field-guide
  POST /transactions/import/upload  -- CSV/Excel bulk ingestion

Both paths resolve a customer via customer_ref (not just the internal
customer_id, since an external feed knows the org-facing reference, not
VeriGo's UUID), run every created transaction through the exact same
monitoring + automation pipeline as a manually-entered one, and treat a
re-submitted transaction_ref as a safe no-op (idempotent retry) rather
than a duplicate or a hard error -- one bad row never aborts the batch.
"""

import io
import uuid

from app.models.customer import Customer
from app.models.monitoring import TransactionAlert
from app.models.transaction import Transaction
from tests.conftest import _auth


def _create_customer(client, headers, **overrides) -> dict:
    payload = {
        "full_name": "P27 Ingestion Customer",
        "email": f"p27-{uuid.uuid4().hex[:8]}@example.com",
        "phone": "+61400000199",
        "date_of_birth": "1980-01-01",
        "nationality": "AU",
        "country_of_residence": "AU",
        "id_number": "PP99999999",
        "id_type": "passport",
        "address": "1 Ingestion St, Sydney NSW 2000",
        "industry": "banking",
        **overrides,
    }
    resp = client.post("/api/v1/customers/", json=payload, headers=headers)
    assert resp.status_code == 201, resp.text
    return resp.json()


# ── POST /transactions/batch ──────────────────────────────────────────────────


def test_batch_creates_transactions_via_customer_ref(client, db, analyst_headers):
    customer = _create_customer(client, analyst_headers)
    ref = f"TXN-BATCH-{uuid.uuid4().hex[:8]}"

    resp = client.post(
        "/api/v1/transactions/batch",
        json={
            "transactions": [
                {
                    "transaction_ref": ref,
                    "customer_ref": customer["customer_ref"],
                    "transaction_type": "transfer",
                    "direction": "outgoing",
                    "payment_method": "bank_transfer",
                    "amount": 1500.00,
                    "currency": "AUD",
                    "transaction_date": "2026-06-01T10:00:00",
                }
            ]
        },
        headers=analyst_headers,
    )
    assert resp.status_code == 200, resp.text
    body = resp.json()
    assert body["created"] == 1
    assert body["skipped"] == 0
    assert body["errors"] == 0

    txn = db.query(Transaction).filter(Transaction.transaction_ref == ref).first()
    assert txn is not None
    assert txn.customer_id == customer["id"]


def test_batch_resubmit_is_idempotent_not_duplicated(client, db, analyst_headers):
    """Re-submitting the exact same batch (e.g. after a network-timeout
    retry) must not create a second transaction for the same ref."""
    customer = _create_customer(client, analyst_headers)
    ref = f"TXN-RETRY-{uuid.uuid4().hex[:8]}"
    body = {
        "transactions": [
            {
                "transaction_ref": ref,
                "customer_ref": customer["customer_ref"],
                "transaction_type": "deposit",
                "direction": "incoming",
                "payment_method": "bank_transfer",
                "amount": 800.00,
                "transaction_date": "2026-06-01T10:00:00",
            }
        ]
    }

    first = client.post(
        "/api/v1/transactions/batch", json=body, headers=analyst_headers
    )
    assert first.status_code == 200
    assert first.json()["created"] == 1

    second = client.post(
        "/api/v1/transactions/batch", json=body, headers=analyst_headers
    )
    assert second.status_code == 200
    assert second.json()["created"] == 0
    assert second.json()["skipped"] == 1

    count = db.query(Transaction).filter(Transaction.transaction_ref == ref).count()
    assert count == 1


def test_batch_duplicate_ref_within_same_request_is_skipped_not_double_created(
    client, db, analyst_headers
):
    customer = _create_customer(client, analyst_headers)
    ref = f"TXN-DUPE-{uuid.uuid4().hex[:8]}"
    item = {
        "transaction_ref": ref,
        "customer_ref": customer["customer_ref"],
        "transaction_type": "deposit",
        "direction": "incoming",
        "payment_method": "cash",
        "amount": 200.00,
        "transaction_date": "2026-06-01T10:00:00",
    }

    resp = client.post(
        "/api/v1/transactions/batch",
        json={"transactions": [item, dict(item)]},
        headers=analyst_headers,
    )
    assert resp.status_code == 200
    body = resp.json()
    assert body["created"] == 1
    assert body["skipped"] == 1

    count = db.query(Transaction).filter(Transaction.transaction_ref == ref).count()
    assert count == 1


def test_batch_unknown_customer_reported_as_error_not_batch_abort(
    client, db, analyst_headers
):
    """One row referencing a customer that doesn't exist must not stop
    the rest of the batch from being processed."""
    good_customer = _create_customer(client, analyst_headers)
    good_ref = f"TXN-GOOD-{uuid.uuid4().hex[:8]}"
    bad_ref = f"TXN-BAD-{uuid.uuid4().hex[:8]}"

    resp = client.post(
        "/api/v1/transactions/batch",
        json={
            "transactions": [
                {
                    "transaction_ref": bad_ref,
                    "customer_ref": "CUST-DOES-NOT-EXIST",
                    "transaction_type": "deposit",
                    "direction": "incoming",
                    "payment_method": "cash",
                    "amount": 100.00,
                    "transaction_date": "2026-06-01T10:00:00",
                },
                {
                    "transaction_ref": good_ref,
                    "customer_ref": good_customer["customer_ref"],
                    "transaction_type": "deposit",
                    "direction": "incoming",
                    "payment_method": "cash",
                    "amount": 100.00,
                    "transaction_date": "2026-06-01T10:00:00",
                },
            ]
        },
        headers=analyst_headers,
    )
    assert resp.status_code == 200
    body = resp.json()
    assert body["created"] == 1
    assert body["errors"] == 1
    assert db.query(Transaction).filter(Transaction.transaction_ref == good_ref).first()
    assert (
        not db.query(Transaction).filter(Transaction.transaction_ref == bad_ref).first()
    )


def test_batch_runs_monitoring_pipeline_same_as_manual_create(
    client, db, analyst_headers
):
    customer = _create_customer(client, analyst_headers)
    c = db.query(Customer).filter(Customer.id == customer["id"]).first()
    c.is_pep = True
    db.commit()

    ref = f"TXN-MONITOR-{uuid.uuid4().hex[:8]}"
    resp = client.post(
        "/api/v1/transactions/batch",
        json={
            "transactions": [
                {
                    "transaction_ref": ref,
                    "customer_ref": customer["customer_ref"],
                    "transaction_type": "transfer",
                    "direction": "outgoing",
                    "payment_method": "bank_transfer",
                    "amount": 250000.00,
                    "is_cross_border": True,
                    "country_destination": "KP",
                    "transaction_date": "2026-06-01T10:00:00",
                }
            ]
        },
        headers=analyst_headers,
    )
    assert resp.status_code == 200, resp.text
    txn_id = resp.json()["created_transactions"][0]["transaction_id"]

    alerts = (
        db.query(TransactionAlert)
        .filter(TransactionAlert.transaction_id == txn_id)
        .all()
    )
    assert len(alerts) >= 1, (
        "Batch ingestion did not run the monitoring engine -- a PEP "
        "customer sending a large cross-border transfer to a FATF-"
        "blacklisted country should generate at least one alert."
    )


def test_batch_tenant_isolation_via_customer_ref(client, db, analyst_headers):
    """A customer_ref only resolves within the caller's own org -- it
    must not be possible to post a transaction against another org's
    customer just by guessing/knowing their customer_ref."""
    from app.models.user import UserRole
    from tests.conftest import _make_user

    other_user = _make_user(db, UserRole.analyst)
    other_headers = _auth(other_user)
    other_customer = _create_customer(client, other_headers)

    resp = client.post(
        "/api/v1/transactions/batch",
        json={
            "transactions": [
                {
                    "transaction_ref": f"TXN-CROSSORG-{uuid.uuid4().hex[:8]}",
                    "customer_ref": other_customer["customer_ref"],
                    "transaction_type": "deposit",
                    "direction": "incoming",
                    "payment_method": "cash",
                    "amount": 100.00,
                    "transaction_date": "2026-06-01T10:00:00",
                }
            ]
        },
        headers=analyst_headers,
    )
    assert resp.status_code == 200
    body = resp.json()
    assert body["created"] == 0
    assert body["errors"] == 1


def test_batch_requires_authentication(client):
    resp = client.post("/api/v1/transactions/batch", json={"transactions": []})
    assert resp.status_code in (401, 422)


def test_batch_viewer_forbidden(client, viewer_headers):
    resp = client.post(
        "/api/v1/transactions/batch",
        json={
            "transactions": [
                {
                    "transaction_ref": "TXN-VIEWER-001",
                    "customer_ref": "CUST-000001",
                    "transaction_type": "deposit",
                    "direction": "incoming",
                    "payment_method": "cash",
                    "amount": 100.00,
                    "transaction_date": "2026-06-01T10:00:00",
                }
            ]
        },
        headers=viewer_headers,
    )
    assert resp.status_code == 403


def test_batch_rejects_more_than_500_items(client, analyst_headers):
    item = {
        "transaction_ref": "TXN-CAP",
        "customer_ref": "CUST-000001",
        "transaction_type": "deposit",
        "direction": "incoming",
        "payment_method": "cash",
        "amount": 100.00,
        "transaction_date": "2026-06-01T10:00:00",
    }
    resp = client.post(
        "/api/v1/transactions/batch",
        json={"transactions": [item] * 501},
        headers=analyst_headers,
    )
    assert resp.status_code == 422


# ── CSV/Excel import ────────────────────────────────────────────────────────


def test_import_template_downloads_csv_with_expected_headers(client, analyst_headers):
    resp = client.get("/api/v1/transactions/import/template", headers=analyst_headers)
    assert resp.status_code == 200
    assert resp.headers["content-type"].startswith("text/csv")
    text = resp.content.decode("utf-8-sig")
    header_line = text.splitlines()[0]
    assert "transaction_ref" in header_line
    assert "customer_ref" in header_line
    assert "transaction_type" in header_line


def test_import_field_guide_lists_required_fields(client, analyst_headers):
    resp = client.get(
        "/api/v1/transactions/import/field-guide", headers=analyst_headers
    )
    assert resp.status_code == 200
    fields = {f["field"]: f for f in resp.json()["fields"]}
    assert fields["transaction_ref"]["required"] is True
    assert fields["customer_ref"]["required"] is True


def test_csv_upload_creates_transaction_from_customer_ref(
    client, db, compliance_headers
):
    customer = _create_customer(client, compliance_headers)
    ref = f"TXN-CSV-{uuid.uuid4().hex[:8]}"
    csv_content = (
        "transaction_ref,customer_ref,transaction_type,direction,payment_method,"
        "amount,transaction_date\n"
        f"{ref},{customer['customer_ref']},transfer,outgoing,bank_transfer,"
        "2500.00,2026-06-01T10:00:00\n"
    ).encode()

    resp = client.post(
        "/api/v1/transactions/import/upload",
        files={"file": ("transactions.csv", io.BytesIO(csv_content), "text/csv")},
        headers=compliance_headers,
    )
    assert resp.status_code == 200, resp.text
    body = resp.json()
    assert body["created"] == 1
    assert body["error_count"] == 0

    txn = db.query(Transaction).filter(Transaction.transaction_ref == ref).first()
    assert txn is not None
    assert txn.customer_id == customer["id"]
    assert txn.amount == 2500.00


def test_csv_upload_reports_bad_row_without_failing_whole_file(
    client, db, compliance_headers
):
    customer = _create_customer(client, compliance_headers)
    good_ref = f"TXN-CSVGOOD-{uuid.uuid4().hex[:8]}"
    csv_content = (
        "transaction_ref,customer_ref,transaction_type,direction,payment_method,"
        "amount,transaction_date\n"
        f"{good_ref},{customer['customer_ref']},transfer,outgoing,bank_transfer,"
        "1000.00,2026-06-01T10:00:00\n"
        f"TXN-CSVBAD,{customer['customer_ref']},not_a_real_type,outgoing,"
        "bank_transfer,1000.00,2026-06-01T10:00:00\n"
    ).encode()

    resp = client.post(
        "/api/v1/transactions/import/upload",
        files={"file": ("transactions.csv", io.BytesIO(csv_content), "text/csv")},
        headers=compliance_headers,
    )
    assert resp.status_code == 200, resp.text
    body = resp.json()
    assert body["created"] == 1
    assert body["error_count"] == 1
    assert db.query(Transaction).filter(Transaction.transaction_ref == good_ref).first()


def test_csv_upload_analyst_forbidden(client, analyst_headers):
    """Bulk file import requires compliance+ (higher bar than the
    analyst-level single/JSON-batch create), matching the customer
    bulk-import endpoint's role requirement."""
    csv_content = b"transaction_ref,customer_ref\nTXN-X,CUST-X\n"
    resp = client.post(
        "/api/v1/transactions/import/upload",
        files={"file": ("transactions.csv", io.BytesIO(csv_content), "text/csv")},
        headers=analyst_headers,
    )
    assert resp.status_code == 403
