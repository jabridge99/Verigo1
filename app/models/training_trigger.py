"""
Risk-Triggered Training & Regulatory Event Trigger System

Architecture:
  TrainingTriggerRule       — org-configurable rules: "when X happens, assign course Y to role Z"
  TrainingTriggerLog        — immutable audit trail of every trigger that fired
  RegulatoryUpdateEvent     — AUSTRAC/FATF guidance events that broadcast training assignments
  AssessmentOutcomeFlag     — links training failures to operational risk decisions

Trigger evaluation flow:
  Risk event fires (EDD escalation, SMR filed, PEP detected, etc.)
    → evaluate_risk_event() called
    → loads active TrainingTriggerRule rows for org + event_type
    → evaluates JSON conditions against event payload
    → for each matched rule: creates TrainingAssignment + GovernanceTrainingRecord(s)
    → writes TrainingTriggerLog

Regulatory update flow:
  Platform admin publishes RegulatoryUpdateEvent
    → system finds all orgs in affected_industries
    → for each org: checks affected_roles → creates training assignments
    → writes trigger log per org

Assessment outcome flow:
  Staff member fails course assessment (score < pass_mark)
    → AssessmentOutcomeFlag created
    → If analyst: their open/recent risk decisions flagged for compliance review
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


class TriggerEventType(str, enum.Enum):
    """Risk events that can fire training assignments."""

    # Customer risk events
    edd_escalation = "edd_escalation"  # customer escalated to EDD
    pep_detected = "pep_detected"  # PEP flag set on customer
    sanctions_match = "sanctions_match"  # sanctions screening hit
    high_risk_customer = "high_risk_customer"  # customer classified HIGH or CRITICAL
    adverse_media_hit = "adverse_media_hit"  # adverse media screening result

    # Transaction / monitoring events
    smr_filed = "smr_filed"  # SMR submitted to AUSTRAC
    ifti_filed = "ifti_filed"  # IFTI submitted to AUSTRAC
    ttr_filed = "ttr_filed"  # TTR submitted to AUSTRAC
    critical_alert = "critical_alert"  # CRITICAL severity monitoring alert
    transaction_structuring = "transaction_structuring"  # structuring pattern detected
    crypto_mixer_exposure = "crypto_mixer_exposure"  # crypto mixer/darknet exposure

    # Case events
    case_opened_sar = "case_opened_sar"  # SAR-type case opened
    case_escalated_mlro = "case_escalated_mlro"  # case escalated to MLRO

    # Assessment / competency events
    assessment_fail = "assessment_fail"  # staff failed a training assessment
    training_overdue = "training_overdue"  # mandatory training overdue > 30 days

    # Regulatory events
    regulatory_update = "regulatory_update"  # AUSTRAC/FATF guidance published
    policy_update = "policy_update"  # internal AML policy updated
    independent_review_finding = "independent_review_finding"  # high-risk IR finding


class TriggerTargetType(str, enum.Enum):
    """Who gets the training assignment when a rule fires."""

    handled_analyst = "handled_analyst"  # the specific user who processed the entity
    all_role = "all_role"  # everyone with the specified role(s)
    all_staff = "all_staff"  # all active users in the org
    specific_users = "specific_users"  # explicit user_id list on the rule
    mlro_only = "mlro_only"  # MLRO + admin only
    compliance_team = "compliance_team"  # mlro + compliance roles


class TriggerStatus(str, enum.Enum):
    active = "active"
    inactive = "inactive"
    archived = "archived"


class RegulatoryUpdateStatus(str, enum.Enum):
    draft = "draft"
    published = "published"
    archived = "archived"


class IssuingBody(str, enum.Enum):
    austrac = "austrac"
    fatf = "fatf"
    apra = "apra"
    asic = "asic"
    acams = "acams"
    ica = "ica"
    internal = "internal"  # org's own internal guidance


class AssessmentFlagStatus(str, enum.Enum):
    open = "open"
    reviewed = "reviewed"
    cleared = "cleared"


# ══════════════════════════════════════════════════════════════════════════════
# TRAINING TRIGGER RULE
# ══════════════════════════════════════════════════════════════════════════════


class TrainingTriggerRule(Base):
    """
    Org-configurable rule: "when [event] occurs matching [conditions],
    assign [course] to [target] with [due_days] days to complete."

    is_system = True → platform default rules seeded for all orgs.
    Org can override by creating their own rule for the same event
    and setting override_system = True.

    condition_filter (JSON): optional conditions that must match for the rule to fire.
    Structure:
      {
        "risk_level": ["high", "critical"],      # entity risk level must be in list
        "alert_severity": ["critical"],
        "industry": ["remittance", "vasp"],      # org industry must be in list
        "amount_aud_gte": 50000,                 # transaction amount threshold
        "is_pep": true,
        "is_crypto": true,
        "country_codes": ["KP", "IR"],           # FATF blacklist match
        "score_below": 60.0                      # training assessment score
      }
    All conditions are AND'd. Omit a key to skip that check.
    """

    __tablename__ = "training_trigger_rules"

    id = Column(String, primary_key=True, default=lambda: f"ttr_{uuid4().hex[:12]}")
    org_id = Column(
        String,
        ForeignKey("organisations.id", ondelete="CASCADE"),
        nullable=True,
        index=True,
    )
    # null org_id = system-level default rule (applies to all orgs unless overridden)

    # ── Rule identity ─────────────────────────────────────────────────────────
    name = Column(String(255), nullable=False)
    description = Column(Text)
    event_type = Column(Enum(TriggerEventType), nullable=False, index=True)
    status = Column(Enum(TriggerStatus), default=TriggerStatus.active, nullable=False)

    # ── Condition filter (JSON) ───────────────────────────────────────────────
    condition_filter = Column(JSON, default=dict)

    # ── What to assign ───────────────────────────────────────────────────────
    course_id = Column(
        String, ForeignKey("training_courses.id"), nullable=False, index=True
    )
    target_type = Column(Enum(TriggerTargetType), nullable=False)
    target_roles = Column(JSON, default=list)  # used when target_type = all_role
    specific_user_ids = Column(
        JSON, default=list
    )  # used when target_type = specific_users

    # ── Assignment parameters ─────────────────────────────────────────────────
    due_days = Column(Integer, default=14)  # days from trigger date to complete
    priority = Column(String(20), default="normal")  # "urgent" | "normal" | "low"
    notes_template = Column(Text)
    # Template can include {event_type}, {entity_id}, {customer_name} placeholders

    # ── Dedup control ─────────────────────────────────────────────────────────
    cooldown_days = Column(Integer, default=90)
    # Don't re-assign same course to same user within cooldown_days of last assignment

    # ── System / override ─────────────────────────────────────────────────────
    is_system = Column(Boolean, default=False)
    override_system = Column(Boolean, default=False)
    regulatory_basis = Column(String(500))
    # e.g. "AML/CTF Act s.36 — staff must be trained when SMR filed"

    created_by = Column(String, nullable=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())

    course = relationship("TrainingCourse", foreign_keys=[course_id])
    trigger_logs = relationship(
        "TrainingTriggerLog", back_populates="rule", cascade="all, delete-orphan"
    )


# ══════════════════════════════════════════════════════════════════════════════
# TRAINING TRIGGER LOG
# ══════════════════════════════════════════════════════════════════════════════


class TrainingTriggerLog(Base):
    """
    Immutable audit record: every time a trigger rule fired.
    Provides complete lineage from risk event → training assignment.

    Never delete or update rows — this is the evidence trail.
    """

    __tablename__ = "training_trigger_logs"

    id = Column(String, primary_key=True, default=lambda: f"ttl_{uuid4().hex[:12]}")
    rule_id = Column(
        String, ForeignKey("training_trigger_rules.id"), nullable=True, index=True
    )
    # null if fired by regulatory_update (not a rule-based trigger)
    org_id = Column(String, ForeignKey("organisations.id"), nullable=False, index=True)

    # ── Trigger context ───────────────────────────────────────────────────────
    event_type = Column(Enum(TriggerEventType), nullable=False, index=True)
    entity_type = Column(
        String(50)
    )  # "customer" | "transaction" | "alert" | "case" | "smr"
    entity_id = Column(String, index=True)
    entity_snapshot = Column(JSON, default=dict)
    # Snapshot of key fields at the time of trigger (for audit — entity may change)

    regulatory_update_id = Column(
        String, ForeignKey("regulatory_update_events.id"), nullable=True
    )

    # ── Outcome ───────────────────────────────────────────────────────────────
    assignments_created = Column(
        Integer, default=0
    )  # number of training records spawned
    assignment_ids = Column(JSON, default=list)  # list of GovernanceTrainingRecord IDs
    users_assigned = Column(JSON, default=list)  # list of user_ids assigned
    skipped_users = Column(JSON, default=list)  # user_ids skipped (cooldown / exempt)
    skip_reason = Column(String(500))

    fired_at = Column(DateTime(timezone=True), server_default=func.now())
    fired_by = Column(String)  # "system" or user_id if manually triggered

    rule = relationship("TrainingTriggerRule", back_populates="trigger_logs")
    regulatory_update = relationship(
        "RegulatoryUpdateEvent", foreign_keys=[regulatory_update_id]
    )


# ══════════════════════════════════════════════════════════════════════════════
# REGULATORY UPDATE EVENT
# ══════════════════════════════════════════════════════════════════════════════


class RegulatoryUpdateEvent(Base):
    """
    AUSTRAC / FATF / APRA guidance events.

    When status transitions to 'published':
      → system broadcasts training assignments to all affected orgs
      → TrainingTriggerLog written per org
      → GovernanceTrainingRecord rows created per affected staff member

    This makes VeriGo the distribution channel for regulatory training:
    compliance teams no longer need to manually track AUSTRAC guidance and
    assign refresher training — it's automatic.

    Affected scope:
      affected_industries: [] means ALL industries
      affected_roles: [] means ALL roles
    """

    __tablename__ = "regulatory_update_events"

    id = Column(String, primary_key=True, default=lambda: f"rue_{uuid4().hex[:12]}")
    event_ref = Column(String(100), unique=True, nullable=False)
    # e.g. "AUSTRAC-2026-001", "FATF-VASP-2025-UPDATE"

    # ── Content ───────────────────────────────────────────────────────────────
    title = Column(String(500), nullable=False)
    issuing_body = Column(Enum(IssuingBody), nullable=False)
    summary = Column(Text, nullable=False)
    key_changes = Column(JSON, default=list)  # [str] bullet points
    full_text_url = Column(String(512))
    effective_date = Column(Date)
    compliance_deadline = Column(Date)  # date by which training must be completed

    # ── Scope ─────────────────────────────────────────────────────────────────
    affected_industries = Column(JSON, default=list)
    # [] = all industries; ["remittance", "vasp"] = specific only
    affected_roles = Column(JSON, default=list)
    # [] = all roles; ["mlro", "compliance"] = specific roles

    # ── Linked training ───────────────────────────────────────────────────────
    linked_course_id = Column(String, ForeignKey("training_courses.id"), nullable=True)
    # The specific course to assign when this update is published
    # If null: system assigns the org's annual refresher course

    auto_assign_training = Column(Boolean, default=True)
    # False = notification only, no auto-assignment

    # ── Lifecycle ─────────────────────────────────────────────────────────────
    status = Column(
        Enum(RegulatoryUpdateStatus),
        default=RegulatoryUpdateStatus.draft,
        nullable=False,
        index=True,
    )
    published_at = Column(DateTime(timezone=True))
    published_by = Column(String)
    orgs_notified = Column(Integer, default=0)  # count populated on publish
    assignments_created = Column(Integer, default=0)

    tags = Column(JSON, default=list)  # ["tranche_2", "crypto", "pep"]
    is_urgent = Column(Boolean, default=False)
    # Urgent → due_days = 7 instead of standard 30

    created_by = Column(String, nullable=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())

    linked_course = relationship("TrainingCourse", foreign_keys=[linked_course_id])
    trigger_logs = relationship(
        "TrainingTriggerLog",
        foreign_keys="TrainingTriggerLog.regulatory_update_id",
        back_populates="regulatory_update",
    )


# ══════════════════════════════════════════════════════════════════════════════
# ASSESSMENT OUTCOME FLAG
# ══════════════════════════════════════════════════════════════════════════════


class AssessmentOutcomeFlag(Base):
    """
    Links training assessment failures to operational risk decisions.

    When an analyst fails a training assessment (score < pass_mark):
      → Flag created for MLRO review
      → Recent risk decisions by that analyst are surfaced in the flag
      → MLRO can clear the flag (reviewed) or escalate (add oversight requirement)

    This is the feedback loop that makes training a risk control,
    not just a compliance checkbox.
    """

    __tablename__ = "assessment_outcome_flags"

    id = Column(String, primary_key=True, default=lambda: f"aof_{uuid4().hex[:12]}")
    org_id = Column(String, ForeignKey("organisations.id"), nullable=False, index=True)
    user_id = Column(String, ForeignKey("users.id"), nullable=False, index=True)
    training_record_id = Column(
        String, ForeignKey("governance_training_records.id"), nullable=False
    )
    course_id = Column(String, ForeignKey("training_courses.id"), nullable=False)

    # ── Assessment result ─────────────────────────────────────────────────────
    score = Column(Float, nullable=False)
    pass_mark = Column(Float, nullable=False)
    attempt_number = Column(Integer, nullable=False)
    course_name = Column(String(255))

    # ── Linked risk decisions (populated at flag creation) ────────────────────
    recent_decision_ids = Column(JSON, default=list)
    # IDs of transactions/alerts/cases handled by this user in the past 30 days
    # that relate to the failed training topic
    decision_summary = Column(JSON, default=dict)
    # {"transactions_reviewed": 12, "alerts_actioned": 3, "cases_handled": 1}

    # ── Risk implication ─────────────────────────────────────────────────────
    requires_oversight = Column(Boolean, default=False)
    # If True: user's risk decisions flagged for compliance co-sign until cleared
    oversight_note = Column(Text)

    # ── Resolution ────────────────────────────────────────────────────────────
    status = Column(
        Enum(AssessmentFlagStatus),
        default=AssessmentFlagStatus.open,
        nullable=False,
        index=True,
    )
    reviewed_by = Column(String, ForeignKey("users.id"), nullable=True)
    reviewed_at = Column(DateTime(timezone=True))
    review_notes = Column(Text)
    cleared_at = Column(DateTime(timezone=True))

    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())


# ══════════════════════════════════════════════════════════════════════════════
# SYSTEM DEFAULT TRIGGER RULES
# (seeded at org creation via seed_default_trigger_rules())
# ══════════════════════════════════════════════════════════════════════════════

SYSTEM_TRIGGER_RULES = [
    {
        "name": "EDD Escalation → EDD Training",
        "event_type": TriggerEventType.edd_escalation,
        "condition_filter": {},
        "target_type": TriggerTargetType.handled_analyst,
        "due_days": 14,
        "priority": "normal",
        "cooldown_days": 90,
        "regulatory_basis": "AML/CTF Act s.36 — staff handling EDD must have appropriate training",
        "course_training_type": "edd_training",
    },
    {
        "name": "SMR Filed → SMR Training",
        "event_type": TriggerEventType.smr_filed,
        "condition_filter": {},
        "target_type": TriggerTargetType.handled_analyst,
        "due_days": 7,
        "priority": "urgent",
        "cooldown_days": 60,
        "regulatory_basis": "AML/CTF Act s.41 — staff filing SMRs must understand SMR obligations",
        "course_training_type": "smr_training",
    },
    {
        "name": "PEP Detected → PEP Training",
        "event_type": TriggerEventType.pep_detected,
        "condition_filter": {},
        "target_type": TriggerTargetType.handled_analyst,
        "due_days": 14,
        "priority": "normal",
        "cooldown_days": 180,
        "regulatory_basis": "FATF Recommendation 12 — PEP handling requires specialised training",
        "course_training_type": "pep_training",
    },
    {
        "name": "Sanctions Match → Sanctions Training",
        "event_type": TriggerEventType.sanctions_match,
        "condition_filter": {},
        "target_type": TriggerTargetType.compliance_team,
        "due_days": 3,
        "priority": "urgent",
        "cooldown_days": 30,
        "regulatory_basis": "DFAT — sanctions obligations require immediate staff awareness",
        "course_training_type": "sanctions_training",
    },
    {
        "name": "Critical Alert → High-Risk Function Training",
        "event_type": TriggerEventType.critical_alert,
        "condition_filter": {"alert_severity": ["critical"]},
        "target_type": TriggerTargetType.handled_analyst,
        "due_days": 14,
        "priority": "normal",
        "cooldown_days": 90,
        "regulatory_basis": "FATF R.18 — staff in high-risk functions require enhanced training",
        "course_training_type": "high_risk_function_training",
    },
    {
        "name": "Crypto Mixer Exposure → High-Risk Function Training",
        "event_type": TriggerEventType.crypto_mixer_exposure,
        "condition_filter": {"is_crypto": True},
        "target_type": TriggerTargetType.all_role,
        "target_roles": ["analyst", "compliance"],
        "due_days": 7,
        "priority": "urgent",
        "cooldown_days": 60,
        "regulatory_basis": "FATF VA Guidance 2021 — VASP staff must understand crypto ML typologies",
        "course_training_type": "high_risk_function_training",
    },
    {
        "name": "Independent Review High-Risk Finding → Compliance Training",
        "event_type": TriggerEventType.independent_review_finding,
        "condition_filter": {"risk_level": ["high", "critical"]},
        "target_type": TriggerTargetType.all_role,
        "target_roles": ["mlro", "compliance"],
        "due_days": 21,
        "priority": "normal",
        "cooldown_days": 365,
        "regulatory_basis": "AML/CTF Act s.162 — independent review findings must be remediated",
        "course_training_type": "compliance_officer_training",
    },
]
