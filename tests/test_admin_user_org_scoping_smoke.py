"""
Smoke test for Critical #13: /api/v1/auth/users endpoints checked
current_user.role == admin but never that the target user belonged to
the same org — an org-scoped admin (is_super_admin=False) could list,
update, suspend, or activate ANY user in ANY organisation by id, and
list_users leaked all orgs' users to any admin. Only is_super_admin
(the global, non-tenant-scoped account) should bypass org scoping.
"""

import uuid

from tests.conftest import UserRole, UserStatus, _auth, _make_org, _make_user


def _make_admin_in_new_org(db) -> object:
    org = _make_org(db)
    return _make_user(db, UserRole.admin, industry_id=org.id)


def test_admin_cannot_view_other_org_user_in_list(client, db, admin_user):
    other_org_user = _make_admin_in_new_org(db)

    resp = client.get("/api/v1/auth/users", headers=_auth(admin_user))
    assert resp.status_code == 200
    ids = {u["id"] for u in resp.json()}
    assert other_org_user.id not in ids


def test_admin_cannot_update_other_org_user(client, db, admin_user):
    other_org_user = _make_admin_in_new_org(db)

    resp = client.patch(
        f"/api/v1/auth/users/{other_org_user.id}",
        json={"full_name": "Hijacked"},
        headers=_auth(admin_user),
    )
    assert resp.status_code == 404


def test_admin_cannot_suspend_other_org_user(client, db, admin_user):
    other_org_user = _make_admin_in_new_org(db)

    resp = client.post(
        f"/api/v1/auth/users/{other_org_user.id}/suspend",
        headers=_auth(admin_user),
    )
    assert resp.status_code == 404


def test_admin_cannot_activate_other_org_user(client, db, admin_user):
    other_org_user = _make_admin_in_new_org(db)
    other_org_user.status = UserStatus.suspended
    db.commit()

    resp = client.post(
        f"/api/v1/auth/users/{other_org_user.id}/activate",
        headers=_auth(admin_user),
    )
    assert resp.status_code == 404


def test_admin_cannot_create_user_in_other_org(client, db, admin_user):
    other_org = _make_org(db)

    resp = client.post(
        "/api/v1/auth/users",
        json={
            "email": f"sneaky-{uuid.uuid4().hex[:6]}@test.com",
            "full_name": "Sneaky User",
            "password": "TestPassword123!",
            "org_id": other_org.id,
        },
        headers=_auth(admin_user),
    )
    assert resp.status_code == 403


def test_super_admin_can_manage_any_org_user(client, db, super_admin_user):
    other_org_user = _make_admin_in_new_org(db)

    resp = client.patch(
        f"/api/v1/auth/users/{other_org_user.id}",
        json={"full_name": "Updated By Super Admin"},
        headers=_auth(super_admin_user),
    )
    assert resp.status_code == 200, resp.text
    assert resp.json()["full_name"] == "Updated By Super Admin"
