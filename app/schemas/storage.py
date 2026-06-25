from typing import Optional

from pydantic import BaseModel

# Fields that hold secrets — never echoed back in API responses.
_SECRET_FIELDS = {"secret_key", "account_key", "credentials_json"}


class StorageConfigInput(BaseModel):
    backend: str  # local | s3 | azure | gcs
    bucket: Optional[str] = None
    region: Optional[str] = None
    access_key: Optional[str] = None
    secret_key: Optional[str] = None
    endpoint_url: Optional[str] = None
    account_name: Optional[str] = None
    account_key: Optional[str] = None
    container: Optional[str] = None
    credentials_json: Optional[str] = None


class StorageConfigResponse(BaseModel):
    backend: str
    bucket: Optional[str] = None
    region: Optional[str] = None
    access_key: Optional[str] = None
    endpoint_url: Optional[str] = None
    account_name: Optional[str] = None
    container: Optional[str] = None
    configured: bool  # False = falling back to the platform default
    verified: Optional[bool] = None  # last connectivity check result, if any

    @classmethod
    def from_config(cls, cfg: Optional[dict]) -> "StorageConfigResponse":
        cfg = cfg or {}
        if not cfg:
            return cls(backend="local", configured=False)
        allowed = {
            "backend",
            "bucket",
            "region",
            "access_key",
            "endpoint_url",
            "account_name",
            "container",
        }
        masked = {k: v for k, v in cfg.items() if k in allowed}
        return cls(**masked, configured=True, verified=cfg.get("verified"))
