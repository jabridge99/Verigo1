"""
Audit Trail API — SECURITY HARDENED.
Fixes: authentication required on all endpoints, CSV export restricted to
admin/mlro, SQL injection in ilike() f-string replaced with .contains(),
tenant isolation enforced on list/export, POST restricted to system roles.
"""

import csv
import io
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from fastapi.responses import StreamingResponse
from sqlalchemy.orm import Session

from app.api.routes.auth import _current_user, _require_roles
from app.db.database import get_db
from app.models.audit import AuditLog
from app.models.user import User, UserRole
from app.schemas.audit import AuditLogCreate, AuditLogResponse
from app.services.audit_service import log_action
from app.services.tenant_scope import assert_tenant, scope_query

router = APIRouter(prefix="/audit", tags=["Audit Trail"])


def _scoped_query(db: Session, current_user: User):
    """Return a query scoped to the current user's tenant."""
    return scope_query(db.query(AuditLog), AuditLog, current_user)


@router.post("/", response_model=AuditLogResponse, status_code=201)
def create_log(
    payload: AuditLogCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(
        _require_roles(UserRole.admin, UserRole.mlro, UserRole.compliance)
    ),
):
    """Write an audit event. Restricted to privileged roles to prevent log-stuffing."""
    return log_action(db, **payload.model_dump())


@router.get("/", response_model=list[AuditLogResponse])
def list_logs(
    entity_type: Optional[str] = None,
    entity_id: Optional[str] = None,
    actor: Optional[str] = None,
    action: Optional[str] = None,
    industry_id: Optional[str] = None,
    skip: int = Query(0, ge=0),
    limit: int = Query(100, ge=1, le=1000),
    db: Session = Depends(get_db),
    current_user: User = Depends(_current_user),
):
    q = _scoped_query(db, current_user)
    if entity_type:
        q = q.filter(AuditLog.entity_type == entity_type)
    if entity_id:
        q = q.filter(AuditLog.entity_id == entity_id)
    # Use .contains() — safe parameterised LIKE, no f-string injection
    if actor:
        q = q.filter(AuditLog.actor.contains(actor))
    if action:
        q = q.filter(AuditLog.action.contains(action))
    # Admin can filter by any industry_id; non-admin query is already scoped
    if industry_id and current_user.role == UserRole.admin:
        q = q.filter(AuditLog.industry_id == industry_id)
    return q.order_by(AuditLog.created_at.desc()).offset(skip).limit(limit).all()


@router.get("/export/csv")
def export_csv(
    entity_type: Optional[str] = None,
    industry_id: Optional[str] = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(_require_roles(UserRole.admin, UserRole.mlro)),
):
    """Export audit log as CSV. Restricted to admin/mlro."""
    q = _scoped_query(db, current_user)
    if entity_type:
        q = q.filter(AuditLog.entity_type == entity_type)
    if industry_id and current_user.role == UserRole.admin:
        q = q.filter(AuditLog.industry_id == industry_id)
    logs = q.order_by(AuditLog.created_at.desc()).limit(10_000).all()

    buf = io.StringIO()
    writer = csv.writer(buf)
    writer.writerow(
        [
            "log_id",
            "action",
            "entity_type",
            "entity_id",
            "actor",
            "actor_role",
            "notes",
            "industry_id",
            "created_at",
        ]
    )
    for entry in logs:
        writer.writerow(
            [
                entry.log_id,
                entry.action,
                entry.entity_type,
                entry.entity_id,
                entry.actor,
                entry.actor_role,
                entry.notes or "",
                entry.industry_id or "",
                entry.created_at.isoformat() if entry.created_at else "",
            ]
        )
    buf.seek(0)
    return StreamingResponse(
        buf,
        media_type="text/csv",
        headers={"Content-Disposition": "attachment; filename=audit_log.csv"},
    )


@router.get("/{log_id}", response_model=AuditLogResponse)
def get_log(
    log_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(_current_user),
):
    entry = db.query(AuditLog).filter_by(log_id=log_id).first()
    if not entry:
        raise HTTPException(404, "Log entry not found")
    # Tenant isolation: non-admin cannot read another tenant's log entry
    assert_tenant(current_user, entry.organisation_id, entry.industry_id)
    return entry
