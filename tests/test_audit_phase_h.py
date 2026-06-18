"""
Phase H — Audit Infrastructure: key actions (login, customer create, risk
matrix change, policy/org update) must write an AuditLog entry.
"""

from app.models.audit import AuditLog
from app.models.user import UserRole
from tests.conftest import _make_user, _auth

CUSTOMER_PAYLOAD = {
    "full_name": "Audit Test",
    "email": "audit-test@example.com",
    "phone": "+61400000002",
    "date_of_birth": "1990-01-15",
    "nationality": "Australian",
    "country_of_residence": "Australia",
    "id_number": "PA999999",
    "id_type": "passport",
    "address": "1 Test St, Sydney NSW 2000",
    "industry": "banking",
    "occupation": "Engineer",
    "source_of_funds": "Salary",
}


def test_login_writes_audit_log(client, db, analyst_user):
    resp = client.post(
        "/api/v1/auth/login",
        json={"email": analyst_user.email, "password": "TestPassword123!"},
    )
    assert resp.status_code == 200

    entry = (
        db.query(AuditLog)
        .filter_by(action="user_logged_in", entity_id=analyst_user.user_id)
        .first()
    )
    assert entry is not None
    assert entry.actor == analyst_user.email


def test_customer_create_writes_audit_log(client, db, analyst_headers, analyst_user):
    resp = client.post("/api/v1/customers/", json=CUSTOMER_PAYLOAD, headers=analyst_headers)
    assert resp.status_code == 201
    customer_id = resp.json()["customer_id"]

    entry = (
        db.query(AuditLog)
        .filter_by(action="customer_created", entity_id=customer_id)
        .first()
    )
    assert entry is not None
    assert entry.actor == analyst_user.email


def test_rescore_writes_risk_matrix_changed_audit_log(client, db, analyst_headers, compliance_headers):
    resp = client.post(
        "/api/v1/customers/",
        json={**CUSTOMER_PAYLOAD, "email": "audit-rescore@example.com"},
        headers=analyst_headers,
    )
    assert resp.status_code == 201
    customer_id = resp.json()["customer_id"]

    resp = client.post(f"/api/v1/customers/{customer_id}/rescore", headers=compliance_headers)
    assert resp.status_code == 200

    entry = (
        db.query(AuditLog)
        .filter_by(action="risk_matrix_changed", entity_id=customer_id)
        .first()
    )
    assert entry is not None
    assert entry.before_state is not None
    assert entry.after_state is not None


def test_org_update_writes_policy_updated_audit_log(client, db):
    from app.services.org_service import seed_permission_catalog_and_roles

    seed_permission_catalog_and_roles(db)
    owner = _make_user(db, UserRole.analyst, industry_id=None)
    headers = _auth(owner)

    res = client.post(
        "/api/v1/organisations", json={"name": "Audit Co", "industry_id": "banking-au"}, headers=headers
    )
    assert res.status_code == 201, res.text
    org_id = res.json()["org_id"]

    resp = client.patch(
        f"/api/v1/organisations/{org_id}",
        json={"abn": "12345678901"},
        headers=headers,
    )
    assert resp.status_code == 200, resp.text

    entry = (
        db.query(AuditLog)
        .filter_by(action="policy_updated", entity_id=org_id)
        .first()
    )
    assert entry is not None
    assert entry.after_state.get("abn") == "12345678901"
