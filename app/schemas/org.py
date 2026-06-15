from datetime import datetime
from typing import List, Optional

from pydantic import BaseModel, EmailStr, Field

from app.models.organisation import IndustryType, OrganisationStatus


class OrgCreate(BaseModel):
    name: str = Field(..., min_length=2, max_length=255)
    trading_name: Optional[str] = None
    abn: Optional[str] = Field(None, min_length=11, max_length=11)
    acn: Optional[str] = Field(None, min_length=9, max_length=9)
    industry_type: IndustryType
    contact_email: EmailStr
    contact_phone: Optional[str] = None
    address_line1: Optional[str] = None
    address_line2: Optional[str] = None
    city: Optional[str] = None
    state: Optional[str] = None
    postcode: Optional[str] = None
    country: str = "AU"


class OrgUpdate(BaseModel):
    name: Optional[str] = None
    trading_name: Optional[str] = None
    abn: Optional[str] = None
    contact_email: Optional[EmailStr] = None
    contact_phone: Optional[str] = None
    address_line1: Optional[str] = None
    address_line2: Optional[str] = None
    city: Optional[str] = None
    state: Optional[str] = None
    postcode: Optional[str] = None
    austrac_id: Optional[str] = None
    subscription_plan: Optional[str] = None


class OrgResponse(BaseModel):
    id: str
    name: str
    trading_name: Optional[str]
    abn: Optional[str]
    acn: Optional[str]
    austrac_id: Optional[str]
    industry_type: IndustryType
    status: OrganisationStatus
    contact_email: Optional[str]
    contact_phone: Optional[str]
    address_line1: Optional[str]
    city: Optional[str]
    state: Optional[str]
    postcode: Optional[str]
    country: str
    subscription_plan: Optional[str]
    created_at: Optional[datetime]

    model_config = {"from_attributes": True}


class OrgOnboardRequest(BaseModel):
    """Used in the Step 1-4 signup wizard."""
    # Step 2 — Industry
    industry_type: IndustryType
    # Step 3 — Org details
    name: str
    trading_name: Optional[str] = None
    abn: Optional[str] = None
    acn: Optional[str] = None
    contact_email: EmailStr
    contact_phone: Optional[str] = None
    address_line1: Optional[str] = None
    city: Optional[str] = None
    state: Optional[str] = None
    postcode: Optional[str] = None
    # Step 4 — Risk appetite
    risk_level: str = Field("medium", pattern="^(low|medium|high)$")
    # Admin user (first user for this org)
    admin_email: EmailStr
    admin_full_name: str
    admin_password: str = Field(..., min_length=12)
