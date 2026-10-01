"""
CSRF (double-submit cookie), added after P35.

app/api/deps.py's get_current_user (32 of 49 route files) is header-only and
so is inherently immune to CSRF -- a forged cross-site request has no way to
read a victim's stored token to construct an Authorization header. But
app/api/routes/auth.py's _current_user (the other 17 files, plus itself)
also accepts the session cookie alone, and that cookie is SameSite=None in
production (required since the frontend and API are cross-origin) with no
other CSRF mitigation anywhere in the codebase -- a forged cross-site
request still gets the cookie auto-attached by the browser.

Fixed with a standard double-submit cookie: login/register also set a
second, non-httpOnly tvg_csrf cookie; _decode_current_user now requires any
state-changing (POST/PUT/PATCH/DELETE) request that authenticates via the
cookie alone to also send a matching X-CSRF-Token header. A forged
cross-site request can get the session cookie sent but, being cross-origin,
cannot read it to construct the matching header. Requests that authenticate
via the Authorization header (what the frontend always sends post-P35) skip
the check entirely, since a header can't be forged cross-site either.
"""

import uuid


def _register(client, tag: str) -> dict:
    resp = client.post(
        "/api/v1/auth/register",
        json={
            "email": f"csrf-{tag}-{uuid.uuid4().hex[:8]}@test.com",
            "full_name": "CSRF Test User",
            "password": "SecurePass123!",
        },
    )
    assert resp.status_code == 201, resp.text
    return resp.json()


def test_register_and_login_set_both_session_and_csrf_cookies(client):
    _register(client, "cookies")
    assert "tvg_session" in client.cookies
    assert "tvg_csrf" in client.cookies
    assert client.cookies["tvg_session"] != client.cookies["tvg_csrf"]


def test_cookie_authenticated_mutation_without_csrf_header_is_rejected(client):
    _register(client, "reject")
    # Cookie-only request (TestClient's jar sends it automatically) -- no
    # Authorization header, no X-CSRF-Token.
    resp = client.patch("/api/v1/auth/me", json={"full_name": "New Name"})
    assert resp.status_code == 403, resp.text
    assert "CSRF" in resp.json()["detail"]


def test_cookie_authenticated_mutation_with_wrong_csrf_header_is_rejected(client):
    _register(client, "wrong")
    resp = client.patch(
        "/api/v1/auth/me",
        json={"full_name": "New Name"},
        headers={"X-CSRF-Token": "not-the-real-token"},
    )
    assert resp.status_code == 403, resp.text


def test_cookie_authenticated_mutation_with_correct_csrf_header_succeeds(client):
    _register(client, "correct")
    csrf = client.cookies["tvg_csrf"]
    resp = client.patch(
        "/api/v1/auth/me",
        json={"full_name": "New Name"},
        headers={"X-CSRF-Token": csrf},
    )
    assert resp.status_code == 200, resp.text
    assert resp.json()["full_name"] == "New Name"


def test_get_request_via_cookie_without_csrf_header_succeeds(client):
    _register(client, "get")
    # GETs are exempt -- assumed side-effect-free.
    resp = client.get("/api/v1/auth/me")
    assert resp.status_code == 200, resp.text


def test_bearer_authenticated_mutation_skips_csrf_check(client, db, compliance_headers):
    # No cookie in play at all -- purely Bearer-header auth, same as every
    # other request this session's whole test suite makes.
    resp = client.patch(
        "/api/v1/auth/me", json={"full_name": "Via Bearer"}, headers=compliance_headers
    )
    assert resp.status_code == 200, resp.text


def test_logout_clears_both_cookies(client):
    _register(client, "logout")
    assert "tvg_session" in client.cookies
    assert "tvg_csrf" in client.cookies
    csrf = client.cookies["tvg_csrf"]

    resp = client.post("/api/v1/auth/logout", headers={"X-CSRF-Token": csrf})
    assert resp.status_code == 200, resp.text
    assert "tvg_session" not in client.cookies
    assert "tvg_csrf" not in client.cookies
