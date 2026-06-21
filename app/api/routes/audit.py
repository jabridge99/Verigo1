"""
Audit Trail API — SECURITY HARDENED.
Fixes: authentication required on all endpoints, CSV export restricted to
admin/mlro, SQL injection in ilike() f-string replaced with .contains(),
tenant isolation enforced on list/export, POST restricted to system roles.

NOTE: there are two audit-log tables in this codebase — `legacy_audit_logs`
(written by app.services.audit_service.log_action, used by routes like
customers.py/auth.py/alerts.py/reports.py) and the newer `audit_logs`
(app.models.audit_log.AuditLog, written by governance/risk_assessment/
aml_solution/customer_workflow). This API used to only read the legacy
table, silently missing every event recorded through the newer one. It now
reads and merges both.
"""

import csv
import io
from datetime import datetime, timezone
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from fastapi.responses import StreamingResponse
from sqlalchemy.orm import Session

from app.api.routes.auth import _current_user, _require_roles
from app.db.database import get_db
from app.models.audit import LegacyAuditLog
from app.models.audit_log import AuditLog as NewAuditLog
from app.models.user import User, UserRole
from app.schemas.audit import AuditLogCreate, AuditLogResponse
from app.services.audit_service import log_action
from app.services.tenant_scope import assert_tenant, scope_query

router = APIRouter(prefix="/audit", tags=["Audit Trail"])


def _normalize_new(entry: NewAuditLog) -> dict:
    return {
        "id": entry.id,
        "log_id": entry.id,
        "action": entry.action,
        "entity_type": entry.object_type,
        "entity_id": entry.object_id,
        "actor": entry.actor_id,
        "actor_role": entry.actor_role,
        "industry_id": entry.org_id,
        "before_state": entry.old_value,
        "after_state": entry.new_value,
        "notes": entry.reason,
        "ip_address": entry.ip_address,
        "created_at": entry.created_at,
    }


def _normalize_legacy(entry: LegacyAuditLog) -> dict:
    return {
        "id": entry.id,
        "log_id": entry.log_id,
        "action": entry.action,
        "entity_type": entry.entity_type,
        "entity_id": entry.entity_id,
        "actor": entry.actor,
        "actor_role": entry.actor_role,
        "industry_id": entry.industry_id or entry.organisation_id,
        "before_state": entry.before_state,
        "after_state": entry.after_state,
        "notes": entry.notes,
        "ip_address": entry.ip_address,
        "created_at": entry.created_at,
    }


def _scoped_query(db: Session, current_user: User):
    """Return a query scoped to the current user's tenant."""
    q = db.query(LegacyAuditLog)
    if current_user.role != UserRole.admin:
        q = q.filter(LegacyAuditLog.organisation_id == current_user.org_id)
    return q


def _scoped_new_query(db: Session, current_user: User):
    q = db.query(NewAuditLog)
    if current_user.role != UserRole.admin:
        q = q.filter(NewAuditLog.org_id == current_user.org_id)
    return q


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
        q = q.filter(LegacyAuditLog.entity_type == entity_type)
    if entity_id:
        q = q.filter(LegacyAuditLog.entity_id == entity_id)
    # Use .contains() — safe parameterised LIKE, no f-string injection
    if actor:
        q = q.filter(LegacyAuditLog.actor.contains(actor))
    if action:
        q = q.filter(LegacyAuditLog.action.contains(action))
    # Admin can filter by any industry_id; non-admin query is already scoped
    if industry_id and current_user.role == UserRole.admin:
        q = q.filter(LegacyAuditLog.industry_id == industry_id)
    legacy_entries = q.order_by(LegacyAuditLog.created_at.desc()).limit(skip + limit).all()

    nq = _scoped_new_query(db, current_user)
    if entity_type:
        nq = nq.filter(NewAuditLog.object_type == entity_type)
    if entity_id:
        nq = nq.filter(NewAuditLog.object_id == entity_id)
    if actor:
        nq = nq.filter(NewAuditLog.actor_id.contains(actor))
    if action:
        nq = nq.filter(NewAuditLog.action.contains(action))
    if industry_id and current_user.role == UserRole.admin:
        nq = nq.filter(NewAuditLog.org_id == industry_id)
    new_entries = nq.order_by(NewAuditLog.created_at.desc()).limit(skip + limit).all()

    merged = [_normalize_legacy(e) for e in legacy_entries] + [
        _normalize_new(e) for e in new_entries
    ]
    merged.sort(key=lambda d: d["created_at"] or datetime.min.replace(tzinfo=timezone.utc), reverse=True)
    return merged[skip : skip + limit]


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
        q = q.filter(LegacyAuditLog.entity_type == entity_type)
    if industry_id and current_user.role == UserRole.admin:
        q = q.filter(LegacyAuditLog.industry_id == industry_id)
    legacy_entries = q.order_by(LegacyAuditLog.created_at.desc()).limit(10_000).all()

    nq = _scoped_new_query(db, current_user)
    if entity_type:
        nq = nq.filter(NewAuditLog.object_type == entity_type)
    if industry_id and current_user.role == UserRole.admin:
        nq = nq.filter(NewAuditLog.org_id == industry_id)
    new_entries = nq.order_by(NewAuditLog.created_at.desc()).limit(10_000).all()

    merged = [_normalize_legacy(e) for e in legacy_entries] + [
        _normalize_new(e) for e in new_entries
    ]
    merged.sort(key=lambda d: d["created_at"] or datetime.min.replace(tzinfo=timezone.utc), reverse=True)
    merged = merged[:10_000]

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
    for entry in merged:
        writer.writerow(
            [
                entry["log_id"],
                entry["action"],
                entry["entity_type"],
                entry["entity_id"],
                entry["actor"],
                entry["actor_role"],
                entry["notes"] or "",
                entry["industry_id"] or "",
                entry["created_at"].isoformat() if entry["created_at"] else "",
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
    entry = db.query(LegacyAuditLog).filter_by(log_id=log_id).first()
    if entry:
        normalized = _normalize_legacy(entry)
    else:
        new_entry = db.query(NewAuditLog).filter_by(id=log_id).first()
        if not new_entry:
            raise HTTPException(404, "Log entry not found")
        normalized = _normalize_new(new_entry)

    # Tenant isolation: non-admin cannot read another tenant's log entry
    if current_user.role != UserRole.admin and normalized["industry_id"] != current_user.org_id:
        raise HTTPException(403, "Cross-tenant access denied")
    return normalized
