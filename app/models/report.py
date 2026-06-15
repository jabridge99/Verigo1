"""
AUSTRAC Regulatory Reporting Models.

Covers:
  - IFTIReport           — International Funds Transfer Instruction
  - TTRReport            — Threshold Transaction Report (>= $10,000 AUD cash)
  - SMRReport            — Suspicious Matter Report
  - FilingRegisterEntry  — Immutable AUSTRAC submission register (append-only)

Reference format: ENTITY-REPORTTYPE-DIRECTION-YYYYMMDD-SEQUENCE
Example: PSPE-IFTI-I-20260615-0001

Statutory deadlines (AML/CTF Act 2006):
  TTR  — 10 business days (~14 calendar) from transaction date
  IFTI — 10 business days (~14 calendar) from instruction date
  SMR  — 3 business days (~4 calendar) from forming suspicion
          24 hours if terrorism-financing related

DISCLAIMER: This module stores compliance records as a tool only.
Decisions to lodge reports with AUSTRAC remain entirely with the reporting entity.
"""
import enum
from uuid import uuid4

from sqlalchemy import (
    JSON, Boolean, Column, Date, DateTime, Enum,
    Float, ForeignKey, Index, String, Text, func,
)
from sqlalchemy.orm import relationship

from app.db.database import Base


# ── Enums ─────────────────────────────────────────────────────────────────────

class ReportType(str, enum.Enum):
    ifti_incoming = "ifti_incoming"
    ifti_outgoing = "ifti_outgoing"
    ttr = "ttr"
    smr = "smr"


class ReportPriority(str, enum.Enum):
    low = "low"
    normal = "normal"
    high = "high"
    urgent = "urgent"


class ReportStatus(str, enum.Enum):
    draft = "draft"
    under_review = "under_review"
    approved = "approved"
    submitted = "submitted"
    acknowledged = "acknowledged"
    rejected = "rejected"


class IFTIDirection(str, enum.Enum):
    incoming = "incoming"
    outgoing = "outgoing"


# ── IFTI Report ───────────────────────────────────────────────────────────────

class IFTIReport(Base):
    """
    AUSTRAC International Funds Transfer Instruction.
    Due within 10 business days of receiving/sending the instruction.
    """
    __tablename__ = "ifti_reports"

    id = Column(String, primary_key=True, default=lambda: f"ifti_{uuid4().hex[:12]}")
    org_id = Column(String, ForeignKey("organisations.id", ondelete="CASCADE"),
                    nullable=False, index=True)
    customer_id = Column(String, ForeignKey("customers.id"), nullable=True, index=True)
    transaction_id = Column(String, ForeignKey("transactions.id"), nullable=True)

    report_ref = Column(String(60), unique=True, index=True)        # PSPE-IFTI-I-20260615-0001
    reference_number = Column(String(100), index=True)

    direction = Column(Enum(IFTIDirection), nullable=False, index=True)
    status = Column(Enum(ReportStatus), default=ReportStatus.draft, nullable=False, index=True)
    priority = Column(Enum(ReportPriority), default=ReportPriority.normal)

    # Core transfer
    date_received = Column(Date, nullable=False)
    date_available = Column(Date)
    total_amount = Column(Float, nullable=False)
    currency = Column(String(3), nullable=False, default="AUD")
    amount_aud = Column(Float)
    exchange_rate = Column(Float)
    transfer_type = Column(String(50), default="Money")
    transfer_reference = Column(String(100))

    # Ordering Customer (OC)
    oc_name = Column(String(255))
    oc_other_names = Column(String(255))
    oc_dob = Column(Date)
    oc_address = Column(String(500))
    oc_city = Column(String(100))
    oc_state = Column(String(50))
    oc_postcode = Column(String(10))
    oc_country = Column(String(2))
    oc_postal_address = Column(String(500))
    oc_phone = Column(String(50))
    oc_email = Column(String(255))
    oc_occupation = Column(String(255))
    oc_abn = Column(String(11))
    oc_account_number = Column(String(50))
    oc_business_structure = Column(String(50))
    oc_id1_type = Column(String(50))
    oc_id1_number = Column(String(50))
    oc_id1_country = Column(String(2))
    oc_id1_issuer = Column(String(255))
    oc_id2_type = Column(String(50))
    oc_id2_number = Column(String(50))
    oc_id2_country = Column(String(2))
    oc_id2_issuer = Column(String(255))
    oc_electronic_source = Column(String(255))

    # Beneficiary Customer (BC)
    bc_name = Column(String(255))
    bc_dob = Column(Date)
    bc_business_name = Column(String(255))
    bc_address = Column(String(500))
    bc_city = Column(String(100))
    bc_country = Column(String(2))
    bc_account_number = Column(String(50))
    bc_institution_name = Column(String(255))
    bc_institution_country = Column(String(2))
    bc_swift_bic = Column(String(11))
    bc_iban = Column(String(34))

    reason_for_transfer = Column(String(500))

    # Reporter (regulated entity)
    reporter_name = Column(String(255))
    reporter_abn = Column(String(11))
    reporter_austrac_id = Column(String(50))
    reporter_contact = Column(String(255))
    reporter_address = Column(String(500))

    supporting_documents = Column(JSON, default=list)
    due_date = Column(Date, index=True)

    # Maker-checker workflow
    prepared_by = Column(String)
    reviewed_by = Column(String)
    approved_by = Column(String)
    approved_at = Column(DateTime(timezone=True))
    submitted_by = Column(String)
    submitted_at = Column(DateTime(timezone=True))
    submission_reference = Column(String(100))
    acknowledged_at = Column(DateTime(timezone=True))
    rejected_reason = Column(Text)

    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())

    organisation = relationship("Organisation")
    customer = relationship("Customer")


# ── TTR Report ────────────────────────────────────────────────────────────────

class TTRReport(Base):
    """Threshold Transaction Report — cash >= AUD 10,000."""
    __tablename__ = "ttr_reports"

    id = Column(String, primary_key=True, default=lambda: f"ttr_{uuid4().hex[:12]}")
    org_id = Column(String, ForeignKey("organisations.id", ondelete="CASCADE"),
                    nullable=False, index=True)
    customer_id = Column(String, ForeignKey("customers.id"), nullable=True, index=True)
    transaction_id = Column(String, ForeignKey("transactions.id"), nullable=True)

    report_ref = Column(String(60), unique=True, index=True)
    status = Column(Enum(ReportStatus), default=ReportStatus.draft, nullable=False, index=True)
    priority = Column(Enum(ReportPriority), default=ReportPriority.normal)

    transaction_date = Column(Date, nullable=False)
    total_amount = Column(Float, nullable=False)
    currency = Column(String(3), default="AUD")
    transaction_type = Column(String(50))   # cash_in | cash_out | combined

    # Customer snapshot
    customer_name = Column(String(255))
    customer_dob = Column(Date)
    customer_address = Column(String(500))
    customer_occupation = Column(String(255))
    customer_id_type = Column(String(50))
    customer_id_number = Column(String(50))
    customer_abn = Column(String(11))

    # Service point
    branch_name = Column(String(255))
    branch_address = Column(String(500))
    branch_bsb = Column(String(10))
    account_name = Column(String(255))
    account_number = Column(String(50))
    account_bsb = Column(String(10))

    # Third parties
    third_party_name = Column(String(255))
    third_party_relationship = Column(String(255))

    summary = Column(Text)
    due_date = Column(Date, index=True)

    reporter_name = Column(String(255))
    reporter_abn = Column(String(11))
    reporter_austrac_id = Column(String(50))
    supporting_documents = Column(JSON, default=list)

    prepared_by = Column(String)
    reviewed_by = Column(String)
    approved_by = Column(String)
    approved_at = Column(DateTime(timezone=True))
    submitted_by = Column(String)
    submitted_at = Column(DateTime(timezone=True))
    submission_reference = Column(String(100))
    acknowledged_at = Column(DateTime(timezone=True))
    rejected_reason = Column(Text)

    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())

    organisation = relationship("Organisation")
    customer = relationship("Customer")


# ── SMR Report ────────────────────────────────────────────────────────────────

class SMRReport(Base):
    """
    Suspicious Matter Report.
    Lifecycle: draft → under_review → approved (MLRO sign-off) → submitted → acknowledged
    DISCLAIMER: The decision to lodge an SMR remains entirely with the reporting entity.
    """
    __tablename__ = "smr_reports"

    id = Column(String, primary_key=True, default=lambda: f"smr_{uuid4().hex[:12]}")
    org_id = Column(String, ForeignKey("organisations.id", ondelete="CASCADE"),
                    nullable=False, index=True)
    customer_id = Column(String, ForeignKey("customers.id"), nullable=True, index=True)
    case_id = Column(String, ForeignKey("cases.id"), nullable=True, index=True)

    report_ref = Column(String(60), unique=True, index=True)
    status = Column(Enum(ReportStatus), default=ReportStatus.draft, nullable=False, index=True)
    priority = Column(Enum(ReportPriority), default=ReportPriority.high)

    matter_date = Column(Date, nullable=False)
    suspicion_grounds = Column(Text, nullable=False)
    suspicion_categories = Column(JSON, default=list)  # proceeds_of_crime | terrorism_financing
    transaction_ids = Column(JSON, default=list)
    total_amount = Column(Float)
    currency = Column(String(3), default="AUD")

    # Subject snapshot
    subject_name = Column(String(255))
    subject_dob = Column(Date)
    subject_address = Column(String(500))
    subject_occupation = Column(String(255))
    subject_id_type = Column(String(50))
    subject_id_number = Column(String(50))
    subject_business_name = Column(String(255))
    subject_abn = Column(String(11))

    # MLRO-authored narrative
    narrative = Column(Text)
    evidence_summary = Column(Text)
    related_smr_refs = Column(JSON, default=list)
    supporting_documents = Column(JSON, default=list)

    due_date = Column(Date, index=True)
    is_terrorism_related = Column(Boolean, default=False)  # 24h deadline applies

    reporter_name = Column(String(255))
    reporter_abn = Column(String(11))
    reporter_austrac_id = Column(String(50))

    # Workflow — all fields require explicit human action
    prepared_by = Column(String)
    reviewed_by = Column(String)
    mlro_sign_off = Column(String)          # MLRO user_id
    mlro_signed_at = Column(DateTime(timezone=True))
    mlro_sign_off_notes = Column(Text)
    submitted_by = Column(String)
    submitted_at = Column(DateTime(timezone=True))
    submission_reference = Column(String(100))
    acknowledged_at = Column(DateTime(timezone=True))
    rejected_reason = Column(Text)

    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())

    organisation = relationship("Organisation")
    customer = relationship("Customer")
    case = relationship("Case")


# ── Filing Register (immutable) ────────────────────────────────────────────────

class FilingRegisterEntry(Base):
    """
    Immutable regulatory filing register — one row per AUSTRAC submission.
    This record is NEVER modified after creation.
    Corrections create a new entry with supersedes_id referencing the original.
    """
    __tablename__ = "filing_register"

    id = Column(String, primary_key=True, default=lambda: f"fil_{uuid4().hex[:12]}")
    org_id = Column(String, ForeignKey("organisations.id"), nullable=False, index=True)

    report_type = Column(Enum(ReportType), nullable=False, index=True)
    report_id = Column(String, nullable=False)                  # id of IFTIReport/TTRReport/SMRReport
    report_ref = Column(String(60), unique=True, index=True)    # PSPE-IFTI-I-20260615-0001

    austrac_submission_ref = Column(String(100))                # AUSTRAC confirmation ref
    submitted_by = Column(String, nullable=False)               # user_id
    submitted_at = Column(DateTime(timezone=True), nullable=False)

    period_start = Column(Date)
    period_end = Column(Date)
    amount_aud = Column(Float)

    status = Column(String(20), nullable=False, default="submitted")  # submitted|acknowledged|rejected
    acknowledgement_ref = Column(String(100))
    acknowledgement_at = Column(DateTime(timezone=True))
    rejected_reason = Column(Text)

    notes = Column(Text)
    supersedes_id = Column(String, ForeignKey("filing_register.id"), nullable=True)

    created_at = Column(DateTime(timezone=True), server_default=func.now(), index=True)
    # Intentionally NO updated_at — immutable record

    __table_args__ = (
        Index("ix_filing_org_type", "org_id", "report_type"),
    )
