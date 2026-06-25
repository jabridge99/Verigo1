"""
Smoke test for two MFA brute-force hardening fixes:

1. mfa_service.verify_totp() compared the computed TOTP code to the
   submitted code with plain string equality, opening a timing side
   channel an attacker could use to narrow down correct digits faster
   than a blind 1-in-1,000,000 guess. Fixed by switching to
   hmac.compare_digest() for the comparison.

2. RateLimitMiddleware only put /api/v1/auth/login and /magic-link in the
   strict 10/min fail-closed "login" tier — /api/v1/auth/mfa/challenge fell
   into the looser 20/min "auth" tier (which also fails open on a Redis
   outage), giving an attacker who has already obtained a password more
   room to brute-force the 6-digit TOTP code. Fixed by adding
   /api/v1/auth/mfa/challenge to the same strict, fail-closed "login" tier.
"""

import inspect

from app.middleware import RateLimitMiddleware
from app.services.mfa_service import generate_totp_secret, verify_totp


def test_verify_totp_rejects_wrong_code():
    secret = generate_totp_secret()
    assert verify_totp(secret, "000000") is False


def test_verify_totp_accepts_correct_code():
    import app.services.mfa_service as mfa

    secret = generate_totp_secret()
    code = mfa._totp(secret)
    assert verify_totp(secret, code) is True


def test_mfa_challenge_uses_strict_login_rate_tier():
    src = inspect.getsource(RateLimitMiddleware.dispatch)
    login_tier_block = src.split('rpm, bucket_label = 10, "login"')[0]
    assert '"/api/v1/auth/mfa/challenge"' in login_tier_block
