"""Pydantic schemas for Monitoring Rules and Transaction Alerts."""

from datetime import datetime
from typing import Any, Optional

from pydantic import BaseModel, Field

from app.models.monitoring import (
    AlertCategory,
    AlertResult,
    AlertSeverity,
    AlertStatus,
    AlertType,
    RuleConditionOperator,
    RuleStatus,
)

# ── Rule Builder ───────────────────────────────────────────────────────────────


class RuleConditionCreate(BaseModel):
    condition_order: int = 0
    field_path: str = Field(
        ...,
        max_length=255,
        description="Dot-notation field: amount_aud, customer.risk_level, crypto_detail.mixer_exposure_pct",
    )
    operator: RuleConditionOperator
    value: Optional[Any] = None
    value_label: Optional[str] = Field(None, max_length=255)


class RuleConditionOut(RuleConditionCreate):
    id: str

    class Config:
        from_attributes = True


class RuleConditionGroupCreate(BaseModel):
    group_order: int = 0
    description: Optional[str] = Field(None, max_length=255)
    conditions: list[RuleConditionCreate]


class RuleConditionGroupOut(BaseModel):
    id: str
    group_order: int
    description: Optional[str] = None
    conditions: list[RuleConditionOut]

    class Config:
        from_attributes = True


class MonitoringRuleCreate(BaseModel):
    name: str = Field(..., max_length=255)
    description: Optional[str] = None
    rule_ref: Optional[str] = Field(None, max_length=30)
    category: AlertCategory
    alert_type: AlertType = AlertType.rule_triggered
    alert_severity: AlertSeverity = AlertSeverity.medium
    alert_score: float = Field(50.0, ge=0.0, le=100.0)
    alert_title_template: Optional[str] = Field(None, max_length=500)
    lookback_days: Optional[int] = None
    lookback_count: Optional[int] = None
    tags: list[str] = []
    applicable_customer_types: list[str] = []
    applicable_payment_methods: list[str] = []
    condition_groups: list[RuleConditionGroupCreate]


class MonitoringRuleUpdate(BaseModel):
    name: Optional[str] = Field(None, max_length=255)
    description: Optional[str] = None
    status: Optional[RuleStatus] = None
    alert_severity: Optional[AlertSeverity] = None
    alert_score: Optional[float] = Field(None, ge=0.0, le=100.0)
    alert_title_template: Optional[str] = Field(None, max_length=500)
    lookback_days: Optional[int] = None
    lookback_count: Optional[int] = None
    tags: Optional[list[str]] = None
    applicable_customer_types: Optional[list[str]] = None
    applicable_payment_methods: Optional[list[str]] = None


class MonitoringRuleOut(BaseModel):
    id: str
    org_id: str
    name: str
    description: Optional[str] = None
    rule_ref: Optional[str] = None
    category: AlertCategory
    alert_type: AlertType
    status: RuleStatus
    is_system_rule: bool
    alert_severity: AlertSeverity
    alert_score: float
    alert_title_template: Optional[str] = None
    lookback_days: Optional[int] = None
    lookback_count: Optional[int] = None
    tags: list[str]
    applicable_customer_types: list[str]
    applicable_payment_methods: list[str]
    total_alerts_generated: int
    false_positive_rate: Optional[float] = None
    last_triggered_at: Optional[datetime] = None
    created_at: datetime
    condition_groups: list[RuleConditionGroupOut] = []

    class Config:
        from_attributes = True


class MonitoringRuleListOut(BaseModel):
    id: str
    name: str
    rule_ref: Optional[str] = None
    category: AlertCategory
    status: RuleStatus
    alert_severity: AlertSeverity
    is_system_rule: bool
    total_alerts_generated: int
    false_positive_rate: Optional[float] = None
    last_triggered_at: Optional[datetime] = None

    class Config:
        from_attributes = True


# ── Alert Workflow ─────────────────────────────────────────────────────────────


class AlertAssignRequest(BaseModel):
    assign_to: str = Field(..., description="User ID to assign alert to")


class AlertReviewRequest(BaseModel):
    review_notes: Optional[str] = None
    is_false_positive: bool = False
    resolution: str = Field(
        ..., description="dismissed | escalated_to_case | smr_candidate | cleared"
    )
    is_smr_candidate: bool = False


class AlertEscalateRequest(BaseModel):
    escalate_to: str = Field(..., description="User ID (MLRO)")
    escalation_reason: str


class AlertOut(BaseModel):
    id: str
    alert_ref: str
    org_id: str
    transaction_id: str
    customer_id: str
    alert_type: AlertType
    category: AlertCategory
    severity: AlertSeverity
    status: AlertStatus
    rule_id: Optional[str] = None
    rule_name: Optional[str] = None
    rules_matched: list[str]
    alert_score: float
    score_breakdown: dict[str, Any]
    title: str
    description: Optional[str] = None
    behaviour_signals: dict[str, Any]
    assigned_to: Optional[str] = None
    assigned_at: Optional[datetime] = None
    reviewed_by: Optional[str] = None
    reviewed_at: Optional[datetime] = None
    review_notes: Optional[str] = None
    escalated_to: Optional[str] = None
    escalated_at: Optional[datetime] = None
    escalation_reason: Optional[str] = None
    resolved_by: Optional[str] = None
    resolved_at: Optional[datetime] = None
    resolution: Optional[str] = None
    resolution_notes: Optional[str] = None
    is_false_positive: bool
    is_smr_candidate: bool
    # Post-decision result — what happened after the monitoring review
    result: AlertResult
    result_notes: Optional[str] = None
    result_set_by: Optional[str] = None
    result_set_at: Optional[datetime] = None
    trigger_date: datetime
    created_at: datetime

    class Config:
        from_attributes = True


class AlertResultRequest(BaseModel):
    result: AlertResult
    result_notes: Optional[str] = None

    def model_post_init(self, __context) -> None:
        if self.result == AlertResult.other and not self.result_notes:
            raise ValueError("result_notes is required when result is 'other'.")


class AlertListOut(BaseModel):
    id: str
    alert_ref: str
    customer_id: str
    category: AlertCategory
    severity: AlertSeverity
    status: AlertStatus
    result: AlertResult
    alert_score: float
    title: str
    is_smr_candidate: bool
    assigned_to: Optional[str] = None
    trigger_date: datetime

    class Config:
        from_attributes = True
