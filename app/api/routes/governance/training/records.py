"""
Governance Training — individual training-record lifecycle: list/create,
start/complete, exempt/revoke-exemption, retake, renew, and the
print-ready completion certificate export.
Part of the governance/training route package; see __init__.py for the
combined router.
"""

from __future__ import annotations

import html
from datetime import date, datetime, timedelta, timezone
from typing import Optional
from uuid import uuid4

from dateutil.relativedelta import relativedelta
from fastapi import APIRouter, Depends, HTTPException, Query
from fastapi.responses import HTMLResponse
from sqlalchemy.orm import Session

from app.api.deps import (
    Pagination,
    get_current_user,
    org_id_for,
    require_analyst_or_above,
    require_compliance_or_above,
)
from app.api.routes.governance.training._shared import (
    _get_course,
    _get_record,
    _get_solution,
    _record_dict,
    _sync_status,
)
from app.db.database import get_db
from app.models.governance_training import (
    AssignmentTrigger,
    GovernanceTrainingRecord,
    TrainingCourse,
    TrainingStatus,
    TrainingType,
)
from app.models.user import User
from app.schemas.governance_training import CompleteRequest, ExemptRequest, RecordCreate

router = APIRouter()


# ── Training Records ──────────────────────────────────────────────────────────


@router.get("/records")
def list_records(
    user_id: Optional[str] = Query(None),
    status: Optional[TrainingStatus] = Query(None),
    course_id: Optional[str] = Query(None),
    training_type: Optional[TrainingType] = Query(None),
    overdue_only: bool = Query(False),
    expiring_within_days: Optional[int] = Query(None, ge=1, le=365),
    db: Session = Depends(get_db),
    current_user: User = Depends(require_analyst_or_above),
    page: Pagination = Depends(),
):
    """List training records with filters. Analysts can view their own; compliance+ sees all."""
    org_id = org_id_for(current_user)

    q = db.query(GovernanceTrainingRecord).filter(
        GovernanceTrainingRecord.org_id == org_id
    )

    # Analysts can only see their own records
    if current_user.role.value == "analyst":
        q = q.filter(GovernanceTrainingRecord.user_id == current_user.id)
    elif user_id:
        q = q.filter(GovernanceTrainingRecord.user_id == user_id)

    if status:
        q = q.filter(GovernanceTrainingRecord.status == status)
    if course_id:
        q = q.filter(GovernanceTrainingRecord.course_id == course_id)
    if training_type:
        # Join to course to filter by type
        q = q.join(TrainingCourse).filter(TrainingCourse.training_type == training_type)
    if overdue_only:
        today = date.today()
        q = q.filter(
            GovernanceTrainingRecord.completion_date.is_(None),
            GovernanceTrainingRecord.due_date < today,
            GovernanceTrainingRecord.is_exempt == False,
        )
    if expiring_within_days:
        target = date.today() + timedelta(days=expiring_within_days)
        q = q.filter(
            GovernanceTrainingRecord.expiry_date.isnot(None),
            GovernanceTrainingRecord.expiry_date <= target,
            GovernanceTrainingRecord.expiry_date >= date.today(),
        )

    records = (
        q.order_by(GovernanceTrainingRecord.due_date)
        .offset(page.offset)
        .limit(page.page_size)
        .all()
    )

    # Sync computed status before returning
    for r in records:
        _sync_status(r, db)
    db.commit()

    return {
        "records": [_record_dict(r) for r in records],
        "count": len(records),
    }


@router.post("/records", status_code=201)
def create_record(
    payload: RecordCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_compliance_or_above),
):
    """Manually create an individual training record (e.g. for external training)."""
    org_id = org_id_for(current_user)
    solution = _get_solution(org_id, db)
    course = _get_course(payload.course_id, org_id, db)

    record = GovernanceTrainingRecord(
        id=f"gtr_{uuid4().hex[:12]}",
        org_id=org_id,
        solution_id=solution.id,
        course_id=course.id,
        user_id=payload.user_id,
        assigned_by=current_user.id,
        assigned_date=payload.assigned_date,
        due_date=payload.due_date,
        trigger=payload.trigger,
        status=TrainingStatus.assigned,
    )
    db.add(record)
    db.commit()
    db.refresh(record)
    return _record_dict(record)


@router.get("/records/{record_id}")
def get_record(
    record_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_analyst_or_above),
):
    """Get a specific training record."""
    org_id = org_id_for(current_user)
    record = _get_record(record_id, org_id, db)
    # Analysts can only see their own
    if current_user.role.value == "analyst" and record.user_id != current_user.id:
        raise HTTPException(403, "You can only view your own training records.")
    _sync_status(record, db)
    db.commit()
    return _record_dict(record)


@router.post("/records/{record_id}/start")
def start_training(
    record_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_analyst_or_above),
):
    """Mark a training record as in-progress (the learner has started)."""
    org_id = org_id_for(current_user)
    record = _get_record(record_id, org_id, db)

    if record.is_exempt:
        raise HTTPException(409, "This training record is exempt.")
    if record.completion_date:
        raise HTTPException(409, "Training already completed.")

    record.started_at = datetime.now(timezone.utc)
    record.status = TrainingStatus.in_progress
    db.commit()
    db.refresh(record)
    return _record_dict(record)


@router.post("/records/{record_id}/complete")
def complete_training(
    record_id: str,
    payload: CompleteRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_compliance_or_above),
):
    """
    Mark a training record as completed.

    Calculates pass/fail from score vs pass_mark.
    Calculates expiry_date from completion_date + course.expiry_months.

    DISCLAIMER: Completion recording is a workflow action only.
    """
    org_id = org_id_for(current_user)
    record = _get_record(record_id, org_id, db)

    if record.is_exempt:
        raise HTTPException(409, "Training record is exempt.")
    if record.completion_date and record.status == TrainingStatus.completed:
        raise HTTPException(409, "Training already marked as completed.")

    course = (
        db.query(TrainingCourse).filter(TrainingCourse.id == record.course_id).first()
    )

    record.completion_date = payload.completion_date
    record.score = payload.score
    record.notes = payload.notes or record.notes
    record.certificate_number = payload.certificate_number
    record.certificate_document_id = payload.certificate_document_id

    if course:
        record.pass_mark_applied = course.pass_mark
        if payload.score is not None and course.pass_mark is not None:
            record.passed = payload.score >= course.pass_mark
        else:
            record.passed = True  # no assessment course

        if course.expiry_months:
            record.expiry_date = payload.completion_date + relativedelta(
                months=course.expiry_months
            )

    _sync_status(record, db)
    db.commit()
    db.refresh(record)
    return _record_dict(record)


@router.post("/records/{record_id}/exempt")
def grant_exemption(
    record_id: str,
    payload: ExemptRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_compliance_or_above),
):
    """
    Grant an exemption for a training record.

    Exemptions must have a documented reason (stored for audit).
    Typically used for: recently joined staff with equivalent prior training,
    temporary contractors, or staff on long-term leave.
    """
    org_id = org_id_for(current_user)
    record = _get_record(record_id, org_id, db)

    if record.completion_date:
        raise HTTPException(409, "Cannot exempt a completed training record.")

    record.is_exempt = True
    record.exemption_reason = payload.reason
    record.exemption_approved_by = payload.approved_by or current_user.id
    record.status = TrainingStatus.exempt
    db.commit()
    db.refresh(record)
    return _record_dict(record)


@router.post("/records/{record_id}/revoke-exemption")
def revoke_exemption(
    record_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_compliance_or_above),
):
    """Revoke a previously granted exemption."""
    org_id = org_id_for(current_user)
    record = _get_record(record_id, org_id, db)

    if not record.is_exempt:
        raise HTTPException(409, "Record is not exempt.")

    record.is_exempt = False
    record.exemption_reason = None
    record.exemption_approved_by = None
    _sync_status(record, db)
    db.commit()
    db.refresh(record)
    return _record_dict(record)


@router.post("/records/{record_id}/retake")
def retake_training(
    record_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_analyst_or_above),
):
    """
    Retake a failed training record (resets attempt for the same record).

    Allowed when a non-exempt record exists with a recorded fail
    (completion_date set, passed == False) and attempt_number < course.max_attempts.
    """
    org_id = org_id_for(current_user)
    record = _get_record(record_id, org_id, db)

    if current_user.role.value == "analyst" and record.user_id != current_user.id:
        raise HTTPException(403, "You can only retake your own training records.")
    if record.is_exempt:
        raise HTTPException(409, "This training record is exempt.")
    if record.passed is not False:
        raise HTTPException(409, "Only a failed attempt can be retaken.")

    course = (
        db.query(TrainingCourse).filter(TrainingCourse.id == record.course_id).first()
    )
    if course and record.attempt_number >= course.max_attempts:
        raise HTTPException(
            409, f"Maximum attempts ({course.max_attempts}) reached for this course."
        )

    record.attempt_number += 1
    record.completion_date = None
    record.score = None
    record.passed = None
    record.expiry_date = None
    record.certificate_number = None
    record.certificate_document_id = None
    record.started_at = None
    _sync_status(record, db)
    db.commit()
    db.refresh(record)
    return _record_dict(record)


@router.post("/records/{record_id}/renew", status_code=201)
def renew_training(
    record_id: str,
    due_date: date = Query(..., description="Due date for the renewed training cycle."),
    db: Session = Depends(get_db),
    current_user: User = Depends(require_compliance_or_above),
):
    """
    Renew an expired (or expiring) training record by creating a new record
    for the next cycle, linked back to the same course and user.
    """
    org_id = org_id_for(current_user)
    old_record = _get_record(record_id, org_id, db)

    if old_record.status not in (TrainingStatus.expired, TrainingStatus.completed):
        raise HTTPException(
            409, "Only an expired or completed training record can be renewed."
        )

    new_record = GovernanceTrainingRecord(
        id=f"gtr_{uuid4().hex[:12]}",
        org_id=org_id,
        solution_id=old_record.solution_id,
        course_id=old_record.course_id,
        user_id=old_record.user_id,
        assigned_by=current_user.id,
        assigned_date=date.today(),
        due_date=due_date,
        trigger=AssignmentTrigger.annual_cycle,
        status=TrainingStatus.assigned,
    )
    db.add(new_record)
    db.commit()
    db.refresh(new_record)
    return _record_dict(new_record)


@router.get(
    "/records/{record_id}/certificate-html",
    response_class=HTMLResponse,
    summary="Export training completion certificate as print-ready HTML (browser print-to-PDF)",
)
def export_certificate_html(
    record_id: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    org_id = org_id_for(current_user)
    record = _get_record(record_id, org_id, db)
    if current_user.role.value == "analyst" and record.user_id != current_user.id:
        raise HTTPException(403, "You can only export your own certificate.")
    if not record.completion_date or record.status != TrainingStatus.completed:
        raise HTTPException(
            409, "Certificate is only available for completed training."
        )

    course = (
        db.query(TrainingCourse).filter(TrainingCourse.id == record.course_id).first()
    )

    def esc(v) -> str:
        return html.escape(str(v)) if v not in (None, "") else "—"

    return HTMLResponse(
        content=f"""<!DOCTYPE html>
<html><head><meta charset="utf-8"><title>Certificate of Completion</title>
<style>
body {{ font-family: Georgia, serif; max-width: 820px; margin: 60px auto; color: #1a1a1a; text-align: center; }}
.border {{ border: 4px double #333; padding: 50px 40px; }}
h1 {{ font-size: 26px; letter-spacing: 2px; text-transform: uppercase; margin-bottom: 4px; }}
.subtitle {{ font-size: 13px; color: #777; margin-bottom: 30px; }}
.course-name {{ font-size: 20px; font-weight: bold; margin: 24px 0; }}
.meta {{ font-size: 13px; color: #444; margin-top: 30px; }}
.meta div {{ margin: 4px 0; }}
.disclaimer {{ margin-top: 40px; font-size: 11px; color: #777; border-top: 1px solid #ccc; padding-top: 10px; text-align: left; }}
</style></head>
<body>
<div class="border">
<h1>Certificate of Completion</h1>
<div class="subtitle">AML/CTF Training — Governance Record</div>
<div>This certifies that</div>
<div class="course-name">User {esc(record.user_id)}</div>
<div>has completed</div>
<div class="course-name">{esc(course.name if course else record.course_id)}</div>
<div class="meta">
<div><strong>Completion date:</strong> {esc(record.completion_date)}</div>
<div><strong>Score:</strong> {esc(record.score) if record.score is not None else "N/A"}</div>
<div><strong>Result:</strong> {"Passed" if record.passed else "N/A"}</div>
<div><strong>Certificate number:</strong> {esc(record.certificate_number)}</div>
<div><strong>Expiry date:</strong> {esc(record.expiry_date) if record.expiry_date else "No expiry"}</div>
</div>
</div>
<div class="disclaimer">
This document is generated from VeriGo's governance training register and reflects the
completion record as recorded at export time. It does not constitute external regulatory
certification or qualification.
</div>
</body></html>"""
    )
