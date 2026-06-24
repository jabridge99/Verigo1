"""
Smoke test: POST /onboarding/reminders/run was gated only on UserRole.admin,
a per-organisation role, while the job itself reads/writes onboarding
sessions across *every* tenant (no org_id filter in
get_sessions_needing_reminder()). Any tenant's own admin could trigger it
and have it act on other tenants' onboarding data. Fixed by requiring
is_super_admin, mirroring the billing.py / security_monitor.py fix.
"""

from tests.conftest import _auth


def test_org_admin_cannot_run_reminders(client, admin_user):
    resp = client.post("/api/v1/onboarding/reminders/run", headers=_auth(admin_user))
    assert resp.status_code == 403


def test_super_admin_can_run_reminders(client, super_admin_user):
    resp = client.post(
        "/api/v1/onboarding/reminders/run", headers=_auth(super_admin_user)
    )
    assert resp.status_code == 200
    assert "due" in resp.json()
