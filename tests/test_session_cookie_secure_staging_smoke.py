"""
Smoke test: set_session_cookie()/clear_session_cookie() previously only set
the Secure cookie flag when settings.is_production was True. Staging is a
valid, often internet-exposed environment value, so the session cookie was
shipped without Secure there — sendable over plain HTTP and interceptable.
Fixed by setting Secure for anything other than local "development".
"""

from app.config import settings


def test_session_cookie_is_secure_in_staging(client, monkeypatch):
    import app.services.auth_service as auth_service

    monkeypatch.setattr(auth_service.settings, "environment", "staging")

    resp = client.post(
        "/api/v1/auth/register",
        json={
            "email": "staging-cookie@example.com",
            "password": "StrongPassw0rd!",
            "full_name": "Staging Cookie Tester",
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
    assert "secure" in cookie_header.lower()


def test_session_cookie_not_secure_in_local_dev(client, monkeypatch):
    import app.services.auth_service as auth_service

    monkeypatch.setattr(auth_service.settings, "environment", "development")

    resp = client.post(
        "/api/v1/auth/register",
        json={
            "email": "dev-cookie@example.com",
            "password": "StrongPassw0rd!",
            "full_name": "Dev Cookie Tester",
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
    assert "secure" not in cookie_header.lower()
