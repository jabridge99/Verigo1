"""
Case Management API — AML/CTF investigation workflow and SMR support.

Roles:
  POST /cases — compliance+
  GET  /cases — analyst+
  GET  /cases/{id} — analyst+
  PATCH /cases/{id} — compliance+
  POST /cases/{id}/assign — compliance+
  POST /cases/{id}/escalate — compliance+ (escalates to MLRO)
  POST /cases/{id}/status — compliance+
  POST /cases/{id}/close — mlro+
  POST /cases/{id}/notes — analyst+
  GET  /cases/{id}/notes — analyst+
  POST /cases/{id}/evidence — compliance+
  GET  /cases/{id}/evidence — analyst+
  POST /cases/{id}/link-alert — compliance+
  POST /cases/{id}/smr/consider — mlro+
  POST /cases/{id}/smr/lodge — mlro+

DISCLAIMER: The platform provides case management tooling only. Decisions to
lodge Suspicious Matter Reports, refer matters to law enforcement, or take
other action remain entirely with the reporting entity.
"""
from datetime import date, datetime, timezone
from typing import Optional
from uuid import uuid4

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session

from app.api.deps import (
    Pagination,
    org_id_for,
    require_analyst_or_above,
    require_compliance_or_above,
    require_mlro_or_above,
)
from app.db.database import get_db
from app.models.case import (
    Case,
    CaseAlert,
    CaseEvidence,
    CaseNote,
    CaseStatus,
    CaseType,
)
from app.models.user import User
from app.schemas.case import (
    CaseAssignRequest,
    CaseCloseRequest,
    CaseCreate,
    CaseEscalateRequest,
    CaseEvidenceCreate,
    CaseEvidenceOut,
    CaseListOut,
    CaseNoteCreate,
    CaseNoteOut,
    CaseOut,
    CaseStatusTransitionRequest,
    CaseUpdate,
    LinkAlertRequest,
    SMRConsiderRequest,
    SMRLodgeRequest,
)

router = APIRouter(prefix="/cases", tags=["Case Management"])

DISCLAIMER = (
    "The platform provides case management tooling only. Decisions to lodge "
    "Suspicious Matter Reports, refer matters to law enforcement, or take other "
    "action remain entirely with the reporting entity."
)

CLOSED_STATUSES = {
    CaseStatus.closed_no_action,
    CaseStatus.closed_smr_filed,
    CaseStatus.closed_referred,
    CaseStatus.closed_exited,
    CaseStatus.closed_no_smr,
}

# Valid status transitions
CASE_TRANSITIONS: dict[CaseStatus, set[CaseStatus]] = {
    CaseStatus.open: {CaseStatus.under_investigation, CaseStatus.additional_information},
    CaseStatus.under_investigation: {
        CaseStatus.additional_information, CaseStatus.escalated, CaseStatus.decision,
        CaseStatus.closed_no_action,
    },
    CaseStatus.additional_information: {CaseStatus.under_investigation, CaseStatus.escalated},
    CaseStatus.escalated: {CaseStatus.decision, CaseStatus.under_investigation},
    CaseStatus.decision: CLOSED_STATUSES,
}


def _get_case_or_404(case_id: str, org_id: str, db: Session) -> Case:
    case = db.query(Case).filter(
        Case.id == case_id,
        Case.org_id == org_id,
    ).first()
    if not case:
        raise HTTPException(status_code=404, detail="Case not found.")
    return case


def _next_case_ref(db: Session, org_id: str) -> str:
    # Use uuid segment for uniqueness — avoids race on COUNT(*) with unique constraint
    return f"CASE-{uuid4().hex[:8].upper()}"


@router.post("", response_model=CaseOut, status_code=status.HTTP_201_CREATED)
def create_case(
    payload: CaseCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_compliance_or_above),
):
    org_id = org_id_for(current_user)

    case_id = f"case_{uuid4().hex[:12]}"
    case = Case(
        id=case_id,
        org_id=org_id,
        case_ref=_next_case_ref(db, org_id),
        created_by=current_user.id,
        customer_id=payload.customer_id,
        case_type=payload.case_type,
        severity=payload.severity,
        title=payload.title,
        description=payload.description,
        due_date=payload.due_date,
        is_smr_candidate=payload.is_smr_candidate,
        linked_customer_ids=payload.linked_customer_ids,
        related_case_ids=payload.related_case_ids,
        status=CaseStatus.open,
    )
    db.add(case)

    # Link alerts provided at creation
    for alert_id in payload.alert_ids:
        link = CaseAlert(
            id=f"ca_{uuid4().hex[:10]}",
            case_id=case_id,
            alert_id=alert_id,
            org_id=org_id,
            added_by=current_user.id,
        )
        db.add(link)

    db.commit()
    db.refresh(case)
    return case


@router.get("", response_model=list[CaseListOut])
def list_cases(
    case_status: Optional[CaseStatus] = Query(None),
    case_type: Optional[CaseType] = Query(None),
    customer_id: Optional[str] = Query(None),
    is_smr_candidate: Optional[bool] = Query(None),
    assigned_to: Optional[str] = Query(None),
    is_overdue: Optional[bool] = Query(None),
    pagination: Pagination = Depends(),
    db: Session = Depends(get_db),
    current_user: User = Depends(require_analyst_or_above),
):
    org_id = org_id_for(current_user)
    q = db.query(Case).filter(Case.org_id == org_id)

    if case_status:
        q = q.filter(Case.status == case_status)
    if case_type:
        q = q.filter(Case.case_type == case_type)
    if customer_id:
        q = q.filter(Case.customer_id == customer_id)
    if is_smr_candidate is not None:
        q = q.filter(Case.is_smr_candidate == is_smr_candidate)
    if assigned_to:
        q = q.filter(Case.assigned_to == assigned_to)
    if is_overdue is not None:
        q = q.filter(Case.is_overdue == is_overdue)

    q = q.order_by(Case.created_at.desc())
    return pagination.apply(q).all()


@router.get("/dashboard")
def case_dashboard(
    db: Session = Depends(get_db),
    current_user: User = Depends(require_analyst_or_above),
):
    org_id = org_id_for(current_user)
    q = db.query(Case).filter(Case.org_id == org_id)

    total = q.count()
    open_cases = q.filter(Case.status.notin_(list(CLOSED_STATUSES))).count()
    smr_candidates = q.filter(Case.is_smr_candidate == True).count()
    overdue = q.filter(Case.is_overdue == True).count()
    smr_lodged = q.filter(Case.smr_lodged == True).count()

    by_status = {}
    for st in CaseStatus:
        by_status[st.value] = q.filter(Case.status == st).count()

    return {
        "total_cases": total,
        "open_cases": open_cases,
        "smr_candidates": smr_candidates,
        "smr_lodged": smr_lodged,
        "overdue": overdue,
        "by_status": by_status,
        "disclaimer": DISCLAIMER,
    }


@router.get("/{case_id}", response_model=CaseOut)
def get_case(
    case_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_analyst_or_above),
):
    return _get_case_or_404(case_id, org_id_for(current_user), db)


@router.patch("/{case_id}", response_model=CaseOut)
def update_case(
    case_id: str,
    payload: CaseUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_compliance_or_above),
):
    case = _get_case_or_404(case_id, org_id_for(current_user), db)

    if case.status in CLOSED_STATUSES:
        raise HTTPException(status_code=409, detail="Closed cases cannot be modified.")

    for k, v in payload.model_dump(exclude_none=True).items():
        setattr(case, k, v)

    # Recalculate overdue
    if case.due_date and case.due_date < date.today():
        case.is_overdue = True

    case.updated_at = datetime.now(timezone.utc)
    db.commit()
    db.refresh(case)
    return case


@router.post("/{case_id}/assign", response_model=CaseOut)
def assign_case(
    case_id: str,
    payload: CaseAssignRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_compliance_or_above),
):
    case = _get_case_or_404(case_id, org_id_for(current_user), db)

    case.assigned_to = payload.assign_to
    case.assigned_by = payload.assign_by
    case.assigned_at = datetime.now(timezone.utc)
    db.commit()
    db.refresh(case)
    return case


@router.post("/{case_id}/escalate", response_model=CaseOut)
def escalate_case(
    case_id: str,
    payload: CaseEscalateRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_compliance_or_above),
):
    case = _get_case_or_404(case_id, org_id_for(current_user), db)

    if case.status in CLOSED_STATUSES:
        raise HTTPException(status_code=409, detail="Cannot escalate a closed case.")

    case.escalated_to = payload.escalate_to
    case.escalated_at = datetime.now(timezone.utc)
    case.escalation_reason = payload.escalation_reason
    case.status = CaseStatus.escalated
    case.updated_at = datetime.now(timezone.utc)
    db.commit()
    db.refresh(case)
    return case


@router.post("/{case_id}/status", response_model=CaseOut)
def transition_status(
    case_id: str,
    payload: CaseStatusTransitionRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_compliance_or_above),
):
    case = _get_case_or_404(case_id, org_id_for(current_user), db)

    if case.status in CLOSED_STATUSES:
        raise HTTPException(status_code=409, detail="Case is already closed.")

    allowed = CASE_TRANSITIONS.get(case.status, set())
    if payload.new_status not in allowed:
        raise HTTPException(
            status_code=400,
            detail=f"Cannot transition from {case.status.value} to {payload.new_status.value}.",
        )

    case.status = payload.new_status
    case.updated_at = datetime.now(timezone.utc)
    db.commit()
    db.refresh(case)
    return case


@router.post("/{case_id}/close", response_model=CaseOut)
def close_case(
    case_id: str,
    payload: CaseCloseRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_mlro_or_above),
):
    """
    Close a case with outcome. MLRO permission required.

    DISCLAIMER: The decision to file an SMR or refer to law enforcement
    remains entirely with the reporting entity.
    """
    case = _get_case_or_404(case_id, org_id_for(current_user), db)

    if case.status in CLOSED_STATUSES:
        raise HTTPException(status_code=409, detail="Case is already closed.")

    if payload.status not in CLOSED_STATUSES:
        raise HTTPException(
            status_code=400,
            detail=f"Closing status must be one of: {', '.join(s.value for s in CLOSED_STATUSES)}",
        )

    case.status = payload.status
    case.outcome = payload.outcome
    case.outcome_notes = payload.outcome_notes
    case.closure_reason = payload.closure_reason
    case.closed_by = current_user.id
    case.closed_at = datetime.now(timezone.utc)
    case.updated_at = datetime.now(timezone.utc)
    db.commit()
    db.refresh(case)
    return case


# ── Notes (append-only) ────────────────────────────────────────────────────────

@router.post("/{case_id}/notes", response_model=CaseNoteOut, status_code=status.HTTP_201_CREATED)
def add_note(
    case_id: str,
    payload: CaseNoteCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_analyst_or_above),
):
    """Append-only case note. Notes cannot be edited after creation."""
    case = _get_case_or_404(case_id, org_id_for(current_user), db)

    # Confidential notes restricted to MLRO
    if payload.is_confidential or payload.is_legal_privilege:
        from app.models.user import UserRole
        if current_user.role not in (UserRole.mlro, UserRole.admin):
            raise HTTPException(
                status_code=403,
                detail="Only MLRO can create confidential or legally privileged notes.",
            )

    note = CaseNote(
        id=f"cn_{uuid4().hex[:12]}",
        case_id=case_id,
        org_id=case.org_id,
        note_type=payload.note_type,
        content=payload.content,
        is_confidential=payload.is_confidential,
        is_legal_privilege=payload.is_legal_privilege,
        author_id=current_user.id,
    )
    db.add(note)
    db.commit()
    db.refresh(note)
    return note


@router.get("/{case_id}/notes", response_model=list[CaseNoteOut])
def list_notes(
    case_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_analyst_or_above),
):
    case = _get_case_or_404(case_id, org_id_for(current_user), db)

    q = db.query(CaseNote).filter(CaseNote.case_id == case_id)

    # Non-MLRO users cannot see confidential notes
    from app.models.user import UserRole
    if current_user.role not in (UserRole.mlro, UserRole.admin):
        q = q.filter(CaseNote.is_confidential == False)

    return q.order_by(CaseNote.created_at.asc()).all()


# ── Evidence ───────────────────────────────────────────────────────────────────

@router.post("/{case_id}/evidence", response_model=CaseEvidenceOut, status_code=status.HTTP_201_CREATED)
def add_evidence(
    case_id: str,
    payload: CaseEvidenceCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_compliance_or_above),
):
    case = _get_case_or_404(case_id, org_id_for(current_user), db)

    evidence = CaseEvidence(
        id=f"cev_{uuid4().hex[:10]}",
        case_id=case_id,
        org_id=case.org_id,
        uploaded_by=current_user.id,
        **payload.model_dump(),
    )
    db.add(evidence)
    db.commit()
    db.refresh(evidence)
    return evidence


@router.get("/{case_id}/evidence", response_model=list[CaseEvidenceOut])
def list_evidence(
    case_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_analyst_or_above),
):
    _get_case_or_404(case_id, org_id_for(current_user), db)
    return db.query(CaseEvidence).filter(CaseEvidence.case_id == case_id).all()


@router.patch("/{case_id}/evidence/{evidence_id}/verify", response_model=CaseEvidenceOut)
def verify_evidence(
    case_id: str,
    evidence_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_compliance_or_above),
):
    _get_case_or_404(case_id, org_id_for(current_user), db)

    ev = db.query(CaseEvidence).filter(
        CaseEvidence.id == evidence_id,
        CaseEvidence.case_id == case_id,
    ).first()
    if not ev:
        raise HTTPException(status_code=404, detail="Evidence not found.")

    ev.is_verified = True
    ev.verified_by = current_user.id
    ev.verified_at = datetime.now(timezone.utc)
    db.commit()
    db.refresh(ev)
    return ev


# ── Link Alert ─────────────────────────────────────────────────────────────────

@router.post("/{case_id}/link-alert", status_code=status.HTTP_201_CREATED)
def link_alert(
    case_id: str,
    payload: LinkAlertRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_compliance_or_above),
):
    case = _get_case_or_404(case_id, org_id_for(current_user), db)

    # Check for duplicate link
    existing = db.query(CaseAlert).filter(
        CaseAlert.case_id == case_id,
        CaseAlert.alert_id == payload.alert_id,
    ).first()
    if existing:
        raise HTTPException(status_code=409, detail="Alert already linked to this case.")

    link = CaseAlert(
        id=f"ca_{uuid4().hex[:10]}",
        case_id=case_id,
        alert_id=payload.alert_id,
        transaction_id=payload.transaction_id,
        org_id=case.org_id,
        added_by=current_user.id,
        notes=payload.notes,
    )
    db.add(link)
    db.commit()

    return {"case_id": case_id, "alert_id": payload.alert_id, "linked": True}


# ── SMR Workflow ──────────────────────────────────────────────────────────────

@router.post("/{case_id}/smr/consider", response_model=CaseOut)
def smr_consider(
    case_id: str,
    payload: SMRConsiderRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_mlro_or_above),
):
    """
    MLRO records SMR consideration decision (whether to lodge or not).

    DISCLAIMER: The decision to lodge a Suspicious Matter Report remains
    entirely with the reporting entity. This platform records that consideration
    has occurred, not the decision itself.
    """
    case = _get_case_or_404(case_id, org_id_for(current_user), db)

    case.smr_considered = True
    case.smr_considered_by = current_user.id
    case.smr_considered_at = datetime.now(timezone.utc)
    case.smr_notes = payload.smr_notes

    if payload.proceed_to_lodge:
        case.smr_lodged = True
        case.smr_lodged_by = current_user.id
        case.smr_lodged_at = datetime.now(timezone.utc)

    case.updated_at = datetime.now(timezone.utc)
    db.commit()
    db.refresh(case)
    return case


@router.post("/{case_id}/smr/lodge", response_model=CaseOut)
def smr_lodge(
    case_id: str,
    payload: SMRLodgeRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_mlro_or_above),
):
    """
    Record that an SMR has been lodged with AUSTRAC.

    DISCLAIMER: This records the fact that a Suspicious Matter Report was lodged.
    The lodgement itself occurs directly via the AUSTRAC AUSTRAC Online portal.
    The platform does not lodge SMRs on behalf of the reporting entity.
    """
    case = _get_case_or_404(case_id, org_id_for(current_user), db)

    if not case.smr_considered:
        raise HTTPException(
            status_code=400,
            detail="SMR must be formally considered (smr/consider) before recording lodgement.",
        )

    case.smr_lodged = True
    case.smr_lodged_by = current_user.id
    case.smr_lodged_at = datetime.now(timezone.utc)
    case.smr_reference = payload.smr_reference
    if payload.smr_notes:
        case.smr_notes = payload.smr_notes

    case.updated_at = datetime.now(timezone.utc)
    db.commit()
    db.refresh(case)
    return case
