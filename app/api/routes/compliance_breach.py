"""
Compliance Breach Tracking API routes — P34.

Lifecycle: open -> remediated -> closed (or risk_accepted, closed without a fix)

DISCLAIMER: This module provides workflow tooling only.
All compliance decisions remain with the reporting entity.
"""

import logging
from datetime import date, datetime, timezone
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session

from app.api.deps import get_current_user, get_db, require_roles
from app.models.compliance_breach import BreachSeverity, BreachStatus, ComplianceBreach
from app.models.user import UserRole
from app.schemas.compliance_breach import (
    BreachCreate,
    BreachUpdate,
    CloseRequest,
    RemediateRequest,
)
from app.services import audit_service

log = logging.getLogger("tvg.compliance_breach")

router = APIRouter(prefix="/compliance-breaches", tags=["Compliance Breach Tracking"])


def _log(
    db: Session,
    current_user,
    entity_id: str,
    action: str,
    after_state: Optional[dict] = None,
    notes: Optional[str] = None,
) -> None:
    audit_service.log_action(
        db,
        action=action,
        entity_type="compliance_breach",
        entity_id=entity_id,
        actor=current_user.email,
        actor_role=current_user.role.value if current_user.role else None,
        organisation_id=current_user.org_id,
        after_state=after_state,
        notes=notes,
    )


def _get_breach(db: Session, org_id: str, breach_id: str) -> ComplianceBreach:
    breach = db.query(ComplianceBreach).filter_by(id=breach_id, org_id=org_id).first()
    if not breach:
        raise HTTPException(404, "Compliance breach not found")
    return breach


def _breach_dict(b: ComplianceBreach) -> dict:
    return {
        "id": b.id,
        "org_id": b.org_id,
        "title": b.title,
        "description": b.description,
        "severity": b.severity.value,
        "status": b.status.value,
        "identified_date": b.identified_date.isoformat() if b.identified_date else None,
        "identified_by": b.identified_by,
        "source_review_id": b.source_review_id,
        "source_control_test_id": b.source_control_test_id,
        "reported_to_austrac": b.reported_to_austrac,
        "austrac_reference": b.austrac_reference,
        "austrac_reported_at": b.austrac_reported_at.isoformat()
        if b.austrac_reported_at
        else None,
        "remediation_notes": b.remediation_notes,
        "remediated_date": b.remediated_date.isoformat() if b.remediated_date else None,
        "closed_by": b.closed_by,
        "closed_at": b.closed_at.isoformat() if b.closed_at else None,
        "created_by": b.created_by,
        "created_at": b.created_at.isoformat() if b.created_at else None,
        "updated_at": b.updated_at.isoformat() if b.updated_at else None,
    }


# ── CRUD ──────────────────────────────────────────────────────────────────────


@router.post("", status_code=201)
def create_breach(
    body: BreachCreate,
    db: Session = Depends(get_db),
    current_user=Depends(require_roles(UserRole.compliance, UserRole.mlro)),
):
    breach = ComplianceBreach(
        org_id=current_user.org_id,
        created_by=current_user.id,
        identified_by=current_user.id,
        title=body.title,
        description=body.description,
        severity=body.severity,
        identified_date=body.identified_date,
        source_review_id=body.source_review_id,
        source_control_test_id=body.source_control_test_id,
        reported_to_austrac=body.reported_to_austrac,
        austrac_reference=body.austrac_reference,
        austrac_reported_at=datetime.now(timezone.utc)
        if body.reported_to_austrac
        else None,
    )
    db.add(breach)
    db.commit()
    db.refresh(breach)
    log.info("breach.created org=%s id=%s", current_user.org_id, breach.id)
    _log(
        db,
        current_user,
        breach.id,
        action="breach_created",
        after_state={"title": breach.title, "severity": breach.severity.value},
    )
    return _breach_dict(breach)


@router.get("")
def list_breaches(
    status: Optional[BreachStatus] = None,
    severity: Optional[BreachSeverity] = None,
    identified_from: Optional[date] = None,
    identified_to: Optional[date] = None,
    skip: int = 0,
    limit: int = Query(50, le=200),
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
):
    q = db.query(ComplianceBreach).filter_by(org_id=current_user.org_id)
    if status:
        q = q.filter(ComplianceBreach.status == status)
    if severity:
        q = q.filter(ComplianceBreach.severity == severity)
    if identified_from:
        q = q.filter(ComplianceBreach.identified_date >= identified_from)
    if identified_to:
        q = q.filter(ComplianceBreach.identified_date <= identified_to)
    total = q.count()
    items = (
        q.order_by(ComplianceBreach.identified_date.desc())
        .offset(skip)
        .limit(limit)
        .all()
    )
    return {"total": total, "items": [_breach_dict(b) for b in items]}


@router.get("/enums")
def breach_enums():
    return {
        "severity": [e.value for e in BreachSeverity],
        "status": [e.value for e in BreachStatus],
    }


@router.get("/{breach_id}")
def get_breach(
    breach_id: str,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
):
    return _breach_dict(_get_breach(db, current_user.org_id, breach_id))


@router.patch("/{breach_id}")
def update_breach(
    breach_id: str,
    body: BreachUpdate,
    db: Session = Depends(get_db),
    current_user=Depends(require_roles(UserRole.compliance, UserRole.mlro)),
):
    breach = _get_breach(db, current_user.org_id, breach_id)
    if breach.status in (BreachStatus.closed, BreachStatus.risk_accepted):
        raise HTTPException(422, "Cannot edit a closed breach record")

    for field, value in body.model_dump(exclude_none=True).items():
        setattr(breach, field, value)
    if body.reported_to_austrac and not breach.austrac_reported_at:
        breach.austrac_reported_at = datetime.now(timezone.utc)
    db.commit()
    db.refresh(breach)
    _log(db, current_user, breach.id, action="breach_updated")
    return _breach_dict(breach)


@router.post("/{breach_id}/remediate")
def remediate_breach(
    breach_id: str,
    body: RemediateRequest,
    db: Session = Depends(get_db),
    current_user=Depends(require_roles(UserRole.compliance, UserRole.mlro)),
):
    breach = _get_breach(db, current_user.org_id, breach_id)
    if breach.status != BreachStatus.open:
        raise HTTPException(422, "Only an open breach can be marked remediated")

    breach.status = BreachStatus.remediated
    breach.remediation_notes = body.remediation_notes
    breach.remediated_date = body.remediated_date or date.today()
    db.commit()
    db.refresh(breach)
    _log(
        db,
        current_user,
        breach.id,
        action="breach_remediated",
        notes=body.remediation_notes,
    )
    return _breach_dict(breach)


@router.post("/{breach_id}/close")
def close_breach(
    breach_id: str,
    body: CloseRequest,
    db: Session = Depends(get_db),
    current_user=Depends(require_roles(UserRole.mlro)),
):
    """
    Final sign-off that a breach record is closed -- either genuinely
    remediated or with residual risk formally accepted. Requires MLRO,
    matching the same "operational fix vs. final governance sign-off" split
    already used across this codebase's other review/finding workflows.
    """
    breach = _get_breach(db, current_user.org_id, breach_id)
    if breach.status in (BreachStatus.closed, BreachStatus.risk_accepted):
        raise HTTPException(422, "Breach is already closed")
    if body.status not in (BreachStatus.closed, BreachStatus.risk_accepted):
        raise HTTPException(422, "status must be 'closed' or 'risk_accepted'")

    breach.status = body.status
    breach.closed_by = current_user.id
    breach.closed_at = datetime.now(timezone.utc)
    if body.notes:
        breach.remediation_notes = (
            f"{breach.remediation_notes}\n{body.notes}"
            if breach.remediation_notes
            else body.notes
        )
    db.commit()
    db.refresh(breach)
    _log(
        db,
        current_user,
        breach.id,
        action="breach_closed",
        after_state={"status": body.status.value},
        notes=body.notes,
    )
    return _breach_dict(breach)
