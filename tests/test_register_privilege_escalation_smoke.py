"""
Smoke test: POST /auth/register (public, unauthenticated) accepted
caller-supplied org_id and role directly into create_user(), with no
ownership/privilege check. Any anonymous caller could register with
{"org_id": "<victim-org-id>", "role": "admin"} and immediately gain
admin-level access inside an arbitrary existing organisation — a
complete, unauthenticated tenant-isolation bypass. Contrast with the
admin-authenticated POST /auth/users, which correctly rejects a
cross-org org_id unless the caller is_super_admin. Fixed by always
creating a brand-new org and forcing the lowest-privilege role on
self-serve signup, ignoring any caller-supplied org_id/role.
"""

from app.models.user import UserRole
from tests.conftest import _make_user


def test_register_ignores_supplied_org_id_and_role(client, db):
    victim_admin = _make_user(db, UserRole.admin, industry_id=None)
    victim_org_id = victim_admin.org_id

    resp = client.post(
        "/api/v1/auth/register",
        json={
            "email": "attacker@test.com",
            "full_name": "Attacker",
            "password": "SecurePass123!",
            "org_id": victim_org_id,
            "role": "admin",
        },
    )
    assert resp.status_code == 201, resp.text

    from app.models.user import User

    attacker = db.query(User).filter(User.email == "attacker@test.com").first()
    assert attacker is not None
    assert attacker.org_id != victim_org_id
    assert attacker.role == UserRole.analyst
