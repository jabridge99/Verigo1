"""
Billing & Subscription endpoints.

POST /billing/checkout          — create Stripe Checkout session
GET  /billing/portal            — Stripe customer portal redirect
POST /billing/webhook           — Stripe webhook (unauthenticated, verified by sig)
GET  /billing/plans             — public plan catalogue
GET  /billing/subscription      — current user's subscription
POST /billing/subscription/cancel
GET  /billing/invoices
PATCH /billing/admin/{industry_id}  — admin: VVIP / price override
GET  /billing/admin/all         — admin: list all subscriptions
GET  /billing/admin/features    — admin: plan x feature toggle matrix
PATCH /billing/admin/features/{plan}/{feature_code} — admin: toggle a feature for a plan
POST /billing/admin/{industry_id}/activate   — admin: turn a plan on (e.g. Enterprise)
POST /billing/admin/{industry_id}/terminate  — admin: terminate a plan immediately
GET  /billing/admin/pricing                  — admin: editable base plan prices
PATCH /billing/admin/pricing/{plan}          — admin: edit a plan's base price
GET  /billing/admin/stripe/status            — admin: Stripe gateway config status
GET  /billing/admin/stripe/prices            — admin: Stripe Price ID per plan/interval
PUT  /billing/admin/stripe/prices/{plan}/{interval} — admin: set a Stripe Price ID
"""

from datetime import datetime
from typing import List

from fastapi import APIRouter, Depends, HTTPException, Query, Request
from sqlalchemy.orm import Session

from app.api.routes.auth import _current_user, _require_roles
from app.db.database import get_db
from app.models.billing import AddonKey, BillingInterval, BillingPlan
from app.models.user import User, UserRole
from app.schemas.billing import (
    AddonResponse,
    CheckoutSessionRequest,
    CheckoutSessionResponse,
    CustomerPortalResponse,
    FeatureToggleRow,
    FeatureToggleUpdate,
    InvoiceResponse,
    PlanPricingResponse,
    PlanPricingUpdate,
    StripePriceMappingResponse,
    StripePriceMappingUpdate,
    StripeStatusResponse,
    SubscriptionAdminUpdate,
    SubscriptionResponse,
)
from app.services import billing_service as svc
from app.services import usage_billing_service as usage_billing_svc

router = APIRouter(prefix="/billing", tags=["billing"])

_ADMIN = _require_roles(UserRole.admin)


# ── Public ────────────────────────────────────────────────────────────────────


@router.get("/plans")
def list_plans(
    discount_pct: float = Query(20.0, ge=0, le=100), db: Session = Depends(get_db)
):
    """Public — returns plan catalogue, with annual price recalculated for the given discount."""
    return svc.catalogue_with_custom(db, discount_pct=discount_pct)


# ── Authenticated user routes ─────────────────────────────────────────────────


@router.get("/subscription", response_model=SubscriptionResponse)
def my_subscription(
    db: Session = Depends(get_db),
    current_user: User = Depends(_current_user),
):
    org_id = getattr(current_user, "primary_organisation_id", None)
    sub = svc.get_subscription(db, current_user.org_id or "", org_id)
    if not sub:
        # Auto-create a trial for new tenants
        if current_user.org_id:
            sub = svc.create_trial(
                db,
                current_user.org_id,
                current_user.tenant_id if hasattr(current_user, "tenant_id") else None,
                org_id,
            )
        else:
            raise HTTPException(404, "No subscription found")
    return sub


@router.post("/checkout", response_model=CheckoutSessionResponse)
def create_checkout(
    req: CheckoutSessionRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(_current_user),
):
    if not current_user.org_id:
        raise HTTPException(400, "User has no industry_id")
    result = svc.create_checkout_session(
        db,
        current_user.org_id,
        req,
        current_user.email,
        getattr(current_user, "primary_organisation_id", None),
    )
    return result


@router.get("/portal", response_model=CustomerPortalResponse)
def customer_portal(
    return_url: str = Query(default=""),
    db: Session = Depends(get_db),
    current_user: User = Depends(_current_user),
):
    if not current_user.org_id:
        raise HTTPException(400, "User has no industry_id")
    url = svc.create_customer_portal(
        db,
        current_user.org_id,
        return_url or f"{svc.APP_URL}/billing",
        getattr(current_user, "primary_organisation_id", None),
    )
    return {"portal_url": url}


@router.post("/subscription/cancel", response_model=SubscriptionResponse)
def cancel_subscription(
    at_period_end: bool = Query(True),
    db: Session = Depends(get_db),
    current_user: User = Depends(_current_user),
):
    sub = svc.cancel_subscription(
        db,
        current_user.org_id or "",
        at_period_end,
        getattr(current_user, "primary_organisation_id", None),
    )
    if not sub:
        raise HTTPException(404, "Subscription not found")
    return sub


@router.get("/invoices", response_model=List[InvoiceResponse])
def list_invoices(
    limit: int = Query(20, ge=1, le=100),
    db: Session = Depends(get_db),
    current_user: User = Depends(_current_user),
):
    return svc.list_invoices(
        db,
        current_user.org_id or "",
        limit,
        getattr(current_user, "primary_organisation_id", None),
    )


@router.get("/addons")
def list_addon_catalogue():
    """Public — Enterprise add-on catalogue. Add-ons unlock providers that are
    partially built or sales-gated (e.g. Elliptic/TRM Labs crypto screening)."""
    return svc.addon_catalogue()


@router.get("/addons/mine", response_model=List[AddonResponse])
def my_addons(
    db: Session = Depends(get_db),
    current_user: User = Depends(_current_user),
):
    return svc.get_org_addons(db, current_user.org_id or "")


@router.post("/addons/{addon_key}/purchase", response_model=AddonResponse)
def purchase_addon(
    addon_key: AddonKey,
    db: Session = Depends(get_db),
    current_user: User = Depends(_current_user),
):
    if not current_user.org_id:
        raise HTTPException(400, "User has no org_id")
    try:
        return svc.purchase_addon(db, current_user.org_id, addon_key)
    except ValueError as e:
        raise HTTPException(402, str(e))


@router.post("/addons/{addon_key}/cancel", response_model=AddonResponse)
def cancel_addon(
    addon_key: AddonKey,
    db: Session = Depends(get_db),
    current_user: User = Depends(_current_user),
):
    addon = svc.cancel_addon(db, current_user.org_id or "", addon_key)
    if not addon:
        raise HTTPException(404, "Add-on not found")
    return addon


@router.get("/usage")
def usage(
    period_start: datetime,
    period_end: datetime,
    db: Session = Depends(get_db),
    current_user: User = Depends(_current_user),
):
    """Metered third-party verification usage (e.g. Sumsub checks) and the
    marked-up amount billed to this org for the given period."""
    return usage_billing_svc.usage_summary(
        db, current_user.org_id or "", period_start, period_end
    )


# ── Stripe Webhook (no auth — verified by signature) ──────────────────────────


@router.post("/webhook", status_code=200)
async def stripe_webhook(request: Request, db: Session = Depends(get_db)):
    payload = await request.body()
    sig_header = request.headers.get("stripe-signature", "")
    try:
        result = svc.handle_stripe_webhook(db, payload, sig_header)
        return result
    except ValueError as e:
        raise HTTPException(400, str(e))


# ── Admin routes ──────────────────────────────────────────────────────────────


@router.get("/admin/all", response_model=List[SubscriptionResponse])
def admin_list_all(
    limit: int = Query(100),
    db: Session = Depends(get_db),
    current_user: User = Depends(_ADMIN),
):
    return svc.list_subscriptions(db, limit)


@router.patch("/admin/{industry_id}", response_model=SubscriptionResponse)
def admin_update_subscription(
    industry_id: str,
    data: SubscriptionAdminUpdate,
    organisation_id: str = Query(None),
    db: Session = Depends(get_db),
    current_user: User = Depends(_ADMIN),
):
    """
    Admin override — change plan, apply VVIP custom pricing, adjust annual discount,
    or add notes about deal terms. Pass organisation_id to target a specific
    organisation when more than one shares the same industry_id.
    """
    sub = svc.admin_update(db, industry_id, data, organisation_id)
    if not sub:
        # Create one if it doesn't exist yet
        svc.create_trial(db, industry_id, organisation_id=organisation_id)
        sub = svc.admin_update(db, industry_id, data, organisation_id)
    return sub


@router.post("/admin/{industry_id}/trial", response_model=SubscriptionResponse)
def admin_create_trial(
    industry_id: str,
    organisation_id: str = Query(None),
    db: Session = Depends(get_db),
    current_user: User = Depends(_ADMIN),
):
    existing = svc.get_subscription(db, industry_id, organisation_id)
    if existing:
        return existing
    return svc.create_trial(db, industry_id, organisation_id=organisation_id)


@router.post("/admin/{industry_id}/activate", response_model=SubscriptionResponse)
def admin_activate_subscription(
    industry_id: str,
    organisation_id: str = Query(None),
    db: Session = Depends(get_db),
    current_user: User = Depends(_ADMIN),
):
    """Manually turn a plan on — primarily for Enterprise/VVIP deals managed
    outside of Stripe checkout."""
    sub = svc.activate_subscription(db, industry_id, organisation_id)
    if not sub:
        raise HTTPException(404, "Subscription not found")
    return sub


@router.post("/admin/{industry_id}/terminate", response_model=SubscriptionResponse)
def admin_terminate_subscription(
    industry_id: str,
    organisation_id: str = Query(None),
    db: Session = Depends(get_db),
    current_user: User = Depends(_ADMIN),
):
    """Manually terminate a plan immediately, bypassing cancel-at-period-end."""
    sub = svc.terminate_subscription(db, industry_id, organisation_id)
    if not sub:
        raise HTTPException(404, "Subscription not found")
    return sub


# ── Admin: feature toggle matrix ───────────────────────────────────────────────


@router.get("/admin/features", response_model=List[FeatureToggleRow])
def admin_feature_matrix(
    db: Session = Depends(get_db),
    current_user: User = Depends(_ADMIN),
):
    return svc.feature_matrix(db)


@router.patch("/admin/features/{plan}/{feature_code}", response_model=FeatureToggleRow)
def admin_toggle_feature(
    plan: BillingPlan,
    feature_code: str,
    data: FeatureToggleUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(_ADMIN),
):
    if feature_code not in svc.FEATURE_DEFINITIONS:
        raise HTTPException(404, "Unknown feature code")
    svc.set_plan_feature(db, plan, feature_code, data.enabled)
    rows = svc.feature_matrix(db)
    return next(r for r in rows if r["code"] == feature_code)


# ── Admin: editable plan pricing ───────────────────────────────────────────────


@router.get("/admin/pricing", response_model=List[PlanPricingResponse])
def admin_list_pricing(
    db: Session = Depends(get_db),
    current_user: User = Depends(_ADMIN),
):
    """Base plan prices — admin-edited rows override the static catalogue
    defaults without a redeploy."""
    return svc.list_plan_pricing(db)


@router.patch("/admin/pricing/{plan}", response_model=PlanPricingResponse)
def admin_update_pricing(
    plan: BillingPlan,
    data: PlanPricingUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(_ADMIN),
):
    return svc.update_plan_pricing(
        db, plan, data.monthly_aud, data.annual_aud, current_user.email
    )


# ── Admin: Stripe gateway configuration ────────────────────────────────────────


@router.get("/admin/stripe/status", response_model=StripeStatusResponse)
def admin_stripe_status(current_user: User = Depends(_ADMIN)):
    """Whether STRIPE_SECRET_KEY / STRIPE_WEBHOOK_SECRET are set, and in
    which mode (test/live). Never exposes the key values themselves."""
    return svc.stripe_status()


@router.get("/admin/stripe/prices", response_model=List[StripePriceMappingResponse])
def admin_list_stripe_prices(
    db: Session = Depends(get_db),
    current_user: User = Depends(_ADMIN),
):
    """Stripe Price ID per (plan, interval) — admin-edited rows override the
    STRIPE_*_ID env vars, so Price IDs can be pasted in from the Stripe
    dashboard without a redeploy."""
    return svc.list_stripe_price_mappings(db)


@router.put(
    "/admin/stripe/prices/{plan}/{interval}",
    response_model=StripePriceMappingResponse,
)
def admin_set_stripe_price(
    plan: BillingPlan,
    interval: BillingInterval,
    data: StripePriceMappingUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(_ADMIN),
):
    return svc.set_stripe_price_id(
        db, plan, interval, data.stripe_price_id, current_user.email
    )
