"""
IFTI (International Funds Transfer Instruction) Record model.

Covers AUSTRAC IFTI-DRA v1.2 (Domestic Recipient Agent) IN and OUT.
IFTI-E v1.3 (E-currency / SWIFT) requires a separate model — see IFTI-E phase.

IFTI-DRA XML schema: IFTI-DRA-1-2.xsd
Namespace: http://austrac.gov.au/schema/reporting/IFTI-DRA-1-2
Statutory deadline: 10 business days from receiving/sending the instruction.

Party terminology (IFTI-DRA):
  transferor      = ordering customer (oc_*) — the sender
  orderingInstn   = institution accepting the instruction (accept_*) — mandatory foreignBased flag
  initiatingInstn = intermediate institution (optional, not currently stored)
  sendingInstn    = institution sending the instruction (send_*)
  receivingInstn  = institution receiving the instruction (recv_*)
  beneficiaryInstn = institution distributing to beneficiary (dist_*)
  beneficiaryBranch = branch of beneficiary institution (optional, not stored)
  transferee      = beneficiary customer (bc_*) — the recipient
"""

import enum
from datetime import date, datetime
from typing import Optional

from sqlalchemy import Column, Date, DateTime, Float, ForeignKey, Integer, String
from sqlalchemy import Enum as SAEnum
from sqlalchemy.orm import Mapped
from sqlalchemy.sql import func

from app.db.database import Base


class IFTIDirection(str, enum.Enum):
    incoming = "incoming"  # IFTI-DRA IN  — money arriving in Australia
    outgoing = "outgoing"  # IFTI-DRA OUT — money leaving Australia


class IFTIStatus(str, enum.Enum):
    draft = "draft"
    under_review = "under_review"
    approved = "approved"
    submitted = "submitted"
    acknowledged = "acknowledged"
    rejected = "rejected"


class IFTIRecord(Base):
    __tablename__ = "ifti_records"

    id: Mapped[int] = Column(Integer, primary_key=True, index=True)
    ifti_id: Mapped[str] = Column(String(60), unique=True, index=True, nullable=False)
    industry_id: Mapped[Optional[str]] = Column(String(60), index=True)
    organisation_id: Mapped[Optional[str]] = Column(
        String(36), ForeignKey("organisations.id", ondelete="CASCADE"), index=True
    )
    direction: Mapped[IFTIDirection] = Column(
        SAEnum(IFTIDirection), nullable=False, index=True
    )
    status: Mapped[Optional[IFTIStatus]] = Column(
        SAEnum(IFTIStatus), default=IFTIStatus.draft
    )

    # ── Transaction details ───────────────────────────────────────────────────
    date_received: Mapped[date] = Column(
        Date, nullable=False
    )  # Date money/property received from ordering customer
    date_available: Mapped[date] = Column(
        Date, nullable=False
    )  # Date made available to beneficiary
    currency_code: Mapped[Optional[str]] = Column(String(3), default="AUD")
    total_amount: Mapped[float] = Column(Float, nullable=False)
    transfer_type: Mapped[Optional[str]] = Column(
        String(20), default="Money"
    )  # Money | Property
    property_description: Mapped[Optional[str]] = Column(String(500))
    transaction_reference: Mapped[Optional[str]] = Column(String(100))

    # ── Ordering customer ─────────────────────────────────────────────────────
    oc_full_name: Mapped[Optional[str]] = Column(String(200))
    oc_other_name: Mapped[Optional[str]] = Column(String(200))
    oc_dob: Mapped[Optional[date]] = Column(Date)
    oc_address: Mapped[Optional[str]] = Column(String(300))
    oc_city: Mapped[Optional[str]] = Column(String(100))
    oc_state: Mapped[Optional[str]] = Column(String(50))
    oc_postcode: Mapped[Optional[str]] = Column(String(20))
    oc_country: Mapped[Optional[str]] = Column(String(100), default="Australia")
    oc_postal_address: Mapped[Optional[str]] = Column(String(300))
    oc_postal_city: Mapped[Optional[str]] = Column(String(100))
    oc_postal_state: Mapped[Optional[str]] = Column(String(50))
    oc_postal_postcode: Mapped[Optional[str]] = Column(String(20))
    oc_postal_country: Mapped[Optional[str]] = Column(String(100))
    oc_phone: Mapped[Optional[str]] = Column(String(50))
    oc_email: Mapped[Optional[str]] = Column(String(200))
    oc_occupation: Mapped[Optional[str]] = Column(String(200))
    oc_abn: Mapped[Optional[str]] = Column(String(50))
    oc_acn: Mapped[Optional[str]] = Column(
        String(9)
    )  # Australian Company Number (9 digits)
    oc_arbn: Mapped[Optional[str]] = Column(
        String(9)
    )  # Australian Registered Body Number (9 digits)
    oc_customer_number: Mapped[Optional[str]] = Column(String(100))
    oc_account_number: Mapped[Optional[str]] = Column(String(100))
    oc_business_structure: Mapped[Optional[str]] = Column(String(100))

    # ── Ordering customer ID details (IFTI-OUT only) ──────────────────────────
    oc_id1_type: Mapped[Optional[str]] = Column(String(100))
    oc_id1_type_other: Mapped[Optional[str]] = Column(String(100))
    oc_id1_number: Mapped[Optional[str]] = Column(String(100))
    oc_id1_issuer: Mapped[Optional[str]] = Column(String(200))
    oc_id2_type: Mapped[Optional[str]] = Column(String(100))
    oc_id2_type_other: Mapped[Optional[str]] = Column(String(100))
    oc_id2_number: Mapped[Optional[str]] = Column(String(100))
    oc_id2_issuer: Mapped[Optional[str]] = Column(String(200))
    oc_electronic_source: Mapped[Optional[str]] = Column(String(200))

    # ── Beneficiary customer ──────────────────────────────────────────────────
    bc_full_name: Mapped[Optional[str]] = Column(String(200))
    bc_dob: Mapped[Optional[date]] = Column(Date)
    bc_business_name: Mapped[Optional[str]] = Column(String(200))
    bc_address: Mapped[Optional[str]] = Column(String(300))
    bc_city: Mapped[Optional[str]] = Column(String(100))
    bc_state: Mapped[Optional[str]] = Column(String(50))
    bc_postcode: Mapped[Optional[str]] = Column(String(20))
    bc_country: Mapped[Optional[str]] = Column(String(100))
    bc_postal_address: Mapped[Optional[str]] = Column(String(300))
    bc_postal_city: Mapped[Optional[str]] = Column(String(100))
    bc_postal_state: Mapped[Optional[str]] = Column(String(50))
    bc_postal_postcode: Mapped[Optional[str]] = Column(String(20))
    bc_postal_country: Mapped[Optional[str]] = Column(String(100))
    bc_phone: Mapped[Optional[str]] = Column(String(50))
    bc_email: Mapped[Optional[str]] = Column(String(200))
    bc_occupation: Mapped[Optional[str]] = Column(String(200))
    bc_abn: Mapped[Optional[str]] = Column(String(50))
    bc_acn: Mapped[Optional[str]] = Column(String(9))
    bc_arbn: Mapped[Optional[str]] = Column(String(9))
    bc_business_structure: Mapped[Optional[str]] = Column(String(100))
    bc_account_number: Mapped[Optional[str]] = Column(String(100))
    bc_institution_name: Mapped[Optional[str]] = Column(
        String(200)
    )  # InstitutionWithAccount.name (MANDATORY)
    bc_institution_city: Mapped[Optional[str]] = Column(
        String(100)
    )  # InstitutionWithAccount.city (MANDATORY)
    bc_institution_country: Mapped[Optional[str]] = Column(
        String(100)
    )  # InstitutionWithAccount.country

    # ── Person/org accepting transfer instruction from ordering customer ───────
    accept_id_number: Mapped[Optional[str]] = Column(
        String(100)
    )  # IFTI-OUT: retail outlet ID / IFTI-IN: same field
    accept_full_name: Mapped[Optional[str]] = Column(String(200))
    accept_address: Mapped[Optional[str]] = Column(String(300))
    accept_city: Mapped[Optional[str]] = Column(String(100))
    accept_state: Mapped[Optional[str]] = Column(String(50))
    accept_postcode: Mapped[Optional[str]] = Column(String(20))
    accept_country: Mapped[Optional[str]] = Column(String(100))  # IFTI-IN only
    accept_postal_address: Mapped[Optional[str]] = Column(String(300))  # IFTI-IN only
    accept_postal_city: Mapped[Optional[str]] = Column(String(100))  # IFTI-IN only
    accept_postal_state: Mapped[Optional[str]] = Column(String(50))  # IFTI-IN only
    accept_postal_postcode: Mapped[Optional[str]] = Column(String(20))  # IFTI-IN only
    accept_postal_country: Mapped[Optional[str]] = Column(String(100))  # IFTI-IN only
    accept_phone: Mapped[Optional[str]] = Column(String(50))  # IFTI-IN only
    accept_email: Mapped[Optional[str]] = Column(String(200))  # IFTI-IN only
    accept_occupation: Mapped[Optional[str]] = Column(String(200))  # IFTI-IN only
    accept_business_structure: Mapped[Optional[str]] = Column(
        String(100)
    )  # IFTI-IN only
    accept_other_name: Mapped[Optional[str]] = Column(String(200))  # IFTI-IN only
    accept_dob: Mapped[Optional[date]] = Column(Date)  # IFTI-IN only
    accept_abn: Mapped[Optional[str]] = Column(String(50))  # IFTI-IN only
    accept_acn: Mapped[Optional[str]] = Column(String(9))
    # orderingInstn.foreignBased — MANDATORY per IFTI-DRA-1-2 schema (YesNo)
    accept_foreign_based: Mapped[Optional[str]] = Column(
        String(3), default="No"
    )  # Yes | No
    is_accepting_money: Mapped[Optional[str]] = Column(
        String(5), default="Yes"
    )  # Yes/No
    is_sending_instruction: Mapped[Optional[str]] = Column(
        String(5), default="Yes"
    )  # Yes/No

    # ── Person/org accepting money (if different) — both ─────────────────────
    diff_accept_full_name: Mapped[Optional[str]] = Column(String(200))
    diff_accept_address: Mapped[Optional[str]] = Column(String(300))
    diff_accept_city: Mapped[Optional[str]] = Column(String(100))
    diff_accept_state: Mapped[Optional[str]] = Column(String(50))
    diff_accept_postcode: Mapped[Optional[str]] = Column(String(20))
    diff_accept_country: Mapped[Optional[str]] = Column(String(100))  # IFTI-IN only

    # ── Person/org sending transfer instruction (if different) ────────────────
    send_full_name: Mapped[Optional[str]] = Column(String(200))
    send_other_name: Mapped[Optional[str]] = Column(String(200))
    send_dob: Mapped[Optional[date]] = Column(Date)
    send_address: Mapped[Optional[str]] = Column(String(300))
    send_city: Mapped[Optional[str]] = Column(String(100))
    send_state: Mapped[Optional[str]] = Column(String(50))
    send_postcode: Mapped[Optional[str]] = Column(String(20))
    send_country: Mapped[Optional[str]] = Column(String(100))  # IFTI-IN only
    send_postal_address: Mapped[Optional[str]] = Column(String(300))
    send_postal_city: Mapped[Optional[str]] = Column(String(100))
    send_postal_state: Mapped[Optional[str]] = Column(String(50))
    send_postal_postcode: Mapped[Optional[str]] = Column(String(20))
    send_postal_country: Mapped[Optional[str]] = Column(String(100))
    send_phone: Mapped[Optional[str]] = Column(String(50))
    send_email: Mapped[Optional[str]] = Column(String(200))
    send_occupation: Mapped[Optional[str]] = Column(String(200))
    send_abn: Mapped[Optional[str]] = Column(String(50))
    send_acn: Mapped[Optional[str]] = Column(String(9))
    send_arbn: Mapped[Optional[str]] = Column(String(9))
    send_business_structure: Mapped[Optional[str]] = Column(String(100))

    # ── Person/org receiving transfer instruction ─────────────────────────────
    recv_full_name: Mapped[Optional[str]] = Column(String(200))
    recv_address: Mapped[Optional[str]] = Column(String(300))
    recv_city: Mapped[Optional[str]] = Column(String(100))
    recv_state: Mapped[Optional[str]] = Column(String(50))
    recv_postcode: Mapped[Optional[str]] = Column(String(20))
    recv_country: Mapped[Optional[str]] = Column(String(100))
    is_distributing: Mapped[Optional[str]] = Column(String(5))  # Yes/No
    has_retail_outlet: Mapped[Optional[str]] = Column(
        String(5)
    )  # Yes/No — IFTI-OUT; IFTI-IN col name differs

    # ── Person/org distributing money (if different) ──────────────────────────
    dist_full_name: Mapped[Optional[str]] = Column(String(200))
    dist_address: Mapped[Optional[str]] = Column(String(300))
    dist_city: Mapped[Optional[str]] = Column(String(100))
    dist_state: Mapped[Optional[str]] = Column(String(50))
    dist_postcode: Mapped[Optional[str]] = Column(String(20))
    dist_country: Mapped[Optional[str]] = Column(String(100))

    # ── Retail outlet (if different) ──────────────────────────────────────────
    retail_id_number: Mapped[Optional[str]] = Column(
        String(100)
    )  # IFTI-OUT only (col 58 before accept block)
    retail_full_name: Mapped[Optional[str]] = Column(String(200))
    retail_address: Mapped[Optional[str]] = Column(String(300))
    retail_city: Mapped[Optional[str]] = Column(String(100))
    retail_state: Mapped[Optional[str]] = Column(String(50))
    retail_postcode: Mapped[Optional[str]] = Column(String(20))
    retail_country: Mapped[Optional[str]] = Column(String(100))

    # ── Reason + Reporter ────────────────────────────────────────────────────
    reason_for_transfer: Mapped[Optional[str]] = Column(String(500))

    # initiatingInstn (0..1) — optional intermediate institution between
    # orderingInstn and sendingInstn. Maps to XML <initiatingInstn> element.
    init_instn_same_as_ordering: Mapped[Optional[str]] = Column(String(3))  # Yes | No
    init_instn_full_name: Mapped[Optional[str]] = Column(String(200))
    init_instn_address: Mapped[Optional[str]] = Column(String(300))
    init_instn_city: Mapped[Optional[str]] = Column(String(100))
    init_instn_country: Mapped[Optional[str]] = Column(String(100))

    reporter_full_name: Mapped[Optional[str]] = Column(String(200))
    reporter_job_title: Mapped[Optional[str]] = Column(String(200))
    reporter_phone: Mapped[Optional[str]] = Column(String(50))
    reporter_email: Mapped[Optional[str]] = Column(String(200))
    reporter_austrac_id: Mapped[Optional[str]] = Column(String(50))

    # ── Maker-checker / workflow / audit ────────────────────────────────────
    created_by: Mapped[Optional[str]] = Column(String(60))
    reviewed_by: Mapped[Optional[str]] = Column(String(60))
    approved_by: Mapped[Optional[str]] = Column(String(60))
    approved_at: Mapped[Optional[datetime]] = Column(DateTime(timezone=True))
    rejected_reason: Mapped[Optional[str]] = Column(String(500))
    submission_reference: Mapped[Optional[str]] = Column(String(100))
    submitted_at: Mapped[Optional[datetime]] = Column(DateTime(timezone=True))
    acknowledged_at: Mapped[Optional[datetime]] = Column(DateTime(timezone=True))
    due_date: Mapped[Optional[date]] = Column(Date)
    created_at: Mapped[Optional[datetime]] = Column(
        DateTime(timezone=True), server_default=func.now()
    )
    updated_at: Mapped[Optional[datetime]] = Column(
        DateTime(timezone=True), onupdate=func.now()
    )
