"""
Smoke test for Critical #10: every /api/v1/tenants/* endpoint had zero
authentication — any unauthenticated caller could list, create, suspend,
or activate platform-wide industry tenant records. Tenants are not scoped
to a single organisation, so they're now gated the same way as the
cross-org views in organisations.py: User.is_super_admin.
"""

import uuid


def _payload():
    return {
        "industry_id": f"ind-{uuid.uuid4().hex[:8]}",
        "name": "Smoke Test Tenant",
    }


def test_list_tenants_requires_authentication(client):
    resp = client.get("/api/v1/tenants/")
    assert resp.status_code in (401, 403)


def test_create_tenant_requires_authentication(client):
    resp = client.post("/api/v1/tenants/", json=_payload())
    assert resp.status_code in (401, 403)


def test_regular_admin_cannot_manage_tenants(client, admin_headers):
    resp = client.get("/api/v1/tenants/", headers=admin_headers)
    assert resp.status_code == 403


def test_super_admin_can_create_and_list_tenants(client, super_admin_headers):
    resp = client.post("/api/v1/tenants/", json=_payload(), headers=super_admin_headers)
    assert resp.status_code == 201, resp.text

    resp = client.get("/api/v1/tenants/", headers=super_admin_headers)
    assert resp.status_code == 200, resp.text
