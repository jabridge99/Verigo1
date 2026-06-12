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
    Text,
)
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func

from app.db.database import Base


class ReportType(str, enum.Enum):
    ttr   = "ttr"    # Threshold Transaction Report (≥ AUD $10,000 cash)
    ifti_in  = "ifti_in"   # International Funds Transfer Instruction — inbound
    ifti_out = "ifti_out"  # International Funds Transfer Instruction — outbound
    smr   = "smr"    # Suspicious Matter Report
    sar   = "sar"    # Suspicious Activity Report (legacy alias)
    ctr   = "ctr"    # Currency Transaction Report (legacy)
    ecdd  = "ecdd"   # Enhanced Customer Due Diligence summary


class ReportStatus(str, enum.Enum):
    draft        = "draft"
    under_review = "under_review"
    approved     = "approved"
    submitted    = "submitted"
    acknowledged = "acknowledged"
    rejected     = "rejected"


class ReportPriority(str, enum.Enum):
    low    = "low"
    medium = "medium"
    high   = "high"
    urgent = "urgent"


class ComplianceReport(Base):
    __tablename__ = "compliance_reports"

    id                    = Column(Integer, primary_key=True, index=True)
    report_id             = Column(String(50), unique=True, index=True, nullable=False)
    industry_id           = Column(String(100))
    customer_id           = Column(Integer, ForeignKey("customers.id"), nullable=False)
    report_type           = Column(Enum(ReportType), nullable=False)
    status                = Column(Enum(ReportStatus), default=ReportStatus.draft)
    priority              = Column(Enum(ReportPriority), default=ReportPriority.medium)
    title                 = Column(String(500), nullable=False)
    summary               = Column(Text, nullable=False)
    findings              = Column(Text)
    narrative             = Column(Text)          # MLRO narrative for SMR/SAR
    risk_level            = Column(String(20))
    total_amount_flagged  = Column(Float, default=0.0)
    transaction_count     = Column(Integer, default=0)
    transaction_ids       = Column(JSON)          # list of transaction_id strings
    alert_ids             = Column(JSON)          # linked alert_ids
    # AUSTRAC-specific fields
    austrac_report_type   = Column(String(50))    # AUSTRAC form code e.g. TTR, IFTI-E, IFTI-I, SMR
    reporting_entity      = Column(String(300))
    reporting_entity_abn  = Column(String(20))
    due_date              = Column(DateTime(timezone=True))  # statutory deadline
    days_remaining        = Column(Integer)
    # Workflow
    prepared_by           = Column(String(100))
    reviewed_by           = Column(String(100))
    approved_by           = Column(String(100))
    mlro_sign_off         = Column(Boolean, default=False)
    submitted_to          = Column(String(200))
    submission_reference  = Column(String(100))
    created_at            = Column(DateTime(timezone=True), server_default=func.now())
    updated_at            = Column(DateTime(timezone=True), onupdate=func.now())
    submitted_at          = Column(DateTime(timezone=True))
    acknowledged_at       = Column(DateTime(timezone=True))

    customer = relationship("Customer", back_populates="reports")


class ECDDRecord(Base):
    __tablename__ = "ecdd_records"

    id                        = Column(Integer, primary_key=True, index=True)
    ecdd_id                   = Column(String(50), unique=True, index=True, nullable=False)
    customer_id               = Column(Integer, ForeignKey("customers.id"), nullable=False)
    industry_id               = Column(String(100))
    trigger_reason            = Column(Text, nullable=False)
    pep_status                = Column(Integer, default=0)
    adverse_media_found       = Column(Integer, default=0)
    adverse_media_details     = Column(Text)
    beneficial_owner_verified = Column(Integer, default=0)
    beneficial_owner_details  = Column(Text)
    source_of_wealth_verified = Column(Integer, default=0)
    source_of_wealth_details  = Column(Text)
    enhanced_risk_score       = Column(Float, default=0.0)
    recommendation            = Column(String(50))
    analyst_notes             = Column(Text)
    status                    = Column(String(50), default="pending")
    created_at                = Column(DateTime(timezone=True), server_default=func.now())
    completed_at              = Column(DateTime(timezone=True))

    customer = relationship("Customer", back_populates="ecdd_records")
