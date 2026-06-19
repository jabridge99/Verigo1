"""
Phase C — self-service sign-up: organisation industry/risk-profile
selection and auto-generated AML/CTF program.
"""

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


def test_signup_flow_generates_program(client, db):
    seed_permission_catalog_and_roles(db)
    admin = _make_user(db, UserRole.admin, industry_id=None)
    owner = _make_user(db, UserRole.analyst, industry_id=None)
    headers = _auth(owner)

    org = _create_org(client, headers, industry_id="banking-au")

    # Give this org a paid plan so it sees the full (non-preview) program.
    res = client.patch(
        f"/api/v1/billing/admin/banking-au?organisation_id={org['id']}",
        json={"plan": "starter"},
        headers=_auth(admin),
    )
    assert res.status_code == 200, res.text

    res = client.patch(
        f"/api/v1/organisations/{org['id']}",
        json={"risk_profile": "high"},
        headers=headers,
    )
    assert res.status_code == 200, res.text
    assert res.json()["risk_profile"] == "high"

    res = client.post(f"/api/v1/organisations/{org['id']}/aml-program/generate", headers=headers)
    assert res.status_code == 201, res.text
    program = res.json()
    assert program["industry_id"] == "banking-au"
    assert program["risk_profile"] == "high"
    assert program["version"] == 1
    assert program["is_preview"] is False
    titles = {item["title"] for item in program["items"]}
    assert "Enhanced Due Diligence (EDD) for All High-Risk Customers" in titles
    assert "Threshold Transaction Reports (TTR)" in titles
    assert "Appoint an AML/CTF Compliance Officer (MLRO)" in titles

    # Regenerating bumps the version and replaces items.
    res = client.post(f"/api/v1/organisations/{org['id']}/aml-program/generate", headers=headers)
    assert res.status_code == 201
    assert res.json()["version"] == 2

    res = client.get(f"/api/v1/organisations/{org['id']}/aml-program", headers=headers)
    assert res.status_code == 200
    assert res.json()["version"] == 2


def test_generate_program_requires_industry_and_risk_profile(client, db):
    seed_permission_catalog_and_roles(db)
    owner = _make_user(db, UserRole.analyst, industry_id=None)
    headers = _auth(owner)
    org = _create_org(client, headers)

    res = client.post(f"/api/v1/organisations/{org['id']}/aml-program/generate", headers=headers)
    assert res.status_code == 400


def test_non_member_cannot_generate_program(client, db):
    seed_permission_catalog_and_roles(db)
    owner = _make_user(db, UserRole.analyst, industry_id=None)
    other = _make_user(db, UserRole.analyst, industry_id=None)
    org = _create_org(client, _auth(owner), industry_id="fintech")
    client.patch(f"/api/v1/organisations/{org['id']}", json={"risk_profile": "low"}, headers=_auth(owner))

    res = client.post(f"/api/v1/organisations/{org['id']}/aml-program/generate", headers=_auth(other))
    assert res.status_code == 403
