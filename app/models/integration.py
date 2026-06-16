"""
Integration Hub Models — Phase 3.

Centralised marketplace for third-party integrations:
  - KYC (identity, document, biometric, liveness)
  - Screening (PEP, sanctions, adverse media, crypto)
  - Corporate registries (ABR, ASIC, OpenCorporates)
  - Address validation
  - Credit & financial intelligence
  - CRM (Salesforce, Zoho, HubSpot, etc.)
  - Storage (OneDrive, Dropbox, Google Drive, AWS S3, etc.)
  - Communications (email, SMS, Teams, Slack)

Credentials are stored encrypted in credentials_encrypted (JSON).
The platform never logs or returns raw credentials.
"""
import enum
from uuid import uuid4

from sqlalchemy import (
    Boolean, Column, DateTime, Enum, Float,
    ForeignKey, Integer, JSON, String, Text,
    UniqueConstraint, func,
)

from app.db.database import Base


class IntegrationCategory(str, enum.Enum):
    kyc                  = "kyc"
    screening            = "screening"
    corporate_registry   = "corporate_registry"
    address_validation   = "address_validation"
    credit_financial     = "credit_financial"
    crm                  = "crm"
    storage              = "storage"
    communications       = "communications"
    other                = "other"


class IntegrationType(str, enum.Enum):
    open_source    = "open_source"
    free_api       = "free_api"
    premium_api    = "premium_api"
    enterprise_api = "enterprise_api"
    custom_api     = "custom_api"


class AuthType(str, enum.Enum):
    api_key     = "api_key"
    oauth2      = "oauth2"
    basic_auth  = "basic_auth"
    bearer      = "bearer"
    mtls        = "mtls"         # mutual TLS
    custom      = "custom"
    none        = "none"


class IntegrationHealthStatus(str, enum.Enum):
    healthy   = "healthy"
    degraded  = "degraded"
    down      = "down"
    unknown   = "unknown"


# ── Platform Integration Provider Catalog ─────────────────────────────────────

PROVIDER_CATALOG: list[dict] = [
    # KYC
    {"slug": "onfido",          "name": "Onfido",               "category": "kyc",                "type": "premium_api",    "auth": "api_key",  "description": "AI-powered identity verification: document check, facial biometric, liveness detection"},
    {"slug": "jumio",           "name": "Jumio",                "category": "kyc",                "type": "premium_api",    "auth": "api_key",  "description": "End-to-end identity proofing and eKYC"},
    {"slug": "veriff",          "name": "Veriff",               "category": "kyc",                "type": "premium_api",    "auth": "api_key",  "description": "Video-first identity verification with automated decision engine"},
    {"slug": "idnow",           "name": "IDnow",                "category": "kyc",                "type": "premium_api",    "auth": "api_key",  "description": "European eIDAS-compliant identity verification"},
    {"slug": "stripe_identity", "name": "Stripe Identity",      "category": "kyc",                "type": "premium_api",    "auth": "api_key",  "description": "Identity verification integrated with Stripe payment ecosystem"},
    # Screening
    {"slug": "refinitiv",       "name": "Refinitiv World-Check","category": "screening",          "type": "enterprise_api", "auth": "api_key",  "description": "PEP, sanctions, and adverse media database"},
    {"slug": "dow_jones",       "name": "Dow Jones Risk & Compliance","category": "screening",    "type": "enterprise_api", "auth": "api_key",  "description": "PEP and sanctions screening with adverse media"},
    {"slug": "complyadvantage", "name": "ComplyAdvantage",      "category": "screening",          "type": "premium_api",    "auth": "api_key",  "description": "Real-time AML data and transaction monitoring"},
    {"slug": "opensanctions",   "name": "OpenSanctions",        "category": "screening",          "type": "open_source",    "auth": "none",     "description": "Open-source global sanctions and PEP database"},
    {"slug": "chainalysis",     "name": "Chainalysis KYT",      "category": "screening",          "type": "enterprise_api", "auth": "api_key",  "description": "Cryptocurrency transaction monitoring and wallet screening"},
    {"slug": "elliptic",        "name": "Elliptic Forensics",   "category": "screening",          "type": "enterprise_api", "auth": "api_key",  "description": "Blockchain analytics and crypto risk scoring"},
    {"slug": "trmlabs",         "name": "TRM Labs",             "category": "screening",          "type": "premium_api",    "auth": "api_key",  "description": "Blockchain intelligence and crypto compliance"},
    # Corporate Registries
    {"slug": "abr",             "name": "ABR (Australian Business Register)","category":"corporate_registry","type":"free_api","auth":"api_key","description":"Australian Business Number and entity lookup"},
    {"slug": "asic",            "name": "ASIC Company Search",  "category": "corporate_registry", "type": "free_api",       "auth": "none",     "description": "ASIC company and officer lookup (public data)"},
    {"slug": "opencorporates",  "name": "OpenCorporates",       "category": "corporate_registry", "type": "free_api",       "auth": "api_key",  "description": "Global company registry aggregator (180+ jurisdictions)"},
    {"slug": "dnb",             "name": "Dun & Bradstreet",     "category": "corporate_registry", "type": "enterprise_api", "auth": "oauth2",   "description": "Global business identity and credit data"},
    # Address Validation
    {"slug": "google_places",   "name": "Google Places API",    "category": "address_validation", "type": "premium_api",    "auth": "api_key",  "description": "Address autocomplete, geocoding, and validation"},
    {"slug": "australia_post",  "name": "Australia Post API",   "category": "address_validation", "type": "free_api",       "auth": "api_key",  "description": "Australian postal address validation and lookup"},
    {"slug": "loqate",          "name": "Loqate Address Verify","category": "address_validation", "type": "premium_api",    "auth": "api_key",  "description": "Global address verification and geocoding"},
    # Credit & Financial Intelligence
    {"slug": "equifax_au",      "name": "Equifax Australia",    "category": "credit_financial",   "type": "enterprise_api", "auth": "oauth2",   "description": "Individual and commercial credit reports (Australia)"},
    {"slug": "illion",          "name": "illion (Dun & Bradstreet AU)","category":"credit_financial","type":"enterprise_api","auth":"api_key","description":"Business credit bureau and financial intelligence"},
    {"slug": "creditsafe",      "name": "CreditSafe",           "category": "credit_financial",   "type": "premium_api",    "auth": "api_key",  "description": "Global business credit reports"},
    # CRM
    {"slug": "salesforce",      "name": "Salesforce",           "category": "crm",                "type": "enterprise_api", "auth": "oauth2",   "description": "Enterprise CRM — sync customers and compliance tasks"},
    {"slug": "zoho_crm",        "name": "Zoho CRM",             "category": "crm",                "type": "premium_api",    "auth": "oauth2",   "description": "Cloud CRM with AML workflow integration"},
    {"slug": "hubspot",         "name": "HubSpot",              "category": "crm",                "type": "premium_api",    "auth": "oauth2",   "description": "CRM and marketing automation"},
    {"slug": "monday",          "name": "Monday.com",           "category": "crm",                "type": "premium_api",    "auth": "api_key",  "description": "Work OS — compliance task and workflow management"},
    {"slug": "pipedrive",       "name": "Pipedrive",            "category": "crm",                "type": "premium_api",    "auth": "oauth2",   "description": "Sales-focused CRM"},
    {"slug": "ms_dynamics",     "name": "Microsoft Dynamics 365","category":"crm",                "type": "enterprise_api", "auth": "oauth2",   "description": "Enterprise CRM and ERP integration"},
    # Storage
    {"slug": "onedrive",        "name": "Microsoft OneDrive",   "category": "storage",            "type": "free_api",       "auth": "oauth2",   "description": "Microsoft cloud document storage"},
    {"slug": "dropbox",         "name": "Dropbox Business",     "category": "storage",            "type": "premium_api",    "auth": "oauth2",   "description": "Cloud storage and document management"},
    {"slug": "google_drive",    "name": "Google Drive",         "category": "storage",            "type": "free_api",       "auth": "oauth2",   "description": "Google cloud storage"},
    {"slug": "sharepoint",      "name": "SharePoint",           "category": "storage",            "type": "enterprise_api", "auth": "oauth2",   "description": "Microsoft SharePoint document management"},
    {"slug": "aws_s3",          "name": "AWS S3",               "category": "storage",            "type": "premium_api",    "auth": "api_key",  "description": "Amazon S3 object storage"},
    {"slug": "azure_blob",      "name": "Azure Blob Storage",   "category": "storage",            "type": "premium_api",    "auth": "api_key",  "description": "Microsoft Azure object storage"},
    {"slug": "sftp",            "name": "Custom SFTP",          "category": "storage",            "type": "custom_api",     "auth": "basic_auth","description":"Secure FTP server for document transfer"},
    # Communications
    {"slug": "sendgrid",        "name": "SendGrid",             "category": "communications",     "type": "free_api",       "auth": "api_key",  "description": "Transactional email (alerts, reminders, notifications)"},
    {"slug": "ses",             "name": "AWS SES",              "category": "communications",     "type": "premium_api",    "auth": "api_key",  "description": "Amazon Simple Email Service"},
    {"slug": "twilio_sms",      "name": "Twilio SMS",           "category": "communications",     "type": "premium_api",    "auth": "api_key",  "description": "Programmable SMS for compliance alerts"},
    {"slug": "ms_teams",        "name": "Microsoft Teams",      "category": "communications",     "type": "enterprise_api", "auth": "oauth2",   "description": "Teams webhook for compliance notifications"},
    {"slug": "slack",           "name": "Slack",                "category": "communications",     "type": "free_api",       "auth": "api_key",  "description": "Slack webhook or app for compliance alerts"},
    {"slug": "whatsapp_business","name":"WhatsApp Business API","category": "communications",     "type": "premium_api",    "auth": "api_key",  "description": "WhatsApp Business for compliance communications"},
]


class IntegrationProvider(Base):
    """
    Platform-level catalog of available integration providers.
    Seeded by VeriGo. Orgs select from this catalog.
    """
    __tablename__ = "integration_providers"

    id              = Column(String, primary_key=True, default=lambda: f"prv_{uuid4().hex[:10]}")
    slug            = Column(String(100), unique=True, nullable=False, index=True)
    name            = Column(String(200), nullable=False)
    category        = Column(Enum(IntegrationCategory), nullable=False, index=True)
    integration_type = Column(Enum(IntegrationType), nullable=False)
    auth_type       = Column(Enum(AuthType), nullable=False)
    description     = Column(Text)
    logo_url        = Column(String(500))
    docs_url        = Column(String(500))

    # Schema for credentials (what the org needs to supply)
    required_credentials = Column(JSON, default=list)   # [{"key": "api_key", "label": "API Key", "secret": True}]
    optional_config      = Column(JSON, default=list)   # [{"key": "base_url", "label": "Base URL", "default": "..."}]

    # Capabilities offered by this provider
    capabilities    = Column(JSON, default=list)        # ["pep_check", "sanctions_check", "adverse_media"]

    is_active       = Column(Boolean, default=True)
    is_featured     = Column(Boolean, default=False)

    created_at  = Column(DateTime(timezone=True), server_default=func.now())
    updated_at  = Column(DateTime(timezone=True), onupdate=func.now())


class OrgIntegration(Base):
    """
    An org's configured and enabled instance of an IntegrationProvider.

    Credentials are stored JSON-encrypted at the application layer.
    Never returned in API responses — only checked for existence.
    """
    __tablename__ = "org_integrations"
    __table_args__ = (
        UniqueConstraint("org_id", "provider_id", name="uq_org_provider"),
    )

    id          = Column(String, primary_key=True, default=lambda: f"int_{uuid4().hex[:10]}")
    org_id      = Column(String, ForeignKey("organisations.id", ondelete="CASCADE"),
                         nullable=False, index=True)
    provider_id = Column(String, ForeignKey("integration_providers.id"), nullable=False)
    provider_slug = Column(String(100), nullable=False, index=True)  # denormalised for queries

    is_enabled  = Column(Boolean, default=False, nullable=False, index=True)

    # Encrypted credentials (AES-256 at application layer)
    # NEVER returned in API responses
    credentials_encrypted = Column(JSON)            # {"api_key": "<encrypted>"}
    config                = Column(JSON, default=dict)  # non-sensitive config {"base_url": "..."}

    # Connection health
    last_tested_at      = Column(DateTime(timezone=True))
    last_test_result    = Column(Boolean)           # True = passed
    last_test_message   = Column(Text)
    health_status       = Column(Enum(IntegrationHealthStatus),
                                  default=IntegrationHealthStatus.unknown)
    last_health_check_at = Column(DateTime(timezone=True))
    consecutive_failures = Column(Integer, default=0)

    # Usage tracking
    usage_count     = Column(Integer, default=0)
    last_used_at    = Column(DateTime(timezone=True))

    enabled_by  = Column(String)    # user_id who enabled
    created_at  = Column(DateTime(timezone=True), server_default=func.now())
    updated_at  = Column(DateTime(timezone=True), onupdate=func.now())


class IntegrationAuditLog(Base):
    """
    Immutable audit record for all integration operations.
    Logs enable/disable, credential rotation, connection tests, and errors.
    Never logs raw credentials.
    """
    __tablename__ = "integration_audit_logs"

    id              = Column(String, primary_key=True, default=lambda: f"ial_{uuid4().hex[:12]}")
    org_id          = Column(String, nullable=False, index=True)
    integration_id  = Column(String, ForeignKey("org_integrations.id"), nullable=True, index=True)
    provider_slug   = Column(String(100), nullable=False)

    event_type      = Column(String(50), nullable=False)   # enabled | disabled | tested | rotated | error | health_check
    success         = Column(Boolean)
    message         = Column(Text)
    actor_id        = Column(String)    # user_id or "system"
    ip_address      = Column(String(45))

    created_at  = Column(DateTime(timezone=True), server_default=func.now())
