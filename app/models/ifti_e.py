"""
IFTI-E (International Funds Transfer Instruction — E-currency / SWIFT) model.

Covers AUSTRAC IFTI-E v1.3 schema (IFTI-E-1-3.xsd).
Namespace: http://austrac.gov.au/schema/reporting/IFTI-E-1-3

IFTI-E is used for electronic funds transfers (SWIFT, RTGS, internet banking)
as opposed to IFTI-DRA which covers domestic recipient agents (remittance).

Two submission modes:
  swift      — raw SWIFT message attached (swiftMsg field); minimal structured data required
  structured — full party breakdown; no raw SWIFT message

Party mapping (XML → model prefix):
  payer            → payer_*   (ordering customer / sending party)
  payerInstn       → payer_instn_*  (payer's financial institution)
  correspondentInstn → corr_*  (correspondent/intermediary bank, 0..*)
  payeeInstn       → payee_instn_* (payee's financial institution)
  payee            → payee_*   (beneficiary customer)

Key IFTI-E-specific elements:
  payer.sameAsSwiftOrdCust   — YesNo flag (swift mode only)
  detailsOfPayment           — free-text payment purpose (140 chars)
  senderToReceiverInfo       — bank-to-bank instructions (6 × 35 chars)
  InstitutionBrief.code      — SWIFT BIC / routing code
  correspondent banks        — stored as JSON array (0..*)

Statutory deadline: 10 business days from receiving/sending the instruction.
"""

import enum
from datetime import date, datetime
from typing import Any, Optional

from sqlalchemy import JSON, Column, Date, DateTime, Float, Integer, String, Text
from sqlalchemy import Enum as SAEnum
from sqlalchemy.orm import Mapped
from sqlalchemy.sql import func

from app.db.database import Base


class IFTIEDirection(str, enum.Enum):
    incoming = "incoming"  # Money arriving in Australia
    outgoing = "outgoing"  # Money leaving Australia


class IFTIEMode(str, enum.Enum):
    swift = "swift"  # Raw SWIFT message supplied
    structured = "structured"  # Full structured party breakdown


class IFTIEStatus(str, enum.Enum):
    draft = "draft"
    ready = "ready"
    submitted = "submitted"


class IFTIERecord(Base):
    """
    AUSTRAC IFTI-E v1.3 record.
    One row per electronic funds transfer instruction >= AUD 10,000.
    """

    __tablename__ = "ifti_e_records"

    id: Mapped[int] = Column(Integer, primary_key=True, index=True)
    ifti_e_id: Mapped[str] = Column(String(60), unique=True, index=True, nullable=False)
    industry_id: Mapped[Optional[str]] = Column(String(60), index=True)

    direction: Mapped[IFTIEDirection] = Column(
        SAEnum(IFTIEDirection), nullable=False, index=True
    )
    mode: Mapped[IFTIEMode] = Column(
        SAEnum(IFTIEMode), nullable=False, default=IFTIEMode.structured
    )
    status: Mapped[Optional[IFTIEStatus]] = Column(
        SAEnum(IFTIEStatus), default=IFTIEStatus.draft
    )

    # ── Transaction details ───────────────────────────────────────────────────
    date_received: Mapped[date] = Column(
        Date, nullable=False
    )  # Date instruction received/sent
    date_available: Mapped[date] = Column(
        Date, nullable=False
    )  # Date funds made available
    currency_code: Mapped[Optional[str]] = Column(String(3), default="AUD")
    total_amount: Mapped[float] = Column(Float, nullable=False)
    transaction_reference: Mapped[Optional[str]] = Column(String(100))

    # Payment purpose / bank instructions (IFTI-E specific)
    details_of_payment: Mapped[Optional[str]] = Column(
        String(140)
    )  # detailsOfPayment — free text
    sender_to_receiver_info: Mapped[Optional[str]] = Column(
        Text
    )  # senderToReceiverInfo (6×35 char lines)

    # ── Swift mode ────────────────────────────────────────────────────────────
    # Only populated when mode == "swift"
    swift_msg: Mapped[Optional[str]] = Column(Text)  # Raw SWIFT message text

    # ── Payer (ordering customer / sending party) ─────────────────────────────
    payer_same_as_swift_ord_cust: Mapped[Optional[str]] = Column(
        String(3)
    )  # YesNo — swift mode only
    payer_full_name: Mapped[Optional[str]] = Column(String(200))
    payer_other_name: Mapped[Optional[str]] = Column(String(200))
    payer_dob: Mapped[Optional[date]] = Column(Date)
    payer_address: Mapped[Optional[str]] = Column(String(300))
    payer_city: Mapped[Optional[str]] = Column(String(100))
    payer_state: Mapped[Optional[str]] = Column(String(50))
    payer_postcode: Mapped[Optional[str]] = Column(String(20))
    payer_country: Mapped[Optional[str]] = Column(String(100))
    payer_postal_address: Mapped[Optional[str]] = Column(String(300))
    payer_postal_city: Mapped[Optional[str]] = Column(String(100))
    payer_postal_state: Mapped[Optional[str]] = Column(String(50))
    payer_postal_postcode: Mapped[Optional[str]] = Column(String(20))
    payer_postal_country: Mapped[Optional[str]] = Column(String(100))
    payer_phone: Mapped[Optional[str]] = Column(String(50))
    payer_email: Mapped[Optional[str]] = Column(String(200))
    payer_occupation: Mapped[Optional[str]] = Column(String(200))
    payer_abn: Mapped[Optional[str]] = Column(String(50))
    payer_acn: Mapped[Optional[str]] = Column(String(9))
    payer_arbn: Mapped[Optional[str]] = Column(String(9))
    payer_account_number: Mapped[Optional[str]] = Column(String(100))
    payer_business_structure: Mapped[Optional[str]] = Column(String(100))
    # Payer ID documents
    payer_id1_type: Mapped[Optional[str]] = Column(String(100))
    payer_id1_number: Mapped[Optional[str]] = Column(String(100))
    payer_id1_issuer: Mapped[Optional[str]] = Column(String(200))
    payer_id2_type: Mapped[Optional[str]] = Column(String(100))
    payer_id2_number: Mapped[Optional[str]] = Column(String(100))
    payer_id2_issuer: Mapped[Optional[str]] = Column(String(200))
    payer_electronic_source: Mapped[Optional[str]] = Column(String(200))

    # ── Payer's financial institution ─────────────────────────────────────────
    payer_instn_name: Mapped[Optional[str]] = Column(
        String(200)
    )  # InstitutionBrief.name
    payer_instn_code: Mapped[Optional[str]] = Column(
        String(11)
    )  # InstitutionBrief.code — SWIFT BIC
    payer_instn_address: Mapped[Optional[str]] = Column(String(300))
    payer_instn_city: Mapped[Optional[str]] = Column(String(100))
    payer_instn_country: Mapped[Optional[str]] = Column(String(100))

    # ── Correspondent / intermediary banks (0..*) ────────────────────────────
    # Stored as JSON array: [{name, code, address, city, country}, ...]
    # code = SWIFT BIC or routing number
    correspondent_instns: Mapped[Optional[Any]] = Column(JSON, default=list)

    # ── Payee's financial institution ─────────────────────────────────────────
    payee_instn_name: Mapped[Optional[str]] = Column(
        String(200)
    )  # InstitutionBrief.name (MANDATORY)
    payee_instn_code: Mapped[Optional[str]] = Column(
        String(11)
    )  # InstitutionBrief.code — SWIFT BIC
    payee_instn_address: Mapped[Optional[str]] = Column(String(300))
    payee_instn_city: Mapped[Optional[str]] = Column(String(100))
    payee_instn_country: Mapped[Optional[str]] = Column(String(100))  # MANDATORY

    # ── Payee (beneficiary customer) ──────────────────────────────────────────
    payee_full_name: Mapped[Optional[str]] = Column(String(200))
    payee_dob: Mapped[Optional[date]] = Column(Date)
    payee_business_name: Mapped[Optional[str]] = Column(String(200))
    payee_address: Mapped[Optional[str]] = Column(String(300))
    payee_city: Mapped[Optional[str]] = Column(String(100))
    payee_state: Mapped[Optional[str]] = Column(String(50))
    payee_postcode: Mapped[Optional[str]] = Column(String(20))
    payee_country: Mapped[Optional[str]] = Column(String(100))
    payee_phone: Mapped[Optional[str]] = Column(String(50))
    payee_email: Mapped[Optional[str]] = Column(String(200))
    payee_occupation: Mapped[Optional[str]] = Column(String(200))
    payee_abn: Mapped[Optional[str]] = Column(String(50))
    payee_acn: Mapped[Optional[str]] = Column(String(9))
    payee_arbn: Mapped[Optional[str]] = Column(String(9))
    payee_account_number: Mapped[Optional[str]] = Column(String(100))
    payee_account_iban: Mapped[Optional[str]] = Column(
        String(34)
    )  # IBAN (international accounts)
    payee_business_structure: Mapped[Optional[str]] = Column(String(100))

    # ── Reporter ──────────────────────────────────────────────────────────────
    reporter_full_name: Mapped[Optional[str]] = Column(String(200))
    reporter_job_title: Mapped[Optional[str]] = Column(String(200))
    reporter_phone: Mapped[Optional[str]] = Column(String(50))
    reporter_email: Mapped[Optional[str]] = Column(String(200))

    # ── Audit ─────────────────────────────────────────────────────────────────
    created_by: Mapped[Optional[str]] = Column(String(60))
    submitted_at: Mapped[Optional[datetime]] = Column(DateTime(timezone=True))
    created_at: Mapped[Optional[datetime]] = Column(
        DateTime(timezone=True), server_default=func.now()
    )
    updated_at: Mapped[Optional[datetime]] = Column(
        DateTime(timezone=True), onupdate=func.now()
    )
