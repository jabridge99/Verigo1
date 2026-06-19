"""
AML Solutions — the Organisation's AML/CTF compliance program suite.

AMLSolution is the top-level container product sold to each Organisation.
It includes core modules (Program, Risk Assessment, Policies, Controls, Training)
and optional premium service engagements (billed separately).
"""

import enum
from uuid import uuid4

from sqlalchemy import (
    Boolean,
    Column,
    Date,
    DateTime,
    Enum,
    Float,
    ForeignKey,
    String,
    Text,
    func,
)
from sqlalchemy.orm import relationship

from app.db.database import Base

# ── Enums ─────────────────────────────────────────────────────────────────────


class SolutionStatus(str, enum.Enum):
    active = "active"
    inactive = "inactive"
    suspended = "suspended"


class ProgramStatus(str, enum.Enum):
    draft = "draft"
    active = "active"
    under_review = "under_review"
    superseded = "superseded"


class RiskAppetite(str, enum.Enum):
    low = "low"
    medium = "medium"
    high = "high"


class AssessmentStatus(str, enum.Enum):
    draft = "draft"
    in_progress = "in_progress"
    completed = "completed"
    approved = "approved"


class PolicyStatus(str, enum.Enum):
    draft = "draft"
    active = "active"
    under_review = "under_review"
    superseded = "superseded"


class ControlStatus(str, enum.Enum):
    effective = "effective"
    partially_effective = "partially_effective"
    ineffective = "ineffective"
    not_tested = "not_tested"


class TrainingStatus(str, enum.Enum):
    not_started = "not_started"
    in_progress = "in_progress"
    completed = "completed"
    overdue = "overdue"


class ServiceType(str, enum.Enum):
    austrac_registration = "austrac_registration"  # pre-July 2026 deadline
    annual_compliance_report = "annual_compliance_report"  # EOFY each year
    independent_audit = "independent_audit"  # periodic AML audit & review
    tailored_session = "tailored_session"  # custom consultation


class ServiceStatus(str, enum.Enum):
    pending = "pending"  # requested, not yet started
    scoping = "scoping"  # Verigo team scoping the engagement
    in_progress = "in_progress"
    review = "review"  # deliverable under client review
    completed = "completed"
    cancelled = "cancelled"


# ── AML Solution (top-level container) ───────────────────────────────────────


class AMLSolution(Base):
    """
    Top-level AML/CTF compliance product for an Organisation.
    Created when an organisation subscribes; acts as the container for all
    AML modules and service engagements.
    """

    __tablename__ = "aml_solutions"

    id = Column(String, primary_key=True, default=lambda: f"amls_{uuid4().hex[:12]}")
    org_id = Column(
        String,
        ForeignKey("organisations.id", ondelete="CASCADE"),
        nullable=False,
        unique=True,
        index=True,
    )  # one solution per org
    status = Column(Enum(SolutionStatus), default=SolutionStatus.active, nullable=False)
    template_industry = Column(String(50))  # industry template applied on creation
    activated_at = Column(DateTime(timezone=True))
    created_by = Column(String, nullable=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())

    organisation = relationship("Organisation", back_populates="aml_solution")
    programs = relationship(
        "AMLProgram", back_populates="solution", cascade="all, delete-orphan"
    )
    risk_assessments = relationship(
        "RiskAssessment", back_populates="solution", cascade="all, delete-orphan"
    )
    policies = relationship(
        "AMLPolicy", back_populates="solution", cascade="all, delete-orphan"
    )
    controls = relationship(
        "Control", back_populates="solution", cascade="all, delete-orphan"
    )
    training_records = relationship(
        "TrainingRecord", back_populates="solution", cascade="all, delete-orphan"
    )
    services = relationship(
        "AMLService", back_populates="solution", cascade="all, delete-orphan"
    )


# ── AML Program ──────────────────────────────────────────────────────────────


class AMLProgram(Base):
    """
    The Organisation's AML/CTF Program document.

    Under the AML/CTF Amendment Act 2024 and Rules 2025 (commencing 31 March 2026),
    reporting entities must maintain a SINGLE, CONSOLIDATED risk-based program.
    The previous Part A / Part B structure is LEGACY — applicable only to
    previously registered entities that adopted that format before the 2026 reform.

    This model reflects the new single-program structure with all required sections.
    A template is pre-populated on AMLSolution creation based on the org's industry;
    the organisation customises it to reflect their specific business.
    """

    __tablename__ = "aml_programs"

    id = Column(String, primary_key=True, default=lambda: f"aml_{uuid4().hex[:12]}")
    solution_id = Column(
        String,
        ForeignKey("aml_solutions.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    org_id = Column(
        String,
        ForeignKey("organisations.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )

    version = Column(String(20), nullable=False, default="1.0")
    status = Column(Enum(ProgramStatus), default=ProgramStatus.draft, nullable=False)
    risk_appetite = Column(Enum(RiskAppetite), default=RiskAppetite.medium)

    # Legacy flag — True if this program was written under the pre-2026 Part A/B format
    is_legacy_part_ab = Column(Boolean, default=False)

    # ── Section 1: Overview & Scope ──────────────────────────────────────────
    overview = Column(Text)  # purpose, background, AML/CTF Act obligations
    scope = Column(Text)  # which designated services and entities are covered
    designated_services = Column(
        Text
    )  # specific services the org provides (items from AML/CTF Act)
    compliance_officer_name = Column(String(255))
    compliance_officer_role = Column(String(255))
    compliance_officer_user_id = Column(String, ForeignKey("users.id"), nullable=True)

    # ── Section 2: ML/TF/PF Risk Assessment ─────────────────────────────────
    # (Enterprise-Wide Risk Assessment — reviewed at least annually)
    ewra_summary = Column(
        Text
    )  # summary of risk factors: customer, product, channel, geography
    risk_factors_customer = Column(Text)
    risk_factors_product = Column(Text)
    risk_factors_channel = Column(Text)
    risk_factors_geography = Column(Text)
    risk_factors_proliferation = Column(
        Text
    )  # proliferation financing (new under 2026 reform)

    # ── Section 3: Customer Due Diligence (CDD) ──────────────────────────────
    # Previously "Part B — Customer Identification" under legacy format
    cdd_individuals = Column(Text)  # ID & verification for individuals
    cdd_companies = Column(Text)  # ID & verification for companies
    cdd_trusts = Column(Text)
    cdd_partnerships = Column(Text)
    cdd_government_bodies = Column(Text)
    cdd_simplified_procedures = Column(Text)  # when simplified CDD applies
    cdd_enhanced_procedures = Column(Text)  # ECDD for high-risk customers

    # ── Section 4: Ongoing CDD & Transaction Monitoring ──────────────────────
    ongoing_cdd = Column(Text)  # ongoing monitoring of existing customers
    transaction_monitoring = Column(Text)  # rules, thresholds, escalation

    # ── Section 5: Beneficial Ownership ──────────────────────────────────────
    beneficial_ownership_procedures = Column(Text)

    # ── Section 6: PEP Procedures ────────────────────────────────────────────
    pep_procedures = Column(Text)  # identification, ECDD, ongoing monitoring

    # ── Section 7: Targeted Financial Sanctions ──────────────────────────────
    sanctions_procedures = Column(Text)  # asset freezing, screening, reporting

    # ── Section 8: Travel Rule ───────────────────────────────────────────────
    # New under 2026 reform — applies to virtual asset transfers and remittances
    travel_rule_procedures = Column(Text)

    # ── Section 9: Reporting Obligations ─────────────────────────────────────
    smr_procedures = Column(Text)  # Suspicious Matter Reporting
    ttr_procedures = Column(Text)  # Threshold Transaction Reports (>= $10k cash)
    ifti_procedures = Column(Text)  # International Funds Transfer Instructions
    annual_compliance_report = Column(
        Text
    )  # AML/CTF Compliance Report (annual to AUSTRAC)

    # ── Section 10: Employee Due Diligence ───────────────────────────────────
    employee_due_diligence = Column(
        Text
    )  # screening of staff with AML/CTF responsibilities

    # ── Section 11: Training ─────────────────────────────────────────────────
    training_program_summary = Column(Text)  # overview (detail in TrainingRecord)

    # ── Section 12: Record Keeping ───────────────────────────────────────────
    record_keeping = Column(Text)  # 7-year retention, what records to keep

    # ── Section 13: Independent Review ───────────────────────────────────────
    independent_review = Column(
        Text
    )  # frequency, scope, reporting to senior management

    # ── Section 14: AUSTRAC Registration ─────────────────────────────────────
    austrac_enrolment_date = Column(Date)
    austrac_registration_date = Column(Date)
    austrac_registration_expiry = Column(Date)  # renew every 3 years
    designated_business_group = Column(String(255))  # DBG name if applicable

    # ── Lifecycle ─────────────────────────────────────────────────────────────
    effective_date = Column(Date)
    review_due_date = Column(Date)  # must review at least annually
    last_reviewed_at = Column(DateTime(timezone=True))
    reviewed_by = Column(String)  # user id
    approved_by = Column(String)  # user id (AML/CTF Compliance Officer or Board)
    approved_at = Column(DateTime(timezone=True))
    created_by = Column(String, nullable=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())

    solution = relationship("AMLSolution", back_populates="programs")


# ── Risk Assessment ───────────────────────────────────────────────────────────


class RiskAssessment(Base):
    """
    ML/TF Risk Assessment — conducted at least annually or when material changes occur.
    """

    __tablename__ = "risk_assessments"

    id = Column(String, primary_key=True, default=lambda: f"ra_{uuid4().hex[:12]}")
    solution_id = Column(
        String,
        ForeignKey("aml_solutions.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    org_id = Column(
        String,
        ForeignKey("organisations.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )

    title = Column(String(255), nullable=False)
    assessment_date = Column(Date, nullable=False)
    status = Column(
        Enum(AssessmentStatus), default=AssessmentStatus.draft, nullable=False
    )

    # Risk scoring (1–5 scale)
    inherent_risk_score = Column(Float)
    control_effectiveness_score = Column(Float)
    residual_risk_score = Column(Float)

    # Risk ratings by category
    customer_risk_rating = Column(String(20))  # low / medium / high
    product_risk_rating = Column(String(20))
    channel_risk_rating = Column(String(20))
    geography_risk_rating = Column(String(20))

    # Narrative
    findings = Column(Text)
    recommendations = Column(Text)
    action_items = Column(Text)  # JSON string of [{item, owner, due_date, status}]

    next_review_date = Column(Date)
    conducted_by = Column(String)  # user id
    approved_by = Column(String)  # user id
    approved_at = Column(DateTime(timezone=True))
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())

    solution = relationship("AMLSolution", back_populates="risk_assessments")


# ── Policies ──────────────────────────────────────────────────────────────────


class AMLPolicy(Base):
    """
    Lightweight policy seed record created on AMLSolution initialisation.
    For full governance lifecycle (versioning, attestation, approval workflow)
    see app.models.governance.Policy.
    """

    __tablename__ = "policies"

    id = Column(String, primary_key=True, default=lambda: f"pol_{uuid4().hex[:12]}")
    solution_id = Column(
        String,
        ForeignKey("aml_solutions.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    org_id = Column(
        String,
        ForeignKey("organisations.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )

    title = Column(String(255), nullable=False)
    policy_type = Column(String(100))
    version = Column(String(20), default="1.0")
    status = Column(Enum(PolicyStatus), default=PolicyStatus.draft, nullable=False)
    content = Column(Text)
    summary = Column(Text)

    effective_date = Column(Date)
    review_due_date = Column(Date)
    last_reviewed_at = Column(DateTime(timezone=True))
    reviewed_by = Column(String)
    approved_by = Column(String)
    approved_at = Column(DateTime(timezone=True))
    created_by = Column(String, nullable=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())

    solution = relationship("AMLSolution", back_populates="policies")


# ── Controls ──────────────────────────────────────────────────────────────────


class Control(Base):
    """
    AML/CTF Control register entry.
    Maps controls to risks and tracks testing/effectiveness.
    """

    __tablename__ = "controls"

    id = Column(String, primary_key=True, default=lambda: f"ctrl_{uuid4().hex[:12]}")
    solution_id = Column(
        String,
        ForeignKey("aml_solutions.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    org_id = Column(
        String,
        ForeignKey("organisations.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )

    control_ref = Column(String(20))  # e.g. CTL-001
    title = Column(String(255), nullable=False)
    description = Column(Text)
    control_type = Column(String(50))  # preventive | detective | corrective
    risk_area = Column(String(100))  # what ML/TF risk this control addresses
    owner = Column(String)  # user id responsible for this control

    status = Column(
        Enum(ControlStatus), default=ControlStatus.not_tested, nullable=False
    )
    last_tested_date = Column(Date)
    next_test_date = Column(Date)
    test_notes = Column(Text)
    tested_by = Column(String)  # user id

    created_by = Column(String, nullable=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())

    solution = relationship("AMLSolution", back_populates="controls")


# ── Training Records ──────────────────────────────────────────────────────────


class TrainingRecord(Base):
    """
    Staff AML/CTF training log.
    AUSTRAC requires all employees to receive appropriate AML/CTF training.
    """

    __tablename__ = "training_records"

    id = Column(String, primary_key=True, default=lambda: f"tr_{uuid4().hex[:12]}")
    solution_id = Column(
        String,
        ForeignKey("aml_solutions.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    org_id = Column(
        String,
        ForeignKey("organisations.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )

    user_id = Column(String, ForeignKey("users.id"), nullable=False, index=True)
    training_name = Column(String(255), nullable=False)
    training_type = Column(
        String(100)
    )  # induction | annual_refresh | role_specific | remedial
    provider = Column(String(255))  # Verigo, external trainer, AUSTRAC eLearning, etc.
    description = Column(Text)

    status = Column(
        Enum(TrainingStatus), default=TrainingStatus.not_started, nullable=False
    )
    due_date = Column(Date)
    completed_date = Column(Date)
    expiry_date = Column(Date)  # some certs expire (e.g. annual)
    score = Column(Float)  # if assessment-based (0–100)
    passed = Column(Boolean)
    certificate_document_id = Column(String)  # document.id for the cert upload

    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())

    solution = relationship("AMLSolution", back_populates="training_records")
    user = relationship("User")


# ── AML Services (premium engagements) ───────────────────────────────────────


class AMLService(Base):
    """
    Premium service engagement — billed separately from the base subscription.

    service_type options:
      austrac_registration      Pre-July 2026: assists org with AUSTRAC online registration
      annual_compliance_report  EOFY: prepares the annual AML/CTF compliance report
      independent_audit         Periodic: independent AML program audit & gap review
      tailored_session          Custom: bespoke consulting session
    """

    __tablename__ = "aml_services"

    id = Column(String, primary_key=True, default=lambda: f"svc_{uuid4().hex[:12]}")
    solution_id = Column(
        String,
        ForeignKey("aml_solutions.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    org_id = Column(
        String,
        ForeignKey("organisations.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )

    service_type = Column(Enum(ServiceType), nullable=False)
    status = Column(Enum(ServiceStatus), default=ServiceStatus.pending, nullable=False)
    title = Column(String(255))  # human-readable e.g. "FY2026 Compliance Report"
    description = Column(Text)

    # Scheduling
    requested_at = Column(DateTime(timezone=True))
    requested_by = Column(String)  # user id
    target_date = Column(Date)  # e.g. 30 June 2026 for EOFY
    deadline = Column(Date)  # hard deadline (e.g. AUSTRAC registration cutoff)

    # Delivery
    assigned_to = Column(String)  # Verigo team member id / email
    started_at = Column(DateTime(timezone=True))
    completed_at = Column(DateTime(timezone=True))
    deliverable_document_id = Column(String)  # document.id for final deliverable

    # Billing
    quoted_amount_aud = Column(Float)
    invoiced = Column(Boolean, default=False)
    invoice_reference = Column(String(100))
    notes = Column(Text)

    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())

    solution = relationship("AMLSolution", back_populates="services")
