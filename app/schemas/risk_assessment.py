from datetime import datetime
from typing import Optional

from pydantic import BaseModel


class RiskFactorResponse(BaseModel):
    factor: str
    label: str
    description: str
    rating: str
    locked: bool = False


class RiskAssessmentResponse(BaseModel):
    industry_id: str
    risk_profile: str
    overall_rating: str
    factors: list[RiskFactorResponse]
    generated_at: Optional[datetime] = None
    is_preview: bool = False
    total_factors: Optional[int] = None


class AccountabilityAckRequest(BaseModel):
    acknowledged: bool
    # Single onboarding checkbox covers both accountability and the
    # retention/IP terms of use — both default to the same value as
    # `acknowledged` unless explicitly overridden.
    retention_terms_accepted: Optional[bool] = None


class AccountabilityAckResponse(BaseModel):
    aml_accountability_ack: bool
    aml_accountability_ack_at: Optional[datetime] = None
    aml_accountability_ack_by: Optional[str] = None
    retention_terms_accepted: bool = False
    retention_terms_accepted_at: Optional[datetime] = None
    retention_terms_version: Optional[str] = None
