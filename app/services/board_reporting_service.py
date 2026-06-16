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
from typing import Optional

from sqlalchemy.orm import Session

log = logging.getLogger("tvg.board_reporting")


# ── Section builders ──────────────────────────────────────────────────────────

def _cases_section(db: Session, org_id: str, period_start: date, period_end: date) -> dict:
    from app.models.case import Case, CaseStatus, CaseSeverity
    from sqlalchemy import func

    all_open = (
        db.query(Case)
        .filter(
            Case.org_id == org_id,
            Case.status.notin_([
                CaseStatus.closed_no_action,
                CaseStatus.closed_smr_filed,
                CaseStatus.closed_referred,
                CaseStatus.closed_exited,
                CaseStatus.closed_no_smr,
            ])
        )
        .all()
    )

    period_opened = (
        db.query(Case)
        .filter(
            Case.org_id == org_id,
            Case.created_at >= datetime.combine(period_start, datetime.min.time()).replace(tzinfo=timezone.utc),
            Case.created_at <= datetime.combine(period_end, datetime.max.time()).replace(tzinfo=timezone.utc),
        )
        .all()
    )

    period_closed = (
        db.query(Case)
        .filter(
            Case.org_id == org_id,
            Case.closed_at >= datetime.combine(period_start, datetime.min.time()).replace(tzinfo=timezone.utc),
            Case.closed_at <= datetime.combine(period_end, datetime.max.time()).replace(tzinfo=timezone.utc),
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


def _smr_section(db: Session, org_id: str, period_start: date, period_end: date) -> dict:
    from app.models.report import SMRReport, ReportStatus

    def _in_period(q, model):
        return q.filter(
            model.created_at >= datetime.combine(period_start, datetime.min.time()).replace(tzinfo=timezone.utc),
            model.created_at <= datetime.combine(period_end, datetime.max.time()).replace(tzinfo=timezone.utc),
        )

    base = db.query(SMRReport).filter_by(org_id=org_id)
    period_smrs = _in_period(base, SMRReport).all()
    all_smrs = base.all()

    lodged = [s for s in period_smrs if s.smr_lodged]
    pending_mlro = [s for s in all_smrs if not s.smr_lodged and s.status == ReportStatus.draft]
    submitted = [s for s in all_smrs if s.status == ReportStatus.submitted]

    return {
        "total_lodged_period": len(lodged),
        "total_lodged_all_time": sum(1 for s in all_smrs if s.smr_lodged),
        "pending_mlro_sign_off": len(pending_mlro),
        "submitted_to_austrac": len(submitted),
        "is_terrorism_related_period": sum(1 for s in period_smrs if s.is_terrorism_related),
        "draft_smrs": sum(1 for s in all_smrs if s.status == ReportStatus.draft),
        "disclaimer": (
            "SMR lodgement decisions are made exclusively by the reporting entity's MLRO. "
            "This system does not make SMR lodgement decisions."
        ),
    }


def _customers_section(db: Session, org_id: str, period_start: date, period_end: date) -> dict:
    from app.models.customer import Customer, CustomerStatus, RiskLevel, CDDLevel

    all_active = db.query(Customer).filter_by(org_id=org_id, status=CustomerStatus.active).all()
    new_period = (
        db.query(Customer)
        .filter(
            Customer.org_id == org_id,
            Customer.created_at >= datetime.combine(period_start, datetime.min.time()).replace(tzinfo=timezone.utc),
            Customer.created_at <= datetime.combine(period_end, datetime.max.time()).replace(tzinfo=timezone.utc),
        )
        .all()
    )

    high_risk = [c for c in all_active if c.risk_level in (RiskLevel.high, RiskLevel.critical)]
    pep_active = [c for c in all_active if c.is_pep]
    sanctioned = [c for c in all_active if c.is_sanctions_match]
    edd_customers = [c for c in all_active if c.cdd_level == CDDLevel.edd]

    return {
        "total_active": len(all_active),
        "new_this_period": len(new_period),
        "by_risk_level": {
            "critical": sum(1 for c in all_active if c.risk_level == RiskLevel.critical),
            "high": sum(1 for c in all_active if c.risk_level == RiskLevel.high),
            "medium": sum(1 for c in all_active if c.risk_level == RiskLevel.medium),
            "low": sum(1 for c in all_active if c.risk_level == RiskLevel.low),
        },
        "high_risk_total": len(high_risk),
        "pep_customers": len(pep_active),
        "sanctions_matches_active": len(sanctioned),
        "edd_customers": len(edd_customers),
        "high_risk_percentage": round(len(high_risk) / max(len(all_active), 1) * 100, 1),
    }


def _alerts_section(db: Session, org_id: str, period_start: date, period_end: date) -> dict:
    from app.models.monitoring import TransactionAlert, AlertStatus, AlertSeverity

    period_alerts = (
        db.query(TransactionAlert)
        .filter(
            TransactionAlert.org_id == org_id,
            TransactionAlert.created_at >= datetime.combine(period_start, datetime.min.time()).replace(tzinfo=timezone.utc),
            TransactionAlert.created_at <= datetime.combine(period_end, datetime.max.time()).replace(tzinfo=timezone.utc),
        )
        .all()
    )

    open_alerts = db.query(TransactionAlert).filter(
        TransactionAlert.org_id == org_id,
        TransactionAlert.status == AlertStatus.open,
    ).all()

    escalated = [a for a in period_alerts if a.status == AlertStatus.escalated]
    cleared = [a for a in period_alerts if a.status == AlertStatus.cleared]
    false_positive = [a for a in period_alerts if a.status == AlertStatus.false_positive]

    return {
        "alerts_raised_period": len(period_alerts),
        "open_alerts": len(open_alerts),
        "escalated_to_case_period": len(escalated),
        "cleared_period": len(cleared),
        "false_positives_period": len(false_positive),
        "escalation_rate_pct": round(len(escalated) / max(len(period_alerts), 1) * 100, 1),
        "false_positive_rate_pct": round(len(false_positive) / max(len(period_alerts), 1) * 100, 1),
        "by_severity": {
            "critical": sum(1 for a in period_alerts if a.severity == AlertSeverity.critical),
            "high": sum(1 for a in period_alerts if a.severity == AlertSeverity.high),
            "medium": sum(1 for a in period_alerts if a.severity == AlertSeverity.medium),
            "low": sum(1 for a in period_alerts if a.severity == AlertSeverity.low),
        },
    }


def _training_section(db: Session, org_id: str, period_start: date, period_end: date) -> dict:
    from app.models.governance_training import GovernanceTrainingRecord, TrainingAssignment
    from app.models.governance_training import TrainingStatus as GovTrainingStatus

    assignments = (
        db.query(TrainingAssignment)
        .filter_by(org_id=org_id)
        .all()
    )

    records = (
        db.query(GovernanceTrainingRecord)
        .filter_by(org_id=org_id)
        .all()
    )

    completed = [r for r in records if r.status == GovTrainingStatus.completed]
    overdue_assignments = [
        a for a in assignments
        if a.due_date and a.due_date < date.today() and a.status != "completed"
    ]

    period_completions = [
        r for r in completed
        if r.completion_date and period_start <= r.completion_date <= period_end
    ]

    total_assigned = len(assignments)
    total_completed = sum(1 for a in assignments if a.status == "completed")

    return {
        "total_assigned": total_assigned,
        "total_completed": total_completed,
        "completion_rate_pct": round(total_completed / max(total_assigned, 1) * 100, 1),
        "completions_this_period": len(period_completions),
        "overdue_assignments": len(overdue_assignments),
        "total_records": len(records),
    }


def _policies_section(db: Session, org_id: str, period_start: date, period_end: date) -> dict:
    from app.models.governance import Policy, PolicyLifecycleStatus

    policies = db.query(Policy).filter_by(org_id=org_id).all()
    today = date.today()

    active = [p for p in policies if p.status == PolicyLifecycleStatus.approved]
    overdue_review = [
        p for p in active
        if p.review_due_date and p.review_due_date < today
    ]
    due_next_30 = [
        p for p in active
        if p.review_due_date and today <= p.review_due_date <= date(today.year, today.month + 1 if today.month < 12 else 1, today.day)
    ]
    under_review = [p for p in policies if p.status == PolicyLifecycleStatus.under_review]
    draft = [p for p in policies if p.status == PolicyLifecycleStatus.draft]

    period_updated = [
        p for p in policies
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


def _controls_section(db: Session, org_id: str, period_start: date, period_end: date) -> dict:
    from app.models.governance_controls import (
        GovernanceControl, ControlTest, ControlEffectiveness,
    )

    controls = db.query(GovernanceControl).filter_by(org_id=org_id).all()
    control_ids = [c.id for c in controls]

    tests_period = []
    if control_ids:
        tests_period = (
            db.query(ControlTest)
            .filter(
                ControlTest.control_id.in_(control_ids),
                ControlTest.tested_at >= datetime.combine(period_start, datetime.min.time()).replace(tzinfo=timezone.utc),
                ControlTest.tested_at <= datetime.combine(period_end, datetime.max.time()).replace(tzinfo=timezone.utc),
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
    scored = [c for c in controls if hasattr(c, "effectiveness_score") and c.effectiveness_score is not None]
    if scored:
        avg_score = round(sum(c.effectiveness_score for c in scored) / len(scored), 1)

    key_controls = [c for c in controls if c.is_key_control]
    ineffective_key = [
        c for c in key_controls
        if c.effectiveness == ControlEffectiveness.ineffective
    ]

    return {
        "total_controls": len(controls),
        "key_controls": len(key_controls),
        "tests_conducted_period": len(tests_period),
        "effectiveness_breakdown": {
            "effective": effectiveness_map.get(ControlEffectiveness.effective, 0),
            "largely_effective": effectiveness_map.get(ControlEffectiveness.largely_effective, 0),
            "partially_effective": effectiveness_map.get(ControlEffectiveness.partially_effective, 0),
            "ineffective": effectiveness_map.get(ControlEffectiveness.ineffective, 0),
        },
        "average_effectiveness_score": avg_score,
        "ineffective_key_controls": len(ineffective_key),
        "ineffective_key_control_list": [
            {"id": c.id, "name": c.control_ref, "risk_area": c.risk_area}
            for c in ineffective_key[:10]
        ],
    }


def _independent_review_section(db: Session, org_id: str, period_start: date, period_end: date) -> dict:
    from app.models.independent_review import (
        IndependentReview, ReviewFinding, ReviewAction,
        ReviewStatus, FindingStatus, ActionStatus,
    )

    reviews = db.query(IndependentReview).filter_by(org_id=org_id).all()
    active_reviews = [r for r in reviews if r.status not in (ReviewStatus.archived,)]

    findings = db.query(ReviewFinding).filter_by(org_id=org_id).all()
    open_findings = [
        f for f in findings
        if f.status not in (FindingStatus.closed, FindingStatus.accepted_risk)
    ]

    actions = db.query(ReviewAction).filter_by(org_id=org_id).all()
    today = date.today()
    overdue_actions = [
        a for a in actions
        if a.due_date and a.due_date < today
        and a.status not in (ActionStatus.completed, ActionStatus.verified, ActionStatus.cancelled)
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


def _regulatory_reporting_section(db: Session, org_id: str, period_start: date, period_end: date) -> dict:
    from app.models.report import IFTIReport, TTRReport, ReportStatus
    from app.models.ifti_e import IFTIERecord, IFTIEStatus

    def _period_count(model, status_field="status"):
        return (
            db.query(model)
            .filter(
                model.org_id == org_id,
                model.created_at >= datetime.combine(period_start, datetime.min.time()).replace(tzinfo=timezone.utc),
                model.created_at <= datetime.combine(period_end, datetime.max.time()).replace(tzinfo=timezone.utc),
            )
            .count()
        )

    iftis_period = _period_count(IFTIReport)
    ttrs_period = _period_count(TTRReport)
    ifti_e_period = _period_count(IFTIERecord)

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


# ── Main generators ───────────────────────────────────────────────────────────

def _base_snapshot(db: Session, org_id: str, period_start: date, period_end: date) -> dict:
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
        "independent_reviews": _independent_review_section(db, org_id, period_start, period_end),
        "regulatory_reporting": _regulatory_reporting_section(db, org_id, period_start, period_end),
    }


def generate_board_aml_snapshot(db: Session, org_id: str, period_start: date, period_end: date) -> dict:
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
        attention_items.append(f"{cases['overdue_cases']} overdue investigation case(s) requiring management attention")
    if cases["smr_candidates_open"] > 0:
        attention_items.append(f"{cases['smr_candidates_open']} open SMR candidate case(s) pending MLRO decision")
    if customers["sanctions_matches_active"] > 0:
        attention_items.append(f"{customers['sanctions_matches_active']} active customer(s) with sanctions match — EDD required")
    if controls["ineffective_key_controls"] > 0:
        attention_items.append(f"{controls['ineffective_key_controls']} key control(s) rated Ineffective")
    if reviews["open_findings_by_risk"]["critical"] > 0:
        attention_items.append(f"{reviews['open_findings_by_risk']['critical']} critical independent review finding(s) unresolved")
    if snap["policies"]["overdue_review"] > 0:
        attention_items.append(f"{snap['policies']['overdue_review']} AML/CTF polic(ies) overdue for review")

    snap["board_attention_items"] = attention_items
    snap["report_type"] = "board_aml"
    snap["disclaimer"] = (
        "This report is generated from compliance workflow data as at the date shown. "
        "The reporting entity's Board and management are responsible for assessing the "
        "adequacy of the AML/CTF program. This system does not make regulatory decisions."
    )
    return snap


def generate_quarterly_compliance_snapshot(db: Session, org_id: str, period_start: date, period_end: date) -> dict:
    """
    Quarterly Compliance Report — detailed operational view for compliance committee.
    """
    snap = _base_snapshot(db, org_id, period_start, period_end)
    snap["report_type"] = "quarterly_compliance"
    snap["disclaimer"] = (
        "This report is generated from compliance workflow data as at the date shown. "
        "All compliance decisions remain with the reporting entity."
    )
    return snap


def generate_risk_committee_snapshot(db: Session, org_id: str, period_start: date, period_end: date) -> dict:
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
        risk_indicators.append({
            "indicator": "High-risk customer concentration",
            "value": f"{high_risk_pct}% of active customers rated high/critical risk",
            "threshold": "20%",
            "status": "above_threshold",
        })

    if controls.get("ineffective_key_controls", 0) > 0:
        risk_indicators.append({
            "indicator": "Key control failures",
            "value": f"{controls['ineffective_key_controls']} key control(s) ineffective",
            "threshold": "0",
            "status": "breach",
        })

    avg_score = controls.get("average_effectiveness_score")
    if avg_score and avg_score < 70:
        risk_indicators.append({
            "indicator": "Control portfolio effectiveness",
            "value": f"Average effectiveness score {avg_score}/100",
            "threshold": "70",
            "status": "below_threshold",
        })

    if reviews.get("overdue_remediation_actions", 0) > 0:
        risk_indicators.append({
            "indicator": "Overdue remediation actions",
            "value": f"{reviews['overdue_remediation_actions']} independent review action(s) overdue",
            "threshold": "0",
            "status": "above_threshold",
        })

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


def generate_annual_aml_snapshot(db: Session, org_id: str, period_start: date, period_end: date) -> dict:
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
    "board_aml":            generate_board_aml_snapshot,
    "quarterly_compliance": generate_quarterly_compliance_snapshot,
    "risk_committee":       generate_risk_committee_snapshot,
    "annual_aml":           generate_annual_aml_snapshot,
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
