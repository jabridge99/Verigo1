"""
Stage 13 follow-up (decided 2026-09-14, per your direction):
  - Screening (sanctions/PEP) is included up to a per-plan monthly quota,
    then blocks with an upgrade prompt -- not metered/pay-per-click.
  - Independent Review ($1,650/yr) and Quarterly Compliance Report
    ($220/quarter) are now really priced, with a 20% discount on the review
    once the org has generated 3 Quarterly Compliance Reports in the
    trailing 12 months ("20% discount ... if conduct all 3 quarters").
  - purchase_addon()/cancel_addon() now attempt a real Stripe charge when
    Stripe is configured; tests run with no STRIPE_SECRET_KEY set, so they
    exercise the same mock-mode fallback the rest of billing_service.py uses.
"""

from datetime import date, datetime, timedelta, timezone

import pytest
from fastapi import HTTPException

from app.models.billing import (
    AddonKey,
    AddonStatus,
    BillingInterval,
    BillingPlan,
    Subscription,
    SubscriptionStatus,
)
from app.models.board_report import (
    BoardReport,
    BoardReportStatus,
    BoardReportType,
    ReportPeriod,
)
from app.models.customer import Customer, CustomerType
from app.models.organisation import IndustryType, Organisation
from app.models.screening import ScreeningEntityType, ScreeningRecord, ScreeningType
from app.services import billing_service as svc


def _upgrade(db, org_id: str, plan: BillingPlan) -> None:
    if not db.query(Organisation).filter_by(id=org_id).first():
        db.add(
            Organisation(
                id=org_id, name=f"Test Org {org_id}", industry_type=IndustryType.remittance
            )
        )
        db.commit()
    db.add(
        Subscription(
            subscription_id=f"sub_{org_id}",
            industry_id=org_id,
            organisation_id=org_id,
            plan=plan,
            interval=BillingInterval.monthly,
            status=SubscriptionStatus.active,
        )
    )
    db.commit()


def _add_screening_records(db, org_id: str, count: int, when=None) -> None:
    when = when or datetime.now(timezone.utc)
    customer_id = f"cust_{org_id}"
    if not db.query(Customer).filter_by(id=customer_id).first():
        db.add(
            Customer(
                id=customer_id,
                customer_ref=f"REF-{org_id}",
                org_id=org_id,
                customer_type=CustomerType.individual,
                full_name="Test Customer",
            )
        )
        db.commit()
    for i in range(count):
        db.add(
            ScreeningRecord(
                id=f"scr_{org_id}_{i}",
                org_id=org_id,
                customer_id=f"cust_{org_id}",
                screening_type=ScreeningType.sanctions,
                entity_type=ScreeningEntityType.customer,
                entity_id=f"cust_{org_id}",
                created_at=when,
            )
        )
    db.commit()


def _add_quarterly_reports(db, org_id: str, count: int, when=None) -> None:
    when = when or datetime.now(timezone.utc)
    for i in range(count):
        db.add(
            BoardReport(
                id=f"br_{org_id}_{i}",
                report_ref=f"BR-TEST-{org_id}-{i}",
                org_id=org_id,
                report_type=BoardReportType.quarterly_compliance,
                status=BoardReportStatus.distributed,
                period=ReportPeriod.q1,
                period_start=date(2026, 1, 1),
                period_end=date(2026, 3, 31),
                report_year=2026,
                title="Quarterly Compliance Report",
                created_by="test",
                created_at=when,
            )
        )
    db.commit()


# ── Screening quota ──────────────────────────────────────────────────────────


def test_screening_quota_allows_checks_within_plan_limit(db):
    _upgrade(db, "org-screen-ok", BillingPlan.starter)
    _add_screening_records(db, "org-screen-ok", 5)
    svc.enforce_screening_limit(db, "org-screen-ok", additional=1)  # should not raise


def test_screening_quota_blocks_once_exceeded(db):
    _upgrade(db, "org-screen-over", BillingPlan.starter)
    _add_screening_records(db, "org-screen-over", 100)  # Compliance's quota
    with pytest.raises(HTTPException) as exc:
        svc.enforce_screening_limit(db, "org-screen-over", additional=1)
    assert exc.value.status_code == 403
    assert "screening limit" in exc.value.detail


def test_screening_quota_ignores_records_from_a_prior_month(db):
    _upgrade(db, "org-screen-prior", BillingPlan.starter)
    last_month = datetime.now(timezone.utc) - timedelta(days=40)
    _add_screening_records(db, "org-screen-prior", 100, when=last_month)
    svc.enforce_screening_limit(
        db, "org-screen-prior", additional=1
    )  # should not raise


def test_screening_quota_unlimited_on_enterprise(db):
    _upgrade(db, "org-screen-ent", BillingPlan.enterprise)
    _add_screening_records(db, "org-screen-ent", 5_000)
    svc.enforce_screening_limit(db, "org-screen-ent", additional=1)  # should not raise


# ── Real add-on pricing ──────────────────────────────────────────────────────


def test_quarterly_compliance_report_catalogue_price():
    catalogue = svc.addon_catalogue()
    entry = next(
        a for a in catalogue if a["addon_key"] == "quarterly_compliance_report"
    )
    assert entry["price_aud"] == 220.00
    assert entry["billing_interval"] == "quarter"


def test_independent_review_no_discount_by_default(db):
    _upgrade(db, "org-review-nodiscount", BillingPlan.starter)
    pricing = svc.addon_price(db, "org-review-nodiscount", AddonKey.independent_review)
    assert pricing["discount_pct"] == 0.0
    assert pricing["price_aud"] == 1_650.00


def test_independent_review_discounted_after_three_quarterly_reports(db):
    _upgrade(db, "org-review-discount", BillingPlan.starter)
    _add_quarterly_reports(db, "org-review-discount", 3)
    pricing = svc.addon_price(db, "org-review-discount", AddonKey.independent_review)
    assert pricing["discount_pct"] == 20.0
    assert pricing["price_aud"] == 1_320.00  # $1,650 - 20%


def test_independent_review_not_discounted_with_only_two_quarterly_reports(db):
    _upgrade(db, "org-review-twoq", BillingPlan.starter)
    _add_quarterly_reports(db, "org-review-twoq", 2)
    pricing = svc.addon_price(db, "org-review-twoq", AddonKey.independent_review)
    assert pricing["discount_pct"] == 0.0


def test_independent_review_ignores_quarterly_reports_older_than_a_year(db):
    _upgrade(db, "org-review-stale", BillingPlan.starter)
    over_a_year_ago = datetime.now(timezone.utc) - timedelta(days=400)
    _add_quarterly_reports(db, "org-review-stale", 3, when=over_a_year_ago)
    pricing = svc.addon_price(db, "org-review-stale", AddonKey.independent_review)
    assert pricing["discount_pct"] == 0.0


def test_purchase_independent_review_charges_the_discounted_price(db):
    _upgrade(db, "org-review-purchase", BillingPlan.starter)
    _add_quarterly_reports(db, "org-review-purchase", 3)
    addon = svc.purchase_addon(db, "org-review-purchase", AddonKey.independent_review)
    assert addon.status == AddonStatus.active
    assert addon.price_aud == 1_320.00


def test_purchase_quarterly_compliance_report_addon(db):
    _upgrade(db, "org-co-report", BillingPlan.starter)
    addon = svc.purchase_addon(
        db, "org-co-report", AddonKey.quarterly_compliance_report
    )
    assert addon.status == AddonStatus.active
    assert addon.price_aud == 220.00
    assert (
        svc.has_addon(db, "org-co-report", AddonKey.quarterly_compliance_report) is True
    )
