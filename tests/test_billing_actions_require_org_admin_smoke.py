"""
Smoke test: POST /billing/checkout, GET /billing/portal,
POST /billing/subscription/cancel, and POST/cancel /billing/addons/{key}
previously had no role gate beyond "user has an org_id" — any analyst could
purchase add-ons, cancel the org's subscription, or open the Stripe billing
portal on behalf of the whole organisation. Fixed by requiring
UserRole.admin (the existing _ROLE_GATE already used elsewhere in this
file).
"""

from app.models.user import UserRole
from tests.conftest import _auth, _make_user


def test_analyst_cannot_cancel_subscription(client, db):
    user = _make_user(db, UserRole.analyst)
    resp = client.post("/api/v1/billing/subscription/cancel", headers=_auth(user))
    assert resp.status_code == 403


def test_analyst_cannot_purchase_addon(client, db):
    user = _make_user(db, UserRole.analyst)
    resp = client.post(
        "/api/v1/billing/addons/crypto_screening/purchase", headers=_auth(user)
    )
    assert resp.status_code == 403


def test_analyst_cannot_open_billing_portal(client, db):
    user = _make_user(db, UserRole.analyst)
    resp = client.get("/api/v1/billing/portal", headers=_auth(user))
    assert resp.status_code == 403


def test_org_admin_can_attempt_subscription_cancel(client, db):
    user = _make_user(db, UserRole.admin)
    resp = client.post("/api/v1/billing/subscription/cancel", headers=_auth(user))
    # No subscription exists for this fresh org, but the role gate must let
    # the admin past — service-layer 404 confirms that, not a 403.
    assert resp.status_code == 404
