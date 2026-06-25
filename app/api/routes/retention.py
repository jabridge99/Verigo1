"""
Data Retention & Legal Hold API.
Admin/MLRO only — implements Part 11 of the enterprise security review.
"""

from datetime import datetime
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app.api.routes.auth import _require_roles
from app.db.database import get_db
from app.models.retention import EntityScope, LegalHold
from app.models.user import User, UserRole
from app.services.retention_service import (
    generate_purge_report,
    get_policy,
    is_deletion_eligible,
    list_policies,
    place_legal_hold,
    release_legal_hold,
    upsert_policy,
)
from app.services.tenant_scope import scope_fields, scope_query

router = APIRouter(prefix="/retention", tags=["Data Retention"])


# ── Schemas ───────────────────────────────────────────────────────────────────


class PolicyUpsert(BaseModel):
    entity_scope: EntityScope
    retention_years: int
    legal_hold: bool = False
    notes: Optional[str] = None


class PolicyResponse(BaseModel):
    policy_id: str
    industry_id: Optional[str]
    entity_scope: EntityScope
    retention_years: int
    legal_hold: bool
    notes: Optional[str]
    created_at: Optional[datetime]

    class Config:
        from_attributes = True


class HoldCreate(BaseModel):
    entity_scope: EntityScope
    entity_id: str
    reason: str


class HoldResponse(BaseModel):
    hold_id: str
    industry_id: Optional[str]
    entity_scope: EntityScope
    entity_id: str
    reason: str
    held_by: Optional[str]
    placed_at: Optional[datetime]
    released_at: Optional[datetime]
    active: bool

    class Config:
        from_attributes = True


class EligibilityQuery(BaseModel):
    entity_scope: EntityScope
    entity_id: str
    created_at: datetime
    pep_or_high_risk: bool = False


# ── Policy endpoints ──────────────────────────────────────────────────────────


@router.get("/policies", response_model=list[PolicyResponse])
def list_retention_policies(
    db: Session = Depends(get_db),
    current_user: User = Depends(
        _require_roles(UserRole.admin, UserRole.mlro, UserRole.compliance)
    ),
):
    industry_id = None if current_user.role == UserRole.admin else current_user.org_id
    return list_policies(db, industry_id)


@router.put("/policies", response_model=PolicyResponse)
def set_retention_policy(
    payload: PolicyUpsert,
    db: Session = Depends(get_db),
    current_user: User = Depends(_require_roles(UserRole.admin, UserRole.mlro)),
):
    scoped = scope_fields(current_user)
    try:
        return upsert_policy(
            db,
            entity_scope=payload.entity_scope,
            retention_years=payload.retention_years,
            industry_id=scoped.get("industry_id"),
            organisation_id=scoped.get("organisation_id"),
            legal_hold=payload.legal_hold,
            notes=payload.notes,
            created_by=current_user.id,
        )
    except ValueError as e:
        raise HTTPException(400, str(e))


@router.get("/policies/{entity_scope}", response_model=PolicyResponse)
def get_retention_policy(
    entity_scope: EntityScope,
    db: Session = Depends(get_db),
    current_user: User = Depends(
        _require_roles(UserRole.admin, UserRole.mlro, UserRole.compliance)
    ),
):
    industry_id = None if current_user.role == UserRole.admin else current_user.org_id
    return get_policy(db, entity_scope, industry_id)


# ── Legal hold endpoints ──────────────────────────────────────────────────────


@router.post("/holds", response_model=HoldResponse, status_code=201)
def create_legal_hold(
    payload: HoldCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(_require_roles(UserRole.admin, UserRole.mlro)),
):
    scoped = scope_fields(current_user)
    return place_legal_hold(
        db,
        entity_scope=payload.entity_scope,
        entity_id=payload.entity_id,
        reason=payload.reason,
        held_by=current_user.id,
        industry_id=current_user.org_id
        if current_user.role != UserRole.admin
        else None,
    )


@router.post("/holds/{hold_id}/release", response_model=HoldResponse)
def release_hold(
    hold_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(_require_roles(UserRole.admin, UserRole.mlro)),
):
    scoped = scope_fields(current_user)
    try:
        return release_legal_hold(
            db,
            hold_id,
            released_by=current_user.id,
            industry_id=current_user.org_id
            if current_user.role != UserRole.admin
            else None,
        )
    except (ValueError, PermissionError) as e:
        raise HTTPException(400 if isinstance(e, ValueError) else 403, str(e))


@router.get("/holds", response_model=list[HoldResponse])
def list_legal_holds(
    entity_scope: Optional[EntityScope] = None,
    active_only: bool = True,
    db: Session = Depends(get_db),
    current_user: User = Depends(
        _require_roles(UserRole.admin, UserRole.mlro, UserRole.compliance)
    ),
):
    q = db.query(LegalHold)
    if current_user.role != UserRole.admin:
        q = q.filter(LegalHold.industry_id == current_user.org_id)
    if entity_scope:
        q = q.filter(LegalHold.entity_scope == entity_scope)
    if active_only:
        q = q.filter(LegalHold.active)
    return q.order_by(LegalHold.placed_at.desc()).all()


# ── Eligibility check ─────────────────────────────────────────────────────────


@router.post("/eligibility")
def check_deletion_eligibility(
    payload: EligibilityQuery,
    db: Session = Depends(get_db),
    current_user: User = Depends(_require_roles(UserRole.admin, UserRole.mlro)),
):
    scoped = scope_fields(current_user)
    return is_deletion_eligible(
        db,
        entity_scope=payload.entity_scope,
        entity_id=payload.entity_id,
        created_at=payload.created_at,
        industry_id=scoped.get("industry_id"),
        organisation_id=scoped.get("organisation_id"),
        pep_or_high_risk=payload.pep_or_high_risk,
    )


# ── Purge report ──────────────────────────────────────────────────────────────


@router.get("/purge-report")
def purge_report(
    db: Session = Depends(get_db),
    current_user: User = Depends(_require_roles(UserRole.admin, UserRole.mlro)),
):
    """Dry-run purge report — identifies eligible records without deleting them."""
    industry_id = None if current_user.role == UserRole.admin else current_user.org_id
    return generate_purge_report(db, industry_id)
