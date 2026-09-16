"""
Customer Onboarding Autopilot — data models.
"""

import enum
from datetime import datetime
from typing import Any, Optional

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
from sqlalchemy.orm import Mapped, relationship
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

    id: Mapped[int] = Column(Integer, primary_key=True, index=True)
    session_id: Mapped[str] = Column(
        String(50), unique=True, nullable=False, index=True
    )
    industry_id: Mapped[str] = Column(String(100), nullable=False)
    organisation_id: Mapped[Optional[str]] = Column(
        String(36), ForeignKey("organisations.id", ondelete="CASCADE"), index=True
    )
    customer_type: Mapped[Optional[CustomerType]] = Column(
        Enum(CustomerType, name="onboarding_customer_type"),
        default=CustomerType.individual,
    )

    applicant_name: Mapped[str] = Column(String(300), nullable=False)
    applicant_email: Mapped[str] = Column(String(300), nullable=False)
    applicant_phone: Mapped[Optional[str]] = Column(String(50))
    applicant_company: Mapped[Optional[str]] = Column(String(300))

    invite_token: Mapped[str] = Column(
        String(100), unique=True, nullable=False, index=True
    )
    invite_sent_at: Mapped[Optional[datetime]] = Column(DateTime(timezone=True))
    invite_opened_at: Mapped[Optional[datetime]] = Column(DateTime(timezone=True))
    invite_expires_at: Mapped[Optional[datetime]] = Column(DateTime(timezone=True))
    reminders_sent: Mapped[Optional[int]] = Column(Integer, default=0)
    last_reminder_at: Mapped[Optional[datetime]] = Column(DateTime(timezone=True))

    status: Mapped[Optional[SessionStatus]] = Column(
        Enum(SessionStatus), default=SessionStatus.invited
    )
    current_step: Mapped[Optional[int]] = Column(Integer, default=0)
    total_steps: Mapped[Optional[int]] = Column(Integer, default=5)
    completion_pct: Mapped[Optional[float]] = Column(Float, default=0.0)
    documents_uploaded: Mapped[Optional[int]] = Column(Integer, default=0)

    collected_data: Mapped[Optional[Any]] = Column(JSON, default=dict)

    customer_id: Mapped[Optional[str]] = Column(String(50))
    kyc_id: Mapped[Optional[str]] = Column(String(50))
    risk_score: Mapped[Optional[float]] = Column(Float)
    risk_level: Mapped[Optional[str]] = Column(String(20))
    sanctions_match: Mapped[Optional[bool]] = Column(Boolean, default=False)

    source: Mapped[Optional[ImportSource]] = Column(
        Enum(ImportSource), default=ImportSource.manual
    )
    created_by: Mapped[Optional[str]] = Column(String(200))
    batch_id: Mapped[Optional[str]] = Column(String(50))
    completed_at: Mapped[Optional[datetime]] = Column(DateTime(timezone=True))
    created_at: Mapped[Optional[datetime]] = Column(
        DateTime(timezone=True), server_default=func.now()
    )
    updated_at: Mapped[Optional[datetime]] = Column(
        DateTime(timezone=True), onupdate=func.now()
    )

    audit_logs = relationship(
        "OnboardingAuditLog",
        back_populates="session",
        cascade="all, delete-orphan",
        order_by="OnboardingAuditLog.created_at",
    )


class OnboardingAuditLog(Base):
    __tablename__ = "onboarding_audit_logs"

    id: Mapped[int] = Column(Integer, primary_key=True, index=True)
    session_id: Mapped[int] = Column(
        Integer, ForeignKey("onboarding_sessions.id"), nullable=False
    )
    event_type: Mapped[str] = Column(String(100), nullable=False)
    event_data: Mapped[Optional[Any]] = Column(JSON)
    actor: Mapped[Optional[str]] = Column(String(200))
    ip_address: Mapped[Optional[str]] = Column(String(50))
    user_agent: Mapped[Optional[str]] = Column(String(500))
    created_at: Mapped[Optional[datetime]] = Column(
        DateTime(timezone=True), server_default=func.now()
    )

    session = relationship("OnboardingSession", back_populates="audit_logs")


class ImportBatch(Base):
    __tablename__ = "import_batches"

    id: Mapped[int] = Column(Integer, primary_key=True, index=True)
    batch_id: Mapped[str] = Column(String(50), unique=True, nullable=False, index=True)
    industry_id: Mapped[str] = Column(String(100), nullable=False)
    organisation_id: Mapped[Optional[str]] = Column(
        String(36), ForeignKey("organisations.id", ondelete="CASCADE"), index=True
    )
    source: Mapped[ImportSource] = Column(Enum(ImportSource), nullable=False)
    file_name: Mapped[Optional[str]] = Column(String(500))
    total_rows: Mapped[Optional[int]] = Column(Integer, default=0)
    success_rows: Mapped[Optional[int]] = Column(Integer, default=0)
    error_rows: Mapped[Optional[int]] = Column(Integer, default=0)
    errors: Mapped[Optional[Any]] = Column(JSON)
    created_by: Mapped[Optional[str]] = Column(String(200))
    created_at: Mapped[Optional[datetime]] = Column(
        DateTime(timezone=True), server_default=func.now()
    )
