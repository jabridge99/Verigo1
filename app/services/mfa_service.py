"""
TOTP-based Multi-Factor Authentication service.
Compatible with Google Authenticator, Authy, and any RFC 6238 authenticator.
"""

import base64
import hashlib
import hmac
import secrets
import struct
import time
from urllib.parse import quote


def generate_totp_secret(length: int = 20) -> str:
    """Generate a cryptographically secure base32 TOTP secret."""
    raw = secrets.token_bytes(length)
    return base64.b32encode(raw).decode("utf-8")


def _hotp(secret: str, counter: int) -> int:
    key = base64.b32decode(secret.upper())
    msg = struct.pack(">Q", counter)
    h = hmac.new(key, msg, hashlib.sha1).digest()
    offset = h[-1] & 0x0F
    code = struct.unpack(">I", h[offset : offset + 4])[0] & 0x7FFFFFFF
    return code % 1_000_000


def _totp(secret: str, at_time: float | None = None, step: int = 30) -> str:
    t = int((at_time or time.time()) / step)
    return str(_hotp(secret, t)).zfill(6)


def verify_totp(secret: str, code: str, window: int = 1) -> bool:
    """
    Verify a 6-digit TOTP code.
    Accepts codes from [now - window*step .. now + window*step] to tolerate clock skew.
    """
    code = code.strip()
    if len(code) != 6 or not code.isdigit():
        return False
    now = time.time()
    step = 30
    for offset in range(-window, window + 1):
        if hmac.compare_digest(_totp(secret, now + offset * step), code):
            return True
    return False


def totp_provisioning_uri(secret: str, account: str, issuer: str = "Verigo") -> str:
    """Return an otpauth:// URI suitable for QR code generation."""
    account_enc = quote(account)
    issuer_enc = quote(issuer)
    return (
        f"otpauth://totp/{issuer_enc}:{account_enc}"
        f"?secret={secret}&issuer={issuer_enc}&algorithm=SHA1&digits=6&period=30"
    )
