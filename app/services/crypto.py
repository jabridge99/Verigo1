"""
Field-level encryption for sensitive values stored at rest. Uses Fernet
(AES-128-CBC + HMAC), each keyed off its own dedicated setting so different
sensitivity classes can be rotated independently:
  - storage_encryption_key -> tenant storage/connector credentials
  - kyc_encryption_key     -> Customer/BeneficialOwner identity numbers (P51)
  - mfa_encryption_key     -> User.mfa_secret, the TOTP seed (Stage 17)
Each falls back to a key derived from SECRET_KEY when unset, so encryption
still works out of the box in dev — set the dedicated key explicitly in
production so a JWT secret rotation doesn't strand encrypted data.
"""

import base64
import hashlib

from cryptography.fernet import Fernet, InvalidToken
from sqlalchemy import String
from sqlalchemy.types import TypeDecorator

from app.config import settings

ENC_PREFIX = "enc:"
KYC_ENC_PREFIX = "kyc:"
MFA_ENC_PREFIX = "mfa:"


def _derive_key(raw: str) -> bytes:
    digest = hashlib.sha256(raw.encode()).digest()
    return base64.urlsafe_b64encode(digest)


_fernet = Fernet(_derive_key(settings.storage_encryption_key or settings.secret_key))
_kyc_fernet = Fernet(_derive_key(settings.kyc_encryption_key or settings.secret_key))
_mfa_fernet = Fernet(_derive_key(settings.mfa_encryption_key or settings.secret_key))


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


def encrypt_credentials(data: dict) -> dict:
    """Encrypt each value of a flat credentials dict (e.g. {"api_key": "..."})."""
    return {k: encrypt_secret(str(v)) for k, v in (data or {}).items()}


def decrypt_credentials(data: dict) -> dict:
    return {k: decrypt_secret(v) for k, v in (data or {}).items()}


def encrypt_kyc_field(plain: str) -> str:
    """Encrypt a KYC identity-number field (tax_identification_number, id_number)."""
    if plain is None or plain == "":
        return plain
    token = _kyc_fernet.encrypt(plain.encode()).decode()
    return f"{KYC_ENC_PREFIX}{token}"


def decrypt_kyc_field(value: str) -> str:
    if value is None or not value.startswith(KYC_ENC_PREFIX):
        return value
    token = value[len(KYC_ENC_PREFIX) :]
    try:
        return _kyc_fernet.decrypt(token.encode()).decode()
    except InvalidToken:
        raise ValueError(
            "Stored KYC field could not be decrypted — encryption key may have changed"
        )


def is_kyc_encrypted(value) -> bool:
    return isinstance(value, str) and value.startswith(KYC_ENC_PREFIX)


class EncryptedKycString(TypeDecorator):
    """
    A String column that transparently encrypts on write and decrypts on
    read via encrypt_kyc_field()/decrypt_kyc_field() -- applied at the ORM
    layer (not at individual call sites) so every write path is covered
    automatically, including bulk dict-spread construction (e.g.
    `BeneficialOwner(**payload.model_dump())`), not just the call sites
    that were found by searching for the field name.

    Fernet ciphertext is non-deterministic (embeds a random IV + timestamp),
    so this column can never be used in an equality filter/WHERE clause --
    confirmed no code in this app does that for the identity-number fields
    this is applied to before adopting this type.
    """

    impl = String
    cache_ok = True

    def process_bind_param(self, value, dialect):
        return encrypt_kyc_field(value)

    def process_result_value(self, value, dialect):
        return decrypt_kyc_field(value)


def encrypt_mfa_secret(plain: str) -> str:
    """Encrypt a User.mfa_secret (TOTP seed)."""
    if plain is None or plain == "":
        return plain
    token = _mfa_fernet.encrypt(plain.encode()).decode()
    return f"{MFA_ENC_PREFIX}{token}"


def decrypt_mfa_secret(value: str) -> str:
    if value is None or not value.startswith(MFA_ENC_PREFIX):
        return value
    token = value[len(MFA_ENC_PREFIX) :]
    try:
        return _mfa_fernet.decrypt(token.encode()).decode()
    except InvalidToken:
        raise ValueError(
            "Stored MFA secret could not be decrypted — encryption key may have changed"
        )


def is_mfa_encrypted(value) -> bool:
    return isinstance(value, str) and value.startswith(MFA_ENC_PREFIX)


class EncryptedMfaSecret(TypeDecorator):
    """
    A String column that transparently encrypts User.mfa_secret on write
    and decrypts on read -- applied at the ORM layer so every write path
    (mfa_enrol's direct attribute assignment included) is covered
    automatically. Same non-deterministic-ciphertext caveat as
    EncryptedKycString: never usable in an equality filter/WHERE clause --
    confirmed no code in this app looks up a user by mfa_secret.
    """

    impl = String
    cache_ok = True

    def process_bind_param(self, value, dialect):
        return encrypt_mfa_secret(value)

    def process_result_value(self, value, dialect):
        return decrypt_mfa_secret(value)
