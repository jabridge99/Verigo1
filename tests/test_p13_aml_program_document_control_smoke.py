"""
Document-control policy for AML Program exports (decided 2026-09-14, per
the Monetisation Playbook artifact, resolving that memo's open item 02):
  - Unpaid/preview orgs get a dense, OCR-resistant tiled watermark.
  - Every export (paid or unpaid) carries a 1-year validity date computed
    from the moment of download.
  - Printing is blocked by default; the one thing that still renders on a
    print attempt is a notice that any printed copy is uncontrolled.

Covers GET /organisations/{org_id}/aml-program/export-html.
"""

from datetime import date, timedelta

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


def _setup_program(client, db, plan=None, industry_id="banking-au"):
    seed_permission_catalog_and_roles(db)
    admin = _make_user(db, UserRole.admin, industry_id=None)
    admin.is_super_admin = True
    db.commit()
    owner = _make_user(db, UserRole.analyst, industry_id=None)
    headers = _auth(owner)
    admin_headers = _auth(admin)

    org = _create_org(client, headers, industry_id=industry_id)
    if plan:
        _set_plan(client, admin_headers, industry_id, org["id"], plan)
    client.patch(
        f"/api/v1/organisations/{org['id']}",
        json={"risk_profile": "high"},
        headers=headers,
    )
    client.post(
        f"/api/v1/organisations/{org['id']}/aml-program/generate", headers=headers
    )
    return org, headers, admin_headers


def test_unpaid_org_export_has_watermark_and_draft_badge(client, db):
    org, headers, _ = _setup_program(client, db, plan=None)

    resp = client.get(
        f"/api/v1/organisations/{org['id']}/aml-program/export-html",
        params={"reason": "Evaluating before purchase"},
        headers=headers,
    )
    assert resp.status_code == 200, resp.text
    body = resp.text
    assert 'class="watermark"' in body
    assert "DRAFT" in body
    assert "NOT VALID FOR AUSTRAC PURPOSES" in body


def test_paid_org_export_has_no_watermark_and_current_badge(client, db):
    org, headers, _ = _setup_program(client, db, plan="professional")

    resp = client.get(
        f"/api/v1/organisations/{org['id']}/aml-program/export-html",
        params={"reason": "Board pack"},
        headers=headers,
    )
    assert resp.status_code == 200, resp.text
    body = resp.text
    assert 'class="watermark"' not in body
    assert "CURRENT" in body


def test_export_html_requires_reason(client, db):
    org, headers, _ = _setup_program(client, db, plan="professional")

    resp = client.get(
        f"/api/v1/organisations/{org['id']}/aml-program/export-html",
        params={"reason": ""},
        headers=headers,
    )
    assert resp.status_code == 400


def test_export_html_stamps_one_year_validity_and_blocks_print(client, db):
    org, headers, _ = _setup_program(client, db, plan="professional")

    resp = client.get(
        f"/api/v1/organisations/{org['id']}/aml-program/export-html",
        params={"reason": "Regulator evidence pack"},
        headers=headers,
    )
    assert resp.status_code == 200, resp.text
    body = resp.text

    expected_expiry = (date.today() + timedelta(days=365)).isoformat()
    assert expected_expiry in body
    assert "@media print" in body
    assert "UNCONTROLLED" in body
    assert "Printing disabled" in body


def test_export_html_download_is_audited_with_expiry(client, db):
    org, headers, admin_headers = _setup_program(client, db, plan="professional")

    resp = client.get(
        f"/api/v1/organisations/{org['id']}/aml-program/export-html",
        params={"reason": "Regulator evidence pack"},
        headers=headers,
    )
    assert resp.status_code == 200, resp.text

    audit_resp = client.get(
        "/api/v1/audit/",
        params={"action": "aml_program_export_html_downloaded"},
        headers=admin_headers,
    )
    assert audit_resp.status_code == 200, audit_resp.text
    entries = audit_resp.json()
    assert len(entries) >= 1
    assert entries[0]["notes"] == "Regulator evidence pack"
