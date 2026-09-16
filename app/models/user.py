import enum
from datetime import datetime
from typing import Optional
from uuid import uuid4

from sqlalchemy import (
    Boolean,
    Column,
    DateTime,
    Enum,
    ForeignKey,
    Integer,
    String,
    func,
)
from sqlalchemy.orm import Mapped, relationship

from app.db.database import Base
from app.services.crypto import EncryptedMfaSecret


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

    id: Mapped[str] = Column(
        String, primary_key=True, default=lambda: f"usr_{uuid4().hex[:12]}"
    )
    # Nullable: global super-admins (is_super_admin=True) are not
    # tenant-scoped and have no org.
    org_id: Mapped[Optional[str]] = Column(
        String,
        ForeignKey("organisations.id", ondelete="CASCADE"),
        nullable=True,
        index=True,
    )
    email: Mapped[str] = Column(String(255), unique=True, nullable=False, index=True)
    full_name: Mapped[str] = Column(String(255), nullable=False)
    hashed_password: Mapped[str] = Column(String(255), nullable=False)
    role: Mapped[UserRole] = Column(
        Enum(UserRole), nullable=False, default=UserRole.analyst
    )
    status: Mapped[UserStatus] = Column(
        Enum(UserStatus), default=UserStatus.active, nullable=False
    )
    industry_id: Mapped[Optional[str]] = Column(String(100))  # tenant scope
    tenant_id: Mapped[Optional[str]] = Column(String(60))
    is_super_admin: Mapped[Optional[bool]] = Column(
        Boolean, default=False
    )  # global master account, not tenant-scoped
    # Cached default org for single-org login flows. Source of truth for
    # membership/role is OrganisationUser (a user may belong to >1 org).
    # SET NULL (not CASCADE): deleting an org should clear this cached
    # pointer, not delete the user — OrganisationUser remains the source of
    # truth for membership and is cascade-deleted with the org separately.
    primary_organisation_id: Mapped[Optional[str]] = Column(
        String, ForeignKey("organisations.id", ondelete="SET NULL")
    )
    mfa_enabled: Mapped[Optional[bool]] = Column(Boolean, default=False)
    mfa_secret: Mapped[Optional[str]] = Column(EncryptedMfaSecret(255))
    mfa_verified: Mapped[Optional[bool]] = Column(Boolean, default=False)
    email_verified: Mapped[Optional[bool]] = Column(Boolean, default=False)
    oauth_provider: Mapped[Optional[str]] = Column(
        String(20)
    )  # "google" | "microsoft" | None
    oauth_id: Mapped[Optional[str]] = Column(
        String(200)
    )  # provider's unique subject id
    last_login_at: Mapped[Optional[datetime]] = Column(DateTime(timezone=True))
    failed_login_count: Mapped[Optional[int]] = Column(Integer, default=0)
    locked_until: Mapped[Optional[datetime]] = Column(DateTime(timezone=True))
    created_at: Mapped[Optional[datetime]] = Column(
        DateTime(timezone=True), server_default=func.now()
    )
    updated_at: Mapped[Optional[datetime]] = Column(
        DateTime(timezone=True), onupdate=func.now()
    )

    organisation = relationship(
        "Organisation", back_populates="users", foreign_keys=[org_id]
    )


class MagicLinkToken(Base):
    __tablename__ = "magic_link_tokens"

    id: Mapped[int] = Column(Integer, primary_key=True, autoincrement=True)
    email: Mapped[str] = Column(String(255), nullable=False, index=True)
    token_hash: Mapped[str] = Column(String(255), nullable=False, unique=True)
    expires_at: Mapped[datetime] = Column(DateTime(timezone=True), nullable=False)
    used: Mapped[Optional[bool]] = Column(Boolean, default=False)
    created_at: Mapped[Optional[datetime]] = Column(
        DateTime(timezone=True), server_default=func.now()
    )


class EmailActionToken(Base):
    """Hashed, single-use tokens for email verification and password reset."""

    __tablename__ = "email_action_tokens"

    id: Mapped[int] = Column(Integer, primary_key=True, index=True)
    token: Mapped[str] = Column(String(200), unique=True, index=True, nullable=False)
    email: Mapped[str] = Column(String(200), nullable=False)
    purpose: Mapped[str] = Column(
        String(30), nullable=False
    )  # "verify_email" | "password_reset"
    expires_at: Mapped[datetime] = Column(DateTime(timezone=True), nullable=False)
    used: Mapped[Optional[bool]] = Column(Boolean, default=False)
    created_at: Mapped[Optional[datetime]] = Column(
        DateTime(timezone=True), server_default=func.now()
    )
