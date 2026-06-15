import enum
from uuid import uuid4
from sqlalchemy import Column, String, Enum, DateTime, Date, Float, Boolean, Text, ForeignKey, func
from sqlalchemy.orm import relationship
from app.db.database import Base


class CustomerType(str, enum.Enum):
    individual = "individual"
    business = "business"
    trust = "trust"
    partnership = "partnership"


class CustomerStatus(str, enum.Enum):
    pending = "pending"
    under_review = "under_review"
    active = "active"
    suspended = "suspended"
    rejected = "rejected"
    closed = "closed"


class RiskLevel(str, enum.Enum):
    low = "low"
    medium = "medium"
    high = "high"
    critical = "critical"


class IDType(str, enum.Enum):
    passport = "passport"
    drivers_licence = "drivers_licence"
    national_id = "national_id"
    medicare = "medicare"
    other = "other"


class Customer(Base):
    __tablename__ = "customers"

    id = Column(String, primary_key=True, default=lambda: f"cust_{uuid4().hex[:12]}")
    org_id = Column(String, ForeignKey("organisations.id", ondelete="CASCADE"), nullable=False, index=True)
    customer_type = Column(Enum(CustomerType), nullable=False, default=CustomerType.individual)
    status = Column(Enum(CustomerStatus), default=CustomerStatus.pending, nullable=False)

    # Individual
    full_name = Column(String(255), nullable=False)
    date_of_birth = Column(Date)
    nationality = Column(String(2))
    country_of_residence = Column(String(2))

    # Business
    business_name = Column(String(255))
    abn = Column(String(11))
    acn = Column(String(9))
    business_structure = Column(String(50))

    # Contact
    email = Column(String(255))
    phone = Column(String(50))

    # Address
    address_line1 = Column(String(255))
    address_line2 = Column(String(255))
    city = Column(String(100))
    state = Column(String(50))
    postcode = Column(String(10))
    country = Column(String(2), default="AU")

    # Identity document
    id_type = Column(Enum(IDType))
    id_number = Column(String(50))
    id_expiry = Column(Date)
    id_issuing_country = Column(String(2))

    # AML
    occupation = Column(String(255))
    industry = Column(String(100))
    source_of_funds = Column(String(500))
    source_of_wealth = Column(String(500))
    risk_level = Column(Enum(RiskLevel), default=RiskLevel.low)
    risk_score = Column(Float, default=0.0)
    is_pep = Column(Boolean, default=False)
    pep_details = Column(Text)

    onboarded_by = Column(String)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())

    organisation = relationship("Organisation", back_populates="customers")
    beneficial_owners = relationship("BeneficialOwner", back_populates="customer", cascade="all, delete-orphan")
    transactions = relationship("Transaction", back_populates="customer")
    cases = relationship("Case", back_populates="customer")
