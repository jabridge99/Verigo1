"""
Smoke test: _handle_checkout_completed (Stripe webhook handler) did
check-then-insert (get_subscription() then create-if-missing) with no
DB-level guard. Two checkout.session.completed deliveries racing for the
same org could both pass the check before either committed, creating two
Subscription rows for the same (industry_id, organisation_id). Fixed by
adding a unique constraint and catching the resulting IntegrityError in
the handler, re-fetching the row the other writer created. Simulated
here by forcing db.flush() to raise IntegrityError as if a concurrent
insert won the race, mirroring test_register_race_integrity_error_smoke.
"""
from unittest.mock import patch

from sqlalchemy.exc import IntegrityError

from app.models.billing import Subscription
from app.services import billing_service as svc


def test_concurrent_checkout_completed_recovers_from_integrity_error(db):
    industry_id = "ind_race_test"
    organisation_id = "12345"
    session_obj = {
        "metadata": {
            "industry_id": industry_id,
            "organisation_id": organisation_id,
            "plan": "starter",
            "interval": "monthly",
        },
        "customer": "cus_test123",
        "subscription": "sub_test123",
    }

    winner = Subscription(
        subscription_id="SUB-WINNER",
        industry_id=industry_id,
        organisation_id=str(int(organisation_id)),
        annual_discount_pct=20.0,
    )
    db.add(winner)
    db.commit()

    # The pre-insert check found nothing (as if it ran before the
    # winner's commit), so the handler tries to insert and collides.
    real_flush = db.flush
    flush_calls = {"n": 0}

    def _flaky_flush(*args, **kwargs):
        flush_calls["n"] += 1
        if flush_calls["n"] == 1:
            raise IntegrityError("dup", {}, Exception("unique violation"))
        return real_flush(*args, **kwargs)

    with patch.object(svc, "get_subscription", side_effect=[None, winner]):
        with patch.object(db, "flush", side_effect=_flaky_flush):
            svc._handle_checkout_completed(db, session_obj)

    assert flush_calls["n"] >= 1
    assert winner.plan.value == "starter"
    assert (
        db.query(Subscription)
        .filter(
            Subscription.industry_id == industry_id,
            Subscription.organisation_id == str(int(organisation_id)),
        )
        .count()
        == 1
    )


def test_unique_constraint_exists_on_subscription_model():
    constraint_names = {
        c.name for c in Subscription.__table__.constraints
    }
    assert "uq_subscription_industry_org" in constraint_names
