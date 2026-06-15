"""
AML/CTF Risk Assessment Engine — Database Models

Implements a bank-grade, fully configurable risk assessment framework aligned with:
- FATF Risk-Based Approach Guidance
- AUSTRAC AML/CTF Rules 2025 (2026 reform)
- Wolfsberg Group guidance
- APRA CPS 230 risk management principles

GOVERNANCE DISCLAIMER (stored on every assessment):
This framework is a configurable tool only. Risk ratings, scoring, assumptions,
and conclusions remain the sole responsibility of the reporting entity. The platform
does not determine final risk ratings, provide legal or compliance advice, or accept
liability for risk outcomes. Users must independently determine the appropriateness
of all ratings, controls, and mitigation measures.

Architecture:
  RiskLibrary         — master industry-specific risk factor libraries (read-only seeds)
  RiskFramework       — org's live framework config (customised from library)
  RiskCategory        — risk categories within a framework (customisable)
  RiskFactor          — individual risk factors within a category (customisable)
  RiskAssessmentRun   — a specific assessment execution (snapshot + results)
  RiskFactorScore     — user-entered L/C/CE scores per factor per run
  RiskControl         — controls linked to risk factors
  RiskMitigation      — mitigation actions in a run
  RiskScoreHistory    — immutable audit trail of all score changes
"""
import enum
from uuid import uuid4

from sqlalchemy import (
    Boolean, Column, Date, DateTime, Enum, Float,
    ForeignKey, Integer, JSON, String, Text, func,
)
from sqlalchemy.orm import relationship

from app.db.database import Base


# ── Enums ─────────────────────────────────────────────────────────────────────

class RiskCategoryType(str, enum.Enum):
    customer = "customer"
    product = "product"
    service = "service"
    geographic = "geographic"
    channel = "channel"
    transaction = "transaction"
    regulatory = "regulatory"


class Likelihood(int, enum.Enum):
    rare           = 1   # Rare
    unlikely       = 2   # Unlikely
    possible       = 3   # Possible
    likely         = 4   # Likely
    almost_certain = 5   # Almost Certain


class Consequence(int, enum.Enum):
    insignificant = 1
    minor         = 2
    moderate      = 3
    major         = 4
    severe        = 5


class ControlEffectiveness(int, enum.Enum):
    strong       = 1   # 80% risk reduction
    effective    = 2   # 60% risk reduction
    moderate     = 3   # 40% risk reduction
    weak         = 4   # 20% risk reduction
    ineffective  = 5   # 0% risk reduction


class RiskRating(str, enum.Enum):
    low      = "low"
    medium   = "medium"
    high     = "high"
    critical = "critical"


class AssessmentStatus(str, enum.Enum):
    draft       = "draft"
    in_progress = "in_progress"
    completed   = "completed"
    approved    = "approved"
    archived    = "archived"


class MitigationStatus(str, enum.Enum):
    not_started  = "not_started"
    in_progress  = "in_progress"
    completed    = "completed"
    overdue      = "overdue"
    not_required = "not_required"


# ── Risk Library (seeded — read-only templates) ───────────────────────────────

class RiskLibraryFactor(Base):
    """
    Seeded risk factor template from the industry-specific risk library.
    Read-only. Copied into RiskFactor when an org adopts it or customises it.
    """
    __tablename__ = "risk_library_factors"

    id = Column(String, primary_key=True, default=lambda: f"rlf_{uuid4().hex[:12]}")
    industry = Column(String(50), nullable=False, index=True)  # or "all" for universal
    category_type = Column(Enum(RiskCategoryType), nullable=False, index=True)
    factor_ref = Column(String(20))        # e.g. CR-001
    factor_name = Column(String(255), nullable=False)
    description = Column(Text)
    rationale = Column(Text)               # why this is a risk for this industry

    # Suggested (not enforced) starting values
    suggested_likelihood = Column(Integer)      # 1-5
    suggested_consequence = Column(Integer)     # 1-5
    suggested_inherent_risk = Column(Float)     # L × C
    suggested_control_effectiveness = Column(Integer)  # 1-5
    suggested_residual_risk = Column(Float)     # inherent × CEF
    suggested_rating = Column(Enum(RiskRating))

    mitigation_examples = Column(JSON, default=list)   # [str]
    regulatory_references = Column(JSON, default=list) # ["FATF R.10", "AML/CTF Act s.XX"]
    is_mandatory = Column(Boolean, default=False)      # cannot be removed
    sort_order = Column(Integer, default=0)
    created_at = Column(DateTime(timezone=True), server_default=func.now())


# ── Risk Framework (per Organisation) ─────────────────────────────────────────

class RiskFramework(Base):
    """
    Organisation's live risk assessment framework configuration.
    Built from the library template on AMLSolution creation; fully customisable.
    One framework per AMLSolution (one per org).
    """
    __tablename__ = "risk_frameworks"

    id = Column(String, primary_key=True, default=lambda: f"rf_{uuid4().hex[:12]}")
    solution_id = Column(String, ForeignKey("aml_solutions.id", ondelete="CASCADE"),
                         nullable=False, unique=True, index=True)
    org_id = Column(String, ForeignKey("organisations.id", ondelete="CASCADE"),
                    nullable=False, index=True)

    name = Column(String(255), default="AML/CTF Risk Assessment Framework")
    industry = Column(String(50), nullable=False)

    # Category weights (must sum to 1.0, user-configurable)
    category_weights = Column(JSON, default=dict)
    # e.g. {"customer": 0.25, "product": 0.15, "service": 0.10,
    #        "geographic": 0.20, "channel": 0.10, "transaction": 0.15, "regulatory": 0.05}

    # Governance disclaimer — displayed on every assessment
    governance_disclaimer = Column(Text, default=(
        "This risk assessment framework is a configurable tool only. Risk ratings, "
        "scoring, assumptions, and conclusions remain the sole responsibility of the "
        "reporting entity. The platform does not determine final risk ratings, provide "
        "legal or compliance advice, or accept liability for risk outcomes. Users must "
        "independently determine the appropriateness of all ratings, controls, and "
        "mitigation measures."
    ))

    created_by = Column(String, nullable=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())

    categories = relationship("RiskCategory", back_populates="framework",
                              cascade="all, delete-orphan", order_by="RiskCategory.sort_order")
    assessments = relationship("RiskAssessmentRun", back_populates="framework")


class RiskCategory(Base):
    """
    A risk category within an organisation's framework.
    Copied from library, then freely customisable (rename, reweight, add/remove factors).
    """
    __tablename__ = "risk_categories"

    id = Column(String, primary_key=True, default=lambda: f"rc_{uuid4().hex[:12]}")
    framework_id = Column(String, ForeignKey("risk_frameworks.id", ondelete="CASCADE"),
                          nullable=False, index=True)
    org_id = Column(String, ForeignKey("organisations.id"), nullable=False, index=True)

    category_type = Column(Enum(RiskCategoryType), nullable=False)
    name = Column(String(255), nullable=False)        # user can rename
    description = Column(Text)
    weight = Column(Float, default=0.14)              # contribution to overall score (0-1)
    is_active = Column(Boolean, default=True)
    sort_order = Column(Integer, default=0)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())

    framework = relationship("RiskFramework", back_populates="categories")
    factors = relationship("RiskFactor", back_populates="category",
                           cascade="all, delete-orphan", order_by="RiskFactor.sort_order")


class RiskFactor(Base):
    """
    An individual risk factor within a category.
    Users can: modify scoring, add/remove factors, change weighting, upload evidence, add comments.
    """
    __tablename__ = "risk_factors"

    id = Column(String, primary_key=True, default=lambda: f"rfact_{uuid4().hex[:12]}")
    category_id = Column(String, ForeignKey("risk_categories.id", ondelete="CASCADE"),
                         nullable=False, index=True)
    org_id = Column(String, ForeignKey("organisations.id"), nullable=False, index=True)
    library_factor_id = Column(String, ForeignKey("risk_library_factors.id"), nullable=True)

    factor_ref = Column(String(20))           # e.g. CR-001
    name = Column(String(255), nullable=False)
    description = Column(Text)
    rationale = Column(Text)
    weight = Column(Float, default=1.0)       # relative weight within category (default equal)
    is_active = Column(Boolean, default=True)
    is_mandatory = Column(Boolean, default=False)
    sort_order = Column(Integer, default=0)

    # Suggested starting values (from library — shown as hints, never enforced)
    suggested_likelihood = Column(Integer)
    suggested_consequence = Column(Integer)
    suggested_control_effectiveness = Column(Integer)

    mitigation_examples = Column(JSON, default=list)
    regulatory_references = Column(JSON, default=list)

    created_by = Column(String)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())

    category = relationship("RiskCategory", back_populates="factors")
    library_factor = relationship("RiskLibraryFactor")
    controls = relationship("RiskControl", back_populates="factor",
                            cascade="all, delete-orphan")


class RiskControl(Base):
    """Control associated with a risk factor."""
    __tablename__ = "risk_controls"

    id = Column(String, primary_key=True, default=lambda: f"rctrl_{uuid4().hex[:12]}")
    factor_id = Column(String, ForeignKey("risk_factors.id", ondelete="CASCADE"),
                       nullable=False, index=True)
    org_id = Column(String, ForeignKey("organisations.id"), nullable=False)

    control_ref = Column(String(20))
    name = Column(String(255), nullable=False)
    description = Column(Text)
    control_type = Column(String(50))  # preventive | detective | corrective
    owner = Column(String)             # user id
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    factor = relationship("RiskFactor", back_populates="controls")


# ── Assessment Run ────────────────────────────────────────────────────────────

class RiskAssessmentRun(Base):
    """
    A specific execution of the risk assessment.
    Snapshots all factor scores and calculates category and overall residual risk.
    Multiple runs per year (at least annual, or on material change).
    """
    __tablename__ = "risk_assessment_runs"

    id = Column(String, primary_key=True, default=lambda: f"rar_{uuid4().hex[:12]}")
    framework_id = Column(String, ForeignKey("risk_frameworks.id"), nullable=False, index=True)
    org_id = Column(String, ForeignKey("organisations.id"), nullable=False, index=True)

    # Linkage to AMLSolution RiskAssessment record (high-level summary)
    aml_risk_assessment_id = Column(String, ForeignKey("risk_assessments.id"), nullable=True)

    title = Column(String(255), nullable=False)  # e.g. "FY2026 Annual AML Risk Assessment"
    assessment_date = Column(Date, nullable=False)
    assessment_period_start = Column(Date)
    assessment_period_end = Column(Date)
    status = Column(Enum(AssessmentStatus), default=AssessmentStatus.draft, nullable=False)
    trigger = Column(String(100))  # annual | material_change | austrac_direction | post_incident

    # ── Calculated results (populated by scoring engine) ──────────────────────
    # Overall
    overall_inherent_risk_score = Column(Float)   # weighted avg of category inherent scores
    overall_residual_risk_score = Column(Float)   # weighted avg of category residual scores
    overall_inherent_rating = Column(Enum(RiskRating))
    overall_residual_rating = Column(Enum(RiskRating))

    # Per-category rolled-up scores (JSON for flexibility)
    # {"customer": {"inherent": 12.5, "residual": 6.0, "rating": "medium"}, ...}
    category_scores = Column(JSON, default=dict)

    # ── Narrative ──────────────────────────────────────────────────────────────
    executive_summary = Column(Text)
    key_findings = Column(Text)
    recommendations = Column(Text)
    action_items = Column(JSON, default=list)  # [{item, owner, due_date, status}]

    # ── Governance ─────────────────────────────────────────────────────────────
    # Disclaimer acknowledged by the approver (required before approval)
    disclaimer_acknowledged = Column(Boolean, default=False)
    disclaimer_acknowledged_by = Column(String)   # user id
    disclaimer_acknowledged_at = Column(DateTime(timezone=True))

    # ── Workflow ───────────────────────────────────────────────────────────────
    conducted_by = Column(String)     # user id
    reviewed_by = Column(String)
    approved_by = Column(String)      # MLRO or Board
    approved_at = Column(DateTime(timezone=True))
    next_review_date = Column(Date)

    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())

    framework = relationship("RiskFramework", back_populates="assessments")
    factor_scores = relationship("RiskFactorScore", back_populates="assessment",
                                 cascade="all, delete-orphan")
    mitigations = relationship("RiskMitigation", back_populates="assessment",
                                cascade="all, delete-orphan")


class RiskFactorScore(Base):
    """
    User-entered scores for a specific risk factor in a specific assessment run.
    All scoring is user-controlled. Platform only calculates formulas.
    Scores can be overridden with a mandatory justification.
    """
    __tablename__ = "risk_factor_scores"

    id = Column(String, primary_key=True, default=lambda: f"rfs_{uuid4().hex[:12]}")
    assessment_id = Column(String, ForeignKey("risk_assessment_runs.id", ondelete="CASCADE"),
                           nullable=False, index=True)
    factor_id = Column(String, ForeignKey("risk_factors.id"), nullable=False, index=True)
    org_id = Column(String, ForeignKey("organisations.id"), nullable=False)

    # ── User-entered values (1-5 scales) ──────────────────────────────────────
    likelihood = Column(Integer)          # 1-5 (Rare → Almost Certain)
    consequence = Column(Integer)         # 1-5 (Insignificant → Severe)
    control_effectiveness = Column(Integer)  # 1-5 (Strong → Ineffective)

    # ── Calculated by engine (read-only for display) ───────────────────────────
    inherent_risk_score = Column(Float)   # likelihood × consequence (1-25)
    residual_risk_score = Column(Float)   # inherent × CEF (0.2-25)
    inherent_rating = Column(Enum(RiskRating))
    residual_rating = Column(Enum(RiskRating))

    # ── User customisation ────────────────────────────────────────────────────
    score_override = Column(Boolean, default=False)   # user manually overrode calculated score
    override_residual_score = Column(Float)           # manual override value
    override_justification = Column(Text)             # mandatory when override=True

    # Supporting evidence and notes
    evidence_document_ids = Column(JSON, default=list)  # [document.id]
    comments = Column(Text)
    factor_weight_override = Column(Float)  # optional per-factor weight override for this run

    scored_by = Column(String)     # user id
    scored_at = Column(DateTime(timezone=True))
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())

    assessment = relationship("RiskAssessmentRun", back_populates="factor_scores")
    factor = relationship("RiskFactor")
    score_history = relationship("RiskScoreHistory", back_populates="factor_score",
                                 cascade="all, delete-orphan")


class RiskMitigation(Base):
    """Mitigation action for a risk factor in an assessment run."""
    __tablename__ = "risk_mitigations"

    id = Column(String, primary_key=True, default=lambda: f"rmit_{uuid4().hex[:12]}")
    assessment_id = Column(String, ForeignKey("risk_assessment_runs.id", ondelete="CASCADE"),
                           nullable=False, index=True)
    factor_score_id = Column(String, ForeignKey("risk_factor_scores.id"), nullable=True)
    org_id = Column(String, ForeignKey("organisations.id"), nullable=False)

    risk_description = Column(Text, nullable=False)
    mitigation_action = Column(Text, nullable=False)
    owner = Column(String)          # user id responsible
    due_date = Column(Date)
    status = Column(Enum(MitigationStatus), default=MitigationStatus.not_started)
    completion_notes = Column(Text)
    completed_at = Column(DateTime(timezone=True))
    evidence_document_ids = Column(JSON, default=list)

    created_by = Column(String)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())

    assessment = relationship("RiskAssessmentRun", back_populates="mitigations")


class RiskScoreHistory(Base):
    """
    Immutable audit trail of all score changes.
    Every change to a RiskFactorScore creates a new entry here.
    Cannot be modified or deleted.
    """
    __tablename__ = "risk_score_history"

    id = Column(Integer, primary_key=True, autoincrement=True)
    factor_score_id = Column(String, ForeignKey("risk_factor_scores.id", ondelete="CASCADE"),
                             nullable=False, index=True)
    org_id = Column(String, nullable=False)
    assessment_id = Column(String, nullable=False)
    factor_id = Column(String, nullable=False)

    # Values before the change
    previous_likelihood = Column(Integer)
    previous_consequence = Column(Integer)
    previous_control_effectiveness = Column(Integer)
    previous_residual_score = Column(Float)

    # Values after the change
    new_likelihood = Column(Integer)
    new_consequence = Column(Integer)
    new_control_effectiveness = Column(Integer)
    new_residual_score = Column(Float)

    change_reason = Column(Text)
    changed_by = Column(String, nullable=False)   # user id
    changed_at = Column(DateTime(timezone=True), server_default=func.now(), index=True)

    factor_score = relationship("RiskFactorScore", back_populates="score_history")
