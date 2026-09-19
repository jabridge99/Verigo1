import enum
from datetime import datetime
from typing import Any, Optional
from uuid import uuid4

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
    func,
)
from sqlalchemy.orm import Mapped, relationship

from app.db.database import Base


class IndustryType(str, enum.Enum):
    """
    Industry types aligned exactly to AUSTRAC's reporting entity categories.
    Source: austrac.gov.au/business/your-industry

    Industries marked CUSTOM_PACKAGE_ONLY are not primary Verigo targets;
    they are offered a tailored engagement rather than a self-serve AML Solution.
    """

    # ── Tranche 1 (pre-existing AML/CTF Act obligations) ─────────────────────
    remittance = "remittance"  # Remittance service providers
    vasp = "vasp"  # Virtual asset service providers
    bullion_dealers = "bullion_dealers"  # Bullion dealers

    # ── Tranche 2 (commenced 1 July 2026; AUSTRAC enrolment deadline 31 March 2026) ──
    accountants = "accountants"  # Accountants
    conveyancers = "conveyancers"  # Conveyancers
    legal_professionals = "legal_professionals"  # Legal professionals
    real_estate = "real_estate"  # Real estate agents
    precious_metals = (
        "precious_metals"  # Dealers in precious metals, stones and products
    )
    pubs_clubs = "pubs_clubs"  # Pubs and clubs

    # ── Custom package only (not primary Verigo target) ───────────────────────
    banking = "banking"  # Banking (ADIs)
    bookmakers_betting = "bookmakers_betting"  # Bookmakers and betting agencies
    casinos = "casinos"  # Casinos
    financial_services = "financial_services"  # Financial services providers
    superannuation = "superannuation"  # Superannuation industry

    other = "other"  # Other / not listed


# Industries that fall outside Verigo's standard self-serve product.
# The frontend uses this to show a "Contact us for a custom package" flow.
CUSTOM_PACKAGE_INDUSTRIES = frozenset(
    {
        IndustryType.banking,
        IndustryType.bookmakers_betting,
        IndustryType.casinos,
        IndustryType.financial_services,
        IndustryType.superannuation,
    }
)


class OrganisationStatus(str, enum.Enum):
    active = "active"
    suspended = "suspended"
    inactive = "inactive"
    pending = "pending"


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

    id: Mapped[str] = Column(
        String, primary_key=True, default=lambda: f"org_{uuid4().hex[:12]}"
    )
    name: Mapped[str] = Column(String(255), nullable=False)
    trading_name: Mapped[Optional[str]] = Column(String(255))
    # 20, not 11: the API accepts and round-trips the human-formatted ABN
    # ("XX XXX XXX XXX", 14 chars) as entered, not just the 11 raw digits.
    abn: Mapped[Optional[str]] = Column(String(20), unique=True)
    acn: Mapped[Optional[str]] = Column(String(9))
    austrac_id: Mapped[Optional[str]] = Column(String(50))
    industry_type: Mapped[IndustryType] = Column(Enum(IndustryType), nullable=False)
    industry_id: Mapped[Optional[str]] = Column(
        String(100), index=True
    )  # links to an IndustryTenant pack
    risk_profile: Mapped[Optional[RiskProfile]] = Column(
        Enum(RiskProfile)
    )  # set during self-service sign-up
    status: Mapped[OrganisationStatus] = Column(
        Enum(OrganisationStatus), default=OrganisationStatus.active, nullable=False
    )
    contact_email: Mapped[Optional[str]] = Column(String(255))
    contact_phone: Mapped[Optional[str]] = Column(String(50))
    address_line1: Mapped[Optional[str]] = Column(String(255))
    address_line2: Mapped[Optional[str]] = Column(String(255))
    city: Mapped[Optional[str]] = Column(String(100))
    state: Mapped[Optional[str]] = Column(String(50))
    postcode: Mapped[Optional[str]] = Column(String(10))
    country: Mapped[Optional[str]] = Column(String(2), default="AU")
    subscription_plan: Mapped[Optional[str]] = Column(String(50))
    settings: Mapped[Optional[Any]] = Column(JSON, default=dict)
    # Phase D — onboarding wizard company/compliance details
    business_address: Mapped[Optional[str]] = Column(String(300))
    phone: Mapped[Optional[str]] = Column(String(50))
    compliance_officer_name: Mapped[Optional[str]] = Column(String(200))
    compliance_officer_email: Mapped[Optional[str]] = Column(String(200))
    # Phase I — onboarding risk assessment + AML accountability sign-off
    risk_assessment: Mapped[Optional[Any]] = Column(JSON)
    risk_assessment_generated_at: Mapped[Optional[datetime]] = Column(
        DateTime(timezone=True)
    )
    aml_accountability_ack: Mapped[Optional[bool]] = Column(Boolean, default=False)
    aml_accountability_ack_at: Mapped[Optional[datetime]] = Column(
        DateTime(timezone=True)
    )
    aml_accountability_ack_by: Mapped[Optional[str]] = Column(String(200))
    # Retention / IP terms-of-use acceptance — tied to the same onboarding
    # checkbox as the accountability acknowledgement (see Phase I).
    retention_terms_accepted: Mapped[Optional[bool]] = Column(Boolean, default=False)
    retention_terms_accepted_at: Mapped[Optional[datetime]] = Column(
        DateTime(timezone=True)
    )
    retention_terms_accepted_by: Mapped[Optional[str]] = Column(String(200))
    retention_terms_version: Mapped[Optional[str]] = Column(String(20))
    created_at: Mapped[Optional[datetime]] = Column(
        DateTime(timezone=True), server_default=func.now()
    )
    updated_at: Mapped[Optional[datetime]] = Column(
        DateTime(timezone=True), onupdate=func.now()
    )

    users = relationship(
        "User",
        back_populates="organisation",
        cascade="all, delete-orphan",
        foreign_keys="User.org_id",
    )
    customers = relationship("Customer", back_populates="organisation")
    aml_solution = relationship(
        "AMLSolution", back_populates="organisation", uselist=False
    )
    transactions = relationship("Transaction", back_populates="organisation")
    cases = relationship("Case", back_populates="organisation")
    audit_logs = relationship("AuditLog", back_populates="organisation")


class Permission(Base):
    """Static catalog of permission codes, e.g. 'customers:read'."""

    __tablename__ = "permissions"

    id: Mapped[int] = Column(Integer, primary_key=True, index=True)
    code: Mapped[str] = Column(String(100), unique=True, index=True, nullable=False)
    description: Mapped[Optional[str]] = Column(String(300))


role_permissions = Table(
    "role_permissions",
    Base.metadata,
    Column("role_id", Integer, ForeignKey("roles.id"), primary_key=True),
    Column("permission_id", Integer, ForeignKey("permissions.id"), primary_key=True),
)


class Role(Base):
    __tablename__ = "roles"

    id: Mapped[int] = Column(Integer, primary_key=True, index=True)
    role_id: Mapped[str] = Column(String(60), unique=True, index=True, nullable=False)
    # NULL organisation_id = system role, usable by every organisation
    organisation_id: Mapped[Optional[str]] = Column(
        String, ForeignKey("organisations.id", ondelete="CASCADE"), index=True
    )
    name: Mapped[str] = Column(String(100), nullable=False)
    description: Mapped[Optional[str]] = Column(String(300))
    is_system: Mapped[Optional[bool]] = Column(Boolean, default=False)
    created_at: Mapped[Optional[datetime]] = Column(
        DateTime(timezone=True), server_default=func.now()
    )

    permissions: Mapped[list["Permission"]] = relationship(
        "Permission", secondary=role_permissions
    )


class OrganisationUser(Base):
    """Membership of a User within an Organisation, with an assigned Role."""

    __tablename__ = "organisation_users"
    __table_args__ = (
        UniqueConstraint("organisation_id", "user_id", name="uq_org_user"),
    )

    id: Mapped[int] = Column(Integer, primary_key=True, index=True)
    organisation_id: Mapped[str] = Column(
        String,
        ForeignKey("organisations.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    user_id: Mapped[str] = Column(
        String, ForeignKey("users.id"), nullable=False, index=True
    )
    role_id: Mapped[int] = Column(Integer, ForeignKey("roles.id"), nullable=False)
    status: Mapped[Optional[MembershipStatus]] = Column(
        Enum(MembershipStatus), default=MembershipStatus.active
    )
    created_at: Mapped[Optional[datetime]] = Column(
        DateTime(timezone=True), server_default=func.now()
    )
    updated_at: Mapped[Optional[datetime]] = Column(
        DateTime(timezone=True), onupdate=func.now()
    )


def new_role_id() -> str:
    from uuid import uuid4 as _uuid4

    return f"ROLE-{_uuid4().hex[:10].upper()}"
