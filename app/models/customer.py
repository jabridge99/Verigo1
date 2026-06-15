"""
Customer master record — supports Individual (KYC) and Business (KYB) under one framework.

CDD levels: standard | simplified | enhanced
All AML-sensitive fields (risk_score, cdd_level, pep_type) are NEVER user-settable via API;
they are set only by the scoring engine or privileged compliance roles.
"""
import enum
from datetime import date
from uuid import uuid4

from sqlalchemy import (
    JSON, Boolean, Column, Date, DateTime, Enum, Float,
    ForeignKey, String, Text, func,
)
from sqlalchemy.orm import relationship

from app.db.database import Base


# ── Enums ─────────────────────────────────────────────────────────────────────

class CustomerType(str, enum.Enum):
    individual      = "individual"
    sole_trader     = "sole_trader"
    company         = "company"
    trust           = "trust"
    partnership     = "partnership"
    association     = "association"
    government      = "government"


class CustomerStatus(str, enum.Enum):
    draft           = "draft"           # record created, not submitted
    pending         = "pending"         # submitted, awaiting review
    under_review    = "under_review"    # compliance reviewing
    edd_required    = "edd_required"    # escalated to EDD
    active          = "active"          # CDD complete, relationship open
    suspended       = "suspended"       # relationship suspended pending investigation
    rejected        = "rejected"        # onboarding rejected
    closed          = "closed"          # relationship exited


class CDDLevel(str, enum.Enum):
    simplified  = "simplified"   # lower risk, AUSTRAC s.36A
    standard    = "standard"     # default CDD
    enhanced    = "enhanced"     # EDD — PEP, high-risk country, complex structure


class RiskLevel(str, enum.Enum):
    low         = "low"
    medium      = "medium"
    high        = "high"
    critical    = "critical"


class PEPType(str, enum.Enum):
    domestic            = "domestic"            # Australian political figure
    foreign             = "foreign"             # foreign political figure
    international_org   = "international_org"   # IO official
    rca                 = "rca"                 # relative or close associate


class OnboardingChannel(str, enum.Enum):
    online          = "online"
    mobile          = "mobile"
    branch          = "branch"
    introduced      = "introduced"      # via introducer arrangement
    third_party     = "third_party"     # third-party reliance (AML/CTF Act s.38)
    phone           = "phone"


class NoteType(str, enum.Enum):
    general             = "general"
    compliance          = "compliance"
    edd_justification   = "edd_justification"
    review_outcome      = "review_outcome"
    escalation          = "escalation"
    alert_disposition   = "alert_disposition"


# ── Customer master ────────────────────────────────────────────────────────────

class Customer(Base):
    __tablename__ = "customers"

    id = Column(String, primary_key=True, default=lambda: f"cust_{uuid4().hex[:12]}")
    customer_ref = Column(String(30), unique=True, nullable=False, index=True)
    org_id = Column(String, ForeignKey("organisations.id", ondelete="CASCADE"), nullable=False, index=True)
    customer_type = Column(Enum(CustomerType), nullable=False, default=CustomerType.individual)
    status = Column(Enum(CustomerStatus), default=CustomerStatus.draft, nullable=False, index=True)
    cdd_level = Column(Enum(CDDLevel), default=CDDLevel.standard, nullable=False)

    # ── Individual / Sole Trader ──────────────────────────────────────────────
    full_name = Column(String(255), nullable=False)
    date_of_birth = Column(Date)
    country_of_birth = Column(String(2))
    nationality = Column(String(2))          # primary ISO 3166-1 alpha-2
    dual_nationality = Column(String(2))     # second nationality where applicable
    country_of_residence = Column(String(2))
    occupation = Column(String(255))
    employer_name = Column(String(255))
    employer_address = Column(String(500))
    tax_residency_country = Column(String(2))
    tax_identification_number = Column(String(50))   # TFN/TIN
    fatca_applicable = Column(Boolean, default=False)
    crs_applicable = Column(Boolean, default=False)

    # ── Business / KYB ───────────────────────────────────────────────────────
    # Stored in BusinessDetail child record; FK set after flush
    business_detail_id = Column(String, ForeignKey("customer_business_details.id"), nullable=True)

    # ── Contact ──────────────────────────────────────────────────────────────
    email = Column(String(255), index=True)
    phone = Column(String(50))

    # ── Residential address ───────────────────────────────────────────────────
    address_line1 = Column(String(255))
    address_line2 = Column(String(255))
    city = Column(String(100))
    state = Column(String(50))
    postcode = Column(String(10))
    country = Column(String(2), default="AU")

    # ── Mailing address (separate where different) ────────────────────────────
    mail_address_line1 = Column(String(255))
    mail_address_line2 = Column(String(255))
    mail_city = Column(String(100))
    mail_state = Column(String(50))
    mail_postcode = Column(String(10))
    mail_country = Column(String(2))
    mail_same_as_residential = Column(Boolean, default=True)

    # ── AML risk fields (set by engine / compliance only) ─────────────────────
    risk_level = Column(Enum(RiskLevel), default=RiskLevel.low, nullable=False)
    risk_score = Column(Float, default=0.0, nullable=False)
    is_pep = Column(Boolean, default=False, nullable=False)
    pep_type = Column(Enum(PEPType), nullable=True)
    pep_details = Column(Text)
    is_sanctions_match = Column(Boolean, default=False, nullable=False)
    is_adverse_media = Column(Boolean, default=False, nullable=False)
    is_reporting_group_member = Column(Boolean, default=False)
    reporting_group_id = Column(String, nullable=True)    # FK to future reporting_groups table

    # ── Source of funds / wealth ──────────────────────────────────────────────
    source_of_funds = Column(Text)
    source_of_funds_verified = Column(Boolean, default=False)
    source_of_wealth = Column(Text)
    source_of_wealth_verified = Column(Boolean, default=False)

    # ── Onboarding metadata ───────────────────────────────────────────────────
    onboarding_channel = Column(Enum(OnboardingChannel), default=OnboardingChannel.online)
    introduced_by = Column(String)          # user_id of introducer
    relationship_manager = Column(String)   # user_id of RM
    onboarded_by = Column(String)           # user_id of staff who created record

    # ── Review schedule ───────────────────────────────────────────────────────
    last_reviewed_date = Column(Date)
    last_reviewed_by = Column(String)       # user_id
    next_review_date = Column(Date)

    # ── Metadata ──────────────────────────────────────────────────────────────
    custom_fields = Column(JSON, default=dict)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())

    # ── Relationships ─────────────────────────────────────────────────────────
    organisation        = relationship("Organisation", back_populates="customers")
    business_detail     = relationship("BusinessDetail", foreign_keys=[business_detail_id], uselist=False)
    previous_names      = relationship("CustomerPreviousName", back_populates="customer", cascade="all, delete-orphan")
    identity_documents  = relationship("CustomerIdentityDocument", back_populates="customer", cascade="all, delete-orphan")
    selfie_verifications= relationship("CustomerSelfieVerification", back_populates="customer", cascade="all, delete-orphan")
    address_verifications= relationship("CustomerAddressVerification", back_populates="customer", cascade="all, delete-orphan")
    phone_verifications = relationship("CustomerPhoneVerification", back_populates="customer", cascade="all, delete-orphan")
    email_verifications = relationship("CustomerEmailVerification", back_populates="customer", cascade="all, delete-orphan")
    beneficial_owners   = relationship("BeneficialOwner", back_populates="customer", cascade="all, delete-orphan")
    corporate_documents = relationship("CorporateDocument", back_populates="customer", cascade="all, delete-orphan")
    screening_records   = relationship("ScreeningRecord", back_populates="customer", cascade="all, delete-orphan")
    risk_score_history  = relationship("CustomerRiskScoreHistory", back_populates="customer", cascade="all, delete-orphan")
    reviews             = relationship("CustomerReview", back_populates="customer", cascade="all, delete-orphan")
    notes               = relationship("CustomerNote", back_populates="customer", cascade="all, delete-orphan")
    onboarding_checklist= relationship("CustomerOnboardingChecklist", back_populates="customer", uselist=False, cascade="all, delete-orphan")
    transactions        = relationship("Transaction", back_populates="customer")
    cases               = relationship("Case", back_populates="customer")


# ── Previous names ─────────────────────────────────────────────────────────────

class CustomerPreviousName(Base):
    __tablename__ = "customer_previous_names"

    id = Column(String, primary_key=True, default=lambda: f"pn_{uuid4().hex[:12]}")
    customer_id = Column(String, ForeignKey("customers.id", ondelete="CASCADE"), nullable=False, index=True)
    org_id = Column(String, nullable=False, index=True)
    full_name = Column(String(255), nullable=False)
    name_type = Column(String(50))          # birth_name | maiden_name | alias | previous_name
    used_from = Column(Date)
    used_to = Column(Date)
    reason = Column(String(255))            # marriage | deed_poll | etc.
    created_by = Column(String)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    customer = relationship("Customer", back_populates="previous_names")


# ── Business Detail (KYB) ──────────────────────────────────────────────────────

class BusinessDetail(Base):
    __tablename__ = "customer_business_details"

    id = Column(String, primary_key=True, default=lambda: f"biz_{uuid4().hex[:12]}")
    org_id = Column(String, nullable=False, index=True)
    customer_id = Column(String, ForeignKey("customers.id", ondelete="CASCADE"), nullable=False, index=True)

    legal_name = Column(String(255), nullable=False)
    trading_name = Column(String(255))
    abn = Column(String(11), index=True)
    acn = Column(String(9), index=True)
    registration_number = Column(String(50))
    business_type = Column(String(100))     # Pty Ltd | public company | trust | partnership | etc.
    industry_sector = Column(String(255))
    country_of_incorporation = Column(String(2), default="AU")
    date_of_incorporation = Column(Date)

    # Registered address
    reg_address_line1 = Column(String(255))
    reg_address_line2 = Column(String(255))
    reg_city = Column(String(100))
    reg_state = Column(String(50))
    reg_postcode = Column(String(10))
    reg_country = Column(String(2), default="AU")

    # Principal place of business (if different)
    ppob_address_line1 = Column(String(255))
    ppob_city = Column(String(100))
    ppob_state = Column(String(50))
    ppob_postcode = Column(String(10))
    ppob_country = Column(String(2))

    # ASIC validation result
    asic_status = Column(String(50))        # registered | deregistered | under_external_admin
    asic_verified_at = Column(DateTime(timezone=True))
    asic_raw_response = Column(JSON)

    # ABN validation result
    abn_status = Column(String(50))         # active | cancelled
    abn_entity_type = Column(String(100))
    gst_registered = Column(Boolean)
    abn_verified_at = Column(DateTime(timezone=True))
    abn_raw_response = Column(JSON)

    # Trust-specific
    trust_type = Column(String(100))        # discretionary | unit | hybrid | SMSF
    trust_deed_date = Column(Date)
    trustee_name = Column(String(255))

    # Financial profile
    annual_turnover_aud = Column(Float)
    number_of_employees = Column(String(20))
    years_in_operation = Column(String(20))

    website = Column(String(500))
    primary_contact_name = Column(String(255))
    primary_contact_email = Column(String(255))
    primary_contact_phone = Column(String(50))

    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())


# ── Beneficial Ownership ───────────────────────────────────────────────────────

class UBOType(str, enum.Enum):
    direct_owner        = "direct_owner"        # holds shares directly
    indirect_owner      = "indirect_owner"       # owns through intermediate entity
    controller          = "controller"           # exercises control (voting/veto rights)
    trustee             = "trustee"
    beneficiary         = "beneficiary"
    senior_managing_official = "senior_managing_official"  # AUSTRAC definition
    settlor             = "settlor"
    protector           = "protector"            # trust protector


class BeneficialOwner(Base):
    __tablename__ = "beneficial_owners"

    id = Column(String, primary_key=True, default=lambda: f"ubo_{uuid4().hex[:12]}")
    customer_id = Column(String, ForeignKey("customers.id", ondelete="CASCADE"), nullable=False, index=True)
    org_id = Column(String, ForeignKey("organisations.id", ondelete="CASCADE"), nullable=False, index=True)

    ubo_type = Column(Enum(UBOType), nullable=False, default=UBOType.direct_owner)
    role_title = Column(String(100))

    full_name = Column(String(255), nullable=False)
    date_of_birth = Column(Date)
    nationality = Column(String(2))
    country_of_residence = Column(String(2))
    country_of_birth = Column(String(2))
    tax_residency_country = Column(String(2))
    tax_identification_number = Column(String(50))

    address_line1 = Column(String(255))
    address_line2 = Column(String(255))
    city = Column(String(100))
    state = Column(String(50))
    postcode = Column(String(10))
    country = Column(String(2), default="AU")

    id_type = Column(String(50))
    id_number = Column(String(50))
    id_issuing_country = Column(String(2))
    id_expiry = Column(Date)

    ownership_percentage = Column(Float)
    control_percentage = Column(Float)      # may differ from ownership %
    intermediate_entity = Column(String(255))   # if indirect owner

    is_pep = Column(Boolean, default=False)
    pep_type = Column(Enum(PEPType), nullable=True)
    pep_details = Column(Text)
    source_of_wealth = Column(Text)

    verified = Column(Boolean, default=False)
    verified_by = Column(String)
    verified_at = Column(DateTime(timezone=True))
    verification_notes = Column(Text)

    created_by = Column(String)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())

    customer = relationship("Customer", back_populates="beneficial_owners")


# ── Corporate Documents (KYB) ──────────────────────────────────────────────────

class CorporateDocumentType(str, enum.Enum):
    company_extract             = "company_extract"
    certificate_of_incorporation = "certificate_of_incorporation"
    constitution                = "constitution"
    trust_deed                  = "trust_deed"
    partnership_agreement       = "partnership_agreement"
    shareholder_register        = "shareholder_register"
    annual_return               = "annual_return"
    financial_statements        = "financial_statements"
    tax_document                = "tax_document"
    source_of_funds             = "source_of_funds"
    source_of_wealth            = "source_of_wealth"
    contract_of_sale            = "contract_of_sale"
    loan_document               = "loan_document"
    other                       = "other"


class CorporateDocument(Base):
    __tablename__ = "customer_corporate_documents"

    id = Column(String, primary_key=True, default=lambda: f"cdoc_{uuid4().hex[:12]}")
    customer_id = Column(String, ForeignKey("customers.id", ondelete="CASCADE"), nullable=False, index=True)
    org_id = Column(String, nullable=False, index=True)

    document_type = Column(Enum(CorporateDocumentType), nullable=False)
    document_ref = Column(String(255))      # file storage reference / S3 key
    file_name = Column(String(500))
    description = Column(String(500))
    issue_date = Column(Date)
    expiry_date = Column(Date)
    issuing_authority = Column(String(255))

    verified = Column(Boolean, default=False)
    verified_by = Column(String)
    verified_at = Column(DateTime(timezone=True))
    verification_notes = Column(Text)

    uploaded_by = Column(String)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    customer = relationship("Customer", back_populates="corporate_documents")


# ── Risk Score History (immutable) ─────────────────────────────────────────────

class CustomerRiskScoreHistory(Base):
    __tablename__ = "customer_risk_score_history"

    id = Column(String, primary_key=True, default=lambda: f"rsh_{uuid4().hex[:12]}")
    customer_id = Column(String, ForeignKey("customers.id", ondelete="CASCADE"), nullable=False, index=True)
    org_id = Column(String, nullable=False, index=True)

    risk_score = Column(Float, nullable=False)
    risk_level = Column(Enum(RiskLevel), nullable=False)
    cdd_level = Column(Enum(CDDLevel), nullable=False)
    scoring_factors = Column(JSON)          # breakdown of contributing factors
    trigger = Column(String(100))           # onboarding | periodic_review | event | manual
    triggered_by = Column(String)           # user_id or "system"
    notes = Column(Text)
    scored_at = Column(DateTime(timezone=True), server_default=func.now())

    customer = relationship("Customer", back_populates="risk_score_history")


# ── Periodic Review ────────────────────────────────────────────────────────────

class ReviewOutcome(str, enum.Enum):
    no_change           = "no_change"
    risk_upgraded       = "risk_upgraded"
    risk_downgraded     = "risk_downgraded"
    edd_triggered       = "edd_triggered"
    relationship_exited = "relationship_exited"
    smr_filed           = "smr_filed"


class CustomerReview(Base):
    __tablename__ = "customer_reviews"

    id = Column(String, primary_key=True, default=lambda: f"rev_{uuid4().hex[:12]}")
    customer_id = Column(String, ForeignKey("customers.id", ondelete="CASCADE"), nullable=False, index=True)
    org_id = Column(String, nullable=False, index=True)

    review_type = Column(String(50))            # periodic | trigger_event | ad_hoc
    trigger_reason = Column(String(255))
    review_date = Column(Date, nullable=False)
    next_review_date = Column(Date)
    reviewed_by = Column(String, nullable=False)
    outcome = Column(Enum(ReviewOutcome))
    outcome_notes = Column(Text)
    documents_reviewed = Column(JSON)           # list of document IDs checked
    risk_score_before = Column(Float)
    risk_score_after = Column(Float)
    cdd_level_before = Column(Enum(CDDLevel))
    cdd_level_after = Column(Enum(CDDLevel))

    created_at = Column(DateTime(timezone=True), server_default=func.now())

    customer = relationship("Customer", back_populates="reviews")


# ── Compliance Notes (append-only) ────────────────────────────────────────────

class CustomerNote(Base):
    __tablename__ = "customer_notes"

    id = Column(String, primary_key=True, default=lambda: f"note_{uuid4().hex[:12]}")
    customer_id = Column(String, ForeignKey("customers.id", ondelete="CASCADE"), nullable=False, index=True)
    org_id = Column(String, nullable=False, index=True)

    note_type = Column(Enum(NoteType), default=NoteType.general, nullable=False)
    content = Column(Text, nullable=False)
    is_confidential = Column(Boolean, default=False)    # mlro-only visibility
    created_by = Column(String, nullable=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    customer = relationship("Customer", back_populates="notes")


# ── Onboarding Checklist ───────────────────────────────────────────────────────

class CustomerOnboardingChecklist(Base):
    """Tracks which CDD verification steps are complete. One record per customer."""
    __tablename__ = "customer_onboarding_checklists"

    id = Column(String, primary_key=True, default=lambda: f"chk_{uuid4().hex[:12]}")
    customer_id = Column(String, ForeignKey("customers.id", ondelete="CASCADE"), nullable=False, unique=True, index=True)
    org_id = Column(String, nullable=False, index=True)

    # Individual KYC steps
    identity_document_verified = Column(Boolean, default=False)
    selfie_verified = Column(Boolean, default=False)
    address_verified = Column(Boolean, default=False)
    phone_verified = Column(Boolean, default=False)
    email_verified = Column(Boolean, default=False)
    pep_screened = Column(Boolean, default=False)
    sanctions_screened = Column(Boolean, default=False)
    adverse_media_screened = Column(Boolean, default=False)

    # Business KYB steps
    abn_verified = Column(Boolean, default=False)
    asic_verified = Column(Boolean, default=False)
    corporate_docs_collected = Column(Boolean, default=False)
    ubo_identified = Column(Boolean, default=False)
    ubo_verified = Column(Boolean, default=False)
    ubo_screened = Column(Boolean, default=False)

    # EDD steps (when cdd_level = enhanced)
    edd_source_of_funds_verified = Column(Boolean, default=False)
    edd_source_of_wealth_verified = Column(Boolean, default=False)
    edd_senior_approval_obtained = Column(Boolean, default=False)

    # Completion
    is_complete = Column(Boolean, default=False)
    completed_at = Column(DateTime(timezone=True))
    completed_by = Column(String)

    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())

    customer = relationship("Customer", back_populates="onboarding_checklist")
