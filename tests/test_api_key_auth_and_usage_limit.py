"""
P40: PLAN_CATALOGUE's api_calls_month limit was defined and advertised but
had nothing to attach to -- authenticate_api_key() (app/services/
api_key_service.py) existed but no route ever called it, so there was no
real "external API traffic" distinct from ordinary browser/JWT session
traffic to meter against it.

app/api/deps.py::get_current_user() now accepts an X-API-Key header as an
alternative credential (checked only when no Bearer token is present), and
only that path calls billing_service.record_api_call() -- normal JWT
session requests, however many, are never metered.
"""

import uuid

from app.models.billing import (
    ApiUsageCounter,
    BillingInterval,
    BillingPlan,
    SubscriptionStatus,
)
from app.models.billing import Subscription as SubscriptionModel


def _create_api_key(client, headers) -> str:
    resp = client.post(
        "/api/v1/api-keys",
        json={"name": f"Test Key {uuid.uuid4().hex[:6]}", "scopes": []},
        headers=headers,
    )
    assert resp.status_code == 201, resp.text
    return resp.json()["raw_key"]


def test_api_key_authenticates_requests(client, db, admin_user, admin_headers):
    raw_key = _create_api_key(client, admin_headers)

    resp = client.get("/api/v1/customers", headers={"X-API-Key": raw_key})
    assert resp.status_code == 200, resp.text


def test_invalid_api_key_is_rejected(client, db):
    resp = client.get("/api/v1/customers", headers={"X-API-Key": "not-a-real-key"})
    assert resp.status_code == 401, resp.text


def test_no_credentials_still_401s(client, db):
    resp = client.get("/api/v1/customers")
    assert resp.status_code == 401, resp.text


def test_api_key_requests_are_metered_jwt_requests_are_not(
    client, db, admin_user, admin_headers
):
    raw_key = _create_api_key(client, admin_headers)

    # Plenty of ordinary JWT session calls -- must never touch the counter.
    for _ in range(5):
        r = client.get("/api/v1/customers", headers=admin_headers)
        assert r.status_code == 200

    counter = (
        db.query(ApiUsageCounter)
        .filter(ApiUsageCounter.org_id == admin_user.org_id)
        .first()
    )
    assert counter is None, "JWT session traffic must not be metered"

    # Now the same number of calls via the API key -- must be counted.
    for _ in range(5):
        r = client.get("/api/v1/customers", headers={"X-API-Key": raw_key})
        assert r.status_code == 200

    db.expire_all()
    counter = (
        db.query(ApiUsageCounter)
        .filter(ApiUsageCounter.org_id == admin_user.org_id)
        .first()
    )
    assert counter is not None
    assert counter.count == 5


def test_api_key_calls_blocked_once_plan_cap_reached(
    client, db, admin_user, admin_headers
):
    # Free-trial cap is 250/month (FREE_TRIAL_LIMITS) -- upgrade to a plan
    # with a small, easy-to-exhaust cap instead of looping 250 times.
    db.add(
        SubscriptionModel(
            subscription_id=f"sub_{uuid.uuid4().hex[:10]}",
            industry_id=admin_user.org_id,
            organisation_id=admin_user.org_id,
            plan=BillingPlan.starter,  # 1,000/month
            interval=BillingInterval.monthly,
            status=SubscriptionStatus.active,
        )
    )
    # Pre-seed the counter one short of the cap so the test doesn't need
    # 1,000 real requests to prove the block fires.
    from datetime import datetime, timezone

    period = datetime.now(timezone.utc).strftime("%Y-%m")
    db.add(ApiUsageCounter(org_id=admin_user.org_id, period=period, count=999))
    db.commit()

    raw_key = _create_api_key(client, admin_headers)

    ok = client.get("/api/v1/customers", headers={"X-API-Key": raw_key})
    assert ok.status_code == 200, ok.text  # call #1000 -- exactly at the cap

    blocked = client.get("/api/v1/customers", headers={"X-API-Key": raw_key})
    assert blocked.status_code == 429, blocked.text
    assert "API call limit" in blocked.json()["detail"]
