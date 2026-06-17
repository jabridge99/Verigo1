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
"""

from typing import List

from fastapi import APIRouter, Depends, HTTPException, Query, Request
from sqlalchemy.orm import Session

from app.api.routes.auth import _current_user, _require_roles
from app.db.database import get_db
from app.models.user import User, UserRole
from app.schemas.billing import (
    CheckoutSessionRequest,
    CheckoutSessionResponse,
    CustomerPortalResponse,
    InvoiceResponse,
    SubscriptionAdminUpdate,
    SubscriptionResponse,
)
from app.services import billing_service as svc

router = APIRouter(prefix="/billing", tags=["billing"])

_ADMIN = _require_roles(UserRole.admin)


# ── Public ────────────────────────────────────────────────────────────────────


@router.get("/plans")
def list_plans(discount_pct: float = Query(20.0, ge=0, le=100)):
    """Public — returns plan catalogue, with annual price recalculated for the given discount."""
    return svc.catalogue_with_custom(discount_pct=discount_pct)


# ── Authenticated user routes ─────────────────────────────────────────────────


@router.get("/subscription", response_model=SubscriptionResponse)
def my_subscription(
    db: Session = Depends(get_db),
    current_user: User = Depends(_current_user),
):
    org_id = getattr(current_user, "primary_organisation_id", None)
    sub = svc.get_subscription(db, current_user.industry_id or "", org_id)
    if not sub:
        # Auto-create a trial for new tenants
        if current_user.industry_id:
            sub = svc.create_trial(
                db,
                current_user.industry_id,
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
    if not current_user.industry_id:
        raise HTTPException(400, "User has no industry_id")
    result = svc.create_checkout_session(
        db,
        current_user.industry_id,
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
    if not current_user.industry_id:
        raise HTTPException(400, "User has no industry_id")
    url = svc.create_customer_portal(
        db,
        current_user.industry_id,
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
    org_id = getattr(current_user, "primary_organisation_id", None)
    sub = svc.cancel_subscription(db, current_user.industry_id or "", at_period_end, org_id)
    if not sub:
        raise HTTPException(404, "Subscription not found")
    return sub


@router.get("/invoices", response_model=List[InvoiceResponse])
def list_invoices(
    limit: int = Query(20, ge=1, le=100),
    db: Session = Depends(get_db),
    current_user: User = Depends(_current_user),
):
    org_id = getattr(current_user, "primary_organisation_id", None)
    return svc.list_invoices(db, current_user.industry_id or "", limit, org_id)


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
    organisation_id: int = Query(None),
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
    organisation_id: int = Query(None),
    db: Session = Depends(get_db),
    current_user: User = Depends(_ADMIN),
):
    existing = svc.get_subscription(db, industry_id, organisation_id)
    if existing:
        return existing
    return svc.create_trial(db, industry_id, organisation_id=organisation_id)
