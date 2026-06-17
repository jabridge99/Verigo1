"""Immutable audit trail service."""

import uuid

from sqlalchemy.orm import Session

from app.models.audit import LegacyAuditLog as AuditLog


def log_action(
    db: Session,
    action: str,
    entity_type: str,
    entity_id: str,
    actor: str = "system",
    actor_role: str = "system",
    before_state=None,
    after_state=None,
    notes: str = None,
    industry_id: str = None,
    ip_address: str = None,
) -> AuditLog:
    entry = AuditLog(
        log_id=f"LOG-{uuid.uuid4().hex[:12].upper()}",
        action=action,
        entity_type=entity_type,
        entity_id=entity_id,
        actor=actor,
        actor_role=actor_role,
        industry_id=industry_id,
        before_state=before_state,
        after_state=after_state,
        notes=notes,
        ip_address=ip_address,
    )
    db.add(entry)
    db.commit()
    db.refresh(entry)
    return entry
