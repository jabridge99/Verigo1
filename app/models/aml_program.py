"""
Phase C — Self-service sign-up: auto-generated AML/CTF program.

When an Organisation has chosen an industry and risk profile, an
AMLProgram is generated from app/services/aml_program_service.py
templates: a versioned set of AMLProgramItem control obligations
(policy, training, screening, reporting, review cadence) the
organisation must operationalise. Regenerating bumps the version and
replaces the item set.
"""

import enum

from sqlalchemy import Boolean, Column, DateTime, Enum, ForeignKey, Integer, String, Text
from sqlalchemy.sql import func

from app.db.database import Base


class AMLProgramStatus(str, enum.Enum):
    draft = "draft"
    active = "active"


class AMLProgram(Base):
    __tablename__ = "aml_programs"

    id = Column(Integer, primary_key=True, index=True)
    program_id = Column(String(60), unique=True, index=True, nullable=False)
    organisation_id = Column(
        Integer, ForeignKey("organisations.id"), unique=True, index=True, nullable=False
    )
    industry_id = Column(String(100), nullable=False)
    risk_profile = Column(String(20), nullable=False)
    status = Column(Enum(AMLProgramStatus), default=AMLProgramStatus.active)
    version = Column(Integer, default=1)
    generated_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())


class AMLProgramItem(Base):
    __tablename__ = "aml_program_items"

    id = Column(Integer, primary_key=True, index=True)
    program_id = Column(Integer, ForeignKey("aml_programs.id"), index=True, nullable=False)
    category = Column(String(50), nullable=False)  # governance | kyc | monitoring | reporting | training
    title = Column(String(200), nullable=False)
    description = Column(Text)
    review_frequency = Column(String(50))  # e.g. "annual", "quarterly", "monthly"
    is_required = Column(Boolean, default=True)
    sort_order = Column(Integer, default=0)
