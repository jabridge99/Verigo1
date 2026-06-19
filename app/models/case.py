"""
Case Management — bank-grade AML/CTF investigation workflow.

Case lifecycle:
  open → under_investigation → additional_information → escalated → decision → closed

SMR workflow (within case):
  is_smr_candidate → smr_considered → smr_lodged (entity's decision, not ours)

Design rules:
  - Case ↔ Alert: many-to-many via CaseAlert
  - CaseNote: append-only (never edited), with note_type and evidence
  - CaseEvidence: structured evidence management with document type
  - SMR fields: platform provides workflow support, entity makes the decision
  - All SMR fields require explicit human action — never auto-set

DISCLAIMER: The platform provides case management tooling only.
Decisions to lodge Suspicious Matter Reports, refer matters to law enforcement,
or take other action remain entirely with the reporting entity.
"""

import enum
from uuid import uuid4

from sqlalchemy import (
    JSON,
    Boolean,
    Column,
    Date,
    DateTime,
    Enum,
    ForeignKey,
    Integer,
    String,
    Text,
    func,
)
from sqlalchemy.orm import relationship

from app.db.database import Base

# ── Enums ─────────────────────────────────────────────────────────────────────


class CaseType(str, enum.Enum):
    smr_candidate = "smr_candidate"
    internal_investigation = "internal_investigation"
    edd_review = "edd_review"
    regulatory_inquiry = "regulatory_inquiry"
    law_enforcement_request = "law_enforcement_request"
    customer_exit = "customer_exit"
    tipping_off_risk = "tipping_off_risk"
    periodic_review = "periodic_review"
    other = "other"


class CaseStatus(str, enum.Enum):
    open = "open"
    under_investigation = "under_investigation"
    additional_information = "additional_information"  # RFI issued
    escalated = "escalated"  # sent to MLRO/Board
    decision = "decision"  # awaiting final decision
    closed_no_action = "closed_no_action"
    closed_smr_filed = "closed_smr_filed"
    closed_referred = "closed_referred"  # referred to law enforcement
    closed_exited = "closed_exited"  # customer relationship ended
    closed_no_smr = "closed_no_smr"  # considered but decided not to file


class CaseSeverity(str, enum.Enum):
    low = "low"
    medium = "medium"
    high = "high"
    critical = "critical"


class CaseOutcome(str, enum.Enum):
    no_suspicious_activity = "no_suspicious_activity"
    smr_filed = "smr_filed"
    referred_law_enforcement = "referred_law_enforcement"
    customer_exited = "customer_exited"
    controls_enhanced = "controls_enhanced"
    edd_completed = "edd_completed"
    no_action_required = "no_action_required"
    other = "other"


class NoteType(str, enum.Enum):
    investigation_note = "investigation_note"
    evidence_summary = "evidence_summary"
    escalation_note = "escalation_note"
    mlro_decision = "mlro_decision"
    legal_advice = "legal_advice"
    customer_contact = "customer_contact"
    third_party_information = "third_party_information"
    smr_consideration = "smr_consideration"
    closure_note = "closure_note"
    general = "general"


class EvidenceType(str, enum.Enum):
    identity_document = "identity_document"
    source_of_funds = "source_of_funds"
    source_of_wealth = "source_of_wealth"
    bank_statement = "bank_statement"
    transaction_record = "transaction_record"
    wallet_analysis_report = "wallet_analysis_report"
    adverse_media_report = "adverse_media_report"
    screening_report = "screening_report"
    contract = "contract"
    property_purchase_document = "property_purchase_document"
    corporate_document = "corporate_document"
    third_party_report = "third_party_report"
    austrac_correspondence = "austrac_correspondence"
    law_enforcement_request = "law_enforcement_request"
    correspondence = "correspondence"
    trust_deed = "trust_deed"
    asic_extract = "asic_extract"
    company_constitution = "company_constitution"
    share_register = "share_register"
    beneficial_ownership_declaration = "beneficial_ownership_declaration"
    rfi_response = "rfi_response"
    interview_transcript = "interview_transcript"
    other = "other"


# ── Case ──────────────────────────────────────────────────────────────────────


class Case(Base):
    __tablename__ = "cases"

    id = Column(String, primary_key=True, default=lambda: f"case_{uuid4().hex[:12]}")
    case_ref = Column(String(30), unique=True, nullable=False, index=True)
    org_id = Column(
        String,
        ForeignKey("organisations.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    customer_id = Column(String, ForeignKey("customers.id"), nullable=True, index=True)

    # ── Classification ────────────────────────────────────────────────────────
    case_type = Column(
        Enum(CaseType), nullable=False, default=CaseType.internal_investigation
    )
    severity = Column(
        Enum(CaseSeverity), nullable=False, default=CaseSeverity.medium, index=True
    )
    status = Column(
        Enum(CaseStatus), default=CaseStatus.open, nullable=False, index=True
    )

    title = Column(String(500), nullable=False)
    description = Column(Text)

    # ── Assignment ────────────────────────────────────────────────────────────
    assigned_to = Column(String)  # user_id
    assigned_at = Column(DateTime(timezone=True))
    assigned_by = Column(String)
    escalated_to = Column(String)  # user_id (MLRO)
    escalated_at = Column(DateTime(timezone=True))
    escalation_reason = Column(Text)

    # ── SLA ───────────────────────────────────────────────────────────────────
    due_date = Column(Date, index=True)
    is_overdue = Column(Boolean, default=False)

    # ── SMR Workflow ──────────────────────────────────────────────────────────
    # All SMR fields require explicit human action — never auto-set
    is_smr_candidate = Column(Boolean, default=False, index=True)
    smr_considered = Column(Boolean, default=False)  # MLRO has reviewed for SMR
    smr_considered_by = Column(String)
    smr_considered_at = Column(DateTime(timezone=True))
    smr_lodged = Column(Boolean, default=False)
    smr_lodged_at = Column(DateTime(timezone=True))
    smr_lodged_by = Column(String)
    smr_reference = Column(String(100))  # AUSTRAC SMR confirmation reference
    smr_notes = Column(Text)  # MLRO reasoning (confidential)
    tipping_off_risk = Column(Boolean, default=False)  # do not contact customer

    # ── Linked entities ───────────────────────────────────────────────────────
    linked_customer_ids = Column(JSON, default=list)  # for group/related customer cases
    related_case_ids = Column(JSON, default=list)  # for linked cases

    # ── Outcome ───────────────────────────────────────────────────────────────
    outcome = Column(Enum(CaseOutcome))
    outcome_notes = Column(Text)
    closed_by = Column(String)
    closed_at = Column(DateTime(timezone=True))
    closure_reason = Column(Text)

    created_by = Column(String, nullable=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())

    # ── Relationships ─────────────────────────────────────────────────────────
    organisation = relationship("Organisation", back_populates="cases")
    customer = relationship("Customer", back_populates="cases")
    notes = relationship(
        "CaseNote",
        back_populates="case",
        cascade="all, delete-orphan",
        order_by="CaseNote.created_at",
    )
    evidence = relationship(
        "CaseEvidence", back_populates="case", cascade="all, delete-orphan"
    )
    alert_links = relationship(
        "CaseAlert", back_populates="case", cascade="all, delete-orphan"
    )


# ── Case ↔ Alert (M2M) ────────────────────────────────────────────────────────


class CaseAlert(Base):
    """
    Many-to-many between Cases and Alerts.
    Also links to the specific Transaction for traceability.
    """

    __tablename__ = "case_alerts"

    id = Column(String, primary_key=True, default=lambda: f"ca_{uuid4().hex[:10]}")
    case_id = Column(
        String, ForeignKey("cases.id", ondelete="CASCADE"), nullable=False, index=True
    )
    alert_id = Column(
        String, ForeignKey("transaction_alerts.id"), nullable=False, index=True
    )
    transaction_id = Column(String, ForeignKey("transactions.id"), nullable=True)
    org_id = Column(String, nullable=False)
    added_by = Column(String)
    added_at = Column(DateTime(timezone=True), server_default=func.now())
    notes = Column(Text)

    case = relationship("Case", back_populates="alert_links")
    alert = relationship("TransactionAlert", back_populates="case_links")
    transaction = relationship("Transaction", back_populates="case_links")


# ── Case Note (append-only) ────────────────────────────────────────────────────


class CaseNote(Base):
    """
    Append-only investigation notes.
    Cannot be edited after creation (tipping-off and evidence integrity).
    """

    __tablename__ = "case_notes"

    id = Column(String, primary_key=True, default=lambda: f"cn_{uuid4().hex[:12]}")
    case_id = Column(
        String, ForeignKey("cases.id", ondelete="CASCADE"), nullable=False, index=True
    )
    org_id = Column(String, nullable=False)

    note_type = Column(
        Enum(NoteType), default=NoteType.investigation_note, nullable=False
    )
    content = Column(Text, nullable=False)
    is_confidential = Column(
        Boolean, default=False
    )  # MLRO-only (tipping-off protection)
    is_legal_privilege = Column(Boolean, default=False)  # legal professional privilege
    workflow_stage = Column(
        String(100)
    )  # e.g. "evidence_review", "compliance_approval", "mlro_review"

    author_id = Column(String, nullable=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    case = relationship("Case", back_populates="notes")


# ── Case Evidence ──────────────────────────────────────────────────────────────


class CaseEvidence(Base):
    """Structured evidence management for case files."""

    __tablename__ = "case_evidence"

    id = Column(String, primary_key=True, default=lambda: f"cev_{uuid4().hex[:10]}")
    case_id = Column(
        String, ForeignKey("cases.id", ondelete="CASCADE"), nullable=False, index=True
    )
    org_id = Column(String, nullable=False)

    evidence_type = Column(Enum(EvidenceType), nullable=False)
    document_ref = Column(String(500), nullable=False)  # cloud storage key
    file_name = Column(String(500))
    description = Column(String(1000))

    source = Column(String(255))  # who provided this evidence
    received_date = Column(Date)
    is_verified = Column(Boolean, default=False)
    verified_by = Column(String)
    verified_at = Column(DateTime(timezone=True))

    # ── Integrity & versioning ─────────────────────────────────────────────────
    sha256_hash = Column(String(64))  # content hash; server-computed
    version = Column(Integer, default=1)
    previous_version_id = Column(String, nullable=True)  # id of prior version

    # ── Legal hold ─────────────────────────────────────────────────────────────
    legal_hold = Column(Boolean, default=False)
    retention_category = Column(String(50))  # e.g. "aml_7year"

    uploaded_by = Column(String, nullable=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    case = relationship("Case", back_populates="evidence")
