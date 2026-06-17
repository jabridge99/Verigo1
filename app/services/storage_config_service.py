"""
Per-tenant storage configuration — lets a tenant point document storage at
their own S3/Azure/GCS bucket instead of the platform default, and lets an
admin assign/override any tenant's storage backend.
"""

from typing import Optional

from sqlalchemy.orm import Session

from app.models.tenant import IndustryTenant
from app.schemas.storage import StorageConfigInput
from app.services.storage.factory import build_provider_from_config, invalidate_tenant_cache

REQUIRED_FIELDS = {
    "s3": ["bucket", "access_key", "secret_key"],
    "azure": ["account_name", "account_key", "container"],
    "gcs": ["bucket"],
    "local": [],
}


def _get_tenant(db: Session, industry_id: str) -> Optional[IndustryTenant]:
    return db.query(IndustryTenant).filter_by(industry_id=industry_id).first()


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
        raise ValueError(f"Missing required field(s) for {backend}: {', '.join(missing)}")

    cfg = data.model_dump(exclude_none=True)
    cfg["backend"] = backend

    # Best-effort connectivity check — saved either way, but flagged.
    verified = False
    try:
        provider = build_provider_from_config(cfg)
        await provider.exists("__verigo_storage_check__")
        verified = True
    except Exception:
        verified = False
    cfg["verified"] = verified

    tenant.storage_config = cfg
    db.commit()
    invalidate_tenant_cache(industry_id)
    return cfg


def clear_config(db: Session, industry_id: str) -> bool:
    tenant = _get_tenant(db, industry_id)
    if not tenant:
        return False
    tenant.storage_config = {}
    db.commit()
    invalidate_tenant_cache(industry_id)
    return True
