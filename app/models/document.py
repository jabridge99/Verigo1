import enum
from datetime import date, datetime
from typing import Optional

from sqlalchemy import (
    BigInteger,
    Boolean,
    Column,
    Date,
    DateTime,
    Enum,
    ForeignKey,
    Integer,
    String,
    Text,
)
from sqlalchemy.orm import Mapped
from sqlalchemy.sql import func

from app.db.database import Base


class DocumentCategory(str, enum.Enum):
    kyc = "kyc"  # ID documents, proof of address
    aml = "aml"  # AML assessment records
    report = "report"  # AUSTRAC report attachments
    case = "case"  # MLRO case evidence
    ecdd = "ecdd"  # Enhanced due diligence
    contract = "contract"  # Customer agreements
    policy = "policy"  # Internal compliance policies
    correspondence = "correspondence"  # Regulator correspondence
    trust_deed = "trust_deed"  # Trust deeds
    asic_extract = "asic_extract"  # ASIC company extracts
    company_document = "company_document"  # Company constitutions, share registers
    sof_document = "sof_document"  # Source of Funds supporting docs
    sow_document = "sow_document"  # Source of Wealth supporting docs
    rfi_response = "rfi_response"  # Customer response to Request for Information
    other = "other"


class DocumentStatus(str, enum.Enum):
    active = "active"
    archived = "archived"
    deleted = "deleted"


# Retention category codes — maps to minimum statutory retention periods
RETENTION_CATEGORIES = {
    "aml_7year": 7 * 365,  # AML/CTF Act — transaction records 7 years
    "kyc_5year": 5 * 365,  # KYC records — 5 years after relationship ends
    "smr_7year": 7 * 365,  # SMR-related records — 7 years
    "ttr_7year": 7 * 365,  # TTR records — 7 years
    "ifti_7year": 7 * 365,  # IFTI records — 7 years
    "general_1year": 1 * 365,  # General operational records
    "policy_3year": 3 * 365,  # Policy documents
}


class Document(Base):
    __tablename__ = "documents"

    id: Mapped[int] = Column(Integer, primary_key=True, index=True)
    doc_id: Mapped[str] = Column(String(60), unique=True, index=True, nullable=False)
    filename: Mapped[str] = Column(String(500), nullable=False)  # original filename
    stored_name: Mapped[str] = Column(
        String(500), nullable=False
    )  # UUID-based stored path
    mime_type: Mapped[Optional[str]] = Column(String(200))
    size_bytes: Mapped[Optional[int]] = Column(BigInteger, default=0)
    category: Mapped[Optional[DocumentCategory]] = Column(
        Enum(DocumentCategory), default=DocumentCategory.other
    )
    description: Mapped[Optional[str]] = Column(Text)

    # ── Integrity ──────────────────────────────────────────────────────────────
    sha256_hash: Mapped[Optional[str]] = Column(
        String(64), index=True
    )  # server-computed; never trusted from client

    # ── Versioning ─────────────────────────────────────────────────────────────
    version: Mapped[int] = Column(Integer, default=1, nullable=False)
    previous_version_id: Mapped[Optional[int]] = Column(
        Integer, ForeignKey("documents.id"), nullable=True
    )

    # ── Legal hold ─────────────────────────────────────────────────────────────
    # When legal_hold=True, deletion and archival are blocked (409 returned)
    legal_hold: Mapped[bool] = Column(Boolean, default=False, nullable=False)
    legal_hold_reason: Mapped[Optional[str]] = Column(Text)
    legal_hold_by: Mapped[Optional[str]] = Column(
        String(60)
    )  # user_id who placed the hold
    legal_hold_at: Mapped[Optional[datetime]] = Column(DateTime(timezone=True))

    # ── Retention ──────────────────────────────────────────────────────────────
    retention_days: Mapped[Optional[int]] = Column(
        Integer, nullable=True
    )  # null = keep forever
    retention_category: Mapped[Optional[str]] = Column(
        String(50), nullable=True
    )  # e.g. "aml_7year"
    expires_at: Mapped[Optional[date]] = Column(
        Date, nullable=True
    )  # auto-archive date

    # ── Entity association (polymorphic) ───────────────────────────────────────
    entity_type: Mapped[Optional[str]] = Column(
        String(50)
    )  # customer | kyc | report | case
    entity_id: Mapped[Optional[str]] = Column(String(100))

    # ── Ownership ──────────────────────────────────────────────────────────────
    uploaded_by: Mapped[str] = Column(String(60), nullable=False)  # user_id
    industry_id: Mapped[Optional[str]] = Column(String(100))
    organisation_id: Mapped[Optional[str]] = Column(
        String, ForeignKey("organisations.id", ondelete="CASCADE"), index=True
    )

    status: Mapped[Optional[DocumentStatus]] = Column(
        Enum(DocumentStatus), default=DocumentStatus.active
    )
    created_at: Mapped[Optional[datetime]] = Column(
        DateTime(timezone=True), server_default=func.now()
    )
    updated_at: Mapped[Optional[datetime]] = Column(
        DateTime(timezone=True), onupdate=func.now()
    )
