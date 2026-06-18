"""
Phase I — Customer Success Layer: onboarding risk assessment generation
and the industry-owner AML accountability acknowledgement checkbox.
"""

from app.models.audit import LegacyAuditLog as AuditLog
from app.models.user import UserRole
from app.services.org_service import seed_permission_catalog_and_roles
from tests.conftest import _make_user, _auth


def _create_org(client, headers, name="Test Remitco", industry_id=None):
    payload = {"name": name}
    if industry_id:
        payload["industry_id"] = industry_id
    res = client.post("/api/v1/organisations", json=payload, headers=headers)
    assert res.status_code == 201, res.text
    return res.json()


def test_generate_risk_assessment(client, db):
    seed_permission_catalog_and_roles(db)
    owner = _make_user(db, UserRole.analyst, industry_id=None)
    headers = _auth(owner)
    org = _create_org(client, headers, industry_id="banking-au")

    client.patch(f"/api/v1/organisations/{org['id']}", json={"risk_profile": "high"}, headers=headers)

    res = client.post(f"/api/v1/organisations/{org['id']}/risk-assessment/generate", headers=headers)
    assert res.status_code == 201, res.text
    body = res.json()
    assert body["overall_rating"] == "high"
    assert body["industry_id"] == "banking-au"
    assert any(f["factor"] == "customer_risk" for f in body["factors"])

    res = client.get(f"/api/v1/organisations/{org['id']}/risk-assessment", headers=headers)
    assert res.status_code == 200
    assert res.json()["overall_rating"] == "high"


def test_generate_risk_assessment_requires_industry_and_profile(client, db):
    seed_permission_catalog_and_roles(db)
    owner = _make_user(db, UserRole.analyst, industry_id=None)
    headers = _auth(owner)
    org = _create_org(client, headers)

    res = client.post(f"/api/v1/organisations/{org['id']}/risk-assessment/generate", headers=headers)
    assert res.status_code == 400


def test_get_risk_assessment_404_before_generation(client, db):
    seed_permission_catalog_and_roles(db)
    owner = _make_user(db, UserRole.analyst, industry_id=None)
    headers = _auth(owner)
    org = _create_org(client, headers, industry_id="fintech")

    res = client.get(f"/api/v1/organisations/{org['id']}/risk-assessment", headers=headers)
    assert res.status_code == 404


def test_accountability_ack_writes_audit_log_and_blocks_false(client, db):
    seed_permission_catalog_and_roles(db)
    owner = _make_user(db, UserRole.analyst, industry_id=None)
    headers = _auth(owner)
    org = _create_org(client, headers, industry_id="fintech")

    res = client.post(
        f"/api/v1/organisations/{org['id']}/aml-accountability/ack",
        json={"acknowledged": False},
        headers=headers,
    )
    assert res.status_code == 400

    res = client.post(
        f"/api/v1/organisations/{org['id']}/aml-accountability/ack",
        json={"acknowledged": True},
        headers=headers,
    )
    assert res.status_code == 200
    body = res.json()
    assert body["aml_accountability_ack"] is True
    assert body["aml_accountability_ack_by"] == owner.email

    entry = (
        db.query(AuditLog)
        .filter_by(action="aml_accountability_acknowledged", entity_id=org["id"])
        .first()
    )
    assert entry is not None


def test_non_member_cannot_acknowledge_accountability(client, db):
    seed_permission_catalog_and_roles(db)
    owner = _make_user(db, UserRole.analyst, industry_id=None)
    other = _make_user(db, UserRole.analyst, industry_id=None)
    org = _create_org(client, _auth(owner), industry_id="fintech")

    res = client.post(
        f"/api/v1/organisations/{org['id']}/aml-accountability/ack",
        json={"acknowledged": True},
        headers=_auth(other),
    )
    assert res.status_code == 403
