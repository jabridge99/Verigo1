from datetime import datetime
from typing import List, Optional

from pydantic import BaseModel

from app.models.billing import (
    BillingInterval,
    BillingPlan,
    InvoiceStatus,
    SubscriptionStatus,
)


class SubscriptionResponse(BaseModel):
    id: int
    subscription_id: str
    industry_id: str
    plan: BillingPlan
    interval: BillingInterval
    status: SubscriptionStatus
    base_price_aud: Optional[float] = None
    custom_monthly_aud: Optional[float] = None
    custom_annual_aud: Optional[float] = None
    annual_discount_pct: float
    stripe_customer_id: Optional[str] = None
    stripe_subscription_id: Optional[str] = None
    trial_ends_at: Optional[datetime] = None
    current_period_start: Optional[datetime] = None
    current_period_end: Optional[datetime] = None
    cancel_at_period_end: bool
    notes: Optional[str] = None
    created_at: Optional[datetime] = None

    model_config = {"from_attributes": True}


class SubscriptionCreate(BaseModel):
    industry_id: str
    plan: BillingPlan
    interval: BillingInterval = BillingInterval.monthly


class SubscriptionAdminUpdate(BaseModel):
    """Admin/VVIP price override and plan management."""
    plan: Optional[BillingPlan] = None
    interval: Optional[BillingInterval] = None
    status: Optional[SubscriptionStatus] = None
    custom_monthly_aud: Optional[float] = None
    custom_annual_aud: Optional[float] = None
    annual_discount_pct: Optional[float] = None   # e.g. 30 for 30%
    notes: Optional[str] = None


class CheckoutSessionRequest(BaseModel):
    plan: BillingPlan
    interval: BillingInterval
    success_url: str
    cancel_url: str


class CheckoutSessionResponse(BaseModel):
    checkout_url: str
    session_id: str


class CustomerPortalResponse(BaseModel):
    portal_url: str


class InvoiceResponse(BaseModel):
    id: int
    invoice_id: str
    subscription_id: Optional[str] = None
    amount_aud: float
    tax_aud: float
    total_aud: float
    status: InvoiceStatus
    description: Optional[str] = None
    period_start: Optional[datetime] = None
    period_end: Optional[datetime] = None
    due_date: Optional[datetime] = None
    paid_at: Optional[datetime] = None
    stripe_hosted_url: Optional[str] = None
    stripe_pdf_url: Optional[str] = None
    created_at: Optional[datetime] = None

    model_config = {"from_attributes": True}


class PlanInfo(BaseModel):
    plan: str
    name: str
    monthly_aud: Optional[float]
    annual_aud: Optional[float]
    annual_discount_pct: float
    features: List[str]
    limits: dict
