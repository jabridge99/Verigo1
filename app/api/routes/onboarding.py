"""
Customer Onboarding Autopilot — API routes.
"""

from typing import Optional

from fastapi import APIRouter, Depends, File, Form, HTTPException, UploadFile
from sqlalchemy.orm import Session

from app.db.database import get_db
from app.models.onboarding import (
    ImportBatch,
    OnboardingAuditLog,
    OnboardingSession,
    SessionStatus,
)
from app.schemas.onboarding import (
    AuditLogEntry,
    BatchSummary,
    PipelineStats,
    PortalTokenResponse,
    SessionCreate,
    SessionDetail,
    SessionSummary,
    StepSubmit,
)
from app.services.bulk_import import generate_csv_template, parse_csv, parse_excel
from app.services.onboarding_service import (
    ONBOARDING_STEPS,
    advance_step,
    bulk_create_sessions,
    create_session,
    get_sessions_needing_reminder,
    open_invite,
    send_reminder,
    submit_onboarding,
)

router = APIRouter(prefix="/onboarding", tags=["Onboarding"])


@router.post("/sessions", response_model=SessionDetail, status_code=201)
def create_onboarding_session(payload: SessionCreate, db: Session = Depends(get_db)):
    session = create_session(
        db,
        industry_id=payload.industry_id,
        applicant_name=payload.applicant_name,
        applicant_email=str(payload.applicant_email),
        applicant_phone=payload.applicant_phone,
        applicant_company=payload.applicant_company,
        customer_type=payload.customer_type.value,
        source="manual",
        created_by=payload.created_by,
    )
    db.commit()
    db.refresh(session)
    return session


@router.get("/sessions", response_model=list[SessionSummary])
def list_sessions(
    industry_id: Optional[str] = None,
    status: Optional[str] = None,
    search: Optional[str] = None,
    batch_id: Optional[str] = None,
    skip: int = 0,
    limit: int = 100,
    db: Session = Depends(get_db),
):
    q = db.query(OnboardingSession)
    if industry_id:
        q = q.filter_by(industry_id=industry_id)
    if status:
        q = q.filter(OnboardingSession.status == status)
    if batch_id:
        q = q.filter_by(batch_id=batch_id)
    if search:
        like = f"%{search}%"
        q = q.filter(
            OnboardingSession.applicant_name.ilike(like)
            | OnboardingSession.applicant_email.ilike(like)
        )
    return (
        q.order_by(OnboardingSession.created_at.desc()).offset(skip).limit(limit).all()
    )


@router.get("/sessions/{session_id}", response_model=SessionDetail)
def get_session(session_id: str, db: Session = Depends(get_db)):
    s = db.query(OnboardingSession).filter_by(session_id=session_id).first()
    if not s:
        raise HTTPException(404, "Session not found")
    return s


@router.get("/sessions/{session_id}/audit", response_model=list[AuditLogEntry])
def get_audit_log(session_id: str, db: Session = Depends(get_db)):
    s = db.query(OnboardingSession).filter_by(session_id=session_id).first()
    if not s:
        raise HTTPException(404, "Session not found")
    return (
        db.query(OnboardingAuditLog)
        .filter_by(session_id=s.id)
        .order_by(OnboardingAuditLog.created_at)
        .all()
    )


@router.post("/sessions/{session_id}/remind")
def trigger_reminder(session_id: str, db: Session = Depends(get_db)):
    s = db.query(OnboardingSession).filter_by(session_id=session_id).first()
    if not s:
        raise HTTPException(404, "Session not found")
    send_reminder(db, s)
    return {"sent": True, "reminders_sent": s.reminders_sent}


@router.delete("/sessions/{session_id}", status_code=204)
def delete_session(session_id: str, db: Session = Depends(get_db)):
    s = db.query(OnboardingSession).filter_by(session_id=session_id).first()
    if not s:
        raise HTTPException(404, "Session not found")
    db.delete(s)
    db.commit()


@router.post("/import/csv", response_model=BatchSummary, status_code=201)
async def import_csv(
    industry_id: str = Form(...),
    created_by: Optional[str] = Form(None),
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
):
    content = await file.read()
    rows, warnings = parse_csv(content)
    batch = bulk_create_sessions(
        db,
        rows,
        industry_id=industry_id,
        source="csv",
        file_name=file.filename,
        created_by=created_by,
    )
    db.commit()
    return batch


@router.post("/import/excel", response_model=BatchSummary, status_code=201)
async def import_excel(
    industry_id: str = Form(...),
    created_by: Optional[str] = Form(None),
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
):
    content = await file.read()
    try:
        rows, warnings = parse_excel(content)
    except ImportError as e:
        raise HTTPException(422, str(e))
    batch = bulk_create_sessions(
        db,
        rows,
        industry_id=industry_id,
        source="excel",
        file_name=file.filename,
        created_by=created_by,
    )
    db.commit()
    return batch


@router.get("/import/template")
def csv_template():
    from fastapi.responses import PlainTextResponse

    return PlainTextResponse(
        generate_csv_template(),
        media_type="text/csv",
        headers={"Content-Disposition": "attachment; filename=onboarding_template.csv"},
    )


@router.get("/batches", response_model=list[BatchSummary])
def list_batches(
    industry_id: Optional[str] = None,
    skip: int = 0,
    limit: int = 50,
    db: Session = Depends(get_db),
):
    q = db.query(ImportBatch)
    if industry_id:
        q = q.filter_by(industry_id=industry_id)
    return q.order_by(ImportBatch.created_at.desc()).offset(skip).limit(limit).all()


@router.get("/batches/{batch_id}", response_model=BatchSummary)
def get_batch(batch_id: str, db: Session = Depends(get_db)):
    b = db.query(ImportBatch).filter_by(batch_id=batch_id).first()
    if not b:
        raise HTTPException(404, "Batch not found")
    return b


@router.get("/stats", response_model=PipelineStats)
def pipeline_stats(industry_id: Optional[str] = None, db: Session = Depends(get_db)):
    q = db.query(OnboardingSession)
    if industry_id:
        q = q.filter_by(industry_id=industry_id)
    sessions = q.all()
    total = len(sessions)
    counts = {s: 0 for s in SessionStatus}
    pct_sum = 0.0
    sanctions = 0
    for s in sessions:
        counts[s.status] = counts.get(s.status, 0) + 1
        pct_sum += s.completion_pct or 0.0
        if s.sanctions_match:
            sanctions += 1
    return PipelineStats(
        total=total,
        invited=counts.get(SessionStatus.invited, 0),
        opened=counts.get(SessionStatus.opened, 0),
        in_progress=counts.get(SessionStatus.in_progress, 0),
        completed=counts.get(SessionStatus.completed, 0),
        rejected=counts.get(SessionStatus.rejected, 0),
        expired=counts.get(SessionStatus.expired, 0),
        avg_completion_pct=round(pct_sum / total, 1) if total else 0.0,
        sanctions_matches=sanctions,
    )


@router.post("/reminders/run")
def run_reminders(db: Session = Depends(get_db)):
    due = get_sessions_needing_reminder(db)
    sent = 0
    for s in due:
        send_reminder(db, s)
        sent += 1
    return {"due": len(due), "sent": sent}


@router.get("/portal/{token}", response_model=PortalTokenResponse)
def portal_open(token: str, db: Session = Depends(get_db)):
    from datetime import datetime, timezone

    session = open_invite(db, token)
    if not session:
        raise HTTPException(404, "Invalid or expired invite link")
    now = datetime.now(timezone.utc)
    expires = session.invite_expires_at
    if expires and expires.replace(tzinfo=timezone.utc) < now:
        raise HTTPException(410, "This invite link has expired")
    db.commit()
    return PortalTokenResponse(
        session_id=session.session_id,
        industry_id=session.industry_id,
        applicant_name=session.applicant_name,
        applicant_email=session.applicant_email,
        applicant_company=session.applicant_company,
        customer_type=session.customer_type.value,
        status=session.status.value,
        current_step=session.current_step,
        total_steps=session.total_steps,
        completion_pct=session.completion_pct,
        collected_data=session.collected_data,
        invite_expires_at=session.invite_expires_at,
        steps=ONBOARDING_STEPS,
    )


@router.post("/portal/{token}/step")
def portal_submit_step(token: str, payload: StepSubmit, db: Session = Depends(get_db)):
    session = db.query(OnboardingSession).filter_by(invite_token=token).first()
    if not session:
        raise HTTPException(404, "Invalid invite link")
    advance_step(db, session, payload.step, payload.data)
    db.commit()
    return {
        "step": session.current_step,
        "completion_pct": session.completion_pct,
        "status": session.status.value,
    }


@router.post("/portal/{token}/submit")
def portal_final_submit(token: str, db: Session = Depends(get_db)):
    session = db.query(OnboardingSession).filter_by(invite_token=token).first()
    if not session:
        raise HTTPException(404, "Invalid invite link")
    result = submit_onboarding(db, session)
    return result
