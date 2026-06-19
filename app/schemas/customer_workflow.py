from datetime import date, datetime
from typing import Any, Dict, List, Optional

from pydantic import BaseModel, Field

from app.models.customer_workflow import WorkflowAction, WorkflowState


class WorkflowActionRequest(BaseModel):
    action: WorkflowAction
    comments: Optional[str] = None
    metadata: Optional[Dict[str, Any]] = None


class WorkflowEventResponse(BaseModel):
    id: str
    action: WorkflowAction
    from_state: WorkflowState
    to_state: WorkflowState
    actor_id: Optional[str]
    actor_role: Optional[str]
    comments: Optional[str]
    metadata: Optional[Dict[str, Any]]
    occurred_at: datetime

    model_config = {"from_attributes": True}


class WorkflowResponse(BaseModel):
    id: str
    customer_id: str
    state: WorkflowState
    edd_triggered: bool
    edd_triggers: Optional[List[str]]
    edd_approved_by: Optional[str]
    assigned_analyst: Optional[str]
    assigned_compliance: Optional[str]
    assigned_senior: Optional[str]
    risk_gate_result: Optional[str]
    risk_gate_score: Optional[float]
    decision: Optional[str]
    decision_by: Optional[str]
    decision_notes: Optional[str]
    rejection_reason: Optional[str]
    rfi_notes: Optional[str]
    sla_due_date: Optional[date]
    started_at: Optional[datetime]
    decision_at: Optional[datetime]
    created_at: Optional[datetime]

    model_config = {"from_attributes": True}


class WorkflowAssignRequest(BaseModel):
    assigned_analyst: Optional[str] = None
    assigned_compliance: Optional[str] = None
    assigned_senior: Optional[str] = None
    sla_due_date: Optional[date] = None


class RiskAssessmentRequest(BaseModel):
    """Input for the 5-dimension risk assessment engine."""

    # Product
    involves_remittance: bool = False
    involves_fx: bool = False
    involves_crypto: bool = False
    involves_cash: bool = False
    involves_trust: bool = False
    involves_bearer: bool = False
    # Geographic (additional countries beyond customer record)
    additional_countries: Optional[List[str]] = None
    # Channel
    channel: str = "online"
    is_introduced: bool = False
    is_third_party_reliance: bool = False
    # Transaction
    expected_monthly_volume_aud: Optional[float] = Field(None, ge=0)
    expected_max_transaction_aud: Optional[float] = Field(None, ge=0)
    expected_frequency: Optional[str] = None  # daily | weekly | monthly | occasional
    crosses_border: bool = False
    # Override
    assessment_notes: Optional[str] = None


class RiskDimensionResponse(BaseModel):
    score: float
    factors: Dict[str, float]
    flags: Dict[str, Any]


class RiskAssessmentResponse(BaseModel):
    customer_risk: RiskDimensionResponse
    product_risk: RiskDimensionResponse
    geographic_risk: RiskDimensionResponse
    channel_risk: RiskDimensionResponse
    transaction_risk: RiskDimensionResponse
    overall_score: float
    overall_level: str
    gateway_decision: str  # "cdd" | "edd"
    edd_triggers: List[str]
    weights: Dict[str, float]
    cdd_level: str
    workflow_state_after: str  # state the workflow moved to


class RiskProfileResponse(BaseModel):
    id: str
    version: int
    customer_risk_score: float
    product_risk_score: float
    geographic_risk_score: float
    channel_risk_score: float
    transaction_risk_score: float
    overall_risk_score: float
    overall_risk_level: Optional[str]
    gateway_decision: Optional[str]
    edd_triggers: Optional[List[str]]
    is_pep: bool
    has_fatf_blacklist_country: bool
    has_sanctions_country: bool
    involves_crypto: bool
    involves_remittance: bool
    channel: Optional[str]
    assessed_by: Optional[str]
    assessed_at: Optional[datetime]

    model_config = {"from_attributes": True}


class EDDApprovalRequest(BaseModel):
    approved: bool
    notes: str = Field(..., min_length=5)
    return_reason: Optional[str] = None  # if approved=False, why sending back


class RFIRequest(BaseModel):
    rfi_notes: str = Field(
        ..., min_length=10, description="What additional information is required"
    )


class ApprovalRequest(BaseModel):
    decision: str = Field(..., pattern="^(approve|reject)$")
    notes: Optional[str] = None
    rejection_reason: Optional[str] = None
