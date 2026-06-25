"""
Smoke test: _assert_tenant()/_industry_scope()/_org_scope() in
app/api/routes/documents.py granted cross-tenant document read/write/delete
access to any user with UserRole.admin — but that role is per-organisation,
not global (only User.is_super_admin is). Any org admin could read, list,
update, or delete another tenant's documents. Fixed by checking
is_super_admin instead of role == UserRole.admin.
"""

from app.models.user import UserRole
from tests.conftest import _auth, _make_user


def _upload(client, headers, filename="victim.pdf"):
    return client.post(
        "/api/v1/documents",
        files={"file": (filename, b"%PDF-1.4 test", "application/pdf")},
        data={"category": "other"},
        headers=headers,
    )


def test_org_admin_cannot_download_other_tenants_document(client, db):
    victim = _make_user(db, UserRole.analyst, industry_id="IND-IDOR-VICTIM")
    res = _upload(client, _auth(victim))
    assert res.status_code == 201, res.text
    doc_id = res.json()["doc_id"]

    other_org_admin = _make_user(db, UserRole.admin, industry_id="IND-IDOR-ATTACKER")
    res = client.get(
        f"/api/v1/documents/{doc_id}/download", headers=_auth(other_org_admin)
    )
    assert res.status_code == 403


def test_org_admin_cannot_delete_other_tenants_document(client, db):
    victim = _make_user(db, UserRole.analyst, industry_id="IND-IDOR-VICTIM2")
    res = _upload(client, _auth(victim))
    doc_id = res.json()["doc_id"]

    other_org_admin = _make_user(db, UserRole.admin, industry_id="IND-IDOR-ATTACKER2")
    res = client.delete(
        f"/api/v1/documents/{doc_id}", headers=_auth(other_org_admin)
    )
    assert res.status_code == 403


def test_global_super_admin_can_access_any_tenants_document(client, db):
    victim = _make_user(db, UserRole.analyst, industry_id="IND-IDOR-VICTIM3")
    res = _upload(client, _auth(victim))
    doc_id = res.json()["doc_id"]

    super_admin = _make_user(db, UserRole.admin, industry_id=None)
    super_admin.is_super_admin = True
    db.commit()

    res = client.get(
        f"/api/v1/documents/{doc_id}/download", headers=_auth(super_admin)
    )
    assert res.status_code == 200
