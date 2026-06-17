from datetime import datetime
from typing import Optional

from pydantic import BaseModel, EmailStr

from app.models.user import UserRole, UserStatus


class UserCreate(BaseModel):
    email: EmailStr
    full_name: str
    password: str
    role: UserRole = UserRole.analyst
    industry_id: Optional[str] = None
    tenant_id: Optional[str] = None


class UserUpdate(BaseModel):
    full_name: Optional[str] = None
    role: Optional[UserRole] = None
    status: Optional[UserStatus] = None
    industry_id: Optional[str] = None


class UserLogin(BaseModel):
    email: EmailStr
    password: str


class MagicLinkRequest(BaseModel):
    email: EmailStr


class MagicLinkVerify(BaseModel):
    token: str


class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user_id: str
    email: str
    full_name: str
    role: str
    industry_id: Optional[str] = None
    mfa_required: bool = False
    dev_verify_email_token: Optional[str] = None
    is_super_admin: bool = False


class UserResponse(BaseModel):
    id: int
    user_id: str
    email: str
    full_name: str
    role: UserRole
    status: UserStatus
    industry_id: Optional[str] = None
    tenant_id: Optional[str] = None
    mfa_enabled: bool
    email_verified: bool
    oauth_provider: Optional[str] = None
    is_super_admin: bool = False
    last_login_at: Optional[datetime] = None
    created_at: Optional[datetime] = None

    model_config = {"from_attributes": True}


class PasswordChange(BaseModel):
    current_password: str
    new_password: str


class EmailVerificationRequest(BaseModel):
    email: EmailStr


class EmailVerificationConfirm(BaseModel):
    token: str


class PasswordResetRequest(BaseModel):
    email: EmailStr


class PasswordResetConfirm(BaseModel):
    token: str
    new_password: str
