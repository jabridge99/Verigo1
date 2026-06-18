from datetime import datetime
from typing import Optional

from pydantic import BaseModel

from app.models.aml_program import AMLProgramStatus


class AMLProgramItemResponse(BaseModel):
    category: str
    title: str
    description: Optional[str] = None
    review_frequency: Optional[str] = None
    is_required: bool
    locked: bool = False

    model_config = {"from_attributes": True}


class AMLProgramResponse(BaseModel):
    program_id: str
    industry_id: str
    risk_profile: str
    status: AMLProgramStatus
    version: int
    generated_at: Optional[datetime] = None
    items: list[AMLProgramItemResponse]
    is_preview: bool = False
    total_items: Optional[int] = None

    model_config = {"from_attributes": True}


class AMLProgramVersionResponse(BaseModel):
    version: int
    generated_at: Optional[datetime] = None
    item_count: int
    content_hash: str
    qr_token: str
    is_current: bool
    locked: bool = False

    model_config = {"from_attributes": True}


class AMLProgramVersionListResponse(BaseModel):
    versions: list[AMLProgramVersionResponse]
    full_history_available: bool


class AMLProgramVersionDetailResponse(BaseModel):
    version: int
    generated_at: Optional[datetime] = None
    item_count: int
    content_hash: str
    qr_token: str
    items: list[AMLProgramItemResponse]


class ExportRequest(BaseModel):
    reason: str


class VerificationResponse(BaseModel):
    program_id: Optional[str] = None
    version: int
    generated_at: Optional[datetime] = None
    content_hash: str
    item_count: int
    is_current: bool


class ProgramHealthResponse(BaseModel):
    score: int
    up_to_date: bool
    suggestions: list[dict]
