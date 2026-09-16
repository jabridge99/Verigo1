from typing import Optional

from pydantic import BaseModel, Field

from app.models.smr_decision_log import (
    SMRContinueDealings,
    SMRDecisionOutcome,
    SMRMatterSource,
    SMRSuspicionType,
)


class DecisionLogCreate(BaseModel):
    customer_id: Optional[str] = None
    case_id: Optional[str] = None
    tmp_alert_id: Optional[str] = None
    ecdd_case_id: Optional[str] = None
    related_transaction_id: Optional[str] = None
    matter_source: SMRMatterSource
    identifying_employee: Optional[str] = None
    suspicion_category: Optional[str] = Field(None, max_length=100)
    risk_matrix_ref: Optional[str] = Field(None, max_length=50)
    description: Optional[str] = None


class DecisionAssess(BaseModel):
    suspicion_formed: bool
    suspicion_type: Optional[SMRSuspicionType] = None
    is_terrorism_financing_indicator: bool = False
    reasons: str = Field(..., min_length=1)
    enhanced_monitoring_applied: bool = False


class DecisionLodge(BaseModel):
    austrac_reference: str = Field(..., min_length=1, max_length=100)
    tipping_off_check_confirmed: bool
    director_notified: bool = False
    continue_dealings: SMRContinueDealings = SMRContinueDealings.continue_normal
    post_decision_notes: Optional[str] = None


class DecisionClose(BaseModel):
    outcome: SMRDecisionOutcome
    post_decision_notes: Optional[str] = None
    next_review_date: Optional[str] = None
