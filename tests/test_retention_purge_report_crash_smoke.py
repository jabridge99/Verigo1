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
"""

from tests.conftest import _auth


def test_purge_report_does_not_500(client, admin_user):
    resp = client.get("/api/v1/retention/purge-report", headers=_auth(admin_user))
    assert resp.status_code == 200
    body = resp.json()
    assert "items" in body
    assert "total_eligible" in body
