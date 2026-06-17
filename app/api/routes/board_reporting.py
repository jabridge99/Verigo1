"""
Board & Executive Reporting API routes.

Report types:
  board_aml             — Quarterly Board AML/CTF Report
  quarterly_compliance  — Detailed Quarterly Compliance Report
  risk_committee        — Risk Committee Report
  annual_aml            — Annual AML/CTF Program Report

Lifecycle: draft → under_review → approved → distributed → archived

DISCLAIMER: Reports are auto-populated from workflow data.
The reporting entity is responsible for accuracy and completeness.
"""
import csv
import io
import logging
from datetime import date, datetime, timezone
from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from fastapi.responses import HTMLResponse, StreamingResponse
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app.api.deps import get_current_user, get_db, require_roles
from app.models.board_report import BoardReport, BoardReportStatus, BoardReportType, ReportPeriod
from app.models.user import UserRole
from app.services.board_reporting_service import generate_snapshot

log = logging.getLogger("tvg.board_reporting")

router = APIRouter(prefix="/board-reports", tags=["Board & Executive Reporting"])

# ── Status transitions ────────────────────────────────────────────────────────

REPORT_TRANSITIONS = {
    BoardReportStatus.draft:        [BoardReportStatus.under_review],
    BoardReportStatus.under_review: [BoardReportStatus.approved, BoardReportStatus.draft],
    BoardReportStatus.approved:     [BoardReportStatus.distributed],
    BoardReportStatus.distributed:  [BoardReportStatus.archived],
    BoardReportStatus.archived:     [],
}

# ── Pydantic schemas ──────────────────────────────────────────────────────────

class ReportCreate(BaseModel):
    report_ref: str
    report_type: BoardReportType
    period: ReportPeriod
    period_start: date
    period_end: date
    title: Optional[str] = None
    executive_summary: Optional[str] = None
    mlro_commentary: Optional[str] = None
    key_messages: Optional[List[str]] = None


class ReportUpdate(BaseModel):
    title: Optional[str] = None
    executive_summary: Optional[str] = None
    mlro_commentary: Optional[str] = None
    key_messages: Optional[List[str]] = None
    board_minutes_ref: Optional[str] = None
    board_resolution: Optional[str] = None


class DistributeBody(BaseModel):
    distributed_to: List[str]    # e.g. ["Board", "Audit Committee", "CEO"]
    distribution_notes: Optional[str] = None


# ── Helpers ───────────────────────────────────────────────────────────────────

def _get_report(db: Session, org_id: str, report_id: str) -> BoardReport:
    r = db.query(BoardReport).filter_by(id=report_id, org_id=org_id).first()
    if not r:
        raise HTTPException(404, "Report not found")
    return r


def _report_dict(r: BoardReport, include_snapshot: bool = False) -> dict:
    d = {
        "id": r.id,
        "report_ref": r.report_ref,
        "org_id": r.org_id,
        "report_type": r.report_type,
        "status": r.status,
        "period": r.period,
        "period_start": str(r.period_start),
        "period_end": str(r.period_end),
        "report_year": r.report_year,
        "title": r.title,
        "executive_summary": r.executive_summary,
        "mlro_commentary": r.mlro_commentary,
        "key_messages": r.key_messages,
        "generated_at": r.generated_at.isoformat() if r.generated_at else None,
        "generated_by": r.generated_by,
        "reviewed_by": r.reviewed_by,
        "reviewed_at": r.reviewed_at.isoformat() if r.reviewed_at else None,
        "review_notes": r.review_notes,
        "approved_by": r.approved_by,
        "approved_at": r.approved_at.isoformat() if r.approved_at else None,
        "approval_notes": r.approval_notes,
        "distributed_to": r.distributed_to,
        "distributed_at": r.distributed_at.isoformat() if r.distributed_at else None,
        "distributed_by": r.distributed_by,
        "distribution_notes": r.distribution_notes,
        "board_minutes_ref": r.board_minutes_ref,
        "board_resolution": r.board_resolution,
        "is_confidential": r.is_confidential,
        "version": r.version,
        "supersedes_id": r.supersedes_id,
        "created_by": r.created_by,
        "created_at": r.created_at.isoformat() if r.created_at else None,
        "updated_at": r.updated_at.isoformat() if r.updated_at else None,
    }
    if include_snapshot:
        d["snapshot_data"] = r.snapshot_data
    return d


def _default_title(report_type: BoardReportType, period: ReportPeriod, year: int) -> str:
    labels = {
        BoardReportType.board_aml:            "Board AML/CTF Report",
        BoardReportType.quarterly_compliance: "Quarterly Compliance Report",
        BoardReportType.risk_committee:       "Risk Committee Report",
        BoardReportType.annual_aml:           "Annual AML/CTF Program Report",
    }
    period_labels = {
        ReportPeriod.q1: "Q1", ReportPeriod.q2: "Q2",
        ReportPeriod.q3: "Q3", ReportPeriod.q4: "Q4",
        ReportPeriod.h1: "H1", ReportPeriod.h2: "H2",
        ReportPeriod.annual: "Annual", ReportPeriod.custom: "Custom Period",
    }
    return f"{labels.get(report_type, 'Compliance Report')} — {period_labels.get(period, '')} {year}"


# ── Enums ─────────────────────────────────────────────────────────────────────

@router.get("/enums")
def report_enums():
    return {
        "report_type": [e.value for e in BoardReportType],
        "report_status": [e.value for e in BoardReportStatus],
        "period": [e.value for e in ReportPeriod],
    }


# ── CRUD ─────────────────────────────────────────────────────────────────────

@router.post("", status_code=201)
def create_report(
    body: ReportCreate,
    db: Session = Depends(get_db),
    current_user=Depends(require_roles(UserRole.compliance)),
):
    """
    Create a new board report and auto-populate its snapshot from live compliance data.
    The snapshot is taken at creation time and stored immutably.
    """
    if db.query(BoardReport).filter_by(org_id=current_user.org_id, report_ref=body.report_ref).first():
        raise HTTPException(409, f"Report ref '{body.report_ref}' already exists")

    if body.period_start > body.period_end:
        raise HTTPException(422, "period_start must be before period_end")

    # Generate snapshot from live data
    try:
        snapshot = generate_snapshot(
            db=db,
            org_id=current_user.org_id,
            report_type=body.report_type.value,
            period_start=body.period_start,
            period_end=body.period_end,
        )
    except Exception as e:
        log.error("snapshot_generation_failed org=%s type=%s: %s", current_user.org_id, body.report_type, e)
        raise HTTPException(500, f"Failed to generate report snapshot: {e}")

    title = body.title or _default_title(body.report_type, body.period, body.period_start.year)

    report = BoardReport(
        report_ref=body.report_ref,
        org_id=current_user.org_id,
        report_type=body.report_type,
        period=body.period,
        period_start=body.period_start,
        period_end=body.period_end,
        report_year=body.period_start.year,
        title=title,
        executive_summary=body.executive_summary,
        mlro_commentary=body.mlro_commentary,
        key_messages=body.key_messages or [],
        snapshot_data=snapshot,
        generated_at=datetime.now(timezone.utc),
        generated_by=current_user.id,
        created_by=current_user.id,
    )
    db.add(report)
    db.commit()
    db.refresh(report)
    log.info("board_report.created org=%s ref=%s type=%s", current_user.org_id, report.report_ref, report.report_type)
    return _report_dict(report, include_snapshot=True)


@router.post("/{report_id}/regenerate-snapshot")
def regenerate_snapshot(
    report_id: str,
    db: Session = Depends(get_db),
    current_user=Depends(require_roles(UserRole.compliance)),
):
    """
    Re-run data aggregation to refresh the snapshot with current data.
    Only allowed while report is in 'draft' status.
    """
    report = _get_report(db, current_user.org_id, report_id)
    if report.status != BoardReportStatus.draft:
        raise HTTPException(409, "Snapshot can only be regenerated for draft reports")

    try:
        snapshot = generate_snapshot(
            db=db,
            org_id=current_user.org_id,
            report_type=report.report_type.value,
            period_start=report.period_start,
            period_end=report.period_end,
        )
    except Exception as e:
        raise HTTPException(500, f"Failed to regenerate snapshot: {e}")

    report.snapshot_data = snapshot
    report.generated_at = datetime.now(timezone.utc)
    report.generated_by = current_user.id
    db.commit()
    db.refresh(report)
    log.info("board_report.snapshot_regenerated org=%s ref=%s", current_user.org_id, report.report_ref)
    return _report_dict(report, include_snapshot=True)


@router.get("")
def list_reports(
    report_type: Optional[BoardReportType] = None,
    status: Optional[BoardReportStatus] = None,
    year: Optional[int] = None,
    skip: int = 0,
    limit: int = Query(50, le=200),
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
):
    q = db.query(BoardReport).filter_by(org_id=current_user.org_id)
    if report_type:
        q = q.filter(BoardReport.report_type == report_type)
    if status:
        q = q.filter(BoardReport.status == status)
    if year:
        q = q.filter(BoardReport.report_year == year)
    total = q.count()
    items = q.order_by(BoardReport.created_at.desc()).offset(skip).limit(limit).all()
    return {"total": total, "items": [_report_dict(r) for r in items]}


@router.get("/{report_id}")
def get_report(
    report_id: str,
    include_snapshot: bool = True,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
):
    return _report_dict(_get_report(db, current_user.org_id, report_id), include_snapshot=include_snapshot)


@router.patch("/{report_id}")
def update_report(
    report_id: str,
    body: ReportUpdate,
    db: Session = Depends(get_db),
    current_user=Depends(require_roles(UserRole.compliance)),
):
    report = _get_report(db, current_user.org_id, report_id)
    if report.status in (BoardReportStatus.approved, BoardReportStatus.distributed, BoardReportStatus.archived):
        raise HTTPException(409, f"Reports in '{report.status}' status cannot be edited")
    for field, value in body.model_dump(exclude_none=True).items():
        setattr(report, field, value)
    db.commit()
    db.refresh(report)
    return _report_dict(report)


# ── Lifecycle transitions ──────────────────────────────────────────────────────

@router.post("/{report_id}/submit-for-review")
def submit_for_review(
    report_id: str,
    notes: Optional[str] = None,
    db: Session = Depends(get_db),
    current_user=Depends(require_roles(UserRole.compliance)),
):
    report = _get_report(db, current_user.org_id, report_id)
    if report.status != BoardReportStatus.draft:
        raise HTTPException(422, f"Report must be in 'draft' status, not '{report.status}'")
    report.status = BoardReportStatus.under_review
    report.review_notes = notes
    db.commit()
    db.refresh(report)
    log.info("board_report.submitted_for_review org=%s ref=%s", current_user.org_id, report.report_ref)
    return _report_dict(report)


@router.post("/{report_id}/approve")
def approve_report(
    report_id: str,
    approval_notes: Optional[str] = None,
    db: Session = Depends(get_db),
    current_user=Depends(require_roles(UserRole.mlro)),
):
    """MLRO approves the report before Board distribution."""
    report = _get_report(db, current_user.org_id, report_id)
    if report.status != BoardReportStatus.under_review:
        raise HTTPException(422, f"Report must be 'under_review' to approve, not '{report.status}'")
    report.status = BoardReportStatus.approved
    report.approved_by = current_user.id
    report.approved_at = datetime.now(timezone.utc)
    report.approval_notes = approval_notes
    db.commit()
    db.refresh(report)
    log.info("board_report.approved org=%s ref=%s by=%s", current_user.org_id, report.report_ref, current_user.id)
    return _report_dict(report)


@router.post("/{report_id}/return-to-draft")
def return_to_draft(
    report_id: str,
    review_notes: str,
    db: Session = Depends(get_db),
    current_user=Depends(require_roles(UserRole.mlro)),
):
    """Return report from under_review to draft for revision."""
    report = _get_report(db, current_user.org_id, report_id)
    if report.status != BoardReportStatus.under_review:
        raise HTTPException(422, "Can only return 'under_review' reports to draft")
    report.status = BoardReportStatus.draft
    report.reviewed_by = current_user.id
    report.reviewed_at = datetime.now(timezone.utc)
    report.review_notes = review_notes
    db.commit()
    db.refresh(report)
    return _report_dict(report)


@router.post("/{report_id}/distribute")
def distribute_report(
    report_id: str,
    body: DistributeBody,
    db: Session = Depends(get_db),
    current_user=Depends(require_roles(UserRole.mlro)),
):
    """Record that the approved report has been distributed to Board / committees."""
    report = _get_report(db, current_user.org_id, report_id)
    if report.status != BoardReportStatus.approved:
        raise HTTPException(422, f"Report must be 'approved' before distribution, not '{report.status}'")
    if not body.distributed_to:
        raise HTTPException(422, "distributed_to must not be empty")
    report.status = BoardReportStatus.distributed
    report.distributed_to = body.distributed_to
    report.distributed_at = datetime.now(timezone.utc)
    report.distributed_by = current_user.id
    report.distribution_notes = body.distribution_notes
    db.commit()
    db.refresh(report)
    log.info(
        "board_report.distributed org=%s ref=%s to=%s",
        current_user.org_id, report.report_ref, body.distributed_to
    )
    return _report_dict(report)


@router.post("/{report_id}/archive")
def archive_report(
    report_id: str,
    db: Session = Depends(get_db),
    current_user=Depends(require_roles(UserRole.mlro)),
):
    report = _get_report(db, current_user.org_id, report_id)
    if report.status != BoardReportStatus.distributed:
        raise HTTPException(422, "Only distributed reports can be archived")
    report.status = BoardReportStatus.archived
    db.commit()
    db.refresh(report)
    return _report_dict(report)


# ── New version ───────────────────────────────────────────────────────────────

@router.post("/{report_id}/new-version", status_code=201)
def create_new_version(
    report_id: str,
    new_ref: str,
    db: Session = Depends(get_db),
    current_user=Depends(require_roles(UserRole.compliance)),
):
    """
    Create a revised version of an existing report (e.g. after Board feedback).
    Re-generates snapshot from current live data.
    """
    original = _get_report(db, current_user.org_id, report_id)

    if db.query(BoardReport).filter_by(org_id=current_user.org_id, report_ref=new_ref).first():
        raise HTTPException(409, f"Report ref '{new_ref}' already exists")

    try:
        snapshot = generate_snapshot(
            db=db,
            org_id=current_user.org_id,
            report_type=original.report_type.value,
            period_start=original.period_start,
            period_end=original.period_end,
        )
    except Exception as e:
        raise HTTPException(500, f"Failed to generate snapshot: {e}")

    new_report = BoardReport(
        report_ref=new_ref,
        org_id=current_user.org_id,
        report_type=original.report_type,
        period=original.period,
        period_start=original.period_start,
        period_end=original.period_end,
        report_year=original.report_year,
        title=original.title,
        executive_summary=original.executive_summary,
        mlro_commentary=original.mlro_commentary,
        key_messages=original.key_messages or [],
        snapshot_data=snapshot,
        generated_at=datetime.now(timezone.utc),
        generated_by=current_user.id,
        version=original.version + 1,
        supersedes_id=original.id,
        created_by=current_user.id,
    )
    db.add(new_report)
    db.commit()
    db.refresh(new_report)
    log.info(
        "board_report.new_version org=%s ref=%s v=%d",
        current_user.org_id, new_report.report_ref, new_report.version
    )
    return _report_dict(new_report, include_snapshot=True)


# ── Exports ───────────────────────────────────────────────────────────────────

@router.get("/{report_id}/export-html", response_class=HTMLResponse)
def export_html(
    report_id: str,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
):
    """
    Export an HTML version of the report suitable for PDF printing.
    Includes all auto-populated sections with tabular data.
    """
    report = _get_report(db, current_user.org_id, report_id)
    snap = report.snapshot_data or {}

    def _pct_bar(pct: float) -> str:
        filled = int(pct / 5)
        return "█" * filled + "░" * (20 - filled)

    def _row(*cells) -> str:
        return "<tr>" + "".join(f"<td>{c}</td>" for c in cells) + "</tr>"

    def _section(title: str, content: str) -> str:
        return f"""
        <div class="section">
            <h2>{title}</h2>
            {content}
        </div>"""

    cases = snap.get("cases", {})
    smr = snap.get("smr", {})
    customers = snap.get("customers", {})
    alerts = snap.get("alerts", {})
    training = snap.get("training", {})
    policies = snap.get("policies", {})
    controls = snap.get("controls", {})
    reviews = snap.get("independent_reviews", {})
    reg = snap.get("regulatory_reporting", {})

    attention_items = snap.get("board_attention_items", [])
    risk_indicators = snap.get("risk_indicators", [])

    attention_html = ""
    if attention_items:
        items_html = "".join(f"<li>⚠ {item}</li>" for item in attention_items)
        attention_html = f"""
        <div class="attention-box">
            <h3>Items Requiring Board Attention</h3>
            <ul>{items_html}</ul>
        </div>"""

    risk_html = ""
    if risk_indicators:
        rows = "".join(
            _row(
                ri.get("indicator", ""),
                ri.get("value", ""),
                f'<span class="badge badge-{ri.get("status","")}">{ri.get("status","").replace("_"," ").title()}</span>',
            )
            for ri in risk_indicators
        )
        risk_html = f"""
        <table>
            <thead><tr><th>Risk Indicator</th><th>Current Value</th><th>Status</th></tr></thead>
            <tbody>{rows}</tbody>
        </table>"""

    highlights = snap.get("annual_highlights", [])
    highlights_html = ""
    if highlights:
        highlights_html = "<ul>" + "".join(f"<li>{h}</li>" for h in highlights) + "</ul>"

    # NOTE: nested triple-quoted f-strings using the same quote character require
    # Python 3.12+; this runtime targets 3.11, so each section's content is built as a
    # separate variable below instead of being inlined inside the outer f-string. This
    # is a syntax-only fix (no content/logic change) needed to make the module importable.
    key_metrics_html = f"""
<div class="kpi-grid">
  <div class="kpi {'alert' if cases.get('open_total', 0) > 0 else 'ok'}">
    <div class="kpi-value">{cases.get('open_total', 0)}</div>
    <div class="kpi-label">Open Cases</div>
  </div>
  <div class="kpi {'alert' if cases.get('smr_candidates_open', 0) > 0 else 'ok'}">
    <div class="kpi-value">{cases.get('smr_candidates_open', 0)}</div>
    <div class="kpi-label">SMR Candidates Open</div>
  </div>
  <div class="kpi">
    <div class="kpi-value">{smr.get('total_lodged_period', 0)}</div>
    <div class="kpi-label">SMRs Lodged This Period</div>
  </div>
  <div class="kpi {'alert' if customers.get('high_risk_total', 0) > 0 else 'ok'}">
    <div class="kpi-value">{customers.get('high_risk_total', 0)}</div>
    <div class="kpi-label">High/Critical Risk Customers</div>
  </div>
  <div class="kpi {'ok' if training.get('completion_rate_pct', 0) >= 90 else 'alert'}">
    <div class="kpi-value">{training.get('completion_rate_pct', 0)}%</div>
    <div class="kpi-label">Training Completion Rate</div>
  </div>
  <div class="kpi {'alert' if controls.get('ineffective_key_controls', 0) > 0 else 'ok'}">
    <div class="kpi-value">{controls.get('ineffective_key_controls', 0)}</div>
    <div class="kpi-label">Ineffective Key Controls</div>
  </div>
</div>"""

    case_management_html = f"""
<table>
  <thead><tr><th>Metric</th><th>Value</th></tr></thead>
  <tbody>
    {_row("Open Cases (Total)", cases.get('open_total', 0))}
    {_row("Opened This Period", cases.get('opened_this_period', 0))}
    {_row("Closed This Period", cases.get('closed_this_period', 0))}
    {_row("Critical Severity", cases.get('open_by_severity', {}).get('critical', 0))}
    {_row("High Severity", cases.get('open_by_severity', {}).get('high', 0))}
    {_row("Medium Severity", cases.get('open_by_severity', {}).get('medium', 0))}
    {_row("SMR Candidates Open", cases.get('smr_candidates_open', 0))}
    {_row("Overdue Cases", cases.get('overdue_cases', 0))}
    {_row("Tipping-Off Risk Flag", cases.get('tipping_off_risk', 0))}
  </tbody>
</table>"""

    smr_html = f"""
<table>
  <thead><tr><th>Metric</th><th>Value</th></tr></thead>
  <tbody>
    {_row("SMRs Lodged This Period", smr.get('total_lodged_period', 0))}
    {_row("Total SMRs Lodged (All Time)", smr.get('total_lodged_all_time', 0))}
    {_row("Terrorism-Related This Period", smr.get('is_terrorism_related_period', 0))}
    {_row("Pending MLRO Sign-Off", smr.get('pending_mlro_sign_off', 0))}
    {_row("Draft SMRs", smr.get('draft_smrs', 0))}
  </tbody>
</table>
<p style="font-size:9pt;color:#888;margin-top:6px;">{smr.get('disclaimer','')}</p>"""

    customer_risk_html = f"""
<table>
  <thead><tr><th>Metric</th><th>Value</th></tr></thead>
  <tbody>
    {_row("Total Active Customers", customers.get('total_active', 0))}
    {_row("New Customers This Period", customers.get('new_this_period', 0))}
    {_row("Critical Risk", customers.get('by_risk_level', {}).get('critical', 0))}
    {_row("High Risk", customers.get('by_risk_level', {}).get('high', 0))}
    {_row("Medium Risk", customers.get('by_risk_level', {}).get('medium', 0))}
    {_row("Low Risk", customers.get('by_risk_level', {}).get('low', 0))}
    {_row("High Risk % of Portfolio", f"{customers.get('high_risk_percentage', 0)}%")}
    {_row("PEP Customers (Active)", customers.get('pep_customers', 0))}
    {_row("Active Sanctions Matches", customers.get('sanctions_matches_active', 0))}
    {_row("EDD Customers", customers.get('edd_customers', 0))}
  </tbody>
</table>"""

    transaction_monitoring_html = f"""
<table>
  <thead><tr><th>Metric</th><th>Value</th></tr></thead>
  <tbody>
    {_row("Alerts Raised This Period", alerts.get('alerts_raised_period', 0))}
    {_row("Open Alerts", alerts.get('open_alerts', 0))}
    {_row("Escalated to Case", alerts.get('escalated_to_case_period', 0))}
    {_row("Escalation Rate", f"{alerts.get('escalation_rate_pct', 0)}%")}
    {_row("False Positive Rate", f"{alerts.get('false_positive_rate_pct', 0)}%")}
    {_row("Critical Alerts", alerts.get('by_severity', {}).get('critical', 0))}
    {_row("High Alerts", alerts.get('by_severity', {}).get('high', 0))}
  </tbody>
</table>"""

    training_html = f"""
<table>
  <thead><tr><th>Metric</th><th>Value</th></tr></thead>
  <tbody>
    {_row("Total Assignments", training.get('total_assigned', 0))}
    {_row("Completed", training.get('total_completed', 0))}
    {_row("Completion Rate", f"{training.get('completion_rate_pct', 0)}%")}
    {_row("Completions This Period", training.get('completions_this_period', 0))}
    {_row("Overdue Assignments", training.get('overdue_assignments', 0))}
  </tbody>
</table>"""

    policy_html = f"""
<table>
  <thead><tr><th>Metric</th><th>Value</th></tr></thead>
  <tbody>
    {_row("Total Policies", policies.get('total_policies', 0))}
    {_row("Active / Approved", policies.get('active_approved', 0))}
    {_row("Under Review", policies.get('under_review', 0))}
    {_row("Overdue for Review", policies.get('overdue_review', 0))}
    {_row("Due Within 30 Days", policies.get('due_for_review_next_30_days', 0))}
    {_row("Updated This Period", policies.get('updated_this_period', 0))}
  </tbody>
</table>"""

    controls_html = f"""
<table>
  <thead><tr><th>Metric</th><th>Value</th></tr></thead>
  <tbody>
    {_row("Total Controls", controls.get('total_controls', 0))}
    {_row("Key Controls", controls.get('key_controls', 0))}
    {_row("Tests Conducted This Period", controls.get('tests_conducted_period', 0))}
    {_row("Effective", controls.get('effectiveness_breakdown', {}).get('effective', 0))}
    {_row("Largely Effective", controls.get('effectiveness_breakdown', {}).get('largely_effective', 0))}
    {_row("Partially Effective", controls.get('effectiveness_breakdown', {}).get('partially_effective', 0))}
    {_row("Ineffective", controls.get('effectiveness_breakdown', {}).get('ineffective', 0))}
    {_row("Average Effectiveness Score", f"{controls.get('average_effectiveness_score', '—')}/100")}
    {_row("Ineffective Key Controls", controls.get('ineffective_key_controls', 0))}
  </tbody>
</table>"""

    independent_review_html = f"""
<table>
  <thead><tr><th>Metric</th><th>Value</th></tr></thead>
  <tbody>
    {_row("Active Reviews", reviews.get('active_reviews', 0))}
    {_row("Open Findings (Critical)", reviews.get('open_findings_by_risk', {}).get('critical', 0))}
    {_row("Open Findings (High)", reviews.get('open_findings_by_risk', {}).get('high', 0))}
    {_row("Open Findings (Medium)", reviews.get('open_findings_by_risk', {}).get('medium', 0))}
    {_row("Open Findings (Low)", reviews.get('open_findings_by_risk', {}).get('low', 0))}
    {_row("Overdue Remediation Actions", reviews.get('overdue_remediation_actions', 0))}
    {_row("Pending Compliance Verification", reviews.get('pending_compliance_verification', 0))}
  </tbody>
</table>"""

    regulatory_reporting_html = f"""
<table>
  <thead><tr><th>Report Type</th><th>Raised This Period</th><th>Total Submitted</th></tr></thead>
  <tbody>
    {_row("IFTIs", reg.get('iftis_raised_period', 0), reg.get('iftis_submitted_total', 0))}
    {_row("TTRs", reg.get('ttrs_raised_period', 0), reg.get('ttrs_submitted_total', 0))}
    {_row("IFTI-E", reg.get('ifti_e_raised_period', 0), "—")}
  </tbody>
</table>"""

    html = f"""<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>{report.title}</title>
<style>
  * {{ box-sizing: border-box; margin: 0; padding: 0; }}
  body {{ font-family: 'Segoe UI', Arial, sans-serif; font-size: 11pt; color: #1a1a2e; background: #fff; line-height: 1.5; }}
  .cover {{ background: linear-gradient(135deg, #0f3460 0%, #16213e 100%); color: #fff; padding: 60px 48px; min-height: 160px; }}
  .cover h1 {{ font-size: 24pt; font-weight: 700; margin-bottom: 8px; }}
  .cover .meta {{ font-size: 10pt; opacity: 0.75; margin-top: 16px; }}
  .cover .period {{ font-size: 12pt; opacity: 0.9; margin-top: 6px; }}
  .confidential {{ display: inline-block; background: #e63946; color: #fff; padding: 2px 10px; border-radius: 3px; font-size: 9pt; font-weight: 700; letter-spacing: 1px; margin-top: 12px; }}
  .content {{ padding: 32px 48px; }}
  .section {{ margin-bottom: 32px; border-left: 4px solid #0f3460; padding-left: 16px; }}
  h2 {{ font-size: 14pt; color: #0f3460; margin-bottom: 12px; font-weight: 700; }}
  h3 {{ font-size: 11pt; color: #16213e; margin-bottom: 8px; font-weight: 600; }}
  table {{ width: 100%; border-collapse: collapse; margin: 12px 0; font-size: 10pt; }}
  th {{ background: #0f3460; color: #fff; padding: 7px 10px; text-align: left; font-weight: 600; }}
  td {{ padding: 6px 10px; border-bottom: 1px solid #e8e8e8; }}
  tr:nth-child(even) td {{ background: #f7f9fc; }}
  .kpi-grid {{ display: grid; grid-template-columns: repeat(3, 1fr); gap: 12px; margin: 12px 0; }}
  .kpi {{ background: #f0f4ff; border: 1px solid #c7d2fe; border-radius: 8px; padding: 14px; text-align: center; }}
  .kpi-value {{ font-size: 22pt; font-weight: 700; color: #0f3460; }}
  .kpi-label {{ font-size: 9pt; color: #555; margin-top: 4px; }}
  .kpi.alert {{ background: #fff0f0; border-color: #fca5a5; }}
  .kpi.alert .kpi-value {{ color: #dc2626; }}
  .kpi.ok {{ background: #f0fdf4; border-color: #86efac; }}
  .kpi.ok .kpi-value {{ color: #16a34a; }}
  .attention-box {{ background: #fffbeb; border: 2px solid #f59e0b; border-radius: 8px; padding: 16px; margin: 12px 0; }}
  .attention-box h3 {{ color: #b45309; }}
  .attention-box ul {{ margin-left: 20px; margin-top: 8px; }}
  .attention-box li {{ margin-bottom: 4px; font-size: 10pt; }}
  .narrative {{ background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 6px; padding: 14px; margin: 10px 0; font-style: italic; color: #334155; }}
  .badge {{ padding: 2px 8px; border-radius: 3px; font-size: 9pt; font-weight: 600; }}
  .badge-breach {{ background: #fee2e2; color: #991b1b; }}
  .badge-above_threshold {{ background: #fef3c7; color: #92400e; }}
  .badge-below_threshold {{ background: #fef3c7; color: #92400e; }}
  .disclaimer {{ font-size: 8pt; color: #888; border-top: 1px solid #e0e0e0; padding-top: 12px; margin-top: 40px; font-style: italic; }}
  @media print {{ body {{ font-size: 10pt; }} .content {{ padding: 16px 24px; }} }}
</style>
</head>
<body>
<div class="cover">
  <div class="confidential">CONFIDENTIAL</div>
  <h1>{report.title}</h1>
  <div class="period">Reporting Period: {report.period_start} to {report.period_end}</div>
  <div class="meta">
    Generated: {report.generated_at.strftime("%d %B %Y %H:%M UTC") if report.generated_at else "—"} &nbsp;|&nbsp;
    Status: {report.status.value.replace("_"," ").title()} &nbsp;|&nbsp;
    Version {report.version} &nbsp;|&nbsp;
    Ref: {report.report_ref}
  </div>
</div>

<div class="content">

{attention_html}

{_section("Executive Summary", f'<div class="narrative">{report.executive_summary or "<em>No executive summary provided.</em>"}</div>')}

{_section("MLRO Commentary", f'<div class="narrative">{report.mlro_commentary or "<em>No MLRO commentary provided.</em>"}</div>')}

{highlights_html and _section("Annual Highlights", highlights_html) or ""}

{_section("Key Metrics", key_metrics_html)}

{_section("Case Management", case_management_html)}

{_section("Suspicious Matter Reports (SMR)", smr_html)}

{_section("Customer Risk Profile", customer_risk_html)}

{_section("Transaction Monitoring & Alerts", transaction_monitoring_html)}

{_section("AML/CTF Training", training_html)}

{_section("Policy Management", policy_html)}

{_section("Control Effectiveness", controls_html)}

{_section("Independent Review", independent_review_html)}

{_section("Regulatory Reporting", regulatory_reporting_html)}

{risk_html and _section("Risk Indicators", risk_html) or ""}

<div class="disclaimer">
  {snap.get('disclaimer', 'This report is generated from compliance workflow data. All compliance decisions remain with the reporting entity.')}
  &nbsp;|&nbsp; Approved by: {report.approved_by or "—"} &nbsp;|&nbsp;
  Distributed to: {", ".join(report.distributed_to) if report.distributed_to else "—"}
</div>

</div>
</body>
</html>"""
    return HTMLResponse(content=html, media_type="text/html")


@router.get("/{report_id}/export-csv")
def export_csv(
    report_id: str,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
):
    """Export key metrics from the report snapshot as a CSV file."""
    report = _get_report(db, current_user.org_id, report_id)
    snap = report.snapshot_data or {}

    rows = [
        ["Section", "Metric", "Value"],
        ["Report", "Ref", report.report_ref],
        ["Report", "Type", report.report_type],
        ["Report", "Period", f"{report.period_start} to {report.period_end}"],
        ["Report", "Status", report.status],
        ["Report", "Generated At", str(report.generated_at or "")],
    ]

    section_map = {
        "Cases": snap.get("cases", {}),
        "SMR": snap.get("smr", {}),
        "Customers": snap.get("customers", {}),
        "Alerts": snap.get("alerts", {}),
        "Training": snap.get("training", {}),
        "Policies": snap.get("policies", {}),
        "Controls": snap.get("controls", {}),
        "Independent Reviews": snap.get("independent_reviews", {}),
        "Regulatory Reporting": snap.get("regulatory_reporting", {}),
    }

    for section_name, data in section_map.items():
        for key, value in data.items():
            if isinstance(value, dict):
                for sub_key, sub_val in value.items():
                    if not isinstance(sub_val, (dict, list)):
                        rows.append([section_name, f"{key} — {sub_key}", str(sub_val)])
            elif not isinstance(value, list):
                rows.append([section_name, key, str(value)])

    output = io.StringIO()
    writer = csv.writer(output, lineterminator="\r\n")
    writer.writerows(rows)

    filename = f"{report.report_ref}-metrics.csv"
    return StreamingResponse(
        iter([output.getvalue()]),
        media_type="text/csv",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )
