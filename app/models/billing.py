import enum

from sqlalchemy import (
    JSON,
    Boolean,
    Column,
    DateTime,
    Enum,
    Float,
    ForeignKey,
    Integer,
    String,
    Text,
    UniqueConstraint,
)
from sqlalchemy.sql import func

from app.db.database import Base


class BillingPlan(str, enum.Enum):
    starter = "starter"  # $299/mo
    professional = "professional"  # $799/mo
    enterprise = "enterprise"  # $1,999/mo
    vvip = "vvip"  # custom pricing
    free_trial = "free_trial"


class BillingInterval(str, enum.Enum):
    monthly = "monthly"
    annual = "annual"  # 20% discount


class SubscriptionStatus(str, enum.Enum):
    active = "active"
    trialing = "trialing"
    past_due = "past_due"
    canceled = "canceled"
    unpaid = "unpaid"
    incomplete = "incomplete"
    paused = "paused"


class InvoiceStatus(str, enum.Enum):
    draft = "draft"
    open = "open"
    paid = "paid"
    void = "void"
    uncollectible = "uncollectible"


class AddonKey(str, enum.Enum):
    enterprise_crypto_screening = "enterprise_crypto_screening"


class AddonStatus(str, enum.Enum):
    active = "active"
    canceled = "canceled"


# ── Enterprise add-on catalogue ─────────────────────────────────────────────────
# Add-ons unlock providers that are partially built (unverified response schema)
# or sales-gated (no self-serve API access) — sold separately from the base plan
# so tenants aren't charged for capability they haven't opted into.

ADDON_CATALOGUE = {
    AddonKey.enterprise_crypto_screening: {
        "name": "Enterprise Crypto Wallet Screening",
        "monthly_aud": 499.00,
        "description": (
            "Unlocks enterprise-grade crypto wallet risk providers (Elliptic, "
            "TRM Labs) for cluster-level exposure scoring beyond the included "
            "sanctions-only matching (Chainalysis, OFAC SDN, GoPlus, Scorechain)."
        ),
        "unlocks_providers": ["elliptic", "trm_labs"],
        "requires_plan": [BillingPlan.enterprise, BillingPlan.vvip],
    },
}


# ── Published plan catalogue ───────────────────────────────────────────────────

PLAN_CATALOGUE = {
    BillingPlan.starter: {
        "name": "Starter",
        "monthly_aud": 59.00,
        "annual_aud": 599.00,
        "features": [
            "Up to 500 customers",
            "1 user per tenant",
            "AML transaction monitoring",
            "KYC/KYB onboarding",
            "AUSTRAC TTR & IFTI reporting",
            "Email notifications",
            "Document vault (5 GB)",
            "1,000 API calls / month",
            "Standard support",
        ],
        "limits": {"customers": 500, "users": 1, "api_calls_month": 1_000},
    },
    BillingPlan.professional: {
        "name": "Professional",
        "monthly_aud": 79.00,
        "annual_aud": 799.00,
        "features": [
            "Up to 5,000 customers",
            "3 users per tenant",
            "Advanced rule builder",
            "ECDD assessments",
            "MLRO case management",
            "Webhooks & API access",
            "Document vault (15 GB)",
            "5,000 API calls / month",
            "Analytics dashboard",
            "Priority support",
        ],
        "limits": {"customers": 5_000, "users": 3, "api_calls_month": 5_000},
    },
    BillingPlan.enterprise: {
        "name": "Enterprise",
        "monthly_aud": 299.00,
        "annual_aud": 2_999.00,
        "features": [
            "Unlimited customers",
            "5 users per tenant",
            "White-label branding",
            "Custom domain",
            "Multi-tenant management",
            "Dedicated MLRO support",
            "Document vault (50 GB)",
            "10,000 API calls / month",
            "SLA 99.9% uptime",
            "Dedicated account manager",
        ],
        "limits": {"customers": -1, "users": 5, "api_calls_month": 10_000},
    },
    BillingPlan.vvip: {
        "name": "VVIP",
        "monthly_aud": None,  # custom per tenant
        "annual_aud": None,
        "features": [
            "Everything in Enterprise",
            "Custom SLA",
            "On-site training",
            "Regulatory liaison support",
            "Custom integrations",
        ],
        "limits": {"customers": -1, "users": -1, "api_calls_month": -1},
    },
}


# ── Default feature catalogue (seed data, derived from PLAN_CATALOGUE) ─────────
# code -> (label, category)
FEATURE_DEFINITIONS = {
    "customers_500": ("Up to 500 customers", "limits"),
    "customers_5000": ("Up to 5,000 customers", "limits"),
    "customers_unlimited": ("Unlimited customers", "limits"),
    "aml_monitoring": ("AML transaction monitoring", "core"),
    "kyc_kyb_onboarding": ("KYC/KYB onboarding", "core"),
    "austrac_reporting": ("AUSTRAC TTR & IFTI reporting", "core"),
    "email_notifications": ("Email notifications", "core"),
    "standard_support": ("Standard support", "support"),
    "priority_support": ("Priority support", "support"),
    "advanced_rule_builder": ("Advanced rule builder", "core"),
    "ecdd_assessments": ("ECDD assessments", "core"),
    "mlro_case_management": ("MLRO case management", "core"),
    "webhooks_api": ("Webhooks & API access", "integration"),
    "document_vault_5gb": ("Document vault (5 GB)", "storage"),
    "document_vault_15gb": ("Document vault (15 GB)", "storage"),
    "document_vault_50gb": ("Document vault (50 GB)", "storage"),
    "analytics_dashboard": ("Analytics dashboard", "core"),
    "white_label_branding": ("White-label branding", "enterprise"),
    "custom_domain": ("Custom domain", "enterprise"),
    "multi_tenant_management": ("Multi-tenant management", "enterprise"),
    "dedicated_mlro_support": ("Dedicated MLRO support", "support"),
    "sla_99_9": ("SLA 99.9% uptime", "enterprise"),
    "dedicated_account_manager": ("Dedicated account manager", "support"),
    "custom_sla": ("Custom SLA", "enterprise"),
    "onsite_training": ("On-site training", "enterprise"),
    "regulatory_liaison_support": ("Regulatory liaison support", "support"),
    "custom_integrations": ("Custom integrations", "integration"),
    "full_aml_program": ("Full AML/CTF program (all controls)", "core"),
    "full_risk_assessment": ("Full risk assessment (all factors)", "core"),
}

# Default plan -> set of enabled feature codes, derived from the legacy static lists.
DEFAULT_PLAN_FEATURES = {
    BillingPlan.free_trial: [],
    BillingPlan.starter: [
        "customers_500",
        "aml_monitoring",
        "kyc_kyb_onboarding",
        "austrac_reporting",
        "email_notifications",
        "document_vault_5gb",
        "standard_support",
        "full_aml_program",
        "full_risk_assessment",
    ],
    BillingPlan.professional: [
        "customers_5000",
        "advanced_rule_builder",
        "ecdd_assessments",
        "mlro_case_management",
        "webhooks_api",
        "document_vault_15gb",
        "analytics_dashboard",
        "priority_support",
        "full_aml_program",
        "full_risk_assessment",
    ],
    BillingPlan.enterprise: [
        "customers_unlimited",
        "white_label_branding",
        "custom_domain",
        "multi_tenant_management",
        "dedicated_mlro_support",
        "document_vault_50gb",
        "sla_99_9",
        "dedicated_account_manager",
        "full_aml_program",
        "full_risk_assessment",
    ],
    BillingPlan.vvip: [
        "customers_unlimited",
        "white_label_branding",
        "custom_domain",
        "multi_tenant_management",
        "dedicated_mlro_support",
        "document_vault_50gb",
        "sla_99_9",
        "dedicated_account_manager",
        "custom_sla",
        "onsite_training",
        "regulatory_liaison_support",
        "custom_integrations",
        "full_aml_program",
        "full_risk_assessment",
    ],
}


# ── Models ─────────────────────────────────────────────────────────────────────


class Feature(Base):
    __tablename__ = "features"

    id = Column(Integer, primary_key=True, index=True)
    code = Column(String(60), unique=True, index=True, nullable=False)
    name = Column(String(200), nullable=False)
    category = Column(String(60))
    description = Column(Text)

    created_at = Column(DateTime(timezone=True), server_default=func.now())


class PlanFeatureToggle(Base):
    __tablename__ = "plan_feature_toggles"
    __table_args__ = (UniqueConstraint("plan", "feature_code", name="uq_plan_feature"),)

    id = Column(Integer, primary_key=True, index=True)
    plan = Column(Enum(BillingPlan), nullable=False, index=True)
    feature_code = Column(
        String(60), ForeignKey("features.code"), nullable=False, index=True
    )
    enabled = Column(Boolean, default=True, nullable=False)

    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())


class Subscription(Base):
    __tablename__ = "subscriptions"
    __table_args__ = (
        UniqueConstraint(
            "industry_id", "organisation_id", name="uq_subscription_industry_org"
        ),
    )

    id = Column(Integer, primary_key=True, index=True)
    subscription_id = Column(String(60), unique=True, index=True, nullable=False)

    # Tenant link
    industry_id = Column(String(100), index=True, nullable=False)
    organisation_id = Column(
        String, ForeignKey("organisations.id", ondelete="CASCADE"), index=True
    )
    tenant_id = Column(String(60))

    # Plan
    plan = Column(Enum(BillingPlan), default=BillingPlan.free_trial)
    interval = Column(Enum(BillingInterval), default=BillingInterval.monthly)
    status = Column(Enum(SubscriptionStatus), default=SubscriptionStatus.trialing)

    # Pricing — base catalogue price
    base_price_aud = Column(Float)
    # VVIP / admin override (takes precedence over catalogue)
    custom_monthly_aud = Column(Float)
    custom_annual_aud = Column(Float)
    annual_discount_pct = Column(Float, default=20.0)  # editable annual discount

    # Stripe
    stripe_customer_id = Column(String(100))
    stripe_subscription_id = Column(String(100))
    stripe_price_id = Column(String(100))

    # Lifecycle
    trial_ends_at = Column(DateTime(timezone=True))
    current_period_start = Column(DateTime(timezone=True))
    current_period_end = Column(DateTime(timezone=True))
    canceled_at = Column(DateTime(timezone=True))
    cancel_at_period_end = Column(Boolean, default=False)

    # Metadata
    notes = Column(Text)  # admin notes (VVIP deal terms etc.)
    extra_metadata = Column(JSON, default=dict)

    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())


class Invoice(Base):
    __tablename__ = "invoices"

    id = Column(Integer, primary_key=True, index=True)
    invoice_id = Column(String(60), unique=True, index=True, nullable=False)
    subscription_id = Column(String(60), index=True)
    industry_id = Column(String(100), index=True)
    organisation_id = Column(
        String, ForeignKey("organisations.id", ondelete="CASCADE"), index=True
    )

    stripe_invoice_id = Column(String(100))
    amount_aud = Column(Float, nullable=False)
    tax_aud = Column(Float, default=0.0)
    total_aud = Column(Float, nullable=False)

    status = Column(Enum(InvoiceStatus), default=InvoiceStatus.open)
    description = Column(Text)
    period_start = Column(DateTime(timezone=True))
    period_end = Column(DateTime(timezone=True))
    due_date = Column(DateTime(timezone=True))
    paid_at = Column(DateTime(timezone=True))

    stripe_hosted_url = Column(String(500))
    stripe_pdf_url = Column(String(500))

    created_at = Column(DateTime(timezone=True), server_default=func.now())


class PlanPricing(Base):
    """Admin-editable base price per plan — overrides the PLAN_CATALOGUE
    defaults without requiring a redeploy. Seeded from PLAN_CATALOGUE on
    first read; absent rows fall back to the static catalogue values."""

    __tablename__ = "plan_pricing"

    plan = Column(Enum(BillingPlan), primary_key=True)
    monthly_aud = Column(Float)
    annual_aud = Column(Float)

    updated_by = Column(String(60))
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())
    created_at = Column(DateTime(timezone=True), server_default=func.now())


class StripePriceMapping(Base):
    """Admin-editable Stripe Price ID per (plan, interval) — overrides the
    STRIPE_*_ID env vars without requiring a redeploy. Lets an admin paste
    in Price IDs from the Stripe dashboard once a Stripe account is set up."""

    __tablename__ = "stripe_price_mappings"
    __table_args__ = (UniqueConstraint("plan", "interval", name="uq_plan_interval"),)

    id = Column(Integer, primary_key=True, index=True)
    plan = Column(Enum(BillingPlan), nullable=False, index=True)
    interval = Column(Enum(BillingInterval), nullable=False, index=True)
    stripe_price_id = Column(String(100), nullable=False)

    updated_by = Column(String(60))
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())
    created_at = Column(DateTime(timezone=True), server_default=func.now())


class SubscriptionAddon(Base):
    """Enterprise add-on purchase — gates access to partially-built/sales-gated
    providers (e.g. Elliptic, TRM Labs crypto wallet screening) independent of
    the base subscription plan."""

    __tablename__ = "subscription_addons"

    id = Column(Integer, primary_key=True, index=True)
    addon_id = Column(String(60), unique=True, index=True, nullable=False)
    org_id = Column(String(100), index=True, nullable=False)

    addon_key = Column(Enum(AddonKey), nullable=False)
    status = Column(Enum(AddonStatus), default=AddonStatus.active, nullable=False)
    price_aud = Column(Float)

    stripe_subscription_id = Column(String(100))

    purchased_at = Column(DateTime(timezone=True), server_default=func.now())
    canceled_at = Column(DateTime(timezone=True))
    created_at = Column(DateTime(timezone=True), server_default=func.now())
