import secrets
from typing import List

from pydantic import model_validator
from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    # ── Identity ────────────────────────────────────────────────────────────
    app_name: str = "Verigo"
    environment: str = "development"  # development | staging | production
    debug: bool = False
    version: str = "1.0.0"

    # ── Database ─────────────────────────────────────────────────────────────
    # Production: postgresql://postgres.[ref]:[password]@aws-0-ap-southeast-2.pooler.supabase.com:6543/postgres
    database_url: str = "sqlite:///./tvg.db"

    # ── Supabase ──────────────────────────────────────────────────────────────
    supabase_url: str = ""               # https://[ref].supabase.co
    supabase_anon_key: str = ""          # public anon key (frontend)
    supabase_service_role_key: str = ""  # secret service role key (backend only)

    # ── Auth ─────────────────────────────────────────────────────────────────
    secret_key: str = secrets.token_urlsafe(32)
    algorithm: str = "HS256"
    access_token_expire_minutes: int = 480  # 8 hours

    # ── CORS ─────────────────────────────────────────────────────────────────
    # Comma-separated in env: "https://app.example.com,https://www.example.com"
    cors_origins: str = "*"

    # ── Rate limiting ─────────────────────────────────────────────────────────
    rate_limit_enabled: bool = True
    rate_limit_default: str = "200/minute"
    rate_limit_auth: str = "20/minute"
    redis_url: str = ""  # e.g. redis://localhost:6379/0 — optional, enables Redis-backed rate limiting & cache

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
    # Set to "supabase" in production; "local" for dev
    storage_backend: str = "local"  # local | supabase | s3 | azure | gcs
    document_bucket: str = "documents"  # Supabase Storage bucket name

    # S3 / Backblaze B2 (S3-compatible) — also used by Supabase Storage internally
    s3_bucket: str = ""
    s3_region: str = "us-east-1"
    s3_endpoint_url: str = ""
    aws_access_key_id: str = ""
    aws_secret_access_key: str = ""
    # Azure Blob
    azure_account_name: str = ""
    azure_account_key: str = ""
    azure_container: str = "documents"
    # GCS
    gcs_bucket: str = ""
    gcs_credentials_json: str = ""

    # ── Integrations ─────────────────────────────────────────────────────────
    # AUSTRAC Online API (stub used until credentials provided)
    austrac_api_key: str = ""
    # ABR (register free at https://abr.business.gov.au/Tools/WebServices)
    abr_guid: str = ""
    # ASIC Connect API
    asic_api_key: str = ""
    # Sanctions screening: internal | complyadvantage | worldcheck
    sanctions_provider: str = "internal"
    complyadvantage_api_key: str = ""
    # PEP screening: stub | complyadvantage | worldcheck
    pep_provider: str = "stub"
    # Identity verification (KYC/KYB): internal | sumsub
    identity_provider: str = "internal"
    sumsub_app_token: str = ""
    sumsub_secret_key: str = ""          # used for both API request signing and webhook verification
    sumsub_base_url: str = "https://api.sumsub.com"
    sumsub_level_name: str = "basic-kyc-level"
    sumsub_kyb_level_name: str = "basic-kyb-level"
    # Per-check cost we pay the provider, and our markup when billing tenants
    sumsub_unit_cost_aud: float = 2.50
    usage_markup_pct: float = 50.0       # tenant is billed unit_cost * (1 + pct/100)
    # OCR / document extraction: stub | textract | google_vision
    ocr_provider: str = "stub"
    # Email: smtp | sendgrid | stub
    email_provider: str = "smtp"
    # SMS: stub | twilio | messagebird
    sms_provider: str = "stub"
    twilio_account_sid: str = ""
    twilio_auth_token: str = ""
    twilio_from_number: str = ""
    sms_from_number: str = ""

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
                raise ValueError(
                    "SQLite is not supported in production — set DATABASE_URL to a "
                    "PostgreSQL connection string (data loss / no concurrency guarantees)"
                )
            if self.cors_origins == "*":
                raise ValueError(
                    "CORS_ORIGINS must be set to explicit origin(s) in production — "
                    "wildcard '*' combined with allow_credentials is unsafe"
                )
            if not self.redis_url:
                import warnings

                warnings.warn(
                    "REDIS_URL not set in production — JWT revocation and rate "
                    "limiting will be per-process only and will not work correctly "
                    "across multiple workers/instances."
                )
        return self


settings = Settings()
