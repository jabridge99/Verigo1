"""
AML Solution API — AML Program, Policies, Controls (seed-level), Training, Services.

All routes are org-scoped. Program editing is section-by-section (PATCH).
Approval changes status and creates an audit record.
"""

import logging
from datetime import date, datetime, timezone
from typing import List

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.api.deps import (
    get_current_user,
    org_id_for,
    require_compliance_or_above,
    require_mlro_or_above,
)
from app.db.database import get_db
from app.models.aml_solution import (
    AMLPolicy,
    AMLProgram,
    AMLService,
    AMLSolution,
    ProgramStatus,
)
from app.models.audit_log import AuditEventType, AuditLog
from app.models.user import User
from app.schemas.aml_solution import (
    AMLProgramApproveRequest,
    AMLProgramResponse,
    AMLProgramUpdate,
    AMLServiceRequestUpdate,
    AMLServiceResponse,
    AMLSolutionResponse,
)

log = logging.getLogger("verigo.api.aml_solution")
router = APIRouter(prefix="/aml", tags=["AML Solution"])


def _get_solution(org_id: str, db: Session) -> AMLSolution:
    sol = db.query(AMLSolution).filter(AMLSolution.org_id == org_id).first()
    if not sol:
        raise HTTPException(404, "AML Solution not found for this organisation")
    return sol


def _get_program(solution_id: str, org_id: str, db: Session) -> AMLProgram:
    prog = (
        db.query(AMLProgram)
        .filter(
            AMLProgram.solution_id == solution_id,
            AMLProgram.org_id == org_id,
        )
        .order_by(AMLProgram.created_at.desc())
        .first()
    )
    if not prog:
        raise HTTPException(404, "AML Program not found")
    return prog


# ── AML Solution ──────────────────────────────────────────────────────────────


@router.get("/solution", response_model=AMLSolutionResponse)
def get_solution(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    return _get_solution(org_id_for(current_user), db)


# ── AML Program ───────────────────────────────────────────────────────────────


@router.get("/program", response_model=AMLProgramResponse)
def get_program(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    sol = _get_solution(org_id_for(current_user), db)
    return _get_program(sol.id, org_id_for(current_user), db)


@router.patch("/program", response_model=AMLProgramResponse)
def update_program(
    payload: AMLProgramUpdate,
    current_user: User = Depends(require_compliance_or_above),
    db: Session = Depends(get_db),
):
    """
    PATCH individual sections. Only updates fields explicitly provided.
    Moving from published → under_review is automatic when edits are made.
    """
    sol = _get_solution(org_id_for(current_user), db)
    prog = _get_program(sol.id, org_id_for(current_user), db)

    if prog.status == ProgramStatus.active:
        prog.status = ProgramStatus.under_review

    for field, value in payload.model_dump(exclude_none=True).items():
        setattr(prog, field, value)

    db.add(
        AuditLog(
            event_type=AuditEventType.other,
            org_id=org_id_for(current_user),
            actor_id=current_user.id,
            action="aml_program.update",
            object_type="AMLProgram",
            object_id=prog.id,
            new_value={
                "fields_updated": list(payload.model_dump(exclude_none=True).keys())
            },
        )
    )
    db.commit()
    db.refresh(prog)
    return prog


@router.post("/program/submit")
def submit_program_for_approval(
    current_user: User = Depends(require_compliance_or_above),
    db: Session = Depends(get_db),
):
    """Submit the AML Program for MLRO / Board approval."""
    sol = _get_solution(org_id_for(current_user), db)
    prog = _get_program(sol.id, org_id_for(current_user), db)

    if prog.status not in (ProgramStatus.draft, ProgramStatus.under_review):
        raise HTTPException(422, f"Cannot submit from status '{prog.status.value}'")

    prog.status = ProgramStatus.under_review
    db.add(
        AuditLog(
            event_type=AuditEventType.other,
            org_id=org_id_for(current_user),
            actor_id=current_user.id,
            action="aml_program.submit_for_approval",
            object_type="AMLProgram",
            object_id=prog.id,
        )
    )
    db.commit()
    return {"status": prog.status, "message": "Program submitted for approval"}


@router.post("/program/approve")
def approve_program(
    payload: AMLProgramApproveRequest,
    current_user: User = Depends(require_mlro_or_above),
    db: Session = Depends(get_db),
):
    """MLRO/Admin approves and activates the AML Program."""
    sol = _get_solution(org_id_for(current_user), db)
    prog = _get_program(sol.id, org_id_for(current_user), db)

    if prog.status != ProgramStatus.under_review:
        raise HTTPException(422, "Program must be in 'under_review' status to approve")

    prog.status = ProgramStatus.active
    prog.approved_by = current_user.id
    prog.approved_at = datetime.now(timezone.utc)
    if not prog.effective_date:
        prog.effective_date = date.today()

    db.add(
        AuditLog(
            event_type=AuditEventType.other,
            org_id=org_id_for(current_user),
            actor_id=current_user.id,
            action="aml_program.approve",
            object_type="AMLProgram",
            object_id=prog.id,
            new_value={"comments": payload.comments},
        )
    )
    db.commit()
    return {"status": prog.status, "approved_by": current_user.id}


# ── Seed Policies (from AML Solution template) ────────────────────────────────


@router.get("/policies", response_model=List[dict])
def list_seed_policies(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """List the lightweight seed policies created at onboarding."""
    sol = _get_solution(org_id_for(current_user), db)
    policies = (
        db.query(AMLPolicy)
        .filter(
            AMLPolicy.solution_id == sol.id,
            AMLPolicy.org_id == org_id_for(current_user),
        )
        .order_by(AMLPolicy.title)
        .all()
    )
    return [
        {
            "id": p.id,
            "title": p.title,
            "policy_type": p.policy_type,
            "version": p.version,
            "status": p.status.value,
            "effective_date": p.effective_date.isoformat()
            if p.effective_date
            else None,
            "review_due_date": p.review_due_date.isoformat()
            if p.review_due_date
            else None,
        }
        for p in policies
    ]


# ── AML Services (premium engagements) ────────────────────────────────────────


@router.get("/services", response_model=List[AMLServiceResponse])
def list_services(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    sol = _get_solution(org_id_for(current_user), db)
    return (
        db.query(AMLService)
        .filter(AMLService.solution_id == sol.id)
        .order_by(AMLService.created_at)
        .all()
    )


@router.patch("/services/{service_id}", response_model=AMLServiceResponse)
def update_service(
    service_id: str,
    payload: AMLServiceRequestUpdate,
    current_user: User = Depends(require_mlro_or_above),
    db: Session = Depends(get_db),
):
    svc = (
        db.query(AMLService)
        .filter(
            AMLService.id == service_id,
            AMLService.org_id == org_id_for(current_user),
        )
        .first()
    )
    if not svc:
        raise HTTPException(404, "Service not found")

    for field, value in payload.model_dump(exclude_none=True).items():
        setattr(svc, field, value)

    db.commit()
    db.refresh(svc)
    return svc
