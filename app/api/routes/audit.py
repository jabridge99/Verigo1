"""Audit Trail API — immutable compliance log."""

import csv
import io
from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import StreamingResponse
from sqlalchemy.orm import Session
from typing import Optional

from app.db.database import get_db
from app.models.audit import AuditLog
from app.schemas.audit import AuditLogCreate, AuditLogResponse
from app.services.audit_service import log_action

router = APIRouter(prefix="/audit", tags=["Audit Trail"])


@router.post("/", response_model=AuditLogResponse, status_code=201)
def create_log(payload: AuditLogCreate, db: Session = Depends(get_db)):
    return log_action(db, **payload.model_dump())


@router.get("/", response_model=list[AuditLogResponse])
def list_logs(
    entity_type: Optional[str] = None,
    entity_id:   Optional[str] = None,
    actor:       Optional[str] = None,
    action:      Optional[str] = None,
    industry_id: Optional[str] = None,
    skip: int = 0,
    limit: int = 100,
    db: Session = Depends(get_db),
):
    q = db.query(AuditLog)
    if entity_type:  q = q.filter(AuditLog.entity_type == entity_type)
    if entity_id:    q = q.filter(AuditLog.entity_id == entity_id)
    if actor:        q = q.filter(AuditLog.actor.ilike(f"%{actor}%"))
    if action:       q = q.filter(AuditLog.action.ilike(f"%{action}%"))
    if industry_id:  q = q.filter(AuditLog.industry_id == industry_id)
    return q.order_by(AuditLog.created_at.desc()).offset(skip).limit(limit).all()


@router.get("/export/csv")
def export_csv(
    entity_type: Optional[str] = None,
    industry_id: Optional[str] = None,
    db: Session = Depends(get_db),
):
    q = db.query(AuditLog)
    if entity_type:  q = q.filter(AuditLog.entity_type == entity_type)
    if industry_id:  q = q.filter(AuditLog.industry_id == industry_id)
    logs = q.order_by(AuditLog.created_at.desc()).limit(10000).all()

    buf = io.StringIO()
    writer = csv.writer(buf)
    writer.writerow(["log_id","action","entity_type","entity_id","actor","actor_role","notes","created_at"])
    for log in logs:
        writer.writerow([
            log.log_id, log.action, log.entity_type, log.entity_id,
            log.actor, log.actor_role, log.notes or "",
            log.created_at.isoformat() if log.created_at else "",
        ])
    buf.seek(0)
    return StreamingResponse(
        buf,
        media_type="text/csv",
        headers={"Content-Disposition": "attachment; filename=audit_log.csv"},
    )


@router.get("/{log_id}", response_model=AuditLogResponse)
def get_log(log_id: str, db: Session = Depends(get_db)):
    log = db.query(AuditLog).filter_by(log_id=log_id).first()
    if not log:
        raise HTTPException(404, "Log entry not found")
    return log
