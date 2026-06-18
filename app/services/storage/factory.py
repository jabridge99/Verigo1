"""
StorageProvider factory.

Resolution order:
1. Application-wide settings (STORAGE_BACKEND env var)
2. Default: local filesystem

Supported backends: local, supabase, s3, azure, gcs
"""

from __future__ import annotations

import logging
from typing import Optional

from app.config import settings

from .base import StorageProvider

log = logging.getLogger("tvg.storage")

# Module-level cache: backend_key → provider instance
_provider_cache: dict[str, StorageProvider] = {}


def _build_provider(backend: str, cfg: dict) -> StorageProvider:
    backend = backend.lower()

    if backend == "local":
        from .local import LocalStorageProvider

        root = cfg.get(
            "root",
            settings.document_store_path
            if hasattr(settings, "document_store_path")
            else "./document_store",
        )
        return LocalStorageProvider(root=root)

    if backend in ("s3", "backblaze"):
        from .s3 import S3StorageProvider

        return S3StorageProvider(
            bucket=cfg["bucket"],
            region=cfg.get("region", "us-east-1"),
            access_key=cfg["access_key"],
            secret_key=cfg["secret_key"],
            endpoint_url=cfg.get("endpoint_url"),  # Backblaze / MinIO endpoint
        )

    if backend == "azure":
        from .azure_blob import AzureBlobStorageProvider

        return AzureBlobStorageProvider(
            account_name=cfg["account_name"],
            account_key=cfg["account_key"],
            container=cfg["container"],
        )

    if backend == "gcs":
        from .gcs import GCSStorageProvider

        return GCSStorageProvider(
            bucket=cfg["bucket"],
            credentials_json=cfg.get("credentials_json"),
        )

    if backend == "supabase":
        from .supabase import SupabaseStorageProvider

        return SupabaseStorageProvider(bucket=cfg.get("bucket"))

    raise ValueError(f"Unknown storage backend: {backend}")


def get_storage_provider(org_id: Optional[str] = None) -> StorageProvider:
    """Return the configured StorageProvider (application-wide)."""
    backend = getattr(settings, "storage_backend", "local")
    if backend not in _provider_cache:
        cfg: dict = {}
        if backend == "supabase":
            cfg = {"bucket": getattr(settings, "document_bucket", "documents")}
        elif backend == "s3":
            cfg = {
                "bucket": getattr(settings, "s3_bucket", ""),
                "region": getattr(settings, "s3_region", "us-east-1"),
                "access_key": getattr(settings, "aws_access_key_id", ""),
                "secret_key": getattr(settings, "aws_secret_access_key", ""),
                "endpoint_url": getattr(settings, "s3_endpoint_url", None),
            }
        elif backend == "azure":
            cfg = {
                "account_name": getattr(settings, "azure_account_name", ""),
                "account_key": getattr(settings, "azure_account_key", ""),
                "container": getattr(settings, "azure_container", "documents"),
            }
        elif backend == "gcs":
            cfg = {
                "bucket": getattr(settings, "gcs_bucket", ""),
                "credentials_json": getattr(settings, "gcs_credentials_json", None),
            }
        elif backend == "local":
            cfg = {"root": getattr(settings, "document_store_path", "./document_store")}
        _provider_cache[backend] = _build_provider(backend, cfg)

    return _provider_cache[backend]
