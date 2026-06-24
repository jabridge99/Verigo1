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

    id = Column(String, primary_key=True, default=lambda: f"ifti_{uuid4().hex[:12]}")
    org_id = Column(
        String,
        ForeignKey("organisations.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    customer_id = Column(String, ForeignKey("customers.id"), nullable=True, index=True)
    transaction_id = Column(String, ForeignKey("transactions.id"), nullable=True)

    report_ref = Column(
        String(60), unique=True, index=True
    )  # PSPE-IFTI-I-20260615-0001
    reference_number = Column(String(100), index=True)

    direction = Column(Enum(IFTIDirection), nullable=False, index=True)
    status = Column(
        Enum(ReportStatus), default=ReportStatus.draft, nullable=False, index=True
    )
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
    org_id = Column(
        String,
        ForeignKey("organisations.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    customer_id = Column(String, ForeignKey("customers.id"), nullable=True, index=True)
    transaction_id = Column(String, ForeignKey("transactions.id"), nullable=True)

    report_ref = Column(String(60), unique=True, index=True)
    status = Column(
        Enum(ReportStatus), default=ReportStatus.draft, nullable=False, index=True
    )
    priority = Column(Enum(ReportPriority), default=ReportPriority.normal)

    transaction_date = Column(Date, nullable=False)
    total_amount = Column(Float, nullable=False)
    currency = Column(String(3), default="AUD")
    transaction_type = Column(String(50))  # cash_in | cash_out | combined

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

    # ── Industry classification ────────────────────────────────────────────────
    # Determines which AUSTRAC TTR form fields are required and how CSV is structured.
    industry_type = Column(Enum(TTRIndustryType), nullable=True, index=True)

    # Industry-specific fields (stored as JSON — schema varies per industry_type).
    # FBS: denomination_breakdown, cash_type, foreign_currency_details
    # GS:  venue_name, patron_id, gaming_licence, game_type, chip_buy_in, chip_redemption
    # ISI: policy_number, fund_name, trustee_name, investment_type, beneficiary_name
    # MSB: send_country, receive_country, exchange_rate_applied, settlement_method,
    #      agent_name, agent_austrac_id, sender_details, receiver_details
    industry_detail = Column(JSON, default=dict)

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
    Suspicious Matter Report — aligned to AUSTRAC SMR-2-0.xsd.
    Lifecycle: draft → under_review → approved (MLRO sign-off) → submitted → acknowledged
    DISCLAIMER: The decision to lodge an SMR remains entirely with the reporting entity.
    All SMR fields require explicit human action — never auto-set.
    """

    __tablename__ = "smr_reports"

    id = Column(String, primary_key=True, default=lambda: f"smr_{uuid4().hex[:12]}")
    org_id = Column(
        String,
        ForeignKey("organisations.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    customer_id = Column(String, ForeignKey("customers.id"), nullable=True, index=True)
    case_id = Column(String, ForeignKey("cases.id"), nullable=True, index=True)

    report_ref = Column(String(60), unique=True, index=True)
    status = Column(
        Enum(ReportStatus), default=ReportStatus.draft, nullable=False, index=True
    )
    priority = Column(Enum(ReportPriority), default=ReportPriority.high)

    # ── <header> ─────────────────────────────────────────────────────────────────
    re_report_ref = Column(
        String(100)
    )  # reReportRef — reference to original report if re-lodging
    intercept_flag = Column(
        String(3)
    )  # interceptFlag YesNo — law enforcement intercept
    reporting_branch_id = Column(String(100))  # reportingBranch.branchId (optional)
    reporting_branch_name = Column(
        String(255)
    )  # reportingBranch.name (MANDATORY if branch supplied)

    # ── <smDetails> — MANDATORY ───────────────────────────────────────────────────
    # designated_svcs: list of SMRDesignatedSvc codes — 1..26 entries MANDATORY
    # All values must be valid SMRDesignatedSvc enum members (validated at service layer)
    designated_svcs = Column(JSON, default=list)
    designated_svc_provided = Column(String(3))  # YesNo — service was provided
    designated_svc_requested = Column(String(3))  # YesNo — service was requested
    designated_svc_enquiry = Column(String(3))  # YesNo — enquiry only

    # susp_reason_codes: list of SMRSuspReason codes — 1..* MANDATORY
    # Requires explicit human selection — never auto-populate
    susp_reason_codes = Column(JSON, default=list)
    grand_total = Column(Float)  # smDetails.grandTotal (MANDATORY Amount)
    grand_total_currency = Column(String(3), default="AUD")

    matter_date = Column(Date, nullable=False)
    suspicion_grounds = Column(
        Text, nullable=False
    )  # <suspGrounds> — MANDATORY free text

    # ── Primary suspect — <suspPerson> (first entry; additional via susp_persons JSON) ───
    # Retains legacy single-subject fields for backwards compat; additional persons in JSON
    subject_name = Column(String(255))
    subject_dob = Column(Date)
    subject_address = Column(String(500))
    subject_city = Column(String(100))
    subject_state = Column(String(50))
    subject_postcode = Column(String(20))
    subject_country = Column(String(100))
    subject_email = Column(String(255))
    subject_occupation = Column(String(255))
    subject_abn = Column(String(11))
    subject_acn = Column(String(9))
    subject_arbn = Column(String(9))
    subject_id_type = Column(String(100))
    subject_id_number = Column(String(100))
    subject_id_issue_date = Column(
        Date
    )  # SMR Identification extends base with idIssueDate
    subject_id_expiry_date = Column(
        Date
    )  # SMR Identification extends base with idExpiryDate
    subject_id_issuer = Column(String(255))
    subject_electronic_source = Column(String(255))
    subject_device_identifier = Column(String(255))
    subject_business_name = Column(String(255))
    subject_business_struct = Column(String(100))
    subject_business_ben_name = Column(String(255))  # beneficiary/holder name
    subject_business_holder_name = Column(String(255))
    subject_incorp_country = Column(String(100))
    subject_citizen_countries = Column(
        JSON, default=list
    )  # citizenCountry 0..* (multiple citizenships)
    subject_digital_currency_wallets = Column(
        JSON, default=list
    )  # [{network, address}]
    subject_account_number = Column(String(100))
    subject_account_bsb = Column(String(10))
    subject_account_name = Column(String(255))
    subject_account_institution = Column(String(255))
    subject_is_customer = Column(String(3))  # personIsCustomer YesNo

    # ── Additional persons — stored as JSON arrays ──────────────────────────────
    # susp_persons: [{name, dob, address, abn, acn, id_type, id_number, ...}] — suspPerson[1..*]
    # other_persons: [{name, relationship, partyIsCustomer, partyIsAgent, ...}] — otherPerson[0..*]
    # unident_persons: [{descOfPerson, descOfDocs}] — unidentPerson[0..*]
    # Structure validated at service layer; all entries require explicit human input.
    susp_persons = Column(JSON, default=list)
    other_persons = Column(JSON, default=list)
    unident_persons = Column(JSON, default=list)

    # ── <txnDetail> (0..*) — structured transaction details ────────────────────
    # Each entry: {txnDate, txnType (1..59), tfrType, txnCompleted (YesNo MANDATORY),
    #   txnRefNo, txnAmount, cashAmount, foreignCurr, digitalCurrency,
    #   senderDrawerIssuer, payee, beneficiary, otherInstitution}
    txn_details = Column(JSON, default=list)

    # Retained for legacy association — use txn_details for structured AUSTRAC output
    transaction_ids = Column(JSON, default=list)
    total_amount = Column(Float)
    currency = Column(String(3), default="AUD")

    # ── <additionalDetails> — MANDATORY ─────────────────────────────────────────
    # offence_type: SMROffenceType enum value — MANDATORY, exactly 1, human-selected
    offence_type = Column(String(50))
    is_terrorism_related = Column(
        Boolean, default=False
    )  # derived from offence_type == TERRORISM; 24h deadline
    prev_reported_refs = Column(
        JSON, default=list
    )  # prevReported — prior AUSTRAC report refs
    other_aus_gov_reports = Column(
        JSON, default=list
    )  # otherAusGov — other Australian gov agency reports

    # ── MLRO-authored narrative ──────────────────────────────────────────────────
    narrative = Column(Text)
    evidence_summary = Column(Text)
    related_smr_refs = Column(JSON, default=list)
    supporting_documents = Column(JSON, default=list)

    due_date = Column(Date, index=True)

    reporter_name = Column(String(255))
    reporter_abn = Column(String(11))
    reporter_austrac_id = Column(String(50))

    # Workflow — all fields require explicit human action
    prepared_by = Column(String)
    reviewed_by = Column(String)
    mlro_sign_off = Column(String)  # MLRO user_id
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


# ── Enhanced Customer Due Diligence ──────────────────────────────────────────────


class ECDDStatus(str, enum.Enum):
    pending = "pending"
    completed = "completed"


class ECDDRecord(Base):
    """Enhanced due diligence assessment — PEP, adverse media, beneficial ownership,
    source of wealth, tax-risk and investment-legitimacy review."""

    __tablename__ = "ecdd_records"

    id = Column(String, primary_key=True, default=lambda: f"ecdd_{uuid4().hex[:12]}")
    org_id = Column(
        String,
        ForeignKey("organisations.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    ecdd_id = Column(String(40), unique=True, index=True)  # ECDD-XXXXXXXXXXXX
    customer_id = Column(String, ForeignKey("customers.id"), nullable=False, index=True)

    trigger_reason = Column(Text, nullable=False)

    pep_status = Column(Boolean, default=False)
    adverse_media_found = Column(Boolean, default=False)
    adverse_media_details = Column(Text)

    beneficial_owner_verified = Column(Boolean, default=False)
    beneficial_owner_details = Column(Text)

    source_of_wealth_verified = Column(Boolean, default=False)
    source_of_funds = Column(Text)
    source_of_wealth_notes = Column(Text)

    purpose_of_transaction = Column(Text)
    high_tax_risk = Column(Boolean, default=False)
    tax_risk_notes = Column(Text)

    investment_legitimacy_notes = Column(Text)
    analyst_notes = Column(Text)

    enhanced_risk_score = Column(Float, default=0.0)
    recommendation = Column(String(20))  # approve | monitor | reject
    status = Column(Enum(ECDDStatus), default=ECDDStatus.pending, nullable=False, index=True)

    created_by = Column(String)
    completed_by = Column(String)
    completed_at = Column(DateTime(timezone=True))

    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())

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

    id = Column(String, primary_key=True, default=lambda: f"fil_{uuid4().hex[:12]}")
    org_id = Column(
        String,
        ForeignKey("organisations.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )

    report_type = Column(Enum(ReportType), nullable=False, index=True)
    report_id = Column(String, nullable=False)  # id of IFTIReport/TTRReport/SMRReport
    report_ref = Column(
        String(60), unique=True, index=True
    )  # PSPE-IFTI-I-20260615-0001

    austrac_submission_ref = Column(String(100))  # AUSTRAC confirmation ref
    submitted_by = Column(String, nullable=False)  # user_id
    submitted_at = Column(DateTime(timezone=True), nullable=False)

    period_start = Column(Date)
    period_end = Column(Date)
    amount_aud = Column(Float)

    status = Column(
        String(20), nullable=False, default="submitted"
    )  # submitted|acknowledged|rejected
    acknowledgement_ref = Column(String(100))
    acknowledgement_at = Column(DateTime(timezone=True))
    rejected_reason = Column(Text)

    notes = Column(Text)
    supersedes_id = Column(String, ForeignKey("filing_register.id"), nullable=True)

    created_at = Column(DateTime(timezone=True), server_default=func.now(), index=True)
    # Intentionally NO updated_at — immutable record

    __table_args__ = (Index("ix_filing_org_type", "org_id", "report_type"),)
