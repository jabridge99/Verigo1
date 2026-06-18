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


class AccountabilityAckResponse(BaseModel):
    aml_accountability_ack: bool
    aml_accountability_ack_at: Optional[datetime] = None
    aml_accountability_ack_by: Optional[str] = None
