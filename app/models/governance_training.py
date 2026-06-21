"""
AML/CTF Governance — Training Management Framework

Aligned with:
  - AUSTRAC AML/CTF Rules 2025 (staff awareness and training obligations)
  - FATF Recommendation 18 (internal controls, compliance, audit)
  - APRA CPS 230
  - ISO 37301 Compliance Management Systems

Architecture:
  TrainingCourse           — course catalogue (standard + custom)
  GovernanceTrainingRecord — individual staff training record
  TrainingAssignment       — bulk assignment of courses to users/roles
  TrainingCompletionSummary — cached aggregation (view / materialised)

Calculated fields (formula-driven, not hardcoded):
  Training Completion %      = completed / assigned × 100
  Department Completion %    = dept_completed / dept_assigned × 100
  Overdue %                  = overdue / assigned × 100
  Expiry Risk %              = expiring_within_30d / active × 100

DISCLAIMER: This module is a governance tooling aid only.
"""

from __future__ import annotations

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
    Integer,
    String,
    Text,
    func,
)
from sqlalchemy.orm import relationship

from app.db.database import Base

# ══════════════════════════════════════════════════════════════════════════════
# ENUMS
# ══════════════════════════════════════════════════════════════════════════════


class TrainingType(str, enum.Enum):
    """
    AML/CTF training categories aligned to AUSTRAC obligations and
    FATF R.18 internal training requirements.
    """

    aml_induction = "aml_induction"
    annual_aml_refresher = "annual_aml_refresher"
    cdd_training = "cdd_training"
    edd_training = "edd_training"
    smr_training = "smr_training"
    sanctions_training = "sanctions_training"
    travel_rule_training = "travel_rule_training"
    board_aml_training = "board_aml_training"
    compliance_officer_training = "compliance_officer_training"
    high_risk_function_training = "high_risk_function_training"
    pep_training = "pep_training"
    tipping_off_training = "tipping_off_training"
    record_keeping_training = "record_keeping_training"
    custom = "custom"


class TrainingStatus(str, enum.Enum):
    """
    Training record lifecycle status.
    Status is CALCULATED by governance_metrics.py — never set manually.

    Logic (evaluated in order):
      exempt     → assignment has is_exempt = True
      completed  → completion_date is not null AND (expiry_date is null OR expiry_date >= today)
      expired    → completion_date is not null AND expiry_date < today
      overdue    → completion_date is null AND due_date < today
      in_progress→ completion_date is null AND started_at is not null AND due_date >= today
      assigned   → completion_date is null AND started_at is null AND due_date >= today
    """

    assigned = "assigned"
    in_progress = "in_progress"
    completed = "completed"
    expired = "expired"
    overdue = "overdue"
    exempt = "exempt"


class AssignmentTrigger(str, enum.Enum):
    onboarding = "onboarding"  # new staff
    annual_cycle = "annual_cycle"  # annual training calendar
    role_change = "role_change"  # promotion / role update
    policy_update = "policy_update"  # material policy change
    incident = "incident"  # post-incident / SMR
    regulatory_change = "regulatory_change"
    manual = "manual"  # MLRO / admin manual assignment


# ══════════════════════════════════════════════════════════════════════════════
# TRAINING COURSE (catalogue)
# ══════════════════════════════════════════════════════════════════════════════


class TrainingCourse(Base):
    """
    Training course catalogue entry — standard and custom.

    Standard courses are seeded per industry on AMLSolution creation.
    Organisations can add custom courses (no-code: is_custom = True).
    Course expiry drives training record expiry date calculation.
    """

    __tablename__ = "training_courses"

    id = Column(String, primary_key=True, default=lambda: f"tc_{uuid4().hex[:12]}")
    org_id = Column(
        String,
        ForeignKey("organisations.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    solution_id = Column(String, ForeignKey("aml_solutions.id"), nullable=True)
    # null for global standard courses seeded at platform level

    # ── Identity ──────────────────────────────────────────────────────────────
    course_code = Column(String(30), nullable=False)  # e.g. TRN-IND-001
    name = Column(String(255), nullable=False)
    training_type = Column(Enum(TrainingType), nullable=False, index=True)
    description = Column(Text)
    learning_objectives = Column(JSON, default=list)  # [str]

    # ── Provider & delivery ───────────────────────────────────────────────────
    provider = Column(String(255))
    # e.g. "Verigo Platform", "AUSTRAC eLearning", "External Trainer", "Internal"
    delivery_method = Column(String(50))
    # e.g. "online_module", "face_to_face", "webinar", "document_attestation"
    duration_minutes = Column(Integer)
    external_url = Column(String(512))  # link to external LMS / course

    # ── Assessment ────────────────────────────────────────────────────────────
    has_assessment = Column(Boolean, default=False)
    pass_mark = Column(Float)  # e.g. 80.0 for 80%
    max_attempts = Column(Integer, default=3)
    issues_certificate = Column(Boolean, default=False)

    # ── Expiry ────────────────────────────────────────────────────────────────
    expiry_months = Column(Integer)
    # null = does not expire; 12 = annual renewal required

    # ── Applicability ─────────────────────────────────────────────────────────
    applicable_roles = Column(JSON, default=list)
    # ["admin", "mlro", "compliance", "analyst", "all"] — roles that must complete this
    is_mandatory = Column(Boolean, default=False)
    is_custom = Column(Boolean, default=False)  # org-created custom course
    is_active = Column(Boolean, default=True)

    # ── Regulatory references ─────────────────────────────────────────────────
    regulatory_references = Column(JSON, default=list)

    created_by = Column(String, ForeignKey("users.id", ondelete="SET NULL"))
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())

    records = relationship(
        "GovernanceTrainingRecord",
        back_populates="course",
        cascade="all, delete-orphan",
    )
    assignments = relationship(
        "TrainingAssignment", back_populates="course", cascade="all, delete-orphan"
    )


# ══════════════════════════════════════════════════════════════════════════════
# GOVERNANCE TRAINING RECORD (individual staff record)
# ══════════════════════════════════════════════════════════════════════════════


class GovernanceTrainingRecord(Base):
    """
    Individual staff AML/CTF training record.

    Status is CALCULATED, not manually set (see TrainingStatus docstring).
    Expiry date = completion_date + course.expiry_months (if expiry_months set).

    Satisfies:
      - AUSTRAC obligation to train staff with appropriate AML/CTF skills
      - Evidence of staff awareness for AUSTRAC audits
      - APRA CPS 230 workforce capability tracking
      - Annual compliance report training section
    """

    __tablename__ = "governance_training_records"

    id = Column(String, primary_key=True, default=lambda: f"gtr_{uuid4().hex[:12]}")
    org_id = Column(
        String,
        ForeignKey("organisations.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    solution_id = Column(String, ForeignKey("aml_solutions.id"), nullable=False)
    course_id = Column(
        String, ForeignKey("training_courses.id"), nullable=False, index=True
    )
    user_id = Column(String, ForeignKey("users.id"), nullable=False, index=True)

    # ── Assignment ────────────────────────────────────────────────────────────
    assignment_id = Column(String, ForeignKey("training_assignments.id"), nullable=True)
    assigned_by = Column(String, ForeignKey("users.id", ondelete="SET NULL"))
    assigned_date = Column(Date, nullable=False)
    due_date = Column(Date, nullable=False)
    trigger = Column(Enum(AssignmentTrigger), default=AssignmentTrigger.manual)

    # ── Completion ────────────────────────────────────────────────────────────
    started_at = Column(DateTime(timezone=True))
    completion_date = Column(Date)
    expiry_date = Column(Date)
    # = completion_date + course.expiry_months (calculated on save)

    # ── Assessment result ─────────────────────────────────────────────────────
    score = Column(Float)  # 0–100
    pass_mark_applied = Column(Float)  # copy of course.pass_mark at time of completion
    passed = Column(Boolean)
    attempt_number = Column(Integer, default=1)

    # ── Certificate ───────────────────────────────────────────────────────────
    certificate_document_id = Column(String)  # Document.id
    certificate_number = Column(String(100))

    # ── Status (CALCULATED — do not set manually) ─────────────────────────────
    status = Column(
        Enum(TrainingStatus),
        default=TrainingStatus.assigned,
        nullable=False,
        index=True,
    )

    # ── Exemption ─────────────────────────────────────────────────────────────
    is_exempt = Column(Boolean, default=False)
    exemption_reason = Column(Text)
    exemption_approved_by = Column(String, ForeignKey("users.id", ondelete="SET NULL"))

    # ── Reminder tracking ─────────────────────────────────────────────────────
    reminders_sent = Column(JSON, default=list)
    # [{"type": "7_day", "sent_at": "ISO datetime"}]

    notes = Column(Text)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())

    course = relationship("TrainingCourse", back_populates="records")
    assignment = relationship(
        "TrainingAssignment", back_populates="records", foreign_keys=[assignment_id]
    )


# ══════════════════════════════════════════════════════════════════════════════
# TRAINING ASSIGNMENT (bulk assignment engine)
# ══════════════════════════════════════════════════════════════════════════════


class TrainingAssignment(Base):
    """
    Bulk training assignment — assigns a course to multiple users, roles,
    or business units simultaneously.

    One assignment spawns N GovernanceTrainingRecord rows (one per user).
    The assignment record is the parent; individual records are the detail.

    Enables:
      - Annual training calendar (assign by role)
      - Onboarding curriculum (assign by trigger = onboarding)
      - Post-incident remediation (assign by trigger = incident)
      - Policy change attestation training (assign by trigger = policy_update)
    """

    __tablename__ = "training_assignments"

    id = Column(String, primary_key=True, default=lambda: f"ta_{uuid4().hex[:12]}")
    org_id = Column(
        String,
        ForeignKey("organisations.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    solution_id = Column(String, ForeignKey("aml_solutions.id"), nullable=False)
    course_id = Column(
        String, ForeignKey("training_courses.id"), nullable=False, index=True
    )

    # ── Assignment scope ──────────────────────────────────────────────────────
    assigned_to_user_ids = Column(JSON, default=list)  # specific users
    assigned_to_roles = Column(JSON, default=list)  # ["mlro", "compliance", "all"]
    assigned_to_units = Column(JSON, default=list)  # business unit names

    # ── Schedule ──────────────────────────────────────────────────────────────
    trigger = Column(Enum(AssignmentTrigger), nullable=False)
    assigned_date = Column(Date, nullable=False)
    due_date = Column(Date, nullable=False)
    notes = Column(Text)

    # ── Status ────────────────────────────────────────────────────────────────
    total_assigned = Column(Integer, default=0)  # count of records spawned
    is_active = Column(Boolean, default=True)

    assigned_by = Column(String, ForeignKey("users.id"), nullable=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    course = relationship("TrainingCourse", back_populates="assignments")
    records = relationship(
        "GovernanceTrainingRecord",
        back_populates="assignment",
        foreign_keys="GovernanceTrainingRecord.assignment_id",
    )


# ══════════════════════════════════════════════════════════════════════════════
# TRAINING CALCULATED FIELD FORMULAS
# (implemented in governance_metrics.py — defined here for documentation)
# ══════════════════════════════════════════════════════════════════════════════

"""
Training Completion % (org-wide):
  = COUNT(records WHERE status = 'completed') /
    COUNT(records WHERE status != 'exempt') * 100

Department Completion % (per business_unit):
  = COUNT(records WHERE user.business_unit = X AND status = 'completed') /
    COUNT(records WHERE user.business_unit = X AND status != 'exempt') * 100

Overdue %:
  = COUNT(records WHERE status = 'overdue') /
    COUNT(records WHERE status != 'exempt') * 100

Expiry Risk % (expiring within 30 days):
  = COUNT(records WHERE status = 'completed'
      AND expiry_date BETWEEN today AND today + 30 days) /
    COUNT(records WHERE status = 'completed' AND expiry_date IS NOT NULL) * 100

Training Health Score (0-100):
  = (completion_pct * 0.40)
  + ((1 - overdue_pct/100) * 0.30)
  + ((1 - expiry_risk_pct/100) * 0.20)
  + (attestation_completion_pct * 0.10)
  All weights configurable via GovernanceCustomisation.scoring_config
"""


# ══════════════════════════════════════════════════════════════════════════════
# STANDARD COURSE SEEDS
# ══════════════════════════════════════════════════════════════════════════════

STANDARD_TRAINING_COURSES = [
    {
        "course_code": "TRN-IND-001",
        "name": "AML/CTF Induction Training",
        "training_type": TrainingType.aml_induction,
        "description": "Foundational AML/CTF training for all new staff. Covers AML/CTF Act obligations, reporting requirements, and internal procedures.",
        "duration_minutes": 60,
        "has_assessment": True,
        "pass_mark": 80.0,
        "expiry_months": 12,
        "is_mandatory": True,
        "applicable_roles": ["all"],
        "regulatory_references": ["AML/CTF Act s.36", "AML/CTF Rules 2025 r.10.1"],
    },
    {
        "course_code": "TRN-ANN-001",
        "name": "Annual AML/CTF Refresher Training",
        "training_type": TrainingType.annual_aml_refresher,
        "description": "Annual refresher covering regulatory updates, typology alerts, and internal policy changes for the year.",
        "duration_minutes": 45,
        "has_assessment": True,
        "pass_mark": 80.0,
        "expiry_months": 12,
        "is_mandatory": True,
        "applicable_roles": ["all"],
    },
    {
        "course_code": "TRN-CDD-001",
        "name": "Customer Due Diligence (CDD) Training",
        "training_type": TrainingType.cdd_training,
        "description": "Detailed CDD and ECDD procedures including ID verification, beneficial ownership, and PEP identification.",
        "duration_minutes": 45,
        "has_assessment": True,
        "pass_mark": 80.0,
        "expiry_months": 24,
        "is_mandatory": False,
        "applicable_roles": ["analyst", "compliance", "mlro"],
    },
    {
        "course_code": "TRN-SMR-001",
        "name": "Suspicious Matter Reporting (SMR) Training",
        "training_type": TrainingType.smr_training,
        "description": "SMR obligations, red flags, tipping-off prohibition, and the internal escalation process.",
        "duration_minutes": 30,
        "has_assessment": True,
        "pass_mark": 80.0,
        "expiry_months": 12,
        "is_mandatory": False,
        "applicable_roles": ["analyst", "compliance", "mlro"],
    },
    {
        "course_code": "TRN-SANC-001",
        "name": "Sanctions Screening Training",
        "training_type": TrainingType.sanctions_training,
        "description": "OFAC, UN, and DFAT sanctions screening obligations, screening system use, and escalation procedures.",
        "duration_minutes": 30,
        "has_assessment": True,
        "pass_mark": 80.0,
        "expiry_months": 12,
        "is_mandatory": False,
        "applicable_roles": ["analyst", "compliance", "mlro"],
    },
    {
        "course_code": "TRN-BRD-001",
        "name": "Board AML/CTF Governance Training",
        "training_type": TrainingType.board_aml_training,
        "description": "Board-level governance obligations, MLRO reporting lines, AML program oversight, and regulatory accountability.",
        "duration_minutes": 60,
        "has_assessment": False,
        "expiry_months": 12,
        "is_mandatory": True,
        "applicable_roles": ["admin"],
        "regulatory_references": ["AML/CTF Act s.36", "APRA CPS 230"],
    },
    {
        "course_code": "TRN-MLRO-001",
        "name": "MLRO / Compliance Officer Certification",
        "training_type": TrainingType.compliance_officer_training,
        "description": "Advanced training for the MLRO and compliance officers covering program management, AUSTRAC liaison, and independent review.",
        "duration_minutes": 120,
        "has_assessment": True,
        "pass_mark": 85.0,
        "expiry_months": 12,
        "is_mandatory": True,
        "applicable_roles": ["mlro", "compliance"],
    },
]
