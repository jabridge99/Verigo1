"""
Billing service — Stripe integration with local subscription tracking.

Environment variables:
  STRIPE_SECRET_KEY          — sk_live_… or sk_test_…
  STRIPE_WEBHOOK_SECRET      — whsec_…
  STRIPE_STARTER_MONTHLY_ID  — Stripe Price ID for starter monthly
  STRIPE_STARTER_ANNUAL_ID
  STRIPE_PRO_MONTHLY_ID
  STRIPE_PRO_ANNUAL_ID
  STRIPE_ENT_MONTHLY_ID
  STRIPE_ENT_ANNUAL_ID

When STRIPE_SECRET_KEY is not set the service operates in "mock" mode —
checkout sessions return a placeholder URL and no real charges occur.
"""

import os
import uuid
from datetime import datetime, timedelta, timezone
from typing import List, Optional

from sqlalchemy import desc
from sqlalchemy.orm import Session

from app.models.billing import (
    PLAN_CATALOGUE,
    BillingInterval,
    BillingPlan,
    Invoice,
    InvoiceStatus,
    Subscription,
    SubscriptionStatus,
)
from app.schemas.billing import CheckoutSessionRequest, SubscriptionAdminUpdate

STRIPE_KEY = os.getenv("STRIPE_SECRET_KEY", "")
WEBHOOK_SECRET = os.getenv("STRIPE_WEBHOOK_SECRET", "")
APP_URL = os.getenv("APP_URL", "http://localhost:3000")

# Stripe Price IDs (populated from env)
_PRICE_IDS = {
    (BillingPlan.starter, BillingInterval.monthly): os.getenv(
        "STRIPE_STARTER_MONTHLY_ID", ""
    ),
    (BillingPlan.starter, BillingInterval.annual): os.getenv(
        "STRIPE_STARTER_ANNUAL_ID", ""
    ),
    (BillingPlan.professional, BillingInterval.monthly): os.getenv(
        "STRIPE_PRO_MONTHLY_ID", ""
    ),
    (BillingPlan.professional, BillingInterval.annual): os.getenv(
        "STRIPE_PRO_ANNUAL_ID", ""
    ),
    (BillingPlan.enterprise, BillingInterval.monthly): os.getenv(
        "STRIPE_ENT_MONTHLY_ID", ""
    ),
    (BillingPlan.enterprise, BillingInterval.annual): os.getenv(
        "STRIPE_ENT_ANNUAL_ID", ""
    ),
}

GST_RATE = 0.10  # 10% Australian GST


def _stripe():
    if not STRIPE_KEY:
        return None
    import stripe as _stripe_lib

    _stripe_lib.api_key = STRIPE_KEY
    return _stripe_lib


def _sub_id():
    return f"SUB-{uuid.uuid4().hex[:12].upper()}"


def _inv_id():
    return f"INV-{uuid.uuid4().hex[:12].upper()}"


# ── Price resolution ───────────────────────────────────────────────────────────


def effective_price(sub: Subscription) -> float:
    """Return the effective AUD price for the current interval."""
    if sub.interval == BillingInterval.annual:
        if sub.custom_annual_aud is not None:
            return sub.custom_annual_aud
        cat = PLAN_CATALOGUE.get(sub.plan, {})
        base = cat.get("annual_aud") or 0.0
        # Apply custom discount if different from catalogue
        if sub.annual_discount_pct != 20.0 and cat.get("monthly_aud"):
            base = cat["monthly_aud"] * 12 * (1 - sub.annual_discount_pct / 100)
        return base
    else:
        if sub.custom_monthly_aud is not None:
            return sub.custom_monthly_aud
        return PLAN_CATALOGUE.get(sub.plan, {}).get("monthly_aud") or 0.0


def catalogue_with_custom(
    sub: Optional[Subscription] = None, discount_pct: float = 20.0
) -> List[dict]:
    """Return plan catalogue with annual price computed from current discount."""
    plans = []
    for plan_key, info in PLAN_CATALOGUE.items():
        entry = {
            "plan": plan_key.value,
            "name": info["name"],
            "monthly_aud": info["monthly_aud"],
            "annual_aud": info["annual_aud"],
            "annual_discount_pct": discount_pct,
            "features": info["features"],
            "limits": info["limits"],
        }
        if info["monthly_aud"] and discount_pct != 20.0:
            entry["annual_aud"] = round(
                info["monthly_aud"] * 12 * (1 - discount_pct / 100), 2
            )
        plans.append(entry)
    return plans


# ── Subscription CRUD ──────────────────────────────────────────────────────────


def get_subscription(db: Session, industry_id: str) -> Optional[Subscription]:
    return (
        db.query(Subscription)
        .filter(Subscription.industry_id == industry_id)
        .order_by(desc(Subscription.created_at))
        .first()
    )


def list_subscriptions(db: Session, limit: int = 100) -> List[Subscription]:
    return (
        db.query(Subscription)
        .order_by(desc(Subscription.created_at))
        .limit(limit)
        .all()
    )


def create_trial(
    db: Session, industry_id: str, tenant_id: Optional[str] = None
) -> Subscription:
    sub = Subscription(
        subscription_id=_sub_id(),
        industry_id=industry_id,
        tenant_id=tenant_id,
        plan=BillingPlan.free_trial,
        interval=BillingInterval.monthly,
        status=SubscriptionStatus.trialing,
        annual_discount_pct=20.0,
        trial_ends_at=datetime.now(timezone.utc) + timedelta(days=14),
    )
    db.add(sub)
    db.commit()
    db.refresh(sub)
    return sub


def admin_update(
    db: Session, industry_id: str, data: SubscriptionAdminUpdate
) -> Optional[Subscription]:
    sub = get_subscription(db, industry_id)
    if not sub:
        return None
    for field, val in data.model_dump(exclude_unset=True).items():
        setattr(sub, field, val)
    # Recompute base_price_aud after any change
    sub.base_price_aud = effective_price(sub)
    db.commit()
    db.refresh(sub)
    return sub


def cancel_subscription(
    db: Session, industry_id: str, at_period_end: bool = True
) -> Optional[Subscription]:
    sub = get_subscription(db, industry_id)
    if not sub:
        return None
    stripe = _stripe()
    if stripe and sub.stripe_subscription_id:
        try:
            stripe.Subscription.modify(
                sub.stripe_subscription_id,
                cancel_at_period_end=at_period_end,
            )
        except Exception as e:
            print(f"[stripe] cancel error: {e}")
    sub.cancel_at_period_end = at_period_end
    if not at_period_end:
        sub.status = SubscriptionStatus.canceled
        sub.canceled_at = datetime.now(timezone.utc)
    db.commit()
    db.refresh(sub)
    return sub


# ── Stripe Checkout ────────────────────────────────────────────────────────────


def create_checkout_session(
    db: Session,
    industry_id: str,
    req: CheckoutSessionRequest,
    customer_email: str,
) -> dict:
    stripe = _stripe()
    price_id = _PRICE_IDS.get((req.plan, req.interval), "")

    if not stripe or not price_id:
        # Mock mode — return placeholder
        return {
            "checkout_url": f"{APP_URL}/billing?mock_checkout=1&plan={req.plan}&interval={req.interval}",
            "session_id": f"cs_mock_{uuid.uuid4().hex[:16]}",
        }

    sub = get_subscription(db, industry_id)
    stripe_customer_id = sub.stripe_customer_id if sub else None

    # Create or reuse Stripe customer
    if not stripe_customer_id:
        customer = stripe.Customer.create(
            email=customer_email, metadata={"industry_id": industry_id}
        )
        stripe_customer_id = customer.id
        if sub:
            sub.stripe_customer_id = stripe_customer_id
            db.commit()

    session = stripe.checkout.Session.create(
        customer=stripe_customer_id,
        payment_method_types=["card"],
        line_items=[{"price": price_id, "quantity": 1}],
        mode="subscription",
        success_url=req.success_url + "?session_id={CHECKOUT_SESSION_ID}",
        cancel_url=req.cancel_url,
        metadata={
            "industry_id": industry_id,
            "plan": req.plan,
            "interval": req.interval,
        },
        tax_id_collection={"enabled": True},
        automatic_tax={"enabled": True},
    )
    return {"checkout_url": session.url, "session_id": session.id}


def create_customer_portal(db: Session, industry_id: str, return_url: str) -> str:
    stripe = _stripe()
    sub = get_subscription(db, industry_id)
    if not stripe or not (sub and sub.stripe_customer_id):
        return f"{APP_URL}/billing"

    session = stripe.billing_portal.Session.create(
        customer=sub.stripe_customer_id,
        return_url=return_url,
    )
    return session.url


# ── Stripe Webhook Handler ─────────────────────────────────────────────────────


def handle_stripe_webhook(db: Session, payload: bytes, sig_header: str) -> dict:
    stripe = _stripe()
    if not stripe:
        return {"status": "mock"}

    try:
        event = stripe.Webhook.construct_event(payload, sig_header, WEBHOOK_SECRET)
    except Exception as e:
        raise ValueError(f"Webhook signature invalid: {e}")

    etype = event["type"]
    obj = event["data"]["object"]

    if etype == "checkout.session.completed":
        _handle_checkout_completed(db, obj)
    elif etype in ("customer.subscription.updated", "customer.subscription.created"):
        _handle_subscription_updated(db, obj)
    elif etype == "customer.subscription.deleted":
        _handle_subscription_deleted(db, obj)
    elif etype in ("invoice.paid", "invoice.payment_failed", "invoice.finalized"):
        _handle_invoice_event(db, obj, etype)

    return {"status": "ok", "event": etype}


def _handle_checkout_completed(db: Session, session: dict):
    industry_id = session.get("metadata", {}).get("industry_id")
    plan_str = session.get("metadata", {}).get("plan", "starter")
    interval_str = session.get("metadata", {}).get("interval", "monthly")
    if not industry_id:
        return

    sub = get_subscription(db, industry_id)
    if not sub:
        sub = Subscription(
            subscription_id=_sub_id(),
            industry_id=industry_id,
            annual_discount_pct=20.0,
        )
        db.add(sub)

    sub.plan = BillingPlan(plan_str)
    sub.interval = BillingInterval(interval_str)
    sub.status = SubscriptionStatus.active
    sub.stripe_customer_id = session.get("customer")
    sub.stripe_subscription_id = session.get("subscription")
    sub.base_price_aud = effective_price(sub)
    db.commit()


def _handle_subscription_updated(db: Session, stripe_sub: dict):
    stripe_id = stripe_sub["id"]
    sub = (
        db.query(Subscription)
        .filter(Subscription.stripe_subscription_id == stripe_id)
        .first()
    )
    if not sub:
        return
    status_map = {
        "active": SubscriptionStatus.active,
        "trialing": SubscriptionStatus.trialing,
        "past_due": SubscriptionStatus.past_due,
        "canceled": SubscriptionStatus.canceled,
        "unpaid": SubscriptionStatus.unpaid,
        "incomplete": SubscriptionStatus.incomplete,
        "paused": SubscriptionStatus.paused,
    }
    sub.status = status_map.get(stripe_sub.get("status", ""), SubscriptionStatus.active)
    sub.cancel_at_period_end = stripe_sub.get("cancel_at_period_end", False)
    if stripe_sub.get("current_period_start"):
        sub.current_period_start = datetime.fromtimestamp(
            stripe_sub["current_period_start"], tz=timezone.utc
        )
    if stripe_sub.get("current_period_end"):
        sub.current_period_end = datetime.fromtimestamp(
            stripe_sub["current_period_end"], tz=timezone.utc
        )
    db.commit()


def _handle_subscription_deleted(db: Session, stripe_sub: dict):
    sub = (
        db.query(Subscription)
        .filter(Subscription.stripe_subscription_id == stripe_sub["id"])
        .first()
    )
    if sub:
        sub.status = SubscriptionStatus.canceled
        sub.canceled_at = datetime.now(timezone.utc)
        db.commit()


def _handle_invoice_event(db: Session, inv_obj: dict, etype: str):
    stripe_inv_id = inv_obj.get("id")
    existing = (
        db.query(Invoice).filter(Invoice.stripe_invoice_id == stripe_inv_id).first()
    )

    amount = (inv_obj.get("amount_due", 0) or 0) / 100
    total = (inv_obj.get("amount_due", 0) or 0) / 100
    tax = (inv_obj.get("tax", 0) or 0) / 100

    status_map = {
        "invoice.paid": InvoiceStatus.paid,
        "invoice.payment_failed": InvoiceStatus.uncollectible,
        "invoice.finalized": InvoiceStatus.open,
    }
    status = status_map.get(etype, InvoiceStatus.open)

    if not existing:
        # Find subscription by stripe customer
        stripe_sub_id = inv_obj.get("subscription")
        sub = (
            db.query(Subscription)
            .filter(Subscription.stripe_subscription_id == stripe_sub_id)
            .first()
        )
        inv = Invoice(
            invoice_id=_inv_id(),
            subscription_id=sub.subscription_id if sub else None,
            industry_id=sub.industry_id if sub else None,
            stripe_invoice_id=stripe_inv_id,
            amount_aud=amount,
            tax_aud=tax,
            total_aud=total,
            status=status,
            stripe_hosted_url=inv_obj.get("hosted_invoice_url"),
            stripe_pdf_url=inv_obj.get("invoice_pdf"),
        )
        if inv_obj.get("period_start"):
            inv.period_start = datetime.fromtimestamp(
                inv_obj["period_start"], tz=timezone.utc
            )
        if inv_obj.get("period_end"):
            inv.period_end = datetime.fromtimestamp(
                inv_obj["period_end"], tz=timezone.utc
            )
        db.add(inv)
    else:
        existing.status = status
        if etype == "invoice.paid":
            existing.paid_at = datetime.now(timezone.utc)
    db.commit()


# ── Invoice queries ────────────────────────────────────────────────────────────


def list_invoices(db: Session, industry_id: str, limit: int = 20) -> List[Invoice]:
    return (
        db.query(Invoice)
        .filter(Invoice.industry_id == industry_id)
        .order_by(desc(Invoice.created_at))
        .limit(limit)
        .all()
    )
