"""
Field-level encryption for sensitive values stored at rest (e.g. tenant
storage credentials). Uses Fernet (AES-128-CBC + HMAC) keyed off
STORAGE_ENCRYPTION_KEY, falling back to a key derived from SECRET_KEY so
encryption still works out of the box in dev — set STORAGE_ENCRYPTION_KEY
explicitly in production so credentials survive a JWT secret rotation.
"""

import base64
import hashlib

from cryptography.fernet import Fernet, InvalidToken

from app.config import settings

ENC_PREFIX = "enc:"


def _derive_key() -> bytes:
    raw = settings.storage_encryption_key or settings.secret_key
    digest = hashlib.sha256(raw.encode()).digest()
    return base64.urlsafe_b64encode(digest)


_fernet = Fernet(_derive_key())


def encrypt_secret(plain: str) -> str:
    if plain is None:
        return plain
    token = _fernet.encrypt(plain.encode()).decode()
    return f"{ENC_PREFIX}{token}"


def decrypt_secret(value: str) -> str:
    if value is None or not value.startswith(ENC_PREFIX):
        return value
    token = value[len(ENC_PREFIX) :]
    try:
        return _fernet.decrypt(token.encode()).decode()
    except InvalidToken:
        raise ValueError(
            "Stored credential could not be decrypted — encryption key may have changed"
        )


def is_encrypted(value) -> bool:
    return isinstance(value, str) and value.startswith(ENC_PREFIX)
