"""Tests for the Enterprise add-on purchase flow that gates partially-built
or sales-gated crypto wallet providers (Elliptic, TRM Labs)."""

import pytest

from app.models.billing import AddonKey, AddonStatus, BillingPlan
from app.services import billing_service as svc


def test_addon_catalogue_lists_enterprise_crypto_screening():
    catalogue = svc.addon_catalogue()
    keys = [a["addon_key"] for a in catalogue]
    assert "enterprise_crypto_screening" in keys


def test_addon_for_provider_maps_gated_providers():
    assert svc.addon_for_provider("elliptic") == AddonKey.enterprise_crypto_screening
    assert svc.addon_for_provider("trm_labs") == AddonKey.enterprise_crypto_screening
    assert svc.addon_for_provider("chainalysis") is None
    assert svc.addon_for_provider("ofac_sdn") is None


def test_purchase_addon_requires_enterprise_plan(db):
    sub = svc.create_trial(db, "org-no-enterprise")
    with pytest.raises(ValueError):
        svc.purchase_addon(
            db, "org-no-enterprise", AddonKey.enterprise_crypto_screening
        )


def test_purchase_addon_succeeds_on_enterprise_plan(db):
    sub = svc.create_trial(db, "org-enterprise")
    sub.plan = BillingPlan.enterprise
    db.commit()

    addon = svc.purchase_addon(
        db, "org-enterprise", AddonKey.enterprise_crypto_screening
    )
    assert addon.status == AddonStatus.active
    assert (
        svc.has_addon(db, "org-enterprise", AddonKey.enterprise_crypto_screening)
        is True
    )


def test_cancel_addon(db):
    sub = svc.create_trial(db, "org-cancel")
    sub.plan = BillingPlan.vvip
    db.commit()

    svc.purchase_addon(db, "org-cancel", AddonKey.enterprise_crypto_screening)
    assert svc.has_addon(db, "org-cancel", AddonKey.enterprise_crypto_screening) is True

    svc.cancel_addon(db, "org-cancel", AddonKey.enterprise_crypto_screening)
    assert (
        svc.has_addon(db, "org-cancel", AddonKey.enterprise_crypto_screening) is False
    )


# ── Annual Independent Review add-on ─────────────────────────────────────────
# A human service (delivered by a separate review team), not a software
# feature -- unlike enterprise_crypto_screening it doesn't unlock any
# provider and is available to every paid tier, not just Enterprise.


def test_addon_catalogue_lists_independent_review():
    catalogue = svc.addon_catalogue()
    entry = next(a for a in catalogue if a["addon_key"] == "independent_review")
    assert entry["unlocks_providers"] == []
    assert entry["monthly_aud"] is None  # price TBA
    assert set(entry["requires_plan"]) == {
        "starter",
        "professional",
        "enterprise",
        "vvip",
    }


@pytest.mark.parametrize(
    "plan", [BillingPlan.starter, BillingPlan.professional, BillingPlan.enterprise]
)
def test_purchase_independent_review_available_on_every_paid_tier(db, plan):
    org_id = f"org-review-{plan.value}"
    sub = svc.create_trial(db, org_id)
    sub.plan = plan
    db.commit()

    addon = svc.purchase_addon(db, org_id, AddonKey.independent_review)
    assert addon.status == AddonStatus.active
    assert svc.has_addon(db, org_id, AddonKey.independent_review) is True


def test_purchase_independent_review_rejected_on_free_trial(db):
    svc.create_trial(db, "org-review-trial")
    with pytest.raises(ValueError):
        svc.purchase_addon(db, "org-review-trial", AddonKey.independent_review)
