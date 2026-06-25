"""
Smoke test: app/api/routes/security_monitor.py previously gated every
endpoint (/events, /summary, /failed-logins, /role-changes, /mfa-status,
/alerts) on role == admin/mlro only. SecurityEvent has no org_id column —
the data is platform-wide — so any org-scoped admin/mlro account could see
every other org's security events, login failures, and MFA adoption stats.
Until SecurityEvent gains real per-tenant scoping, access is restricted to
the global is_super_admin account only.
"""

import pytest

ENDPOINTS = [
    "/api/v1/security/events",
    "/api/v1/security/summary",
    "/api/v1/security/failed-logins",
    "/api/v1/security/role-changes",
    "/api/v1/security/mfa-status",
    "/api/v1/security/alerts",
]


@pytest.mark.parametrize("path", ENDPOINTS)
def test_org_scoped_admin_denied(client, admin_user, admin_headers, path):
    resp = client.get(path, headers=admin_headers)
    assert resp.status_code == 403


@pytest.mark.parametrize("path", ENDPOINTS)
def test_mlro_denied(client, mlro_headers, path):
    resp = client.get(path, headers=mlro_headers)
    assert resp.status_code == 403


@pytest.mark.parametrize("path", ENDPOINTS)
def test_super_admin_allowed(client, super_admin_headers, path):
    resp = client.get(path, headers=super_admin_headers)
    assert resp.status_code == 200, resp.text
