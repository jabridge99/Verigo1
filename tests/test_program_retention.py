"""
Retention: versioned AML program snapshots, throttled retrieval for lapsed
organisations, public verification, export audit trail, and the program
health ("rev up") nudge.
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


def _set_plan(client, admin_headers, industry_id, org_id, plan, status="active"):
    res = client.patch(
        f"/api/v1/billing/admin/{industry_id}?organisation_id={org_id}",
        json={"plan": plan, "status": status},
        headers=admin_headers,
    )
    assert res.status_code == 200, res.text
    return res.json()


def _setup_program(client, db, plan="professional", status="active"):
    seed_permission_catalog_and_roles(db)
    admin = _make_user(db, UserRole.admin, industry_id=None)
    owner = _make_user(db, UserRole.analyst, industry_id=None)
    headers = _auth(owner)
    admin_headers = _auth(admin)

    org = _create_org(client, headers, industry_id="banking-au")
    _set_plan(client, admin_headers, "banking-au", org["id"], plan, status)
    client.patch(
        f"/api/v1/organisations/{org['id']}",
        json={"risk_profile": "high"},
        headers=headers,
    )
    return org, headers, admin_headers


def test_generating_program_snapshots_each_version(client, db):
    org, headers, _ = _setup_program(client, db)

    client.post(f"/api/v1/organisations/{org['id']}/aml-program/generate", headers=headers)
    client.post(f"/api/v1/organisations/{org['id']}/aml-program/generate", headers=headers)

    res = client.get(f"/api/v1/organisations/{org['id']}/aml-program/versions", headers=headers)
    assert res.status_code == 200, res.text
    body = res.json()
    assert body["full_history_available"] is True
    assert [v["version"] for v in body["versions"]] == [2, 1]
    assert body["versions"][0]["is_current"] is True
    assert body["versions"][0]["qr_token"]


def test_canceled_org_sees_latest_version_only(client, db):
    org, headers, admin_headers = _setup_program(client, db)
    client.post(f"/api/v1/organisations/{org['id']}/aml-program/generate", headers=headers)
    client.post(f"/api/v1/organisations/{org['id']}/aml-program/generate", headers=headers)

    _set_plan(client, admin_headers, "banking-au", org["id"], "professional", "canceled")

    res = client.get(f"/api/v1/organisations/{org['id']}/aml-program/versions", headers=headers)
    body = res.json()
    assert body["full_history_available"] is False
    assert len(body["versions"]) == 1
    assert body["versions"][0]["version"] == 2

    # Latest version is still freely retrievable.
    res = client.get(f"/api/v1/organisations/{org['id']}/aml-program/versions/2", headers=headers)
    assert res.status_code == 200

    # An older version is throttled instead of an instant download.
    res = client.get(f"/api/v1/organisations/{org['id']}/aml-program/versions/1", headers=headers)
    assert res.status_code == 200, res.text

    # Second immediate retrieval of an old version is rate-limited.
    res = client.get(f"/api/v1/organisations/{org['id']}/aml-program/versions/1", headers=headers)
    assert res.status_code == 429


def test_export_requires_reason_and_is_audited(client, db):
    org, headers, admin_headers = _setup_program(client, db)
    client.post(f"/api/v1/organisations/{org['id']}/aml-program/generate", headers=headers)

    res = client.post(
        f"/api/v1/organisations/{org['id']}/aml-program/export",
        json={"reason": ""},
        headers=headers,
    )
    assert res.status_code == 400

    res = client.post(
        f"/api/v1/organisations/{org['id']}/aml-program/export",
        json={"reason": "Regulator requested evidence pack"},
        headers=headers,
    )
    assert res.status_code == 200, res.text

    res = client.get(
        "/api/v1/audit/", params={"action": "aml_program_exported"}, headers=admin_headers
    )
    assert res.status_code == 200, res.text
    entries = res.json()
    assert len(entries) >= 1
    assert entries[0]["notes"] == "Regulator requested evidence pack"


def test_program_health_flags_missing_controls(client, db):
    org, headers, _ = _setup_program(client, db)
    client.post(f"/api/v1/organisations/{org['id']}/aml-program/generate", headers=headers)

    res = client.get(f"/api/v1/organisations/{org['id']}/aml-program/health", headers=headers)
    assert res.status_code == 200, res.text
    health = res.json()
    assert health["up_to_date"] is True
    assert health["score"] == 100
    assert health["suggestions"] == []


def test_verification_endpoint_is_public_and_hides_content(client, db):
    org, headers, _ = _setup_program(client, db)
    client.post(f"/api/v1/organisations/{org['id']}/aml-program/generate", headers=headers)

    res = client.get(f"/api/v1/organisations/{org['id']}/aml-program/versions", headers=headers)
    qr_token = res.json()["versions"][0]["qr_token"]

    # No auth headers — public verification.
    res = client.get(f"/api/v1/verify/aml-program/{qr_token}")
    assert res.status_code == 200, res.text
    body = res.json()
    assert body["is_current"] is True
    assert "items" not in body
    assert "title" not in str(body)

    res = client.get("/api/v1/verify/aml-program/not-a-real-token")
    assert res.status_code == 404


def test_accountability_ack_also_records_retention_terms(client, db):
    seed_permission_catalog_and_roles(db)
    owner = _make_user(db, UserRole.analyst, industry_id=None)
    headers = _auth(owner)
    org = _create_org(client, headers, industry_id="banking-au")

    res = client.post(
        f"/api/v1/organisations/{org['id']}/aml-accountability/ack",
        json={"acknowledged": True},
        headers=headers,
    )
    assert res.status_code == 200, res.text
    body = res.json()
    assert body["aml_accountability_ack"] is True
    assert body["retention_terms_accepted"] is True
    assert body["retention_terms_version"]
