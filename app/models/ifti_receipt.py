"""
IFTI Receipt — immutable customer-facing receipt for international funds transfers.

Issued to the customer/counterparty at the time of the IFTI instruction.
Cannot be modified after issuance. Corrections create a new receipt with
supersedes_id referencing the original.

SHA-256 audit_hash is computed over canonical JSON content fields
to support integrity verification.
"""

import enum
from datetime import date, datetime
from typing import Optional
from uuid import uuid4

from sqlalchemy import (
    Column,
    Date,
    DateTime,
    Enum,
    Float,
    ForeignKey,
    Index,
    String,
    Text,
    func,
)
from sqlalchemy.orm import Mapped, relationship

from app.db.database import Base


class ReceiptStatus(str, enum.Enum):
    active = "active"
    voided = "voided"  # replaced by a corrected receipt (supersedes chain)
    superseded = "superseded"


class IFTIReceipt(Base):
    """
    Immutable customer receipt for IFTI transactions.
    One receipt per IFTI instruction — correction creates a new row.
    """

    __tablename__ = "ifti_receipts"

    id: Mapped[str] = Column(
        String, primary_key=True, default=lambda: f"rcpt_{uuid4().hex[:12]}"
    )
    org_id: Mapped[str] = Column(
        String,
        ForeignKey("organisations.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    ifti_report_id: Mapped[Optional[str]] = Column(
        String, ForeignKey("ifti_reports.id"), nullable=True, index=True
    )
    transaction_id: Mapped[Optional[str]] = Column(
        String, ForeignKey("transactions.id"), nullable=True, index=True
    )

    receipt_ref: Mapped[Optional[str]] = Column(
        String(80), unique=True, index=True
    )  # e.g. PSPE-RCPT-20260615-0001
    version: Mapped[Optional[str]] = Column(String(10), default="1.0")
    status: Mapped[ReceiptStatus] = Column(
        Enum(ReceiptStatus), default=ReceiptStatus.active, nullable=False, index=True
    )
    supersedes_id: Mapped[Optional[str]] = Column(
        String, ForeignKey("ifti_receipts.id"), nullable=True
    )

    # Transfer core
    transfer_date: Mapped[date] = Column(Date, nullable=False)
    direction: Mapped[str] = Column(String(10), nullable=False)  # incoming | outgoing
    total_amount: Mapped[float] = Column(Float, nullable=False)
    currency: Mapped[str] = Column(String(3), nullable=False)
    amount_aud: Mapped[Optional[float]] = Column(Float)
    exchange_rate: Mapped[Optional[float]] = Column(Float)
    transfer_reference: Mapped[Optional[str]] = Column(String(100))
    transfer_type: Mapped[Optional[str]] = Column(String(50), default="Money")

    # Sender
    sender_name: Mapped[Optional[str]] = Column(String(255))
    sender_account_number: Mapped[Optional[str]] = Column(String(50))
    sender_bank_name: Mapped[Optional[str]] = Column(String(255))
    sender_bank_country: Mapped[Optional[str]] = Column(String(2))
    sender_swift_bic: Mapped[Optional[str]] = Column(String(11))
    sender_iban: Mapped[Optional[str]] = Column(String(34))
    sender_address: Mapped[Optional[str]] = Column(String(500))
    sender_country: Mapped[Optional[str]] = Column(String(2))

    # Beneficiary
    beneficiary_name: Mapped[Optional[str]] = Column(String(255))
    beneficiary_account_number: Mapped[Optional[str]] = Column(String(50))
    beneficiary_bank_name: Mapped[Optional[str]] = Column(String(255))
    beneficiary_bank_country: Mapped[Optional[str]] = Column(String(2))
    beneficiary_swift_bic: Mapped[Optional[str]] = Column(String(11))
    beneficiary_iban: Mapped[Optional[str]] = Column(String(34))
    beneficiary_address: Mapped[Optional[str]] = Column(String(500))
    beneficiary_country: Mapped[Optional[str]] = Column(String(2))

    # Processing entity (the regulated reporting entity)
    processor_name: Mapped[Optional[str]] = Column(String(255))
    processor_abn: Mapped[Optional[str]] = Column(String(11))
    processor_austrac_id: Mapped[Optional[str]] = Column(String(50))
    processor_address: Mapped[Optional[str]] = Column(String(500))
    processor_contact: Mapped[Optional[str]] = Column(String(255))

    # Regulatory disclosures on receipt
    compliance_footer: Mapped[Optional[str]] = Column(Text)
    risk_disclaimer: Mapped[Optional[str]] = Column(Text)

    # Integrity
    audit_hash: Mapped[Optional[str]] = Column(
        String(64)
    )  # SHA-256 hex digest of canonical content
    generated_by: Mapped[Optional[str]] = Column(String)  # user_id
    pdf_storage_ref: Mapped[Optional[str]] = Column(
        String(500)
    )  # cloud storage key for PDF

    created_at: Mapped[Optional[datetime]] = Column(
        DateTime(timezone=True), server_default=func.now(), index=True
    )
    voided_at: Mapped[Optional[datetime]] = Column(DateTime(timezone=True))
    voided_by: Mapped[Optional[str]] = Column(String)
    void_reason: Mapped[Optional[str]] = Column(Text)
    # Intentionally NO updated_at — immutable record

    organisation = relationship("Organisation")
    superseded_by = relationship(
        "IFTIReceipt", foreign_keys=[supersedes_id], remote_side="IFTIReceipt.id"
    )

    __table_args__ = (Index("ix_ifti_receipt_org_date", "org_id", "transfer_date"),)
