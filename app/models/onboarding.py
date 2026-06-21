"""
Customer Onboarding Autopilot — data models.
"""

import enum

from sqlalchemy import (
    JSON,
    Boolean,
    Column,
    DateTime,
    Enum,
    Float,
    ForeignKey,
    Integer,
    String,
)
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func

from app.db.database import Base


class SessionStatus(str, enum.Enum):
    invited = "invited"
    opened = "opened"
    in_progress = "in_progress"
    documents_submitted = "documents_submitted"
    verification_pending = "verification_pending"
    completed = "completed"
    expired = "expired"
    abandoned = "abandoned"
    rejected = "rejected"


class CustomerType(str, enum.Enum):
    individual = "individual"
    business = "business"


class ImportSource(str, enum.Enum):
    csv = "csv"
    excel = "excel"
    manual = "manual"
    api = "api"


class OnboardingSession(Base):
    __tablename__ = "onboarding_sessions"

    id = Column(Integer, primary_key=True, index=True)
    session_id = Column(String(50), unique=True, nullable=False, index=True)
    industry_id = Column(String(100), nullable=False)
    organisation_id = Column(String(36), ForeignKey("organisations.id", ondelete="CASCADE"), index=True)
    customer_type = Column(Enum(CustomerType), default=CustomerType.individual)

    applicant_name = Column(String(300), nullable=False)
    applicant_email = Column(String(300), nullable=False)
    applicant_phone = Column(String(50))
    applicant_company = Column(String(300))

    invite_token = Column(String(100), unique=True, nullable=False, index=True)
    invite_sent_at = Column(DateTime(timezone=True))
    invite_opened_at = Column(DateTime(timezone=True))
    invite_expires_at = Column(DateTime(timezone=True))
    reminders_sent = Column(Integer, default=0)
    last_reminder_at = Column(DateTime(timezone=True))

    status = Column(Enum(SessionStatus), default=SessionStatus.invited)
    current_step = Column(Integer, default=0)
    total_steps = Column(Integer, default=5)
    completion_pct = Column(Float, default=0.0)
    documents_uploaded = Column(Integer, default=0)

    collected_data = Column(JSON, default=dict)

    customer_id = Column(String(50))
    kyc_id = Column(String(50))
    risk_score = Column(Float)
    risk_level = Column(String(20))
    sanctions_match = Column(Boolean, default=False)

    source = Column(Enum(ImportSource), default=ImportSource.manual)
    created_by = Column(String(200))
    batch_id = Column(String(50))
    completed_at = Column(DateTime(timezone=True))
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())

    audit_logs = relationship(
        "OnboardingAuditLog",
        back_populates="session",
        cascade="all, delete-orphan",
        order_by="OnboardingAuditLog.created_at",
    )


class OnboardingAuditLog(Base):
    __tablename__ = "onboarding_audit_logs"

    id = Column(Integer, primary_key=True, index=True)
    session_id = Column(Integer, ForeignKey("onboarding_sessions.id"), nullable=False)
    event_type = Column(String(100), nullable=False)
    event_data = Column(JSON)
    actor = Column(String(200))
    ip_address = Column(String(50))
    user_agent = Column(String(500))
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    session = relationship("OnboardingSession", back_populates="audit_logs")


class ImportBatch(Base):
    __tablename__ = "import_batches"

    id = Column(Integer, primary_key=True, index=True)
    batch_id = Column(String(50), unique=True, nullable=False, index=True)
    industry_id = Column(String(100), nullable=False)
    organisation_id = Column(String(36), ForeignKey("organisations.id", ondelete="CASCADE"), index=True)
    source = Column(Enum(ImportSource), nullable=False)
    file_name = Column(String(500))
    total_rows = Column(Integer, default=0)
    success_rows = Column(Integer, default=0)
    error_rows = Column(Integer, default=0)
    errors = Column(JSON)
    created_by = Column(String(200))
    created_at = Column(DateTime(timezone=True), server_default=func.now())
