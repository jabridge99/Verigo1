"""
Board Reporting Service — aggregates live compliance data into report payloads.

Each report type draws from:
  - Cases (open / severity / SMR candidates)
  - SMRs (filed / pending)
  - Customers (high risk / PEP / EDD)
  - Transaction Alerts (open / overdue)
  - Training records (completion rates)
  - Policies (due for review / overdue)
  - Governance controls (effectiveness scores)
  - Independent review findings (open / overdue)

All data is a point-in-time snapshot at generation time.
"""

from __future__ import annotations

import logging
from datetime import date, datetime, timezone

from sqlalchemy.orm import Session

log = logging.getLogger("tvg.board_reporting")


# ── Section builders ──────────────────────────────────────────────────────────


def _cases_section(
    db: Session, org_id: str, period_start: date, period_end: date
) -> dict:
    from app.models.case import Case, CaseSeverity, CaseStatus

    all_open = (
        db.query(Case)
        .filter(
            Case.org_id == org_id,
            Case.status.notin_(
                [
                    CaseStatus.closed_no_action,
                    CaseStatus.closed_smr_filed,
                    CaseStatus.closed_referred,
                    CaseStatus.closed_exited,
                    CaseStatus.closed_no_smr,
                ]
            ),
        )
        .all()
    )

    period_opened = (
        db.query(Case)
        .filter(
            Case.org_id == org_id,
            Case.created_at
            >= datetime.combine(period_start, datetime.min.time()).replace(
                tzinfo=timezone.utc
            ),
            Case.created_at
            <= datetime.combine(period_end, datetime.max.time()).replace(
                tzinfo=timezone.utc
            ),
        )
        .all()
    )

    period_closed = (
        db.query(Case)
        .filter(
            Case.org_id == org_id,
            Case.closed_at
            >= datetime.combine(period_start, datetime.min.time()).replace(
                tzinfo=timezone.utc
            ),
            Case.closed_at
            <= datetime.combine(period_end, datetime.max.time()).replace(
                tzinfo=timezone.utc
            ),
        )
        .all()
    )

    smr_candidates = [c for c in all_open if c.is_smr_candidate]
    today = date.today()
    overdue = [c for c in all_open if c.due_date and c.due_date < today]

    return {
        "open_total": len(all_open),
        "open_by_severity": {
            "critical": sum(1 for c in all_open if c.severity == CaseSeverity.critical),
            "high": sum(1 for c in all_open if c.severity == CaseSeverity.high),
            "medium": sum(1 for c in all_open if c.severity == CaseSeverity.medium),
            "low": sum(1 for c in all_open if c.severity == CaseSeverity.low),
        },
        "opened_this_period": len(period_opened),
        "closed_this_period": len(period_closed),
        "smr_candidates_open": len(smr_candidates),
        "overdue_cases": len(overdue),
        "tipping_off_risk": sum(1 for c in all_open if c.tipping_off_risk),
    }


def _smr_section(
    db: Session, org_id: str, period_start: date, period_end: date
) -> dict:
    from app.models.report import ReportStatus, SMRReport

    def _in_period(q, model):
        return q.filter(
            model.created_at
            >= datetime.combine(period_start, datetime.min.time()).replace(
                tzinfo=timezone.utc
            ),
            model.created_at
            <= datetime.combine(period_end, datetime.max.time()).replace(
                tzinfo=timezone.utc
            ),
        )

    base = db.query(SMRReport).filter_by(org_id=org_id)
    period_smrs = _in_period(base, SMRReport).all()
    all_smrs = base.all()

    _LODGED_STATUSES = (ReportStatus.submitted, ReportStatus.acknowledged)
    lodged = [s for s in period_smrs if s.status in _LODGED_STATUSES]
    pending_mlro = [
        s
        for s in all_smrs
        if s.status not in _LODGED_STATUSES and s.status == ReportStatus.draft
    ]
    submitted = [s for s in all_smrs if s.status == ReportStatus.submitted]

    return {
        "total_lodged_period": len(lodged),
        "total_lodged_all_time": sum(
            1 for s in all_smrs if s.status in _LODGED_STATUSES
        ),
        "pending_mlro_sign_off": len(pending_mlro),
        "submitted_to_austrac": len(submitted),
        "is_terrorism_related_period": sum(
            1 for s in period_smrs if s.is_terrorism_related
        ),
        "draft_smrs": sum(1 for s in all_smrs if s.status == ReportStatus.draft),
        "disclaimer": (
            "SMR lodgement decisions are made exclusively by the reporting entity's MLRO. "
            "This system does not make SMR lodgement decisions."
        ),
    }


def _customers_section(
    db: Session, org_id: str, period_start: date, period_end: date
) -> dict:
    from app.models.customer import CDDLevel, Customer, CustomerStatus, RiskLevel

    all_active = (
        db.query(Customer).filter_by(org_id=org_id, status=CustomerStatus.active).all()
    )
    new_period = (
        db.query(Customer)
        .filter(
            Customer.org_id == org_id,
            Customer.created_at
            >= datetime.combine(period_start, datetime.min.time()).replace(
                tzinfo=timezone.utc
            ),
            Customer.created_at
            <= datetime.combine(period_end, datetime.max.time()).replace(
                tzinfo=timezone.utc
            ),
        )
        .all()
    )

    high_risk = [
        c for c in all_active if c.risk_level in (RiskLevel.high, RiskLevel.critical)
    ]
    pep_active = [c for c in all_active if c.is_pep]
    sanctioned = [c for c in all_active if c.is_sanctions_match]
    edd_customers = [c for c in all_active if c.cdd_level == CDDLevel.enhanced]

    return {
        "total_active": len(all_active),
        "new_this_period": len(new_period),
        "by_risk_level": {
            "critical": sum(
                1 for c in all_active if c.risk_level == RiskLevel.critical
            ),
            "high": sum(1 for c in all_active if c.risk_level == RiskLevel.high),
            "medium": sum(1 for c in all_active if c.risk_level == RiskLevel.medium),
            "low": sum(1 for c in all_active if c.risk_level == RiskLevel.low),
        },
        "high_risk_total": len(high_risk),
        "pep_customers": len(pep_active),
        "sanctions_matches_active": len(sanctioned),
        "edd_customers": len(edd_customers),
        "high_risk_percentage": round(
            len(high_risk) / max(len(all_active), 1) * 100, 1
        ),
    }


def _alerts_section(
    db: Session, org_id: str, period_start: date, period_end: date
) -> dict:
    from app.models.monitoring import AlertSeverity, AlertStatus, TransactionAlert

    # AlertStatus has no single "open" member -- generated/assigned/under_review/
    # escalated/smr_candidate are all still-active states, matching the
    # established _open_alert_statuses() convention in app/api/routes/dashboard.py.
    open_alert_statuses = [
        AlertStatus.generated,
        AlertStatus.assigned,
        AlertStatus.under_review,
        AlertStatus.escalated,
        AlertStatus.smr_candidate,
    ]

    period_alerts = (
        db.query(TransactionAlert)
        .filter(
            TransactionAlert.org_id == org_id,
            TransactionAlert.created_at
            >= datetime.combine(period_start, datetime.min.time()).replace(
                tzinfo=timezone.utc
            ),
            TransactionAlert.created_at
            <= datetime.combine(period_end, datetime.max.time()).replace(
                tzinfo=timezone.utc
            ),
        )
        .all()
    )

    open_alerts = (
        db.query(TransactionAlert)
        .filter(
            TransactionAlert.org_id == org_id,
            TransactionAlert.status.in_(open_alert_statuses),
        )
        .all()
    )

    escalated = [a for a in period_alerts if a.status == AlertStatus.escalated]
    cleared = [a for a in period_alerts if a.status == AlertStatus.resolved]
    false_positive = [a for a in period_alerts if a.status == AlertStatus.dismissed]

    return {
        "alerts_raised_period": len(period_alerts),
        "open_alerts": len(open_alerts),
        "escalated_to_case_period": len(escalated),
        "cleared_period": len(cleared),
        "false_positives_period": len(false_positive),
        "escalation_rate_pct": round(
            len(escalated) / max(len(period_alerts), 1) * 100, 1
        ),
        "false_positive_rate_pct": round(
            len(false_positive) / max(len(period_alerts), 1) * 100, 1
        ),
        "by_severity": {
            "critical": sum(
                1 for a in period_alerts if a.severity == AlertSeverity.critical
            ),
            "high": sum(1 for a in period_alerts if a.severity == AlertSeverity.high),
            "medium": sum(
                1 for a in period_alerts if a.severity == AlertSeverity.medium
            ),
            "low": sum(1 for a in period_alerts if a.severity == AlertSeverity.low),
        },
    }


def _training_section(
    db: Session, org_id: str, period_start: date, period_end: date
) -> dict:
    from app.models.governance_training import GovernanceTrainingRecord
    from app.models.governance_training import TrainingStatus as GovTrainingStatus

    records = db.query(GovernanceTrainingRecord).filter_by(org_id=org_id).all()

    completed = [r for r in records if r.status == GovTrainingStatus.completed]
    overdue_assignments = [
        r
        for r in records
        if r.due_date
        and r.due_date < date.today()
        and r.status != GovTrainingStatus.completed
    ]

    period_completions = [
        r
        for r in completed
        if r.completion_date and period_start <= r.completion_date <= period_end
    ]

    total_assigned = len(records)
    total_completed = len(completed)

    return {
        "total_assigned": total_assigned,
        "total_completed": total_completed,
        "completion_rate_pct": round(total_completed / max(total_assigned, 1) * 100, 1),
        "completions_this_period": len(period_completions),
        "overdue_assignments": len(overdue_assignments),
        "total_records": len(records),
    }


def _policies_section(
    db: Session, org_id: str, period_start: date, period_end: date
) -> dict:
    from app.models.governance import Policy, PolicyLifecycleStatus

    policies = db.query(Policy).filter_by(org_id=org_id).all()
    today = date.today()

    # PolicyLifecycleStatus has no single "approved"/"under_review" member --
    # "published" is the active/operative state, and the workflow has three
    # distinct review sub-stages (internal_review, compliance_review,
    # pending_approval) grouped here as "under review".
    review_statuses = (
        PolicyLifecycleStatus.internal_review,
        PolicyLifecycleStatus.compliance_review,
        PolicyLifecycleStatus.pending_approval,
    )

    active = [p for p in policies if p.status == PolicyLifecycleStatus.published]
    overdue_review = [
        p for p in active if p.review_due_date and p.review_due_date < today
    ]
    due_next_30 = [
        p
        for p in active
        if p.review_due_date
        and today
        <= p.review_due_date
        <= date(today.year, today.month + 1 if today.month < 12 else 1, today.day)
    ]
    under_review = [p for p in policies if p.status in review_statuses]
    draft = [p for p in policies if p.status == PolicyLifecycleStatus.draft]

    period_updated = [
        p
        for p in policies
        if p.updated_at and period_start <= p.updated_at.date() <= period_end
    ]

    return {
        "total_policies": len(policies),
        "active_approved": len(active),
        "under_review": len(under_review),
        "draft": len(draft),
        "overdue_review": len(overdue_review),
        "overdue_policy_list": [
            {"id": p.id, "title": p.title, "review_due": str(p.review_due_date)}
            for p in overdue_review[:10]
        ],
        "due_for_review_next_30_days": len(due_next_30),
        "updated_this_period": len(period_updated),
    }


def _controls_section(
    db: Session, org_id: str, period_start: date, period_end: date
) -> dict:
    from app.models.governance_controls import (
        ControlEffectiveness,
        ControlTest,
        GovernanceControl,
    )

    controls = db.query(GovernanceControl).filter_by(org_id=org_id).all()
    control_ids = [c.id for c in controls]

    tests_period = []
    if control_ids:
        tests_period = (
            db.query(ControlTest)
            .filter(
                ControlTest.control_id.in_(control_ids),
                ControlTest.test_date >= period_start,
                ControlTest.test_date <= period_end,
            )
            .all()
        )

    effectiveness_map = {
        ControlEffectiveness.effective: 0,
        ControlEffectiveness.largely_effective: 0,
        ControlEffectiveness.partially_effective: 0,
        ControlEffectiveness.ineffective: 0,
    }
    for c in controls:
        if c.effectiveness and c.effectiveness in effectiveness_map:
            effectiveness_map[c.effectiveness] += 1

    avg_score = None
    scored = [
        c
        for c in controls
        if hasattr(c, "effectiveness_score") and c.effectiveness_score is not None
    ]
    if scored:
        avg_score = round(sum(c.effectiveness_score for c in scored) / len(scored), 1)

    key_controls = [c for c in controls if c.is_key_control]
    ineffective_key = [
        c for c in key_controls if c.effectiveness == ControlEffectiveness.ineffective
    ]

    return {
        "total_controls": len(controls),
        "key_controls": len(key_controls),
        "tests_conducted_period": len(tests_period),
        "effectiveness_breakdown": {
            "effective": effectiveness_map.get(ControlEffectiveness.effective, 0),
            "largely_effective": effectiveness_map.get(
                ControlEffectiveness.largely_effective, 0
            ),
            "partially_effective": effectiveness_map.get(
                ControlEffectiveness.partially_effective, 0
            ),
            "ineffective": effectiveness_map.get(ControlEffectiveness.ineffective, 0),
        },
        "average_effectiveness_score": avg_score,
        "ineffective_key_controls": len(ineffective_key),
        "ineffective_key_control_list": [
            {"id": c.id, "name": c.control_ref, "risk_area": c.risk_area}
            for c in ineffective_key[:10]
        ],
    }


def _independent_review_section(
    db: Session, org_id: str, period_start: date, period_end: date
) -> dict:
    from app.models.independent_review import (
        ActionStatus,
        FindingStatus,
        IndependentReview,
        ReviewAction,
        ReviewFinding,
        ReviewStatus,
    )

    reviews = db.query(IndependentReview).filter_by(org_id=org_id).all()
    active_reviews = [r for r in reviews if r.status not in (ReviewStatus.archived,)]

    findings = db.query(ReviewFinding).filter_by(org_id=org_id).all()
    open_findings = [
        f
        for f in findings
        if f.status not in (FindingStatus.closed, FindingStatus.accepted_risk)
    ]

    actions = db.query(ReviewAction).filter_by(org_id=org_id).all()
    today = date.today()
    overdue_actions = [
        a
        for a in actions
        if a.due_date
        and a.due_date < today
        and a.status
        not in (ActionStatus.completed, ActionStatus.verified, ActionStatus.cancelled)
    ]
    pending_verification = [a for a in actions if a.status == ActionStatus.completed]

    return {
        "active_reviews": len(active_reviews),
        "total_reviews": len(reviews),
        "open_findings": len(open_findings),
        "open_findings_by_risk": {
            "critical": sum(1 for f in open_findings if f.risk_rating == "critical"),
            "high": sum(1 for f in open_findings if f.risk_rating == "high"),
            "medium": sum(1 for f in open_findings if f.risk_rating == "medium"),
            "low": sum(1 for f in open_findings if f.risk_rating == "low"),
        },
        "overdue_remediation_actions": len(overdue_actions),
        "pending_compliance_verification": len(pending_verification),
    }


def _regulatory_reporting_section(
    db: Session, org_id: str, period_start: date, period_end: date
) -> dict:
    from app.models.ifti_e import IFTIERecord
    from app.models.report import IFTIReport, ReportStatus, TTRReport

    def _period_count(model, tenant_field="org_id"):
        return (
            db.query(model)
            .filter(
                getattr(model, tenant_field) == org_id,
                model.created_at
                >= datetime.combine(period_start, datetime.min.time()).replace(
                    tzinfo=timezone.utc
                ),
                model.created_at
                <= datetime.combine(period_end, datetime.max.time()).replace(
                    tzinfo=timezone.utc
                ),
            )
            .count()
        )

    iftis_period = _period_count(IFTIReport)
    ttrs_period = _period_count(TTRReport)
    # IFTIERecord's only tenant column is industry_id, not org_id (see
    # app/models/ifti_e.py) -- unlike IFTIReport/TTRReport.
    ifti_e_period = _period_count(IFTIERecord, tenant_field="industry_id")

    iftis_submitted = (
        db.query(IFTIReport)
        .filter_by(org_id=org_id, status=ReportStatus.submitted)
        .count()
    )
    ttrs_submitted = (
        db.query(TTRReport)
        .filter_by(org_id=org_id, status=ReportStatus.submitted)
        .count()
    )

    return {
        "iftis_raised_period": iftis_period,
        "iftis_submitted_total": iftis_submitted,
        "ttrs_raised_period": ttrs_period,
        "ttrs_submitted_total": ttrs_submitted,
        "ifti_e_raised_period": ifti_e_period,
    }


# ── CO Quarterly Compliance Report sections ─────────────────────────────────
#
# Built to align generate_quarterly_compliance_snapshot() with the specific
# sections named by the Verigo CO Quarterly Compliance Report template
# (VERIGO-GEN-COR, from the Google Drive AML/CTF document library) — the
# generic _base_snapshot() sections don't compute any of these on their own.


def _smr_quarterly_detail(
    db: Session, org_id: str, period_start: date, period_end: date
) -> dict:
    from app.models.report import ReportStatus, SMRReport

    period_smrs = (
        db.query(SMRReport)
        .filter(
            SMRReport.org_id == org_id,
            SMRReport.created_at
            >= datetime.combine(period_start, datetime.min.time()).replace(
                tzinfo=timezone.utc
            ),
            SMRReport.created_at
            <= datetime.combine(period_end, datetime.max.time()).replace(
                tzinfo=timezone.utc
            ),
        )
        .all()
    )
    lodged = [
        s
        for s in period_smrs
        if s.status in (ReportStatus.submitted, ReportStatus.acknowledged)
    ]
    late = [
        s
        for s in lodged
        if s.due_date and s.submitted_at and s.submitted_at.date() > s.due_date
    ]
    terrorism = [s for s in lodged if s.is_terrorism_related]
    terrorism_within_24h = [
        s
        for s in terrorism
        if s.submitted_at
        and s.created_at
        and (s.submitted_at - s.created_at).total_seconds() <= 24 * 3600
    ]
    cleared = [
        s
        for s in period_smrs
        if s.status not in (ReportStatus.submitted, ReportStatus.acknowledged)
        and s.status == ReportStatus.rejected
    ]

    return {
        "escalated_to_co_period": len(period_smrs),
        "lodged_period": len(lodged),
        "cleared_not_lodged": len(cleared),
        "terrorism_smrs_period": len(terrorism),
        "terrorism_all_within_24h": len(terrorism) == len(terrorism_within_24h),
        "late_smrs": len(late),
    }


def _ttr_quarterly_section(
    db: Session, org_id: str, period_start: date, period_end: date
) -> dict:
    from app.models.report import ReportStatus, SMRReport, TTRReport

    period_ttrs = (
        db.query(TTRReport)
        .filter(
            TTRReport.org_id == org_id,
            TTRReport.created_at
            >= datetime.combine(period_start, datetime.min.time()).replace(
                tzinfo=timezone.utc
            ),
            TTRReport.created_at
            <= datetime.combine(period_end, datetime.max.time()).replace(
                tzinfo=timezone.utc
            ),
        )
        .all()
    )
    lodged = [
        t
        for t in period_ttrs
        if t.status in (ReportStatus.submitted, ReportStatus.acknowledged)
    ]
    late = [
        t
        for t in lodged
        if t.due_date and t.submitted_at and t.submitted_at.date() > t.due_date
    ]

    smr_customer_ids = {
        row[0]
        for row in db.query(SMRReport.customer_id)
        .filter(SMRReport.org_id == org_id, SMRReport.customer_id.isnot(None))
        .all()
    }
    also_smr = sum(1 for t in lodged if t.customer_id in smr_customer_ids)

    return {
        "ttrs_lodged_period": len(lodged),
        "total_value_aud": round(sum(t.total_amount or 0 for t in lodged), 2),
        "late_ttrs": len(late),
        "ttrs_also_smr": also_smr,
    }


def _ecdd_quarterly_section(
    db: Session, org_id: str, period_start: date, period_end: date
) -> dict:
    from app.models.report import ECDDRecord, ECDDStatus

    period_cases = (
        db.query(ECDDRecord)
        .filter(
            ECDDRecord.org_id == org_id,
            ECDDRecord.created_at
            >= datetime.combine(period_start, datetime.min.time()).replace(
                tzinfo=timezone.utc
            ),
            ECDDRecord.created_at
            <= datetime.combine(period_end, datetime.max.time()).replace(
                tzinfo=timezone.utc
            ),
        )
        .all()
    )
    all_open = (
        db.query(ECDDRecord).filter_by(org_id=org_id, status=ECDDStatus.pending).count()
    )

    return {
        "new_cases_opened": len(period_cases),
        "approved": sum(
            1
            for c in period_cases
            if c.status == ECDDStatus.completed and c.recommendation != "reject"
        ),
        "declined": sum(
            1
            for c in period_cases
            if c.status == ECDDStatus.rejected or c.recommendation == "reject"
        ),
        "still_open_end_of_quarter": all_open,
    }


def _sanctions_quarterly_section(
    db: Session, org_id: str, period_start: date, period_end: date
) -> dict:
    from app.models.screening import ScreeningRecord, ScreeningStatus, ScreeningType

    period_screens = (
        db.query(ScreeningRecord)
        .filter(
            ScreeningRecord.org_id == org_id,
            ScreeningRecord.screening_type == ScreeningType.sanctions,
            ScreeningRecord.screened_at
            >= datetime.combine(period_start, datetime.min.time()).replace(
                tzinfo=timezone.utc
            ),
            ScreeningRecord.screened_at
            <= datetime.combine(period_end, datetime.max.time()).replace(
                tzinfo=timezone.utc
            ),
        )
        .all()
    )
    possible_matches = [
        s for s in period_screens if s.status == ScreeningStatus.potential_match
    ]
    false_positives = [s for s in period_screens if s.is_false_positive]
    confirmed = [
        s for s in period_screens if s.status == ScreeningStatus.confirmed_match
    ]

    return {
        "total_screens_period": len(period_screens),
        "possible_matches": len(possible_matches),
        "false_positives": len(false_positives),
        "confirmed_matches": len(confirmed),
    }


def _open_actions_quarterly_section(db: Session, org_id: str) -> list:
    """
    "Open Actions from Prior Quarters" -- the template's own carryover list.
    Sourced from the Compliance Calendar (app/api/routes/compliance_calendar.py),
    which is where scheduled compliance obligations and their due dates already
    live, rather than inventing a second tracking mechanism.
    """
    from app.models.compliance_calendar import (
        CalendarItemStatus,
        ComplianceCalendarItem,
    )

    today = date.today()
    overdue = (
        db.query(ComplianceCalendarItem)
        .filter(
            ComplianceCalendarItem.org_id == org_id,
            ComplianceCalendarItem.due_date < today,
            ComplianceCalendarItem.status.notin_(
                [CalendarItemStatus.completed, CalendarItemStatus.cancelled]
            ),
        )
        .order_by(ComplianceCalendarItem.due_date)
        .limit(20)
        .all()
    )
    return [
        {"title": i.title, "due_date": str(i.due_date), "status": i.status.value}
        for i in overdue
    ]


def _co_quarterly_extras(
    db: Session, org_id: str, period_start: date, period_end: date
) -> dict:
    from app.models.independent_review import IndependentReview

    latest_review = (
        db.query(IndependentReview)
        .filter_by(org_id=org_id)
        .order_by(IndependentReview.created_at.desc())
        .first()
    )

    return {
        "smr_quarterly": _smr_quarterly_detail(db, org_id, period_start, period_end),
        "ttr": _ttr_quarterly_section(db, org_id, period_start, period_end),
        "ecdd_quarterly": _ecdd_quarterly_section(db, org_id, period_start, period_end),
        "sanctions_quarterly": _sanctions_quarterly_section(
            db, org_id, period_start, period_end
        ),
        "open_actions_prior_quarters": _open_actions_quarterly_section(db, org_id),
        "independent_review_status": {
            "status": latest_review.status.value if latest_review else None,
            "reviewer": latest_review.reviewer_name if latest_review else None,
            "report_date": str(latest_review.report_date)
            if latest_review and latest_review.report_date
            else None,
        }
        if latest_review
        else {"status": None, "reviewer": None, "report_date": None},
    }


# ── Main generators ───────────────────────────────────────────────────────────


def _base_snapshot(
    db: Session, org_id: str, period_start: date, period_end: date
) -> dict:
    """Shared data sections used across all report types."""
    return {
        "generated_at": datetime.now(timezone.utc).isoformat(),
        "period_start": str(period_start),
        "period_end": str(period_end),
        "cases": _cases_section(db, org_id, period_start, period_end),
        "smr": _smr_section(db, org_id, period_start, period_end),
        "customers": _customers_section(db, org_id, period_start, period_end),
        "alerts": _alerts_section(db, org_id, period_start, period_end),
        "training": _training_section(db, org_id, period_start, period_end),
        "policies": _policies_section(db, org_id, period_start, period_end),
        "controls": _controls_section(db, org_id, period_start, period_end),
        "independent_reviews": _independent_review_section(
            db, org_id, period_start, period_end
        ),
        "regulatory_reporting": _regulatory_reporting_section(
            db, org_id, period_start, period_end
        ),
    }


def generate_board_aml_snapshot(
    db: Session, org_id: str, period_start: date, period_end: date
) -> dict:
    """
    Board AML Report — quarterly executive-level view.
    Focuses on headline metrics, risks, and board-action items.
    """
    snap = _base_snapshot(db, org_id, period_start, period_end)

    # Board-level risk summary flags
    cases = snap["cases"]
    controls = snap["controls"]
    reviews = snap["independent_reviews"]
    customers = snap["customers"]

    attention_items = []
    if cases["overdue_cases"] > 0:
        attention_items.append(
            f"{cases['overdue_cases']} overdue investigation case(s) requiring management attention"
        )
    if cases["smr_candidates_open"] > 0:
        attention_items.append(
            f"{cases['smr_candidates_open']} open SMR candidate case(s) pending MLRO decision"
        )
    if customers["sanctions_matches_active"] > 0:
        attention_items.append(
            f"{customers['sanctions_matches_active']} active customer(s) with sanctions match — EDD required"
        )
    if controls["ineffective_key_controls"] > 0:
        attention_items.append(
            f"{controls['ineffective_key_controls']} key control(s) rated Ineffective"
        )
    if reviews["open_findings_by_risk"]["critical"] > 0:
        attention_items.append(
            f"{reviews['open_findings_by_risk']['critical']} critical independent review finding(s) unresolved"
        )
    if snap["policies"]["overdue_review"] > 0:
        attention_items.append(
            f"{snap['policies']['overdue_review']} AML/CTF polic(ies) overdue for review"
        )

    snap["board_attention_items"] = attention_items
    snap["report_type"] = "board_aml"
    snap["disclaimer"] = (
        "This report is generated from compliance workflow data as at the date shown. "
        "The reporting entity's Board and management are responsible for assessing the "
        "adequacy of the AML/CTF program. This system does not make regulatory decisions."
    )
    return snap


def generate_quarterly_compliance_snapshot(
    db: Session, org_id: str, period_start: date, period_end: date
) -> dict:
    """
    Quarterly Compliance Report — the AML/CTF Compliance Officer's quarterly
    report to the Director/Board (AML/CTF Program s.14.4), aligned to the
    Verigo CO Quarterly Compliance Report template (VERIGO-GEN-COR)'s
    sections: SMR/TTR/ECDD/TMP/Sanctions activity, training, open actions
    carried over, and independent review status.
    """
    snap = _base_snapshot(db, org_id, period_start, period_end)
    snap.update(_co_quarterly_extras(db, org_id, period_start, period_end))
    snap["report_type"] = "quarterly_compliance"
    snap["disclaimer"] = (
        "This report is generated from compliance workflow data as at the date shown. "
        "All compliance decisions remain with the reporting entity."
    )
    return snap


def generate_risk_committee_snapshot(
    db: Session, org_id: str, period_start: date, period_end: date
) -> dict:
    """
    Risk Committee Report — control gaps, emerging risks, risk appetite analysis.
    """
    snap = _base_snapshot(db, org_id, period_start, period_end)

    # Risk concentration analysis
    customers = snap["customers"]
    controls = snap["controls"]
    reviews = snap["independent_reviews"]

    risk_indicators = []
    high_risk_pct = customers.get("high_risk_percentage", 0)
    if high_risk_pct > 20:
        risk_indicators.append(
            {
                "indicator": "High-risk customer concentration",
                "value": f"{high_risk_pct}% of active customers rated high/critical risk",
                "threshold": "20%",
                "status": "above_threshold",
            }
        )

    if controls.get("ineffective_key_controls", 0) > 0:
        risk_indicators.append(
            {
                "indicator": "Key control failures",
                "value": f"{controls['ineffective_key_controls']} key control(s) ineffective",
                "threshold": "0",
                "status": "breach",
            }
        )

    avg_score = controls.get("average_effectiveness_score")
    if avg_score and avg_score < 70:
        risk_indicators.append(
            {
                "indicator": "Control portfolio effectiveness",
                "value": f"Average effectiveness score {avg_score}/100",
                "threshold": "70",
                "status": "below_threshold",
            }
        )

    if reviews.get("overdue_remediation_actions", 0) > 0:
        risk_indicators.append(
            {
                "indicator": "Overdue remediation actions",
                "value": f"{reviews['overdue_remediation_actions']} independent review action(s) overdue",
                "threshold": "0",
                "status": "above_threshold",
            }
        )

    snap["risk_indicators"] = risk_indicators
    snap["control_gaps"] = [
        item for item in controls.get("ineffective_key_control_list", [])
    ]
    snap["report_type"] = "risk_committee"
    snap["disclaimer"] = (
        "This report is generated from compliance workflow data as at the date shown. "
        "Risk appetite thresholds are illustrative — the reporting entity must set and "
        "maintain its own risk appetite statement. This system does not make risk decisions."
    )
    return snap


def generate_annual_aml_snapshot(
    db: Session, org_id: str, period_start: date, period_end: date
) -> dict:
    """
    Annual AML/CTF Program Report — comprehensive year-end review.
    Required for MLRO annual certification under AML/CTF Rules.
    """
    snap = _base_snapshot(db, org_id, period_start, period_end)

    # Summarise year highlights
    cases = snap["cases"]
    smr = snap["smr"]
    reg = snap["regulatory_reporting"]
    training = snap["training"]

    annual_highlights = [
        f"Cases opened: {cases['opened_this_period']}; closed: {cases['closed_this_period']}",
        f"SMRs lodged with AUSTRAC: {smr['total_lodged_period']}",
        f"IFTIs reported: {reg['iftis_raised_period']}; TTRs reported: {reg['ttrs_raised_period']}",
        f"Training completion rate: {training['completion_rate_pct']}%",
    ]

    snap["annual_highlights"] = annual_highlights
    snap["report_type"] = "annual_aml"
    snap["mlro_certification_note"] = (
        "This Annual AML/CTF Report is prepared to assist the MLRO in their annual "
        "assessment of the AML/CTF program. The MLRO is responsible for the accuracy "
        "of the annual report to the Board and for any regulatory obligations. "
        "This system does not make regulatory determinations."
    )
    snap["disclaimer"] = (
        "This report is generated from compliance workflow data for the period shown. "
        "The reporting entity is responsible for the accuracy and completeness of its "
        "AML/CTF program assessment and all regulatory obligations."
    )
    return snap


SNAPSHOT_GENERATORS = {
    "board_aml": generate_board_aml_snapshot,
    "quarterly_compliance": generate_quarterly_compliance_snapshot,
    "risk_committee": generate_risk_committee_snapshot,
    "annual_aml": generate_annual_aml_snapshot,
}


def generate_snapshot(
    db: Session,
    org_id: str,
    report_type: str,
    period_start: date,
    period_end: date,
) -> dict:
    generator = SNAPSHOT_GENERATORS.get(report_type)
    if not generator:
        raise ValueError(f"Unknown report type: {report_type}")
    return generator(db, org_id, period_start, period_end)
