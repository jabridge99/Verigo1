"""
Phase F — per-tenant storage configuration: admins can assign a storage
backend to any tenant, and Enterprise/VVIP tenants can bring their own.
"""

from app.models.tenant import IndustryTenant
from app.models.user import UserRole
from tests.conftest import _make_user, _auth


def _make_tenant(db, industry_id: str) -> IndustryTenant:
    t = IndustryTenant(tenant_id=f"TEN-{industry_id}", industry_id=industry_id, name="Test Co")
    db.add(t)
    db.commit()
    return t


def _set_plan(client, admin_headers, industry_id: str, plan: str):
    client.post(f"/api/v1/billing/admin/{industry_id}/trial", headers=admin_headers)
    res = client.patch(
        f"/api/v1/billing/admin/{industry_id}", json={"plan": plan}, headers=admin_headers
    )
    assert res.status_code == 200, res.text


def test_starter_plan_tenant_cannot_set_own_storage(client, db):
    _make_tenant(db, "IND-STOR-001")
    admin = _make_user(db, UserRole.admin, industry_id=None)
    _set_plan(client, _auth(admin), "IND-STOR-001", "starter")

    user = _make_user(db, UserRole.analyst, industry_id="IND-STOR-001")
    res = client.put(
        "/api/v1/storage/config",
        json={"backend": "s3", "bucket": "my-bucket", "access_key": "AK", "secret_key": "SK"},
        headers=_auth(user),
    )
    assert res.status_code == 403


def test_enterprise_plan_tenant_can_bring_own_storage(client, db):
    _make_tenant(db, "IND-STOR-002")
    admin = _make_user(db, UserRole.admin, industry_id=None)
    _set_plan(client, _auth(admin), "IND-STOR-002", "enterprise")

    user = _make_user(db, UserRole.analyst, industry_id="IND-STOR-002")
    headers = _auth(user)

    res = client.put(
        "/api/v1/storage/config",
        json={"backend": "s3", "bucket": "my-bucket", "access_key": "AK", "secret_key": "SK"},
        headers=headers,
    )
    assert res.status_code == 200, res.text
    body = res.json()
    assert body["backend"] == "s3"
    assert body["bucket"] == "my-bucket"
    assert body["configured"] is True
    assert "secret_key" not in body
    assert "access_key" in body  # non-secret, OK to echo

    res = client.get("/api/v1/storage/config", headers=headers)
    assert res.status_code == 200
    assert res.json()["bucket"] == "my-bucket"

    res = client.delete("/api/v1/storage/config", headers=headers)
    assert res.status_code == 200
    assert res.json()["configured"] is False


def test_missing_required_fields_rejected(client, db):
    _make_tenant(db, "IND-STOR-003")
    admin = _make_user(db, UserRole.admin, industry_id=None)
    _set_plan(client, _auth(admin), "IND-STOR-003", "vvip")

    user = _make_user(db, UserRole.analyst, industry_id="IND-STOR-003")
    res = client.put(
        "/api/v1/storage/config",
        json={"backend": "s3", "bucket": "my-bucket"},  # no access_key/secret_key
        headers=_auth(user),
    )
    assert res.status_code == 400


def test_admin_can_assign_storage_to_any_tenant_regardless_of_plan(client, db):
    _make_tenant(db, "IND-STOR-004")
    admin = _make_user(db, UserRole.admin, industry_id=None)
    headers = _auth(admin)
    _set_plan(client, headers, "IND-STOR-004", "starter")

    res = client.put(
        "/api/v1/storage/admin/IND-STOR-004",
        json={"backend": "gcs", "bucket": "admin-bucket"},
        headers=headers,
    )
    assert res.status_code == 200, res.text
    assert res.json()["backend"] == "gcs"

    res = client.get("/api/v1/storage/admin/IND-STOR-004", headers=headers)
    assert res.json()["bucket"] == "admin-bucket"

    res = client.delete("/api/v1/storage/admin/IND-STOR-004", headers=headers)
    assert res.status_code == 200
    assert res.json()["configured"] is False


def test_non_admin_cannot_use_admin_storage_routes(client, db):
    _make_tenant(db, "IND-STOR-005")
    viewer = _make_user(db, UserRole.viewer, industry_id="IND-STOR-005")
    res = client.get("/api/v1/storage/admin/IND-STOR-005", headers=_auth(viewer))
    assert res.status_code == 403
