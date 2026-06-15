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
from uuid import uuid4

from sqlalchemy import (
    JSON, Boolean, Column, DateTime, Enum, Float,
    ForeignKey, Integer, String, Text, func,
)
from sqlalchemy.orm import relationship

from app.db.database import Base


# ── Rule Engine Enums ──────────────────────────────────────────────────────────

class RuleStatus(str, enum.Enum):
    active      = "active"
    inactive    = "inactive"       # disabled by admin
    testing     = "testing"        # shadow mode — generates alerts but doesn't affect score
    archived    = "archived"


class RuleConditionOperator(str, enum.Enum):
    equals              = "eq"
    not_equals          = "ne"
    greater_than        = "gt"
    greater_or_equal    = "gte"
    less_than           = "lt"
    less_or_equal       = "lte"
    in_list             = "in"
    not_in_list         = "not_in"
    contains            = "contains"
    starts_with         = "starts_with"
    is_true             = "is_true"
    is_false            = "is_false"
    is_null             = "is_null"
    between             = "between"       # value = [min, max]


class AlertCategory(str, enum.Enum):
    structuring             = "structuring"
    smurfing                = "smurfing"
    rapid_movement          = "rapid_movement"
    high_value              = "high_value"
    near_threshold          = "near_threshold"
    velocity_breach         = "velocity_breach"
    frequency_anomaly       = "frequency_anomaly"
    dormant_reactivation    = "dormant_reactivation"
    round_number            = "round_number"
    sanctions_exposure      = "sanctions_exposure"
    pep_exposure            = "pep_exposure"
    adverse_media           = "adverse_media"
    high_risk_country       = "high_risk_country"
    sanctioned_jurisdiction = "sanctioned_jurisdiction"
    wallet_risk             = "wallet_risk"
    crypto_mixer            = "crypto_mixer"
    darknet_exposure        = "darknet_exposure"
    unusual_behaviour       = "unusual_behaviour"
    profile_deviation       = "profile_deviation"
    occupation_mismatch     = "occupation_mismatch"
    source_of_funds_concern = "source_of_funds_concern"
    cross_border_risk       = "cross_border_risk"
    cash_intensive          = "cash_intensive"
    third_party_risk        = "third_party_risk"
    threshold_breach        = "threshold_breach"
    custom                  = "custom"


class AlertType(str, enum.Enum):
    rule_triggered      = "rule_triggered"
    behaviour_anomaly   = "behaviour_anomaly"
    manual              = "manual"          # analyst-created alert
    system              = "system"          # system-generated (sanctions update, etc.)


class AlertStatus(str, enum.Enum):
    generated       = "generated"
    assigned        = "assigned"
    under_review    = "under_review"
    escalated       = "escalated"
    dismissed       = "dismissed"
    resolved        = "resolved"
    smr_candidate   = "smr_candidate"   # flagged for SMR consideration


class AlertSeverity(str, enum.Enum):
    low         = "low"
    medium      = "medium"
    high        = "high"
    critical    = "critical"


# ── Monitoring Rule ────────────────────────────────────────────────────────────

class MonitoringRule(Base):
    """
    No-code configurable monitoring rule.
    Administrators add/modify rules without developer involvement.
    Each rule evaluates condition groups (OR logic across groups, AND within group).
    """
    __tablename__ = "monitoring_rules"

    id = Column(String, primary_key=True, default=lambda: f"rule_{uuid4().hex[:10]}")
    org_id = Column(String, ForeignKey("organisations.id", ondelete="CASCADE"),
                    nullable=False, index=True)

    name            = Column(String(255), nullable=False)
    description     = Column(Text)
    rule_ref        = Column(String(30))                # e.g. RULE-TM-001
    category        = Column(Enum(AlertCategory), nullable=False, index=True)
    alert_type      = Column(Enum(AlertType), default=AlertType.rule_triggered)

    status          = Column(Enum(RuleStatus), default=RuleStatus.active, nullable=False, index=True)
    is_system_rule  = Column(Boolean, default=False)    # seeded by Verigo — cannot delete, only disable

    # Alert output configuration
    alert_severity      = Column(Enum(AlertSeverity), nullable=False, default=AlertSeverity.medium)
    alert_score         = Column(Float, default=50.0)   # base score added when rule fires
    alert_title_template = Column(String(500))          # template with {amount}, {country} etc.

    # Lookback window for frequency/velocity rules
    lookback_days   = Column(Integer)       # e.g. check last 7 days
    lookback_count  = Column(Integer)       # e.g. more than 5 transactions

    # Tags and grouping
    tags            = Column(JSON, default=list)
    applicable_customer_types   = Column(JSON, default=list)    # [] = all
    applicable_payment_methods  = Column(JSON, default=list)    # [] = all
    applicable_industries       = Column(JSON, default=list)    # [] = all industry types

    # Statistics
    total_alerts_generated  = Column(Integer, default=0)
    last_triggered_at       = Column(DateTime(timezone=True))
    false_positive_rate     = Column(Float)     # updated periodically from resolved alerts

    created_by  = Column(String)
    created_at  = Column(DateTime(timezone=True), server_default=func.now())
    updated_at  = Column(DateTime(timezone=True), onupdate=func.now())

    condition_groups    = relationship("RuleConditionGroup", back_populates="rule",
                                       cascade="all, delete-orphan",
                                       order_by="RuleConditionGroup.group_order")
    executions          = relationship("RuleExecution", back_populates="rule")


class RuleConditionGroup(Base):
    """
    A group of conditions that must ALL be true (AND logic within group).
    Groups within a rule are evaluated with OR logic.
    """
    __tablename__ = "rule_condition_groups"

    id = Column(String, primary_key=True, default=lambda: f"rcg_{uuid4().hex[:10]}")
    rule_id = Column(String, ForeignKey("monitoring_rules.id", ondelete="CASCADE"),
                     nullable=False, index=True)
    group_order     = Column(Integer, default=0)
    description     = Column(String(255))       # human label for this group

    rule        = relationship("MonitoringRule", back_populates="condition_groups")
    conditions  = relationship("RuleCondition", back_populates="group",
                               cascade="all, delete-orphan",
                               order_by="RuleCondition.condition_order")


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

    id = Column(String, primary_key=True, default=lambda: f"rc_{uuid4().hex[:10]}")
    group_id = Column(String, ForeignKey("rule_condition_groups.id", ondelete="CASCADE"),
                      nullable=False, index=True)
    condition_order = Column(Integer, default=0)

    field_path      = Column(String(255), nullable=False)
    # Dot notation: "amount_aud", "customer.risk_level", "crypto_detail.mixer_exposure_pct"
    operator        = Column(Enum(RuleConditionOperator), nullable=False)
    value           = Column(JSON)          # scalar or list depending on operator
    value_label     = Column(String(255))   # human-readable label for UI display

    group = relationship("RuleConditionGroup", back_populates="conditions")


class RuleExecution(Base):
    """
    Immutable log of every rule evaluation against a transaction.
    Created whether the rule matched or not (for audit and false-positive analysis).
    """
    __tablename__ = "rule_executions"

    id = Column(String, primary_key=True, default=lambda: f"rex_{uuid4().hex[:10]}")
    rule_id         = Column(String, ForeignKey("monitoring_rules.id"), nullable=False, index=True)
    transaction_id  = Column(String, ForeignKey("transactions.id"), nullable=False, index=True)
    org_id          = Column(String, nullable=False)

    matched         = Column(Boolean, nullable=False)
    groups_evaluated= Column(Integer)
    matched_group   = Column(Integer)           # which group index matched (0-based)
    execution_time_ms = Column(Float)
    evaluated_at    = Column(DateTime(timezone=True), server_default=func.now())

    rule = relationship("MonitoringRule", back_populates="executions")


# ── Transaction Alert ──────────────────────────────────────────────────────────

class TransactionAlert(Base):
    """
    One alert per rule match per transaction.
    Multiple alerts can arise from one transaction (different rules).
    Alerts are linked to Cases via CaseAlert (many-to-many).
    """
    __tablename__ = "transaction_alerts"

    id = Column(String, primary_key=True, default=lambda: f"alrt_{uuid4().hex[:10]}")
    alert_ref   = Column(String(30), unique=True, nullable=False, index=True)
    org_id      = Column(String, ForeignKey("organisations.id", ondelete="CASCADE"),
                         nullable=False, index=True)
    transaction_id  = Column(String, ForeignKey("transactions.id", ondelete="CASCADE"),
                             nullable=False, index=True)
    customer_id     = Column(String, ForeignKey("customers.id"), nullable=False, index=True)

    # ── Classification ────────────────────────────────────────────────────────
    alert_type      = Column(Enum(AlertType), nullable=False)
    category        = Column(Enum(AlertCategory), nullable=False, index=True)
    severity        = Column(Enum(AlertSeverity), nullable=False, index=True)
    status          = Column(Enum(AlertStatus), default=AlertStatus.generated,
                             nullable=False, index=True)

    # ── Source ────────────────────────────────────────────────────────────────
    rule_id         = Column(String, ForeignKey("monitoring_rules.id"), nullable=True)
    rule_name       = Column(String(255))       # snapshot in case rule is later renamed
    rules_matched   = Column(JSON, default=list) # [rule_id, ...] all rules that matched

    # ── Score ──────────────────────────────────────────────────────────────────
    alert_score     = Column(Float, default=0.0)    # combined weighted score
    score_breakdown = Column(JSON, default=dict)    # {signal: contribution}

    # ── Description ───────────────────────────────────────────────────────────
    title           = Column(String(500), nullable=False)
    description     = Column(Text)
    behaviour_signals = Column(JSON, default=dict)  # snapshot of signals that contributed

    # ── Workflow ──────────────────────────────────────────────────────────────
    assigned_to     = Column(String)            # user_id
    assigned_at     = Column(DateTime(timezone=True))
    assigned_by     = Column(String)

    reviewed_by     = Column(String)
    reviewed_at     = Column(DateTime(timezone=True))
    review_notes    = Column(Text)

    escalated_to    = Column(String)
    escalated_at    = Column(DateTime(timezone=True))
    escalation_reason = Column(Text)

    resolved_by     = Column(String)
    resolved_at     = Column(DateTime(timezone=True))
    resolution      = Column(String(100))       # dismissed | escalated_to_case | smr_filed | cleared
    resolution_notes = Column(Text)

    is_false_positive   = Column(Boolean, default=False)
    is_smr_candidate    = Column(Boolean, default=False, index=True)

    trigger_date    = Column(DateTime(timezone=True), server_default=func.now())
    created_at      = Column(DateTime(timezone=True), server_default=func.now())
    updated_at      = Column(DateTime(timezone=True), onupdate=func.now())

    transaction = relationship("Transaction", back_populates="alerts")
    rule        = relationship("MonitoringRule")
    customer    = relationship("Customer")
    evidence    = relationship("AlertEvidence", back_populates="alert", cascade="all, delete-orphan")
    case_links  = relationship("CaseAlert", back_populates="alert")


class AlertEvidence(Base):
    """Evidence attached to a transaction alert."""
    __tablename__ = "alert_evidence"

    id = Column(String, primary_key=True, default=lambda: f"aev_{uuid4().hex[:10]}")
    alert_id    = Column(String, ForeignKey("transaction_alerts.id", ondelete="CASCADE"),
                         nullable=False, index=True)
    org_id      = Column(String, nullable=False)

    document_type   = Column(String(100))   # bank_statement | wallet_report | identity | other
    document_ref    = Column(String(500))   # cloud storage key
    file_name       = Column(String(500))
    description     = Column(String(500))
    uploaded_by     = Column(String)
    created_at      = Column(DateTime(timezone=True), server_default=func.now())

    alert = relationship("TransactionAlert", back_populates="evidence")
