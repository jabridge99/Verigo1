"""
AUSTRAC Examination Pack Service

Generates a consolidated, point-in-time snapshot of all compliance data
that an AUSTRAC examiner requests during a s.167 examination.

Design principles:
  - Data is frozen at generation time (snapshot_data JSON — never mutates)
  - Each section is independent — generation error in one section doesn't
    abort the others (errors captured in generation_errors[])
  - After generation, compliance_event_notifier fires MLRO notification
  - HTML export styled for print/PDF — suitable for direct submission
"""

from __future__ import annotations

import html
import logging
from datetime import date, datetime, timezone
from typing import Optional

from fastapi import HTTPException
from sqlalchemy.orm import Session

from app.models.examination_pack import (
    EXAMINATION_SECTIONS,
    ExaminationPack,
    ExaminationPackStatus,
)

log = logging.getLogger("tvg.exam_pack")


def _next_pack_ref(db: Session, org_id: str) -> str:
    count = db.query(ExaminationPack).filter_by(org_id=org_id).count()
    year = date.today().year
    return f"EXAM-{year}-{str(count + 1).zfill(3)}"


def generate_pack(
    db: Session,
    org_id: str,
    period_start: date,
    period_end: date,
    sections: Optional[list[str]],
    requested_by: str,
    examiner_name: Optional[str] = None,
    examiner_agency: str = "AUSTRAC",
    examination_ref: Optional[str] = None,
) -> ExaminationPack:
    if period_end < period_start:
        raise HTTPException(422, "period_end must be after period_start")

    sections_to_build = sections or EXAMINATION_SECTIONS

    pack = ExaminationPack(
        org_id=org_id,
        pack_ref=_next_pack_ref(db, org_id),
        period_start=period_start,
        period_end=period_end,
        sections=sections_to_build,
        examiner_name=examiner_name,
        examiner_agency=examiner_agency,
        examination_ref=examination_ref,
        status=ExaminationPackStatus.generating,
        requested_by=requested_by,
    )
    db.add(pack)
    db.commit()
    db.refresh(pack)

    snapshot = {}
    errors = []

    for section in sections_to_build:
        try:
            builder = _SECTION_BUILDERS.get(section)
            if builder:
                snapshot[section] = builder(db, org_id, period_start, period_end)
            else:
                errors.append(f"No builder for section: {section}")
        except Exception as exc:
            log.error("Section %s failed for pack %s: %s", section, pack.id, exc)
            errors.append(f"{section}: {exc}")
            snapshot[section] = {"error": str(exc)}

    summary = _build_summary_metrics(snapshot)

    pack.snapshot_data = snapshot
    pack.summary_metrics = summary
    pack.generation_errors = errors
    pack.status = ExaminationPackStatus.ready
    pack.generated_at = datetime.now(timezone.utc)
    db.commit()
    db.refresh(pack)

    # Notify MLRO
    try:
        from app.services.compliance_event_notifier import notify_exam_pack_ready

        notify_exam_pack_ready(db, org_id, pack.id, pack.pack_ref, requested_by)
    except Exception as exc:
        log.warning("Exam pack notification failed: %s", exc)

    return pack


# ══════════════════════════════════════════════════════════════════════════════
# SECTION BUILDERS
# ══════════════════════════════════════════════════════════════════════════════


def _section_aml_program(db: Session, org_id: str, start: date, end: date) -> dict:
    from app.models.aml_solution import (
        AMLProgram,
        AMLSolution,
        RiskAssessment,
    )
    from app.models.organisation import Organisation

    org = db.query(Organisation).filter_by(id=org_id).first()
    solution = db.query(AMLSolution).filter_by(org_id=org_id).first()

    programs = []
    risk_assessments = []
    if solution:
        programs = [
            {
                "id": p.id,
                "name": p.name,
                "status": p.status,
            }
            for p in db.query(AMLProgram).filter_by(solution_id=solution.id).all()
        ]
        risk_assessments = [
            {
                "id": r.id,
                "status": r.status,
                "assessed_at": r.assessed_at.isoformat()
                if getattr(r, "assessed_at", None)
                else None,
            }
            for r in db.query(RiskAssessment).filter_by(solution_id=solution.id).all()
        ]

    return {
        "organisation": {
            "name": org.name if org else org_id,
            "abn": org.abn if org else None,
            "austrac_id": org.austrac_id if org else None,
            "industry": org.industry_type.value if org and org.industry_type else None,
            "country": org.country if org else "AU",
        },
        "aml_solution_status": solution.status.value
        if solution and solution.status
        else None,
        "programs": programs,
        "risk_assessments": risk_assessments,
        "examination_period": {"start": str(start), "end": str(end)},
    }


def _section_customer_profile(db: Session, org_id: str, start: date, end: date) -> dict:
    from app.models.customer import Customer

    customers = db.query(Customer).filter(Customer.org_id == org_id).all()
    period_customers = [
        c for c in customers if c.created_at and start <= c.created_at.date() <= end
    ]

    risk_dist = {"low": 0, "medium": 0, "high": 0, "critical": 0, "unassessed": 0}
    cdd_dist = {}
    for c in customers:
        lvl = (
            c.risk_level.value
            if c.risk_level and hasattr(c.risk_level, "value")
            else str(c.risk_level or "")
        ).lower()
        if lvl in risk_dist:
            risk_dist[lvl] += 1
        else:
            risk_dist["unassessed"] += 1
        cdd = (
            c.cdd_level.value
            if c.cdd_level and hasattr(c.cdd_level, "value")
            else str(c.cdd_level or "standard")
        )
        cdd_dist[cdd] = cdd_dist.get(cdd, 0) + 1

    return {
        "total_customers": len(customers),
        "new_customers_in_period": len(period_customers),
        "risk_level_distribution": risk_dist,
        "cdd_level_distribution": cdd_dist,
        "pep_count": sum(1 for c in customers if getattr(c, "is_pep", False)),
        "sanctions_match_count": sum(
            1 for c in customers if getattr(c, "is_sanctions_match", False)
        ),
        "edd_customers": sum(1 for c in customers if cdd_dist.get("edd", 0)),
        "high_plus_risk_count": risk_dist["high"] + risk_dist["critical"],
    }


def _section_transaction_monitoring(
    db: Session, org_id: str, start: date, end: date
) -> dict:
    from app.models.monitoring import (
        MonitoringRule,
        RuleStatus,
        TransactionAlert,
    )

    active_rules = (
        db.query(MonitoringRule)
        .filter_by(org_id=org_id, status=RuleStatus.active)
        .count()
    )
    total_rules = db.query(MonitoringRule).filter_by(org_id=org_id).count()

    alerts = (
        db.query(TransactionAlert)
        .filter(
            TransactionAlert.org_id == org_id,
            TransactionAlert.created_at >= datetime.combine(start, datetime.min.time()),
            TransactionAlert.created_at <= datetime.combine(end, datetime.max.time()),
        )
        .all()
    )

    severity_dist = {}
    status_dist = {}
    for a in alerts:
        sev = a.severity.value if hasattr(a.severity, "value") else str(a.severity)
        status = a.status.value if hasattr(a.status, "value") else str(a.status)
        severity_dist[sev] = severity_dist.get(sev, 0) + 1
        status_dist[status] = status_dist.get(status, 0) + 1

    return {
        "monitoring_rules": {"total": total_rules, "active": active_rules},
        "alerts_in_period": len(alerts),
        "alert_severity_distribution": severity_dist,
        "alert_status_distribution": status_dist,
        "open_alerts": status_dist.get("open", 0),
        "critical_alerts": severity_dist.get("critical", 0),
    }


def _section_smr_register(db: Session, org_id: str, start: date, end: date) -> dict:
    from app.models.report import SMRReport

    smrs = (
        db.query(SMRReport)
        .filter(
            SMRReport.org_id == org_id,
            SMRReport.created_at >= datetime.combine(start, datetime.min.time()),
            SMRReport.created_at <= datetime.combine(end, datetime.max.time()),
        )
        .all()
    )

    status_dist = {}
    records = []
    for s in smrs:
        st = s.status.value if hasattr(s.status, "value") else str(s.status)
        status_dist[st] = status_dist.get(st, 0) + 1
        records.append(
            {
                "id": s.id,
                "report_ref": getattr(s, "report_ref", s.id),
                "status": st,
                "created_at": s.created_at.date().isoformat() if s.created_at else None,
            }
        )

    return {
        "total_smrs": len(smrs),
        "status_distribution": status_dist,
        "filed_count": status_dist.get("submitted", 0) + status_dist.get("accepted", 0),
        "pending_count": status_dist.get("draft", 0)
        + status_dist.get("pending_review", 0),
        "records": records,
    }


def _section_ifti_register(db: Session, org_id: str, start: date, end: date) -> dict:
    from app.models.ifti_e import IFTIERecord
    from app.models.report import IFTIReport

    iftis = (
        db.query(IFTIReport)
        .filter(
            IFTIReport.org_id == org_id,
            IFTIReport.created_at >= datetime.combine(start, datetime.min.time()),
            IFTIReport.created_at <= datetime.combine(end, datetime.max.time()),
        )
        .all()
    )

    ifti_e = (
        db.query(IFTIERecord)
        .filter(
            IFTIERecord.org_id == org_id,
            IFTIERecord.created_at >= datetime.combine(start, datetime.min.time()),
            IFTIERecord.created_at <= datetime.combine(end, datetime.max.time()),
        )
        .all()
    )

    return {
        "total_ifti_dra": len(iftis),
        "total_ifti_e": len(ifti_e),
        "total_iftis": len(iftis) + len(ifti_e),
        "ifti_dra_records": [
            {
                "id": i.id,
                "report_ref": getattr(i, "report_ref", i.id),
                "status": i.status.value
                if hasattr(i.status, "value")
                else str(i.status),
                "created_at": i.created_at.date().isoformat() if i.created_at else None,
            }
            for i in iftis
        ],
        "ifti_e_records": [
            {
                "id": i.id,
                "status": i.status.value
                if hasattr(i.status, "value")
                else str(i.status),
                "created_at": i.created_at.date().isoformat() if i.created_at else None,
            }
            for i in ifti_e
        ],
    }


def _section_ttr_register(db: Session, org_id: str, start: date, end: date) -> dict:
    from app.models.report import TTRReport

    ttrs = (
        db.query(TTRReport)
        .filter(
            TTRReport.org_id == org_id,
            TTRReport.created_at >= datetime.combine(start, datetime.min.time()),
            TTRReport.created_at <= datetime.combine(end, datetime.max.time()),
        )
        .all()
    )

    status_dist = {}
    for t in ttrs:
        st = t.status.value if hasattr(t.status, "value") else str(t.status)
        status_dist[st] = status_dist.get(st, 0) + 1

    return {
        "total_ttrs": len(ttrs),
        "status_distribution": status_dist,
        "records": [
            {
                "id": t.id,
                "report_ref": getattr(t, "report_ref", t.id),
                "status": t.status.value
                if hasattr(t.status, "value")
                else str(t.status),
                "created_at": t.created_at.date().isoformat() if t.created_at else None,
            }
            for t in ttrs
        ],
    }


def _section_training_records(db: Session, org_id: str, start: date, end: date) -> dict:
    from app.models.governance_training import (
        GovernanceTrainingRecord,
        TrainingCourse,
    )
    from app.models.user import User

    records = db.query(GovernanceTrainingRecord).filter_by(org_id=org_id).all()
    mandatory_courses = (
        db.query(TrainingCourse)
        .filter_by(org_id=org_id, is_mandatory=True, is_active=True)
        .all()
    )
    users = db.query(User).filter_by(org_id=org_id, status="active").all()

    status_dist = {}
    for r in records:
        st = r.status.value if hasattr(r.status, "value") else str(r.status)
        status_dist[st] = status_dist.get(st, 0) + 1

    completed = status_dist.get("completed", 0)
    assigned_total = sum(v for k, v in status_dist.items() if k != "exempt")
    completion_pct = round(completed / assigned_total * 100, 1) if assigned_total else 0

    # Assessment flags
    from app.models.training_trigger import AssessmentFlagStatus, AssessmentOutcomeFlag

    open_flags = (
        db.query(AssessmentOutcomeFlag)
        .filter_by(org_id=org_id, status=AssessmentFlagStatus.open)
        .count()
    )

    return {
        "total_staff": len(users),
        "mandatory_courses_count": len(mandatory_courses),
        "total_training_records": len(records),
        "status_distribution": status_dist,
        "completion_rate_pct": completion_pct,
        "overdue_count": status_dist.get("overdue", 0),
        "expired_count": status_dist.get("expired", 0),
        "open_assessment_flags": open_flags,
        "mandatory_courses": [
            {
                "id": c.id,
                "name": c.name,
                "training_type": c.training_type,
                "applicable_roles": c.applicable_roles,
            }
            for c in mandatory_courses
        ],
    }


def _section_independent_reviews(
    db: Session, org_id: str, start: date, end: date
) -> dict:
    from app.models.independent_review import (
        ActionStatus,
        IndependentReview,
        ReviewAction,
        ReviewFinding,
    )

    reviews = db.query(IndependentReview).filter_by(org_id=org_id).all()

    findings_summary = {"low": 0, "medium": 0, "high": 0, "critical": 0}
    open_findings = 0
    open_actions = 0

    for review in reviews:
        findings = db.query(ReviewFinding).filter_by(review_id=review.id).all()
        for f in findings:
            risk = (
                f.risk_rating.value
                if hasattr(f.risk_rating, "value")
                else str(f.risk_rating or "low")
            )
            if risk in findings_summary:
                findings_summary[risk] += 1
            st = f.status.value if hasattr(f.status, "value") else str(f.status)
            if "open" in st or "progress" in st:
                open_findings += 1

        actions = (
            db.query(ReviewAction)
            .filter_by(review_id=review.id)
            .filter(ReviewAction.status != ActionStatus.completed)
            .count()
        )
        open_actions += actions

    return {
        "total_reviews": len(reviews),
        "reviews_by_status": _count_by(reviews, "status"),
        "total_findings": sum(findings_summary.values()),
        "findings_by_risk": findings_summary,
        "open_findings": open_findings,
        "open_remediation_actions": open_actions,
        "high_critical_findings": findings_summary["high"]
        + findings_summary["critical"],
        "reviews": [
            {
                "id": r.id,
                "review_ref": getattr(r, "review_ref", r.id),
                "status": r.status.value
                if hasattr(r.status, "value")
                else str(r.status),
                "review_type": r.review_type.value
                if hasattr(r.review_type, "value")
                else str(r.review_type),
            }
            for r in reviews
        ],
    }


def _section_policy_register(db: Session, org_id: str, start: date, end: date) -> dict:
    from app.models.governance import Policy, PolicyAttestation

    policies = db.query(Policy).filter_by(org_id=org_id).all()
    today = date.today()
    overdue_review = [
        p
        for p in policies
        if getattr(p, "review_due_date", None) and p.review_due_date < today
    ]

    attestations_this_period = (
        db.query(PolicyAttestation)
        .filter(
            PolicyAttestation.org_id == org_id,
            PolicyAttestation.attested_at
            >= datetime.combine(start, datetime.min.time()),
            PolicyAttestation.attested_at <= datetime.combine(end, datetime.max.time()),
        )
        .count()
        if hasattr(PolicyAttestation, "org_id")
        else 0
    )

    return {
        "total_policies": len(policies),
        "policies_by_status": _count_by(policies, "lifecycle_status"),
        "overdue_review_count": len(overdue_review),
        "attestations_in_period": attestations_this_period,
        "policies": [
            {
                "id": p.id,
                "policy_number": getattr(p, "policy_number", p.id),
                "title": p.title,
                "status": p.lifecycle_status.value
                if hasattr(p.lifecycle_status, "value")
                else str(p.lifecycle_status),
                "review_due_date": p.review_due_date.isoformat()
                if getattr(p, "review_due_date", None)
                else None,
                "is_overdue_review": p in overdue_review,
            }
            for p in policies
        ],
    }


def _section_control_testing(db: Session, org_id: str, start: date, end: date) -> dict:
    from app.models.governance_controls import (
        ControlTest,
        ControlTestFinding,
        GovernanceControl,
    )

    controls = db.query(GovernanceControl).filter_by(org_id=org_id).all()
    tests_in_period = (
        db.query(ControlTest)
        .filter(
            ControlTest.control_id.in_([c.id for c in controls]),
            ControlTest.test_date >= start,
            ControlTest.test_date <= end,
        )
        .all()
        if controls
        else []
    )

    findings = (
        db.query(ControlTestFinding)
        .filter(ControlTestFinding.test_id.in_([t.id for t in tests_in_period]))
        .all()
        if tests_in_period
        else []
    )

    open_findings = [f for f in findings if not getattr(f, "is_closed", False)]

    return {
        "total_controls": len(controls),
        "controls_by_status": _count_by(controls, "status"),
        "tests_in_period": len(tests_in_period),
        "findings_in_period": len(findings),
        "open_findings": len(open_findings),
        "controls": [
            {
                "id": c.id,
                "control_ref": getattr(c, "control_ref", c.id),
                "name": c.name,
                "status": c.status.value
                if hasattr(c.status, "value")
                else str(c.status),
                "effectiveness": getattr(c, "effectiveness", None),
            }
            for c in controls
        ],
    }


def _section_notification_history(
    db: Session, org_id: str, start: date, end: date
) -> dict:
    """
    Notification history proves to the examiner that staff were alerted to
    compliance issues — key evidence of proactive governance.
    """
    from app.models.notification import Notification, NotificationPriority
    from app.models.user import User

    org_user_ids = [u.id for u in db.query(User).filter_by(org_id=org_id).all()]

    notifs = (
        db.query(Notification)
        .filter(
            Notification.user_id.in_(org_user_ids),
            Notification.created_at >= datetime.combine(start, datetime.min.time()),
            Notification.created_at <= datetime.combine(end, datetime.max.time()),
        )
        .order_by(Notification.created_at.desc())
        .all()
    )

    urgent = [n for n in notifs if n.priority == NotificationPriority.urgent]
    type_dist = {}
    for n in notifs:
        t = n.notif_type.value if hasattr(n.notif_type, "value") else str(n.notif_type)
        type_dist[t] = type_dist.get(t, 0) + 1

    return {
        "total_notifications": len(notifs),
        "urgent_notifications": len(urgent),
        "type_distribution": type_dist,
        "unread_count": sum(1 for n in notifs if not n.read),
        "emailed_count": sum(1 for n in notifs if n.emailed),
        "sample_urgent": [
            {
                "title": n.title,
                "body": n.body,
                "created_at": n.created_at.isoformat() if n.created_at else None,
                "entity_type": n.entity_type,
                "entity_id": n.entity_id,
            }
            for n in urgent[:20]
        ],
    }


_SECTION_BUILDERS = {
    "aml_program": _section_aml_program,
    "customer_profile": _section_customer_profile,
    "transaction_monitoring": _section_transaction_monitoring,
    "smr_register": _section_smr_register,
    "ifti_register": _section_ifti_register,
    "ttr_register": _section_ttr_register,
    "training_records": _section_training_records,
    "independent_reviews": _section_independent_reviews,
    "policy_register": _section_policy_register,
    "control_testing": _section_control_testing,
    "notification_history": _section_notification_history,
}


# ══════════════════════════════════════════════════════════════════════════════
# SUMMARY METRICS
# ══════════════════════════════════════════════════════════════════════════════


def _build_summary_metrics(snapshot: dict) -> dict:
    s = {}
    try:
        cp = snapshot.get("customer_profile", {})
        s["total_customers"] = cp.get("total_customers", 0)
        s["high_risk_customers"] = cp.get("high_plus_risk_count", 0)
        s["pep_count"] = cp.get("pep_count", 0)
        s["sanctions_match_count"] = cp.get("sanctions_match_count", 0)
    except Exception:
        pass
    try:
        smr = snapshot.get("smr_register", {})
        s["smrs_filed"] = smr.get("filed_count", 0)
        s["smrs_pending"] = smr.get("pending_count", 0)
    except Exception:
        pass
    try:
        ifti = snapshot.get("ifti_register", {})
        s["iftis_filed"] = ifti.get("total_iftis", 0)
    except Exception:
        pass
    try:
        ttr = snapshot.get("ttr_register", {})
        s["ttrs_filed"] = ttr.get("total_ttrs", 0)
    except Exception:
        pass
    try:
        tr = snapshot.get("training_records", {})
        s["training_completion_pct"] = tr.get("completion_rate_pct", 0)
        s["training_overdue_count"] = tr.get("overdue_count", 0)
        s["open_assessment_flags"] = tr.get("open_assessment_flags", 0)
    except Exception:
        pass
    try:
        ir = snapshot.get("independent_reviews", {})
        s["open_ir_findings"] = ir.get("open_findings", 0)
        s["high_critical_ir_findings"] = ir.get("high_critical_findings", 0)
    except Exception:
        pass
    try:
        pol = snapshot.get("policy_register", {})
        s["policies_overdue_review"] = pol.get("overdue_review_count", 0)
    except Exception:
        pass
    try:
        ct = snapshot.get("control_testing", {})
        s["open_control_findings"] = ct.get("open_findings", 0)
    except Exception:
        pass
    try:
        mon = snapshot.get("transaction_monitoring", {})
        s["open_alerts"] = mon.get("open_alerts", 0)
        s["critical_alerts"] = mon.get("critical_alerts", 0)
    except Exception:
        pass
    return s


def _count_by(items: list, attr: str) -> dict:
    dist = {}
    for item in items:
        val = getattr(item, attr, None)
        key = val.value if val and hasattr(val, "value") else str(val or "unknown")
        dist[key] = dist.get(key, 0) + 1
    return dist


# ══════════════════════════════════════════════════════════════════════════════
# HTML EXPORT
# ══════════════════════════════════════════════════════════════════════════════


def export_html(pack: ExaminationPack) -> str:
    m = pack.summary_metrics or {}
    snap = pack.snapshot_data or {}
    org_info = snap.get("aml_program", {}).get("organisation", {})

    pack_ref_safe = html.escape(pack.pack_ref or "")
    org_name_safe = html.escape(str(org_info.get("name", pack.org_id) or ""))
    org_abn_safe = html.escape(str(org_info.get("abn", "—") or "—"))
    org_austrac_id_safe = html.escape(str(org_info.get("austrac_id", "—") or "—"))
    examiner_name_safe = html.escape(pack.examiner_name or "—")
    examiner_agency_safe = html.escape(pack.examiner_agency or "")

    def kpi(label: str, value) -> str:
        return f'<div class="kpi"><div class="kpi-val">{value}</div><div class="kpi-label">{label}</div></div>'

    kpis = "".join(
        [
            kpi("Total Customers", m.get("total_customers", "—")),
            kpi("High+ Risk", m.get("high_risk_customers", "—")),
            kpi("PEPs", m.get("pep_count", "—")),
            kpi("SMRs Filed", m.get("smrs_filed", "—")),
            kpi("IFTIs Filed", m.get("iftis_filed", "—")),
            kpi("Training Complete", f"{m.get('training_completion_pct', '—')}%"),
            kpi("Open IR Findings", m.get("open_ir_findings", "—")),
            kpi("Open Alerts", m.get("open_alerts", "—")),
        ]
    )

    section_html = ""
    for section in pack.sections or []:
        data = snap.get(section, {})
        section_title_safe = html.escape(section.replace("_", " ").title())
        if "error" in data:
            error_safe = html.escape(str(data["error"]))
            section_html += f'<h2>{section_title_safe}</h2><p class="error">Section error: {error_safe}</p>'
        else:
            rows = "".join(
                f"<tr><td>{html.escape(k.replace('_', ' ').title())}</td><td>{html.escape(str(v))}</td></tr>"
                for k, v in data.items()
                if not isinstance(v, (list, dict))
            )
            section_html += f"""
            <h2>{section_title_safe}</h2>
            <table><thead><tr><th>Metric</th><th>Value</th></tr></thead>
            <tbody>{rows}</tbody></table>"""

    errors_html = ""
    if pack.generation_errors:
        errors_html = (
            "<h2>Generation Warnings</h2><ul>"
            + "".join(f"<li>{html.escape(str(e))}</li>" for e in pack.generation_errors)
            + "</ul>"
        )

    return f"""<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<title>AUSTRAC Examination Pack — {pack_ref_safe}</title>
<style>
  body {{ font-family: 'Segoe UI', Arial, sans-serif; font-size: 13px; color: #1a1a2e; margin: 40px; }}
  h1 {{ color: #0a3d62; border-bottom: 3px solid #0a3d62; padding-bottom: 8px; }}
  h2 {{ color: #0a3d62; margin-top: 32px; border-bottom: 1px solid #ddd; padding-bottom: 4px; }}
  .meta {{ background: #f0f4f8; border-left: 4px solid #0a3d62; padding: 12px 16px; margin-bottom: 24px; }}
  .kpi-grid {{ display: flex; flex-wrap: wrap; gap: 12px; margin: 20px 0; }}
  .kpi {{ background: #0a3d62; color: white; border-radius: 8px; padding: 16px 20px; min-width: 120px; text-align: center; }}
  .kpi-val {{ font-size: 28px; font-weight: bold; }}
  .kpi-label {{ font-size: 11px; opacity: 0.85; margin-top: 4px; }}
  table {{ width: 100%; border-collapse: collapse; margin: 12px 0; font-size: 12px; }}
  th {{ background: #0a3d62; color: white; padding: 8px 12px; text-align: left; }}
  td {{ padding: 7px 12px; border-bottom: 1px solid #eee; }}
  tr:nth-child(even) td {{ background: #f9f9f9; }}
  .error {{ color: #c0392b; font-style: italic; }}
  .confidential {{ background: #c0392b; color: white; text-align: center; padding: 6px; font-weight: bold; margin-bottom: 16px; border-radius: 4px; }}
  @media print {{ .no-print {{ display: none; }} }}
</style>
</head>
<body>
<div class="confidential">CONFIDENTIAL — AUSTRAC EXAMINATION PACK — NOT FOR GENERAL DISTRIBUTION</div>
<h1>AUSTRAC Examination Pack</h1>
<div class="meta">
  <strong>Pack Reference:</strong> {pack_ref_safe} &nbsp;|&nbsp;
  <strong>Organisation:</strong> {org_name_safe} &nbsp;|&nbsp;
  <strong>ABN:</strong> {org_abn_safe} &nbsp;|&nbsp;
  <strong>AUSTRAC ID:</strong> {org_austrac_id_safe}<br>
  <strong>Examination Period:</strong> {pack.period_start} to {pack.period_end} &nbsp;|&nbsp;
  <strong>Generated:</strong> {pack.generated_at.strftime("%d %b %Y %H:%M UTC") if pack.generated_at else "—"} &nbsp;|&nbsp;
  <strong>Examiner:</strong> {examiner_name_safe} ({examiner_agency_safe})
</div>
<h2>Summary Metrics</h2>
<div class="kpi-grid">{kpis}</div>
{section_html}
{errors_html}
<hr>
<p style="font-size:11px;color:#888;">
  Generated by VeriGo Compliance Platform — {pack_ref_safe} — Version {pack.version}<br>
  This document contains confidential AML/CTF program information protected under the AML/CTF Act 2006 s.167.
</p>
</body>
</html>"""


def export_csv_index(pack: ExaminationPack) -> str:
    import csv
    import io

    snap = pack.snapshot_data or {}
    buf = io.StringIO()
    w = csv.writer(buf)
    w.writerow(["Pack Reference", pack.pack_ref])
    w.writerow(["Period", f"{pack.period_start} to {pack.period_end}"])
    w.writerow(["Generated At", str(pack.generated_at)])
    w.writerow([])
    w.writerow(["Section", "Metric", "Value"])
    for section in pack.sections or []:
        data = snap.get(section, {})
        for k, v in data.items():
            if not isinstance(v, (list, dict)):
                w.writerow(
                    [section.replace("_", " ").title(), k.replace("_", " ").title(), v]
                )
    return buf.getvalue()
