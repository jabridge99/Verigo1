from sqlalchemy import Column, String, Integer, Float, Boolean, DateTime, Enum, JSON, Text, BigInteger
from sqlalchemy.sql import func
import enum
from app.db.database import Base


class BillingPlan(str, enum.Enum):
    starter      = "starter"       # $299/mo
    professional = "professional"  # $799/mo
    enterprise   = "enterprise"    # $1,999/mo
    vvip         = "vvip"          # custom pricing
    free_trial   = "free_trial"


class BillingInterval(str, enum.Enum):
    monthly = "monthly"
    annual  = "annual"   # 20% discount


class SubscriptionStatus(str, enum.Enum):
    active            = "active"
    trialing          = "trialing"
    past_due          = "past_due"
    canceled          = "canceled"
    unpaid            = "unpaid"
    incomplete        = "incomplete"
    paused            = "paused"


class InvoiceStatus(str, enum.Enum):
    draft    = "draft"
    open     = "open"
    paid     = "paid"
    void     = "void"
    uncollectible = "uncollectible"


# ── Published plan catalogue ───────────────────────────────────────────────────

PLAN_CATALOGUE = {
    BillingPlan.starter: {
        "name": "Starter",
        "monthly_aud": 299.00,
        "annual_aud":  2_870.40,   # 299 * 12 * 0.80 (20% off)
        "features": [
            "Up to 500 customers",
            "AML transaction monitoring",
            "KYC/KYB onboarding",
            "AUSTRAC TTR & IFTI reporting",
            "Email notifications",
            "Standard support",
        ],
        "limits": {"customers": 500, "users": 5, "api_calls_month": 10_000},
    },
    BillingPlan.professional: {
        "name": "Professional",
        "monthly_aud": 799.00,
        "annual_aud":  7_670.40,
        "features": [
            "Up to 5,000 customers",
            "Advanced rule builder",
            "ECDD assessments",
            "MLRO case management",
            "Webhooks & API access",
            "Document vault (50 GB)",
            "Analytics dashboard",
            "Priority support",
        ],
        "limits": {"customers": 5_000, "users": 25, "api_calls_month": 100_000},
    },
    BillingPlan.enterprise: {
        "name": "Enterprise",
        "monthly_aud": 1_999.00,
        "annual_aud":  19_190.40,
        "features": [
            "Unlimited customers",
            "White-label branding",
            "Custom domain",
            "Multi-tenant management",
            "Dedicated MLRO support",
            "Document vault (500 GB)",
            "SLA 99.9% uptime",
            "Dedicated account manager",
        ],
        "limits": {"customers": -1, "users": -1, "api_calls_month": -1},
    },
    BillingPlan.vvip: {
        "name": "VVIP",
        "monthly_aud": None,   # custom per tenant
        "annual_aud":  None,
        "features": ["Everything in Enterprise", "Custom SLA", "On-site training", "Regulatory liaison support", "Custom integrations"],
        "limits": {"customers": -1, "users": -1, "api_calls_month": -1},
    },
}


# ── Models ─────────────────────────────────────────────────────────────────────

class Subscription(Base):
    __tablename__ = "subscriptions"

    id                    = Column(Integer, primary_key=True, index=True)
    subscription_id       = Column(String(60), unique=True, index=True, nullable=False)

    # Tenant link
    industry_id           = Column(String(100), index=True, nullable=False)
    tenant_id             = Column(String(60))

    # Plan
    plan                  = Column(Enum(BillingPlan), default=BillingPlan.free_trial)
    interval              = Column(Enum(BillingInterval), default=BillingInterval.monthly)
    status                = Column(Enum(SubscriptionStatus), default=SubscriptionStatus.trialing)

    # Pricing — base catalogue price
    base_price_aud        = Column(Float)
    # VVIP / admin override (takes precedence over catalogue)
    custom_monthly_aud    = Column(Float)
    custom_annual_aud     = Column(Float)
    annual_discount_pct   = Column(Float, default=20.0)  # editable annual discount

    # Stripe
    stripe_customer_id    = Column(String(100))
    stripe_subscription_id = Column(String(100))
    stripe_price_id       = Column(String(100))

    # Lifecycle
    trial_ends_at         = Column(DateTime(timezone=True))
    current_period_start  = Column(DateTime(timezone=True))
    current_period_end    = Column(DateTime(timezone=True))
    canceled_at           = Column(DateTime(timezone=True))
    cancel_at_period_end  = Column(Boolean, default=False)

    # Metadata
    notes                 = Column(Text)    # admin notes (VVIP deal terms etc.)
    metadata              = Column(JSON, default=dict)

    created_at            = Column(DateTime(timezone=True), server_default=func.now())
    updated_at            = Column(DateTime(timezone=True), onupdate=func.now())


class Invoice(Base):
    __tablename__ = "invoices"

    id               = Column(Integer, primary_key=True, index=True)
    invoice_id       = Column(String(60), unique=True, index=True, nullable=False)
    subscription_id  = Column(String(60), index=True)
    industry_id      = Column(String(100), index=True)

    stripe_invoice_id = Column(String(100))
    amount_aud        = Column(Float, nullable=False)
    tax_aud           = Column(Float, default=0.0)
    total_aud         = Column(Float, nullable=False)

    status            = Column(Enum(InvoiceStatus), default=InvoiceStatus.open)
    description       = Column(Text)
    period_start      = Column(DateTime(timezone=True))
    period_end        = Column(DateTime(timezone=True))
    due_date          = Column(DateTime(timezone=True))
    paid_at           = Column(DateTime(timezone=True))

    stripe_hosted_url = Column(String(500))
    stripe_pdf_url    = Column(String(500))

    created_at        = Column(DateTime(timezone=True), server_default=func.now())
