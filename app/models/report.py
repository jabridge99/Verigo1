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
from datetime import date, datetime
from typing import Any, Optional
from uuid import uuid4

from sqlalchemy import (
    JSON,
    Boolean,
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
from app.models.customer_workflow import EDDTrigger

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


class TTRIndustryType(str, enum.Enum):
    """
    AUSTRAC-defined industry classifications for TTR reporting.
    Each industry has a distinct set of mandatory and optional fields.
    """

    FBS = "FBS"  # Financial and Bullion Services — banks, financial institutions, bullion dealers
    GS = "GS"  # Gambling Services — casinos, betting agencies, gaming operators
    ISI = "ISI"  # Investment/Superannuation/Insurance — wealth management, super funds, life insurance
    MSB = "MSB"  # Money Services Business — remittance, currency exchange


class SMRDesignatedSvc(str, enum.Enum):
    """
    AUSTRAC SMR-2-0 designatedSvc enum (section smDetails).
    27 valid codes; AFSL_ARR is SMR-only (absent from TTR schemas).
    Mandatory: 1..26 per report.
    """

    ACC_DEP = "ACC_DEP"  # Accepting deposits
    AFSL_ARR = "AFSL_ARR"  # Arranging financial products (AFSL — SMR only)
    BET_ACC = "BET_ACC"  # Betting accounts
    BULSER = "BULSER"  # Bullion services
    BUS_LOAN = "BUS_LOAN"  # Business loans
    BUS_RSA = "BUS_RSA"  # Business/RSA accounts
    CHQACCSS = "CHQACCSS"  # Cheque access
    CRDACCSS = "CRDACCSS"  # Credit access
    CUR_EXCH = "CUR_EXCH"  # Currency exchange
    CUST_DEP = "CUST_DEP"  # Custodian/depository
    DCE = "DCE"  # Digital currency exchange
    DEBTINST = "DEBTINST"  # Debt instruments
    FIN_EFT = "FIN_EFT"  # Financial EFT
    GAMCHSKL = "GAMCHSKL"  # Gaming — chance/skill
    GAM_BETT = "GAM_BETT"  # Gaming — betting
    GAM_EXCH = "GAM_EXCH"  # Gaming — exchange
    GAM_MACH = "GAM_MACH"  # Gaming — machine
    LEASING = "LEASING"  # Leasing
    LIFE_INS = "LIFE_INS"  # Life insurance
    PAYORDRS = "PAYORDRS"  # Payment orders
    PAYROLL = "PAYROLL"  # Payroll services
    PENSIONS = "PENSIONS"  # Pensions/annuities
    RS = "RS"  # Remittance services
    SECURITY = "SECURITY"  # Securities
    SUPERANN = "SUPERANN"  # Superannuation
    TRAVLCHQ = "TRAVLCHQ"  # Traveller's cheques
    VALCARDS = "VALCARDS"  # Value-stored cards


class SMRSuspReason(str, enum.Enum):
    """
    AUSTRAC SMR-2-0 suspReason enum (section smDetails).
    One or more reasons MUST be selected. Requires explicit human selection.
    """

    PROCEEDS = "PROCEEDS"  # Proceeds of crime
    TERRORISM = "TERRORISM"  # Terrorism financing
    EVASION = "EVASION"  # Tax evasion
    FRAUD = "FRAUD"  # Fraud
    BRIBERY = "BRIBERY"  # Bribery/corruption
    DRUG = "DRUG"  # Drug trafficking
    PEOPLE = "PEOPLE"  # People smuggling/trafficking
    WEAPON = "WEAPON"  # Weapons proliferation
    ENVIRON = "ENVIRON"  # Environmental crime
    OTHER = "OTHER"  # Other


# SMR-2-0 uses the same offence categories for both suspReason and additionalDetails.offence.
# A single enum is shared so values stay in sync if AUSTRAC ever updates the list.
SMROffenceType = SMRSuspReason


# ── IFTI Report ───────────────────────────────────────────────────────────────


class IFTIReport(Base):
    """
    AUSTRAC International Funds Transfer Instruction.
    Due within 10 business days of receiving/sending the instruction.
    """

    __tablename__ = "ifti_reports"

    id: Mapped[str] = Column(
        String, primary_key=True, default=lambda: f"ifti_{uuid4().hex[:12]}"
    )
    org_id: Mapped[str] = Column(
        String,
        ForeignKey("organisations.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    customer_id: Mapped[Optional[str]] = Column(
        String, ForeignKey("customers.id"), nullable=True, index=True
    )
    transaction_id: Mapped[Optional[str]] = Column(
        String, ForeignKey("transactions.id"), nullable=True
    )

    report_ref: Mapped[Optional[str]] = Column(
        String(60), unique=True, index=True
    )  # PSPE-IFTI-I-20260615-0001
    reference_number: Mapped[Optional[str]] = Column(String(100), index=True)

    direction: Mapped[IFTIDirection] = Column(
        Enum(IFTIDirection), nullable=False, index=True
    )
    status: Mapped[ReportStatus] = Column(
        Enum(ReportStatus), default=ReportStatus.draft, nullable=False, index=True
    )
    priority: Mapped[Optional[ReportPriority]] = Column(
        Enum(ReportPriority), default=ReportPriority.normal
    )

    # Core transfer
    date_received: Mapped[date] = Column(Date, nullable=False)
    date_available: Mapped[Optional[date]] = Column(Date)
    total_amount: Mapped[float] = Column(Float, nullable=False)
    currency: Mapped[str] = Column(String(3), nullable=False, default="AUD")
    amount_aud: Mapped[Optional[float]] = Column(Float)
    exchange_rate: Mapped[Optional[float]] = Column(Float)
    transfer_type: Mapped[Optional[str]] = Column(String(50), default="Money")
    transfer_reference: Mapped[Optional[str]] = Column(String(100))

    # Ordering Customer (OC)
    oc_name: Mapped[Optional[str]] = Column(String(255))
    oc_other_names: Mapped[Optional[str]] = Column(String(255))
    oc_dob: Mapped[Optional[date]] = Column(Date)
    oc_address: Mapped[Optional[str]] = Column(String(500))
    oc_city: Mapped[Optional[str]] = Column(String(100))
    oc_state: Mapped[Optional[str]] = Column(String(50))
    oc_postcode: Mapped[Optional[str]] = Column(String(10))
    oc_country: Mapped[Optional[str]] = Column(String(2))
    oc_postal_address: Mapped[Optional[str]] = Column(String(500))
    oc_phone: Mapped[Optional[str]] = Column(String(50))
    oc_email: Mapped[Optional[str]] = Column(String(255))
    oc_occupation: Mapped[Optional[str]] = Column(String(255))
    oc_abn: Mapped[Optional[str]] = Column(String(11))
    oc_account_number: Mapped[Optional[str]] = Column(String(50))
    oc_business_structure: Mapped[Optional[str]] = Column(String(50))
    oc_id1_type: Mapped[Optional[str]] = Column(String(50))
    oc_id1_number: Mapped[Optional[str]] = Column(String(50))
    oc_id1_country: Mapped[Optional[str]] = Column(String(2))
    oc_id1_issuer: Mapped[Optional[str]] = Column(String(255))
    oc_id2_type: Mapped[Optional[str]] = Column(String(50))
    oc_id2_number: Mapped[Optional[str]] = Column(String(50))
    oc_id2_country: Mapped[Optional[str]] = Column(String(2))
    oc_id2_issuer: Mapped[Optional[str]] = Column(String(255))
    oc_electronic_source: Mapped[Optional[str]] = Column(String(255))

    # Beneficiary Customer (BC)
    bc_name: Mapped[Optional[str]] = Column(String(255))
    bc_dob: Mapped[Optional[date]] = Column(Date)
    bc_business_name: Mapped[Optional[str]] = Column(String(255))
    bc_address: Mapped[Optional[str]] = Column(String(500))
    bc_city: Mapped[Optional[str]] = Column(String(100))
    bc_country: Mapped[Optional[str]] = Column(String(2))
    bc_account_number: Mapped[Optional[str]] = Column(String(50))
    bc_institution_name: Mapped[Optional[str]] = Column(String(255))
    bc_institution_country: Mapped[Optional[str]] = Column(String(2))
    bc_swift_bic: Mapped[Optional[str]] = Column(String(11))
    bc_iban: Mapped[Optional[str]] = Column(String(34))

    reason_for_transfer: Mapped[Optional[str]] = Column(String(500))

    # Reporter (regulated entity)
    reporter_name: Mapped[Optional[str]] = Column(String(255))
    reporter_abn: Mapped[Optional[str]] = Column(String(11))
    reporter_austrac_id: Mapped[Optional[str]] = Column(String(50))
    reporter_contact: Mapped[Optional[str]] = Column(String(255))
    reporter_address: Mapped[Optional[str]] = Column(String(500))

    supporting_documents: Mapped[Optional[Any]] = Column(JSON, default=list)
    due_date: Mapped[Optional[date]] = Column(Date, index=True)

    # Maker-checker workflow
    prepared_by: Mapped[Optional[str]] = Column(String)
    reviewed_by: Mapped[Optional[str]] = Column(String)
    approved_by: Mapped[Optional[str]] = Column(String)
    approved_at: Mapped[Optional[datetime]] = Column(DateTime(timezone=True))
    submitted_by: Mapped[Optional[str]] = Column(String)
    submitted_at: Mapped[Optional[datetime]] = Column(DateTime(timezone=True))
    submission_reference: Mapped[Optional[str]] = Column(String(100))
    acknowledged_at: Mapped[Optional[datetime]] = Column(DateTime(timezone=True))
    rejected_reason: Mapped[Optional[str]] = Column(Text)

    created_at: Mapped[Optional[datetime]] = Column(
        DateTime(timezone=True), server_default=func.now()
    )
    updated_at: Mapped[Optional[datetime]] = Column(
        DateTime(timezone=True), onupdate=func.now()
    )

    organisation = relationship("Organisation")
    customer = relationship("Customer")


# ── TTR Report ────────────────────────────────────────────────────────────────


class TTRReport(Base):
    """Threshold Transaction Report — cash >= AUD 10,000."""

    __tablename__ = "ttr_reports"

    id: Mapped[str] = Column(
        String, primary_key=True, default=lambda: f"ttr_{uuid4().hex[:12]}"
    )
    org_id: Mapped[str] = Column(
        String,
        ForeignKey("organisations.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    customer_id: Mapped[Optional[str]] = Column(
        String, ForeignKey("customers.id"), nullable=True, index=True
    )
    transaction_id: Mapped[Optional[str]] = Column(
        String, ForeignKey("transactions.id"), nullable=True
    )

    report_ref: Mapped[Optional[str]] = Column(String(60), unique=True, index=True)
    status: Mapped[ReportStatus] = Column(
        Enum(ReportStatus), default=ReportStatus.draft, nullable=False, index=True
    )
    priority: Mapped[Optional[ReportPriority]] = Column(
        Enum(ReportPriority), default=ReportPriority.normal
    )

    transaction_date: Mapped[date] = Column(Date, nullable=False)
    total_amount: Mapped[float] = Column(Float, nullable=False)
    currency: Mapped[Optional[str]] = Column(String(3), default="AUD")
    transaction_type: Mapped[Optional[str]] = Column(
        String(50)
    )  # cash_in | cash_out | combined

    # Customer snapshot
    customer_name: Mapped[Optional[str]] = Column(String(255))
    customer_dob: Mapped[Optional[date]] = Column(Date)
    customer_address: Mapped[Optional[str]] = Column(String(500))
    customer_occupation: Mapped[Optional[str]] = Column(String(255))
    customer_id_type: Mapped[Optional[str]] = Column(String(50))
    customer_id_number: Mapped[Optional[str]] = Column(String(50))
    customer_abn: Mapped[Optional[str]] = Column(String(11))

    # Service point
    branch_name: Mapped[Optional[str]] = Column(String(255))
    branch_address: Mapped[Optional[str]] = Column(String(500))
    branch_bsb: Mapped[Optional[str]] = Column(String(10))
    account_name: Mapped[Optional[str]] = Column(String(255))
    account_number: Mapped[Optional[str]] = Column(String(50))
    account_bsb: Mapped[Optional[str]] = Column(String(10))

    # Third parties
    third_party_name: Mapped[Optional[str]] = Column(String(255))
    third_party_relationship: Mapped[Optional[str]] = Column(String(255))

    summary: Mapped[Optional[str]] = Column(Text)
    due_date: Mapped[Optional[date]] = Column(Date, index=True)

    # ── Industry classification ────────────────────────────────────────────────
    # Determines which AUSTRAC TTR form fields are required and how CSV is structured.
    industry_type: Mapped[Optional[TTRIndustryType]] = Column(
        Enum(TTRIndustryType), nullable=True, index=True
    )

    # Industry-specific fields (stored as JSON — schema varies per industry_type).
    # FBS: denomination_breakdown, cash_type, foreign_currency_details
    # GS:  venue_name, patron_id, gaming_licence, game_type, chip_buy_in, chip_redemption
    # ISI: policy_number, fund_name, trustee_name, investment_type, beneficiary_name
    # MSB: send_country, receive_country, exchange_rate_applied, settlement_method,
    #      agent_name, agent_austrac_id, sender_details, receiver_details
    industry_detail: Mapped[Optional[Any]] = Column(JSON, default=dict)

    reporter_name: Mapped[Optional[str]] = Column(String(255))
    reporter_abn: Mapped[Optional[str]] = Column(String(11))
    reporter_austrac_id: Mapped[Optional[str]] = Column(String(50))
    supporting_documents: Mapped[Optional[Any]] = Column(JSON, default=list)

    prepared_by: Mapped[Optional[str]] = Column(String)
    reviewed_by: Mapped[Optional[str]] = Column(String)
    approved_by: Mapped[Optional[str]] = Column(String)
    approved_at: Mapped[Optional[datetime]] = Column(DateTime(timezone=True))
    submitted_by: Mapped[Optional[str]] = Column(String)
    submitted_at: Mapped[Optional[datetime]] = Column(DateTime(timezone=True))
    submission_reference: Mapped[Optional[str]] = Column(String(100))
    acknowledged_at: Mapped[Optional[datetime]] = Column(DateTime(timezone=True))
    rejected_reason: Mapped[Optional[str]] = Column(Text)

    created_at: Mapped[Optional[datetime]] = Column(
        DateTime(timezone=True), server_default=func.now()
    )
    updated_at: Mapped[Optional[datetime]] = Column(
        DateTime(timezone=True), onupdate=func.now()
    )

    organisation = relationship("Organisation")
    customer = relationship("Customer")


# ── SMR Report ────────────────────────────────────────────────────────────────


class SMRReport(Base):
    """
    Suspicious Matter Report — aligned to AUSTRAC SMR-2-0.xsd.
    Lifecycle: draft → under_review → approved (MLRO sign-off) → submitted → acknowledged
    DISCLAIMER: The decision to lodge an SMR remains entirely with the reporting entity.
    All SMR fields require explicit human action — never auto-set.
    """

    __tablename__ = "smr_reports"

    id: Mapped[str] = Column(
        String, primary_key=True, default=lambda: f"smr_{uuid4().hex[:12]}"
    )
    org_id: Mapped[str] = Column(
        String,
        ForeignKey("organisations.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    customer_id: Mapped[Optional[str]] = Column(
        String, ForeignKey("customers.id"), nullable=True, index=True
    )
    case_id: Mapped[Optional[str]] = Column(
        String, ForeignKey("cases.id"), nullable=True, index=True
    )

    report_ref: Mapped[Optional[str]] = Column(String(60), unique=True, index=True)
    status: Mapped[ReportStatus] = Column(
        Enum(ReportStatus), default=ReportStatus.draft, nullable=False, index=True
    )
    priority: Mapped[Optional[ReportPriority]] = Column(
        Enum(ReportPriority), default=ReportPriority.high
    )

    # ── <header> ─────────────────────────────────────────────────────────────────
    re_report_ref: Mapped[Optional[str]] = Column(
        String(100)
    )  # reReportRef — reference to original report if re-lodging
    intercept_flag: Mapped[Optional[str]] = Column(
        String(3)
    )  # interceptFlag YesNo — law enforcement intercept
    reporting_branch_id: Mapped[Optional[str]] = Column(
        String(100)
    )  # reportingBranch.branchId (optional)
    reporting_branch_name: Mapped[Optional[str]] = Column(
        String(255)
    )  # reportingBranch.name (MANDATORY if branch supplied)

    # ── <smDetails> — MANDATORY ───────────────────────────────────────────────────
    # designated_svcs: list of SMRDesignatedSvc codes — 1..26 entries MANDATORY
    # All values must be valid SMRDesignatedSvc enum members (validated at service layer)
    designated_svcs: Mapped[Optional[Any]] = Column(JSON, default=list)
    designated_svc_provided: Mapped[Optional[str]] = Column(
        String(3)
    )  # YesNo — service was provided
    designated_svc_requested: Mapped[Optional[str]] = Column(
        String(3)
    )  # YesNo — service was requested
    designated_svc_enquiry: Mapped[Optional[str]] = Column(
        String(3)
    )  # YesNo — enquiry only

    # susp_reason_codes: list of SMRSuspReason codes — 1..* MANDATORY
    # Requires explicit human selection — never auto-populate
    susp_reason_codes: Mapped[Optional[Any]] = Column(JSON, default=list)
    grand_total: Mapped[Optional[float]] = Column(
        Float
    )  # smDetails.grandTotal (MANDATORY Amount)
    grand_total_currency: Mapped[Optional[str]] = Column(String(3), default="AUD")

    matter_date: Mapped[date] = Column(Date, nullable=False)
    suspicion_grounds: Mapped[str] = Column(
        Text, nullable=False
    )  # <suspGrounds> — MANDATORY free text

    # ── Primary suspect — <suspPerson> (first entry; additional via susp_persons JSON) ───
    # Retains legacy single-subject fields for backwards compat; additional persons in JSON
    subject_name: Mapped[Optional[str]] = Column(String(255))
    subject_dob: Mapped[Optional[date]] = Column(Date)
    subject_address: Mapped[Optional[str]] = Column(String(500))
    subject_city: Mapped[Optional[str]] = Column(String(100))
    subject_state: Mapped[Optional[str]] = Column(String(50))
    subject_postcode: Mapped[Optional[str]] = Column(String(20))
    subject_country: Mapped[Optional[str]] = Column(String(100))
    subject_email: Mapped[Optional[str]] = Column(String(255))
    subject_occupation: Mapped[Optional[str]] = Column(String(255))
    subject_abn: Mapped[Optional[str]] = Column(String(11))
    subject_acn: Mapped[Optional[str]] = Column(String(9))
    subject_arbn: Mapped[Optional[str]] = Column(String(9))
    subject_id_type: Mapped[Optional[str]] = Column(String(100))
    subject_id_number: Mapped[Optional[str]] = Column(String(100))
    subject_id_issue_date: Mapped[Optional[date]] = Column(
        Date
    )  # SMR Identification extends base with idIssueDate
    subject_id_expiry_date: Mapped[Optional[date]] = Column(
        Date
    )  # SMR Identification extends base with idExpiryDate
    subject_id_issuer: Mapped[Optional[str]] = Column(String(255))
    subject_electronic_source: Mapped[Optional[str]] = Column(String(255))
    subject_device_identifier: Mapped[Optional[str]] = Column(String(255))
    subject_business_name: Mapped[Optional[str]] = Column(String(255))
    subject_business_struct: Mapped[Optional[str]] = Column(String(100))
    subject_business_ben_name: Mapped[Optional[str]] = Column(
        String(255)
    )  # beneficiary/holder name
    subject_business_holder_name: Mapped[Optional[str]] = Column(String(255))
    subject_incorp_country: Mapped[Optional[str]] = Column(String(100))
    subject_citizen_countries: Mapped[Optional[Any]] = Column(
        JSON, default=list
    )  # citizenCountry 0..* (multiple citizenships)
    subject_digital_currency_wallets: Mapped[Optional[Any]] = Column(
        JSON, default=list
    )  # [{network, address}]
    subject_account_number: Mapped[Optional[str]] = Column(String(100))
    subject_account_bsb: Mapped[Optional[str]] = Column(String(10))
    subject_account_name: Mapped[Optional[str]] = Column(String(255))
    subject_account_institution: Mapped[Optional[str]] = Column(String(255))
    subject_is_customer: Mapped[Optional[str]] = Column(
        String(3)
    )  # personIsCustomer YesNo

    # ── Additional persons — stored as JSON arrays ──────────────────────────────
    # susp_persons: [{name, dob, address, abn, acn, id_type, id_number, ...}] — suspPerson[1..*]
    # other_persons: [{name, relationship, partyIsCustomer, partyIsAgent, ...}] — otherPerson[0..*]
    # unident_persons: [{descOfPerson, descOfDocs}] — unidentPerson[0..*]
    # Structure validated at service layer; all entries require explicit human input.
    susp_persons: Mapped[Optional[Any]] = Column(JSON, default=list)
    other_persons: Mapped[Optional[Any]] = Column(JSON, default=list)
    unident_persons: Mapped[Optional[Any]] = Column(JSON, default=list)

    # ── <txnDetail> (0..*) — structured transaction details ────────────────────
    # Each entry: {txnDate, txnType (1..59), tfrType, txnCompleted (YesNo MANDATORY),
    #   txnRefNo, txnAmount, cashAmount, foreignCurr, digitalCurrency,
    #   senderDrawerIssuer, payee, beneficiary, otherInstitution}
    txn_details: Mapped[Optional[Any]] = Column(JSON, default=list)

    # Retained for legacy association — use txn_details for structured AUSTRAC output
    transaction_ids: Mapped[Optional[Any]] = Column(JSON, default=list)
    total_amount: Mapped[Optional[float]] = Column(Float)
    currency: Mapped[Optional[str]] = Column(String(3), default="AUD")

    # ── <additionalDetails> — MANDATORY ─────────────────────────────────────────
    # offence_type: SMROffenceType enum value — MANDATORY, exactly 1, human-selected
    offence_type: Mapped[Optional[str]] = Column(String(50))
    is_terrorism_related: Mapped[Optional[bool]] = Column(
        Boolean, default=False
    )  # derived from offence_type == TERRORISM; 24h deadline
    prev_reported_refs: Mapped[Optional[Any]] = Column(
        JSON, default=list
    )  # prevReported — prior AUSTRAC report refs
    other_aus_gov_reports: Mapped[Optional[Any]] = Column(
        JSON, default=list
    )  # otherAusGov — other Australian gov agency reports

    # ── MLRO-authored narrative ──────────────────────────────────────────────────
    narrative: Mapped[Optional[str]] = Column(Text)
    evidence_summary: Mapped[Optional[str]] = Column(Text)
    related_smr_refs: Mapped[Optional[Any]] = Column(JSON, default=list)
    supporting_documents: Mapped[Optional[Any]] = Column(JSON, default=list)

    due_date: Mapped[Optional[date]] = Column(Date, index=True)

    reporter_name: Mapped[Optional[str]] = Column(String(255))
    reporter_abn: Mapped[Optional[str]] = Column(String(11))
    reporter_austrac_id: Mapped[Optional[str]] = Column(String(50))

    # Workflow — all fields require explicit human action
    prepared_by: Mapped[Optional[str]] = Column(String)
    reviewed_by: Mapped[Optional[str]] = Column(String)
    mlro_sign_off: Mapped[Optional[str]] = Column(String)  # MLRO user_id
    mlro_signed_at: Mapped[Optional[datetime]] = Column(DateTime(timezone=True))
    mlro_sign_off_notes: Mapped[Optional[str]] = Column(Text)
    submitted_by: Mapped[Optional[str]] = Column(String)
    submitted_at: Mapped[Optional[datetime]] = Column(DateTime(timezone=True))
    submission_reference: Mapped[Optional[str]] = Column(String(100))
    acknowledged_at: Mapped[Optional[datetime]] = Column(DateTime(timezone=True))
    rejected_reason: Mapped[Optional[str]] = Column(Text)

    created_at: Mapped[Optional[datetime]] = Column(
        DateTime(timezone=True), server_default=func.now()
    )
    updated_at: Mapped[Optional[datetime]] = Column(
        DateTime(timezone=True), onupdate=func.now()
    )

    organisation = relationship("Organisation")
    customer = relationship("Customer")
    case = relationship("Case")


# ── Enhanced Customer Due Diligence ──────────────────────────────────────────────


class ECDDStatus(str, enum.Enum):
    pending = "pending"
    completed = "completed"
    rejected = "rejected"


class ECDDRejectionType(str, enum.Enum):
    """
    P34: which of two distinct outcomes a 'rejected' ECDD decision was --
    the CO Quarterly Report template (VERIGO-GEN-COR) tracks these as
    separate metrics, since they have different regulatory implications
    (an exit can itself warrant an SMR consideration; a decline never
    onboarded the risk in the first place). Set by the compliance officer
    making the decision -- the system has no reliable way to infer which
    one applies from the customer record alone.
    """

    service_declined = (
        "service_declined"  # never onboarded / relationship never established
    )
    relationship_exited = "relationship_exited"  # existing customer offboarded


class ECDDRecord(Base):
    """Enhanced due diligence assessment — PEP, adverse media, beneficial ownership,
    source of wealth, tax-risk and investment-legitimacy review, captured as a
    single-page assessment rather than a multi-step wizard.

    Status (pending/completed/rejected) is a manual decision and is reversible —
    every change is timestamped via last_revised_at and recorded as an AuditLog
    entry (see reports.py decide_ecdd) carrying the decision_notes rationale,
    rather than a bespoke revision-history table.
    """

    __tablename__ = "ecdd_records"

    id: Mapped[str] = Column(
        String, primary_key=True, default=lambda: f"ecdd_{uuid4().hex[:12]}"
    )
    org_id: Mapped[str] = Column(
        String,
        ForeignKey("organisations.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    ecdd_id: Mapped[Optional[str]] = Column(
        String(40), unique=True, index=True
    )  # ECDD-XXXXXXXXXXXX
    customer_id: Mapped[str] = Column(
        String, ForeignKey("customers.id"), nullable=False, index=True
    )

    # AUSTRAC/FATF-aligned trigger categories (shared with the broader EDD
    # workflow in customer_workflow.py) plus a free-text field for "Other".
    trigger_reason: Mapped[EDDTrigger] = Column(Enum(EDDTrigger), nullable=False)
    trigger_reason_other: Mapped[Optional[str]] = Column(Text)

    pep_status: Mapped[Optional[bool]] = Column(Boolean, default=False)
    adverse_media_found: Mapped[Optional[bool]] = Column(Boolean, default=False)
    adverse_media_details: Mapped[Optional[str]] = Column(Text)

    beneficial_owner_verified: Mapped[Optional[bool]] = Column(Boolean, default=False)
    beneficial_owner_details: Mapped[Optional[str]] = Column(Text)

    source_of_wealth_verified: Mapped[Optional[bool]] = Column(Boolean, default=False)
    source_of_funds: Mapped[Optional[str]] = Column(Text)
    source_of_wealth_notes: Mapped[Optional[str]] = Column(Text)

    purpose_of_transaction: Mapped[Optional[str]] = Column(Text)
    high_tax_risk: Mapped[Optional[bool]] = Column(Boolean, default=False)
    tax_risk_notes: Mapped[Optional[str]] = Column(Text)

    investment_legitimacy_notes: Mapped[Optional[str]] = Column(Text)
    analyst_notes: Mapped[Optional[str]] = Column(Text)

    enhanced_risk_score: Mapped[Optional[float]] = Column(Float, default=0.0)
    recommendation: Mapped[Optional[str]] = Column(
        String(20)
    )  # approve | monitor | reject
    status: Mapped[ECDDStatus] = Column(
        Enum(ECDDStatus), default=ECDDStatus.pending, nullable=False, index=True
    )
    # Only meaningful when status == rejected; cleared on any re-decision
    # that moves the record away from rejected (see decide_ecdd()).
    rejection_type: Mapped[Optional[ECDDRejectionType]] = Column(
        Enum(ECDDRejectionType), nullable=True
    )

    # Manual accept/reject rationale — required whenever status is changed
    # away from pending (and on any later reversal/re-decision).
    decision_notes: Mapped[Optional[str]] = Column(Text)
    decided_by: Mapped[Optional[str]] = Column(String)
    decided_at: Mapped[Optional[datetime]] = Column(DateTime(timezone=True))
    last_revised_at: Mapped[Optional[datetime]] = Column(DateTime(timezone=True))

    created_by: Mapped[Optional[str]] = Column(String)

    created_at: Mapped[Optional[datetime]] = Column(
        DateTime(timezone=True), server_default=func.now()
    )
    updated_at: Mapped[Optional[datetime]] = Column(
        DateTime(timezone=True), onupdate=func.now()
    )

    organisation = relationship("Organisation")
    customer = relationship("Customer")


# ── Filing Register (immutable) ────────────────────────────────────────────────


class FilingRegisterEntry(Base):
    """
    Immutable regulatory filing register — one row per AUSTRAC submission.
    This record is NEVER modified after creation.
    Corrections create a new entry with supersedes_id referencing the original.
    """

    __tablename__ = "filing_register"

    id: Mapped[str] = Column(
        String, primary_key=True, default=lambda: f"fil_{uuid4().hex[:12]}"
    )
    org_id: Mapped[str] = Column(
        String,
        ForeignKey("organisations.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )

    report_type: Mapped[ReportType] = Column(
        Enum(ReportType), nullable=False, index=True
    )
    report_id: Mapped[str] = Column(
        String, nullable=False
    )  # id of IFTIReport/TTRReport/SMRReport
    report_ref: Mapped[Optional[str]] = Column(
        String(60), unique=True, index=True
    )  # PSPE-IFTI-I-20260615-0001

    austrac_submission_ref: Mapped[Optional[str]] = Column(
        String(100)
    )  # AUSTRAC confirmation ref
    submitted_by: Mapped[str] = Column(String, nullable=False)  # user_id
    submitted_at: Mapped[datetime] = Column(DateTime(timezone=True), nullable=False)

    period_start: Mapped[Optional[date]] = Column(Date)
    period_end: Mapped[Optional[date]] = Column(Date)
    amount_aud: Mapped[Optional[float]] = Column(Float)

    status: Mapped[str] = Column(
        String(20), nullable=False, default="submitted"
    )  # submitted|acknowledged|rejected
    acknowledgement_ref: Mapped[Optional[str]] = Column(String(100))
    acknowledgement_at: Mapped[Optional[datetime]] = Column(DateTime(timezone=True))
    rejected_reason: Mapped[Optional[str]] = Column(Text)

    notes: Mapped[Optional[str]] = Column(Text)
    supersedes_id: Mapped[Optional[str]] = Column(
        String, ForeignKey("filing_register.id"), nullable=True
    )

    created_at: Mapped[Optional[datetime]] = Column(
        DateTime(timezone=True), server_default=func.now(), index=True
    )
    # Intentionally NO updated_at — immutable record

    __table_args__ = (Index("ix_filing_org_type", "org_id", "report_type"),)
