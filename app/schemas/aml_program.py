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
