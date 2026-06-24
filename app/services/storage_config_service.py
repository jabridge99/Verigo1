"""
Per-tenant storage configuration — lets a tenant point document storage at
their own S3/Azure/GCS bucket instead of the platform default, and lets an
admin assign/override any tenant's storage backend.
"""

from typing import Optional

from sqlalchemy.orm import Session

from app.models.tenant import IndustryTenant
from app.schemas.storage import StorageConfigInput
from app.services.crypto import encrypt_secret
from app.services.storage.factory import (
    build_provider_from_config,
    invalidate_tenant_cache,
)

REQUIRED_FIELDS = {
    "s3": ["bucket", "access_key", "secret_key"],
    "azure": ["account_name", "account_key", "container"],
    "gcs": ["bucket"],
    "local": [],
}

# Credential fields encrypted at rest before being persisted to storage_config.
SECRET_FIELDS = {"secret_key", "account_key", "credentials_json"}


def _get_tenant(db: Session, industry_id: str) -> Optional[IndustryTenant]:
    return db.query(IndustryTenant).filter_by(industry_id=industry_id).first()


def _validate_endpoint_url(url: str) -> None:
    """
    Block SSRF: a tenant-supplied custom S3/Azure/GCS endpoint_url is used
    directly by boto3/storage adapters to issue live outbound requests
    (including the connectivity check below), so it must not be allowed to
    target private/loopback/link-local/reserved IPs or cloud metadata hosts.
    """
    import ipaddress
    from urllib.parse import urlparse

    parsed = urlparse(url)
    if parsed.scheme != "https":
        raise ValueError("Storage endpoint_url must use HTTPS")
    host = parsed.hostname or ""
    _BLOCKED_HOSTS = {
        "169.254.169.254",
        "metadata.google.internal",
        "metadata.internal",
    }
    if host.lower() in _BLOCKED_HOSTS or host.lower().endswith(".internal"):
        raise ValueError(f"Storage endpoint_url host '{host}' is not allowed")
    try:
        ip = ipaddress.ip_address(host)
        if ip.is_private or ip.is_loopback or ip.is_link_local or ip.is_reserved:
            raise ValueError(
                f"Storage endpoint_url must not target a private/loopback/reserved IP: {host}"
            )
    except ValueError as e:
        if "Storage endpoint_url" in str(e):
            raise
        pass  # not a raw IP — hostname is fine


def get_config(db: Session, industry_id: str) -> dict:
    tenant = _get_tenant(db, industry_id)
    return (tenant.storage_config or {}) if tenant else {}


async def set_config(db: Session, industry_id: str, data: StorageConfigInput) -> dict:
    tenant = _get_tenant(db, industry_id)
    if not tenant:
        raise ValueError("No tenant found for this industry")

    backend = data.backend.lower()
    missing = [
        f for f in REQUIRED_FIELDS.get(backend, []) if not getattr(data, f, None)
    ]
    if missing:
        raise ValueError(
            f"Missing required field(s) for {backend}: {', '.join(missing)}"
        )

    if data.endpoint_url:
        _validate_endpoint_url(data.endpoint_url)

    cfg = data.model_dump(exclude_none=True)
    cfg["backend"] = backend

    # Best-effort connectivity check — run before encrypting, saved either way.
    verified = False
    try:
        provider = build_provider_from_config(cfg)
        await provider.exists("__verigo_storage_check__")
        verified = True
    except Exception:
        verified = False
    cfg["verified"] = verified

    encrypted_cfg = {
        k: (encrypt_secret(v) if k in SECRET_FIELDS and isinstance(v, str) else v)
        for k, v in cfg.items()
    }
    tenant.storage_config = encrypted_cfg
    db.commit()
    invalidate_tenant_cache(industry_id)
    return (
        cfg  # return plaintext form for the immediate response (never persisted as-is)
    )


def clear_config(db: Session, industry_id: str) -> bool:
    tenant = _get_tenant(db, industry_id)
    if not tenant:
        return False
    tenant.storage_config = {}
    db.commit()
    invalidate_tenant_cache(industry_id)
    return True
