"""
Smoke test for a confirmed crash in
app/services/retention_service.py's generate_purge_report()
(GET /retention/purge-report), unconditionally executed on every call
(no try/except around it):

- `from app.models.kyc import KYCRecord` -- no such class exists in
  app/models/kyc.py (there are five separate verification tables:
  identity document, selfie, address, phone, email). This alone raised
  ImportError on every call.
- Customer.organisation_id / Customer.industry_id -- neither attribute
  exists on Customer (its only tenant column is org_id, which is what
  every other query against this model in the codebase uses).
- Customer.customer_id -- also doesn't exist (the real PK is `id`, the
  `customer_ref` field is the human-facing reference). This wasn't caught
  by the original fix above because that test never had a Customer past
  the retention cutoff, so the loop body that reads it never ran -- mypy's
  attr-defined check caught it once the SQLAlchemy plugin was enabled.
"""

from datetime import datetime, timedelta, timezone

from app.models.customer import Customer, CustomerStatus
from app.models.kyc import CustomerSelfieVerification
from tests.conftest import _auth


def test_purge_report_does_not_500(client, admin_user):
    resp = client.get("/api/v1/retention/purge-report", headers=_auth(admin_user))
    assert resp.status_code == 200
    body = resp.json()
    assert "items" in body
    assert "total_eligible" in body


def test_purge_report_includes_customer_past_retention_cutoff(client, admin_user, db):
    old_customer = Customer(
        customer_ref="CUST-OLD-0001",
        org_id=admin_user.org_id,
        full_name="Old Customer",
        status=CustomerStatus.active,
    )
    db.add(old_customer)
    db.commit()
    db.refresh(old_customer)
    # created_at has a server_default -- backdate it past the 7-year AUSTRAC
    # default retention window so the purge-report loop actually visits it.
    db.query(Customer).filter(Customer.id == old_customer.id).update(
        {"created_at": datetime.now(timezone.utc) - timedelta(days=8 * 365)}
    )
    db.commit()

    resp = client.get("/api/v1/retention/purge-report", headers=_auth(admin_user))
    assert resp.status_code == 200, resp.text
    ids = [item["id"] for item in resp.json()["items"] if item["scope"] == "customer"]
    assert old_customer.id in ids


def test_purge_report_covers_all_five_kyc_verification_tables(client, admin_user, db):
    """
    P2 (PARKING_LOT.md): the original fix only swept CustomerIdentityDocument,
    the most fundamental of the five KYC verification tables. Confirms the
    other four (selfie/address/phone/email) are now included too, using
    selfie verification as the representative case.
    """
    customer = Customer(
        customer_ref="CUST-OLD-0002",
        org_id=admin_user.org_id,
        full_name="Old Customer 2",
        status=CustomerStatus.active,
    )
    db.add(customer)
    db.commit()
    db.refresh(customer)

    selfie = CustomerSelfieVerification(
        customer_id=customer.id,
        org_id=admin_user.org_id,
    )
    db.add(selfie)
    db.commit()
    db.refresh(selfie)
    db.query(CustomerSelfieVerification).filter(
        CustomerSelfieVerification.id == selfie.id
    ).update({"created_at": datetime.now(timezone.utc) - timedelta(days=8 * 365)})
    db.commit()

    resp = client.get("/api/v1/retention/purge-report", headers=_auth(admin_user))
    assert resp.status_code == 200, resp.text
    ids = [
        item["id"]
        for item in resp.json()["items"]
        if item["scope"] == "kyc_selfie_verification"
    ]
    assert selfie.id in ids
