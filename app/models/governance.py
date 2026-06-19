"""
AML/CTF Governance Framework — Policy Management Module

Implements bank-grade policy lifecycle management aligned with:
  - FATF Recommendations & Risk-Based Approach Guidance
  - AUSTRAC AML/CTF Rules 2025 (2026 reform)
  - APRA Governance Principles / CPS 230
  - ISO 31000 Risk Management
  - ISO 37301 Compliance Management Systems
  - Three Lines of Defence Model

Architecture:
  Policy               — master governance policy document
  PolicyVersion        — immutable version history (full content snapshots)
  PolicyWorkflowEvent  — immutable audit trail of every status transition
  PolicyAttestation    — staff read-and-understood / annual attestation log
  PolicyReviewReminder — scheduled review reminder dispatch log

DISCLAIMER: This module is a governance tooling aid only. The reporting entity
and its MLRO/Board remain solely responsible for all AML/CTF policy decisions.
Verigo does not provide legal, compliance, or regulatory advice.
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


class PolicyType(str, enum.Enum):
    """
    Policy types aligned to AUSTRAC AML/CTF program obligations and
    leading international compliance framework categories.
    """

    # ── Core AML/CTF Program Documents ───────────────────────────────────────
    aml_ctf_program = "aml_ctf_program"
    risk_assessment_methodology = "risk_assessment_methodology"

    # ── Customer Due Diligence ────────────────────────────────────────────────
    cdd_policy = "cdd_policy"
    edd_policy = "edd_policy"
    pep_policy = "pep_policy"
    beneficial_ownership_policy = "beneficial_ownership_policy"

    # ── Transaction & Monitoring ──────────────────────────────────────────────
    transaction_monitoring_policy = "transaction_monitoring_policy"
    sanctions_screening_policy = "sanctions_screening_policy"
    travel_rule_policy = "travel_rule_policy"

    # ── Reporting ─────────────────────────────────────────────────────────────
    reporting_policy = "reporting_policy"  # SMR, TTR, IFTI
    record_keeping_policy = "record_keeping_policy"

    # ── Governance & People ───────────────────────────────────────────────────
    training_policy = "training_policy"
    outsourcing_policy = "outsourcing_policy"
    whistleblower_policy = "whistleblower_policy"
    conflict_of_interest_policy = "conflict_of_interest_policy"
    data_privacy_policy = "data_privacy_policy"

    # ── Procedures (sub-policy level) ─────────────────────────────────────────
    procedure = "procedure"

    other = "other"


class PolicyCategory(str, enum.Enum):
    program = "program"  # Top-level AML/CTF program documents
    operational = "operational"  # Day-to-day CDD, TM, screening
    procedural = "procedural"  # Step-by-step procedures
    technical = "technical"  # System/technical controls and specs
    governance = "governance"  # Board and MLRO governance instruments


class PolicyLifecycleStatus(str, enum.Enum):
    """
    Full APRA/FATF-aligned policy lifecycle status set.
    Transitions are enforced via PolicyWorkflowEvent records.
    """

    draft = "draft"
    internal_review = "internal_review"  # 1L / author review
    compliance_review = "compliance_review"  # 2L / MLRO / compliance function review
    pending_approval = "pending_approval"  # Awaiting Board / senior mgmt sign-off
    published = "published"  # Active, operative policy
    periodic_review = "periodic_review"  # Triggered by review date or event
    superseded = "superseded"  # Replaced by newer version
    archived = "archived"  # Withdrawn, retained for record-keeping


class AttestationType(str, enum.Enum):
    read_and_understood = "read_and_understood"  # staff acknowledges reading the policy
    annual_attestation = "annual_attestation"  # annual compliance with policy
    post_incident = "post_incident"  # re-attestation after incident/breach


class ReminderType(str, enum.Enum):
    sixty_day = "60_day"
    thirty_day = "30_day"
    fourteen_day = "14_day"
    seven_day = "7_day"
    overdue = "overdue"


# Valid lifecycle transitions (source → allowed destinations)
ALLOWED_TRANSITIONS: dict[PolicyLifecycleStatus, list[PolicyLifecycleStatus]] = {
    PolicyLifecycleStatus.draft: [
        PolicyLifecycleStatus.internal_review,
        PolicyLifecycleStatus.archived,
    ],
    PolicyLifecycleStatus.internal_review: [
        PolicyLifecycleStatus.compliance_review,
        PolicyLifecycleStatus.draft,
    ],
    PolicyLifecycleStatus.compliance_review: [
        PolicyLifecycleStatus.pending_approval,
        PolicyLifecycleStatus.internal_review,
    ],
    PolicyLifecycleStatus.pending_approval: [
        PolicyLifecycleStatus.published,
        PolicyLifecycleStatus.compliance_review,
    ],
    PolicyLifecycleStatus.published: [
        PolicyLifecycleStatus.periodic_review,
        PolicyLifecycleStatus.superseded,
        PolicyLifecycleStatus.archived,
    ],
    PolicyLifecycleStatus.periodic_review: [
        PolicyLifecycleStatus.internal_review,
        PolicyLifecycleStatus.published,
        PolicyLifecycleStatus.superseded,
        PolicyLifecycleStatus.archived,
    ],
    PolicyLifecycleStatus.superseded: [PolicyLifecycleStatus.archived],
    PolicyLifecycleStatus.archived: [],
}


# ══════════════════════════════════════════════════════════════════════════════
# POLICY (master governance document)
# ══════════════════════════════════════════════════════════════════════════════


class Policy(Base):
    """
    Governance-grade AML/CTF policy document with full lifecycle management.

    Supports:
      - Versioning (major.minor — new PolicyVersion created on each publish)
      - Multi-stage approval workflow (draft → review → compliance → approval → published)
      - Policy attestation (staff acknowledgement log)
      - Review reminders (60/30/14/7 day pre-alert + overdue)
      - Immutable audit trail (PolicyWorkflowEvent)
      - Policy history register (PolicyVersion snapshots)
      - Cross-references to AMLSolution and AMLProgram

    Three Lines of Defence mapping:
      - 1L: document_owner creates/maintains (business unit)
      - 2L: compliance_reviewer reviews (MLRO / compliance function)
      - 3L: approver approves (Board / CEO / Risk Committee)
    """

    __tablename__ = "governance_policies"

    id = Column(String, primary_key=True, default=lambda: f"gp_{uuid4().hex[:12]}")

    # ── Organisational linkage ────────────────────────────────────────────────
    org_id = Column(
        String,
        ForeignKey("organisations.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    solution_id = Column(
        String,
        ForeignKey("aml_solutions.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )

    # ── Identity ──────────────────────────────────────────────────────────────
    policy_number = Column(String(30), nullable=False)
    # e.g. AML-POL-001; generated on creation; unique per org
    title = Column(String(255), nullable=False)
    policy_type = Column(Enum(PolicyType), nullable=False)
    policy_category = Column(
        Enum(PolicyCategory), nullable=False, default=PolicyCategory.operational
    )
    business_unit = Column(String(100))  # e.g. Compliance, Operations, Risk
    regulatory_references = Column(JSON, default=list)
    # e.g. ["AML/CTF Act s.84", "AML/CTF Rules 2025 r.8.1.3", "FATF R.10"]

    # ── Version ───────────────────────────────────────────────────────────────
    version_major = Column(Integer, default=1, nullable=False)
    version_minor = Column(Integer, default=0, nullable=False)
    # Displayed as "1.0", "1.1", "2.0"

    # ── Lifecycle ─────────────────────────────────────────────────────────────
    status = Column(
        Enum(PolicyLifecycleStatus),
        default=PolicyLifecycleStatus.draft,
        nullable=False,
        index=True,
    )

    # ── Dates ─────────────────────────────────────────────────────────────────
    effective_date = Column(Date)
    review_due_date = Column(Date, nullable=False)  # mandatory — drives reminders
    approval_date = Column(Date)
    last_reviewed_date = Column(Date)
    next_review_date = Column(Date)
    archived_date = Column(Date)

    # ── Ownership & approval ──────────────────────────────────────────────────
    document_owner = Column(String, ForeignKey("users.id"), nullable=False)
    # 1L — author, usually from the business unit
    internal_reviewer = Column(String, ForeignKey("users.id"))
    # 1L review (senior manager / team lead)
    compliance_reviewer = Column(String, ForeignKey("users.id"))
    # 2L review (MLRO / compliance officer)
    approver = Column(String, ForeignKey("users.id"))
    # 3L approval (Board / CEO / Risk Committee)

    # ── Content ───────────────────────────────────────────────────────────────
    content = Column(Text)  # full policy text (Markdown/rich text)
    summary = Column(Text)  # executive summary / purpose statement
    scope = Column(Text)  # who/what this policy applies to
    attachments = Column(JSON, default=list)  # [document.id]
    # referenced document IDs from the Document model (polymorphic)

    # ── Attestation requirements ──────────────────────────────────────────────
    requires_attestation = Column(Boolean, default=False)
    attestation_due_days = Column(Integer, default=14)
    # staff must attest within N days of publish/update
    annual_attestation = Column(Boolean, default=False)
    # triggers annual re-attestation cycle

    # ── Cross-reference ───────────────────────────────────────────────────────
    superseded_by_id = Column(
        String, ForeignKey("governance_policies.id"), nullable=True
    )
    # when status=superseded, points to the replacing policy

    # ── Audit ─────────────────────────────────────────────────────────────────
    created_by = Column(String, ForeignKey("users.id"), nullable=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())

    # ── Relationships ─────────────────────────────────────────────────────────
    versions = relationship(
        "PolicyVersion",
        back_populates="policy",
        cascade="all, delete-orphan",
        order_by="PolicyVersion.created_at",
    )
    workflow_events = relationship(
        "PolicyWorkflowEvent",
        back_populates="policy",
        cascade="all, delete-orphan",
        order_by="PolicyWorkflowEvent.occurred_at",
    )
    attestations = relationship(
        "PolicyAttestation", back_populates="policy", cascade="all, delete-orphan"
    )
    reminders = relationship(
        "PolicyReviewReminder", back_populates="policy", cascade="all, delete-orphan"
    )
    superseded_by = relationship(
        "Policy", foreign_keys=[superseded_by_id], uselist=False
    )

    @property
    def version_string(self) -> str:
        return f"{self.version_major}.{self.version_minor}"

    def next_minor_version(self) -> tuple[int, int]:
        return (self.version_major, self.version_minor + 1)

    def next_major_version(self) -> tuple[int, int]:
        return (self.version_major + 1, 0)


# ══════════════════════════════════════════════════════════════════════════════
# POLICY VERSION (immutable history register)
# ══════════════════════════════════════════════════════════════════════════════


class PolicyVersion(Base):
    """
    Immutable snapshot of a policy at the time it was published.
    Created automatically on every publish event.

    Provides:
      - Complete content history (what was in force at any date)
      - Version comparison capability
      - Regulatory evidence of what policy applied during a period
      - Policy history register (required by AUSTRAC record-keeping rules)

    Records are NEVER modified or deleted (soft-archive only via is_archived).
    """

    __tablename__ = "policy_versions"

    id = Column(String, primary_key=True, default=lambda: f"pv_{uuid4().hex[:12]}")
    policy_id = Column(
        String,
        ForeignKey("governance_policies.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    org_id = Column(String, ForeignKey("organisations.id"), nullable=False, index=True)

    # ── Version identity ──────────────────────────────────────────────────────
    version_major = Column(Integer, nullable=False)
    version_minor = Column(Integer, nullable=False)
    version_label = Column(String(20))  # e.g. "1.0", "2.1"

    # ── Full content snapshot at this version ─────────────────────────────────
    title = Column(String(255), nullable=False)
    content = Column(Text)  # full Markdown content snapshot
    summary = Column(Text)
    scope = Column(Text)
    attachments = Column(JSON, default=list)

    # ── Governance snapshot ───────────────────────────────────────────────────
    approved_by = Column(String)  # user id at time of approval
    approved_at = Column(DateTime(timezone=True))
    effective_date = Column(Date)
    review_due_date = Column(Date)

    # ── Change record ─────────────────────────────────────────────────────────
    change_type = Column(String(20))  # major | minor | administrative
    change_summary = Column(Text)  # brief description of what changed
    change_reason = Column(Text)  # business/regulatory reason for change

    # ── Provenance ────────────────────────────────────────────────────────────
    created_by = Column(String, ForeignKey("users.id"), nullable=False)
    created_at = Column(
        DateTime(timezone=True), server_default=func.now(), nullable=False, index=True
    )
    # NOTE: created_at is populated on insert and NEVER updated (immutable record)

    policy = relationship("Policy", back_populates="versions")

    @property
    def version_string(self) -> str:
        return f"{self.version_major}.{self.version_minor}"


# ══════════════════════════════════════════════════════════════════════════════
# POLICY WORKFLOW EVENT (immutable audit trail)
# ══════════════════════════════════════════════════════════════════════════════


class PolicyWorkflowEvent(Base):
    """
    Immutable audit trail of every policy status transition and workflow action.

    Every state change (submit for review, approve, publish, archive…) creates
    one record. Records are NEVER modified or deleted.

    Satisfies:
      - AUSTRAC record-keeping obligations (7-year minimum)
      - APRA CPS 230 governance documentation requirements
      - ISO 37301 compliance management audit trail
      - Internal audit evidence requirements
    """

    __tablename__ = "policy_workflow_events"

    id = Column(String, primary_key=True, default=lambda: f"pwe_{uuid4().hex[:12]}")
    policy_id = Column(
        String,
        ForeignKey("governance_policies.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    org_id = Column(String, ForeignKey("organisations.id"), nullable=False)

    # ── Transition ────────────────────────────────────────────────────────────
    from_status = Column(Enum(PolicyLifecycleStatus), nullable=False)
    to_status = Column(Enum(PolicyLifecycleStatus), nullable=False)
    action = Column(String(100), nullable=False)
    # e.g. "submit_for_review", "approve", "publish", "request_changes", "archive"

    # ── Actor ─────────────────────────────────────────────────────────────────
    actor_id = Column(String, ForeignKey("users.id"), nullable=False)
    # user who performed the action

    # ── Context ───────────────────────────────────────────────────────────────
    comments = Column(Text)  # reviewer/approver comments
    version_at_event = Column(
        String(20)
    )  # e.g. "1.0" — version when this event occurred

    # ── Timestamp ─────────────────────────────────────────────────────────────
    occurred_at = Column(
        DateTime(timezone=True), server_default=func.now(), nullable=False, index=True
    )
    # IMMUTABLE — never updated after insert

    policy = relationship("Policy", back_populates="workflow_events")


# ══════════════════════════════════════════════════════════════════════════════
# POLICY ATTESTATION (staff acknowledgement log)
# ══════════════════════════════════════════════════════════════════════════════


class PolicyAttestation(Base):
    """
    Staff attestation log — records each user's acknowledgement of a policy.

    Types:
      read_and_understood  — triggered on publish/update when policy requires attestation
      annual_attestation   — annual cycle (AUSTRAC training/awareness obligation)
      post_incident        — mandatory re-attestation following a breach or SMR

    Used for:
      - Demonstrating staff awareness to AUSTRAC
      - APRA CPS 230 governance obligations
      - Internal audit / independent review evidence
      - Training compliance tracking (Training Policy)
    """

    __tablename__ = "policy_attestations"

    id = Column(String, primary_key=True, default=lambda: f"pa_{uuid4().hex[:12]}")
    policy_id = Column(
        String,
        ForeignKey("governance_policies.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    policy_version_id = Column(String, ForeignKey("policy_versions.id"), nullable=True)
    # links to the specific version that was attested to
    org_id = Column(String, ForeignKey("organisations.id"), nullable=False)

    # ── Who attested ──────────────────────────────────────────────────────────
    user_id = Column(String, ForeignKey("users.id"), nullable=False, index=True)

    # ── What they attested ────────────────────────────────────────────────────
    attestation_type = Column(
        Enum(AttestationType),
        default=AttestationType.read_and_understood,
        nullable=False,
    )
    policy_version = Column(String(20))  # version string at time of attestation
    attestation_statement = Column(Text)
    # e.g. "I confirm I have read and understood the CDD Policy v2.1 effective 1 July 2026."

    # ── When ─────────────────────────────────────────────────────────────────
    attested_at = Column(
        DateTime(timezone=True), server_default=func.now(), nullable=False, index=True
    )
    # Immutable — never updated

    # ── Prompted by ──────────────────────────────────────────────────────────
    due_date = Column(Date)  # deadline set when attestation was requested
    is_overdue = Column(Boolean, default=False)  # flagged if attested after due_date
    reminded_at = Column(JSON, default=list)  # [datetime] — reminder timestamps

    # ── Supporting evidence ───────────────────────────────────────────────────
    comments = Column(Text)  # optional staff comment

    policy = relationship("Policy", back_populates="attestations")
    policy_version_obj = relationship("PolicyVersion")


# ══════════════════════════════════════════════════════════════════════════════
# POLICY REVIEW REMINDER (scheduled dispatch log)
# ══════════════════════════════════════════════════════════════════════════════


class PolicyReviewReminder(Base):
    """
    Scheduled and dispatched review reminders for the policy register.

    Reminder schedule (relative to review_due_date):
      T-60 days  → "Policy review due in 60 days"
      T-30 days  → "Policy review due in 30 days"
      T-14 days  → "Policy review due in 14 days"
      T-7 days   → "Policy review due in 7 days"
      T+0 / overdue → "Policy review is overdue"

    Recipients: document_owner + compliance_reviewer + approver (as configured).

    Satisfies AUSTRAC requirement to periodically review the AML/CTF program
    and update when risks materially change.
    """

    __tablename__ = "policy_review_reminders"

    id = Column(String, primary_key=True, default=lambda: f"prr_{uuid4().hex[:12]}")
    policy_id = Column(
        String,
        ForeignKey("governance_policies.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    org_id = Column(String, ForeignKey("organisations.id"), nullable=False)

    # ── Reminder config ───────────────────────────────────────────────────────
    reminder_type = Column(Enum(ReminderType), nullable=False)
    scheduled_date = Column(Date, nullable=False)  # when reminder should fire
    review_due_date = Column(
        Date, nullable=False
    )  # the policy review_due_date at scheduling time
    recipient_ids = Column(JSON, default=list)  # [user_id] — who to notify

    # ── Dispatch state ────────────────────────────────────────────────────────
    sent_at = Column(DateTime(timezone=True))  # null = not yet sent
    is_sent = Column(Boolean, default=False)
    send_error = Column(Text)  # error message if dispatch failed
    retry_count = Column(Integer, default=0)

    # ── Metadata ──────────────────────────────────────────────────────────────
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    policy = relationship("Policy", back_populates="reminders")


# ══════════════════════════════════════════════════════════════════════════════
# GOVERNANCE CONSTANTS
# ══════════════════════════════════════════════════════════════════════════════

# Policies that must be attested by ALL staff
MANDATORY_ATTESTATION_POLICY_TYPES = frozenset(
    {
        PolicyType.aml_ctf_program,
        PolicyType.cdd_policy,
        PolicyType.reporting_policy,
        PolicyType.training_policy,
    }
)

# Policies that trigger annual re-attestation
ANNUAL_ATTESTATION_POLICY_TYPES = frozenset(
    {
        PolicyType.aml_ctf_program,
        PolicyType.cdd_policy,
        PolicyType.edd_policy,
        PolicyType.sanctions_screening_policy,
        PolicyType.reporting_policy,
    }
)

# Default annual review cycle in months per policy category
DEFAULT_REVIEW_MONTHS: dict[PolicyCategory, int] = {
    PolicyCategory.program: 12,  # Annual — AUSTRAC requirement
    PolicyCategory.operational: 12,  # Annual
    PolicyCategory.procedural: 12,  # Annual
    PolicyCategory.technical: 24,  # Biennial (or on material change)
    PolicyCategory.governance: 12,  # Annual
}

# Default policy number prefixes per type
POLICY_NUMBER_PREFIX: dict[PolicyType, str] = {
    PolicyType.aml_ctf_program: "AML-PROG",
    PolicyType.risk_assessment_methodology: "AML-RSKM",
    PolicyType.cdd_policy: "AML-CDD",
    PolicyType.edd_policy: "AML-EDD",
    PolicyType.pep_policy: "AML-PEP",
    PolicyType.beneficial_ownership_policy: "AML-UBO",
    PolicyType.transaction_monitoring_policy: "AML-TM",
    PolicyType.sanctions_screening_policy: "AML-SANC",
    PolicyType.travel_rule_policy: "AML-TRVL",
    PolicyType.reporting_policy: "AML-RPT",
    PolicyType.record_keeping_policy: "AML-RK",
    PolicyType.training_policy: "AML-TRN",
    PolicyType.outsourcing_policy: "AML-OUT",
    PolicyType.whistleblower_policy: "GOV-WB",
    PolicyType.conflict_of_interest_policy: "GOV-COI",
    PolicyType.data_privacy_policy: "GOV-PRIV",
    PolicyType.procedure: "PROC",
    PolicyType.other: "GOV",
}
