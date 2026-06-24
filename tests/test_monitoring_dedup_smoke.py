"""
Smoke test: POST /transactions/{id}/run-monitoring is an explicit
re-evaluation/backfill endpoint that can be called more than once for the
same transaction (manual re-run, retried webhook). Each call created a
brand-new TransactionAlert with no dedup, polluting the analyst queue with
duplicates for the same underlying activity. Fixed by skipping alert
creation when an open (non-dismissed/non-resolved) alert already exists for
the transaction.
"""

import uuid

from app.models.customer import Customer
from app.models.monitoring import TransactionAlert


CUSTOMER_PAYLOAD = {
    "full_name": "Dedup Test Customer",
    "email": "dedup-customer@example.com",
    "phone": "+61400000099",
    "date_of_birth": "1980-05-10",
    "nationality": "AU",
    "country_of_residence": "AU",
    "id_number": "PP99999999",
    "id_type": "passport",
    "address": "1 Dedup St, Sydney NSW 2000",
    "industry": "banking",
}

TXN_PAYLOAD = {
    "transaction_type": "transfer",
    "direction": "outgoing",
    "payment_method": "bank_transfer",
    "amount": 250000.00,
    "currency": "AUD",
    "is_cross_border": True,
    "description": "Large cross-border transfer",
    "counterparty_name": "Offshore Corp",
    "counterparty_account": "999888777",
    "counterparty_bank": "Foreign Bank",
    "counterparty_country": "KP",
    "transaction_date": "2025-06-01T10:00:00",
}


def _create_customer(client, headers):
    resp = client.post(
        "/api/v1/customers/",
        json={**CUSTOMER_PAYLOAD, "email": f"dedup-{uuid.uuid4().hex[:6]}@example.com"},
        headers=headers,
    )
    assert resp.status_code == 201, resp.text
    return resp.json()["id"]


def _create_txn(client, headers, customer_id):
    ref = f"TXN-DEDUP-{uuid.uuid4().hex[:8]}"
    resp = client.post(
        "/api/v1/transactions/",
        json={
            **TXN_PAYLOAD,
            "customer_id": customer_id,
            "transaction_ref": ref,
            "reference": ref,
        },
        headers=headers,
    )
    assert resp.status_code == 201, resp.text
    return resp.json()["id"]


def test_rerunning_monitoring_does_not_duplicate_open_alert(
    client, db, compliance_headers
):
    customer_id = _create_customer(client, compliance_headers)
    customer = db.query(Customer).filter(Customer.id == customer_id).first()
    customer.is_pep = True
    db.commit()
    txn_id = _create_txn(client, compliance_headers, customer_id)

    first = client.post(
        f"/api/v1/transactions/{txn_id}/run-monitoring", headers=compliance_headers
    )
    assert first.status_code == 200, first.text
    assert first.json()["alerts_generated"] >= 1, (
        "test payload must actually trigger an alert for this to exercise dedup"
    )

    second = client.post(
        f"/api/v1/transactions/{txn_id}/run-monitoring", headers=compliance_headers
    )
    assert second.status_code == 200, second.text
    assert second.json()["alerts_generated"] == 0

    total_alerts = (
        db.query(TransactionAlert)
        .filter(TransactionAlert.transaction_id == txn_id)
        .count()
    )
    assert total_alerts == 1
