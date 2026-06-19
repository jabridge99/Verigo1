from sqlalchemy import JSON, Column, DateTime, ForeignKey, Integer, String, Text
from sqlalchemy.sql import func

from app.db.database import Base


class LegacyAuditLog(Base):
    """Legacy simple audit log — superseded by app.models.audit_log.AuditLog.
    Kept only for existing analytics_service/audit_service/routes.audit consumers;
    table and class renamed to avoid colliding with the canonical AuditLog."""

    __tablename__ = "legacy_audit_logs"

    id = Column(Integer, primary_key=True, index=True)
    log_id = Column(String(60), unique=True, index=True, nullable=False)
    action = Column(String(100), nullable=False)
    entity_type = Column(String(50), nullable=False)
    entity_id = Column(String(100), nullable=False)
    actor = Column(String(200))
    actor_role = Column(String(50))
    industry_id = Column(String(100))
    organisation_id = Column(String, ForeignKey("organisations.id"), index=True)
    before_state = Column(JSON)
    after_state = Column(JSON)
    notes = Column(Text)
    ip_address = Column(String(50))
    created_at = Column(DateTime(timezone=True), server_default=func.now())
