from datetime import datetime
from typing import Optional

from pydantic import BaseModel

from app.models.retention import EntityScope


class PolicyUpsert(BaseModel):
    entity_scope: EntityScope
    retention_years: int
    legal_hold: bool = False
    notes: Optional[str] = None


class PolicyResponse(BaseModel):
    policy_id: str
    industry_id: Optional[str]
    entity_scope: EntityScope
    retention_years: int
    legal_hold: bool
    notes: Optional[str]
    created_at: Optional[datetime]

    class Config:
        from_attributes = True


class HoldCreate(BaseModel):
    entity_scope: EntityScope
    entity_id: str
    reason: str


class HoldResponse(BaseModel):
    hold_id: str
    industry_id: Optional[str]
    entity_scope: EntityScope
    entity_id: str
    reason: str
    held_by: Optional[str]
    placed_at: Optional[datetime]
    released_at: Optional[datetime]
    active: bool

    class Config:
        from_attributes = True


class EligibilityQuery(BaseModel):
    entity_scope: EntityScope
    entity_id: str
    created_at: datetime
    pep_or_high_risk: bool = False
