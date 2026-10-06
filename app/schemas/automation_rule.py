from typing import Optional

from pydantic import BaseModel, Field

from app.models.automation_rule import (
    ApprovalDecisionType,
    AutomationRuleStatus,
    RuleActionType,
    RuleEventType,
)


class ConditionSchema(BaseModel):
    field: str = Field(
        ..., description="Dot-notation field path e.g. 'customer.risk_level'"
    )
    operator: str = Field(
        ...,
        description="eq | ne | gt | lt | gte | lte | in | not_in | contains | starts_with | is_true | is_false | is_null | between",
    )
    value: object = None
    value_label: Optional[str] = None
    negate: bool = Field(default=False, description="NOT this condition")


class ConditionGroupSchema(BaseModel):
    logic: str = Field(
        default="AND",
        description="AND (all must match) or OR (any must match) within this group",
    )
    description: Optional[str] = None
    negate: bool = Field(default=False, description="NOT the whole group's result")
    conditions: list[ConditionSchema] = Field(default_factory=list)
    groups: list["ConditionGroupSchema"] = Field(
        default_factory=list,
        description="Nested sub-groups, combined per this group's logic",
    )


class ActionSchema(BaseModel):
    action_type: RuleActionType
    params: dict = Field(default_factory=dict)
    delay_minutes: int = Field(default=0, ge=0)
    description: Optional[str] = None


class RuleCreate(BaseModel):
    name: str = Field(..., min_length=3, max_length=255)
    description: Optional[str] = None
    event_type: RuleEventType
    condition_groups: list[ConditionGroupSchema] = Field(default_factory=list)
    actions: list[ActionSchema] = Field(..., min_length=1)
    priority: int = Field(default=100, ge=1, le=9999)
    applicable_industries: list[str] = Field(default_factory=list)
    tags: list[str] = Field(default_factory=list)


class RuleUpdate(BaseModel):
    name: Optional[str] = Field(None, max_length=255)
    description: Optional[str] = None
    status: Optional[AutomationRuleStatus] = None
    condition_groups: Optional[list[ConditionGroupSchema]] = None
    actions: Optional[list[ActionSchema]] = None
    priority: Optional[int] = Field(None, ge=1, le=9999)
    applicable_industries: Optional[list[str]] = None
    tags: Optional[list[str]] = None


class ApprovalDecision(BaseModel):
    decision: ApprovalDecisionType
    review_notes: str = Field(..., min_length=5)
    conditions: list[str] = Field(default_factory=list)


class RuleTestRequest(BaseModel):
    context: dict = Field(
        ...,
        description="Sample event context to test the rule's conditions against, e.g. {'customer': {'risk_level': 'high'}}",
    )
