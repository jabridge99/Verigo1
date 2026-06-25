"""
Smoke test: POST /auth/logout blacklisted tokens by sha256(raw_token), but
app.api.deps.get_current_user (used by ~33 routers — customers, billing,
transactions, kyc, etc.) checks the blacklist by the JWT's "jti" claim.
Since the two never matched, logging out never revoked a token for any
endpoint guarded by deps.get_current_user — a leaked bearer token stayed
valid until natural expiry regardless of logout. Fixed by blacklisting and
checking consistently by jti everywhere.
"""

from tests.conftest import _auth


def test_logout_revokes_token_for_deps_guarded_route(client, analyst_user):
    headers = _auth(analyst_user)

    resp = client.get("/api/v1/customers", headers=headers)
    assert resp.status_code == 200

    resp = client.post("/api/v1/auth/logout", headers=headers)
    assert resp.status_code == 200

    resp = client.get("/api/v1/customers", headers=headers)
    assert resp.status_code == 401
