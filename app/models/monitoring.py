"""
Transaction Monitoring — Rule Engine, Alerts, and Behaviour Signals.

Rule Engine Design:
  MonitoringRule     — a named, configurable rule with metadata
  RuleConditionGroup — AND group of conditions (groups are OR'd together)
  RuleCondition      — single field/operator/value condition
  RuleExecution      — immutable log of each rule evaluation per transaction

This allows no-code rules like:
  Rule: "High Value Cross-Border"
    Group 1 (AND):
      amount_aud > 10000
      is_cross_border = true
    Group 2 (AND):
      destination_country IN [IR, KP, SY]

Alert Design:
  TransactionAlert — one alert per rule match per transaction
  AlertEvidence    — evidence attached to alerts
  Multiple alerts can be linked to one Case via CaseAlert (in case.py)

DISCLAIMER: The rule engine flags transactions for human review only.
No rule match constitutes a determination of suspicious activity or criminal conduct.
"""

import enum
from datetime import datetime
from typing import Any, Optional
from uuid import uuid4

from sqlalchemy import (
    JSON,
    Boolean,
    Column,
    DateTime,
    Enum,
    Float,
    ForeignKey,
    Integer,
    String,
    Text,
    func,
)
from sqlalchemy.orm import Mapped, relationship

from app.db.database import Base

# ── Rule Engine Enums ──────────────────────────────────────────────────────────


class RuleStatus(str, enum.Enum):
    active = "active"
    inactive = "inactive"  # disabled by admin
    testing = "testing"  # shadow mode — generates alerts but doesn't affect score
    archived = "archived"


class RuleConditionOperator(str, enum.Enum):
    equals = "eq"
    not_equals = "ne"
    greater_than = "gt"
    greater_or_equal = "gte"
    less_than = "lt"
    less_or_equal = "lte"
    in_list = "in"
    not_in_list = "not_in"
    contains = "contains"
    starts_with = "starts_with"
    is_true = "is_true"
    is_false = "is_false"
    is_null = "is_null"
    between = "between"  # value = [min, max]


class AlertCategory(str, enum.Enum):
    structuring = "structuring"
    smurfing = "smurfing"
    rapid_movement = "rapid_movement"
    high_value = "high_value"
    near_threshold = "near_threshold"
    velocity_breach = "velocity_breach"
    frequency_anomaly = "frequency_anomaly"
    dormant_reactivation = "dormant_reactivation"
    round_number = "round_number"
    sanctions_exposure = "sanctions_exposure"
    pep_exposure = "pep_exposure"
    adverse_media = "adverse_media"
    high_risk_country = "high_risk_country"
    sanctioned_jurisdiction = "sanctioned_jurisdiction"
    wallet_risk = "wallet_risk"
    crypto_mixer = "crypto_mixer"
    darknet_exposure = "darknet_exposure"
    unusual_behaviour = "unusual_behaviour"
    profile_deviation = "profile_deviation"
    occupation_mismatch = "occupation_mismatch"
    source_of_funds_concern = "source_of_funds_concern"
    cross_border_risk = "cross_border_risk"
    cash_intensive = "cash_intensive"
    third_party_risk = "third_party_risk"
    threshold_breach = "threshold_breach"
    custom = "custom"


class AlertType(str, enum.Enum):
    rule_triggered = "rule_triggered"
    behaviour_anomaly = "behaviour_anomaly"
    manual = "manual"  # analyst-created alert
    system = "system"  # system-generated (sanctions update, etc.)


class AlertStatus(str, enum.Enum):
    generated = "generated"
    assigned = "assigned"
    under_review = "under_review"
    escalated = "escalated"
    dismissed = "dismissed"
    resolved = "resolved"
    smr_candidate = "smr_candidate"  # flagged for SMR consideration


class AlertSeverity(str, enum.Enum):
    low = "low"
    medium = "medium"
    high = "high"
    critical = "critical"


class AlertResult(str, enum.Enum):
    """
    What happened AFTER the monitoring review decision was made.

    Distinct from AlertStatus (which tracks the review workflow state).
    Set by compliance / MLRO only after the alert is reviewed.

    DISCLAIMER: Setting a result is a compliance workflow action only.
    No result value constitutes a regulatory determination.
    All obligations (SMR lodgement, AUSTRAC reporting) remain with the reporting entity.
    """

    pending = "pending"  # default — not yet determined
    # ── Approved outcomes ──────────────────────────────────────────────────────
    no_action_required = "no_action_required"  # reviewed, no concern identified
    transaction_released = "transaction_released"  # transaction approved to proceed
    # ── Rejected / Actioned outcomes ──────────────────────────────────────────
    transaction_blocked = "transaction_blocked"  # transaction stopped / funds held
    transaction_returned = "transaction_returned"  # funds returned to sender
    # ── Escalation outcomes ────────────────────────────────────────────────────
    edd_initiated = "edd_initiated"  # Enhanced Due Diligence triggered
    case_opened = "case_opened"  # formal case investigation opened
    smr_filed = "smr_filed"  # Suspicious Matter Report lodged with AUSTRAC
    ttr_lodged = "ttr_lodged"  # Threshold Transaction Report lodged
    ifti_reported = "ifti_reported"  # IFTI reported to AUSTRAC
    referred_law_enforcement = (
        "referred_law_enforcement"  # referred to AFP / state police
    )
    # ── Customer outcomes ──────────────────────────────────────────────────────
    customer_exited = "customer_exited"  # customer relationship terminated
    customer_restricted = "customer_restricted"  # services restricted (not exited)
    # ── Other ──────────────────────────────────────────────────────────────────
    other = "other"  # see result_notes for detail


# ── Monitoring Rule ────────────────────────────────────────────────────────────


class MonitoringRule(Base):
    """
    No-code configurable monitoring rule.
    Administrators add/modify rules without developer involvement.
    Each rule evaluates condition groups (OR logic across groups, AND within group).
    """

    __tablename__ = "monitoring_rules"

    id: Mapped[str] = Column(
        String, primary_key=True, default=lambda: f"rule_{uuid4().hex[:10]}"
    )
    org_id: Mapped[str] = Column(
        String,
        ForeignKey("organisations.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )

    name: Mapped[str] = Column(String(255), nullable=False)
    description: Mapped[Optional[str]] = Column(Text)
    rule_ref: Mapped[Optional[str]] = Column(String(30))  # e.g. RULE-TM-001
    category: Mapped[AlertCategory] = Column(
        Enum(AlertCategory), nullable=False, index=True
    )
    alert_type: Mapped[Optional[AlertType]] = Column(
        Enum(AlertType), default=AlertType.rule_triggered
    )

    status: Mapped[RuleStatus] = Column(
        Enum(RuleStatus), default=RuleStatus.active, nullable=False, index=True
    )
    is_system_rule: Mapped[Optional[bool]] = Column(
        Boolean, default=False
    )  # seeded by Verigo — cannot delete, only disable

    # Alert output configuration
    alert_severity: Mapped[AlertSeverity] = Column(
        Enum(AlertSeverity), nullable=False, default=AlertSeverity.medium
    )
    alert_score: Mapped[Optional[float]] = Column(
        Float, default=50.0
    )  # base score added when rule fires
    alert_title_template: Mapped[Optional[str]] = Column(
        String(500)
    )  # template with {amount}, {country} etc.

    # Lookback window for frequency/velocity rules
    lookback_days: Mapped[Optional[int]] = Column(Integer)  # e.g. check last 7 days
    lookback_count: Mapped[Optional[int]] = Column(
        Integer
    )  # e.g. more than 5 transactions

    # Tags and grouping
    tags: Mapped[Optional[Any]] = Column(JSON, default=list)
    applicable_customer_types: Mapped[Optional[Any]] = Column(
        JSON, default=list
    )  # [] = all
    applicable_payment_methods: Mapped[Optional[Any]] = Column(
        JSON, default=list
    )  # [] = all
    applicable_industries: Mapped[Optional[Any]] = Column(
        JSON, default=list
    )  # [] = all industry types

    # Statistics
    total_alerts_generated: Mapped[Optional[int]] = Column(Integer, default=0)
    last_triggered_at: Mapped[Optional[datetime]] = Column(DateTime(timezone=True))
    false_positive_rate: Mapped[Optional[float]] = Column(
        Float
    )  # updated periodically from resolved alerts

    created_by: Mapped[Optional[str]] = Column(String)
    created_at: Mapped[Optional[datetime]] = Column(
        DateTime(timezone=True), server_default=func.now()
    )
    updated_at: Mapped[Optional[datetime]] = Column(
        DateTime(timezone=True), onupdate=func.now()
    )

    condition_groups: Mapped[list["RuleConditionGroup"]] = relationship(
        "RuleConditionGroup",
        back_populates="rule",
        cascade="all, delete-orphan",
        order_by="RuleConditionGroup.group_order",
    )
    executions = relationship("RuleExecution", back_populates="rule")


class RuleConditionGroup(Base):
    """
    A group of conditions that must ALL be true (AND logic within group).
    Groups within a rule are evaluated with OR logic.
    """

    __tablename__ = "rule_condition_groups"

    id: Mapped[str] = Column(
        String, primary_key=True, default=lambda: f"rcg_{uuid4().hex[:10]}"
    )
    rule_id: Mapped[str] = Column(
        String,
        ForeignKey("monitoring_rules.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    group_order: Mapped[Optional[int]] = Column(Integer, default=0)
    description: Mapped[Optional[str]] = Column(
        String(255)
    )  # human label for this group

    rule = relationship("MonitoringRule", back_populates="condition_groups")
    conditions: Mapped[list["RuleCondition"]] = relationship(
        "RuleCondition",
        back_populates="group",
        cascade="all, delete-orphan",
        order_by="RuleCondition.condition_order",
    )


class RuleCondition(Base):
    """
    A single field/operator/value condition within a condition group.

    Examples:
      field=amount_aud, operator=gt, value=10000
      field=destination_country, operator=in, value=["IR","KP","SY"]
      field=customer.risk_level, operator=eq, value="high"
      field=is_cross_border, operator=is_true, value=null
    """

    __tablename__ = "rule_conditions"

    id: Mapped[str] = Column(
        String, primary_key=True, default=lambda: f"rc_{uuid4().hex[:10]}"
    )
    group_id: Mapped[str] = Column(
        String,
        ForeignKey("rule_condition_groups.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    condition_order: Mapped[Optional[int]] = Column(Integer, default=0)

    field_path: Mapped[str] = Column(String(255), nullable=False)
    # Dot notation: "amount_aud", "customer.risk_level", "crypto_detail.mixer_exposure_pct"
    operator: Mapped[RuleConditionOperator] = Column(
        Enum(RuleConditionOperator), nullable=False
    )
    value: Mapped[Optional[Any]] = Column(JSON)  # scalar or list depending on operator
    value_label: Mapped[Optional[str]] = Column(
        String(255)
    )  # human-readable label for UI display

    group = relationship("RuleConditionGroup", back_populates="conditions")


class RuleExecution(Base):
    """
    Immutable log of every rule evaluation against a transaction.
    Created whether the rule matched or not (for audit and false-positive analysis).
    """

    __tablename__ = "rule_executions"

    id: Mapped[str] = Column(
        String, primary_key=True, default=lambda: f"rex_{uuid4().hex[:10]}"
    )
    rule_id: Mapped[str] = Column(
        String, ForeignKey("monitoring_rules.id"), nullable=False, index=True
    )
    transaction_id: Mapped[str] = Column(
        String, ForeignKey("transactions.id"), nullable=False, index=True
    )
    org_id: Mapped[str] = Column(String, nullable=False)

    matched: Mapped[bool] = Column(Boolean, nullable=False)
    groups_evaluated: Mapped[Optional[int]] = Column(Integer)
    matched_group: Mapped[Optional[int]] = Column(
        Integer
    )  # which group index matched (0-based)
    execution_time_ms: Mapped[Optional[float]] = Column(Float)
    evaluated_at: Mapped[Optional[datetime]] = Column(
        DateTime(timezone=True), server_default=func.now()
    )

    rule = relationship("MonitoringRule", back_populates="executions")


# ── Transaction Alert ──────────────────────────────────────────────────────────


class TransactionAlert(Base):
    """
    One alert per rule match per transaction.
    Multiple alerts can arise from one transaction (different rules).
    Alerts are linked to Cases via CaseAlert (many-to-many).
    """

    __tablename__ = "transaction_alerts"

    id: Mapped[str] = Column(
        String, primary_key=True, default=lambda: f"alrt_{uuid4().hex[:10]}"
    )
    alert_ref: Mapped[str] = Column(String(30), unique=True, nullable=False, index=True)
    org_id: Mapped[str] = Column(
        String,
        ForeignKey("organisations.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    transaction_id: Mapped[str] = Column(
        String,
        ForeignKey("transactions.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    customer_id: Mapped[str] = Column(
        String, ForeignKey("customers.id"), nullable=False, index=True
    )

    # ── Classification ────────────────────────────────────────────────────────
    alert_type: Mapped[AlertType] = Column(Enum(AlertType), nullable=False)
    category: Mapped[AlertCategory] = Column(
        Enum(AlertCategory), nullable=False, index=True
    )
    severity: Mapped[AlertSeverity] = Column(
        Enum(AlertSeverity), nullable=False, index=True
    )
    status: Mapped[AlertStatus] = Column(
        Enum(AlertStatus, name="transaction_alert_status"),
        default=AlertStatus.generated,
        nullable=False,
        index=True,
    )

    # ── Source ────────────────────────────────────────────────────────────────
    rule_id: Mapped[Optional[str]] = Column(
        String, ForeignKey("monitoring_rules.id"), nullable=True
    )
    rule_name: Mapped[Optional[str]] = Column(
        String(255)
    )  # snapshot in case rule is later renamed
    rules_matched: Mapped[Optional[Any]] = Column(
        JSON, default=list
    )  # [rule_id, ...] all rules that matched

    # ── Score ──────────────────────────────────────────────────────────────────
    alert_score: Mapped[Optional[float]] = Column(
        Float, default=0.0
    )  # combined weighted score
    score_breakdown: Mapped[Optional[Any]] = Column(
        JSON, default=dict
    )  # {signal: contribution}

    # ── Description ───────────────────────────────────────────────────────────
    title: Mapped[str] = Column(String(500), nullable=False)
    description: Mapped[Optional[str]] = Column(Text)
    behaviour_signals: Mapped[Optional[Any]] = Column(
        JSON, default=dict
    )  # snapshot of signals that contributed

    # ── Workflow ──────────────────────────────────────────────────────────────
    assigned_to: Mapped[Optional[str]] = Column(String)  # user_id
    assigned_at: Mapped[Optional[datetime]] = Column(DateTime(timezone=True))
    assigned_by: Mapped[Optional[str]] = Column(String)

    reviewed_by: Mapped[Optional[str]] = Column(String)
    reviewed_at: Mapped[Optional[datetime]] = Column(DateTime(timezone=True))
    review_notes: Mapped[Optional[str]] = Column(Text)

    escalated_to: Mapped[Optional[str]] = Column(String)
    escalated_at: Mapped[Optional[datetime]] = Column(DateTime(timezone=True))
    escalation_reason: Mapped[Optional[str]] = Column(Text)

    resolved_by: Mapped[Optional[str]] = Column(String)
    resolved_at: Mapped[Optional[datetime]] = Column(DateTime(timezone=True))
    resolution: Mapped[Optional[str]] = Column(
        String(100)
    )  # dismissed | escalated_to_case | smr_filed | cleared

    # ── Post-Decision Result ───────────────────────────────────────────────────
    # Distinct from status (workflow state). Set AFTER the monitoring decision.
    # status  = where the review is in the workflow
    # result  = what action was taken as a consequence of the decision
    result: Mapped[AlertResult] = Column(
        Enum(AlertResult), default=AlertResult.pending, nullable=False, index=True
    )
    result_notes: Mapped[Optional[str]] = Column(Text)  # mandatory when result = other
    result_set_by: Mapped[Optional[str]] = Column(String)  # user_id
    result_set_at: Mapped[Optional[datetime]] = Column(DateTime(timezone=True))

    resolution_notes: Mapped[Optional[str]] = Column(Text)

    is_false_positive: Mapped[Optional[bool]] = Column(Boolean, default=False)
    is_smr_candidate: Mapped[Optional[bool]] = Column(
        Boolean, default=False, index=True
    )

    # Decision support — populated by recommendation engine after alert generation
    suggested_next_action: Mapped[Optional[str]] = Column(
        String(100)
    )  # consider_ifti | consider_ttr | consider_smr | create_case | no_action_required
    recommendation_text: Mapped[Optional[str]] = Column(
        Text
    )  # plain-English guidance surfaced in the UI

    # ── AUSTRAC/FATF Risk Matrix ───────────────────────────────────────────────
    # Computed by risk_matrix_service.compute_risk_matrix() during run_monitoring().
    risk_matrix_score: Mapped[Optional[float]] = Column(
        Float
    )  # 0–100 weighted composite
    risk_matrix_level: Mapped[Optional[str]] = Column(
        String(20)
    )  # low | medium | high | critical
    risk_matrix_detail: Mapped[Optional[Any]] = Column(
        JSON
    )  # full per-dimension breakdown

    # ── Pre-Approval Custom Questions ─────────────────────────────────────────
    # Populated after compliance officer answers org approval questions.
    question_score: Mapped[Optional[float]] = Column(
        Float
    )  # 0–100 (% compliant answers)
    final_approval_score: Mapped[Optional[float]] = Column(
        Float
    )  # alert_score * base_wt + question_risk * q_wt
    approval_score_detail: Mapped[Optional[Any]] = Column(
        JSON
    )  # breakdown dict from compute_final_approval_score

    # ── AI Narrative (Placeholder — future implementation) ────────────────────
    # Reserved for Stage 6: AI-assisted narrative drafting.
    # NOT populated by any current code path. Will be populated by an LLM
    # service in a future release after human-in-the-loop review gates are built.
    ai_narrative_draft: Mapped[Optional[str]] = Column(
        Text
    )  # placeholder — not yet populated
    ai_narrative_reviewed: Mapped[Optional[bool]] = Column(
        Boolean, default=False
    )  # placeholder
    ai_narrative_reviewed_by: Mapped[Optional[str]] = Column(String)  # placeholder

    trigger_date: Mapped[Optional[datetime]] = Column(
        DateTime(timezone=True), server_default=func.now()
    )
    created_at: Mapped[Optional[datetime]] = Column(
        DateTime(timezone=True), server_default=func.now()
    )
    updated_at: Mapped[Optional[datetime]] = Column(
        DateTime(timezone=True), onupdate=func.now()
    )

    transaction = relationship("Transaction", back_populates="alerts")
    rule = relationship("MonitoringRule")
    customer = relationship("Customer")
    evidence = relationship(
        "AlertEvidence", back_populates="alert", cascade="all, delete-orphan"
    )
    case_links = relationship("CaseAlert", back_populates="alert")


class AlertEvidence(Base):
    """Evidence attached to a transaction alert."""

    __tablename__ = "alert_evidence"

    id: Mapped[str] = Column(
        String, primary_key=True, default=lambda: f"aev_{uuid4().hex[:10]}"
    )
    alert_id: Mapped[str] = Column(
        String,
        ForeignKey("transaction_alerts.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    org_id: Mapped[str] = Column(String, nullable=False)

    document_type: Mapped[Optional[str]] = Column(
        String(100)
    )  # bank_statement | wallet_report | identity | other
    document_ref: Mapped[Optional[str]] = Column(String(500))  # cloud storage key
    file_name: Mapped[Optional[str]] = Column(String(500))
    description: Mapped[Optional[str]] = Column(String(500))
    uploaded_by: Mapped[Optional[str]] = Column(String)
    created_at: Mapped[Optional[datetime]] = Column(
        DateTime(timezone=True), server_default=func.now()
    )

    alert = relationship("TransactionAlert", back_populates="evidence")
