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

from sqlalchemy import desc, or_
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.models.billing import (
    ADDON_CATALOGUE,
    DEFAULT_PLAN_FEATURES,
    FEATURE_DEFINITIONS,
    PLAN_CATALOGUE,
    AddonKey,
    AddonStatus,
    BillingInterval,
    BillingPlan,
    Feature,
    Invoice,
    InvoiceStatus,
    PlanFeatureToggle,
    PlanPricing,
    StripePriceMapping,
    Subscription,
    SubscriptionAddon,
    SubscriptionStatus,
)
from app.schemas.billing import CheckoutSessionRequest, SubscriptionAdminUpdate

STRIPE_KEY = os.getenv("STRIPE_SECRET_KEY", "")
WEBHOOK_SECRET = os.getenv("STRIPE_WEBHOOK_SECRET", "")
APP_URL = os.getenv("APP_URL", "http://localhost:3000")

# Stripe Price IDs — env vars are the fallback/seed; admin-edited rows in
# StripePriceMapping (see get_stripe_price_id/set_stripe_price_id below)
# take precedence so Price IDs can be pasted in from the Stripe dashboard
# without a redeploy.
_ENV_PRICE_IDS = {
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


def stripe_status() -> dict:
    """Whether the Stripe gateway is configured, for an admin status panel.
    Never returns the key itself — only whether one is present and its mode."""
    return {
        "configured": bool(STRIPE_KEY),
        "mode": "live"
        if STRIPE_KEY.startswith("sk_live_")
        else ("test" if STRIPE_KEY else None),
        "webhook_secret_configured": bool(WEBHOOK_SECRET),
    }


# ── Plan pricing (admin-editable) ──────────────────────────────────────────────


def get_plan_pricing(db: Session, plan: BillingPlan) -> dict:
    """Effective base price for a plan — DB override if present, else the
    static PLAN_CATALOGUE default. Each field falls back independently, so
    overriding only monthly_aud doesn't blank out annual_aud."""
    row = db.query(PlanPricing).filter(PlanPricing.plan == plan).first()
    cat = PLAN_CATALOGUE.get(plan, {})
    return {
        "plan": plan.value,
        "monthly_aud": (row.monthly_aud if row else None) or cat.get("monthly_aud"),
        "annual_aud": (row.annual_aud if row else None) or cat.get("annual_aud"),
    }


def list_plan_pricing(db: Session) -> List[dict]:
    return [get_plan_pricing(db, plan) for plan in PLAN_CATALOGUE]


def update_plan_pricing(
    db: Session,
    plan: BillingPlan,
    monthly_aud: Optional[float],
    annual_aud: Optional[float],
    updated_by: Optional[str] = None,
) -> dict:
    row = db.query(PlanPricing).filter(PlanPricing.plan == plan).first()
    if not row:
        row = PlanPricing(plan=plan)
        db.add(row)
    if monthly_aud is not None:
        row.monthly_aud = monthly_aud
    if annual_aud is not None:
        row.annual_aud = annual_aud
    row.updated_by = updated_by
    db.commit()
    return get_plan_pricing(db, plan)


# ── Stripe Price ID mapping (admin-editable) ───────────────────────────────────


def get_stripe_price_id(
    db: Session, plan: BillingPlan, interval: BillingInterval
) -> str:
    row = (
        db.query(StripePriceMapping)
        .filter(
            StripePriceMapping.plan == plan, StripePriceMapping.interval == interval
        )
        .first()
    )
    if row and row.stripe_price_id:
        return row.stripe_price_id
    return _ENV_PRICE_IDS.get((plan, interval), "")


def list_stripe_price_mappings(db: Session) -> List[dict]:
    rows = {
        (r.plan, r.interval): r.stripe_price_id for r in db.query(StripePriceMapping)
    }
    out = []
    for plan in BillingPlan:
        for interval in BillingInterval:
            price_id = rows.get((plan, interval)) or _ENV_PRICE_IDS.get(
                (plan, interval), ""
            )
            out.append(
                {
                    "plan": plan.value,
                    "interval": interval.value,
                    "stripe_price_id": price_id,
                    "source": "admin" if (plan, interval) in rows else "env",
                }
            )
    return out


def set_stripe_price_id(
    db: Session,
    plan: BillingPlan,
    interval: BillingInterval,
    stripe_price_id: str,
    updated_by: Optional[str] = None,
) -> dict:
    row = (
        db.query(StripePriceMapping)
        .filter(
            StripePriceMapping.plan == plan, StripePriceMapping.interval == interval
        )
        .first()
    )
    if not row:
        row = StripePriceMapping(plan=plan, interval=interval)
        db.add(row)
    row.stripe_price_id = stripe_price_id
    row.updated_by = updated_by
    db.commit()
    return {
        "plan": plan.value,
        "interval": interval.value,
        "stripe_price_id": stripe_price_id,
        "source": "admin",
    }


def _sub_id():
    return f"SUB-{uuid.uuid4().hex[:12].upper()}"


def _inv_id():
    return f"INV-{uuid.uuid4().hex[:12].upper()}"


def _addon_id():
    return f"ADDON-{uuid.uuid4().hex[:12].upper()}"


# ── Feature catalogue & per-plan toggles ───────────────────────────────────────


def seed_feature_catalog(db: Session) -> None:
    """Idempotently seed the Feature catalogue and default per-plan toggles."""
    existing_codes = {f.code for f in db.query(Feature).all()}
    for code, (name, category) in FEATURE_DEFINITIONS.items():
        if code not in existing_codes:
            db.add(Feature(code=code, name=name, category=category))
    try:
        db.commit()
    except IntegrityError:
        # Another worker won the race to insert these features first.
        db.rollback()

    existing_toggles = {
        (t.plan, t.feature_code) for t in db.query(PlanFeatureToggle).all()
    }
    for plan, codes in DEFAULT_PLAN_FEATURES.items():
        for code in FEATURE_DEFINITIONS:
            key = (plan, code)
            if key in existing_toggles:
                continue
            db.add(
                PlanFeatureToggle(
                    plan=plan,
                    feature_code=code,
                    enabled=code in codes,
                )
            )
    try:
        db.commit()
    except IntegrityError:
        # Another worker won the race to insert these toggles first.
        db.rollback()


def feature_matrix(db: Session) -> List[dict]:
    """Return the full feature x plan toggle matrix for the admin UI."""
    seed_feature_catalog(db)
    toggles = db.query(PlanFeatureToggle).all()
    by_code: dict = {}
    for t in toggles:
        by_code.setdefault(t.feature_code, {})[t.plan.value] = t.enabled

    rows = []
    for code, (name, category) in FEATURE_DEFINITIONS.items():
        rows.append(
            {
                "code": code,
                "name": name,
                "category": category,
                "plans": by_code.get(code, {}),
            }
        )
    return rows


def set_plan_feature(
    db: Session, plan: BillingPlan, feature_code: str, enabled: bool
) -> PlanFeatureToggle:
    seed_feature_catalog(db)
    toggle = (
        db.query(PlanFeatureToggle)
        .filter(
            PlanFeatureToggle.plan == plan,
            PlanFeatureToggle.feature_code == feature_code,
        )
        .first()
    )
    if not toggle:
        toggle = PlanFeatureToggle(
            plan=plan, feature_code=feature_code, enabled=enabled
        )
        db.add(toggle)
    else:
        toggle.enabled = enabled
    db.commit()
    db.refresh(toggle)
    return toggle


def enabled_features_for_plan(db: Session, plan: BillingPlan) -> List[str]:
    seed_feature_catalog(db)
    toggles = (
        db.query(PlanFeatureToggle)
        .filter(PlanFeatureToggle.plan == plan, PlanFeatureToggle.enabled.is_(True))
        .all()
    )
    return [
        FEATURE_DEFINITIONS[t.feature_code][0]
        for t in toggles
        if t.feature_code in FEATURE_DEFINITIONS
    ]


def is_feature_enabled(db: Session, plan: BillingPlan, feature_code: str) -> bool:
    seed_feature_catalog(db)
    toggle = (
        db.query(PlanFeatureToggle)
        .filter(
            PlanFeatureToggle.plan == plan,
            PlanFeatureToggle.feature_code == feature_code,
        )
        .first()
    )
    return bool(toggle and toggle.enabled)


def current_plan(
    db: Session, industry_id: str, organisation_id: Optional[str] = None
) -> BillingPlan:
    """Best-effort plan lookup for feature gating. No subscription yet ==
    treat as free_trial (most restrictive) rather than granting full access."""
    sub = get_subscription(db, industry_id, organisation_id)
    return sub.plan if sub else BillingPlan.free_trial


_INACTIVE_STATUSES = {
    SubscriptionStatus.canceled,
    SubscriptionStatus.unpaid,
    SubscriptionStatus.paused,
    SubscriptionStatus.incomplete,
}


def is_active_subscriber(
    db: Session, industry_id: str, organisation_id: Optional[str] = None
) -> bool:
    """Whether the org currently has a live (non-canceled) subscription.
    Used to gate retention features like full version history — once a
    subscription lapses, access narrows to the latest version only."""
    sub = get_subscription(db, industry_id, organisation_id)
    return bool(sub and sub.status not in _INACTIVE_STATUSES)


# ── Price resolution ───────────────────────────────────────────────────────────


def effective_price(sub: Subscription, db: Optional[Session] = None) -> float:
    """Return the effective AUD price for the current interval. Admin-edited
    PlanPricing rows (if a db session is given) take precedence over the
    static PLAN_CATALOGUE defaults."""
    pricing = (
        get_plan_pricing(db, sub.plan)
        if db is not None
        else PLAN_CATALOGUE.get(sub.plan, {})
    )
    if sub.interval == BillingInterval.annual:
        if sub.custom_annual_aud is not None:
            return sub.custom_annual_aud
        base = pricing.get("annual_aud") or 0.0
        # Apply custom discount if different from catalogue
        if sub.annual_discount_pct != 20.0 and pricing.get("monthly_aud"):
            base = pricing["monthly_aud"] * 12 * (1 - sub.annual_discount_pct / 100)
        return base
    else:
        if sub.custom_monthly_aud is not None:
            return sub.custom_monthly_aud
        return pricing.get("monthly_aud") or 0.0


def catalogue_with_custom(
    db: Session,
    sub: Optional[Subscription] = None,
    discount_pct: float = 20.0,
) -> List[dict]:
    """Return plan catalogue with annual price computed from current discount.
    Base prices come from admin-edited PlanPricing rows where present."""
    plans = []
    for plan_key, info in PLAN_CATALOGUE.items():
        pricing = get_plan_pricing(db, plan_key)
        monthly_aud = pricing["monthly_aud"]
        annual_aud = pricing["annual_aud"]
        features = enabled_features_for_plan(db, plan_key) or info["features"]
        entry = {
            "plan": plan_key.value,
            "name": info["name"],
            "monthly_aud": monthly_aud,
            "annual_aud": annual_aud,
            "annual_discount_pct": discount_pct,
            "features": features,
            "limits": info["limits"],
        }
        if monthly_aud and discount_pct != 20.0:
            entry["annual_aud"] = round(monthly_aud * 12 * (1 - discount_pct / 100), 2)
        plans.append(entry)
    return plans


# ── Subscription CRUD ──────────────────────────────────────────────────────────


def get_subscription(
    db: Session, industry_id: str, organisation_id: Optional[str] = None
) -> Optional[Subscription]:
    q = db.query(Subscription)
    if organisation_id:
        q = q.filter(
            or_(
                Subscription.organisation_id == organisation_id,
                (Subscription.organisation_id.is_(None))
                & (Subscription.industry_id == industry_id),
            )
        )
    else:
        q = q.filter(Subscription.industry_id == industry_id)
    return q.order_by(desc(Subscription.created_at)).first()


def list_subscriptions(db: Session, limit: int = 100) -> List[Subscription]:
    return (
        db.query(Subscription)
        .order_by(desc(Subscription.created_at))
        .limit(limit)
        .all()
    )


def create_trial(
    db: Session,
    industry_id: str,
    tenant_id: Optional[str] = None,
    organisation_id: Optional[str] = None,
) -> Subscription:
    sub = Subscription(
        subscription_id=_sub_id(),
        industry_id=industry_id,
        organisation_id=organisation_id,
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
    db: Session,
    industry_id: str,
    data: SubscriptionAdminUpdate,
    organisation_id: Optional[str] = None,
) -> Optional[Subscription]:
    sub = get_subscription(db, industry_id, organisation_id)
    if not sub:
        return None
    for field, val in data.model_dump(exclude_unset=True).items():
        setattr(sub, field, val)
    # Recompute base_price_aud after any change
    sub.base_price_aud = effective_price(sub, db)
    db.commit()
    db.refresh(sub)
    return sub


def activate_subscription(
    db: Session,
    industry_id: str,
    organisation_id: Optional[str] = None,
) -> Optional[Subscription]:
    """Admin-driven, immediate activation — primarily for Enterprise/VVIP deals
    that are turned on manually rather than through Stripe checkout."""
    sub = get_subscription(db, industry_id, organisation_id)
    if not sub:
        return None
    sub.status = SubscriptionStatus.active
    sub.cancel_at_period_end = False
    sub.canceled_at = None
    sub.base_price_aud = effective_price(sub, db)
    db.commit()
    db.refresh(sub)
    return sub


def terminate_subscription(
    db: Session,
    industry_id: str,
    organisation_id: Optional[str] = None,
) -> Optional[Subscription]:
    """Admin-driven, immediate termination — bypasses Stripe's cancel-at-period-end
    flow so an Enterprise/VVIP deal can be shut off on the spot."""
    sub = get_subscription(db, industry_id, organisation_id)
    if not sub:
        return None
    stripe = _stripe()
    if stripe and sub.stripe_subscription_id:
        try:
            stripe.Subscription.cancel(sub.stripe_subscription_id)
        except Exception as e:
            print(f"[stripe] terminate error: {e}")
    sub.status = SubscriptionStatus.canceled
    sub.cancel_at_period_end = False
    sub.canceled_at = datetime.now(timezone.utc)
    db.commit()
    db.refresh(sub)
    return sub


def cancel_subscription(
    db: Session,
    industry_id: str,
    at_period_end: bool = True,
    organisation_id: Optional[str] = None,
) -> Optional[Subscription]:
    sub = get_subscription(db, industry_id, organisation_id)
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
    organisation_id: Optional[str] = None,
) -> dict:
    stripe = _stripe()
    price_id = get_stripe_price_id(db, req.plan, req.interval)

    if not stripe or not price_id:
        # Mock mode — return placeholder
        return {
            "checkout_url": f"{APP_URL}/billing?mock_checkout=1&plan={req.plan}&interval={req.interval}",
            "session_id": f"cs_mock_{uuid.uuid4().hex[:16]}",
        }

    sub = get_subscription(db, industry_id, organisation_id)
    stripe_customer_id = sub.stripe_customer_id if sub else None

    metadata = {
        "industry_id": industry_id,
        "organisation_id": organisation_id or "",
        "plan": req.plan.value,
        "interval": req.interval.value,
    }

    # Create or reuse Stripe customer
    if not stripe_customer_id:
        customer = stripe.Customer.create(
            email=customer_email,
            metadata=metadata,
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
        metadata=metadata,
        tax_id_collection={"enabled": True},
        automatic_tax={"enabled": True},
    )
    return {"checkout_url": session.url, "session_id": session.id}


def create_customer_portal(
    db: Session,
    industry_id: str,
    return_url: str,
    organisation_id: Optional[str] = None,
) -> str:
    stripe = _stripe()
    sub = get_subscription(db, industry_id, organisation_id)
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
    metadata = session.get("metadata", {})
    industry_id = metadata.get("industry_id")
    organisation_id = metadata.get("organisation_id") or None
    plan_str = metadata.get("plan", "starter")
    interval_str = metadata.get("interval", "monthly")
    if not industry_id:
        return

    sub = get_subscription(db, industry_id, organisation_id)
    if not sub:
        sub = Subscription(
            subscription_id=_sub_id(),
            industry_id=industry_id,
            organisation_id=organisation_id,
            annual_discount_pct=20.0,
        )
        db.add(sub)
        try:
            db.flush()
        except IntegrityError:
            # Two checkout.session.completed deliveries racing for the
            # same org both passed the get_subscription() check above
            # before either committed — the unique constraint is the
            # real guard. The other writer won; load its row instead.
            db.rollback()
            sub = get_subscription(db, industry_id, organisation_id)
            if not sub:
                raise

    sub.plan = BillingPlan(plan_str)
    sub.interval = BillingInterval(interval_str)
    sub.status = SubscriptionStatus.active
    sub.stripe_customer_id = session.get("customer")
    sub.stripe_subscription_id = session.get("subscription")
    sub.base_price_aud = effective_price(sub, db)
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
            organisation_id=sub.organisation_id if sub else None,
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


def list_invoices(
    db: Session,
    industry_id: str,
    limit: int = 20,
    organisation_id: Optional[str] = None,
) -> List[Invoice]:
    q = db.query(Invoice)
    if organisation_id:
        q = q.filter(
            or_(
                Invoice.organisation_id == organisation_id,
                (Invoice.organisation_id.is_(None))
                & (Invoice.industry_id == industry_id),
            )
        )
    else:
        q = q.filter(Invoice.industry_id == industry_id)
    return q.order_by(desc(Invoice.created_at)).limit(limit).all()


# ── Enterprise add-ons ───────────────────────────────────────────────────────
# In-app purchase that unlocks providers which are partially built (unverified
# response schema) or sales-gated (no self-serve API access) — e.g. Elliptic
# and TRM Labs crypto wallet screening. Sold separately from the base plan.


def addon_catalogue() -> List[dict]:
    return [
        {
            "addon_key": key.value,
            "name": info["name"],
            "monthly_aud": info["monthly_aud"],
            "description": info["description"],
            "unlocks_providers": info["unlocks_providers"],
            "requires_plan": [p.value for p in info["requires_plan"]],
        }
        for key, info in ADDON_CATALOGUE.items()
    ]


def get_org_addons(db: Session, org_id: str) -> List[SubscriptionAddon]:
    return (
        db.query(SubscriptionAddon)
        .filter(SubscriptionAddon.org_id == org_id)
        .order_by(desc(SubscriptionAddon.created_at))
        .all()
    )


def has_addon(db: Session, org_id: str, addon_key: AddonKey) -> bool:
    return (
        db.query(SubscriptionAddon)
        .filter(
            SubscriptionAddon.org_id == org_id,
            SubscriptionAddon.addon_key == addon_key,
            SubscriptionAddon.status == AddonStatus.active,
        )
        .first()
        is not None
    )


def addon_for_provider(provider_name: str) -> Optional[AddonKey]:
    """Return the add-on key that gates `provider_name`, or None if it's
    included in the base plan (e.g. the free-tier crypto providers)."""
    for key, info in ADDON_CATALOGUE.items():
        if provider_name in info["unlocks_providers"]:
            return key
    return None


def purchase_addon(db: Session, org_id: str, addon_key: AddonKey) -> SubscriptionAddon:
    info = ADDON_CATALOGUE.get(addon_key)
    if not info:
        raise ValueError(f"Unknown add-on: {addon_key}")

    sub = get_subscription(db, org_id)
    if not sub or sub.plan not in info["requires_plan"]:
        required = " or ".join(p.value for p in info["requires_plan"])
        raise ValueError(f"{info['name']} requires an active {required} plan")

    existing = (
        db.query(SubscriptionAddon)
        .filter(
            SubscriptionAddon.org_id == org_id, SubscriptionAddon.addon_key == addon_key
        )
        .first()
    )
    addon = existing or SubscriptionAddon(
        addon_id=_addon_id(), org_id=org_id, addon_key=addon_key
    )
    addon.status = AddonStatus.active
    addon.price_aud = info["monthly_aud"]
    addon.canceled_at = None
    db.add(addon)
    db.commit()
    db.refresh(addon)
    return addon


def cancel_addon(
    db: Session, org_id: str, addon_key: AddonKey
) -> Optional[SubscriptionAddon]:
    addon = (
        db.query(SubscriptionAddon)
        .filter(
            SubscriptionAddon.org_id == org_id, SubscriptionAddon.addon_key == addon_key
        )
        .first()
    )
    if not addon:
        return None
    addon.status = AddonStatus.canceled
    addon.canceled_at = datetime.now(timezone.utc)
    db.commit()
    db.refresh(addon)
    return addon
