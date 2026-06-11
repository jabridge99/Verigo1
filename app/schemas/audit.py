from pydantic import BaseModel
from typing import Optional, Any
from datetime import datetime


class AuditLogCreate(BaseModel):
    action: str
    entity_type: str
    entity_id: str
    actor: Optional[str] = "system"
    actor_role: Optional[str] = "system"
    industry_id: Optional[str] = None
    before_state: Optional[Any] = None
    after_state: Optional[Any] = None
    notes: Optional[str] = None
    ip_address: Optional[str] = None


class AuditLogResponse(BaseModel):
    id: int
    log_id: str
    action: str
    entity_type: str
    entity_id: str
    actor: Optional[str]
    actor_role: Optional[str]
    industry_id: Optional[str]
    before_state: Optional[Any]
    after_state: Optional[Any]
    notes: Optional[str]
    ip_address: Optional[str]
    created_at: Optional[datetime]

    class Config:
        from_attributes = True
