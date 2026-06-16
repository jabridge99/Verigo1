import enum
from uuid import uuid4
from sqlalchemy import Column, String, Enum, Boolean, DateTime, ForeignKey, JSON, func
from sqlalchemy.orm import relationship
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

    id = Column(String, primary_key=True, default=lambda: f"cps_{uuid4().hex[:12]}")
    token_hash = Column(String(64), unique=True, nullable=False, index=True)
    customer_id = Column(String, ForeignKey("customers.id", ondelete="CASCADE"), nullable=False, index=True)
    org_id = Column(String, ForeignKey("organisations.id"), nullable=False, index=True)
    invited_by = Column(String, nullable=False)
    status = Column(Enum(PortalSessionStatus), default=PortalSessionStatus.pending, nullable=False, index=True)
    portal_type = Column(Enum(PortalType), default=PortalType.cdd, nullable=False)
    required_documents = Column(JSON, default=list)
    required_questionnaire_sections = Column(JSON, default=list)
    customer_email = Column(String(255), nullable=False)
    customer_name = Column(String(255), nullable=True)
    expires_at = Column(DateTime(timezone=True), nullable=False)
    submitted_at = Column(DateTime(timezone=True), nullable=True)
    last_activity_at = Column(DateTime(timezone=True), nullable=True)
    ip_address = Column(String(45), nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())

    portal_documents = relationship("CustomerPortalDocument", back_populates="session", cascade="all, delete-orphan")
    questionnaire_responses = relationship("CustomerPortalQuestionnaireResponse", back_populates="session", cascade="all, delete-orphan")
    customer = relationship("Customer", foreign_keys=[customer_id])


class CustomerPortalDocument(Base):
    __tablename__ = "customer_portal_documents"

    id = Column(String, primary_key=True, default=lambda: f"cpd_{uuid4().hex[:12]}")
    session_id = Column(String, ForeignKey("customer_portal_sessions.id", ondelete="CASCADE"), nullable=False, index=True)
    customer_id = Column(String, nullable=False)
    org_id = Column(String, nullable=False)
    document_category = Column(String(100), nullable=False)
    document_id = Column(String, nullable=True)
    status = Column(Enum(PortalDocumentStatus), default=PortalDocumentStatus.pending, nullable=False)
    rejection_reason = Column(String(500), nullable=True)
    uploaded_at = Column(DateTime(timezone=True), nullable=True)
    reviewed_by = Column(String, nullable=True)
    reviewed_at = Column(DateTime(timezone=True), nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    session = relationship("CustomerPortalSession", back_populates="portal_documents")


class CustomerPortalQuestionnaireResponse(Base):
    __tablename__ = "customer_portal_questionnaire_responses"

    id = Column(String, primary_key=True, default=lambda: f"cpqr_{uuid4().hex[:12]}")
    session_id = Column(String, ForeignKey("customer_portal_sessions.id", ondelete="CASCADE"), nullable=False, index=True)
    customer_id = Column(String, nullable=False)
    org_id = Column(String, nullable=False)
    section_key = Column(String(100), nullable=False)
    responses = Column(JSON, default=dict)
    completed = Column(Boolean, default=False)
    submitted_at = Column(DateTime(timezone=True), nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())

    session = relationship("CustomerPortalSession", back_populates="questionnaire_responses")
