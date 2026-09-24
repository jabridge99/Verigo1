"""
Data Retention Policy model.
Configurable per tenant, per entity type.
AUSTRAC default: 7 years from last transaction; escalate to 10 years for ECDD subjects.
"""

import enum
from datetime import datetime
from typing import Optional

from sqlalchemy import Boolean, Column, DateTime, ForeignKey, Integer, String, Text
from sqlalchemy import Enum as SAEnum
from sqlalchemy.orm import Mapped
from sqlalchemy.sql import func

from app.db.database import Base


class EntityScope(str, enum.Enum):
    customer = "customer"
    kyc_record = "kyc_record"
    document = "document"
    transaction = "transaction"
    audit_log = "audit_log"
    report = "report"


class RetentionPolicy(Base):
    __tablename__ = "retention_policies"

    id: Mapped[int] = Column(Integer, primary_key=True, index=True)
    policy_id: Mapped[str] = Column(String(60), unique=True, index=True, nullable=False)
    industry_id: Mapped[Optional[str]] = Column(
        String(60), index=True, nullable=True
    )  # NULL = global default
    organisation_id: Mapped[Optional[str]] = Column(
        String(36), ForeignKey("organisations.id", ondelete="CASCADE"), index=True
    )
    entity_scope: Mapped[EntityScope] = Column(SAEnum(EntityScope), nullable=False)
    retention_years: Mapped[int] = Column(
        Integer, nullable=False, default=7
    )  # 0 = indefinite
    legal_hold: Mapped[Optional[bool]] = Column(
        Boolean, default=False
    )  # overrides deletion eligibility
    notes: Mapped[Optional[str]] = Column(Text)
    created_at: Mapped[Optional[datetime]] = Column(
        DateTime(timezone=True), server_default=func.now()
    )
    updated_at: Mapped[Optional[datetime]] = Column(
        DateTime(timezone=True), onupdate=func.now()
    )
    created_by: Mapped[Optional[str]] = Column(String(60))


class LegalHold(Base):
    """Individual records placed under legal hold, exempt from deletion."""

    __tablename__ = "legal_holds"

    id: Mapped[int] = Column(Integer, primary_key=True, index=True)
    hold_id: Mapped[str] = Column(String(60), unique=True, index=True, nullable=False)
    industry_id: Mapped[Optional[str]] = Column(String(60), index=True)
    organisation_id: Mapped[Optional[str]] = Column(
        String(36), ForeignKey("organisations.id", ondelete="CASCADE"), index=True
    )
    entity_scope: Mapped[EntityScope] = Column(SAEnum(EntityScope), nullable=False)
    entity_id: Mapped[str] = Column(
        String(60), nullable=False, index=True
    )  # customer_id / doc id etc.
    reason: Mapped[str] = Column(Text, nullable=False)
    held_by: Mapped[Optional[str]] = Column(String(60))  # user_id who placed the hold
    placed_at: Mapped[Optional[datetime]] = Column(
        DateTime(timezone=True), server_default=func.now()
    )
    released_at: Mapped[Optional[datetime]] = Column(DateTime(timezone=True))
    released_by: Mapped[Optional[str]] = Column(String(60))
    active: Mapped[Optional[bool]] = Column(Boolean, default=True, index=True)
