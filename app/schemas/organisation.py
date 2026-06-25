from datetime import datetime
from typing import Optional

from pydantic import BaseModel, EmailStr

from app.models.organisation import MembershipStatus, OrganisationStatus, RiskProfile


class OrganisationCreate(BaseModel):
    name: str
    industry_id: Optional[str] = None


class OrganisationUpdate(BaseModel):
    name: Optional[str] = None
    status: Optional[OrganisationStatus] = None
    industry_id: Optional[str] = None
    risk_profile: Optional[RiskProfile] = None
    abn: Optional[str] = None
    business_address: Optional[str] = None
    phone: Optional[str] = None
    compliance_officer_name: Optional[str] = None
    compliance_officer_email: Optional[str] = None


class OrganisationResponse(BaseModel):
    id: str
    name: str
    industry_id: Optional[str] = None
    risk_profile: Optional[RiskProfile] = None
    status: OrganisationStatus
    created_at: Optional[datetime] = None
    abn: Optional[str] = None
    business_address: Optional[str] = None
    phone: Optional[str] = None
    compliance_officer_name: Optional[str] = None
    compliance_officer_email: Optional[str] = None
    aml_accountability_ack: Optional[bool] = None
    aml_accountability_ack_at: Optional[datetime] = None
    aml_accountability_ack_by: Optional[str] = None

    model_config = {"from_attributes": True}


class MemberAdd(BaseModel):
    email: EmailStr
    role_key: str = (
        "staff"  # owner | admin | compliance_officer | mlro | director | staff | viewer
    )


class MemberUpdate(BaseModel):
    role_key: Optional[str] = None
    status: Optional[MembershipStatus] = None


class MemberResponse(BaseModel):
    user_id: str
    email: str
    full_name: str
    role_key: str
    role_name: str
    status: MembershipStatus
    created_at: Optional[datetime] = None


class RoleResponse(BaseModel):
    role_id: str
    name: str
    description: Optional[str] = None
    is_system: bool
    organisation_id: Optional[str] = None
    permissions: list[str]


class PermissionResponse(BaseModel):
    code: str
    description: Optional[str] = None
