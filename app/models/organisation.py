import enum
from uuid import uuid4
from sqlalchemy import Column, String, Enum, JSON, DateTime, func
from sqlalchemy.orm import relationship
from app.db.database import Base


class IndustryType(str, enum.Enum):
    """
    Industry types aligned exactly to AUSTRAC's reporting entity categories.
    Source: austrac.gov.au/business/your-industry

    Industries marked CUSTOM_PACKAGE_ONLY are not primary Verigo targets;
    they are offered a tailored engagement rather than a self-serve AML Solution.
    """
    # ── Tranche 1 (pre-existing AML/CTF Act obligations) ─────────────────────
    remittance          = "remittance"           # Remittance service providers
    vasp                = "vasp"                 # Virtual asset service providers
    bullion_dealers     = "bullion_dealers"      # Bullion dealers

    # ── Tranche 2 (commenced 31 March 2026) ───────────────────────────────────
    accountants         = "accountants"          # Accountants
    conveyancers        = "conveyancers"         # Conveyancers
    legal_professionals = "legal_professionals"  # Legal professionals
    real_estate         = "real_estate"          # Real estate agents
    precious_metals     = "precious_metals"      # Dealers in precious metals, stones and products
    pubs_clubs          = "pubs_clubs"           # Pubs and clubs

    # ── Custom package only (not primary Verigo target) ───────────────────────
    banking             = "banking"              # Banking (ADIs)
    bookmakers_betting  = "bookmakers_betting"   # Bookmakers and betting agencies
    casinos             = "casinos"              # Casinos
    financial_services  = "financial_services"   # Financial services providers
    superannuation      = "superannuation"       # Superannuation industry

    other               = "other"                # Other / not listed


# Industries that fall outside Verigo's standard self-serve product.
# The frontend uses this to show a "Contact us for a custom package" flow.
CUSTOM_PACKAGE_INDUSTRIES = frozenset({
    IndustryType.banking,
    IndustryType.bookmakers_betting,
    IndustryType.casinos,
    IndustryType.financial_services,
    IndustryType.superannuation,
})


class OrganisationStatus(str, enum.Enum):
    active = "active"
    suspended = "suspended"
    inactive = "inactive"
    pending = "pending"


class Organisation(Base):
    __tablename__ = "organisations"

    id = Column(String, primary_key=True, default=lambda: f"org_{uuid4().hex[:12]}")
    name = Column(String(255), nullable=False)
    trading_name = Column(String(255))
    abn = Column(String(11), unique=True)
    acn = Column(String(9))
    austrac_id = Column(String(50))
    industry_type = Column(Enum(IndustryType), nullable=False)
    status = Column(Enum(OrganisationStatus), default=OrganisationStatus.active, nullable=False)
    contact_email = Column(String(255))
    contact_phone = Column(String(50))
    address_line1 = Column(String(255))
    address_line2 = Column(String(255))
    city = Column(String(100))
    state = Column(String(50))
    postcode = Column(String(10))
    country = Column(String(2), default="AU")
    subscription_plan = Column(String(50))
    settings = Column(JSON, default=dict)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())

    users = relationship("User", back_populates="organisation", cascade="all, delete-orphan")
    customers = relationship("Customer", back_populates="organisation")
    aml_solution = relationship("AMLSolution", back_populates="organisation", uselist=False)
    transactions = relationship("Transaction", back_populates="organisation")
    cases = relationship("Case", back_populates="organisation")
    audit_logs = relationship("AuditLog", back_populates="organisation")
