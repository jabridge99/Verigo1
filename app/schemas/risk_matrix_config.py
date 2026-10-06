from typing import Optional

from pydantic import BaseModel, Field

from app.models.risk_matrix_config import RiskFactorCategory


class RiskFactorCreate(BaseModel):
    category: RiskFactorCategory
    factor_key: str = Field(..., min_length=3, max_length=100)
    label: str = Field(..., min_length=3, max_length=255)
    description: Optional[str] = None
    weight: float = Field(..., ge=0.0, le=1.0)
    display_order: int = Field(default=0, ge=0)


class RiskFactorUpdate(BaseModel):
    label: Optional[str] = Field(None, max_length=255)
    description: Optional[str] = None
    weight: Optional[float] = Field(None, ge=0.0, le=1.0)
    is_active: Optional[bool] = None
    display_order: Optional[int] = None


class RiskProfileUpdate(BaseModel):
    score_min: Optional[float] = Field(None, ge=0.0, le=100.0)
    score_max: Optional[float] = Field(None, ge=0.0, le=100.0)
    review_frequency_months: Optional[int] = Field(None, ge=1, le=120)
    edd_required: Optional[bool] = None
    enhanced_monitoring: Optional[bool] = None
    senior_approval_required: Optional[bool] = None
    description: Optional[str] = None


class WeightRebalanceRequest(BaseModel):
    category: RiskFactorCategory
    weights: dict[str, float]  # {factor_key: weight}
    reason: str = Field(..., min_length=10)
