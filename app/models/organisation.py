"""
Phase B — multi-tenant Organisation hierarchy.

    Organisation
        OrganisationUser (membership + role)
            Role
                RolePermission -> Permission

An Organisation is a customer's company (e.g. "ABC Remittance"). It is
distinct from IndustryTenant (app/models/tenant.py), which represents an
industry-wide compliance pack/branding configuration that an Organisation
opts into via `industry_id`.

Permission/Role are global catalog tables seeded at startup; Role rows with
organisation_id = NULL are system roles available to every organisation,
custom org-specific roles have organisation_id set.
"""

import enum
import uuid

from sqlalchemy import (
    JSON,
    Boolean,
    Column,
    DateTime,
    Enum,
    ForeignKey,
    Integer,
    String,
    Table,
    UniqueConstraint,
)
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func

from app.db.database import Base


class OrgStatus(str, enum.Enum):
    active = "active"
    suspended = "suspended"
    trial = "trial"


class RiskProfile(str, enum.Enum):
    low = "low"
    standard = "standard"
    high = "high"


class MembershipStatus(str, enum.Enum):
    active = "active"
    invited = "invited"
    suspended = "suspended"


class Organisation(Base):
    __tablename__ = "organisations"

    id = Column(Integer, primary_key=True, index=True)
    org_id = Column(String(60), unique=True, index=True, nullable=False)
    name = Column(String(200), nullable=False)
    slug = Column(String(100), unique=True, index=True, nullable=False)
    industry_id = Column(String(100), index=True)  # links to an IndustryTenant pack
    risk_profile = Column(Enum(RiskProfile))  # set during self-service sign-up
    status = Column(Enum(OrgStatus), default=OrgStatus.trial)
    # Phase D — onboarding wizard company/compliance details
    abn = Column(String(20))
    business_address = Column(String(300))
    phone = Column(String(50))
    compliance_officer_name = Column(String(200))
    compliance_officer_email = Column(String(200))
    # Phase I — onboarding risk assessment + AML accountability sign-off
    risk_assessment = Column(JSON)
    risk_assessment_generated_at = Column(DateTime(timezone=True))
    aml_accountability_ack = Column(Boolean, default=False)
    aml_accountability_ack_at = Column(DateTime(timezone=True))
    aml_accountability_ack_by = Column(String(200))
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())


class Permission(Base):
    """Static catalog of permission codes, e.g. 'customers:read'."""

    __tablename__ = "permissions"

    id = Column(Integer, primary_key=True, index=True)
    code = Column(String(100), unique=True, index=True, nullable=False)
    description = Column(String(300))


role_permissions = Table(
    "role_permissions",
    Base.metadata,
    Column("role_id", Integer, ForeignKey("roles.id"), primary_key=True),
    Column("permission_id", Integer, ForeignKey("permissions.id"), primary_key=True),
)


class Role(Base):
    __tablename__ = "roles"

    id = Column(Integer, primary_key=True, index=True)
    role_id = Column(String(60), unique=True, index=True, nullable=False)
    # NULL organisation_id = system role, usable by every organisation
    organisation_id = Column(Integer, ForeignKey("organisations.id"), index=True)
    name = Column(String(100), nullable=False)
    description = Column(String(300))
    is_system = Column(Boolean, default=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    permissions = relationship("Permission", secondary=role_permissions)


class OrganisationUser(Base):
    """Membership of a User within an Organisation, with an assigned Role."""

    __tablename__ = "organisation_users"
    __table_args__ = (UniqueConstraint("organisation_id", "user_id", name="uq_org_user"),)

    id = Column(Integer, primary_key=True, index=True)
    organisation_id = Column(Integer, ForeignKey("organisations.id"), nullable=False, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False, index=True)
    role_id = Column(Integer, ForeignKey("roles.id"), nullable=False)
    status = Column(Enum(MembershipStatus), default=MembershipStatus.active)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())


def new_org_id() -> str:
    return f"ORG-{uuid.uuid4().hex[:10].upper()}"


def new_role_id() -> str:
    return f"ROLE-{uuid.uuid4().hex[:10].upper()}"
