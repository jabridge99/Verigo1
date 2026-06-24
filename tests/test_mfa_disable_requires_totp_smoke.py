"""
Smoke test: DELETE /auth/mfa/disable previously only checked the account
password before disabling MFA. A stolen/phished password alone was enough to
strip MFA off an account — exactly the credential the MFA was supposed to
protect against. Fixed by also requiring a valid current TOTP code.
"""

from app.models.user import UserRole
from app.services.mfa_service import generate_totp_secret, _totp
from tests.conftest import _auth, _make_user


def _enable_mfa(db, user):
    user.mfa_enabled = True
    user.mfa_secret = generate_totp_secret()
    db.commit()
    db.refresh(user)
    return user


def test_mfa_disable_rejects_correct_password_without_totp_code(client, db):
    user = _make_user(db, UserRole.analyst)
    _enable_mfa(db, user)
    headers = _auth(user)

    resp = client.request(
        "DELETE",
        "/api/v1/auth/mfa/disable",
        headers=headers,
        params={"password": "TestPassword123!", "totp_code": "000000"},
    )
    assert resp.status_code == 401, resp.text

    db.refresh(user)
    assert user.mfa_enabled is True


def test_mfa_disable_succeeds_with_password_and_valid_totp_code(client, db):
    user = _make_user(db, UserRole.analyst)
    _enable_mfa(db, user)
    headers = _auth(user)
    code = _totp(user.mfa_secret)

    resp = client.request(
        "DELETE",
        "/api/v1/auth/mfa/disable",
        headers=headers,
        params={"password": "TestPassword123!", "totp_code": code},
    )
    assert resp.status_code == 200, resp.text

    db.refresh(user)
    assert user.mfa_enabled is False
    assert user.mfa_secret is None
