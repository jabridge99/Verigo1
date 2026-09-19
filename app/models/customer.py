"""
Customer master record — supports Individual (KYC) and Business (KYB) under one framework.

CDD levels: standard | simplified | enhanced
All AML-sensitive fields (risk_score, cdd_level, pep_type) are NEVER user-settable via API;
they are set only by the scoring engine or privileged compliance roles.
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
    Integer,
    String,
    Text,
    UniqueConstraint,
    func,
)
from sqlalchemy.orm import Mapped, relationship

from app.db.database import Base
from app.services.crypto import EncryptedKycString

# ── Enums ─────────────────────────────────────────────────────────────────────


class CustomerType(str, enum.Enum):
    individual = "individual"
    sole_trader = "sole_trader"
    company = "company"
    trust = "trust"
    partnership = "partnership"
    association = "association"
    government = "government"


class CustomerStatus(str, enum.Enum):
    draft = "draft"  # record created, not submitted
    pending = "pending"  # submitted, awaiting review
    under_review = "under_review"  # compliance reviewing
    edd_required = "edd_required"  # escalated to EDD
    active = "active"  # CDD complete, relationship open
    suspended = "suspended"  # relationship suspended pending investigation
    rejected = "rejected"  # onboarding rejected
    closed = "closed"  # relationship exited


class CDDLevel(str, enum.Enum):
    simplified = "simplified"  # lower risk, AUSTRAC s.36A
    standard = "standard"  # default CDD
    enhanced = "enhanced"  # EDD — PEP, high-risk country, complex structure


class RiskLevel(str, enum.Enum):
    low = "low"
    medium = "medium"
    high = "high"
    critical = "critical"


class PEPType(str, enum.Enum):
    domestic = "domestic"  # Australian political figure
    foreign = "foreign"  # foreign political figure
    international_org = "international_org"  # IO official
    rca = "rca"  # relative or close associate


class OnboardingChannel(str, enum.Enum):
    online = "online"
    mobile = "mobile"
    branch = "branch"
    introduced = "introduced"  # via introducer arrangement
    third_party = "third_party"  # third-party reliance (AML/CTF Act s.38)
    phone = "phone"


class NoteType(str, enum.Enum):
    general = "general"
    compliance = "compliance"
    edd_justification = "edd_justification"
    review_outcome = "review_outcome"
    escalation = "escalation"
    alert_disposition = "alert_disposition"


# ── Customer master ────────────────────────────────────────────────────────────


class Customer(Base):
    __tablename__ = "customers"
    __table_args__ = (
        # customer_ref is generated per-org (_next_customer_ref() counts only
        # that org's existing customers), so it was never actually globally
        # unique -- two different orgs onboarding their Nth customer of the
        # same calendar year always generate the identical ref (e.g. both
        # orgs' first customer ever both get "KYC-2026-00001"), which a
        # global UNIQUE constraint on customer_ref alone would reject on the
        # second org's insert. Scoped to match the generator's real intent.
        UniqueConstraint("org_id", "customer_ref", name="uq_customer_org_ref"),
    )

    id: Mapped[str] = Column(
        String, primary_key=True, default=lambda: f"cust_{uuid4().hex[:12]}"
    )
    customer_ref: Mapped[str] = Column(String(30), nullable=False, index=True)
    org_id: Mapped[str] = Column(
        String,
        ForeignKey("organisations.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    customer_type: Mapped[CustomerType] = Column(
        Enum(CustomerType, name="master_customer_type"),
        nullable=False,
        default=CustomerType.individual,
    )
    status: Mapped[CustomerStatus] = Column(
        Enum(CustomerStatus), default=CustomerStatus.draft, nullable=False, index=True
    )
    cdd_level: Mapped[CDDLevel] = Column(
        Enum(CDDLevel), default=CDDLevel.standard, nullable=False
    )

    # ── Individual / Sole Trader ──────────────────────────────────────────────
    full_name: Mapped[str] = Column(String(255), nullable=False)
    date_of_birth: Mapped[Optional[date]] = Column(Date)
    country_of_birth: Mapped[Optional[str]] = Column(String(2))
    nationality: Mapped[Optional[str]] = Column(String(2))  # primary ISO 3166-1 alpha-2
    dual_nationality: Mapped[Optional[str]] = Column(
        String(2)
    )  # second nationality where applicable
    country_of_residence: Mapped[Optional[str]] = Column(String(2))
    occupation: Mapped[Optional[str]] = Column(String(255))
    employer_name: Mapped[Optional[str]] = Column(String(255))
    employer_address: Mapped[Optional[str]] = Column(String(500))
    tax_residency_country: Mapped[Optional[str]] = Column(String(2))
    # P51: encrypted at rest via app.services.crypto.EncryptedKycString --
    # 255, not 50, to hold the Fernet-encrypted token (~165 chars incl.
    # the "kyc:" prefix), not just the raw digits.
    tax_identification_number: Mapped[Optional[str]] = Column(
        EncryptedKycString(255)
    )  # TFN/TIN
    fatca_applicable: Mapped[Optional[bool]] = Column(Boolean, default=False)
    crs_applicable: Mapped[Optional[bool]] = Column(Boolean, default=False)

    # ── Business / KYB ───────────────────────────────────────────────────────
    # Stored in BusinessDetail child record; FK set after flush.
    # use_alter=True: customer_business_details.customer_id FKs back to
    # customers.id, making this a genuine circular FK pair. SQLAlchemy's
    # own create_all()/drop_all() can't topologically sort a real cycle
    # without one side marked use_alter (deferred to an ALTER TABLE
    # statement) -- Alembic's migration chain already applies fine against
    # Postgres since each ALTER TABLE ADD CONSTRAINT there is independent,
    # but create_all()/drop_all() (what the test suite uses) previously hit
    # a CircularDependencyError the moment it ran against real Postgres FK
    # enforcement; SQLite's DDL is loose enough to never surface it.
    business_detail_id: Mapped[Optional[str]] = Column(
        String,
        ForeignKey(
            "customer_business_details.id",
            use_alter=True,
            name="fk_customers_business_detail_id",
        ),
        nullable=True,
    )

    # ── Contact ──────────────────────────────────────────────────────────────
    email: Mapped[Optional[str]] = Column(String(255), index=True)
    phone: Mapped[Optional[str]] = Column(String(50))

    # ── Residential address ───────────────────────────────────────────────────
    address_line1: Mapped[Optional[str]] = Column(String(255))
    address_line2: Mapped[Optional[str]] = Column(String(255))
    city: Mapped[Optional[str]] = Column(String(100))
    state: Mapped[Optional[str]] = Column(String(50))
    postcode: Mapped[Optional[str]] = Column(String(10))
    country: Mapped[Optional[str]] = Column(String(2), default="AU")

    # ── Mailing address (separate where different) ────────────────────────────
    mail_address_line1: Mapped[Optional[str]] = Column(String(255))
    mail_address_line2: Mapped[Optional[str]] = Column(String(255))
    mail_city: Mapped[Optional[str]] = Column(String(100))
    mail_state: Mapped[Optional[str]] = Column(String(50))
    mail_postcode: Mapped[Optional[str]] = Column(String(10))
    mail_country: Mapped[Optional[str]] = Column(String(2))
    mail_same_as_residential: Mapped[Optional[bool]] = Column(Boolean, default=True)

    # ── AML risk fields (set by engine / compliance only) ─────────────────────
    risk_level: Mapped[RiskLevel] = Column(
        Enum(RiskLevel), default=RiskLevel.low, nullable=False
    )
    risk_score: Mapped[float] = Column(Float, default=0.0, nullable=False)
    is_pep: Mapped[bool] = Column(Boolean, default=False, nullable=False)
    pep_type: Mapped[Optional[PEPType]] = Column(Enum(PEPType), nullable=True)
    pep_details: Mapped[Optional[str]] = Column(Text)
    is_sanctions_match: Mapped[bool] = Column(Boolean, default=False, nullable=False)
    is_adverse_media: Mapped[bool] = Column(Boolean, default=False, nullable=False)
    is_reporting_group_member: Mapped[Optional[bool]] = Column(Boolean, default=False)
    reporting_group_id: Mapped[Optional[str]] = Column(
        String, nullable=True
    )  # FK to future reporting_groups table

    # ── Source of funds / wealth ──────────────────────────────────────────────
    source_of_funds: Mapped[Optional[str]] = Column(Text)
    source_of_funds_verified: Mapped[Optional[bool]] = Column(Boolean, default=False)
    source_of_wealth: Mapped[Optional[str]] = Column(Text)
    source_of_wealth_verified: Mapped[Optional[bool]] = Column(Boolean, default=False)

    # ── Onboarding metadata ───────────────────────────────────────────────────
    onboarding_channel: Mapped[Optional[OnboardingChannel]] = Column(
        Enum(OnboardingChannel), default=OnboardingChannel.online
    )
    introduced_by: Mapped[Optional[str]] = Column(String)  # user_id of introducer
    relationship_manager: Mapped[Optional[str]] = Column(String)  # user_id of RM
    onboarded_by: Mapped[Optional[str]] = Column(
        String
    )  # user_id of staff who created record

    # ── Review schedule ───────────────────────────────────────────────────────
    last_reviewed_date: Mapped[Optional[date]] = Column(Date)
    last_reviewed_by: Mapped[Optional[str]] = Column(String)  # user_id
    next_review_date: Mapped[Optional[date]] = Column(Date)

    # ── Metadata ──────────────────────────────────────────────────────────────
    custom_fields: Mapped[Optional[Any]] = Column(JSON, default=dict)
    created_at: Mapped[Optional[datetime]] = Column(
        DateTime(timezone=True), server_default=func.now()
    )
    updated_at: Mapped[Optional[datetime]] = Column(
        DateTime(timezone=True), onupdate=func.now()
    )

    # ── Relationships ─────────────────────────────────────────────────────────
    organisation = relationship("Organisation", back_populates="customers")
    business_detail = relationship(
        "BusinessDetail", foreign_keys=[business_detail_id], uselist=False
    )
    previous_names = relationship(
        "CustomerPreviousName", back_populates="customer", cascade="all, delete-orphan"
    )
    identity_documents = relationship(
        "CustomerIdentityDocument",
        back_populates="customer",
        cascade="all, delete-orphan",
    )
    selfie_verifications = relationship(
        "CustomerSelfieVerification",
        back_populates="customer",
        cascade="all, delete-orphan",
    )
    address_verifications = relationship(
        "CustomerAddressVerification",
        back_populates="customer",
        cascade="all, delete-orphan",
    )
    phone_verifications = relationship(
        "CustomerPhoneVerification",
        back_populates="customer",
        cascade="all, delete-orphan",
    )
    email_verifications = relationship(
        "CustomerEmailVerification",
        back_populates="customer",
        cascade="all, delete-orphan",
    )
    beneficial_owners = relationship(
        "BeneficialOwner", back_populates="customer", cascade="all, delete-orphan"
    )
    corporate_documents = relationship(
        "CorporateDocument", back_populates="customer", cascade="all, delete-orphan"
    )
    screening_records = relationship(
        "ScreeningRecord", back_populates="customer", cascade="all, delete-orphan"
    )
    risk_score_history = relationship(
        "CustomerRiskScoreHistory",
        back_populates="customer",
        cascade="all, delete-orphan",
    )
    reviews = relationship(
        "CustomerReview", back_populates="customer", cascade="all, delete-orphan"
    )
    notes = relationship(
        "CustomerNote", back_populates="customer", cascade="all, delete-orphan"
    )
    onboarding_checklist = relationship(
        "CustomerOnboardingChecklist",
        back_populates="customer",
        uselist=False,
        cascade="all, delete-orphan",
    )
    transactions = relationship("Transaction", back_populates="customer")
    cases = relationship("Case", back_populates="customer")


# ── Previous names ─────────────────────────────────────────────────────────────


class CustomerPreviousName(Base):
    __tablename__ = "customer_previous_names"

    id: Mapped[str] = Column(
        String, primary_key=True, default=lambda: f"pn_{uuid4().hex[:12]}"
    )
    customer_id: Mapped[str] = Column(
        String,
        ForeignKey("customers.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    org_id: Mapped[str] = Column(String, nullable=False, index=True)
    full_name: Mapped[str] = Column(String(255), nullable=False)
    name_type: Mapped[Optional[str]] = Column(
        String(50)
    )  # birth_name | maiden_name | alias | previous_name
    used_from: Mapped[Optional[date]] = Column(Date)
    used_to: Mapped[Optional[date]] = Column(Date)
    reason: Mapped[Optional[str]] = Column(String(255))  # marriage | deed_poll | etc.
    created_by: Mapped[Optional[str]] = Column(String)
    created_at: Mapped[Optional[datetime]] = Column(
        DateTime(timezone=True), server_default=func.now()
    )

    customer = relationship("Customer", back_populates="previous_names")


# ── Business Detail (KYB) ──────────────────────────────────────────────────────


class BusinessDetail(Base):
    __tablename__ = "customer_business_details"

    id: Mapped[str] = Column(
        String, primary_key=True, default=lambda: f"biz_{uuid4().hex[:12]}"
    )
    org_id: Mapped[str] = Column(String, nullable=False, index=True)
    customer_id: Mapped[str] = Column(
        String,
        ForeignKey("customers.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )

    legal_name: Mapped[str] = Column(String(255), nullable=False)
    trading_name: Mapped[Optional[str]] = Column(String(255))
    abn: Mapped[Optional[str]] = Column(String(11), index=True)
    acn: Mapped[Optional[str]] = Column(String(9), index=True)
    registration_number: Mapped[Optional[str]] = Column(String(50))
    business_type: Mapped[Optional[str]] = Column(
        String(100)
    )  # Pty Ltd | public company | trust | partnership | etc.
    industry_sector: Mapped[Optional[str]] = Column(String(255))
    country_of_incorporation: Mapped[Optional[str]] = Column(String(2), default="AU")
    date_of_incorporation: Mapped[Optional[date]] = Column(Date)

    # Registered address
    reg_address_line1: Mapped[Optional[str]] = Column(String(255))
    reg_address_line2: Mapped[Optional[str]] = Column(String(255))
    reg_city: Mapped[Optional[str]] = Column(String(100))
    reg_state: Mapped[Optional[str]] = Column(String(50))
    reg_postcode: Mapped[Optional[str]] = Column(String(10))
    reg_country: Mapped[Optional[str]] = Column(String(2), default="AU")

    # Principal place of business (if different)
    ppob_address_line1: Mapped[Optional[str]] = Column(String(255))
    ppob_city: Mapped[Optional[str]] = Column(String(100))
    ppob_state: Mapped[Optional[str]] = Column(String(50))
    ppob_postcode: Mapped[Optional[str]] = Column(String(10))
    ppob_country: Mapped[Optional[str]] = Column(String(2))

    # ASIC validation result
    asic_status: Mapped[Optional[str]] = Column(
        String(50)
    )  # registered | deregistered | under_external_admin
    asic_verified_at: Mapped[Optional[datetime]] = Column(DateTime(timezone=True))
    asic_raw_response: Mapped[Optional[Any]] = Column(JSON)

    # ABN validation result
    abn_status: Mapped[Optional[str]] = Column(String(50))  # active | cancelled
    abn_entity_type: Mapped[Optional[str]] = Column(String(100))
    gst_registered: Mapped[Optional[bool]] = Column(Boolean)
    abn_verified_at: Mapped[Optional[datetime]] = Column(DateTime(timezone=True))
    abn_raw_response: Mapped[Optional[Any]] = Column(JSON)

    # Trust-specific
    trust_type: Mapped[Optional[str]] = Column(
        String(100)
    )  # discretionary | unit | hybrid | SMSF
    trust_deed_date: Mapped[Optional[date]] = Column(Date)
    trustee_name: Mapped[Optional[str]] = Column(String(255))

    # Financial profile
    annual_turnover_aud: Mapped[Optional[float]] = Column(Float)
    number_of_employees: Mapped[Optional[str]] = Column(String(20))
    years_in_operation: Mapped[Optional[str]] = Column(String(20))

    website: Mapped[Optional[str]] = Column(String(500))
    primary_contact_name: Mapped[Optional[str]] = Column(String(255))
    primary_contact_email: Mapped[Optional[str]] = Column(String(255))
    primary_contact_phone: Mapped[Optional[str]] = Column(String(50))

    created_at: Mapped[Optional[datetime]] = Column(
        DateTime(timezone=True), server_default=func.now()
    )
    updated_at: Mapped[Optional[datetime]] = Column(
        DateTime(timezone=True), onupdate=func.now()
    )


# ── Beneficial Ownership ───────────────────────────────────────────────────────


class UBOType(str, enum.Enum):
    direct_owner = "direct_owner"  # holds shares directly
    indirect_owner = "indirect_owner"  # owns through intermediate entity
    controller = "controller"  # exercises control (voting/veto rights)
    trustee = "trustee"
    beneficiary = "beneficiary"
    senior_managing_official = "senior_managing_official"  # AUSTRAC definition
    settlor = "settlor"
    protector = "protector"  # trust protector


class BeneficialOwner(Base):
    __tablename__ = "beneficial_owners"

    id: Mapped[str] = Column(
        String, primary_key=True, default=lambda: f"ubo_{uuid4().hex[:12]}"
    )
    customer_id: Mapped[str] = Column(
        String,
        ForeignKey("customers.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    org_id: Mapped[str] = Column(
        String,
        ForeignKey("organisations.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )

    ubo_type: Mapped[UBOType] = Column(
        Enum(UBOType), nullable=False, default=UBOType.direct_owner
    )
    role_title: Mapped[Optional[str]] = Column(String(100))

    full_name: Mapped[str] = Column(String(255), nullable=False)
    date_of_birth: Mapped[Optional[date]] = Column(Date)
    nationality: Mapped[Optional[str]] = Column(String(2))
    country_of_residence: Mapped[Optional[str]] = Column(String(2))
    country_of_birth: Mapped[Optional[str]] = Column(String(2))
    tax_residency_country: Mapped[Optional[str]] = Column(String(2))
    # P51: encrypted at rest, same as Customer.tax_identification_number above.
    tax_identification_number: Mapped[Optional[str]] = Column(EncryptedKycString(255))

    address_line1: Mapped[Optional[str]] = Column(String(255))
    address_line2: Mapped[Optional[str]] = Column(String(255))
    city: Mapped[Optional[str]] = Column(String(100))
    state: Mapped[Optional[str]] = Column(String(50))
    postcode: Mapped[Optional[str]] = Column(String(10))
    country: Mapped[Optional[str]] = Column(String(2), default="AU")

    id_type: Mapped[Optional[str]] = Column(String(50))
    # P51: encrypted at rest, same as tax_identification_number above.
    id_number: Mapped[Optional[str]] = Column(EncryptedKycString(255))
    id_issuing_country: Mapped[Optional[str]] = Column(String(2))
    id_expiry: Mapped[Optional[date]] = Column(Date)

    ownership_percentage: Mapped[Optional[float]] = Column(Float)
    control_percentage: Mapped[Optional[float]] = Column(
        Float
    )  # may differ from ownership %
    intermediate_entity: Mapped[Optional[str]] = Column(
        String(255)
    )  # if indirect owner

    is_pep: Mapped[Optional[bool]] = Column(Boolean, default=False)
    pep_type: Mapped[Optional[PEPType]] = Column(Enum(PEPType), nullable=True)
    pep_details: Mapped[Optional[str]] = Column(Text)
    source_of_wealth: Mapped[Optional[str]] = Column(Text)

    verified: Mapped[Optional[bool]] = Column(Boolean, default=False)
    verified_by: Mapped[Optional[str]] = Column(String)
    verified_at: Mapped[Optional[datetime]] = Column(DateTime(timezone=True))
    verification_notes: Mapped[Optional[str]] = Column(Text)

    created_by: Mapped[Optional[str]] = Column(String)
    created_at: Mapped[Optional[datetime]] = Column(
        DateTime(timezone=True), server_default=func.now()
    )
    updated_at: Mapped[Optional[datetime]] = Column(
        DateTime(timezone=True), onupdate=func.now()
    )

    customer = relationship("Customer", back_populates="beneficial_owners")


# ── Corporate Documents (KYB) ──────────────────────────────────────────────────


class CorporateDocumentType(str, enum.Enum):
    company_extract = "company_extract"
    certificate_of_incorporation = "certificate_of_incorporation"
    constitution = "constitution"
    trust_deed = "trust_deed"
    partnership_agreement = "partnership_agreement"
    shareholder_register = "shareholder_register"
    annual_return = "annual_return"
    financial_statements = "financial_statements"
    tax_document = "tax_document"
    source_of_funds = "source_of_funds"
    source_of_wealth = "source_of_wealth"
    contract_of_sale = "contract_of_sale"
    loan_document = "loan_document"
    other = "other"


class CorporateDocument(Base):
    __tablename__ = "customer_corporate_documents"

    id: Mapped[str] = Column(
        String, primary_key=True, default=lambda: f"cdoc_{uuid4().hex[:12]}"
    )
    customer_id: Mapped[str] = Column(
        String,
        ForeignKey("customers.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    org_id: Mapped[str] = Column(String, nullable=False, index=True)

    document_type: Mapped[CorporateDocumentType] = Column(
        Enum(CorporateDocumentType), nullable=False
    )
    document_ref: Mapped[Optional[str]] = Column(
        String(255)
    )  # file storage reference / S3 key
    file_name: Mapped[Optional[str]] = Column(String(500))
    description: Mapped[Optional[str]] = Column(String(500))
    issue_date: Mapped[Optional[date]] = Column(Date)
    expiry_date: Mapped[Optional[date]] = Column(Date)
    issuing_authority: Mapped[Optional[str]] = Column(String(255))

    verified: Mapped[Optional[bool]] = Column(Boolean, default=False)
    verified_by: Mapped[Optional[str]] = Column(String)
    verified_at: Mapped[Optional[datetime]] = Column(DateTime(timezone=True))
    verification_notes: Mapped[Optional[str]] = Column(Text)

    uploaded_by: Mapped[Optional[str]] = Column(String)
    created_at: Mapped[Optional[datetime]] = Column(
        DateTime(timezone=True), server_default=func.now()
    )

    customer = relationship("Customer", back_populates="corporate_documents")


# ── Risk Score History (immutable) ─────────────────────────────────────────────


class CustomerRiskScoreHistory(Base):
    __tablename__ = "customer_risk_score_history"

    id: Mapped[str] = Column(
        String, primary_key=True, default=lambda: f"rsh_{uuid4().hex[:12]}"
    )
    customer_id: Mapped[str] = Column(
        String,
        ForeignKey("customers.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    org_id: Mapped[str] = Column(String, nullable=False, index=True)

    risk_score: Mapped[float] = Column(Float, nullable=False)
    risk_level: Mapped[RiskLevel] = Column(Enum(RiskLevel), nullable=False)
    cdd_level: Mapped[CDDLevel] = Column(Enum(CDDLevel), nullable=False)
    scoring_factors: Mapped[Optional[Any]] = Column(
        JSON
    )  # breakdown of contributing factors

    # Inherent/residual breakdown (same formula as app.services.risk_engine):
    # inherent = likelihood x consequence, residual = inherent x CEF.
    # Nullable — populated only when the customer-level scoring run computes
    # a full breakdown; legacy rows and simple manual scores leave these null.
    inherent_score: Mapped[Optional[float]] = Column(Float)
    residual_score: Mapped[Optional[float]] = Column(Float)
    control_effectiveness_score: Mapped[Optional[int]] = Column(
        Integer
    )  # 1-5, see ControlEffectivenessScore

    trigger: Mapped[Optional[str]] = Column(
        String(100)
    )  # onboarding | periodic_review | event | manual
    triggered_by: Mapped[Optional[str]] = Column(String)  # user_id or "system"
    notes: Mapped[Optional[str]] = Column(Text)
    scored_at: Mapped[Optional[datetime]] = Column(
        DateTime(timezone=True), server_default=func.now()
    )

    customer = relationship("Customer", back_populates="risk_score_history")


# ── Periodic Review ────────────────────────────────────────────────────────────


class ReviewOutcome(str, enum.Enum):
    no_change = "no_change"
    risk_upgraded = "risk_upgraded"
    risk_downgraded = "risk_downgraded"
    edd_triggered = "edd_triggered"
    relationship_exited = "relationship_exited"
    smr_filed = "smr_filed"


class CustomerReview(Base):
    __tablename__ = "customer_reviews"

    id: Mapped[str] = Column(
        String, primary_key=True, default=lambda: f"rev_{uuid4().hex[:12]}"
    )
    customer_id: Mapped[str] = Column(
        String,
        ForeignKey("customers.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    org_id: Mapped[str] = Column(String, nullable=False, index=True)

    review_type: Mapped[Optional[str]] = Column(
        String(50)
    )  # periodic | trigger_event | ad_hoc
    trigger_reason: Mapped[Optional[str]] = Column(String(255))
    review_date: Mapped[date] = Column(Date, nullable=False)
    next_review_date: Mapped[Optional[date]] = Column(Date)
    reviewed_by: Mapped[str] = Column(String, nullable=False)
    outcome: Mapped[Optional[ReviewOutcome]] = Column(
        Enum(ReviewOutcome, name="customer_review_outcome")
    )
    outcome_notes: Mapped[Optional[str]] = Column(Text)
    documents_reviewed: Mapped[Optional[Any]] = Column(
        JSON
    )  # list of document IDs checked
    risk_score_before: Mapped[Optional[float]] = Column(Float)
    risk_score_after: Mapped[Optional[float]] = Column(Float)
    cdd_level_before: Mapped[Optional[CDDLevel]] = Column(Enum(CDDLevel))
    cdd_level_after: Mapped[Optional[CDDLevel]] = Column(Enum(CDDLevel))

    created_at: Mapped[Optional[datetime]] = Column(
        DateTime(timezone=True), server_default=func.now()
    )

    customer = relationship("Customer", back_populates="reviews")


# ── Compliance Notes (append-only) ────────────────────────────────────────────


class CustomerNote(Base):
    __tablename__ = "customer_notes"

    id: Mapped[str] = Column(
        String, primary_key=True, default=lambda: f"note_{uuid4().hex[:12]}"
    )
    customer_id: Mapped[str] = Column(
        String,
        ForeignKey("customers.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    org_id: Mapped[str] = Column(String, nullable=False, index=True)

    note_type: Mapped[NoteType] = Column(
        Enum(NoteType, name="customer_note_type"),
        default=NoteType.general,
        nullable=False,
    )
    content: Mapped[str] = Column(Text, nullable=False)
    is_confidential: Mapped[Optional[bool]] = Column(
        Boolean, default=False
    )  # mlro-only visibility
    created_by: Mapped[str] = Column(String, nullable=False)
    created_at: Mapped[Optional[datetime]] = Column(
        DateTime(timezone=True), server_default=func.now()
    )

    customer = relationship("Customer", back_populates="notes")


# ── Onboarding Checklist ───────────────────────────────────────────────────────


class CustomerOnboardingChecklist(Base):
    """Tracks which CDD verification steps are complete. One record per customer."""

    __tablename__ = "customer_onboarding_checklists"

    id: Mapped[str] = Column(
        String, primary_key=True, default=lambda: f"chk_{uuid4().hex[:12]}"
    )
    customer_id: Mapped[str] = Column(
        String,
        ForeignKey("customers.id", ondelete="CASCADE"),
        nullable=False,
        unique=True,
        index=True,
    )
    org_id: Mapped[str] = Column(String, nullable=False, index=True)

    # Individual KYC steps
    identity_document_verified: Mapped[Optional[bool]] = Column(Boolean, default=False)
    selfie_verified: Mapped[Optional[bool]] = Column(Boolean, default=False)
    address_verified: Mapped[Optional[bool]] = Column(Boolean, default=False)
    phone_verified: Mapped[Optional[bool]] = Column(Boolean, default=False)
    email_verified: Mapped[Optional[bool]] = Column(Boolean, default=False)
    pep_screened: Mapped[Optional[bool]] = Column(Boolean, default=False)
    sanctions_screened: Mapped[Optional[bool]] = Column(Boolean, default=False)
    adverse_media_screened: Mapped[Optional[bool]] = Column(Boolean, default=False)

    # Business KYB steps
    abn_verified: Mapped[Optional[bool]] = Column(Boolean, default=False)
    asic_verified: Mapped[Optional[bool]] = Column(Boolean, default=False)
    corporate_docs_collected: Mapped[Optional[bool]] = Column(Boolean, default=False)
    ubo_identified: Mapped[Optional[bool]] = Column(Boolean, default=False)
    ubo_verified: Mapped[Optional[bool]] = Column(Boolean, default=False)
    ubo_screened: Mapped[Optional[bool]] = Column(Boolean, default=False)

    # EDD steps (when cdd_level = enhanced)
    edd_source_of_funds_verified: Mapped[Optional[bool]] = Column(
        Boolean, default=False
    )
    edd_source_of_wealth_verified: Mapped[Optional[bool]] = Column(
        Boolean, default=False
    )
    edd_senior_approval_obtained: Mapped[Optional[bool]] = Column(
        Boolean, default=False
    )

    # Completion
    is_complete: Mapped[Optional[bool]] = Column(Boolean, default=False)
    completed_at: Mapped[Optional[datetime]] = Column(DateTime(timezone=True))
    completed_by: Mapped[Optional[str]] = Column(String)

    created_at: Mapped[Optional[datetime]] = Column(
        DateTime(timezone=True), server_default=func.now()
    )
    updated_at: Mapped[Optional[datetime]] = Column(
        DateTime(timezone=True), onupdate=func.now()
    )

    customer = relationship("Customer", back_populates="onboarding_checklist")
