"""
Automation Rule Engine Models — Phase 4 (Rule Builder).

Extends the transaction monitoring rule engine to org-wide event-driven automation:
  - Event triggers (customer created, screening match, review due, etc.)
  - Condition groups (AND within group, OR across groups) — same pattern as MonitoringRule
  - Actions (create alert, create case, send notification, escalate, webhook)
  - Decision support panel (pre-approval risk summary)
  - Approval workflow (review → compliance → decision)

DISCLAIMER: The rule engine provides workflow automation guidance only.
The system never automatically approves compliance decisions.
All decisions remain with the reporting entity.
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
from sqlalchemy.orm import Mapped

from app.db.database import Base

# ── Enums ──────────────────────────────────────────────────────────────────────


class RuleEventType(str, enum.Enum):
    # Customer lifecycle
    customer_created = "customer_created"
    customer_updated = "customer_updated"
    customer_risk_changed = "customer_risk_changed"
    customer_review_due = "customer_review_due"
    # Transaction lifecycle
    transaction_created = "transaction_created"
    transaction_updated = "transaction_updated"
    # Monitoring
    alert_generated = "alert_generated"
    screening_match = "screening_match"
    # Documents & KYC
    document_uploaded = "document_uploaded"
    kyc_completed = "kyc_completed"
    kyc_expired = "kyc_expired"
    # Cases
    case_opened = "case_opened"
    case_updated = "case_updated"
    case_closed = "case_closed"
    # Governance
    policy_expiring = "policy_expiring"
    training_expiring = "training_expiring"
    control_test_due = "control_test_due"
    independent_review_finding = "independent_review_finding"
    # Calendar
    compliance_item_due = "compliance_item_due"
    compliance_item_overdue = "compliance_item_overdue"
    # Manual
    manual_trigger = "manual_trigger"


class RuleActionType(str, enum.Enum):
    # Monitoring & cases
    create_alert = "create_alert"
    create_case = "create_case"
    # Assignment & workflow
    assign_user = "assign_user"
    assign_queue = "assign_queue"
    escalate_compliance = "escalate_compliance"
    escalate_manager = "escalate_manager"
    escalate_mlro = "escalate_mlro"
    # Documents
    request_document = "request_document"
    create_task = "create_task"
    schedule_review = "schedule_review"
    # Notifications
    send_email = "send_email"
    send_sms = "send_sms"
    send_in_app_notification = "send_in_app_notification"
    post_to_slack = "post_to_slack"
    post_to_teams = "post_to_teams"
    # Risk / EDD
    trigger_edd = "trigger_edd"
    set_risk_level = "set_risk_level"
    flag_smr_candidate = "flag_smr_candidate"
    # Reports (draft only — never auto-submit)
    generate_report_draft = "generate_report_draft"
    # External
    trigger_webhook = "trigger_webhook"
    trigger_api_call = "trigger_api_call"
    # Compliance calendar
    create_calendar_item = "create_calendar_item"


class AutomationRuleStatus(str, enum.Enum):
    active = "active"
    inactive = "inactive"
    testing = "testing"  # shadow mode: actions logged but not executed
    archived = "archived"


class ApprovalDecisionType(str, enum.Enum):
    approved = "approved"
    rejected = "rejected"
    more_information = "more_information"
    escalated = "escalated"


class ApprovalStepType(str, enum.Enum):
    analyst_review = "analyst_review"
    compliance_review = "compliance_review"
    mlro_review = "mlro_review"
    senior_approval = "senior_approval"


# ── Models ─────────────────────────────────────────────────────────────────────


class AutomationRule(Base):
    """
    Event-driven automation rule.

    Structure:
      event_type   — what triggers evaluation (customer_created, transaction_created, etc.)
      conditions   — list of condition groups (same format as MonitoringRule):
                     [{logic: "AND", conditions: [{field, operator, value}]}]
                     groups are OR'd together
      actions      — ordered list of actions to execute when conditions match:
                     [{action_type, params: {...}, delay_minutes: 0}]
      priority     — evaluation order (lower number = evaluated first)

    DISCLAIMER: Rules automate workflow steps only.
    The system never automatically approves compliance decisions.
    """

    __tablename__ = "automation_rules"

    id: Mapped[str] = Column(
        String, primary_key=True, default=lambda: f"ar_{uuid4().hex[:10]}"
    )
    org_id: Mapped[str] = Column(
        String,
        ForeignKey("organisations.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    rule_ref: Mapped[Optional[str]] = Column(String(30), index=True)  # e.g. AUTO-TM-001
    name: Mapped[str] = Column(String(255), nullable=False)
    description: Mapped[Optional[str]] = Column(Text)

    event_type: Mapped[RuleEventType] = Column(
        Enum(RuleEventType), nullable=False, index=True
    )
    status: Mapped[AutomationRuleStatus] = Column(
        Enum(AutomationRuleStatus),
        default=AutomationRuleStatus.active,
        nullable=False,
        index=True,
    )
    is_system: Mapped[Optional[bool]] = Column(
        Boolean, default=False
    )  # VeriGo-seeded — cannot delete
    priority: Mapped[Optional[int]] = Column(Integer, default=100)

    # Condition groups — JSON encoding same as MonitoringRule:
    # [{"logic": "AND", "description": "...", "conditions": [{"field": "...", "operator": "eq", "value": "..."}]}]
    condition_groups: Mapped[Optional[Any]] = Column(JSON, default=list)

    # Actions — ordered list:
    # [{"action_type": "create_alert", "params": {"severity": "high", "title": "..."}, "delay_minutes": 0}]
    actions: Mapped[Optional[Any]] = Column(JSON, default=list)

    # Applicable industries (empty = all)
    applicable_industries: Mapped[Optional[Any]] = Column(JSON, default=list)

    # Statistics
    trigger_count: Mapped[Optional[int]] = Column(Integer, default=0)
    last_triggered_at: Mapped[Optional[datetime]] = Column(DateTime(timezone=True))
    last_executed_at: Mapped[Optional[datetime]] = Column(DateTime(timezone=True))
    false_positive_rate: Mapped[Optional[float]] = Column(Float)

    tags: Mapped[Optional[Any]] = Column(JSON, default=list)
    created_by: Mapped[Optional[str]] = Column(String)
    created_at: Mapped[Optional[datetime]] = Column(
        DateTime(timezone=True), server_default=func.now()
    )
    updated_at: Mapped[Optional[datetime]] = Column(
        DateTime(timezone=True), onupdate=func.now()
    )


class AutomationRuleVersion(Base):
    """
    Immutable snapshot of an AutomationRule taken on every create/update.

    Same pattern as governance.PolicyVersion: provides full history of what
    conditions/actions were in force at any point in time, for audit and
    rollback reference. Rows are never modified or deleted.
    """

    __tablename__ = "automation_rule_versions"

    id: Mapped[str] = Column(
        String, primary_key=True, default=lambda: f"arv_{uuid4().hex[:12]}"
    )
    rule_id: Mapped[Optional[str]] = Column(
        String,
        ForeignKey("automation_rules.id", ondelete="SET NULL"),
        nullable=True,
        index=True,
    )
    org_id: Mapped[str] = Column(String, nullable=False, index=True)

    version_number: Mapped[int] = Column(Integer, nullable=False)

    # Full snapshot of the rule definition at this version
    name: Mapped[str] = Column(String(255), nullable=False)
    description: Mapped[Optional[str]] = Column(Text)
    event_type: Mapped[str] = Column(String(50), nullable=False)
    status: Mapped[str] = Column(String(20), nullable=False)
    priority: Mapped[Optional[int]] = Column(Integer)
    condition_groups: Mapped[Optional[Any]] = Column(JSON, default=list)
    actions: Mapped[Optional[Any]] = Column(JSON, default=list)
    applicable_industries: Mapped[Optional[Any]] = Column(JSON, default=list)

    change_summary: Mapped[Optional[str]] = Column(Text)
    changed_by: Mapped[Optional[str]] = Column(String)
    created_at: Mapped[Optional[datetime]] = Column(
        DateTime(timezone=True), server_default=func.now()
    )


class AutomationRuleExecution(Base):
    """
    Immutable execution log for automation rule evaluations.
    Created whether the rule matched or not.
    """

    __tablename__ = "automation_rule_executions"

    id: Mapped[str] = Column(
        String, primary_key=True, default=lambda: f"are_{uuid4().hex[:12]}"
    )
    rule_id: Mapped[str] = Column(
        String, ForeignKey("automation_rules.id"), nullable=False, index=True
    )
    org_id: Mapped[str] = Column(String, nullable=False, index=True)

    event_type: Mapped[str] = Column(String(100), nullable=False)
    entity_type: Mapped[Optional[str]] = Column(
        String(50)
    )  # customer | transaction | case | alert | document
    entity_id: Mapped[Optional[str]] = Column(String)
    triggered_by: Mapped[Optional[str]] = Column(String)  # user_id or "system"

    conditions_evaluated: Mapped[Optional[int]] = Column(Integer)
    conditions_matched: Mapped[bool] = Column(Boolean, nullable=False)
    matched_group_index: Mapped[Optional[int]] = Column(
        Integer
    )  # which condition group matched

    # Actions actually executed (in testing mode: what WOULD have been executed)
    actions_executed: Mapped[Optional[Any]] = Column(
        JSON, default=list
    )  # [{"action_type": "...", "result": "...", "entity_id": "..."}]
    is_shadow_mode: Mapped[Optional[bool]] = Column(
        Boolean, default=False
    )  # True when rule.status == testing

    execution_time_ms: Mapped[Optional[float]] = Column(Float)
    error_message: Mapped[Optional[str]] = Column(Text)

    executed_at: Mapped[Optional[datetime]] = Column(
        DateTime(timezone=True), server_default=func.now()
    )


class DecisionSupportPanel(Base):
    """
    Pre-approval decision support summary.

    Generated when a transaction/case enters the approval workflow.
    Aggregates all risk signals, triggered rules, required actions,
    potential reporting obligations, and outstanding items.

    DISCLAIMER: Decision support panels are compliance workflow guidance only.
    The system never automatically approves compliance decisions.
    All decisions remain with the reporting entity.
    """

    __tablename__ = "decision_support_panels"

    id: Mapped[str] = Column(
        String, primary_key=True, default=lambda: f"dsp_{uuid4().hex[:12]}"
    )
    org_id: Mapped[str] = Column(String, nullable=False, index=True)
    transaction_id: Mapped[Optional[str]] = Column(
        String, ForeignKey("transactions.id"), nullable=True, index=True
    )
    case_id: Mapped[Optional[str]] = Column(
        String, ForeignKey("cases.id"), nullable=True, index=True
    )
    customer_id: Mapped[str] = Column(
        String, ForeignKey("customers.id"), nullable=False, index=True
    )

    # Risk summary (compiled at panel generation time)
    customer_risk_score: Mapped[Optional[float]] = Column(Float)
    customer_risk_level: Mapped[Optional[str]] = Column(String(20))
    transaction_risk_score: Mapped[Optional[float]] = Column(Float)
    geographic_risk_score: Mapped[Optional[float]] = Column(Float)
    product_risk_score: Mapped[Optional[float]] = Column(Float)
    behaviour_risk_score: Mapped[Optional[float]] = Column(Float)
    risk_matrix_score: Mapped[Optional[float]] = Column(Float)
    alert_score: Mapped[Optional[float]] = Column(Float)
    final_approval_score: Mapped[Optional[float]] = Column(Float)

    # Triggered rules (from MonitoringRule and AutomationRule evaluations)
    triggered_rules: Mapped[Optional[Any]] = Column(
        JSON, default=list
    )  # [{rule_id, rule_name, category}]

    # Required and recommended actions
    required_actions: Mapped[Optional[Any]] = Column(
        JSON, default=list
    )  # must-do before approval
    recommended_actions: Mapped[Optional[Any]] = Column(
        JSON, default=list
    )  # guidance prompts

    # Potential AUSTRAC reporting obligations
    potential_ttr: Mapped[Optional[bool]] = Column(Boolean, default=False)
    potential_ifti: Mapped[Optional[bool]] = Column(Boolean, default=False)
    potential_smr: Mapped[Optional[bool]] = Column(Boolean, default=False)
    reporting_rationale: Mapped[Optional[Any]] = Column(
        JSON, default=dict
    )  # {ttr: "reason", ifti: "reason"}

    # Outstanding items
    outstanding_tasks: Mapped[Optional[Any]] = Column(
        JSON, default=list
    )  # [{"task": "...", "due": "..."}]
    missing_documents: Mapped[Optional[Any]] = Column(
        JSON, default=list
    )  # [{"doc_type": "...", "required_for": "..."}]

    # Approval workflow status
    current_step: Mapped[Optional[ApprovalStepType]] = Column(
        Enum(ApprovalStepType), default=ApprovalStepType.analyst_review
    )
    is_complete: Mapped[Optional[bool]] = Column(Boolean, default=False)
    final_decision: Mapped[Optional[ApprovalDecisionType]] = Column(
        Enum(ApprovalDecisionType)
    )
    final_decision_by: Mapped[Optional[str]] = Column(String)
    final_decision_at: Mapped[Optional[datetime]] = Column(DateTime(timezone=True))
    final_decision_notes: Mapped[Optional[str]] = Column(Text)

    generated_by: Mapped[Optional[str]] = Column(String)  # user_id or "system"
    generated_at: Mapped[Optional[datetime]] = Column(
        DateTime(timezone=True), server_default=func.now()
    )
    updated_at: Mapped[Optional[datetime]] = Column(
        DateTime(timezone=True), onupdate=func.now()
    )


class ApprovalWorkflowStep(Base):
    """
    Individual step in the multi-stage approval workflow.
    One row per review action taken on a DecisionSupportPanel.
    Immutable — each action creates a new row.
    """

    __tablename__ = "approval_workflow_steps"

    id: Mapped[str] = Column(
        String, primary_key=True, default=lambda: f"aws_{uuid4().hex[:12]}"
    )
    panel_id: Mapped[str] = Column(
        String,
        ForeignKey("decision_support_panels.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    org_id: Mapped[str] = Column(String, nullable=False, index=True)

    step_type: Mapped[ApprovalStepType] = Column(Enum(ApprovalStepType), nullable=False)
    step_order: Mapped[int] = Column(Integer, nullable=False)

    decision: Mapped[ApprovalDecisionType] = Column(
        Enum(ApprovalDecisionType), nullable=False
    )
    reviewer_id: Mapped[str] = Column(String, nullable=False)
    review_notes: Mapped[Optional[str]] = Column(Text)

    # What the reviewer saw at decision time
    risk_snapshot: Mapped[Optional[Any]] = Column(
        JSON
    )  # scores, flags, triggered rules at decision time

    # Conditions attached (e.g. "approved conditional on SOF documents")
    conditions: Mapped[Optional[Any]] = Column(JSON, default=list)

    reviewed_at: Mapped[Optional[datetime]] = Column(
        DateTime(timezone=True), server_default=func.now()
    )
    # Immutable: no updated_at
