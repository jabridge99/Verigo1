"""
Stage 17: User.mfa_secret (the TOTP seed) is now encrypted at rest via
app.services.crypto.EncryptedMfaSecret, a SQLAlchemy TypeDecorator applied
at the ORM layer -- not patched in at individual call sites -- so every
write path is covered automatically (mfa_enrol's direct attribute
assignment included), the same pattern P51 used for KYC identity numbers.

Tests go through the real API (/mfa/enrol, /mfa/verify-enrolment,
/login, /mfa/challenge, /mfa/disable) and inspect the raw database row
directly via SQL, bypassing the ORM, to prove the plaintext TOTP secret
never reaches disk -- and that the full MFA lifecycle still works
end-to-end under encryption, not just that individual fields round-trip.
"""

from sqlalchemy import text

from app.models.user import User, UserRole
from app.services.crypto import (
    MFA_ENC_PREFIX,
    decrypt_mfa_secret,
    encrypt_mfa_secret,
    is_mfa_encrypted,
)
from app.services.mfa_service import _totp
from tests.conftest import _auth, _make_user

BASE = "/api/v1/auth"


class TestEncryptMfaSecretRoundtrip:
    def test_roundtrip(self):
        token = encrypt_mfa_secret("JBSWY3DPEHPK3PXP")
        assert token.startswith(MFA_ENC_PREFIX)
        assert token != "JBSWY3DPEHPK3PXP"
        assert decrypt_mfa_secret(token) == "JBSWY3DPEHPK3PXP"

    def test_none_and_empty_pass_through_unencrypted(self):
        assert encrypt_mfa_secret(None) is None
        assert encrypt_mfa_secret("") == ""

    def test_decrypt_passes_through_legacy_plaintext_unencrypted(self):
        # Values written before this feature existed have no "mfa:" prefix.
        # decrypt_mfa_secret() must return them as-is rather than raise --
        # the migration re-encrypts existing rows, but any row this code
        # hasn't reached yet must not crash a login/MFA request.
        assert decrypt_mfa_secret("JBSWY3DPEHPK3PXP") == "JBSWY3DPEHPK3PXP"

    def test_is_mfa_encrypted(self):
        assert is_mfa_encrypted(encrypt_mfa_secret("JBSWY3DPEHPK3PXP")) is True
        assert is_mfa_encrypted("JBSWY3DPEHPK3PXP") is False
        assert is_mfa_encrypted(None) is False

    def test_two_encryptions_of_the_same_value_differ(self):
        # Fernet embeds a random IV + timestamp -- non-deterministic by
        # design, confirming this column can never support an equality
        # lookup (not that anything in this app does one on mfa_secret).
        assert encrypt_mfa_secret("JBSWY3DPEHPK3PXP") != encrypt_mfa_secret(
            "JBSWY3DPEHPK3PXP"
        )


class TestMfaSecretEncryptedAtRest:
    def test_enrol_via_api_encrypts_secret_on_disk(self, client, db):
        user = _make_user(db, UserRole.analyst)
        headers = _auth(user)

        resp = client.post(f"{BASE}/mfa/enrol", headers=headers)
        assert resp.status_code == 200, resp.text
        plaintext_secret = resp.json()["secret"]
        assert plaintext_secret

        raw = db.execute(
            text("SELECT mfa_secret FROM users WHERE id = :id"), {"id": user.id}
        ).scalar()
        assert raw is not None
        assert raw.startswith(MFA_ENC_PREFIX)
        assert raw != plaintext_secret
        assert plaintext_secret not in raw

        # And the ORM, in a fresh query, decrypts it back correctly.
        db.expire_all()
        refreshed = db.query(User).filter_by(id=user.id).first()
        assert refreshed.mfa_secret == plaintext_secret

    def test_disable_clears_the_raw_column_to_null(self, client, db):
        user = _make_user(db, UserRole.analyst)
        headers = _auth(user)

        enrol_resp = client.post(f"{BASE}/mfa/enrol", headers=headers)
        secret = enrol_resp.json()["secret"]
        code = _totp(secret)
        verify_resp = client.post(
            f"{BASE}/mfa/verify-enrolment", headers=headers, params={"code": code}
        )
        assert verify_resp.status_code == 200, verify_resp.text

        db.refresh(user)
        disable_code = _totp(secret)
        disable_resp = client.request(
            "DELETE",
            f"{BASE}/mfa/disable",
            headers=headers,
            params={"password": "TestPassword123!", "totp_code": disable_code},
        )
        assert disable_resp.status_code == 200, disable_resp.text

        raw = db.execute(
            text("SELECT mfa_secret FROM users WHERE id = :id"), {"id": user.id}
        ).scalar()
        assert raw is None


class TestFullMfaLifecycleUnderEncryption:
    def test_enrol_verify_login_challenge_round_trip(self, client, db):
        user = _make_user(db, UserRole.analyst)
        headers = _auth(user)

        enrol_resp = client.post(f"{BASE}/mfa/enrol", headers=headers)
        assert enrol_resp.status_code == 200, enrol_resp.text
        secret = enrol_resp.json()["secret"]

        verify_resp = client.post(
            f"{BASE}/mfa/verify-enrolment",
            headers=headers,
            params={"code": _totp(secret)},
        )
        assert verify_resp.status_code == 200, verify_resp.text

        login_resp = client.post(
            f"{BASE}/login",
            json={"email": user.email, "password": "TestPassword123!"},
        )
        assert login_resp.status_code == 200, login_resp.text
        login_body = login_resp.json()
        assert login_body["mfa_required"] is True
        pending_headers = {"Authorization": f"Bearer {login_body['access_token']}"}

        challenge_resp = client.post(
            f"{BASE}/mfa/challenge",
            headers=pending_headers,
            params={"code": _totp(secret)},
        )
        assert challenge_resp.status_code == 200, challenge_resp.text
        assert "access_token" in challenge_resp.json()

    def test_wrong_totp_code_is_rejected_end_to_end(self, client, db):
        user = _make_user(db, UserRole.analyst)
        headers = _auth(user)

        enrol_resp = client.post(f"{BASE}/mfa/enrol", headers=headers)
        secret = enrol_resp.json()["secret"]
        client.post(
            f"{BASE}/mfa/verify-enrolment",
            headers=headers,
            params={"code": _totp(secret)},
        )

        login_resp = client.post(
            f"{BASE}/login",
            json={"email": user.email, "password": "TestPassword123!"},
        )
        pending_headers = {
            "Authorization": f"Bearer {login_resp.json()['access_token']}"
        }
        challenge_resp = client.post(
            f"{BASE}/mfa/challenge", headers=pending_headers, params={"code": "000000"}
        )
        assert challenge_resp.status_code == 401
