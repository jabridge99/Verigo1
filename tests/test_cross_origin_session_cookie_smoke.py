"""
Smoke test for the frontend/backend cross-origin auth blocker: in production
the frontend (Vercel) and API (Railway) are on different domains, so the
session cookie set on login is a cross-site cookie from the browser's
perspective. SameSite=Lax cookies are withheld by browsers on cross-site
fetch/XHR (only sent on top-level navigations), so every authenticated
request after login would silently lose the session. The cookie must use
SameSite=None (+Secure) when settings.is_production is True.
"""

from app.config import settings
from app.services.auth_service import _session_cookie_samesite


def test_samesite_is_none_in_production(monkeypatch):
    monkeypatch.setattr(settings, "environment", "production")
    assert _session_cookie_samesite() == "none"


def test_samesite_is_lax_outside_production(monkeypatch):
    monkeypatch.setattr(settings, "environment", "development")
    assert _session_cookie_samesite() == "lax"


def test_register_sets_cross_site_safe_cookie_attrs_in_production(client, monkeypatch):
    import app.services.auth_service as auth_service

    monkeypatch.setattr(auth_service.settings, "environment", "production")

    resp = client.post(
        "/api/v1/auth/register",
        json={
            "email": "crossorigin@example.com",
            "password": "StrongPassw0rd!",
            "full_name": "Cross Origin Tester",
        },
    )
    assert resp.status_code == 201, resp.text

    set_cookie_headers = (
        resp.headers.get_list("set-cookie")
        if hasattr(resp.headers, "get_list")
        else [resp.headers.get("set-cookie", "")]
    )
    cookie_header = next(
        (h for h in set_cookie_headers if settings.session_cookie_name in h), ""
    )
    assert "samesite=none" in cookie_header.lower()
    assert "secure" in cookie_header.lower()
