from datetime import datetime
from typing import List, Optional

from pydantic import BaseModel

from app.models.api_key import APIKeyStatus, WebhookStatus

# ── API Keys ──────────────────────────────────────────────────────────────────

class APIKeyCreate(BaseModel):
    name: str
    scopes: List[str] = []
    expires_days: Optional[int] = None   # None = never


class APIKeyResponse(BaseModel):
    id: int
    key_id: str
    name: str
    key_prefix: str
    user_id: str
    industry_id: Optional[str] = None
    status: APIKeyStatus
    scopes: List[str] = []
    last_used_at: Optional[datetime] = None
    expires_at: Optional[datetime] = None
    created_at: Optional[datetime] = None

    model_config = {"from_attributes": True}


class APIKeyCreated(APIKeyResponse):
    raw_key: str   # Only returned once on creation


# ── Webhooks ──────────────────────────────────────────────────────────────────

class WebhookCreate(BaseModel):
    name: str
    url: str
    events: List[str]


class WebhookUpdate(BaseModel):
    name: Optional[str] = None
    url: Optional[str] = None
    events: Optional[List[str]] = None
    status: Optional[WebhookStatus] = None


class WebhookResponse(BaseModel):
    id: int
    webhook_id: str
    name: str
    url: str
    events: List[str]
    user_id: str
    industry_id: Optional[str] = None
    status: WebhookStatus
    failure_count: int
    last_fired_at: Optional[datetime] = None
    created_at: Optional[datetime] = None

    model_config = {"from_attributes": True}


class WebhookDeliveryResponse(BaseModel):
    id: int
    delivery_id: str
    webhook_id: str
    event: str
    payload: Optional[dict] = None
    status_code: Optional[int] = None
    success: bool
    attempt: int
    delivered_at: Optional[datetime] = None

    model_config = {"from_attributes": True}
