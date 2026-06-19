"""
Professional Services AML Assessment Models.

Supports AML risk documentation for professional service providers:
  Accountants, Tax Advisers, Lawyers, Conveyancers,
  Trust & Company Service Providers, Real Estate Professionals.

Structure:
  ProfessionalAssessment      — top-level container per matter/customer
  SOFAssessment               — Source of Funds documentation
  SOWAssessment               — Source of Wealth documentation
  TransactionPurposeAssessment — Economic purpose of transaction
  TaxRiskAssessment           — Tax evasion risk indicator checklist
  InvestmentLegitimacyAssessment — Investment documentation review
  ProfessionalJudgmentChecklist  — Industry-specific configurable checklist
  OrgProfessionalChecklistTemplate — Org-customisable default checklist items

DISCLAIMER: This module assists in documenting compliance considerations.
The platform does not determine tax evasion, investment legitimacy, or
legal compliance. All decisions remain with the reporting entity.
"""

import enum
from uuid import uuid4

from sqlalchemy import (
    JSON,
    Boolean,
    Column,
    DateTime,
    Enum,
    ForeignKey,
    Integer,
    String,
    Text,
    UniqueConstraint,
    func,
)
from sqlalchemy.orm import relationship

from app.db.database import Base

# ── Enums ──────────────────────────────────────────────────────────────────────


class ProfessionalServiceType(str, enum.Enum):
    accountant = "accountant"
    tax_adviser = "tax_adviser"
    lawyer = "lawyer"
    conveyancer = "conveyancer"
    tcsp = "tcsp"  # Trust & Company Service Provider
    real_estate = "real_estate"
    other = "other"


class AssessmentStatus(str, enum.Enum):
    draft = "draft"
    in_progress = "in_progress"
    pending_review = "pending_review"
    completed = "completed"
    escalated = "escalated"


class AssessmentRiskRating(str, enum.Enum):
    low = "low"
    medium = "medium"
    high = "high"
    critical = "critical"
    not_rated = "not_rated"


class SOFSourceType(str, enum.Enum):
    employment_income = "employment_income"
    business_income = "business_income"
    property_sale = "property_sale"
    investment_proceeds = "investment_proceeds"
    inheritance = "inheritance"
    loan_funds = "loan_funds"
    trust_distribution = "trust_distribution"
    crypto_proceeds = "crypto_proceeds"
    pension_superannuation = "pension_superannuation"
    gift = "gift"
    compensation = "compensation"
    other = "other"


class SOWSourceType(str, enum.Enum):
    business_ownership = "business_ownership"
    long_term_investments = "long_term_investments"
    property_holdings = "property_holdings"
    inheritance = "inheritance"
    professional_income = "professional_income"
    family_wealth = "family_wealth"
    superannuation = "superannuation"
    sale_of_business = "sale_of_business"
    other = "other"


class TransactionPurposeType(str, enum.Enum):
    property_purchase = "property_purchase"
    investment = "investment"
    business_acquisition = "business_acquisition"
    loan_repayment = "loan_repayment"
    family_support = "family_support"
    commercial_transaction = "commercial_transaction"
    trust_distribution = "trust_distribution"
    international_transfer = "international_transfer"
    legal_settlement = "legal_settlement"
    tax_payment = "tax_payment"
    estate_distribution = "estate_distribution"
    other = "other"


class ChecklistType(str, enum.Enum):
    accountant = "accountant"
    tax_adviser = "tax_adviser"
    lawyer = "lawyer"
    conveyancer = "conveyancer"
    tcsp = "tcsp"
    real_estate = "real_estate"
    custom = "custom"


class ReviewOutcome(str, enum.Enum):
    satisfactory = "satisfactory"
    satisfactory_with_notes = "satisfactory_with_notes"
    further_info_required = "further_info_required"
    unsatisfactory = "unsatisfactory"
    escalated = "escalated"
    not_reviewed = "not_reviewed"


# ── Default Checklist Items ────────────────────────────────────────────────────
# Seeded defaults per professional service type. Orgs may customise via
# OrgProfessionalChecklistTemplate.

DEFAULT_CHECKLISTS: dict[str, list[dict]] = {
    "accountant": [
        {"key": "sof_understood", "label": "Source of Funds understood and documented"},
        {
            "key": "sow_understood",
            "label": "Source of Wealth understood and documented",
        },
        {"key": "tax_docs_reviewed", "label": "Tax documentation reviewed"},
        {
            "key": "beneficial_ownership",
            "label": "Beneficial ownership identified and verified",
        },
        {"key": "purpose_documented", "label": "Purpose of transaction documented"},
        {"key": "client_risk_reviewed", "label": "Client risk rating reviewed"},
        {
            "key": "escalation_considered",
            "label": "Escalation to Compliance Officer considered",
        },
        {"key": "smr_considered", "label": "SMR assessment considered"},
    ],
    "tax_adviser": [
        {"key": "sof_understood", "label": "Source of Funds understood and documented"},
        {
            "key": "sow_understood",
            "label": "Source of Wealth understood and documented",
        },
        {
            "key": "income_consistency",
            "label": "Declared income consistent with transaction value",
        },
        {
            "key": "offshore_structures",
            "label": "Offshore structures reviewed for commercial purpose",
        },
        {"key": "tax_residency_verified", "label": "Tax residency status verified"},
        {
            "key": "beneficial_ownership",
            "label": "Beneficial ownership of entities identified",
        },
        {"key": "purpose_documented", "label": "Purpose of transaction documented"},
        {
            "key": "escalation_considered",
            "label": "Escalation to Compliance Officer considered",
        },
    ],
    "lawyer": [
        {"key": "matter_purpose", "label": "Matter purpose understood and documented"},
        {"key": "trust_account", "label": "Trust account involvement assessed"},
        {
            "key": "third_party_payments",
            "label": "Third-party payments reviewed and justified",
        },
        {"key": "beneficial_ownership", "label": "Beneficial ownership verified"},
        {"key": "sof_reviewed", "label": "Source of Funds reviewed"},
        {"key": "sow_reviewed", "label": "Source of Wealth reviewed"},
        {"key": "client_risk_reviewed", "label": "Client risk rating reviewed"},
        {
            "key": "escalation_considered",
            "label": "Escalation to Compliance Officer considered",
        },
        {"key": "smr_considered", "label": "SMR assessment considered"},
    ],
    "conveyancer": [
        {"key": "property_ownership", "label": "Property ownership verified"},
        {
            "key": "purchaser_identified",
            "label": "Purchaser identity verified (KYC/KYB complete)",
        },
        {"key": "sof_reviewed", "label": "Source of Funds reviewed"},
        {"key": "third_party_payments", "label": "Third-party payments assessed"},
        {
            "key": "foreign_ownership",
            "label": "Foreign ownership considerations reviewed (FIRB)",
        },
        {
            "key": "beneficial_ownership",
            "label": "Beneficial ownership of purchasing entity identified",
        },
        {"key": "purpose_documented", "label": "Purpose of transaction documented"},
        {
            "key": "escalation_considered",
            "label": "Escalation to Compliance Officer considered",
        },
    ],
    "tcsp": [
        {
            "key": "beneficial_ownership",
            "label": "Beneficial ownership of structure fully identified",
        },
        {
            "key": "sof_understood",
            "label": "Source of Funds for structure contributions understood",
        },
        {
            "key": "sow_understood",
            "label": "Source of Wealth of underlying controllers understood",
        },
        {
            "key": "purpose_documented",
            "label": "Commercial or personal purpose of structure documented",
        },
        {"key": "controller_verified", "label": "Controllers and settlors verified"},
        {
            "key": "offshore_nexus",
            "label": "Offshore connections reviewed for commercial rationale",
        },
        {"key": "tax_residency", "label": "Tax residency of controllers documented"},
        {
            "key": "escalation_considered",
            "label": "Escalation to Compliance Officer considered",
        },
        {"key": "smr_considered", "label": "SMR assessment considered"},
    ],
    "real_estate": [
        {
            "key": "purchaser_identified",
            "label": "Purchaser identity verified (KYC/KYB complete)",
        },
        {"key": "sof_reviewed", "label": "Source of Funds reviewed"},
        {"key": "sow_reviewed", "label": "Source of Wealth reviewed"},
        {
            "key": "beneficial_ownership",
            "label": "Beneficial ownership of purchasing entity identified",
        },
        {"key": "third_party_payments", "label": "Third-party payments assessed"},
        {
            "key": "foreign_ownership",
            "label": "Foreign ownership considerations reviewed",
        },
        {
            "key": "transaction_structure",
            "label": "Transaction structure assessed for complexity",
        },
        {"key": "purpose_documented", "label": "Purchase purpose documented"},
        {
            "key": "escalation_considered",
            "label": "Escalation to Compliance Officer considered",
        },
    ],
}


# ── Models ─────────────────────────────────────────────────────────────────────


class ProfessionalAssessment(Base):
    """
    Top-level AML risk assessment for a professional services matter.

    One assessment covers a customer/matter combination. A single customer
    may have multiple assessments (one per matter or transaction).
    """

    __tablename__ = "professional_assessments"

    id = Column(String, primary_key=True, default=lambda: f"pa_{uuid4().hex[:12]}")
    assessment_ref = Column(String(30), unique=True, nullable=False, index=True)
    org_id = Column(
        String,
        ForeignKey("organisations.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    customer_id = Column(String, ForeignKey("customers.id"), nullable=False, index=True)
    transaction_id = Column(
        String, ForeignKey("transactions.id"), nullable=True, index=True
    )
    case_id = Column(String, ForeignKey("cases.id"), nullable=True, index=True)

    professional_service_type = Column(
        Enum(ProfessionalServiceType), nullable=False, index=True
    )
    matter_description = Column(Text)  # Brief description of the matter/engagement
    status = Column(
        Enum(AssessmentStatus),
        default=AssessmentStatus.draft,
        nullable=False,
        index=True,
    )
    overall_risk_rating = Column(
        Enum(AssessmentRiskRating), default=AssessmentRiskRating.not_rated
    )
    risk_summary = Column(Text)  # Reviewer's overall risk narrative

    # Completion tracking
    created_by = Column(String, nullable=False)
    assigned_to = Column(String)
    completed_by = Column(String)
    completed_at = Column(DateTime(timezone=True))
    reviewed_by = Column(String)
    reviewed_at = Column(DateTime(timezone=True))

    # Escalation
    is_escalated = Column(Boolean, default=False)
    escalated_to = Column(String)
    escalated_at = Column(DateTime(timezone=True))
    escalation_reason = Column(Text)

    # SMR consideration flag (human decision only — never auto-set)
    smr_consideration_noted = Column(Boolean, default=False)

    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())

    # Relationships
    sof_assessment = relationship(
        "SOFAssessment",
        back_populates="assessment",
        uselist=False,
        cascade="all, delete-orphan",
    )
    sow_assessment = relationship(
        "SOWAssessment",
        back_populates="assessment",
        uselist=False,
        cascade="all, delete-orphan",
    )
    purpose_assessment = relationship(
        "TransactionPurposeAssessment",
        back_populates="assessment",
        uselist=False,
        cascade="all, delete-orphan",
    )
    tax_risk_assessment = relationship(
        "TaxRiskAssessment",
        back_populates="assessment",
        uselist=False,
        cascade="all, delete-orphan",
    )
    investment_assessment = relationship(
        "InvestmentLegitimacyAssessment",
        back_populates="assessment",
        uselist=False,
        cascade="all, delete-orphan",
    )
    checklist = relationship(
        "ProfessionalJudgmentChecklist",
        back_populates="assessment",
        uselist=False,
        cascade="all, delete-orphan",
    )


class SOFAssessment(Base):
    """Source of Funds documentation and review record."""

    __tablename__ = "sof_assessments"

    id = Column(String, primary_key=True, default=lambda: f"sof_{uuid4().hex[:10]}")
    assessment_id = Column(
        String,
        ForeignKey("professional_assessments.id", ondelete="CASCADE"),
        nullable=False,
        unique=True,
        index=True,
    )
    org_id = Column(String, nullable=False, index=True)

    # Source type(s) — can have multiple (e.g. employment + savings)
    primary_source_type = Column(Enum(SOFSourceType), nullable=False)
    additional_source_types = Column(JSON, default=list)  # list of SOFSourceType values
    source_description = Column(Text)  # Narrative from customer/client

    # Review checklist
    evidence_uploaded = Column(Boolean, default=False)
    evidence_reviewed = Column(Boolean, default=False)
    evidence_sufficient = Column(Boolean, default=False)
    additional_info_required = Column(Boolean, default=False)

    # Document references
    evidence_refs = Column(JSON, default=list)  # ["doc_abc123", "doc_def456"]
    evidence_types = Column(JSON, default=list)  # ["bank_statement", "payslip", ...]

    # Review outcome
    review_outcome = Column(Enum(ReviewOutcome), default=ReviewOutcome.not_reviewed)
    reviewer_id = Column(String)
    review_date = Column(DateTime(timezone=True))
    review_notes = Column(Text)

    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())

    assessment = relationship("ProfessionalAssessment", back_populates="sof_assessment")


class SOWAssessment(Base):
    """Source of Wealth documentation and review record."""

    __tablename__ = "sow_assessments"

    id = Column(String, primary_key=True, default=lambda: f"sow_{uuid4().hex[:10]}")
    assessment_id = Column(
        String,
        ForeignKey("professional_assessments.id", ondelete="CASCADE"),
        nullable=False,
        unique=True,
        index=True,
    )
    org_id = Column(String, nullable=False, index=True)

    # Source type(s)
    primary_source_type = Column(Enum(SOWSourceType), nullable=False)
    additional_source_types = Column(JSON, default=list)
    wealth_narrative = Column(Text)  # customer/client explanation of accumulated wealth

    # Review checklist
    wealth_explanation_provided = Column(Boolean, default=False)
    evidence_reviewed = Column(Boolean, default=False)
    wealth_profile_consistent = Column(Boolean, default=False)
    additional_review_required = Column(Boolean, default=False)

    # Document references
    evidence_refs = Column(JSON, default=list)

    # Review outcome
    review_notes = Column(Text)
    risk_assessment = Column(Text)  # Reviewer's written risk assessment
    review_outcome = Column(Enum(ReviewOutcome), default=ReviewOutcome.not_reviewed)
    reviewer_id = Column(String)
    review_date = Column(DateTime(timezone=True))

    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())

    assessment = relationship("ProfessionalAssessment", back_populates="sow_assessment")


class TransactionPurposeAssessment(Base):
    """Economic purpose of transaction assessment."""

    __tablename__ = "transaction_purpose_assessments"

    id = Column(String, primary_key=True, default=lambda: f"tpa_{uuid4().hex[:10]}")
    assessment_id = Column(
        String,
        ForeignKey("professional_assessments.id", ondelete="CASCADE"),
        nullable=False,
        unique=True,
        index=True,
    )
    org_id = Column(String, nullable=False, index=True)

    purpose_type = Column(Enum(TransactionPurposeType), nullable=False)
    purpose_description = Column(Text)  # Detailed explanation

    # Review checklist
    purpose_documented = Column(Boolean, default=False)
    purpose_verified = Column(Boolean, default=False)
    supporting_evidence_reviewed = Column(Boolean, default=False)
    purpose_consistent_with_profile = Column(Boolean, default=False)

    evidence_refs = Column(JSON, default=list)
    review_notes = Column(Text)
    review_outcome = Column(Enum(ReviewOutcome), default=ReviewOutcome.not_reviewed)
    reviewer_id = Column(String)
    review_date = Column(DateTime(timezone=True))

    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())

    assessment = relationship(
        "ProfessionalAssessment", back_populates="purpose_assessment"
    )


class TaxRiskAssessment(Base):
    """
    Tax evasion risk indicator checklist.

    DISCLAIMER: This assessment identifies risk indicators for compliance
    workflow purposes only. The platform does not determine tax evasion
    or provide tax advice. All determinations remain with the reporting entity.
    """

    __tablename__ = "tax_risk_assessments"

    id = Column(String, primary_key=True, default=lambda: f"tra_{uuid4().hex[:10]}")
    assessment_id = Column(
        String,
        ForeignKey("professional_assessments.id", ondelete="CASCADE"),
        nullable=False,
        unique=True,
        index=True,
    )
    org_id = Column(String, nullable=False, index=True)

    # Standard AUSTRAC/FATF risk indicators
    indicator_unexplained_cash = Column(Boolean, default=False)
    indicator_complex_ownership = Column(Boolean, default=False)
    indicator_offshore_no_purpose = Column(Boolean, default=False)
    indicator_income_inconsistency = Column(Boolean, default=False)
    indicator_related_party_movements = Column(Boolean, default=False)
    indicator_unusual_trust = Column(Boolean, default=False)
    indicator_unexplained_wealth = Column(Boolean, default=False)
    indicator_artificial_structuring = Column(Boolean, default=False)
    indicator_lack_documentation = Column(Boolean, default=False)
    indicator_reluctance_records = Column(Boolean, default=False)

    # Custom indicators added by reviewer
    custom_indicators = Column(
        JSON, default=list
    )  # [{"label": "...", "present": true}]

    # Total count for quick filtering
    indicator_count = Column(Integer, default=0)  # computed: sum of True indicators

    supporting_evidence = Column(Text)
    reviewer_notes = Column(Text)
    risk_rating = Column(
        Enum(AssessmentRiskRating), default=AssessmentRiskRating.not_rated
    )
    reviewer_id = Column(String)
    review_date = Column(DateTime(timezone=True))

    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())

    assessment = relationship(
        "ProfessionalAssessment", back_populates="tax_risk_assessment"
    )


class InvestmentLegitimacyAssessment(Base):
    """
    Investment legitimacy documentation review.

    DISCLAIMER: This assessment documents a legitimacy review process.
    The platform does not provide investment advice or determine
    the legality of any investment. All decisions remain with the
    reporting entity.
    """

    __tablename__ = "investment_legitimacy_assessments"

    id = Column(String, primary_key=True, default=lambda: f"ila_{uuid4().hex[:10]}")
    assessment_id = Column(
        String,
        ForeignKey("professional_assessments.id", ondelete="CASCADE"),
        nullable=False,
        unique=True,
        index=True,
    )
    org_id = Column(String, nullable=False, index=True)

    investment_type = Column(String(200))  # e.g. "Managed fund", "Direct shares"
    investment_purpose = Column(Text)

    # Legitimacy checklist
    purpose_documented = Column(Boolean, default=False)
    counterparty_identified = Column(Boolean, default=False)
    documentation_reviewed = Column(Boolean, default=False)
    funds_destination_verified = Column(Boolean, default=False)
    commercial_rationale_understood = Column(Boolean, default=False)
    regulatory_registration_verified = Column(Boolean, default=False)
    beneficial_ownership_verified = Column(Boolean, default=False)
    high_risk_jurisdiction_involved = Column(Boolean, default=False)

    supporting_documentation = Column(JSON, default=list)  # document refs
    review_outcome = Column(Text)
    review_outcome_status = Column(
        Enum(ReviewOutcome), default=ReviewOutcome.not_reviewed
    )
    reviewer_id = Column(String)
    review_date = Column(DateTime(timezone=True))
    review_notes = Column(Text)

    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())

    assessment = relationship(
        "ProfessionalAssessment", back_populates="investment_assessment"
    )


class ProfessionalJudgmentChecklist(Base):
    """
    Industry-specific configurable judgment checklist.

    Items are stored as JSON to allow org-level customisation while
    preserving a complete snapshot of what was checked and when.

    Item structure:
      {
        "key": "sof_understood",
        "label": "Source of Funds understood and documented",
        "checked": true,
        "checked_by": "user_abc123",
        "checked_at": "2026-06-15T12:00:00Z",
        "notes": "Payslips and bank statements sighted"
      }
    """

    __tablename__ = "professional_judgment_checklists"

    id = Column(String, primary_key=True, default=lambda: f"pjc_{uuid4().hex[:10]}")
    assessment_id = Column(
        String,
        ForeignKey("professional_assessments.id", ondelete="CASCADE"),
        nullable=False,
        unique=True,
        index=True,
    )
    org_id = Column(String, nullable=False, index=True)

    checklist_type = Column(Enum(ChecklistType), nullable=False)
    items = Column(JSON, default=list)  # list of item dicts (see docstring)

    # Completion tracking
    total_items = Column(Integer, default=0)
    checked_items = Column(Integer, default=0)
    is_complete = Column(Boolean, default=False)
    completed_by = Column(String)
    completed_at = Column(DateTime(timezone=True))

    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())

    assessment = relationship("ProfessionalAssessment", back_populates="checklist")


class OrgProfessionalChecklistTemplate(Base):
    """
    Org-level customised checklist template for each professional service type.
    If no custom template exists, DEFAULT_CHECKLISTS is used.
    """

    __tablename__ = "org_professional_checklist_templates"
    __table_args__ = (
        UniqueConstraint("org_id", "checklist_type", name="uq_org_checklist_type"),
    )

    id = Column(String, primary_key=True, default=lambda: f"oct_{uuid4().hex[:10]}")
    org_id = Column(
        String,
        ForeignKey("organisations.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    checklist_type = Column(Enum(ChecklistType), nullable=False)

    # Customised items list: [{"key": "...", "label": "...", "is_required": true}]
    items = Column(JSON, nullable=False, default=list)

    updated_by = Column(String)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())
