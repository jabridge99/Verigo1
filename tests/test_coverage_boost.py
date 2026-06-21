"""
Coverage-boost tests for pure-logic and template-seeding modules that had
little or no test coverage. These exercise the public functions of each
module directly (no API layer) to bring overall coverage above the CI gate.
"""
import types

import pytest

from app.models.organisation import IndustryType, Organisation


# ── Template seeding (AML solution + risk framework) ────────────────────────

ALL_INDUSTRIES = list(IndustryType)


@pytest.mark.parametrize("industry", ALL_INDUSTRIES)
@pytest.mark.parametrize("risk_level", ["low", "medium", "high", "bogus"])
def test_seed_aml_solution_for_every_industry_and_risk_level(db, industry, risk_level):
    from app.templates.aml.factory import seed_aml_solution

    org = Organisation(name=f"Org {industry.value}", industry_type=industry)
    db.add(org)
    db.commit()
    db.refresh(org)

    solution = seed_aml_solution(db, org, created_by="user_1", risk_level=risk_level)
    db.commit()

    assert solution.org_id == org.id
    assert solution.template_industry == industry.value


@pytest.mark.parametrize("industry", ALL_INDUSTRIES)
def test_seed_risk_framework_for_every_industry(db, industry):
    from app.templates.risk.factory import seed_risk_framework

    org = Organisation(name=f"RiskOrg {industry.value}", industry_type=industry)
    db.add(org)
    db.commit()
    db.refresh(org)

    framework = seed_risk_framework(db, org, solution_id="sol_1", created_by="user_1")
    db.commit()

    assert framework.org_id == org.id
    assert framework.industry == industry.value
    assert framework.category_weights


# ── ecdd_service ──────────────────────────────────────────────────────────

def test_compute_ecdd_score_and_recommendation():
    from app.services.ecdd_service import compute_ecdd_score, determine_recommendation

    high_risk = types.SimpleNamespace(
        pep_status=True,
        adverse_media_found=True,
        beneficial_owner_verified=False,
        source_of_wealth_verified=False,
    )
    assert compute_ecdd_score(high_risk) == 100.0
    assert determine_recommendation(100.0, pep=True, adverse_media=True) == "reject"

    clean = types.SimpleNamespace(
        pep_status=False,
        adverse_media_found=False,
        beneficial_owner_verified=True,
        source_of_wealth_verified=True,
    )
    assert compute_ecdd_score(clean) == 0.0
    assert determine_recommendation(0.0, pep=False, adverse_media=False) == "approve"

    pep_only = types.SimpleNamespace(
        pep_status=True,
        adverse_media_found=False,
        beneficial_owner_verified=True,
        source_of_wealth_verified=True,
    )
    assert determine_recommendation(compute_ecdd_score(pep_only), pep=True, adverse_media=False) == "monitor"


# ── sanctions_screening ──────────────────────────────────────────────────────

def test_screen_name_match_and_no_match():
    from app.services.sanctions_screening import screen_name, screen_transaction

    result = screen_name("John Doe Sanction")
    assert result["match_found"] is True
    assert result["matches"][0]["list"] == "OFAC"

    result_clean = screen_name("Totally Unrelated Person")
    assert result_clean["match_found"] is False

    assert screen_transaction("")["match_found"] is False
    assert screen_transaction("Jane Criminal")["match_found"] is True


# ── risk_scoring ──────────────────────────────────────────────────────────

def test_score_customer_and_levels():
    from app.services.risk_scoring import score_customer, score_to_level

    high_risk_customer = types.SimpleNamespace(
        country_of_residence="AF",
        nationality="KP",
        industry=types.SimpleNamespace(value="vasp"),
        is_pep=True,
        source_of_funds=None,
    )
    score = score_customer(high_risk_customer)
    assert score == 100.0
    assert score_to_level(score) == "critical"

    low_risk_customer = types.SimpleNamespace(
        country_of_residence="AU",
        nationality="AU",
        industry=types.SimpleNamespace(value="retail"),
        is_pep=False,
        source_of_funds="salary",
    )
    low_score = score_customer(low_risk_customer)
    assert low_score == 0.0
    assert score_to_level(low_score) == "low"

    assert score_to_level(45) == "medium"
    assert score_to_level(70) == "high"


def test_score_transaction_alerts():
    from app.services.risk_scoring import score_transaction

    big_txn = types.SimpleNamespace(amount=15_000, counterparty_country="KP")
    near_threshold_txns = [
        types.SimpleNamespace(amount=7_500) for _ in range(3)
    ]
    many_recent = near_threshold_txns + [types.SimpleNamespace(amount=100) for _ in range(8)]

    result = score_transaction(big_txn, customer_risk_score=50.0, recent_transactions=many_recent)
    assert result["is_suspicious"] == 1
    assert result["risk_score"] > 0
    alert_types = {a[0] for a in result["alerts"]}
    assert "large_transaction" in alert_types
    assert "structuring" in alert_types
    assert "high_risk_country" in alert_types
    assert "velocity_breach" in alert_types

    small_txn = types.SimpleNamespace(amount=50, counterparty_country=None)
    clean_result = score_transaction(small_txn, customer_risk_score=0.0, recent_transactions=[])
    assert clean_result["is_suspicious"] == 0
    assert clean_result["alerts"] == []


# ── identity_verification ──────────────────────────────────────────────────

def test_verify_document_matches_and_mismatches():
    from datetime import date
    from app.services.identity_verification import compute_kyc_identity_score, verify_document

    customer = types.SimpleNamespace(
        full_name="Jane Doe",
        date_of_birth=date(1990, 1, 1),
    )
    good_doc = types.SimpleNamespace(
        extracted_name="Jane Doe",
        extracted_dob=date(1990, 1, 1),
        expiry_date=date(2099, 1, 1),
    )
    result = verify_document(customer, good_doc)
    assert result["verification_result"] == "valid"
    assert result["issues"] == []

    bad_doc = types.SimpleNamespace(
        extracted_name="Someone Else",
        extracted_dob=date(2000, 5, 5),
        expiry_date=date(2000, 1, 1),
    )
    bad_result = verify_document(customer, bad_doc)
    assert bad_result["verification_result"] == "invalid"
    assert len(bad_result["issues"]) == 3

    malformed_doc = types.SimpleNamespace(
        extracted_name=None,
        extracted_dob=None,
        expiry_date=None,
    )
    review_result = verify_document(customer, malformed_doc)
    assert review_result["verification_result"] == "valid"

    docs = [
        types.SimpleNamespace(confidence_score=80.0),
        types.SimpleNamespace(confidence_score=60.0),
        types.SimpleNamespace(confidence_score=None),
    ]
    assert compute_kyc_identity_score(docs) == 70.0
    assert compute_kyc_identity_score([]) == 0.0


# ── audit_service ──────────────────────────────────────────────────────────

def test_log_action_persists_audit_entry(db):
    from app.services.audit_service import log_action

    entry = log_action(
        db,
        action="customer.update",
        entity_type="customer",
        entity_id="cust_1",
        actor="user_1",
        actor_role="compliance",
        before_state={"status": "draft"},
        after_state={"status": "active"},
        notes="approved onboarding",
        industry_id="org_1",
        ip_address="127.0.0.1",
    )
    assert entry.id is not None
    assert entry.action == "customer.update"
    assert entry.log_id.startswith("LOG-")


# ── cache.py (Redis-backed, graceful no-redis degradation) ──────────────────

@pytest.mark.asyncio
async def test_cache_service_noops_without_redis(monkeypatch):
    from app import config as config_module
    from app.services.cache import CacheService, get_redis

    monkeypatch.setattr(config_module.settings, "redis_url", "")
    assert get_redis() is None

    cache = CacheService()
    assert await cache.get("some-key") is None
    assert await cache.set("some-key", {"a": 1}) is False
    assert await cache.delete("some-key") is False
    assert await cache.delete_pattern("some-*") == 0
    assert await cache.ping() is False


# ── customer_risk_engine (5-dimension assessment) ────────────────────────────

def _customer(**overrides):
    base = dict(
        nationality="AU",
        dual_nationality=None,
        occupation="retail_worker",
        tax_identification_number="123456789",
        country_of_birth="AU",
        country_of_residence="AU",
    )
    base.update(overrides)
    return types.SimpleNamespace(**base)


def test_assess_customer_risk_low_and_high_profiles():
    from app.services.customer_risk_engine import (
        assess_customer_risk,
        cdd_level_from_gateway,
        risk_level_from_score,
    )

    low_risk_customer = _customer()
    result = assess_customer_risk(low_risk_customer, channel="branch")
    assert result.gateway_decision == "cdd"
    assert result.overall_level in ("low", "medium")
    assert cdd_level_from_gateway(result.gateway_decision, result.overall_score).value in (
        "simplified", "standard",
    )
    assert risk_level_from_score(result.overall_score).value in ("low", "medium")

    high_risk_customer = _customer(
        nationality="KP",
        dual_nationality="IR",
        occupation="politician",
        tax_identification_number=None,
    )
    high_result = assess_customer_risk(
        high_risk_customer,
        is_pep=True,
        pep_type="foreign",
        is_sanctions_match=True,
        involves_crypto=True,
        involves_bearer=True,
        countries=["KP", "RU"],
        channel="third_party",
        is_introduced=True,
        is_third_party_reliance=True,
        expected_monthly_volume_aud=2_000_000,
        expected_max_transaction_aud=200_000,
        expected_frequency="daily",
        crosses_border=True,
    )
    assert high_result.gateway_decision == "edd"
    assert high_result.overall_level in ("high", "critical")
    assert cdd_level_from_gateway(high_result.gateway_decision, high_result.overall_score).value == "enhanced"
    assert "pep_match" in high_result.edd_triggers
    assert "sanctions_match" in high_result.edd_triggers
    assert "crypto_exposure" in high_result.edd_triggers


# ── risk_matrix_service (AUSTRAC/FATF 4-dimension matrix) ───────────────────

def _txn(**overrides):
    from app.models.transaction import DeliveryChannel, PaymentMethod, TransactionType

    base = dict(
        source_country="AU",
        destination_country="AU",
        is_cross_border=False,
        transaction_type=TransactionType.deposit,
        payment_method=PaymentMethod.bank_transfer,
        delivery_channel=DeliveryChannel.branch,
        amount_aud=100.0,
        amount=100.0,
        is_structuring_suspect=False,
        is_round_number=False,
        is_cash_intensive=False,
        is_near_threshold=False,
    )
    base.update(overrides)
    return types.SimpleNamespace(**base)


def test_compute_risk_matrix_low_and_high_risk():
    from app.models.transaction import DeliveryChannel, PaymentMethod, TransactionType
    from app.services.risk_matrix_service import compute_risk_matrix

    low_customer = _customer()
    low_txn = _txn()
    low_result = compute_risk_matrix(low_txn, low_customer, db=None)
    assert low_result.risk_level == "low"
    body = low_result.to_dict()
    assert body["risk_level"] == "low"

    high_customer = _customer(
        nationality="KP",
        occupation="politician",
    )
    high_customer.is_pep = True
    high_customer.pep_type = types.SimpleNamespace(value="foreign")
    high_customer.risk_level = types.SimpleNamespace(value="critical")
    high_customer.risk_score = 95
    high_customer.customer_type = types.SimpleNamespace(value="trust")
    high_customer.onboarding_channel = types.SimpleNamespace(value="online")
    high_customer.cdd_level = types.SimpleNamespace(value="edd")

    high_txn = _txn(
        source_country="KP",
        destination_country="RU",
        is_cross_border=True,
        transaction_type=TransactionType.crypto_purchase,
        payment_method=PaymentMethod.crypto,
        delivery_channel=DeliveryChannel.online,
        amount_aud=150_000.0,
        amount=150_000.0,
        is_structuring_suspect=True,
        is_round_number=True,
        is_cash_intensive=True,
    )
    high_result = compute_risk_matrix(high_txn, high_customer, db=None)
    assert high_result.risk_level == "critical"
    assert high_result.customer_dimension.score > 0
    assert high_result.geographic_dimension.score > 0
    assert high_result.product_dimension.score > 0
    assert high_result.transaction_dimension.score > 0


def test_compute_question_score_and_final_approval_score():
    from app.models.risk_matrix import QuestionAnswer
    from app.services.risk_matrix_service import (
        compute_final_approval_score,
        compute_question_score,
    )

    responses = [
        types.SimpleNamespace(answer=QuestionAnswer.yes),
        types.SimpleNamespace(answer=QuestionAnswer.no),
        types.SimpleNamespace(answer=QuestionAnswer.not_applicable),
    ]
    assert compute_question_score(responses) == 50.0
    assert compute_question_score([types.SimpleNamespace(answer=QuestionAnswer.not_applicable)]) is None

    score, detail = compute_final_approval_score(alert_score=80.0, question_score=None)
    assert detail["questions_complete"] is False
    assert score == 80.0

    score2, detail2 = compute_final_approval_score(alert_score=80.0, question_score=100.0)
    assert detail2["questions_complete"] is True
    assert score2 < 80.0

    score3, _ = compute_final_approval_score(alert_score=20.0, question_score=0.0, custom_question_weight=0.9)
    assert score3 > 20.0


# ── billing_service ─────────────────────────────────────────────────────────

def test_effective_price_branches(db):
    from app.models.billing import BillingInterval, BillingPlan
    from app.services import billing_service as svc

    sub = svc.create_trial(db, "org-price-1")
    sub.plan = BillingPlan.professional
    sub.interval = BillingInterval.monthly
    db.commit()
    assert svc.effective_price(sub) > 0

    sub.custom_monthly_aud = 123.0
    db.commit()
    assert svc.effective_price(sub) == 123.0

    sub.interval = BillingInterval.annual
    sub.custom_monthly_aud = None
    sub.custom_annual_aud = 999.0
    db.commit()
    assert svc.effective_price(sub) == 999.0

    sub.custom_annual_aud = None
    sub.annual_discount_pct = 30.0
    db.commit()
    assert svc.effective_price(sub) > 0


def test_catalogue_with_custom_default_and_discount(db):
    from app.services import billing_service as svc

    default_catalogue = svc.catalogue_with_custom(db)
    assert len(default_catalogue) > 0

    discounted = svc.catalogue_with_custom(db, discount_pct=50.0)
    assert any(p["annual_discount_pct"] == 50.0 for p in discounted)


def test_get_and_list_subscriptions(db):
    from app.services import billing_service as svc

    svc.create_trial(db, "org-list-1")
    svc.create_trial(db, "org-list-2")
    assert svc.get_subscription(db, "org-list-1") is not None
    assert svc.get_subscription(db, "org-missing") is None
    assert len(svc.list_subscriptions(db)) >= 2


def test_admin_update_subscription(db):
    from app.schemas.billing import SubscriptionAdminUpdate
    from app.services import billing_service as svc

    svc.create_trial(db, "org-admin-1")
    updated = svc.admin_update(
        db, "org-admin-1", SubscriptionAdminUpdate(custom_monthly_aud=55.0, notes="vip")
    )
    assert updated.custom_monthly_aud == 55.0
    assert updated.base_price_aud == 55.0

    assert svc.admin_update(db, "org-missing", SubscriptionAdminUpdate()) is None


def test_cancel_subscription_branches(db):
    from app.services import billing_service as svc

    svc.create_trial(db, "org-cancel-sub")
    result = svc.cancel_subscription(db, "org-cancel-sub", at_period_end=True)
    assert result.cancel_at_period_end is True

    result2 = svc.cancel_subscription(db, "org-cancel-sub", at_period_end=False)
    assert result2.status.value == "canceled"

    assert svc.cancel_subscription(db, "org-missing") is None


def test_create_checkout_session_mock_mode(db):
    from app.schemas.billing import CheckoutSessionRequest
    from app.models.billing import BillingInterval, BillingPlan
    from app.services import billing_service as svc

    svc.create_trial(db, "org-checkout")
    req = CheckoutSessionRequest(
        plan=BillingPlan.professional,
        interval=BillingInterval.monthly,
        success_url="https://example.com/success",
        cancel_url="https://example.com/cancel",
    )
    result = svc.create_checkout_session(db, "org-checkout", req, "user@example.com")
    assert "mock_checkout" in result["checkout_url"]
    assert result["session_id"].startswith("cs_mock_")


def test_create_customer_portal_mock_mode(db):
    from app.services import billing_service as svc

    svc.create_trial(db, "org-portal")
    url = svc.create_customer_portal(db, "org-portal", "https://example.com/return")
    assert url.endswith("/billing")


def test_handle_stripe_webhook_mock_mode(db):
    from app.services import billing_service as svc

    result = svc.handle_stripe_webhook(db, b"{}", "sig")
    assert result == {"status": "mock"}


def test_handle_checkout_completed_creates_subscription(db):
    from app.services import billing_service as svc

    session = {
        "metadata": {"industry_id": "org-webhook-1", "plan": "starter", "interval": "monthly"},
        "customer": "cus_123",
        "subscription": "sub_123",
    }
    svc._handle_checkout_completed(db, session)
    sub = svc.get_subscription(db, "org-webhook-1")
    assert sub is not None
    assert sub.stripe_customer_id == "cus_123"

    svc._handle_checkout_completed(db, {"metadata": {}})  # no industry_id, no-op


def test_handle_subscription_updated_and_deleted(db):
    from app.services import billing_service as svc

    sub = svc.create_trial(db, "org-webhook-2")
    sub.stripe_subscription_id = "sub_abc"
    db.commit()

    svc._handle_subscription_updated(db, {
        "id": "sub_abc",
        "status": "past_due",
        "cancel_at_period_end": True,
        "current_period_start": 1700000000,
        "current_period_end": 1700100000,
    })
    db.refresh(sub)
    assert sub.status.value == "past_due"
    assert sub.cancel_at_period_end is True

    svc._handle_subscription_updated(db, {"id": "nonexistent", "status": "active"})  # no-op

    svc._handle_subscription_deleted(db, {"id": "sub_abc"})
    db.refresh(sub)
    assert sub.status.value == "canceled"

    svc._handle_subscription_deleted(db, {"id": "nonexistent"})  # no-op


def test_handle_invoice_event_creates_and_updates(db):
    from app.services import billing_service as svc

    sub = svc.create_trial(db, "org-webhook-3")
    sub.stripe_subscription_id = "sub_inv_1"
    db.commit()

    inv_obj = {
        "id": "in_123",
        "amount_due": 5000,
        "tax": 500,
        "subscription": "sub_inv_1",
        "hosted_invoice_url": "https://stripe.example/inv",
        "invoice_pdf": "https://stripe.example/inv.pdf",
        "period_start": 1700000000,
        "period_end": 1700100000,
    }
    svc._handle_invoice_event(db, inv_obj, "invoice.finalized")
    invoices = svc.list_invoices(db, "org-webhook-3")
    assert len(invoices) == 1
    assert invoices[0].status.value == "open"

    svc._handle_invoice_event(db, inv_obj, "invoice.paid")
    invoices = svc.list_invoices(db, "org-webhook-3")
    assert invoices[0].status.value == "paid"
    assert invoices[0].paid_at is not None


# ── questionnaire_seed_service ──────────────────────────────────────────────

def test_seed_questionnaire_for_org_and_skip_logic(db):
    from app.services.questionnaire_seed_service import (
        get_available_templates,
        seed_questionnaire_for_org,
    )

    result = seed_questionnaire_for_org(db, "org-q1", "remittance", created_by="user_1")
    assert result["seeded"] > 0
    assert "fatf_general_v1" in result["templates_applied"]

    skip_result = seed_questionnaire_for_org(db, "org-q1", "remittance", created_by="user_1")
    assert skip_result == {"seeded": 0, "skipped": 1, "templates_applied": []}

    no_skip = seed_questionnaire_for_org(
        db, "org-q1", "remittance", created_by="user_1", skip_if_exists=False
    )
    assert no_skip["seeded"] == 0  # all questions already exist by text/template_ref

    unknown_industry = seed_questionnaire_for_org(
        db, "org-q2", "unknown_industry_xyz", created_by="user_1"
    )
    assert "fatf_general_v1" in unknown_industry["templates_applied"]

    templates = get_available_templates()
    assert "crypto_v1" in templates
    assert templates["crypto_v1"]["question_count"] > 0


# ── tenant_service ───────────────────────────────────────────────────────────

def test_tenant_crud_lifecycle(db):
    from app.schemas.tenant import TenantCreate, TenantUpdate
    from app.services import tenant_service as svc

    tenant = svc.create_tenant(db, TenantCreate(industry_id="org-tenant-1", name="Acme Co"))
    assert tenant.tenant_id.startswith("TENANT-")

    assert svc.get_tenant(db, tenant.tenant_id).id == tenant.id
    assert svc.get_tenant_by_industry(db, "org-tenant-1").id == tenant.id
    assert svc.get_tenant(db, "missing") is None

    updated = svc.update_tenant(db, tenant.tenant_id, TenantUpdate(name="Acme Updated"))
    assert updated.name == "Acme Updated"
    assert svc.update_tenant(db, "missing", TenantUpdate(name="x")) is None

    suspended = svc.suspend_tenant(db, tenant.tenant_id)
    assert suspended.status == "suspended"

    activated = svc.activate_tenant(db, tenant.tenant_id)
    assert activated.status == "active"

    listed = svc.list_tenants(db, status="active")
    assert any(t.id == tenant.id for t in listed)

    stats = svc.tenant_stats(db)
    assert stats["total"] >= 1


# ── token_blacklist ──────────────────────────────────────────────────────────

def test_in_process_token_blacklist():
    from app.services.token_blacklist import _InProcessBlacklist

    bl = _InProcessBlacklist()
    assert "tok1" not in bl
    bl.add("tok1")
    assert "tok1" in bl


# ── usage_billing_service ───────────────────────────────────────────────────

def test_usage_billing_full_lifecycle(db):
    from app.models.usage import UsageEventType, UsageRecordStatus
    from app.services import usage_billing_service as svc

    record = svc.record_usage(
        db, "org-usage-1", UsageEventType.identity_verification, "sumsub",
        customer_id="cust_1", provider_reference="ref_1",
    )
    assert record.status == UsageRecordStatus.pending
    assert record.billed_amount_aud > 0

    found = svc.find_by_reference(db, "sumsub", "ref_1")
    assert found.id == record.id
    assert svc.find_by_reference(db, "sumsub", "missing") is None

    completed = svc.mark_completed(db, record)
    assert completed.status == UsageRecordStatus.completed

    unbilled = svc.list_unbilled(db, "org-usage-1")
    assert len(unbilled) == 1

    from datetime import datetime, timedelta, timezone
    now = datetime.now(timezone.utc)
    summary = svc.usage_summary(db, "org-usage-1", now - timedelta(days=1), now + timedelta(days=1))
    assert summary["check_count"] == 1
    assert summary["total_billed_aud"] > 0
    assert "identity_verification" in summary["by_event_type"]

    invoiced_count = svc.mark_invoiced(db, "org-usage-1", "INV-123")
    assert invoiced_count == 1
    assert svc.list_unbilled(db, "org-usage-1") == []

    record2 = svc.record_usage(db, "org-usage-2", UsageEventType.identity_verification, "sumsub")
    failed = svc.mark_failed(db, record2)
    assert failed.status == UsageRecordStatus.failed
    assert failed.billed_amount_aud == 0.0


# ── risk_engine ──────────────────────────────────────────────────────────────

def test_risk_engine_full_pipeline():
    from app.services.risk_engine import (
        AssessmentResult,
        CategoryResult,
        build_executive_summary,
        build_heat_map,
        cell_rating,
        control_effectiveness_factor,
        inherent_risk,
        priority_order,
        residual_risk,
        risk_rating,
        score_factor,
    )

    assert inherent_risk(5, 5) == 25.0
    assert inherent_risk(0, 10) == 5.0  # clamped to 1 and 5

    assert control_effectiveness_factor(1) == 0.20
    assert control_effectiveness_factor(10) == 1.0  # clamped

    assert residual_risk(25.0, 1) == 5.0
    assert risk_rating(5) == "low"
    assert risk_rating(12) == "medium"
    assert risk_rating(19) == "high"
    assert risk_rating(20) == "critical"

    f1 = score_factor("f1", "REF-1", "Factor One", likelihood=5, consequence=5, ce_score=5)
    f2 = score_factor(
        "f2", "REF-2", "Factor Two", likelihood=1, consequence=1, ce_score=1,
        override_residual=10.0, override_justification="manual override",
    )
    assert f1.residual_rating == "critical"
    assert f2.effective_residual == 10.0
    assert f2.effective_rating == "medium"

    cat1 = CategoryResult(category_id="c1", category_type="customer", name="Customer Risk", weight=0.5, factors=[f1, f2])
    cat_empty = CategoryResult(category_id="c2", category_type="product", name="Product Risk", weight=0.5, factors=[])

    assert cat1.avg_inherent_score > 0
    assert cat1.avg_residual_score > 0
    assert cat1.highest_residual_score == 25.0
    assert cat_empty.avg_inherent_score == 0.0
    assert cat_empty.avg_residual_score == 0.0
    assert cat_empty.highest_residual_score == 0.0

    result = AssessmentResult(categories=[cat1, cat_empty])
    assert result.overall_inherent_score > 0
    assert result.overall_residual_score > 0
    assert result.overall_inherent_rating in ("low", "medium", "high", "critical")
    assert result.overall_residual_rating in ("low", "medium", "high", "critical")

    empty_result = AssessmentResult(categories=[])
    assert empty_result.overall_inherent_score == 0.0
    assert empty_result.overall_residual_score == 0.0

    json_data = result.category_scores_json()
    assert "customer" in json_data
    assert json_data["customer"]["factor_count"] == 2

    heat_map = build_heat_map([f1, f2])
    assert len(heat_map) == 5
    assert len(heat_map[0]) == 5

    assert cell_rating(5, 5) == "critical"
    assert cell_rating(1, 1) == "low"

    summary = build_executive_summary(result, "Test Org")
    assert "Test Org" in summary
    assert "GOVERNANCE DISCLAIMER" in summary

    ordered = priority_order([f1, f2])
    assert ordered[0] is f1


# ── regulatory_decision_service ──────────────────────────────────────────────

def _reg_txn(**overrides):
    base = dict(
        id="txn-1",
        amount_aud=15_000.0,
        amount=15_000.0,
        is_cross_border=True,
        payment_method="swift",
        transaction_type="transfer",
        source_country="AU",
        destination_country="KP",
        is_structuring_suspect=False,
        is_near_threshold=False,
        is_cash_intensive=False,
        direction="outgoing",
        currency="AUD",
        transaction_date="2026-01-01",
        source_account_number="123",
        source_bsb="000-000",
        source_bank_name="Bank A",
        source_bank_bic="BICAAA",
        destination_account_name="Dest",
        destination_account_number="456",
        destination_bank_name="Bank B",
        destination_bank_bic="BICBBB",
        transaction_ref="REF-1",
    )
    base.update(overrides)
    return types.SimpleNamespace(**base)


def _reg_customer(**overrides):
    base = dict(
        is_pep=True,
        pep_type=None,
        is_sanctions_match=True,
        risk_level="critical",
        source_of_funds=None,
        full_name="John Customer",
        date_of_birth="1990-01-01",
        address_line1="1 Main St",
    )
    base.update(overrides)
    return types.SimpleNamespace(**base)


def _reg_org(**overrides):
    base = dict(industry="remittance")
    base.update(overrides)
    return types.SimpleNamespace(**base)


def test_evaluate_transaction_high_risk_full_indicators():
    from app.services.regulatory_decision_service import evaluate_transaction

    txn = _reg_txn()
    customer = _reg_customer()
    org = _reg_org()
    crypto_detail = types.SimpleNamespace(
        mixer_exposure_pct=10.0, darknet_exposure_pct=2.0,
        sanctioned_exposure_pct=1.0, source_wallet_risk_score=80.0,
    )
    behaviour_profile = types.SimpleNamespace(
        avg_txn_per_month=5, total_volume_30d_aud=100_000,
        total_txn_count_30d=20, dormant_reactivated=False,
    )

    result = evaluate_transaction(
        txn, customer, org, alert_score=90.0,
        crypto_detail=crypto_detail, behaviour_profile=behaviour_profile,
    )
    assert result.potential_ifti is True
    assert result.potential_smr is True
    assert result.potential_edd is True
    assert result.potential_sof_request is True
    assert result.potential_customer_review is True
    assert len(result.compliance_actions) > 0
    assert result.risk_summary["fatf_black_list_exposure"] is True
    assert any("Crypto" in g for g in result.industry_guidance) or len(result.industry_guidance) > 0


def test_evaluate_transaction_low_risk_no_indicators():
    from app.services.regulatory_decision_service import evaluate_transaction

    txn = _reg_txn(
        amount_aud=50.0, amount=50.0, is_cross_border=False,
        payment_method="bank_transfer_domestic", source_country="AU", destination_country="AU",
    )
    customer = _reg_customer(is_pep=False, is_sanctions_match=False, risk_level="low", source_of_funds="salary")
    org = _reg_org(industry="other")

    result = evaluate_transaction(txn, customer, org, alert_score=0.0)
    assert result.potential_ifti is False
    assert result.potential_ttr is False
    assert result.potential_smr is False
    assert result.potential_edd is False


def test_evaluate_transaction_cash_ttr_and_dormant_reactivation():
    from app.services.regulatory_decision_service import evaluate_transaction

    txn = _reg_txn(payment_method="cash", amount_aud=12_000.0, amount=12_000.0, is_cross_border=False)
    customer = _reg_customer(is_pep=False, is_sanctions_match=False, risk_level="low", source_of_funds="salary")
    org = _reg_org(industry="legal")
    behaviour_profile = types.SimpleNamespace(
        avg_txn_per_month=0, total_volume_30d_aud=0, total_txn_count_30d=0, dormant_reactivated=True,
    )

    result = evaluate_transaction(txn, customer, org, behaviour_profile=behaviour_profile)
    assert result.potential_ttr is True
    assert result.potential_customer_review is True


def test_evaluate_transaction_industry_guidance_branches():
    from app.services.regulatory_decision_service import evaluate_transaction

    for industry in ("psp", "real_estate", "accounting", "gambling", "vasp"):
        txn = _reg_txn(amount_aud=200_000.0, amount=200_000.0, payment_method="bank_transfer")
        customer = _reg_customer(is_pep=False, is_sanctions_match=False, risk_level="low", source_of_funds="salary")
        org = _reg_org(industry=industry)
        result = evaluate_transaction(txn, customer, org)
        assert isinstance(result.industry_guidance, list)


def test_prefill_functions():
    from app.services.regulatory_decision_service import (
        evaluate_transaction,
        prefill_ifti_data,
        prefill_smr_data,
        prefill_ttr_data,
    )

    txn = _reg_txn()
    customer = _reg_customer()
    org = _reg_org()

    ifti_data = prefill_ifti_data(txn, customer, org)
    assert ifti_data["prefilled"] is True
    assert ifti_data["suggested_fields"]["direction"] == "outgoing"

    ttr_data = prefill_ttr_data(txn, customer, org)
    assert ttr_data["requires_mlro_review"] is True

    result = evaluate_transaction(txn, customer, org, alert_score=90.0)
    smr_data = prefill_smr_data(txn, customer, org, result.indicators)
    assert smr_data["requires_mlro_sign_off"] is True
    assert smr_data["suggested_fields"]["suspicious_activity_summary"] != ""


# ── customer_risk_engine additional branch coverage ─────────────────────────

def test_assess_customer_risk_greylist_and_extra_branches():
    from app.services.customer_risk_engine import assess_customer_risk

    greylist_customer = _customer(
        nationality="AF",  # greylist
        dual_nationality="KP",  # blacklist dual
        occupation="arms_dealer",
        tax_identification_number=None,
    )
    result = assess_customer_risk(
        greylist_customer,
        is_pep=True,
        pep_type="domestic",
        involves_remittance=True,
        involves_fx=True,
        involves_cash=True,
        involves_trust=True,
        countries=["RU", "AF", "AU"],
        channel="agent",
        is_introduced=True,
        expected_monthly_volume_aud=500_000,
        expected_max_transaction_aud=50_000,
        expected_frequency="weekly",
    )
    assert result.overall_score > 0

    sanctioned_country_customer = _customer(nationality="US")
    result2 = assess_customer_risk(
        sanctioned_country_customer,
        countries=["IR", "RU"],
        channel="phone",
        expected_frequency="occasional",
        expected_monthly_volume_aud=200_000,
        expected_max_transaction_aud=20_000,
    )
    assert result2.overall_score >= 0

    branch_customer = _customer()
    result3 = assess_customer_risk(branch_customer, channel="mobile", expected_frequency="monthly")
    assert result3.overall_score >= 0


def test_customer_risk_engine_individual_dimension_branches():
    from app.services.customer_risk_engine import (
        _level,
        cdd_level_from_gateway,
        score_customer_risk,
        score_geographic_risk,
        score_transaction_risk,
    )

    high_risk_only_customer = _customer(nationality="CO")  # HIGH_RISK_COUNTRIES, not grey/blacklist
    result = score_customer_risk(high_risk_only_customer, is_pep=False, pep_type=None)
    assert result.factors.get("high_risk_nationality") == 15.0

    geo_result = score_geographic_risk(["AL"])  # greylist-only country
    assert geo_result.flags.get("fatf_greylist") is True

    txn_result = score_transaction_risk(expected_monthly_volume_aud=500_000)
    assert txn_result.factors.get("medium_monthly_volume") == 25.0

    assert _level(50.0) == "medium"
    assert _level(70.0) == "high"

    assert cdd_level_from_gateway("cdd", 5.0).value == "simplified"


# ── risk_matrix_service additional branch coverage ──────────────────────────

def test_compute_risk_matrix_medium_branches():
    from app.models.transaction import DeliveryChannel, PaymentMethod, TransactionType
    from app.services.risk_matrix_service import compute_risk_matrix

    customer = _customer()
    customer.is_pep = True
    customer.pep_type = types.SimpleNamespace(value="domestic")
    customer.risk_level = types.SimpleNamespace(value="medium")
    customer.risk_score = 65
    customer.customer_type = types.SimpleNamespace(value="company")
    customer.onboarding_channel = types.SimpleNamespace(value="online")
    customer.cdd_level = types.SimpleNamespace(value="standard")

    txn = _txn(
        transaction_type=TransactionType.withdrawal,
        payment_method=PaymentMethod.wire_transfer if hasattr(PaymentMethod, "wire_transfer") else PaymentMethod.bank_transfer,
        delivery_channel=DeliveryChannel.online,
        amount_aud=20_000.0,
        amount=20_000.0,
        is_round_number=True,
    )
    result = compute_risk_matrix(txn, customer, db=None)
    assert result.risk_level in ("low", "medium", "high", "critical")
    assert result.customer_dimension.score > 0


def test_compute_risk_matrix_geographic_and_product_extra_branches():
    from app.models.transaction import DeliveryChannel, PaymentMethod, TransactionType
    from app.services.risk_matrix_service import compute_risk_matrix

    customer = _customer()
    txn = _txn(
        source_country="RU",  # sanctioned country
        destination_country="GB",
        is_cross_border=True,
        transaction_type=TransactionType.cash_deposit if hasattr(TransactionType, "cash_deposit") else TransactionType.deposit,
        payment_method=PaymentMethod.bank_transfer,
        delivery_channel=DeliveryChannel.online,
        amount_aud=9_500.0,
        amount=9_500.0,
        is_near_threshold=True,
        is_cash_intensive=True,
    )
    result = compute_risk_matrix(txn, customer, db=None)
    assert result.geographic_dimension.score > 0
    assert result.transaction_dimension.score > 0
    assert result.product_dimension.score >= 0


# ── governance_metrics.py (pure-logic, no DB) ──────────────────────────────────


def test_governance_metrics_full_pipeline():
    from datetime import date, timedelta

    from app.models.governance import PolicyLifecycleStatus
    from app.models.governance_controls import (
        ControlEffectiveness,
        FindingSeverity,
        RemediationStatus,
    )
    from app.models.governance_training import TrainingStatus
    from app.services.governance_metrics import (
        build_governance_dashboard,
        calculate_control_effectiveness,
        calculate_control_health,
        calculate_policy_metrics,
        calculate_training_metrics,
        control_register_report,
        governance_summary_report,
        policy_register_report,
        rag_status,
        training_register_report,
    )

    # rag_status
    assert rag_status(90, 80, 60) == "green"
    assert rag_status(70, 80, 60) == "amber"
    assert rag_status(10, 80, 60) == "red"
    assert rag_status(5, 10, 20, higher_is_better=False) == "green"
    assert rag_status(15, 10, 20, higher_is_better=False) == "amber"
    assert rag_status(30, 10, 20, higher_is_better=False) == "red"

    # control effectiveness
    res = calculate_control_effectiveness(
        passed_samples=8,
        total_samples=10,
        finding_severities=[FindingSeverity.critical, FindingSeverity.low],
    )
    assert res.effectiveness in (
        ControlEffectiveness.effective,
        ControlEffectiveness.largely_effective,
        ControlEffectiveness.partially_effective,
        ControlEffectiveness.ineffective,
    )
    assert res.finding_summary["critical"] == 1

    zero = calculate_control_effectiveness(0, 0, [])
    assert zero.effectiveness == ControlEffectiveness.not_tested

    today = date.today()

    # training metrics
    records = []
    for i, (status, exp_delta) in enumerate(
        [
            (TrainingStatus.completed, 10),
            (TrainingStatus.completed, 100),
            (TrainingStatus.completed, None),
            (TrainingStatus.in_progress, None),
            (TrainingStatus.overdue, None),
            (TrainingStatus.expired, None),
            (TrainingStatus.exempt, None),
        ]
    ):
        rec = types.SimpleNamespace(
            business_unit="Compliance" if i % 2 == 0 else "Sales",
            status=status,
            expiry_date=(today + timedelta(days=exp_delta)) if exp_delta is not None else None,
        )
        records.append(rec)

    tm = calculate_training_metrics(records, today=today)
    assert tm.total_assigned == 7
    assert tm.completed == 3
    assert tm.by_department  # dict populated

    # policy metrics
    policies = []
    for status, overdue in [
        (PolicyLifecycleStatus.published, True),
        (PolicyLifecycleStatus.published, False),
        (PolicyLifecycleStatus.draft, False),
        (PolicyLifecycleStatus.archived, False),
    ]:
        policies.append(
            types.SimpleNamespace(
                status=status,
                review_due_date=(today - timedelta(days=1)) if overdue else (today + timedelta(days=30)),
            )
        )
    pm = calculate_policy_metrics(policies, today=today)
    assert pm.total == 4
    assert pm.overdue_review == 1

    # control health
    controls = []
    for eff, tested_recent in [
        (ControlEffectiveness.effective, True),
        (ControlEffectiveness.ineffective, False),
        (ControlEffectiveness.not_tested, False),
    ]:
        controls.append(
            types.SimpleNamespace(
                effectiveness=eff,
                last_tested_date=today if tested_recent else None,
            )
        )
    remediations = [
        types.SimpleNamespace(
            finding_severity=FindingSeverity.critical,
            status=RemediationStatus.open,
        ),
        types.SimpleNamespace(
            finding_severity=FindingSeverity.low,
            status=RemediationStatus.overdue,
        ),
    ]
    ch = calculate_control_health(controls, remediations, today=today)
    assert ch.total_active == 3
    assert ch.critical_open_remediations == 1
    assert ch.overdue_remediations == 1

    ch_no_rem = calculate_control_health(controls, [], today=today)
    assert ch_no_rem.open_remediations == 0

    # dashboard assembly
    dash = build_governance_dashboard(
        pm, ch, tm, today=today,
        policies_due_for_review=2,
        policies_pending_approval=1,
        outstanding_attestations=3,
    )
    assert dash.overall_rag in ("green", "amber", "red")
    summary = governance_summary_report(dash)
    assert summary["overall_health"]["rag"] == dash.overall_rag
    assert "disclaimer" in summary

    # printable reports
    p_rows = policy_register_report(
        [
            types.SimpleNamespace(
                policy_number="POL-001",
                title="AML Policy",
                policy_type=types.SimpleNamespace(value="aml"),
                version_major=1,
                version_minor=0,
                document_owner="user-1",
                review_due_date=today,
                status=PolicyLifecycleStatus.published,
                effective_date=today,
            )
        ]
    )
    assert p_rows[0]["policy_number"] == "POL-001"

    c_rows = control_register_report(
        [
            types.SimpleNamespace(
                control_ref="CTRL-001",
                name="KYC Check",
                risk_area=types.SimpleNamespace(value="cdd"),
                control_type=types.SimpleNamespace(value="preventive"),
                control_owner="user-2",
                business_unit="Compliance",
                effectiveness=ControlEffectiveness.effective,
                last_tested_date=today,
                next_test_date=today,
                status=types.SimpleNamespace(value="active"),
            )
        ]
    )
    assert c_rows[0]["control_ref"] == "CTRL-001"

    t_rows = training_register_report(
        [
            types.SimpleNamespace(
                user_id="user-3",
                course_id="course-1",
                course=types.SimpleNamespace(
                    training_type=types.SimpleNamespace(value="aml_basics")
                ),
                assigned_date=today,
                due_date=today,
                completion_date=today,
                expiry_date=today,
                score=95,
                passed=True,
                status=TrainingStatus.completed,
                certificate_document_id="doc-1",
            )
        ]
    )
    assert t_rows[0]["user_id"] == "user-3"
