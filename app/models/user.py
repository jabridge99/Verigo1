import enum
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
    # Nullable: global super-admins (is_super_admin=True) are not
    # tenant-scoped and have no org.
    org_id = Column(
        String,
        ForeignKey("organisations.id", ondelete="CASCADE"),
        nullable=True,
        index=True,
    )
    email = Column(String(255), unique=True, nullable=False, index=True)
    full_name = Column(String(255), nullable=False)
    hashed_password = Column(String(255), nullable=False)
    role = Column(Enum(UserRole), nullable=False, default=UserRole.analyst)
    status = Column(Enum(UserStatus), default=UserStatus.active, nullable=False)
    industry_id = Column(String(100))  # tenant scope
    tenant_id = Column(String(60))
    is_super_admin = Column(
        Boolean, default=False
    )  # global master account, not tenant-scoped
    # Cached default org for single-org login flows. Source of truth for
    # membership/role is OrganisationUser (a user may belong to >1 org).
    # SET NULL (not CASCADE): deleting an org should clear this cached
    # pointer, not delete the user — OrganisationUser remains the source of
    # truth for membership and is cascade-deleted with the org separately.
    primary_organisation_id = Column(
        String, ForeignKey("organisations.id", ondelete="SET NULL")
    )
    mfa_enabled = Column(Boolean, default=False)
    mfa_secret = Column(String(64))
    mfa_verified = Column(Boolean, default=False)
    email_verified = Column(Boolean, default=False)
    oauth_provider = Column(String(20))  # "google" | "microsoft" | None
    oauth_id = Column(String(200))  # provider's unique subject id
    last_login_at = Column(DateTime(timezone=True))
    failed_login_count = Column(Integer, default=0)
    locked_until = Column(DateTime(timezone=True))
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())

    organisation = relationship(
        "Organisation", back_populates="users", foreign_keys=[org_id]
    )


class MagicLinkToken(Base):
    __tablename__ = "magic_link_tokens"

    id = Column(Integer, primary_key=True, autoincrement=True)
    email = Column(String(255), nullable=False, index=True)
    token_hash = Column(String(255), nullable=False, unique=True)
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
