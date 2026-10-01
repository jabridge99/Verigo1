"""
P39: billing_service.enforce_customer_limit() (added for Stage 13's plan
usage limits) originally only guarded POST /customers/ -- an org could
still exceed its plan's customer cap two other ways:

1. The onboarding wizard's own customer-creation paths -- create_session()
   (app/services/onboarding_service.py), which always creates a draft
   Customer immediately, called by both POST /onboarding/sessions and,
   in a loop, bulk_create_sessions() (POST /onboarding/import/csv|excel).
2. POST /customers/import/upload (bulk CSV/Excel customer import), which
   builds Customer rows directly without going through create_customer().

Fixed by calling enforce_customer_limit() at the top of create_session(),
and by having bulk_import_customers() track remaining capacity across the
row loop (via the new remaining_customer_capacity() helper) and skip rows
once it hits zero, rather than either ignoring the cap or hard-failing
the whole upload.
"""

import io
import uuid

from app.models.customer import Customer, CustomerStatus, CustomerType


def _fill_customer_quota(db, org_id: str, count: int) -> None:
    """Directly insert `count` customers -- faster than round-tripping
    through the API for a plain test-setup fixture."""
    for _ in range(count):
        db.add(
            Customer(
                customer_ref=f"CUST-{uuid.uuid4().hex[:10].upper()}",
                org_id=org_id,
                customer_type=CustomerType.individual,
                status=CustomerStatus.draft,
                full_name="Quota Filler",
                email=f"filler-{uuid.uuid4().hex[:8]}@example.com",
            )
        )
    db.commit()


# ── Onboarding session creation (single) ─────────────────────────────────────


def test_onboarding_session_creation_blocked_at_customer_limit(
    client, db, compliance_user, compliance_headers
):
    _fill_customer_quota(db, compliance_user.org_id, 10)  # free-trial cap

    resp = client.post(
        "/api/v1/onboarding/sessions",
        json={
            "applicant_name": "One Too Many",
            "applicant_email": f"over-{uuid.uuid4().hex[:6]}@example.com",
            "customer_type": "individual",
        },
        headers=compliance_headers,
    )
    assert resp.status_code == 403, resp.text
    assert "customer limit" in resp.json()["detail"]


def test_onboarding_session_creation_succeeds_under_limit(
    client, db, compliance_user, compliance_headers
):
    _fill_customer_quota(db, compliance_user.org_id, 9)

    resp = client.post(
        "/api/v1/onboarding/sessions",
        json={
            "applicant_name": "Just Fits",
            "applicant_email": f"fits-{uuid.uuid4().hex[:6]}@example.com",
            "customer_type": "individual",
        },
        headers=compliance_headers,
    )
    assert resp.status_code == 201, resp.text


# ── Bulk onboarding invites (CSV) ────────────────────────────────────────────


def test_bulk_onboarding_csv_reports_limit_errors_without_failing_whole_batch(
    client, db, compliance_user, compliance_headers
):
    _fill_customer_quota(db, compliance_user.org_id, 9)  # 1 slot left

    csv_content = (
        "full_name,email\n"
        "Applicant One,bulk-onboard-1@example.com\n"
        "Applicant Two,bulk-onboard-2@example.com\n"
    ).encode()

    resp = client.post(
        "/api/v1/onboarding/import/csv",
        files={"file": ("applicants.csv", io.BytesIO(csv_content), "text/csv")},
        headers=compliance_headers,
    )
    assert resp.status_code == 201, resp.text
    batch = resp.json()
    assert batch["success_rows"] == 1
    assert batch["error_rows"] == 1
    assert any("customer limit" in e["error"] for e in batch["errors"])


# ── Bulk customer CSV/Excel import ───────────────────────────────────────────


def test_bulk_customer_import_stops_creating_once_limit_reached(
    client, db, compliance_user, compliance_headers
):
    _fill_customer_quota(db, compliance_user.org_id, 9)  # 1 slot left

    csv_content = (
        "full_name,email\n"
        "Import One,bulk-import-1@example.com\n"
        "Import Two,bulk-import-2@example.com\n"
        "Import Three,bulk-import-3@example.com\n"
    ).encode()

    resp = client.post(
        "/api/v1/customers/import/upload",
        files={"file": ("customers.csv", io.BytesIO(csv_content), "text/csv")},
        headers=compliance_headers,
    )
    assert resp.status_code == 200, resp.text
    body = resp.json()
    assert body["created"] == 1
    assert body["skipped"] == 2
    assert all(
        "customer limit" in row["reason"].lower() for row in body["skipped_rows"]
    )
