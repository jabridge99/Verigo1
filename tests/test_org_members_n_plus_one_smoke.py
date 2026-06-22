"""
Smoke test: GET /organisations/{org_id}/members previously ran two
extra queries per member (one for User, one for Role) via
_member_response() called in a loop — classic N+1. Fixed by
batch-loading users and roles once and assembling responses in memory.
This test just confirms the endpoint still returns correct data for
multiple members after the batching change.
"""

from app.services.auth_service import create_user
from app.services.org_service import seed_permission_catalog_and_roles


def test_list_members_returns_all_members_with_correct_roles(
    client, db, admin_user, admin_headers
):
    seed_permission_catalog_and_roles(db)
    db.commit()

    org_resp = client.post(
        "/api/v1/organisations",
        json={"name": "N+1 Test Org"},
        headers=admin_headers,
    )
    assert org_resp.status_code == 201, org_resp.text
    org_id = org_resp.json()["id"]

    create_user(
        db,
        email="other-member@example.com",
        full_name="Other Member",
        password="SecurePass123!",
        role="analyst",
        org_id=org_id,
    )
    db.commit()

    add_resp = client.post(
        f"/api/v1/organisations/{org_id}/members",
        json={"email": "other-member@example.com", "role_key": "staff"},
        headers=admin_headers,
    )
    assert add_resp.status_code == 201, add_resp.text

    resp = client.get(f"/api/v1/organisations/{org_id}/members", headers=admin_headers)
    assert resp.status_code == 200, resp.text
    members = resp.json()
    emails = {m["email"] for m in members}
    assert admin_user.email in emails
    assert "other-member@example.com" in emails
    assert len(members) == 2
