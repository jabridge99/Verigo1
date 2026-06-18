import enum
from uuid import uuid4

from sqlalchemy import (
    Boolean,
    Column,
    Date,
    DateTime,
    Enum,
    Float,
    ForeignKey,
    String,
    Text,
    func,
)
from sqlalchemy.orm import relationship

from app.db.database import Base


class OwnershipType(str, enum.Enum):
    direct = "direct"
    indirect = "indirect"
    beneficial = "beneficial"


class BeneficialOwner(Base):
    __tablename__ = "beneficial_owners"

    id = Column(String, primary_key=True, default=lambda: f"bo_{uuid4().hex[:12]}")
    customer_id = Column(
        String,
        ForeignKey("customers.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    org_id = Column(
        String,
        ForeignKey("organisations.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )

    full_name = Column(String(255), nullable=False)
    date_of_birth = Column(Date)
    nationality = Column(String(2))
    country_of_residence = Column(String(2))

    address_line1 = Column(String(255))
    city = Column(String(100))
    state = Column(String(50))
    postcode = Column(String(10))
    country = Column(String(2), default="AU")

    id_type = Column(String(50))
    id_number = Column(String(50))
    id_expiry = Column(Date)

    ownership_percentage = Column(Float)
    ownership_type = Column(Enum(OwnershipType), default=OwnershipType.direct)
    is_controlling_person = Column(Boolean, default=False)
    role_title = Column(String(100))

    is_pep = Column(Boolean, default=False)
    pep_details = Column(Text)
    source_of_wealth = Column(String(500))
    verified = Column(Boolean, default=False)
    verified_by = Column(String)
    verified_at = Column(DateTime(timezone=True))

    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())

    customer = relationship("Customer", back_populates="beneficial_owners")
