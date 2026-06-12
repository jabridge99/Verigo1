import secrets
from typing import List, Optional
from pydantic_settings import BaseSettings
from pydantic import field_validator, model_validator


class Settings(BaseSettings):
    # ── Identity ────────────────────────────────────────────────────────────
    app_name: str = "Verigo"
    environment: str = "development"   # development | staging | production
    debug: bool = False
    version: str = "1.0.0"

    # ── Database ─────────────────────────────────────────────────────────────
    database_url: str = "sqlite:///./tvg.db"

    # ── Auth ─────────────────────────────────────────────────────────────────
    secret_key: str = secrets.token_urlsafe(32)
    algorithm: str = "HS256"
    access_token_expire_minutes: int = 480   # 8 hours

    # ── CORS ─────────────────────────────────────────────────────────────────
    # Comma-separated in env: "https://app.example.com,https://www.example.com"
    cors_origins: str = "*"

    # ── Rate limiting ─────────────────────────────────────────────────────────
    rate_limit_enabled: bool = True
    rate_limit_default: str = "200/minute"
    rate_limit_auth: str = "20/minute"

    # ── Document storage ──────────────────────────────────────────────────────
    document_store_path: str = "./uploads"

    # ── Email ─────────────────────────────────────────────────────────────────
    smtp_host: str = ""
    smtp_port: int = 587
    smtp_user: str = ""
    smtp_pass: str = ""
    from_email: str = "noreply@verigo.com.au"
    from_name: str = "Verigo"

    # ── App URLs ──────────────────────────────────────────────────────────────
    app_url: str = "http://localhost:3000"
    api_url: str = "http://localhost:8000"

    # ── Stripe ────────────────────────────────────────────────────────────────
    stripe_secret_key: str = ""
    stripe_webhook_secret: str = ""
    stripe_starter_monthly_id: str = ""
    stripe_starter_annual_id: str = ""
    stripe_pro_monthly_id: str = ""
    stripe_pro_annual_id: str = ""
    stripe_ent_monthly_id: str = ""
    stripe_ent_annual_id: str = ""

    # ── Storage backend ───────────────────────────────────────────────────────
    storage_backend: str = "local"   # local | s3 | azure | gcs
    # S3 / Backblaze B2 (S3-compatible)
    s3_bucket: str = ""
    s3_region: str = "us-east-1"
    s3_endpoint_url: str = ""        # leave blank for AWS; set for Backblaze/MinIO
    aws_access_key_id: str = ""
    aws_secret_access_key: str = ""
    # Azure Blob
    azure_account_name: str = ""
    azure_account_key: str = ""
    azure_container: str = "documents"
    # GCS
    gcs_bucket: str = ""
    gcs_credentials_json: str = ""   # path to service-account JSON

    # ── Sentry (optional) ────────────────────────────────────────────────────
    sentry_dsn: str = ""

    # ── Logging ──────────────────────────────────────────────────────────────
    log_level: str = "INFO"

    class Config:
        env_file = ".env"
        case_sensitive = False

    @property
    def is_production(self) -> bool:
        return self.environment == "production"

    @property
    def cors_origins_list(self) -> List[str]:
        if self.cors_origins == "*":
            return ["*"]
        return [o.strip() for o in self.cors_origins.split(",") if o.strip()]

    @model_validator(mode="after")
    def check_production_secrets(self):
        if self.environment == "production":
            if self.secret_key == "change-me-in-production":
                raise ValueError("SECRET_KEY must be changed in production")
            if self.database_url.startswith("sqlite"):
                import warnings
                warnings.warn("SQLite not recommended for production — set DATABASE_URL to PostgreSQL")
        return self


settings = Settings()
