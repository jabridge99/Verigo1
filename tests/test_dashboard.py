"""
P54: real coverage for app/api/routes/dashboard.py (21% covered before this
file existed) -- the main global + industry admin dashboard, the landing
page every analyst/admin hits after login, aggregating data across nearly
every other module. The module's own docstring states "No cross-tenant
data leakage" as a hard requirement -- that's the property these tests
center on, seeding a second, unrelated org's data in every test and
asserting the dashboard never counts it.

Real request-level tests: seed known counts via the ORM, call the real
endpoint through the API, and assert exact returned numbers/formula
outputs -- not just a 200 status or key presence.
"""

import uuid
from datetime import date, datetime, timedelta, timezone

from app.models.case import Case, CaseSeverity, CaseStatus, CaseType
from app.models.compliance_calendar import CalendarItemStatus, CalendarItemType, ComplianceCalendarItem
from app.models.customer import Customer, CustomerStatus, CustomerType, RiskLevel
from app.models.monitoring import AlertCategory, AlertSeverity, AlertStatus, AlertType, TransactionAlert
from app.models.professional_assessment import (
    AssessmentRiskRating,
    AssessmentStatus,
    ProfessionalAssessment,
    ProfessionalServiceType,
    TaxRiskAssessment,
)
from app.models.report import IFTIDirection, IFTIReport, ReportStatus, SMRReport, TTRReport
from app.models.screening import CryptoNetwork, CryptoProvider, CryptoWalletScreening, WalletRiskCategory
from app.models.transaction import Transaction, TransactionType
from tests.conftest import UserRole, _auth, _make_org, _make_user


def _customer(db, org_id, **overrides):
    defaults = dict(
        customer_ref=f"CUST-{uuid.uuid4().hex[:8]}",
        org_id=org_id,
        customer_type=CustomerType.individual,
        full_name="Test Customer",
        risk_level=RiskLevel.low,
        status=CustomerStatus.active,
    )
    defaults.update(overrides)
    c = Customer(**defaults)
    db.add(c)
    db.commit()
    db.refresh(c)
    return c


def _alert(db, org_id, **overrides):
    if "customer_id" not in overrides:
        overrides["customer_id"] = _customer(db, org_id).id
    if "transaction_id" not in overrides:
        overrides["transaction_id"] = _txn(db, org_id, overrides["customer_id"]).id
    defaults = dict(
        id=f"alrt_{uuid.uuid4().hex[:10]}",
        alert_ref=f"ALRT-{uuid.uuid4().hex[:8]}",
        org_id=org_id,
        alert_type=AlertType.rule_triggered,
        category=AlertCategory.custom,
        severity=AlertSeverity.medium,
        status=AlertStatus.generated,
        title="Test alert",
        trigger_date=datetime.now(timezone.utc),
    )
    defaults.update(overrides)
    a = TransactionAlert(**defaults)
    db.add(a)
    db.commit()
    return a


def _case(db, org_id, **overrides):
    defaults = dict(
        id=f"case_{uuid.uuid4().hex[:12]}",
        case_ref=f"CASE-{uuid.uuid4().hex[:8]}",
        org_id=org_id,
        case_type=CaseType.other,
        severity=CaseSeverity.medium,
        status=CaseStatus.open,
        title="Test case",
        created_by="someone",
        created_at=datetime.now(timezone.utc),
    )
    defaults.update(overrides)
    c = Case(**defaults)
    db.add(c)
    db.commit()
    return c


def _txn(db, org_id, customer_id, **overrides):
    defaults = dict(
        id=f"txn_{uuid.uuid4().hex[:12]}",
        org_id=org_id,
        transaction_ref=f"TXN-{uuid.uuid4().hex[:8]}",
        customer_id=customer_id,
        transaction_type=TransactionType.transfer,
        direction="outgoing",
        payment_method="bank_transfer",
        amount=1000.0,
        amount_aud=1000.0,
        currency="AUD",
        transaction_date=datetime.now(timezone.utc),
    )
    defaults.update(overrides)
    t = Transaction(**defaults)
    db.add(t)
    db.commit()
    return t


def _cal_item(db, org_id, **overrides):
    defaults = dict(
        id=f"cal_{uuid.uuid4().hex[:12]}",
        org_id=org_id,
        item_type=CalendarItemType.aml_program_review,
        status=CalendarItemStatus.scheduled,
        title="Test calendar item",
        due_date=date.today(),
    )
    defaults.update(overrides)
    item = ComplianceCalendarItem(**defaults)
    db.add(item)
    db.commit()
    return item


def _org_pair(db):
    """Two real orgs -- 'own' and 'other' -- for tenant-isolation checks."""
    own = _make_user(db, UserRole.analyst)
    other = _make_org(db)
    return own, other.id


class TestGlobalDashboardTenantIsolationAndAggregation:
    def test_counts_only_this_orgs_data_not_the_other_orgs(self, client, db):
        own_user, other_org_id = _org_pair(db)
        own_customer = _customer(db, own_user.org_id)
        other_customer = _customer(db, other_org_id)

        # Own org: 1 open critical alert, 1 SMR candidate.
        _alert(
            db, own_user.org_id, customer_id=own_customer.id,
            severity=AlertSeverity.critical, status=AlertStatus.generated,
            is_smr_candidate=True,
        )
        # Other org: noise that must NOT be counted.
        _alert(db, other_org_id, customer_id=other_customer.id, severity=AlertSeverity.critical, status=AlertStatus.generated)
        _alert(db, other_org_id, customer_id=other_customer.id, severity=AlertSeverity.critical, status=AlertStatus.generated)

        # Own org: 1 open case.
        _case(db, own_user.org_id, customer_id=own_customer.id)
        # Other org noise.
        _case(db, other_org_id, customer_id=other_customer.id)
        _case(db, other_org_id, customer_id=other_customer.id)

        # Own org: 1 high-risk, 1 PEP customer (plus own_customer = low risk).
        _customer(db, own_user.org_id, risk_level=RiskLevel.high)
        _customer(db, own_user.org_id, is_pep=True)
        # Other org noise.
        _customer(db, other_org_id, risk_level=RiskLevel.critical)

        headers = _auth(own_user)
        resp = client.get("/api/v1/dashboard/global", headers=headers)
        assert resp.status_code == 200, resp.text
        body = resp.json()

        assert body["alerts"]["open"] == 1
        assert body["alerts"]["critical"] == 1
        assert body["alerts"]["smr_candidates"] == 1
        assert body["cases"]["open"] == 1
        # own_customer (low) + high-risk + pep = 3 total for this org.
        assert body["customers"]["total"] == 3
        assert body["customers"]["high_risk"] == 1
        assert body["customers"]["pep"] == 1

    def test_traffic_lights_and_risk_score_computed_from_real_counts(self, client, db):
        own_user, _ = _org_pair(db)
        customer = _customer(db, own_user.org_id)

        # 2 open alerts (1 critical), 1 open case, 1 SMR candidate, 1 IFTI overdue.
        _alert(db, own_user.org_id, severity=AlertSeverity.critical, status=AlertStatus.generated)
        _alert(db, own_user.org_id, severity=AlertSeverity.low, status=AlertStatus.assigned)
        # 3 closed (not "open") alerts in the prior 30-60 day window -- more
        # than this period's 2, giving trend_30d="down" -- without affecting
        # the open_alerts/critical/risk_score counts computed below, which
        # only reason about currently-open alerts (no date filter of their
        # own).
        for _ in range(3):
            _alert(
                db, own_user.org_id, customer_id=customer.id,
                status=AlertStatus.resolved,
                trigger_date=datetime.now(timezone.utc) - timedelta(days=45),
            )
        _case(db, own_user.org_id, customer_id=customer.id)
        db.add(
            IFTIReport(
                org_id=own_user.org_id,
                direction=IFTIDirection.outgoing,
                status=ReportStatus.draft,
                date_received=date.today(),
                total_amount=5000.0,
                due_date=date.today() - timedelta(days=2),
            )
        )
        db.commit()

        headers = _auth(own_user)
        resp = client.get("/api/v1/dashboard/global", headers=headers)
        body = resp.json()

        # risk_score = open_alerts*2 (2*2=4) + critical*5 (1*5=5) + open_cases*3
        # (1*3=3) + smr_candidates*8 (0) + ifti_overdue*4 (1*4=4) + ttr_overdue*4 (0)
        # = 4+5+3+0+4+0 = 16
        assert body["org_risk"]["risk_score"] == 16
        assert body["org_risk"]["risk_level"] == "low"  # < 25
        # _traffic_light(16, warn=25, danger=50): nonzero and below warn -> amber.
        assert body["org_risk"]["traffic_light"] == "amber"
        assert body["reports"]["ifti_overdue"] == 1
        assert body["reports"]["total_overdue"] == 1
        # 2 alerts this period vs. 3 in the prior period -> "down".
        assert body["alerts"]["trend_30d"] == "down"


class TestComplianceScoreFormula:
    def test_perfect_score_with_no_issues(self, client, db):
        own_user, _ = _org_pair(db)
        headers = _auth(own_user)
        resp = client.get("/api/v1/dashboard/compliance-score", headers=headers)
        assert resp.status_code == 200, resp.text
        body = resp.json()
        assert body["compliance_score"] == 100.0
        assert body["rating"] == "excellent"
        assert body["traffic_light"] == "green"

    def test_score_degrades_by_the_documented_weights(self, client, db):
        own_user, _ = _org_pair(db)
        customer = _customer(db, own_user.org_id, status=CustomerStatus.edd_required)

        # 3 critical alerts -> full 25% penalty (warn=3).
        for _ in range(3):
            _alert(db, own_user.org_id, severity=AlertSeverity.critical, status=AlertStatus.generated)
        # 2 overdue reports (1 IFTI + 1 TTR) -> full 25% penalty (warn=2).
        db.add(
            IFTIReport(
                org_id=own_user.org_id, direction=IFTIDirection.outgoing,
                status=ReportStatus.draft, date_received=date.today(),
                total_amount=1000.0, due_date=date.today() - timedelta(days=1),
            )
        )
        db.add(
            TTRReport(
                org_id=own_user.org_id, status=ReportStatus.draft,
                transaction_date=date.today(), total_amount=15000.0,
                due_date=date.today() - timedelta(days=1),
            )
        )
        # 1 escalated case out of warn=3 -> 1/3 * 15 = 5.0 penalty.
        _case(db, own_user.org_id, customer_id=customer.id, status=CaseStatus.escalated)
        db.commit()

        headers = _auth(own_user)
        resp = client.get("/api/v1/dashboard/compliance-score", headers=headers)
        body = resp.json()

        # 100 - 25 (critical) - 25 (reports) - 0 (cal) - 15 (edd: 1/5*15=3, not full)
        # - 5 (escalated: 1/3*15=5)
        # edd_pending count = 1 (the customer created above) -> penalty = 1/5*15 = 3.0
        expected = 100.0 - 25.0 - 25.0 - 0.0 - 3.0 - 5.0
        assert body["compliance_score"] == round(expected, 1)
        assert body["components"]["critical_alerts"] == 3
        assert body["components"]["overdue_reports"] == 2
        assert body["components"]["escalated_cases"] == 1
        assert body["components"]["edd_pending"] == 1

    def test_other_orgs_issues_do_not_affect_this_orgs_score(self, client, db):
        own_user, other_org_id = _org_pair(db)
        for _ in range(5):
            _alert(db, other_org_id, severity=AlertSeverity.critical, status=AlertStatus.generated)

        headers = _auth(own_user)
        resp = client.get("/api/v1/dashboard/compliance-score", headers=headers)
        assert resp.json()["compliance_score"] == 100.0


class TestTrendEndpoints:
    def test_alert_trends_buckets_by_week_correctly(self, client, db):
        own_user, other_org_id = _org_pair(db)
        now = datetime.now(timezone.utc)

        # 2 alerts this week, 1 alert 2 weeks ago, plus noise in another org.
        _alert(db, own_user.org_id, trigger_date=now - timedelta(days=1))
        _alert(db, own_user.org_id, trigger_date=now - timedelta(days=2))
        _alert(db, own_user.org_id, trigger_date=now - timedelta(days=15))
        _alert(db, other_org_id, trigger_date=now - timedelta(days=1))

        headers = _auth(own_user)
        resp = client.get("/api/v1/dashboard/trends/alerts?days=21", headers=headers)
        assert resp.status_code == 200, resp.text
        body = resp.json()
        assert body["days"] == 21
        assert len(body["data"]) == 3  # 21 // 7 weeks
        total_alerts = sum(week["alerts"] for week in body["data"])
        assert total_alerts == 3  # only this org's 3 alerts, not the 4th

    def test_case_trends_buckets_by_week_correctly(self, client, db):
        own_user, _ = _org_pair(db)
        customer = _customer(db, own_user.org_id)
        now = datetime.now(timezone.utc)
        _case(db, own_user.org_id, customer_id=customer.id, created_at=now - timedelta(days=1))
        _case(db, own_user.org_id, customer_id=customer.id, created_at=now - timedelta(days=10))

        headers = _auth(own_user)
        resp = client.get("/api/v1/dashboard/trends/cases?days=14", headers=headers)
        body = resp.json()
        assert len(body["data"]) == 2
        assert sum(week["cases"] for week in body["data"]) == 2


class TestRemittanceDashboard:
    def test_cross_border_and_high_risk_country_exposure(self, client, db):
        own_user, other_org_id = _org_pair(db)
        customer = _customer(db, own_user.org_id)
        other_customer = _customer(db, other_org_id)
        now = datetime.now(timezone.utc)

        # Blacklisted destination (KP), above the IFTI/TTR threshold.
        _txn(
            db, own_user.org_id, customer.id,
            is_cross_border=True, destination_country="KP",
            amount_aud=15000.0, transaction_date=now,
        )
        # Greylisted destination, below threshold.
        _txn(
            db, own_user.org_id, customer.id,
            is_cross_border=True, destination_country="NG",
            amount_aud=500.0, transaction_date=now,
        )
        # Structuring suspect.
        _txn(
            db, own_user.org_id, customer.id,
            is_cross_border=True, destination_country="AU",
            is_structuring_suspect=True, is_near_threshold=True,
            amount_aud=9500.0, transaction_date=now,
        )
        # Other org noise -- must not be counted.
        _txn(
            db, other_org_id, other_customer.id,
            is_cross_border=True, destination_country="KP",
            amount_aud=50000.0, transaction_date=now,
        )

        headers = _auth(own_user)
        resp = client.get("/api/v1/dashboard/industry/remittance", headers=headers)
        assert resp.status_code == 200, resp.text
        body = resp.json()
        assert body["cross_border"]["transactions_30d"] == 3
        assert body["cross_border"]["ifti_candidates_30d"] == 1  # only the KP txn >= threshold
        assert body["high_risk_country_exposure"]["blacklist_sanctioned_30d"] == 1
        assert body["high_risk_country_exposure"]["greylist_30d"] == 1
        assert body["structuring_indicators"]["near_threshold_30d"] == 1
        assert body["structuring_indicators"]["structuring_suspect_30d"] == 1


class TestCryptoDashboard:
    def test_wallet_risk_and_crypto_alerts(self, client, db):
        own_user, other_org_id = _org_pair(db)
        customer = _customer(db, own_user.org_id)
        other_customer = _customer(db, other_org_id)

        db.add(
            CryptoWalletScreening(
                org_id=own_user.org_id, customer_id=customer.id,
                wallet_address="0xSANCTIONED", network=CryptoNetwork.ethereum,
                provider=CryptoProvider.internal,
                risk_category=WalletRiskCategory.sanctioned,
            )
        )
        db.add(
            CryptoWalletScreening(
                org_id=own_user.org_id, customer_id=customer.id,
                wallet_address="0xMIXER", network=CryptoNetwork.bitcoin,
                provider=CryptoProvider.internal,
                risk_category=WalletRiskCategory.high_risk, mixer_exposure_pct=25.0,
            )
        )
        # Other org noise.
        db.add(
            CryptoWalletScreening(
                org_id=other_org_id, customer_id=other_customer.id,
                wallet_address="0xOTHER", network=CryptoNetwork.ethereum,
                provider=CryptoProvider.internal,
                risk_category=WalletRiskCategory.sanctioned,
            )
        )
        _alert(
            db, own_user.org_id,
            category=AlertCategory.crypto_mixer, status=AlertStatus.generated,
        )
        db.commit()

        headers = _auth(own_user)
        resp = client.get("/api/v1/dashboard/industry/crypto", headers=headers)
        assert resp.status_code == 200, resp.text
        body = resp.json()
        assert body["wallet_risk"]["sanctioned_hits"] == 1
        assert body["wallet_risk"]["high_risk_wallets"] == 2  # high_risk + sanctioned
        assert body["wallet_risk"]["mixer_exposure_wallets"] == 1
        assert body["blockchain_activity"]["open_crypto_alerts"] == 1


class TestProfessionalServiceDashboardsFilterByServiceType:
    def _pa(self, db, org_id, customer_id, service_type, **overrides):
        defaults = dict(
            id=f"pa_{uuid.uuid4().hex[:12]}",
            assessment_ref=f"PA-{uuid.uuid4().hex[:8]}",
            org_id=org_id,
            customer_id=customer_id,
            professional_service_type=service_type,
            status=AssessmentStatus.in_progress,
            overall_risk_rating=AssessmentRiskRating.medium,
            created_by="someone",
        )
        defaults.update(overrides)
        pa = ProfessionalAssessment(**defaults)
        db.add(pa)
        db.commit()
        db.refresh(pa)
        return pa

    def test_legal_dashboard_only_counts_lawyer_and_conveyancer_matters(self, client, db):
        own_user, _ = _org_pair(db)
        customer = _customer(db, own_user.org_id)

        self._pa(db, own_user.org_id, customer.id, ProfessionalServiceType.lawyer)
        self._pa(
            db, own_user.org_id, customer.id, ProfessionalServiceType.conveyancer,
            overall_risk_rating=AssessmentRiskRating.critical,
        )
        # Wrong service type -- must not be counted by the legal dashboard.
        self._pa(db, own_user.org_id, customer.id, ProfessionalServiceType.accountant)

        headers = _auth(own_user)
        resp = client.get("/api/v1/dashboard/industry/legal", headers=headers)
        assert resp.status_code == 200, resp.text
        body = resp.json()
        assert body["matters"]["total"] == 2
        assert body["matters"]["high_risk"] == 1

    def test_accountants_dashboard_counts_tax_risk_indicators(self, client, db):
        own_user, _ = _org_pair(db)
        customer = _customer(db, own_user.org_id)
        pa = self._pa(db, own_user.org_id, customer.id, ProfessionalServiceType.accountant)
        db.add(
            TaxRiskAssessment(
                assessment_id=pa.id, org_id=own_user.org_id, indicator_count=3,
            )
        )
        # Wrong service type for this dashboard.
        self._pa(db, own_user.org_id, customer.id, ProfessionalServiceType.lawyer)
        db.commit()

        headers = _auth(own_user)
        resp = client.get("/api/v1/dashboard/industry/accountants", headers=headers)
        assert resp.status_code == 200, resp.text
        body = resp.json()
        assert body["engagements"]["open"] == 1
        assert body["tax_risk_indicators"]["high_indicator_count"] == 1

    def test_real_estate_dashboard_counts_foreign_purchasers(self, client, db):
        own_user, _ = _org_pair(db)
        _customer(db, own_user.org_id, nationality="AU", status=CustomerStatus.active)
        _customer(db, own_user.org_id, nationality="CN", status=CustomerStatus.active)
        self._pa(db, own_user.org_id, _customer(db, own_user.org_id).id, ProfessionalServiceType.real_estate)

        headers = _auth(own_user)
        resp = client.get("/api/v1/dashboard/industry/real-estate", headers=headers)
        assert resp.status_code == 200, resp.text
        body = resp.json()
        assert body["foreign_purchasers"]["count"] == 1
        assert body["property_matters"]["open"] == 1


class TestDashboardAuth:
    def test_viewer_role_is_denied(self, client, db):
        viewer = _make_user(db, UserRole.viewer)
        resp = client.get("/api/v1/dashboard/global", headers=_auth(viewer))
        assert resp.status_code == 403
