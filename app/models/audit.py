from datetime import datetime
from typing import Any, Optional

from sqlalchemy import JSON, Column, DateTime, ForeignKey, Integer, String, Text
from sqlalchemy.orm import Mapped
from sqlalchemy.sql import func

from app.db.database import Base


class LegacyAuditLog(Base):
    """Legacy simple audit log — superseded by app.models.audit_log.AuditLog.
    Kept only for existing analytics_service/audit_service/routes.audit consumers;
    table and class renamed to avoid colliding with the canonical AuditLog."""

    __tablename__ = "legacy_audit_logs"

    id: Mapped[int] = Column(Integer, primary_key=True, index=True)
    log_id: Mapped[str] = Column(String(60), unique=True, index=True, nullable=False)
    action: Mapped[str] = Column(String(100), nullable=False)
    entity_type: Mapped[str] = Column(String(50), nullable=False)
    entity_id: Mapped[str] = Column(String(100), nullable=False)
    actor: Mapped[Optional[str]] = Column(String(200))
    actor_role: Mapped[Optional[str]] = Column(String(50))
    industry_id: Mapped[Optional[str]] = Column(String(100))
    organisation_id: Mapped[Optional[str]] = Column(
        String, ForeignKey("organisations.id", ondelete="CASCADE"), index=True
    )
    before_state: Mapped[Optional[Any]] = Column(JSON)
    after_state: Mapped[Optional[Any]] = Column(JSON)
    notes: Mapped[Optional[str]] = Column(Text)
    ip_address: Mapped[Optional[str]] = Column(String(50))
    created_at: Mapped[Optional[datetime]] = Column(
        DateTime(timezone=True), server_default=func.now()
    )
