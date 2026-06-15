import enum
from uuid import uuid4
from sqlalchemy import Column, String, Enum, DateTime, Boolean, Integer, ForeignKey, func
from sqlalchemy.orm import relationship
from app.db.database import Base


class UserRole(str, enum.Enum):
    admin = "admin"
    mlro = "mlro"
    compliance = "compliance"
    analyst = "analyst"
    viewer = "viewer"


class UserStatus(str, enum.Enum):
    active = "active"
    inactive = "inactive"
    suspended = "suspended"
    pending_mfa = "pending_mfa"


class User(Base):
    __tablename__ = "users"

    id = Column(String, primary_key=True, default=lambda: f"usr_{uuid4().hex[:12]}")
    org_id = Column(String, ForeignKey("organisations.id", ondelete="CASCADE"), nullable=False, index=True)
    email = Column(String(255), unique=True, nullable=False, index=True)
    full_name = Column(String(255), nullable=False)
    hashed_password = Column(String(255), nullable=False)
    role = Column(Enum(UserRole), nullable=False, default=UserRole.analyst)
    status = Column(Enum(UserStatus), default=UserStatus.active, nullable=False)
    mfa_enabled = Column(Boolean, default=False)
    mfa_secret = Column(String(64))
    mfa_verified = Column(Boolean, default=False)
    last_login_at = Column(DateTime(timezone=True))
    failed_login_count = Column(Integer, default=0)
    locked_until = Column(DateTime(timezone=True))
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())

    organisation = relationship("Organisation", back_populates="users")


class MagicLinkToken(Base):
    __tablename__ = "magic_link_tokens"

    id = Column(Integer, primary_key=True, autoincrement=True)
    email = Column(String(255), nullable=False, index=True)
    token_hash = Column(String(255), nullable=False, unique=True)
    expires_at = Column(DateTime(timezone=True), nullable=False)
    used = Column(Boolean, default=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
