"""
Global and Industry-specific Dashboard API.

Aggregates data from across all platform modules to provide:
  - Global admin dashboard (organisation-wide risk snapshot)
  - Industry-specific dashboards (remittance, crypto, legal, accountants, real estate)
  - Dashboard indicators: traffic lights, trends, risk movement

All counts are org-scoped. No cross-tenant data leakage.

DISCLAIMER: Dashboard indicators are compliance workflow tools only.
All risk decisions remain with the reporting entity.
"""

from datetime import datetime, timedelta, timezone

from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

from app.api.deps import org_id_for, require_analyst_or_above
from app.db.database import get_db
from app.models.case import Case, CaseStatus
from app.models.compliance_calendar import CalendarItemStatus, ComplianceCalendarItem
from app.models.customer import Customer, CustomerStatus, RiskLevel
from app.models.monitoring import AlertSeverity, AlertStatus, TransactionAlert
from app.models.report import IFTIReport, ReportStatus, SMRReport, TTRReport
from app.models.transaction import Transaction
from app.models.user import User

router = APIRouter(prefix="/dashboard", tags=["Dashboard"])

DISCLAIMER = (
    "Dashboard indicators are compliance workflow tools only. "
    "All risk decisions remain with the reporting entity."
)

# ── Helpers ───────────────────────────────────────────────────────────────────


def _now():
    return datetime.now(timezone.utc)


def _days_ago(n: int):
    return _now() - timedelta(days=n)


def _traffic_light(count: int, warn: int, danger: int) -> str:
    """green | amber | red"""
    if count == 0:
        return "green"
    if count < warn:
        return "amber"
    return "red"


def _trend(current: int, previous: int) -> str:
    """up | down | stable"""
    if current > previous:
        return "up"
    if current < previous:
        return "down"
    return "stable"


def _open_alert_statuses():
    return [
        AlertStatus.generated,
        AlertStatus.assigned,
        AlertStatus.under_review,
        AlertStatus.escalated,
        AlertStatus.smr_candidate,
    ]


def _open_case_statuses():
    return [
        CaseStatus.open,
        CaseStatus.under_investigation,
        CaseStatus.additional_information,
        CaseStatus.escalated,
        CaseStatus.decision,
    ]


def _pending_report_statuses():
    return [ReportStatus.draft, ReportStatus.under_review]


# ── Global Dashboard ──────────────────────────────────────────────────────────


@router.get("/global")
def global_dashboard(
    db: Session = Depends(get_db),
    current_user: User = Depends(require_analyst_or_above),
):
    """
    Organisation-wide compliance risk snapshot.

    Aggregates alerts, cases, reports, customers, calendar items,
    and recent audit events into a single dashboard response.

    Includes traffic-light indicators and 30-day trend comparisons.
    """
    org_id = org_id_for(current_user)
    now = _now()
    prev_period = _days_ago(30)

    # ── Alerts ────────────────────────────────────────────────────────────────
    alert_q = db.query(TransactionAlert).filter(TransactionAlert.org_id == org_id)
    open_alerts = alert_q.filter(
        TransactionAlert.status.in_(_open_alert_statuses())
    ).count()
    smr_candidates = alert_q.filter(TransactionAlert.is_smr_candidate == True).count()
    critical_alerts = alert_q.filter(
        TransactionAlert.severity == AlertSeverity.critical,
        TransactionAlert.status.in_(_open_alert_statuses()),
    ).count()
    alerts_30d = alert_q.filter(TransactionAlert.trigger_date >= prev_period).count()
    alerts_60_30d = alert_q.filter(
        TransactionAlert.trigger_date >= _days_ago(60),
        TransactionAlert.trigger_date < prev_period,
    ).count()

    by_severity = {
        sev.value: alert_q.filter(
            TransactionAlert.severity == sev,
            TransactionAlert.status.in_(_open_alert_statuses()),
        ).count()
        for sev in AlertSeverity
    }

    # ── Cases ─────────────────────────────────────────────────────────────────
    case_q = db.query(Case).filter(Case.org_id == org_id)
    open_cases = case_q.filter(Case.status.in_(_open_case_statuses())).count()
    escalated_cases = case_q.filter(Case.status == CaseStatus.escalated).count()
    cases_30d = case_q.filter(Case.created_at >= prev_period).count()
    cases_60_30d = case_q.filter(
        Case.created_at >= _days_ago(60), Case.created_at < prev_period
    ).count()

    # ── Reports ───────────────────────────────────────────────────────────────
    ifti_pending = (
        db.query(IFTIReport)
        .filter(
            IFTIReport.org_id == org_id,
            IFTIReport.status.in_(_pending_report_statuses()),
        )
        .count()
    )
    ttr_pending = (
        db.query(TTRReport)
        .filter(
            TTRReport.org_id == org_id,
            TTRReport.status.in_(_pending_report_statuses()),
        )
        .count()
    )
    smr_pending = (
        db.query(SMRReport)
        .filter(
            SMRReport.org_id == org_id,
            SMRReport.status.in_(_pending_report_statuses()),
        )
        .count()
    )

    # Overdue reports: past due_date and not submitted/acknowledged
    ifti_overdue = (
        db.query(IFTIReport)
        .filter(
            IFTIReport.org_id == org_id,
            IFTIReport.due_date < now,
            IFTIReport.status.in_(_pending_report_statuses()),
        )
        .count()
    )
    ttr_overdue = (
        db.query(TTRReport)
        .filter(
            TTRReport.org_id == org_id,
            TTRReport.due_date < now,
            TTRReport.status.in_(_pending_report_statuses()),
        )
        .count()
    )

    # ── Customers ─────────────────────────────────────────────────────────────
    cust_q = db.query(Customer).filter(Customer.org_id == org_id)
    total_customers = cust_q.count()
    high_risk_customers = cust_q.filter(
        Customer.risk_level.in_([RiskLevel.high, RiskLevel.critical])
    ).count()
    pep_customers = cust_q.filter(Customer.is_pep == True).count()
    pending_reviews = cust_q.filter(
        Customer.status == CustomerStatus.under_review
    ).count()
    edd_required = cust_q.filter(Customer.status == CustomerStatus.edd_required).count()
    by_risk_level = {
        lvl.value: cust_q.filter(Customer.risk_level == lvl).count() for lvl in RiskLevel
    }

    # ── Compliance Calendar ───────────────────────────────────────────────────
    cal_q = db.query(ComplianceCalendarItem).filter(
        ComplianceCalendarItem.org_id == org_id
    )
    upcoming_7d = cal_q.filter(
        ComplianceCalendarItem.due_date >= now,
        ComplianceCalendarItem.due_date <= now + timedelta(days=7),
        ComplianceCalendarItem.status.in_(
            [CalendarItemStatus.open, CalendarItemStatus.in_progress]
        ),
    ).count()
    upcoming_30d = cal_q.filter(
        ComplianceCalendarItem.due_date >= now,
        ComplianceCalendarItem.due_date <= now + timedelta(days=30),
        ComplianceCalendarItem.status.in_(
            [CalendarItemStatus.open, CalendarItemStatus.in_progress]
        ),
    ).count()
    overdue_items = cal_q.filter(
        ComplianceCalendarItem.due_date < now,
        ComplianceCalendarItem.status.in_(
            [CalendarItemStatus.open, CalendarItemStatus.in_progress]
        ),
    ).count()

    # ── Risk score (org-level composite) ─────────────────────────────────────
    # Simple composite: weighted alert/case/report risk counts
    risk_score = min(
        (open_alerts * 2)
        + (critical_alerts * 5)
        + (open_cases * 3)
        + (smr_candidates * 8)
        + (ifti_overdue * 4)
        + (ttr_overdue * 4),
        100,
    )
    org_risk_level = (
        "critical"
        if risk_score >= 75
        else "high"
        if risk_score >= 50
        else "medium"
        if risk_score >= 25
        else "low"
    )

    return {
        "generated_at": now.isoformat(),
        "org_risk": {
            "risk_score": risk_score,
            "risk_level": org_risk_level,
            "traffic_light": _traffic_light(risk_score, 25, 50),
        },
        "alerts": {
            "open": open_alerts,
            "critical": critical_alerts,
            "smr_candidates": smr_candidates,
            "by_severity": by_severity,
            "trend_30d": _trend(alerts_30d, alerts_60_30d),
            "new_30d": alerts_30d,
            "traffic_light": _traffic_light(open_alerts, 5, 20),
        },
        "cases": {
            "open": open_cases,
            "escalated": escalated_cases,
            "new_30d": cases_30d,
            "trend_30d": _trend(cases_30d, cases_60_30d),
            "traffic_light": _traffic_light(open_cases, 3, 10),
        },
        "reports": {
            "ifti_pending": ifti_pending,
            "ifti_overdue": ifti_overdue,
            "ttr_pending": ttr_pending,
            "ttr_overdue": ttr_overdue,
            "smr_pending": smr_pending,
            "total_pending": ifti_pending + ttr_pending + smr_pending,
            "total_overdue": ifti_overdue + ttr_overdue,
            "traffic_light": _traffic_light(ifti_overdue + ttr_overdue, 1, 3),
        },
        "customers": {
            "total": total_customers,
            "high_risk": high_risk_customers,
            "pep": pep_customers,
            "pending_review": pending_reviews,
            "edd_required": edd_required,
            "by_risk_level": by_risk_level,
            "traffic_light": _traffic_light(edd_required, 3, 10),
        },
        "compliance_calendar": {
            "overdue": overdue_items,
            "due_7d": upcoming_7d,
            "due_30d": upcoming_30d,
            "traffic_light": _traffic_light(overdue_items, 1, 5),
        },
        "smr_pipeline": {
            "candidates": smr_candidates,
            "pending_smr_reports": smr_pending,
            "traffic_light": _traffic_light(smr_candidates + smr_pending, 1, 3),
        },
        "disclaimer": DISCLAIMER,
    }


# ── Industry Dashboards ───────────────────────────────────────────────────────


@router.get("/industry/remittance")
def remittance_dashboard(
    db: Session = Depends(get_db),
    current_user: User = Depends(require_analyst_or_above),
):
    """
    Remittance-specific dashboard.
    Focuses on cross-border transfers, IFTI obligations, high-risk country exposure.
    """
    org_id = org_id_for(current_user)
    now = _now()
    prev_30d = _days_ago(30)

    from app.services.risk_matrix_service import (
        FATF_BLACKLIST,
        FATF_GREYLIST,
        SANCTIONED_COUNTRIES,
    )

    txn_q = db.query(Transaction).filter(Transaction.org_id == org_id)
    cross_border_30d = txn_q.filter(
        Transaction.is_cross_border == True,
        Transaction.transaction_date >= prev_30d,
    ).count()

    # IFTI candidates: cross-border >= AUD 10,000 pending reporting
    ifti_candidates = txn_q.filter(
        Transaction.is_cross_border == True,
        Transaction.amount_aud >= 10_000,
        Transaction.transaction_date >= prev_30d,
    ).count()
    ifti_pending = (
        db.query(IFTIReport)
        .filter(
            IFTIReport.org_id == org_id,
            IFTIReport.status.in_(_pending_report_statuses()),
        )
        .count()
    )
    ifti_overdue = (
        db.query(IFTIReport)
        .filter(
            IFTIReport.org_id == org_id,
            IFTIReport.due_date < now,
            IFTIReport.status.in_(_pending_report_statuses()),
        )
        .count()
    )

    # High-risk country exposure: transactions to/from blacklist/greylist/sanctioned
    blacklist_txns = txn_q.filter(
        Transaction.transaction_date >= prev_30d,
        Transaction.destination_country.in_(
            list(FATF_BLACKLIST | SANCTIONED_COUNTRIES)
        ),
    ).count()
    greylist_txns = txn_q.filter(
        Transaction.transaction_date >= prev_30d,
        Transaction.destination_country.in_(list(FATF_GREYLIST)),
    ).count()

    # Near-threshold (potential structuring)
    near_threshold = txn_q.filter(
        Transaction.is_near_threshold == True,
        Transaction.transaction_date >= prev_30d,
    ).count()
    structuring_suspect = txn_q.filter(
        Transaction.is_structuring_suspect == True,
        Transaction.transaction_date >= prev_30d,
    ).count()

    return {
        "generated_at": now.isoformat(),
        "industry": "remittance",
        "cross_border": {
            "transactions_30d": cross_border_30d,
            "ifti_candidates_30d": ifti_candidates,
            "ifti_pending": ifti_pending,
            "ifti_overdue": ifti_overdue,
            "traffic_light": _traffic_light(ifti_overdue, 1, 3),
        },
        "high_risk_country_exposure": {
            "blacklist_sanctioned_30d": blacklist_txns,
            "greylist_30d": greylist_txns,
            "traffic_light": _traffic_light(blacklist_txns, 1, 5),
        },
        "structuring_indicators": {
            "near_threshold_30d": near_threshold,
            "structuring_suspect_30d": structuring_suspect,
            "traffic_light": _traffic_light(structuring_suspect, 1, 3),
        },
        "disclaimer": DISCLAIMER,
    }


@router.get("/industry/crypto")
def crypto_dashboard(
    db: Session = Depends(get_db),
    current_user: User = Depends(require_analyst_or_above),
):
    """
    Crypto / VASP dashboard.
    Focuses on wallet risk, sanctioned wallet hits, high-risk blockchain activity, travel rule.
    """
    org_id = org_id_for(current_user)
    now = _now()
    prev_30d = _days_ago(30)

    from app.models.screening import (
        CryptoWalletScreening,
        WalletRiskCategory,
    )

    wallet_q = db.query(CryptoWalletScreening).filter(
        CryptoWalletScreening.org_id == org_id
    )
    sanctioned_hits = wallet_q.filter(
        CryptoWalletScreening.risk_category == WalletRiskCategory.sanctioned,
    ).count()
    high_risk_wallets = wallet_q.filter(
        CryptoWalletScreening.risk_category.in_(
            [
                WalletRiskCategory.high_risk,
                WalletRiskCategory.sanctioned,
            ]
        ),
    ).count()
    mixer_exposure = wallet_q.filter(
        CryptoWalletScreening.mixer_exposure_pct > 10,
    ).count()
    darknet_exposure = wallet_q.filter(
        CryptoWalletScreening.darknet_exposure_pct > 5,
    ).count()
    recent_screenings = wallet_q.filter(
        CryptoWalletScreening.screened_at >= prev_30d,
    ).count()

    # Crypto transaction alerts
    from app.models.monitoring import AlertCategory

    crypto_alerts = (
        db.query(TransactionAlert)
        .filter(
            TransactionAlert.org_id == org_id,
            TransactionAlert.category.in_(
                [
                    AlertCategory.crypto_mixer,
                    AlertCategory.darknet_exposure,
                    AlertCategory.crypto_anomaly,
                ]
            ),
            TransactionAlert.status.in_(_open_alert_statuses()),
        )
        .count()
    )

    return {
        "generated_at": now.isoformat(),
        "industry": "crypto",
        "wallet_risk": {
            "sanctioned_hits": sanctioned_hits,
            "high_risk_wallets": high_risk_wallets,
            "mixer_exposure_wallets": mixer_exposure,
            "darknet_exposure_wallets": darknet_exposure,
            "screenings_30d": recent_screenings,
            "traffic_light": _traffic_light(sanctioned_hits, 1, 3),
        },
        "blockchain_activity": {
            "open_crypto_alerts": crypto_alerts,
            "traffic_light": _traffic_light(crypto_alerts, 2, 8),
        },
        "travel_rule": {
            "note": "Travel rule compliance status requires integration with VASP travel rule provider.",
            "pending_implementation": True,
        },
        "disclaimer": DISCLAIMER,
    }


@router.get("/industry/legal")
def legal_dashboard(
    db: Session = Depends(get_db),
    current_user: User = Depends(require_analyst_or_above),
):
    """
    Lawyers and Conveyancers dashboard.
    Focuses on trust account activity, SOF reviews, property matters, third-party payments.
    """
    org_id = org_id_for(current_user)
    now = _now()
    prev_30d = _days_ago(30)

    from app.models.professional_assessment import (
        AssessmentRiskRating,
        AssessmentStatus,
        ProfessionalAssessment,
        ProfessionalServiceType,
    )

    pa_q = db.query(ProfessionalAssessment).filter(
        ProfessionalAssessment.org_id == org_id,
        ProfessionalAssessment.professional_service_type.in_(
            [
                ProfessionalServiceType.lawyer,
                ProfessionalServiceType.conveyancer,
            ]
        ),
    )
    total_matters = pa_q.count()
    open_matters = pa_q.filter(
        ProfessionalAssessment.status.in_(
            [
                AssessmentStatus.draft,
                AssessmentStatus.in_progress,
            ]
        )
    ).count()
    high_risk_matters = pa_q.filter(
        ProfessionalAssessment.overall_risk_rating.in_(
            [
                AssessmentRiskRating.high,
                AssessmentRiskRating.critical,
            ]
        )
    ).count()
    sof_outstanding = pa_q.filter(
        ProfessionalAssessment.status.in_(
            [
                AssessmentStatus.draft,
                AssessmentStatus.in_progress,
            ]
        )
    ).count()  # SOF pending: open matters needing SOF assessment

    property_txns = (
        db.query(Transaction)
        .filter(
            Transaction.org_id == org_id,
            Transaction.transaction_type.in_(["real_estate_settlement"]),
            Transaction.transaction_date >= prev_30d,
        )
        .count()
    )

    escalated = pa_q.filter(ProfessionalAssessment.is_escalated == True).count()

    return {
        "generated_at": now.isoformat(),
        "industry": "legal",
        "matters": {
            "total": total_matters,
            "open": open_matters,
            "high_risk": high_risk_matters,
            "escalated": escalated,
            "traffic_light": _traffic_light(high_risk_matters, 2, 8),
        },
        "sof_reviews": {
            "pending": sof_outstanding,
            "traffic_light": _traffic_light(sof_outstanding, 3, 10),
        },
        "property_transactions_30d": property_txns,
        "disclaimer": DISCLAIMER,
    }


@router.get("/industry/accountants")
def accountants_dashboard(
    db: Session = Depends(get_db),
    current_user: User = Depends(require_analyst_or_above),
):
    """
    Accountants and Tax Advisers dashboard.
    Focuses on SOW reviews, tax risk indicators, business structure reviews.
    """
    org_id = org_id_for(current_user)
    now = _now()

    from app.models.professional_assessment import (
        AssessmentRiskRating,
        AssessmentStatus,
        ProfessionalAssessment,
        ProfessionalServiceType,
        TaxRiskAssessment,
    )

    pa_q = db.query(ProfessionalAssessment).filter(
        ProfessionalAssessment.org_id == org_id,
        ProfessionalAssessment.professional_service_type.in_(
            [
                ProfessionalServiceType.accountant,
                ProfessionalServiceType.tax_adviser,
                ProfessionalServiceType.tcsp,
            ]
        ),
    )

    open_engagements = pa_q.filter(
        ProfessionalAssessment.status.in_(
            [
                AssessmentStatus.draft,
                AssessmentStatus.in_progress,
            ]
        )
    ).count()
    high_risk = pa_q.filter(
        ProfessionalAssessment.overall_risk_rating.in_(
            [
                AssessmentRiskRating.high,
                AssessmentRiskRating.critical,
            ]
        )
    ).count()

    # Tax risk: assessments with ≥2 indicators
    high_tax_risk = (
        db.query(TaxRiskAssessment)
        .join(
            ProfessionalAssessment,
            TaxRiskAssessment.assessment_id == ProfessionalAssessment.id,
        )
        .filter(
            ProfessionalAssessment.org_id == org_id,
            TaxRiskAssessment.indicator_count >= 2,
        )
        .count()
    )

    # SOW reviews outstanding (open assessments without completed SOW)
    sow_outstanding = pa_q.filter(
        ProfessionalAssessment.status.in_(
            [AssessmentStatus.draft, AssessmentStatus.in_progress]
        )
    ).count()

    # High-risk customers under these service types
    high_risk_clients = (
        db.query(Customer)
        .filter(
            Customer.org_id == org_id,
            Customer.risk_level.in_([RiskLevel.high, RiskLevel.critical]),
        )
        .count()
    )

    return {
        "generated_at": now.isoformat(),
        "industry": "accountants",
        "engagements": {
            "open": open_engagements,
            "high_risk": high_risk,
            "traffic_light": _traffic_light(high_risk, 2, 8),
        },
        "tax_risk_indicators": {
            "high_indicator_count": high_tax_risk,
            "traffic_light": _traffic_light(high_tax_risk, 1, 5),
        },
        "sow_reviews_outstanding": sow_outstanding,
        "high_risk_clients": high_risk_clients,
        "disclaimer": DISCLAIMER,
    }


@router.get("/industry/real-estate")
def real_estate_dashboard(
    db: Session = Depends(get_db),
    current_user: User = Depends(require_analyst_or_above),
):
    """
    Real Estate Professionals dashboard.
    Focuses on property transactions, foreign purchasers, SOF reviews.
    """
    org_id = org_id_for(current_user)
    now = _now()
    prev_30d = _days_ago(30)

    from app.models.professional_assessment import (
        AssessmentRiskRating,
        AssessmentStatus,
        ProfessionalAssessment,
        ProfessionalServiceType,
    )

    pa_q = db.query(ProfessionalAssessment).filter(
        ProfessionalAssessment.org_id == org_id,
        ProfessionalAssessment.professional_service_type
        == ProfessionalServiceType.real_estate,
    )

    open_matters = pa_q.filter(
        ProfessionalAssessment.status.in_(
            [
                AssessmentStatus.draft,
                AssessmentStatus.in_progress,
            ]
        )
    ).count()
    high_risk_matters = pa_q.filter(
        ProfessionalAssessment.overall_risk_rating.in_(
            [
                AssessmentRiskRating.high,
                AssessmentRiskRating.critical,
            ]
        )
    ).count()

    # Property settlement transactions
    property_txns_30d = (
        db.query(Transaction)
        .filter(
            Transaction.org_id == org_id,
            Transaction.transaction_date >= prev_30d,
        )
        .count()
    )

    # Foreign purchasers: cross-border transactions or customers with foreign nationality
    foreign_purchasers = (
        db.query(Customer)
        .filter(
            Customer.org_id == org_id,
            Customer.nationality != "AU",
            Customer.nationality.isnot(None),
            Customer.status == CustomerStatus.active,
        )
        .count()
    )

    sof_pending = open_matters  # Proxy: all open matters need SOF reviewed

    return {
        "generated_at": now.isoformat(),
        "industry": "real_estate",
        "property_matters": {
            "open": open_matters,
            "high_risk": high_risk_matters,
            "traffic_light": _traffic_light(high_risk_matters, 2, 8),
        },
        "property_transactions_30d": property_txns_30d,
        "foreign_purchasers": {
            "count": foreign_purchasers,
            "traffic_light": _traffic_light(foreign_purchasers, 5, 20),
        },
        "sof_reviews_pending": sof_pending,
        "disclaimer": DISCLAIMER,
    }


# ── Trend Endpoints ───────────────────────────────────────────────────────────


@router.get("/trends/alerts")
def alert_trends(
    days: int = Query(default=90, ge=7, le=365),
    db: Session = Depends(get_db),
    current_user: User = Depends(require_analyst_or_above),
):
    """
    Alert trend data for the past N days, grouped by week.
    Returns counts for charting risk movement.
    """
    org_id = org_id_for(current_user)
    now = _now()
    start = now - timedelta(days=days)
    weeks = days // 7

    result = []
    for i in range(weeks):
        period_start = start + timedelta(weeks=i)
        period_end = period_start + timedelta(weeks=1)
        count = (
            db.query(TransactionAlert)
            .filter(
                TransactionAlert.org_id == org_id,
                TransactionAlert.trigger_date >= period_start,
                TransactionAlert.trigger_date < period_end,
            )
            .count()
        )
        result.append(
            {
                "period_start": period_start.date().isoformat(),
                "period_end": period_end.date().isoformat(),
                "alerts": count,
            }
        )

    return {"days": days, "data": result}


@router.get("/trends/cases")
def case_trends(
    days: int = Query(default=90, ge=7, le=365),
    db: Session = Depends(get_db),
    current_user: User = Depends(require_analyst_or_above),
):
    """Case trend data grouped by week."""
    org_id = org_id_for(current_user)
    now = _now()
    start = now - timedelta(days=days)
    weeks = days // 7

    result = []
    for i in range(weeks):
        period_start = start + timedelta(weeks=i)
        period_end = period_start + timedelta(weeks=1)
        count = (
            db.query(Case)
            .filter(
                Case.org_id == org_id,
                Case.created_at >= period_start,
                Case.created_at < period_end,
            )
            .count()
        )
        result.append(
            {
                "period_start": period_start.date().isoformat(),
                "period_end": period_end.date().isoformat(),
                "cases": count,
            }
        )

    return {"days": days, "data": result}


@router.get("/compliance-score")
def compliance_score(
    db: Session = Depends(get_db),
    current_user: User = Depends(require_analyst_or_above),
):
    """
    Composite compliance health score (0–100, higher = healthier).

    Weighted components:
      - Open critical alerts    (25%)
      - Overdue reports         (25%)
      - Overdue calendar items  (20%)
      - EDD customers pending   (15%)
      - Open escalated cases    (15%)
    """
    org_id = org_id_for(current_user)
    now = _now()

    critical = (
        db.query(TransactionAlert)
        .filter(
            TransactionAlert.org_id == org_id,
            TransactionAlert.severity == AlertSeverity.critical,
            TransactionAlert.status.in_(_open_alert_statuses()),
        )
        .count()
    )
    rpt_overdue = sum(
        [
            db.query(IFTIReport)
            .filter(
                IFTIReport.org_id == org_id,
                IFTIReport.due_date < now,
                IFTIReport.status.in_(_pending_report_statuses()),
            )
            .count(),
            db.query(TTRReport)
            .filter(
                TTRReport.org_id == org_id,
                TTRReport.due_date < now,
                TTRReport.status.in_(_pending_report_statuses()),
            )
            .count(),
        ]
    )
    cal_overdue = (
        db.query(ComplianceCalendarItem)
        .filter(
            ComplianceCalendarItem.org_id == org_id,
            ComplianceCalendarItem.due_date < now,
            ComplianceCalendarItem.status.in_(
                [
                    CalendarItemStatus.open,
                    CalendarItemStatus.in_progress,
                ]
            ),
        )
        .count()
    )
    edd_pending = (
        db.query(Customer)
        .filter(
            Customer.org_id == org_id,
            Customer.status == CustomerStatus.edd_required,
        )
        .count()
    )
    escalated = (
        db.query(Case)
        .filter(
            Case.org_id == org_id,
            Case.status == CaseStatus.escalated,
        )
        .count()
    )

    def _penalty(count: int, warn: int, max_penalty: float) -> float:
        return min(count / max(warn, 1) * max_penalty, max_penalty)

    score = 100.0
    score -= _penalty(critical, 3, 25.0)
    score -= _penalty(rpt_overdue, 2, 25.0)
    score -= _penalty(cal_overdue, 5, 20.0)
    score -= _penalty(edd_pending, 5, 15.0)
    score -= _penalty(escalated, 3, 15.0)
    score = max(round(score, 1), 0.0)

    return {
        "compliance_score": score,
        "rating": (
            "excellent"
            if score >= 90
            else "good"
            if score >= 75
            else "needs_attention"
            if score >= 50
            else "at_risk"
        ),
        "traffic_light": (
            "green" if score >= 75 else "amber" if score >= 50 else "red"
        ),
        "components": {
            "critical_alerts": critical,
            "overdue_reports": rpt_overdue,
            "overdue_calendar_items": cal_overdue,
            "edd_pending": edd_pending,
            "escalated_cases": escalated,
        },
        "disclaimer": DISCLAIMER,
    }
