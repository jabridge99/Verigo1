import enum

from sqlalchemy import Boolean, Column, DateTime, Enum, ForeignKey, Integer, String
from sqlalchemy.sql import func

from app.db.database import Base


class UserRole(str, enum.Enum):
    admin = "admin"
    mlro = "mlro"
    analyst = "analyst"
    compliance = "compliance"
    viewer = "viewer"


class UserStatus(str, enum.Enum):
    active = "active"
    inactive = "inactive"
    suspended = "suspended"
    pending = "pending"


class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(String(60), unique=True, index=True, nullable=False)
    email = Column(String(200), unique=True, index=True, nullable=False)
    full_name = Column(String(200), nullable=False)
    hashed_password = Column(String(500))
    role = Column(Enum(UserRole), default=UserRole.analyst)
    status = Column(Enum(UserStatus), default=UserStatus.active)
    industry_id = Column(String(100))  # tenant scope
    tenant_id = Column(String(60))
    is_super_admin = Column(Boolean, default=False)  # global master account, not tenant-scoped
    # Cached default org for single-org login flows. Source of truth for
    # membership/role is OrganisationUser (a user may belong to >1 org).
    primary_organisation_id = Column(Integer, ForeignKey("organisations.id"))
    mfa_enabled = Column(Boolean, default=False)
    mfa_secret = Column(String(200))
    email_verified = Column(Boolean, default=False)
    oauth_provider = Column(String(20))  # "google" | "microsoft" | None
    oauth_id = Column(String(200))  # provider's unique subject id
    last_login_at = Column(DateTime(timezone=True))
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())


class MagicLinkToken(Base):
    __tablename__ = "magic_link_tokens"

    id = Column(Integer, primary_key=True, index=True)
    token = Column(String(200), unique=True, index=True, nullable=False)
    email = Column(String(200), nullable=False)
    expires_at = Column(DateTime(timezone=True), nullable=False)
    used = Column(Boolean, default=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now())


class EmailActionToken(Base):
    """Hashed, single-use tokens for email verification and password reset."""

    __tablename__ = "email_action_tokens"

    id = Column(Integer, primary_key=True, index=True)
    token = Column(String(200), unique=True, index=True, nullable=False)
    email = Column(String(200), nullable=False)
    purpose = Column(String(30), nullable=False)  # "verify_email" | "password_reset"
    expires_at = Column(DateTime(timezone=True), nullable=False)
    used = Column(Boolean, default=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
