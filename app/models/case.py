import enum
from uuid import uuid4
from sqlalchemy import Column, String, Enum, DateTime, Text, JSON, Boolean, ForeignKey, func
from sqlalchemy.orm import relationship
from app.db.database import Base


class CaseSeverity(str, enum.Enum):
    low = "low"
    medium = "medium"
    high = "high"
    critical = "critical"


class CaseStatus(str, enum.Enum):
    open = "open"
    under_investigation = "under_investigation"
    pending_review = "pending_review"
    escalated = "escalated"
    closed_no_action = "closed_no_action"
    closed_reported = "closed_reported"
    closed_referred = "closed_referred"


class Case(Base):
    __tablename__ = "cases"

    id = Column(String, primary_key=True, default=lambda: f"case_{uuid4().hex[:12]}")
    org_id = Column(String, ForeignKey("organisations.id", ondelete="CASCADE"), nullable=False, index=True)
    customer_id = Column(String, ForeignKey("customers.id"), nullable=True, index=True)

    case_number = Column(String(50), unique=True)
    title = Column(String(500), nullable=False)
    description = Column(Text)
    severity = Column(Enum(CaseSeverity), nullable=False, default=CaseSeverity.medium)
    status = Column(Enum(CaseStatus), default=CaseStatus.open, nullable=False)

    assigned_to = Column(String)
    assigned_at = Column(DateTime(timezone=True))
    escalated_to = Column(String)
    escalated_at = Column(DateTime(timezone=True))
    escalation_reason = Column(Text)

    closed_by = Column(String)
    closed_at = Column(DateTime(timezone=True))
    closure_reason = Column(Text)

    related_transaction_ids = Column(JSON, default=list)
    related_report_ids = Column(JSON, default=list)

    created_by = Column(String, nullable=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())

    organisation = relationship("Organisation", back_populates="cases")
    customer = relationship("Customer", back_populates="cases")
    alerts = relationship("TransactionAlert", back_populates="case")
    notes = relationship("CaseNote", back_populates="case", cascade="all, delete-orphan")


class CaseNote(Base):
    __tablename__ = "case_notes"

    id = Column(String, primary_key=True, default=lambda: f"cn_{uuid4().hex[:12]}")
    case_id = Column(String, ForeignKey("cases.id", ondelete="CASCADE"), nullable=False, index=True)
    author_id = Column(String, nullable=False)
    content = Column(Text, nullable=False)
    is_internal = Column(Boolean, default=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    case = relationship("Case", back_populates="notes")
