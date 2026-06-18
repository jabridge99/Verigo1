"""
Trial-gating: free-trial accounts receive a genuinely smaller, server-built
preview payload for the AML program and risk assessment — not the full data
hidden client-side. Locked entries must never carry the real title/description.
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


def test_free_trial_aml_program_is_a_shrunken_preview(client, db):
    seed_permission_catalog_and_roles(db)
    owner = _make_user(db, UserRole.analyst, industry_id=None)
    headers = _auth(owner)

    org = _create_org(client, headers, industry_id="banking-au")
    client.patch(
        f"/api/v1/organisations/{org['org_id']}",
        json={"risk_profile": "high"},
        headers=headers,
    )

    res = client.post(f"/api/v1/organisations/{org['org_id']}/aml-program/generate", headers=headers)
    assert res.status_code == 201, res.text
    program = res.json()

    assert program["is_preview"] is True
    assert program["total_items"] > len(program["items"])

    unlocked = [i for i in program["items"] if not i["locked"]]
    locked = [i for i in program["items"] if i["locked"]]
    assert len(unlocked) == 3
    assert len(locked) > 0
    for item in locked:
        assert item["title"] == "Upgrade to unlock"
        assert item["description"] is None
        assert item["review_frequency"] is None

    # Locked placeholders never reveal real control titles even via repeated GET.
    res = client.get(f"/api/v1/organisations/{org['org_id']}/aml-program", headers=headers)
    assert res.status_code == 200
    titles = {i["title"] for i in res.json()["items"]}
    assert "Enhanced Due Diligence (EDD) for All High-Risk Customers" not in titles


def test_free_trial_risk_assessment_is_a_shrunken_preview(client, db):
    seed_permission_catalog_and_roles(db)
    owner = _make_user(db, UserRole.analyst, industry_id=None)
    headers = _auth(owner)

    org = _create_org(client, headers, industry_id="banking-au")
    client.patch(
        f"/api/v1/organisations/{org['org_id']}",
        json={"risk_profile": "high"},
        headers=headers,
    )

    res = client.post(f"/api/v1/organisations/{org['org_id']}/risk-assessment/generate", headers=headers)
    assert res.status_code == 201, res.text
    assessment = res.json()

    assert assessment["is_preview"] is True
    unlocked = [f for f in assessment["factors"] if not f["locked"]]
    locked = [f for f in assessment["factors"] if f["locked"]]
    assert len(unlocked) == 2
    assert len(locked) > 0
    for factor in locked:
        assert factor["description"] == "Upgrade to view full risk assessment."
        assert factor["rating"] == "locked"


def test_paid_plan_gets_full_program_and_assessment(client, db):
    seed_permission_catalog_and_roles(db)
    admin = _make_user(db, UserRole.admin, industry_id=None)
    owner = _make_user(db, UserRole.analyst, industry_id=None)
    headers = _auth(owner)

    org = _create_org(client, headers, industry_id="banking-au")
    res = client.patch(
        f"/api/v1/billing/admin/banking-au?organisation_id={org['id']}",
        json={"plan": "professional"},
        headers=_auth(admin),
    )
    assert res.status_code == 200, res.text

    client.patch(
        f"/api/v1/organisations/{org['org_id']}",
        json={"risk_profile": "high"},
        headers=headers,
    )

    res = client.post(f"/api/v1/organisations/{org['org_id']}/aml-program/generate", headers=headers)
    program = res.json()
    assert program["is_preview"] is False
    assert all(not i["locked"] for i in program["items"])

    res = client.post(f"/api/v1/organisations/{org['org_id']}/risk-assessment/generate", headers=headers)
    assessment = res.json()
    assert assessment["is_preview"] is False
    assert all(not f["locked"] for f in assessment["factors"])
