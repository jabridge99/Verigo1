"""
Independent Review Module — AML/CTF Program independent review management.

Covers the full review lifecycle required under the AML/CTF Act 2006 s.162:
  Review → Findings → Recommendations → Remediation Actions

Every AML/CTF reporting entity must periodically commission an independent
review of their AML/CTF program. This module tracks:
  - Review engagements (internal, external, regulatory)
  - Individual findings with risk ratings
  - Recommendations per finding
  - Remediation actions with ownership and due dates
  - Management responses and closure evidence

Review lifecycle:
  planned → in_progress → findings_issued → response_due → completed → archived

Finding lifecycle:
  open → response_submitted → closed (or overdue)

Action lifecycle:
  planned → in_progress → completed → verified (compliance sign-off)

DISCLAIMER: This module provides workflow tooling only.
All compliance decisions remain with the reporting entity.
"""
import enum
from uuid import uuid4

from sqlalchemy import (
    JSON, Boolean, Column, Date, DateTime, Enum,
    ForeignKey, Integer, String, Text, func,
)

from app.db.database import Base


# ── Enums ─────────────────────────────────────────────────────────────────────

class ReviewType(str, enum.Enum):
    internal   = "internal"    # Internal audit / compliance team
    external   = "external"    # Independent external reviewer
    regulatory = "regulatory"  # AUSTRAC-directed review


class ReviewScope(str, enum.Enum):
    aml_program             = "aml_program"             # Full AML/CTF program
    cdd_processes           = "cdd_processes"           # Customer due diligence
    transaction_monitoring  = "transaction_monitoring"  # TM rules and alerts
    regulatory_reporting    = "regulatory_reporting"    # IFTI/TTR/SMR
    governance              = "governance"              # Governance and oversight
    training                = "training"                # Staff training
    record_keeping          = "record_keeping"          # Record retention
    targeted                = "targeted"                # Targeted issue review
    full_program            = "full_program"            # End-to-end program review


class ReviewStatus(str, enum.Enum):
    planned         = "planned"
    in_progress     = "in_progress"
    findings_issued = "findings_issued"  # Draft findings sent to entity
    response_due    = "response_due"     # Entity preparing management response
    completed       = "completed"
    archived        = "archived"


class ReviewRating(str, enum.Enum):
    satisfactory      = "satisfactory"
    needs_improvement = "needs_improvement"
    unsatisfactory    = "unsatisfactory"
    critical          = "critical"


class FindingRisk(str, enum.Enum):
    low      = "low"
    medium   = "medium"
    high     = "high"
    critical = "critical"


class FindingCategory(str, enum.Enum):
    cdd                    = "cdd"
    edd                    = "edd"
    transaction_monitoring = "transaction_monitoring"
    regulatory_reporting   = "regulatory_reporting"
    governance             = "governance"
    training               = "training"
    record_keeping         = "record_keeping"
    risk_assessment        = "risk_assessment"
    policies_procedures    = "policies_procedures"
    other                  = "other"


class FindingStatus(str, enum.Enum):
    open               = "open"
    response_submitted = "response_submitted"
    in_remediation     = "in_remediation"
    closed             = "closed"
    overdue            = "overdue"
    accepted_risk      = "accepted_risk"    # Management accepted residual risk


class RecommendationPriority(str, enum.Enum):
    immediate   = "immediate"    # Within 30 days
    short_term  = "short_term"   # Within 90 days
    medium_term = "medium_term"  # Within 6 months
    long_term   = "long_term"    # Within 12 months


class RecommendationStatus(str, enum.Enum):
    open      = "open"
    accepted  = "accepted"       # Entity agrees to implement
    rejected  = "rejected"       # Entity disputes / accepts risk
    in_progress = "in_progress"
    completed = "completed"
    overdue   = "overdue"


class ActionType(str, enum.Enum):
    policy_update        = "policy_update"
    process_change       = "process_change"
    training             = "training"
    system_change        = "system_change"
    control_enhancement  = "control_enhancement"
    staff_change         = "staff_change"
    technology_uplift    = "technology_uplift"
    other                = "other"


class ActionStatus(str, enum.Enum):
    planned     = "planned"
    in_progress = "in_progress"
    completed   = "completed"
    verified    = "verified"     # Compliance officer verified completion
    overdue     = "overdue"
    cancelled   = "cancelled"


# ── Models ────────────────────────────────────────────────────────────────────

class IndependentReview(Base):
    """
    An independent review engagement — the top-level container for
    findings, recommendations, and remediation actions.
    """
    __tablename__ = "independent_reviews"

    id         = Column(String, primary_key=True, default=lambda: f"ir_{uuid4().hex[:12]}")
    review_ref = Column(String(30), unique=True, nullable=False, index=True)  # IR-2026-001
    org_id     = Column(String, ForeignKey("organisations.id", ondelete="CASCADE"),
                        nullable=False, index=True)

    review_type   = Column(Enum(ReviewType), nullable=False)
    review_scope  = Column(Enum(ReviewScope), nullable=False)
    status        = Column(Enum(ReviewStatus), default=ReviewStatus.planned, nullable=False, index=True)
    overall_rating = Column(Enum(ReviewRating))

    # ── Reviewer ───────────────────────────────────────────────────────────────
    reviewer_name        = Column(String(255))   # Person or firm conducting review
    reviewer_firm        = Column(String(255))   # External firm name (if external)
    reviewer_credentials = Column(String(500))   # Qualifications / independence statement

    # ── Scope & period ────────────────────────────────────────────────────────
    title               = Column(String(500), nullable=False)
    description         = Column(Text)
    review_period_start = Column(Date)
    review_period_end   = Column(Date)
    areas_reviewed      = Column(JSON, default=list)   # Free-text list of specific areas

    # ── Commissioning ─────────────────────────────────────────────────────────
    commissioned_by = Column(String)               # user_id (Board/MLRO)
    commissioned_at = Column(DateTime(timezone=True))
    report_date     = Column(Date)                 # Date review report issued
    report_ref      = Column(String(100))          # External report reference number

    # ── Findings summary ──────────────────────────────────────────────────────
    executive_summary     = Column(Text)
    finding_count_critical = Column(Integer, default=0)
    finding_count_high     = Column(Integer, default=0)
    finding_count_medium   = Column(Integer, default=0)
    finding_count_low      = Column(Integer, default=0)

    # ── Response ──────────────────────────────────────────────────────────────
    management_response_due  = Column(Date)
    management_response_at   = Column(DateTime(timezone=True))
    board_acknowledged       = Column(Boolean, default=False)
    board_acknowledged_by    = Column(String)
    board_acknowledged_at    = Column(DateTime(timezone=True))

    # ── Completion ────────────────────────────────────────────────────────────
    completed_at   = Column(DateTime(timezone=True))
    completed_by   = Column(String)
    closure_notes  = Column(Text)

    created_by = Column(String, nullable=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())


class ReviewFinding(Base):
    """
    An individual finding raised during an independent review.
    E.g. "Finding #23 — CDD process inconsistent. Risk: Medium."
    """
    __tablename__ = "review_findings"

    id           = Column(String, primary_key=True, default=lambda: f"rf_{uuid4().hex[:12]}")
    finding_ref  = Column(String(30), unique=True, nullable=False, index=True)  # FIND-2026-023
    review_id    = Column(String, ForeignKey("independent_reviews.id", ondelete="CASCADE"),
                          nullable=False, index=True)
    org_id       = Column(String, nullable=False, index=True)
    finding_number = Column(Integer, nullable=False)   # Sequential within review

    # ── Classification ────────────────────────────────────────────────────────
    title       = Column(String(500), nullable=False)
    description = Column(Text, nullable=False)
    risk_rating = Column(Enum(FindingRisk), nullable=False)
    category    = Column(Enum(FindingCategory), nullable=False)
    status      = Column(Enum(FindingStatus), default=FindingStatus.open, nullable=False, index=True)

    # ── Regulatory reference ──────────────────────────────────────────────────
    regulatory_reference = Column(String(500))   # e.g. "AML/CTF Act 2006 s.82(2)(b)"
    policy_reference     = Column(String(500))   # Internal policy reference

    # ── Evidence ──────────────────────────────────────────────────────────────
    evidence_refs    = Column(JSON, default=list)   # document_ids / descriptions
    affected_areas   = Column(JSON, default=list)   # Which business areas affected
    sample_tested    = Column(Integer)              # Number of records tested
    sample_failed    = Column(Integer)              # Number that failed

    # ── Management response ───────────────────────────────────────────────────
    management_response   = Column(Text)
    response_due_date     = Column(Date, index=True)
    response_submitted_at = Column(DateTime(timezone=True))
    response_submitted_by = Column(String)

    # ── Closure ───────────────────────────────────────────────────────────────
    closed_at  = Column(DateTime(timezone=True))
    closed_by  = Column(String)
    closure_evidence = Column(Text)

    created_by = Column(String, nullable=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())


class ReviewRecommendation(Base):
    """
    A recommendation linked to a finding.
    One finding may have multiple recommendations.
    """
    __tablename__ = "review_recommendations"

    id                 = Column(String, primary_key=True, default=lambda: f"rr_{uuid4().hex[:12]}")
    recommendation_ref = Column(String(30), unique=True, nullable=False, index=True)
    finding_id  = Column(String, ForeignKey("review_findings.id", ondelete="CASCADE"),
                         nullable=False, index=True)
    review_id   = Column(String, ForeignKey("independent_reviews.id", ondelete="CASCADE"),
                         nullable=False, index=True)
    org_id      = Column(String, nullable=False)

    description = Column(Text, nullable=False)
    priority    = Column(Enum(RecommendationPriority), nullable=False)
    status      = Column(Enum(RecommendationStatus), default=RecommendationStatus.open,
                         nullable=False, index=True)

    target_date    = Column(Date, index=True)
    accepted_by    = Column(String)         # user_id who accepted/rejected
    accepted_at    = Column(DateTime(timezone=True))
    rejection_reason = Column(Text)         # If entity disputes the recommendation

    created_by = Column(String, nullable=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())


class ReviewAction(Base):
    """
    A remediation action taken to address a recommendation.
    Tracks ownership, due date, completion evidence, and verification.
    """
    __tablename__ = "review_actions"

    id         = Column(String, primary_key=True, default=lambda: f"ra_{uuid4().hex[:12]}")
    action_ref = Column(String(30), unique=True, nullable=False, index=True)
    recommendation_id = Column(String, ForeignKey("review_recommendations.id", ondelete="CASCADE"),
                                nullable=False, index=True)
    finding_id = Column(String, ForeignKey("review_findings.id", ondelete="CASCADE"),
                        nullable=False, index=True)
    review_id  = Column(String, ForeignKey("independent_reviews.id", ondelete="CASCADE"),
                        nullable=False, index=True)
    org_id     = Column(String, nullable=False)

    title       = Column(String(500), nullable=False)
    description = Column(Text)
    action_type = Column(Enum(ActionType), nullable=False)
    status      = Column(Enum(ActionStatus), default=ActionStatus.planned, nullable=False, index=True)

    # ── Ownership & timeline ──────────────────────────────────────────────────
    assigned_to  = Column(String)       # user_id
    assigned_by  = Column(String)
    assigned_at  = Column(DateTime(timezone=True))
    due_date     = Column(Date, index=True)
    is_overdue   = Column(Boolean, default=False)

    # ── Completion ────────────────────────────────────────────────────────────
    completion_evidence = Column(Text)     # Description of how action was completed
    supporting_doc_ids  = Column(JSON, default=list)  # document_ids as evidence
    completed_by        = Column(String)
    completed_at        = Column(DateTime(timezone=True))

    # ── Verification (compliance sign-off) ───────────────────────────────────
    verified_by  = Column(String)          # Compliance officer who verified
    verified_at  = Column(DateTime(timezone=True))
    verified_notes = Column(Text)

    # ── Cancellation ─────────────────────────────────────────────────────────
    cancelled_by     = Column(String)
    cancelled_at     = Column(DateTime(timezone=True))
    cancellation_reason = Column(Text)

    created_by = Column(String, nullable=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())
