"""
Analytics service — aggregates compliance metrics for the reporting dashboard.
"""

from datetime import datetime, timedelta, timezone
from typing import Optional

from sqlalchemy import func, or_
from sqlalchemy.orm import Session

from app.models.audit import LegacyAuditLog as AuditLog
from app.models.customer import Customer, RiskLevel
from app.models.kyc import CustomerIdentityDocument, VerificationResult
from app.models.report import FilingRegisterEntry as Report
from app.models.report import ReportStatus, ReportType
from app.models.transaction import Transaction, TransactionStatus


def _now():
    return datetime.now(timezone.utc)


def _days_ago(n: int):
    return _now() - timedelta(days=n)


def _scope(q, model, industry_id: Optional[str], organisation_id: Optional[str] = None):
    org_id = organisation_id or industry_id
    if not org_id:
        return q
    if hasattr(model, "org_id"):
        return q.filter(model.org_id == org_id)
    if hasattr(model, "organisation_id"):
        return q.filter(model.organisation_id == org_id)
    if hasattr(model, "industry_id"):
        return q.filter(model.industry_id == org_id)
    return q


# ── Customer Analytics ─────────────────────────────────────────────────────────


def customer_risk_breakdown(
    db: Session,
    industry_id: Optional[str] = None,
    organisation_id: Optional[str] = None,
):
    q = _scope(db.query(Customer), Customer, industry_id, organisation_id)
    total = q.count()
    breakdown = {}
    for level in RiskLevel:
        breakdown[level.value] = q.filter(Customer.risk_level == level).count()
    return {"total": total, "by_risk": breakdown}


def customer_onboarding_trend(
    db: Session,
    days: int = 30,
    industry_id: Optional[str] = None,
    organisation_id: Optional[str] = None,
):
    since = _days_ago(days)
    q = db.query(
        func.date(Customer.created_at).label("day"),
        func.count().label("count"),
    ).filter(Customer.created_at >= since)
    q = _scope(q, Customer, industry_id, organisation_id)
    rows = q.group_by(func.date(Customer.created_at)).order_by("day").all()
    return [{"date": str(r.day), "count": r.count} for r in rows]


# ── Transaction Analytics ──────────────────────────────────────────────────────


def transaction_volume_trend(
    db: Session,
    days: int = 30,
    industry_id: Optional[str] = None,
    organisation_id: Optional[str] = None,
):
    since = _days_ago(days)
    q = db.query(
        func.date(Transaction.created_at).label("day"),
        func.count().label("count"),
        func.coalesce(func.sum(Transaction.amount), 0).label("volume"),
    ).filter(Transaction.created_at >= since)
    q = _scope(q, Transaction, industry_id, organisation_id)
    rows = q.group_by(func.date(Transaction.created_at)).order_by("day").all()
    return [
        {"date": str(r.day), "count": r.count, "volume": float(r.volume)} for r in rows
    ]


def flagged_transaction_stats(
    db: Session,
    industry_id: Optional[str] = None,
    organisation_id: Optional[str] = None,
):
    q = _scope(db.query(Transaction), Transaction, industry_id, organisation_id)
    total = q.count()
    # `is_suspicious` boolean no longer exists; TransactionStatus.flagged is the current
    # equivalent ("monitoring flag; not blocked").
    suspicious = q.filter(Transaction.status == TransactionStatus.flagged).count()
    return {
        "total": total,
        "flagged": suspicious,
        "flagged_pct": round(suspicious / total * 100, 1) if total else 0,
    }


# ── KYC Analytics ─────────────────────────────────────────────────────────────


def kyc_status_breakdown(
    db: Session,
    industry_id: Optional[str] = None,
    organisation_id: Optional[str] = None,
):
    # AMBIGUOUS: the old single `KYCRecord`/`KYCStatus` model was split into several
    # per-verification-type tables (CustomerIdentityDocument, CustomerSelfieVerification,
    # CustomerAddressVerification, CustomerPhoneVerification, CustomerEmailVerification),
    # each carrying its own `verification_result` (VerificationResult: pass/fail/refer/
    # not_performed) rather than a single aggregate KYC status (which previously included
    # values like "pending_review"). There is no clear current equivalent for an overall
    # "KYC status" breakdown across a customer. CustomerIdentityDocument was chosen here as
    # the representative/primary verification record since identity document verification is
    # the core KYC step, but CustomerSelfieVerification or a combination of all five tables
    # are equally plausible candidates. The "pending_review" status used downstream in
    # dashboard_summary() does not exist in VerificationResult; it is approximated to
    # VerificationResult.refer (manual review required) below.
    q = _scope(
        db.query(CustomerIdentityDocument),
        CustomerIdentityDocument,
        industry_id,
        organisation_id,
    )
    breakdown = {}
    for status in VerificationResult:
        breakdown[status.value] = q.filter(
            CustomerIdentityDocument.verification_result == status
        ).count()
    return {"total": q.count(), "by_status": breakdown}


# ── Reporting Analytics ────────────────────────────────────────────────────────


def report_stats(
    db: Session,
    industry_id: Optional[str] = None,
    organisation_id: Optional[str] = None,
):
    # AMBIGUOUS: the old single `ComplianceReport` model no longer exists — reports are now
    # split across IFTIReport/TTRReport/SMRReport, with FilingRegisterEntry as the immutable,
    # cross-type submission register (org_id, report_type, status, created_at all present).
    # FilingRegisterEntry was chosen as the closest aggregate replacement, but note its
    # `status` column is a plain String with only "submitted|acknowledged|rejected" values
    # (no "draft"/"under_review"/"approved" — those only exist on the individual report
    # tables before they reach the register).
    q = _scope(db.query(Report), Report, industry_id, organisation_id)
    total = q.count()
    by_status = {}
    for s in ReportStatus:
        by_status[s.value] = q.filter(Report.status == s.value).count()
    by_type = {}
    for t in ReportType:
        by_type[t.value] = q.filter(Report.report_type == t).count()
    return {"total": total, "by_status": by_status, "by_type": by_type}


def report_submission_trend(
    db: Session,
    days: int = 90,
    industry_id: Optional[str] = None,
    organisation_id: Optional[str] = None,
):
    since = _days_ago(days)
    q = db.query(
        func.date(Report.created_at).label("day"),
        func.count().label("count"),
    ).filter(Report.created_at >= since)
    q = _scope(q, Report, industry_id, organisation_id)
    rows = q.group_by(func.date(Report.created_at)).order_by("day").all()
    return [{"date": str(r.day), "count": r.count} for r in rows]


# ── Audit Analytics ────────────────────────────────────────────────────────────


def audit_activity_trend(
    db: Session,
    days: int = 30,
    industry_id: Optional[str] = None,
    organisation_id: Optional[str] = None,
):
    since = _days_ago(days)
    q = db.query(
        func.date(AuditLog.created_at).label("day"),
        func.count().label("count"),
    ).filter(AuditLog.created_at >= since)
    q = _scope(q, AuditLog, industry_id, organisation_id)
    rows = q.group_by(func.date(AuditLog.created_at)).order_by("day").all()
    return [{"date": str(r.day), "count": r.count} for r in rows]


# ── Composite Dashboard Summary ────────────────────────────────────────────────


def pending_customer_reviews(
    db: Session,
    industry_id: Optional[str] = None,
    organisation_id: Optional[str] = None,
):
    from app.models.customer import CustomerStatus

    today = _now().date()
    q = _scope(db.query(Customer), Customer, industry_id, organisation_id)
    due = q.filter(
        Customer.next_review_date.isnot(None),
        Customer.next_review_date <= today,
        Customer.status == CustomerStatus.active,
    ).count()
    due_30d = q.filter(
        Customer.next_review_date.isnot(None),
        Customer.next_review_date > today,
        Customer.next_review_date <= today + timedelta(days=30),
        Customer.status == CustomerStatus.active,
    ).count()
    return {"overdue": due, "due_within_30_days": due_30d}


def open_case_stats(
    db: Session,
    industry_id: Optional[str] = None,
    organisation_id: Optional[str] = None,
):
    from app.models.case import Case, CaseSeverity, CaseStatus

    CLOSED_STATUSES = {
        CaseStatus.closed_no_action,
        CaseStatus.closed_smr_filed,
        CaseStatus.closed_referred,
        CaseStatus.closed_exited,
        CaseStatus.closed_no_smr,
    }
    q = _scope(db.query(Case), Case, industry_id, organisation_id)
    open_q = q.filter(~Case.status.in_(CLOSED_STATUSES))
    by_status = {
        s.value: open_q.filter(Case.status == s).count()
        for s in CaseStatus
        if s not in CLOSED_STATUSES
    }
    by_severity = {
        s.value: open_q.filter(Case.severity == s).count() for s in CaseSeverity
    }
    return {
        "open_total": open_q.count(),
        "by_status": by_status,
        "by_severity": by_severity,
        "overdue": open_q.filter(Case.is_overdue.is_(True)).count(),
        "smr_candidates": open_q.filter(Case.is_smr_candidate.is_(True)).count(),
    }


# ── Training Analytics ──────────────────────────────────────────────────────────


def training_status_breakdown(
    db: Session,
    industry_id: Optional[str] = None,
    organisation_id: Optional[str] = None,
):
    from app.models.governance_training import GovernanceTrainingRecord, TrainingStatus

    today = _now().date()
    q = _scope(
        db.query(GovernanceTrainingRecord),
        GovernanceTrainingRecord,
        industry_id,
        organisation_id,
    )
    by_status = {
        s.value: q.filter(GovernanceTrainingRecord.status == s).count()
        for s in TrainingStatus
    }
    overdue = q.filter(
        GovernanceTrainingRecord.due_date < today,
        GovernanceTrainingRecord.status.in_(
            [
                TrainingStatus.assigned,
                TrainingStatus.in_progress,
                TrainingStatus.overdue,
            ]
        ),
    ).count()
    due_soon = q.filter(
        GovernanceTrainingRecord.due_date >= today,
        GovernanceTrainingRecord.due_date <= today + timedelta(days=30),
        GovernanceTrainingRecord.status.in_(
            [TrainingStatus.assigned, TrainingStatus.in_progress]
        ),
    ).count()
    total = q.count()
    completed = by_status.get(TrainingStatus.completed.value, 0)
    return {
        "total": total,
        "by_status": by_status,
        "overdue": overdue,
        "due_within_30_days": due_soon,
        "completion_pct": round(completed / total * 100, 1) if total else 0,
    }


# ── Governance Analytics ─────────────────────────────────────────────────────────


def governance_overview(
    db: Session,
    industry_id: Optional[str] = None,
    organisation_id: Optional[str] = None,
):
    from app.models.governance import Policy, PolicyLifecycleStatus
    from app.models.governance_controls import ControlStatus, GovernanceControl
    from app.models.independent_review import FindingRisk, FindingStatus, ReviewFinding

    today = _now().date()
    in_30 = today + timedelta(days=30)

    policy_q = _scope(db.query(Policy), Policy, industry_id, organisation_id)
    active_states = [
        PolicyLifecycleStatus.published,
        PolicyLifecycleStatus.periodic_review,
    ]
    policies_due = policy_q.filter(
        Policy.review_due_date.isnot(None),
        Policy.review_due_date <= in_30,
        Policy.status.in_(active_states),
    ).count()
    policies_overdue = policy_q.filter(
        Policy.review_due_date.isnot(None),
        Policy.review_due_date < today,
        Policy.status.in_(active_states),
    ).count()

    controls_q = _scope(
        db.query(GovernanceControl), GovernanceControl, industry_id, organisation_id
    )
    controls_total = controls_q.count()
    control_tests_overdue = controls_q.filter(
        GovernanceControl.next_test_date.isnot(None),
        GovernanceControl.next_test_date < today,
        GovernanceControl.status == ControlStatus.active,
    ).count()

    finding_q = _scope(
        db.query(ReviewFinding), ReviewFinding, industry_id, organisation_id
    )
    open_findings = finding_q.filter(
        ReviewFinding.status.in_(
            [
                FindingStatus.open,
                FindingStatus.response_submitted,
                FindingStatus.in_remediation,
                FindingStatus.overdue,
            ]
        )
    )
    findings_by_risk = {
        r.value: open_findings.filter(ReviewFinding.risk_rating == r).count()
        for r in FindingRisk
    }

    return {
        "policy_reviews_due_30d": policies_due,
        "policy_reviews_overdue": policies_overdue,
        "control_tests_overdue": control_tests_overdue,
        "controls_total": controls_total,
        "open_findings_total": open_findings.count(),
        "open_findings_by_risk": findings_by_risk,
    }


# ── Composite Dashboard Summary ────────────────────────────────────────────────


def dashboard_summary(
    db: Session,
    industry_id: Optional[str] = None,
    organisation_id: Optional[str] = None,
):
    customers = customer_risk_breakdown(db, industry_id, organisation_id)
    txn = flagged_transaction_stats(db, industry_id, organisation_id)
    kyc = kyc_status_breakdown(db, industry_id, organisation_id)
    rpt = report_stats(db, industry_id, organisation_id)

    # "pending_review" no longer exists on VerificationResult; VerificationResult.refer
    # ("manual review required") is the closest current equivalent — see ambiguity note
    # in kyc_status_breakdown().
    pending_kyc = kyc["by_status"].get(VerificationResult.refer.value, 0)
    overdue_reports = rpt["by_status"].get(ReportStatus.draft.value, 0)

    return {
        "customers": customers,
        "transactions": txn,
        "kyc": kyc,
        "reports": rpt,
        "alerts": {
            "pending_kyc_reviews": pending_kyc,
            "overdue_reports": overdue_reports,
            # RiskLevel no longer has "very_high" — "critical" is the closest current tier.
            "high_risk_customers": customers["by_risk"].get("high", 0)
            + customers["by_risk"].get("critical", 0),
        },
    }
