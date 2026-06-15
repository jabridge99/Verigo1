import enum
from uuid import uuid4
from sqlalchemy import Column, String, Enum, JSON, DateTime, func
from sqlalchemy.orm import relationship
from app.db.database import Base


class IndustryType(str, enum.Enum):
    banking = "banking"
    fintech = "fintech"
    insurance = "insurance"
    real_estate = "real_estate"
    cryptocurrency = "cryptocurrency"
    remittance = "remittance"
    designated_remittance = "designated_remittance"
    other = "other"


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
