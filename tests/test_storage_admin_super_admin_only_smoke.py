"""
Smoke test: /storage/admin/{industry_id} routes (view/assign/clear any
tenant's storage backend config) were gated only on UserRole.admin, a
per-organisation role. Any tenant's own admin could view another tenant's
storage config, overwrite it to point document storage at an
attacker-controlled bucket, or clear it. Fixed by requiring
is_super_admin, mirroring the billing.py / security_monitor.py /
onboarding.py fix.
"""

from tests.conftest import _auth


def test_org_admin_cannot_view_other_tenant_storage_config(client, admin_user):
    resp = client.get(
        f"/api/v1/storage/admin/{admin_user.org_id}", headers=_auth(admin_user)
    )
    assert resp.status_code == 403


def test_org_admin_cannot_clear_other_tenant_storage_config(client, admin_user):
    resp = client.delete(
        f"/api/v1/storage/admin/{admin_user.org_id}", headers=_auth(admin_user)
    )
    assert resp.status_code == 403


def test_super_admin_can_view_storage_config(client, super_admin_user):
    resp = client.get(
        f"/api/v1/storage/admin/{super_admin_user.org_id}",
        headers=_auth(super_admin_user),
    )
    assert resp.status_code == 200
