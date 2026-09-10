"""
Stage 13: PLAN_CATALOGUE's "limits" (customers/users/api_calls_month) and the
free-trial "1 organisation" cap were defined and shown on the pricing page
but never actually enforced anywhere -- any org, regardless of plan, could
onboard unlimited customers, add unlimited team members, or have its owner
spin up unlimited additional organisations. Fixed by adding three
enforcement checks (billing_service.enforce_customer_limit/enforce_user_limit/
enforce_org_creation_limit) called from the three creation endpoints.

Each test registers a real account (so org creation goes through the real
attach_owner() flow -- an "owner" OrganisationUser row matters for the
org-creation-limit test) rather than using the _make_user fixture, which
sets org_id directly without an OrganisationUser row.
"""

import uuid

from app.models.billing import (
    BillingInterval,
    BillingPlan,
    Subscription,
    SubscriptionStatus,
)
from app.services.org_service import seed_permission_catalog_and_roles
from tests.test_reports import _create_customer


def _register(client, db) -> dict:
    seed_permission_catalog_and_roles(db)
    email = f"limits-{uuid.uuid4().hex[:8]}@test.com"
    resp = client.post(
        "/api/v1/auth/register",
        json={"email": email, "full_name": "Limits Test", "password": "SecurePass123!"},
    )
    assert resp.status_code == 201, resp.text
    data = resp.json()
    return {
        "org_id": data["org_id"],
        "headers": {"Authorization": f"Bearer {data['access_token']}"},
    }


def _upgrade(db, org_id: str, plan: BillingPlan) -> None:
    db.add(
        Subscription(
            subscription_id=f"sub_{uuid.uuid4().hex[:10]}",
            industry_id=org_id,
            organisation_id=org_id,
            plan=plan,
            interval=BillingInterval.monthly,
            status=SubscriptionStatus.active,
        )
    )
    db.commit()


# ── Customer limit ───────────────────────────────────────────────────────────


def test_free_trial_customer_limit_is_enforced(client, db):
    reg = _register(client, db)
    for _ in range(10):
        _create_customer(client, reg["headers"])

    resp = client.post(
        "/api/v1/customers/",
        json={
            "customer_type": "individual",
            "full_name": "One Too Many",
            "email": f"over-{uuid.uuid4().hex[:6]}@example.com",
        },
        headers=reg["headers"],
    )
    assert resp.status_code == 403, resp.text
    assert "customer limit" in resp.json()["detail"]


def test_upgrading_plan_raises_customer_limit(client, db):
    reg = _register(client, db)
    for _ in range(10):
        _create_customer(client, reg["headers"])
    _upgrade(db, reg["org_id"], BillingPlan.starter)  # limit: 500

    resp = client.post(
        "/api/v1/customers/",
        json={
            "customer_type": "individual",
            "full_name": "Now Allowed",
            "email": f"ok-{uuid.uuid4().hex[:6]}@example.com",
        },
        headers=reg["headers"],
    )
    assert resp.status_code == 201, resp.text


# ── User limit ────────────────────────────────────────────────────────────────


def test_free_trial_user_limit_is_enforced(client, db):
    owner = _register(client, db)
    invitee_email = f"invitee-{uuid.uuid4().hex[:8]}@test.com"
    client.post(
        "/api/v1/auth/register",
        json={
            "email": invitee_email,
            "full_name": "Invitee",
            "password": "SecurePass123!",
        },
    )

    resp = client.post(
        f"/api/v1/organisations/{owner['org_id']}/members",
        json={"email": invitee_email, "role_key": "staff"},
        headers=owner["headers"],
    )
    assert resp.status_code == 403, resp.text
    assert "user limit" in resp.json()["detail"]


def test_upgrading_plan_raises_user_limit(client, db):
    owner = _register(client, db)
    _upgrade(db, owner["org_id"], BillingPlan.professional)  # limit: 3 users
    invitee_email = f"invitee-{uuid.uuid4().hex[:8]}@test.com"
    client.post(
        "/api/v1/auth/register",
        json={
            "email": invitee_email,
            "full_name": "Invitee",
            "password": "SecurePass123!",
        },
    )

    resp = client.post(
        f"/api/v1/organisations/{owner['org_id']}/members",
        json={"email": invitee_email, "role_key": "staff"},
        headers=owner["headers"],
    )
    assert resp.status_code == 201, resp.text


# ── Organisation-creation limit ──────────────────────────────────────────────


def test_free_trial_organisation_creation_limit_is_enforced(client, db):
    owner = _register(client, db)

    resp = client.post(
        "/api/v1/organisations",
        json={"name": "Second Org"},
        headers=owner["headers"],
    )
    assert resp.status_code == 403, resp.text
    assert "1 organisation" in resp.json()["detail"]


def test_upgrading_plan_raises_organisation_creation_limit(client, db):
    owner = _register(client, db)
    _upgrade(db, owner["org_id"], BillingPlan.starter)

    resp = client.post(
        "/api/v1/organisations",
        json={"name": "Second Org"},
        headers=owner["headers"],
    )
    assert resp.status_code == 201, resp.text
