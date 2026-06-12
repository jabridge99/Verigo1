import enum

from sqlalchemy import Boolean, Column, DateTime, Enum, Integer, String
from sqlalchemy.sql import func

from app.db.database import Base


class UserRole(str, enum.Enum):
    admin      = "admin"
    mlro       = "mlro"
    analyst    = "analyst"
    compliance = "compliance"
    viewer     = "viewer"


class UserStatus(str, enum.Enum):
    active    = "active"
    inactive  = "inactive"
    suspended = "suspended"
    pending   = "pending"


class User(Base):
    __tablename__ = "users"

    id              = Column(Integer, primary_key=True, index=True)
    user_id         = Column(String(60), unique=True, index=True, nullable=False)
    email           = Column(String(200), unique=True, index=True, nullable=False)
    full_name       = Column(String(200), nullable=False)
    hashed_password = Column(String(500))
    role            = Column(Enum(UserRole), default=UserRole.analyst)
    status          = Column(Enum(UserStatus), default=UserStatus.active)
    industry_id     = Column(String(100))          # tenant scope
    tenant_id       = Column(String(60))
    mfa_enabled     = Column(Boolean, default=False)
    mfa_secret      = Column(String(200))
    last_login_at   = Column(DateTime(timezone=True))
    created_at      = Column(DateTime(timezone=True), server_default=func.now())
    updated_at      = Column(DateTime(timezone=True), onupdate=func.now())


class MagicLinkToken(Base):
    __tablename__ = "magic_link_tokens"

    id         = Column(Integer, primary_key=True, index=True)
    token      = Column(String(200), unique=True, index=True, nullable=False)
    email      = Column(String(200), nullable=False)
    expires_at = Column(DateTime(timezone=True), nullable=False)
    used       = Column(Boolean, default=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
