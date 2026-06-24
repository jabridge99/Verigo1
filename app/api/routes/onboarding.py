"""
Customer Onboarding Autopilot — API routes.

Zero Trust fixes:
- Authentication required on all internal/staff endpoints (sessions, batches,
  stats, reminders). Only the applicant-facing /portal/{token} endpoints
  remain unauthenticated — they are protected by possession of a random,
  expiring invite token instead of a session, the same model as a magic link.
- industry_id/organisation_id are taken from the authenticated user's
  session, never accepted from the request body — previously any caller
  could stamp an onboarding session/import batch into an arbitrary tenant.
- Tenant isolation enforced on list/get/audit/reminder/delete.
- RBAC: creation/import requires analyst+, deletion requires compliance+.
"""

from typing import Optional

from fastapi import APIRouter, Depends, File, Form, HTTPException, UploadFile
from sqlalchemy.orm import Session

from app.api.routes.auth import _current_user, _require_roles
from app.db.database import get_db
from app.models.onboarding import (
    ImportBatch,
    OnboardingAuditLog,
    OnboardingSession,
    SessionStatus,
)
from app.models.user import User, UserRole
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
from app.services.tenant_scope import assert_tenant, scope_fields, scope_query

router = APIRouter(prefix="/onboarding", tags=["Onboarding"])

_READER = _require_roles(
    UserRole.admin,
    UserRole.mlro,
    UserRole.compliance,
    UserRole.analyst,
    UserRole.viewer,
)
_WRITER = _require_roles(
    UserRole.admin, UserRole.mlro, UserRole.compliance, UserRole.analyst
)
_DELETE = _require_roles(UserRole.admin, UserRole.mlro, UserRole.compliance)


@router.post("/sessions", response_model=SessionDetail, status_code=201)
def create_onboarding_session(
    payload: SessionCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(_WRITER),
):
    scoped = scope_fields(current_user)
    session = create_session(
        db,
        industry_id=scoped.get("industry_id") or current_user.industry_id,
        organisation_id=scoped.get("organisation_id"),
        applicant_name=payload.applicant_name,
        applicant_email=str(payload.applicant_email),
        applicant_phone=payload.applicant_phone,
        applicant_company=payload.applicant_company,
        customer_type=payload.customer_type.value,
        source="manual",
        created_by=current_user.user_id,
    )
    db.commit()
    db.refresh(session)
    return session


@router.get("/sessions", response_model=list[SessionSummary])
def list_sessions(
    status: Optional[str] = None,
    search: Optional[str] = None,
    batch_id: Optional[str] = None,
    skip: int = 0,
    limit: int = 100,
    db: Session = Depends(get_db),
    current_user: User = Depends(_READER),
):
    q = scope_query(db.query(OnboardingSession), OnboardingSession, current_user)
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
def get_session(
    session_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(_READER),
):
    s = db.query(OnboardingSession).filter_by(session_id=session_id).first()
    if not s:
        raise HTTPException(404, "Session not found")
    assert_tenant(current_user, s.organisation_id, s.industry_id)
    return s


@router.get("/sessions/{session_id}/audit", response_model=list[AuditLogEntry])
def get_audit_log(
    session_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(_READER),
):
    s = db.query(OnboardingSession).filter_by(session_id=session_id).first()
    if not s:
        raise HTTPException(404, "Session not found")
    assert_tenant(current_user, s.organisation_id, s.industry_id)
    return (
        db.query(OnboardingAuditLog)
        .filter_by(session_id=s.id)
        .order_by(OnboardingAuditLog.created_at)
        .all()
    )


@router.post("/sessions/{session_id}/remind")
def trigger_reminder(
    session_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(_WRITER),
):
    s = db.query(OnboardingSession).filter_by(session_id=session_id).first()
    if not s:
        raise HTTPException(404, "Session not found")
    assert_tenant(current_user, s.organisation_id, s.industry_id)
    send_reminder(db, s)
    return {"sent": True, "reminders_sent": s.reminders_sent}


@router.delete("/sessions/{session_id}", status_code=204)
def delete_session(
    session_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(_DELETE),
):
    s = db.query(OnboardingSession).filter_by(session_id=session_id).first()
    if not s:
        raise HTTPException(404, "Session not found")
    assert_tenant(current_user, s.organisation_id, s.industry_id)
    db.delete(s)
    db.commit()


@router.post("/import/csv", response_model=BatchSummary, status_code=201)
async def import_csv(
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    current_user: User = Depends(_WRITER),
):
    scoped = scope_fields(current_user)
    content = await file.read()
    rows, warnings = parse_csv(content)
    batch = bulk_create_sessions(
        db,
        rows,
        industry_id=scoped.get("industry_id") or current_user.industry_id,
        source="csv",
        file_name=file.filename,
        created_by=current_user.user_id,
        organisation_id=scoped.get("organisation_id"),
    )
    db.commit()
    return batch


@router.post("/import/excel", response_model=BatchSummary, status_code=201)
async def import_excel(
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    current_user: User = Depends(_WRITER),
):
    scoped = scope_fields(current_user)
    content = await file.read()
    try:
        rows, warnings = parse_excel(content)
    except ImportError as e:
        raise HTTPException(422, str(e))
    batch = bulk_create_sessions(
        db,
        rows,
        industry_id=scoped.get("industry_id") or current_user.industry_id,
        source="excel",
        file_name=file.filename,
        created_by=current_user.user_id,
        organisation_id=scoped.get("organisation_id"),
    )
    db.commit()
    return batch


@router.get("/import/template")
def csv_template(current_user: User = Depends(_WRITER)):
    from fastapi.responses import PlainTextResponse

    return PlainTextResponse(
        generate_csv_template(),
        media_type="text/csv",
        headers={"Content-Disposition": "attachment; filename=onboarding_template.csv"},
    )


@router.get("/batches", response_model=list[BatchSummary])
def list_batches(
    skip: int = 0,
    limit: int = 50,
    db: Session = Depends(get_db),
    current_user: User = Depends(_READER),
):
    q = scope_query(db.query(ImportBatch), ImportBatch, current_user)
    return q.order_by(ImportBatch.created_at.desc()).offset(skip).limit(limit).all()


@router.get("/batches/{batch_id}", response_model=BatchSummary)
def get_batch(
    batch_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(_READER),
):
    b = db.query(ImportBatch).filter_by(batch_id=batch_id).first()
    if not b:
        raise HTTPException(404, "Batch not found")
    assert_tenant(current_user, b.organisation_id, b.industry_id)
    return b


@router.get("/stats", response_model=PipelineStats)
def pipeline_stats(
    db: Session = Depends(get_db),
    current_user: User = Depends(_READER),
):
    q = scope_query(db.query(OnboardingSession), OnboardingSession, current_user)
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
def run_reminders(
    db: Session = Depends(get_db),
    current_user: User = Depends(_require_roles(UserRole.admin)),
):
    """System/cron job — global super-admin only. Processes due reminders
    across all tenants. UserRole.admin alone is a per-organisation role and
    must not be sufficient to trigger a job that reads/writes every
    tenant's onboarding sessions."""
    if not current_user.is_super_admin:
        raise HTTPException(403, "Requires global super-admin access")
    due = get_sessions_needing_reminder(db)
    sent = 0
    for s in due:
        send_reminder(db, s)
        sent += 1
    return {"due": len(due), "sent": sent}


# ── Applicant-facing portal (unauthenticated — secured by invite token) ──────


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
