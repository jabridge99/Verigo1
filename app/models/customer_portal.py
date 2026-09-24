import enum
from datetime import datetime
from typing import Any, Optional
from uuid import uuid4

from sqlalchemy import JSON, Boolean, Column, DateTime, Enum, ForeignKey, String, func
from sqlalchemy.orm import Mapped, relationship

from app.db.database import Base


class PortalSessionStatus(str, enum.Enum):
    pending = "pending"
    in_progress = "in_progress"
    submitted = "submitted"
    expired = "expired"
    cancelled = "cancelled"


class PortalType(str, enum.Enum):
    cdd = "cdd"
    edd = "edd"
    refresh = "refresh"


class PortalDocumentStatus(str, enum.Enum):
    pending = "pending"
    uploaded = "uploaded"
    accepted = "accepted"
    rejected = "rejected"


class CustomerPortalSession(Base):
    __tablename__ = "customer_portal_sessions"

    id: Mapped[str] = Column(
        String, primary_key=True, default=lambda: f"cps_{uuid4().hex[:12]}"
    )
    token_hash: Mapped[str] = Column(
        String(64), unique=True, nullable=False, index=True
    )
    customer_id: Mapped[str] = Column(
        String,
        ForeignKey("customers.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    org_id: Mapped[str] = Column(
        String,
        ForeignKey("organisations.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    invited_by: Mapped[str] = Column(String, nullable=False)
    status: Mapped[PortalSessionStatus] = Column(
        Enum(PortalSessionStatus),
        default=PortalSessionStatus.pending,
        nullable=False,
        index=True,
    )
    portal_type: Mapped[PortalType] = Column(
        Enum(PortalType), default=PortalType.cdd, nullable=False
    )
    required_documents: Mapped[Optional[Any]] = Column(JSON, default=list)
    required_questionnaire_sections: Mapped[Optional[Any]] = Column(JSON, default=list)
    customer_email: Mapped[str] = Column(String(255), nullable=False)
    customer_name: Mapped[Optional[str]] = Column(String(255), nullable=True)
    expires_at: Mapped[datetime] = Column(DateTime(timezone=True), nullable=False)
    submitted_at: Mapped[Optional[datetime]] = Column(
        DateTime(timezone=True), nullable=True
    )
    last_activity_at: Mapped[Optional[datetime]] = Column(
        DateTime(timezone=True), nullable=True
    )
    ip_address: Mapped[Optional[str]] = Column(String(45), nullable=True)
    created_at: Mapped[Optional[datetime]] = Column(
        DateTime(timezone=True), server_default=func.now()
    )
    updated_at: Mapped[Optional[datetime]] = Column(
        DateTime(timezone=True), onupdate=func.now()
    )

    portal_documents = relationship(
        "CustomerPortalDocument", back_populates="session", cascade="all, delete-orphan"
    )
    questionnaire_responses = relationship(
        "CustomerPortalQuestionnaireResponse",
        back_populates="session",
        cascade="all, delete-orphan",
    )
    customer = relationship("Customer", foreign_keys=[customer_id])


class CustomerPortalDocument(Base):
    __tablename__ = "customer_portal_documents"

    id: Mapped[str] = Column(
        String, primary_key=True, default=lambda: f"cpd_{uuid4().hex[:12]}"
    )
    session_id: Mapped[str] = Column(
        String,
        ForeignKey("customer_portal_sessions.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    customer_id: Mapped[str] = Column(String, nullable=False)
    org_id: Mapped[str] = Column(String, nullable=False)
    document_category: Mapped[str] = Column(String(100), nullable=False)
    document_id: Mapped[Optional[str]] = Column(String, nullable=True)
    status: Mapped[PortalDocumentStatus] = Column(
        Enum(PortalDocumentStatus), default=PortalDocumentStatus.pending, nullable=False
    )
    rejection_reason: Mapped[Optional[str]] = Column(String(500), nullable=True)
    uploaded_at: Mapped[Optional[datetime]] = Column(
        DateTime(timezone=True), nullable=True
    )
    reviewed_by: Mapped[Optional[str]] = Column(String, nullable=True)
    reviewed_at: Mapped[Optional[datetime]] = Column(
        DateTime(timezone=True), nullable=True
    )
    created_at: Mapped[Optional[datetime]] = Column(
        DateTime(timezone=True), server_default=func.now()
    )

    session = relationship("CustomerPortalSession", back_populates="portal_documents")


class CustomerPortalQuestionnaireResponse(Base):
    __tablename__ = "customer_portal_questionnaire_responses"

    id: Mapped[str] = Column(
        String, primary_key=True, default=lambda: f"cpqr_{uuid4().hex[:12]}"
    )
    session_id: Mapped[str] = Column(
        String,
        ForeignKey("customer_portal_sessions.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    customer_id: Mapped[str] = Column(String, nullable=False)
    org_id: Mapped[str] = Column(String, nullable=False)
    section_key: Mapped[str] = Column(String(100), nullable=False)
    responses: Mapped[Optional[Any]] = Column(JSON, default=dict)
    completed: Mapped[Optional[bool]] = Column(Boolean, default=False)
    submitted_at: Mapped[Optional[datetime]] = Column(
        DateTime(timezone=True), nullable=True
    )
    created_at: Mapped[Optional[datetime]] = Column(
        DateTime(timezone=True), server_default=func.now()
    )
    updated_at: Mapped[Optional[datetime]] = Column(
        DateTime(timezone=True), onupdate=func.now()
    )

    session = relationship(
        "CustomerPortalSession", back_populates="questionnaire_responses"
    )
