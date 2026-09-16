from datetime import datetime
from typing import List, Optional

from pydantic import BaseModel, Field

from app.models.screening import (
    AdverseMediaCategory,
    CryptoNetwork,
    CryptoProvider,
    ScreeningEntityType,
    ScreeningProvider,
    ScreeningType,
)


class ScreeningRunRequest(BaseModel):
    customer_id: str
    screening_types: List[ScreeningType] = Field(
        ..., description="One or more screening types to run"
    )
    entity_type: ScreeningEntityType = ScreeningEntityType.customer
    entity_id: Optional[str] = None  # defaults to customer_id
    entity_name: Optional[str] = None  # override — uses customer name if omitted
    entity_dob: Optional[str] = None
    entity_nationality: Optional[str] = None
    provider: ScreeningProvider = ScreeningProvider.internal
    notes: Optional[str] = None


class QuickScreenRequest(BaseModel):
    category: str = Field(
        ..., description="One of: sanctions, pep, adverse_media, company, address"
    )
    query: str = Field(..., min_length=2, max_length=300)


class BatchScreeningRequest(BaseModel):
    customer_ids: List[str] = Field(..., min_length=1, max_length=50)
    screening_types: List[ScreeningType]
    provider: ScreeningProvider = ScreeningProvider.internal


class AlertReviewRequest(BaseModel):
    action: str = Field(
        ..., description="One of: dismiss (false positive), confirm, escalate, close"
    )
    notes: str = Field(..., min_length=10, description="Resolution notes required")
    assigned_to: Optional[str] = None


class WalletScreeningRequest(BaseModel):
    customer_id: str
    wallet_address: str = Field(..., min_length=10)
    network: CryptoNetwork
    wallet_label: Optional[str] = None
    provider: CryptoProvider = CryptoProvider.internal


class AdverseMediaRequest(BaseModel):
    customer_id: str
    headline: str = Field(..., max_length=1000)
    category: AdverseMediaCategory
    source_name: Optional[str] = None
    source_url: Optional[str] = Field(None, max_length=2000)
    publication_date: Optional[datetime] = None
    jurisdiction: Optional[str] = Field(None, max_length=2)
    match_confidence: Optional[float] = Field(None, ge=0, le=100)
    provider_raw_response: Optional[str] = None
