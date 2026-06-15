from sqlalchemy import Column, String, DateTime, JSON, Integer, ForeignKey, func
from sqlalchemy.orm import relationship
from app.db.database import Base


class AuditLog(Base):
    __tablename__ = "audit_logs"

    id = Column(Integer, primary_key=True, autoincrement=True)
    org_id = Column(String, ForeignKey("organisations.id", ondelete="SET NULL"), nullable=True, index=True)
    actor_id = Column(String, nullable=False)
    actor_role = Column(String(50))
    action = Column(String(100), nullable=False, index=True)
    entity_type = Column(String(50), index=True)
    entity_id = Column(String)
    before_state = Column(JSON)
    after_state = Column(JSON)
    ip_address = Column(String(50))
    notes = Column(String(500))
    created_at = Column(DateTime(timezone=True), server_default=func.now(), index=True)

    organisation = relationship("Organisation", back_populates="audit_logs")
