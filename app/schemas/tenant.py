from datetime import datetime
from typing import Optional

from pydantic import BaseModel


class TenantCreate(BaseModel):
    industry_id: str
    name: str
    display_name: Optional[str] = None
    contact_email: Optional[str] = None
    contact_name: Optional[str] = None
    phone: Optional[str] = None
    abn: Optional[str] = None
    austrac_id: Optional[str] = None
    pack_id: Optional[str] = None
    status: str = "active"
    settings: Optional[dict] = {}
    branding: Optional[dict] = {}


class TenantUpdate(BaseModel):
    name: Optional[str] = None
    display_name: Optional[str] = None
    contact_email: Optional[str] = None
    contact_name: Optional[str] = None
    phone: Optional[str] = None
    abn: Optional[str] = None
    austrac_id: Optional[str] = None
    pack_id: Optional[str] = None
    status: Optional[str] = None
    settings: Optional[dict] = None
    branding: Optional[dict] = None


class TenantResponse(BaseModel):
    id: int
    tenant_id: str
    industry_id: str
    name: str
    display_name: Optional[str] = None
    contact_email: Optional[str] = None
    contact_name: Optional[str] = None
    phone: Optional[str] = None
    abn: Optional[str] = None
    austrac_id: Optional[str] = None
    pack_id: Optional[str] = None
    status: str
    settings: Optional[dict] = None
    branding: Optional[dict] = None
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None

    model_config = {"from_attributes": True}


class TenantSummary(BaseModel):
    tenant_id: str
    industry_id: str
    name: str
    status: str
    pack_id: Optional[str] = None
    contact_email: Optional[str] = None
    created_at: Optional[datetime] = None

    model_config = {"from_attributes": True}
