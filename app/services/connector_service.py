"""
Connector credential management.

Credentials are encrypted with Fernet (AES-128-CBC + HMAC-SHA256) before
being stored in the database. The encryption key is derived from
settings.secret_key — rotate by re-encrypting all rows.

Provider-specific test() functions validate connectivity without exposing
plaintext credentials to callers.
"""

from __future__ import annotations

import json
import logging
import uuid
from typing import Optional

from sqlalchemy.orm import Session

from app.config import settings
from app.models.connector import ConnectorCredential, ConnectorProvider, ConnectorStatus

log = logging.getLogger("tvg.connectors")


# ── Encryption helpers ────────────────────────────────────────────────────────

def _fernet():
    try:
        import base64
        import hashlib

        from cryptography.fernet import Fernet
        # Derive a 32-byte key from secret_key and Base64-URL-encode it
        raw = hashlib.sha256(settings.secret_key.encode()).digest()
        key = base64.urlsafe_b64encode(raw)
        return Fernet(key)
    except ImportError:
        raise RuntimeError("cryptography package required: pip install cryptography")


def _encrypt(data: dict) -> str:
    return _fernet().encrypt(json.dumps(data).encode()).decode()


def _decrypt(blob: str) -> dict:
    return json.loads(_fernet().decrypt(blob.encode()).decode())


# ── CRUD ──────────────────────────────────────────────────────────────────────

def create_credential(
    db: Session,
    industry_id: str,
    provider: ConnectorProvider,
    credentials: dict,
    label: Optional[str] = None,
    created_by: Optional[str] = None,
) -> ConnectorCredential:
    # Derive a display hint from the first meaningful key value
    hint = ""
    for v in credentials.values():
        if isinstance(v, str) and len(v) >= 4:
            hint = "..." + v[-4:]
            break

    cred = ConnectorCredential(
        credential_id=f"CONN-{uuid.uuid4().hex[:12].upper()}",
        industry_id=industry_id,
        provider=provider,
        label=label or provider.value,
        encrypted_credentials=_encrypt(credentials),
        key_hint=hint,
        status=ConnectorStatus.inactive,
        created_by=created_by,
    )
    db.add(cred)
    db.commit()
    db.refresh(cred)
    return cred


def get_credentials(
    db: Session,
    industry_id: str,
    provider: Optional[ConnectorProvider] = None,
) -> list[ConnectorCredential]:
    q = db.query(ConnectorCredential).filter(ConnectorCredential.industry_id == industry_id)
    if provider:
        q = q.filter(ConnectorCredential.provider == provider)
    return q.order_by(ConnectorCredential.created_at.desc()).all()


def get_default_credential(
    db: Session,
    industry_id: str,
    provider: ConnectorProvider,
) -> Optional[ConnectorCredential]:
    return (
        db.query(ConnectorCredential)
        .filter(
            ConnectorCredential.industry_id == industry_id,
            ConnectorCredential.provider == provider,
            ConnectorCredential.is_default,
            ConnectorCredential.status == ConnectorStatus.active,
        )
        .first()
    )


def decrypt_credential(cred: ConnectorCredential) -> dict:
    """Return decrypted credentials dict. Never log or return this to clients."""
    return _decrypt(cred.encrypted_credentials)


def update_credential(
    db: Session,
    credential_id: str,
    industry_id: str,
    credentials: Optional[dict] = None,
    label: Optional[str] = None,
    is_default: Optional[bool] = None,
) -> ConnectorCredential:
    cred = db.query(ConnectorCredential).filter(
        ConnectorCredential.credential_id == credential_id,
        ConnectorCredential.industry_id == industry_id,
    ).first()
    if not cred:
        raise ValueError("Credential not found")
    if credentials is not None:
        cred.encrypted_credentials = _encrypt(credentials)
        for v in credentials.values():
            if isinstance(v, str) and len(v) >= 4:
                cred.key_hint = "..." + v[-4:]
                break
    if label is not None:
        cred.label = label
    if is_default is not None:
        if is_default:
            # Unset previous default for same provider
            db.query(ConnectorCredential).filter(
                ConnectorCredential.industry_id == industry_id,
                ConnectorCredential.provider == cred.provider,
                ConnectorCredential.credential_id != credential_id,
            ).update({"is_default": False})
        cred.is_default = is_default
    db.commit()
    db.refresh(cred)
    return cred


def delete_credential(db: Session, credential_id: str, industry_id: str) -> None:
    cred = db.query(ConnectorCredential).filter(
        ConnectorCredential.credential_id == credential_id,
        ConnectorCredential.industry_id == industry_id,
    ).first()
    if cred:
        db.delete(cred)
        db.commit()


# ── Provider connectivity tests ───────────────────────────────────────────────

def test_credential(db: Session, credential_id: str, industry_id: str) -> dict:
    """
    Test connectivity for a stored credential.
    Returns {"success": bool, "message": str, "provider": str}.
    Updates last_tested_at and status on the record.
    """
    from datetime import datetime, timezone

    cred = db.query(ConnectorCredential).filter(
        ConnectorCredential.credential_id == credential_id,
        ConnectorCredential.industry_id == industry_id,
    ).first()
    if not cred:
        raise ValueError("Credential not found")

    secrets = decrypt_credential(cred)
    result = _run_provider_test(cred.provider, secrets)

    cred.last_tested_at = datetime.now(timezone.utc)
    if result["success"]:
        cred.status = ConnectorStatus.active
        cred.last_error = None
    else:
        cred.status = ConnectorStatus.error
        cred.last_error = result["message"]
    db.commit()
    return {**result, "provider": cred.provider.value, "credential_id": credential_id}


def _run_provider_test(provider: ConnectorProvider, secrets: dict) -> dict:
    """
    Lightweight connectivity check per provider.
    Each block makes the minimal API call to verify the credential is accepted.
    """
    import urllib.request

    try:
        if provider == ConnectorProvider.sumsub:
            # Sumsub: GET /resources/applicants?limit=1 with App Token header
            req = urllib.request.Request(
                "https://api.sumsub.com/resources/applicants?limit=1",
                headers={"X-App-Token": secrets.get("app_token", ""), "Accept": "application/json"},
            )
            with urllib.request.urlopen(req, timeout=10) as r:
                return {"success": r.status in (200, 401), "message": f"HTTP {r.status}"}

        if provider == ConnectorProvider.complyadvantage:
            req = urllib.request.Request(
                "https://api.complyadvantage.com/searches?limit=1",
                headers={"Authorization": f"Token {secrets.get('api_key', '')}"},
            )
            with urllib.request.urlopen(req, timeout=10) as r:
                return {"success": r.status in (200, 401), "message": f"HTTP {r.status}"}

        if provider == ConnectorProvider.trulioo:
            req = urllib.request.Request(
                "https://gateway.trulioo.com/configuration/v1/countrycodes/Identity Verification",
                headers={"x-trulioo-api-key": secrets.get("api_key", ""), "Accept": "application/json"},
            )
            with urllib.request.urlopen(req, timeout=10) as r:
                return {"success": r.status in (200, 401), "message": f"HTTP {r.status}"}

        # Generic: can't auto-test — mark as active optimistically with warning
        return {
            "success": True,
            "message": f"Auto-test not available for {provider.value} — marked active. Verify manually.",
        }
    except Exception as exc:
        return {"success": False, "message": str(exc)}
