import enum

from sqlalchemy import Column, DateTime, Enum, Float, Integer, String, Text
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func

from app.db.database import Base


class IndustryType(str, enum.Enum):
    # Tranche 1 — self-serve
    remittance = "remittance"
    vasp = "vasp"
    bullion_dealers = "bullion_dealers"
    # Tranche 2 — self-serve
    accountants = "accountants"
    conveyancers = "conveyancers"
    legal_professionals = "legal_professionals"
    real_estate = "real_estate"
    precious_metals = "precious_metals"
    pubs_clubs = "pubs_clubs"
    # Tranche 1 — custom package only
    banking = "banking"
    bookmakers_betting = "bookmakers_betting"
    casinos = "casinos"
    financial_services = "financial_services"
    superannuation = "superannuation"
    # Structural (not a standalone industry type)
    other = "other"


CUSTOM_PACKAGE_INDUSTRIES: frozenset = frozenset({
    IndustryType.banking,
    IndustryType.bookmakers_betting,
    IndustryType.casinos,
    IndustryType.financial_services,
    IndustryType.superannuation,
})


class CustomerStatus(str, enum.Enum):
    pending = "pending"
    kyc_in_progress = "kyc_in_progress"
    kyc_approved = "kyc_approved"
    kyc_rejected = "kyc_rejected"
    active = "active"
    suspended = "suspended"
    closed = "closed"


class RiskLevel(str, enum.Enum):
    low = "low"
    medium = "medium"
    high = "high"
    critical = "critical"


class Customer(Base):
    __tablename__ = "customers"

    id = Column(Integer, primary_key=True, index=True)
    customer_id = Column(String(50), unique=True, index=True, nullable=False)
    full_name = Column(String(200), nullable=False)
    date_of_birth = Column(String(20), nullable=False)
    nationality = Column(String(100), nullable=False)
    country_of_residence = Column(String(100), nullable=False)
    id_number = Column(String(100), nullable=False)
    id_type = Column(String(50), nullable=False)
    address = Column(Text, nullable=False)
    email = Column(String(200), unique=True, nullable=False)
    phone = Column(String(50), nullable=False)
    industry = Column(Enum(IndustryType), nullable=False)
    occupation = Column(String(200))
    source_of_funds = Column(String(200))
    status = Column(Enum(CustomerStatus), default=CustomerStatus.pending)
    risk_level = Column(Enum(RiskLevel), default=RiskLevel.low)
    risk_score = Column(Float, default=0.0)
    is_pep = Column(Integer, default=0)
    industry_id = Column(String(60), index=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())

    kyc_records = relationship("KYCRecord", back_populates="customer")
    transactions = relationship("Transaction", back_populates="customer")
    reports = relationship("ComplianceReport", back_populates="customer")
    ecdd_records = relationship("ECDDRecord", back_populates="customer")
