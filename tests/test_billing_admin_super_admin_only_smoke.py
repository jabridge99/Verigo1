"""
Smoke test: /billing/admin/* routes (activate, terminate, custom-price
update, feature matrix, list-all) were gated only on UserRole.admin, which
is a per-organisation role — not a platform operator tier (see
app/api/routes/auth.py's is_super_admin pattern). Any tenant's own admin
user could call e.g. POST /billing/admin/{industry_id}/terminate with
another tenant's industry_id/organisation_id and immediately cancel that
tenant's subscription, or apply custom pricing via PATCH
/billing/admin/{industry_id}. Fixed by requiring is_super_admin on all
/billing/admin/* routes, mirroring the security_monitor.py fix.
"""

from tests.conftest import _auth


def test_org_admin_cannot_activate_other_tenant_subscription(client, admin_user):
    resp = client.post(
        f"/api/v1/billing/admin/{admin_user.org_id}/activate",
        headers=_auth(admin_user),
    )
    assert resp.status_code == 403


def test_org_admin_cannot_terminate_other_tenant_subscription(client, admin_user):
    resp = client.post(
        f"/api/v1/billing/admin/{admin_user.org_id}/terminate",
        headers=_auth(admin_user),
    )
    assert resp.status_code == 403


def test_org_admin_cannot_list_all_subscriptions(client, admin_user):
    resp = client.get("/api/v1/billing/admin/all", headers=_auth(admin_user))
    assert resp.status_code == 403


def test_super_admin_can_list_all_subscriptions(client, super_admin_user):
    resp = client.get("/api/v1/billing/admin/all", headers=_auth(super_admin_user))
    assert resp.status_code == 200
