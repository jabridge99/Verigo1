from typing import Optional

from pydantic import BaseModel, Field

from app.models.marketplace import VerificationCheckType, VerificationIntegrationMode


class ProviderCreate(BaseModel):
    name: str = Field(..., min_length=2, max_length=150)
    description: Optional[str] = None
    check_type: VerificationCheckType
    integration_mode: VerificationIntegrationMode = VerificationIntegrationMode.manual
    vendor_key: Optional[str] = Field(None, max_length=50)
    unit_cost_aud: float = Field(0.0, ge=0.0)
    markup_pct: float = Field(0.0, ge=0.0, le=5.0)


class ProviderUpdate(BaseModel):
    name: Optional[str] = Field(None, min_length=2, max_length=150)
    description: Optional[str] = None
    integration_mode: Optional[VerificationIntegrationMode] = None
    vendor_key: Optional[str] = Field(None, max_length=50)
    unit_cost_aud: Optional[float] = Field(None, ge=0.0)
    markup_pct: Optional[float] = Field(None, ge=0.0, le=5.0)
    is_active: Optional[bool] = None


class OrderCreate(BaseModel):
    provider_id: str
    entity_type: str = Field(..., pattern="^(customer|transaction)$")
    entity_id: str


class OrderComplete(BaseModel):
    accepted: bool = True
    result_summary: Optional[dict] = None
    evidence_url: Optional[str] = None
    screening_record_id: Optional[str] = None
