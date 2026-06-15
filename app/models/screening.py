import enum
from uuid import uuid4
from sqlalchemy import Column, String, Enum, DateTime, Float, Text, JSON, ForeignKey, func
from app.db.database import Base


class ScreeningStatus(str, enum.Enum):
    pending = "pending"
    clear = "clear"
    potential_match = "potential_match"
    confirmed_match = "confirmed_match"
    false_positive = "false_positive"


class ScreeningEntityType(str, enum.Enum):
    customer = "customer"
    beneficial_owner = "beneficial_owner"


class PEPScreening(Base):
    __tablename__ = "pep_screenings"

    id = Column(String, primary_key=True, default=lambda: f"pep_{uuid4().hex[:12]}")
    org_id = Column(String, ForeignKey("organisations.id", ondelete="CASCADE"), nullable=False, index=True)
    entity_type = Column(Enum(ScreeningEntityType), nullable=False)
    entity_id = Column(String, nullable=False, index=True)

    screened_by = Column(String)
    screened_at = Column(DateTime(timezone=True), server_default=func.now())

    status = Column(Enum(ScreeningStatus), default=ScreeningStatus.pending, nullable=False)
    match_score = Column(Float)
    match_details = Column(JSON)
    pep_category = Column(String(100))
    pep_country = Column(String(2))
    pep_position = Column(String(255))

    reviewed_by = Column(String)
    reviewed_at = Column(DateTime(timezone=True))
    reviewer_notes = Column(Text)

    data_source = Column(String(100), default="internal")
    raw_response = Column(JSON)

    created_at = Column(DateTime(timezone=True), server_default=func.now())


class SanctionsScreening(Base):
    __tablename__ = "sanctions_screenings"

    id = Column(String, primary_key=True, default=lambda: f"sanc_{uuid4().hex[:12]}")
    org_id = Column(String, ForeignKey("organisations.id", ondelete="CASCADE"), nullable=False, index=True)
    entity_type = Column(Enum(ScreeningEntityType), nullable=False)
    entity_id = Column(String, nullable=False, index=True)

    screened_by = Column(String)
    screened_at = Column(DateTime(timezone=True), server_default=func.now())

    status = Column(Enum(ScreeningStatus), default=ScreeningStatus.pending, nullable=False)
    match_score = Column(Float)
    match_details = Column(JSON)
    lists_checked = Column(JSON)

    reviewed_by = Column(String)
    reviewed_at = Column(DateTime(timezone=True))
    reviewer_notes = Column(Text)

    data_source = Column(String(100), default="internal")
    raw_response = Column(JSON)

    created_at = Column(DateTime(timezone=True), server_default=func.now())
