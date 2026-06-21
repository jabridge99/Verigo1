"""
Phase C — Self-service sign-up: auto-generated AML/CTF program.

When an Organisation has chosen an industry and risk profile, an
AMLProgramRecord is generated from app/services/aml_program_service.py
templates: a versioned set of AMLProgramItem control obligations
(policy, training, screening, reporting, review cadence) the
organisation must operationalise. Regenerating bumps the version and
replaces the item set.
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
    Text,
)
from sqlalchemy.sql import func

from app.db.database import Base


class AMLProgramStatus(str, enum.Enum):
    draft = "draft"
    active = "active"


class AMLProgramRecord(Base):
    __tablename__ = "aml_program_records"

    id = Column(Integer, primary_key=True, index=True)
    program_id = Column(String(60), unique=True, index=True, nullable=False)
    organisation_id = Column(
        String, ForeignKey("organisations.id", ondelete="CASCADE"), unique=True, index=True, nullable=False
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
    program_id = Column(
        Integer, ForeignKey("aml_program_records.id"), index=True, nullable=False
    )
    category = Column(
        String(50), nullable=False
    )  # governance | kyc | monitoring | reporting | training
    title = Column(String(200), nullable=False)
    description = Column(Text)
    review_frequency = Column(String(50))  # e.g. "annual", "quarterly", "monthly"
    is_required = Column(Boolean, default=True)
    sort_order = Column(Integer, default=0)


# ── Retention — Verigo's record-of-truth versioning ─────────────────────────
# Every regeneration is snapshotted here (never deleted) so Verigo can satisfy
# AUSTRAC's 7-year record-keeping obligation on the customer's behalf, even
# after they cancel. Locked generation: there is no "regenerate from an old
# version" path — only forward, so customers can't game their own history.


class AMLProgramVersion(Base):
    __tablename__ = "aml_program_versions"

    id = Column(Integer, primary_key=True, index=True)
    program_id = Column(
        Integer, ForeignKey("aml_program_records.id"), index=True, nullable=False
    )
    organisation_id = Column(
        String, ForeignKey("organisations.id", ondelete="CASCADE"), index=True, nullable=False
    )
    version = Column(Integer, nullable=False)
    industry_id = Column(String(100), nullable=False)
    risk_profile = Column(String(20), nullable=False)
    items_snapshot = Column(
        JSON, nullable=False
    )  # full item list at time of generation
    item_count = Column(Integer, nullable=False)
    content_hash = Column(String(64), nullable=False)  # sha256 of items_snapshot
    qr_token = Column(String(40), unique=True, index=True, nullable=False)
    generated_at = Column(DateTime(timezone=True), server_default=func.now())


class VersionRetrievalRequest(Base):
    """Throttled admin-mediated retrieval of an old program version for a
    canceled/lapsed organisation — at most one version every 8 hours, and a
    lifetime cap, after which the customer must buy a full export."""

    __tablename__ = "version_retrieval_requests"

    id = Column(Integer, primary_key=True, index=True)
    organisation_id = Column(
        String, ForeignKey("organisations.id", ondelete="CASCADE"), index=True, nullable=False
    )
    version = Column(Integer, nullable=False)
    requested_by = Column(String(200), nullable=False)
    requested_at = Column(DateTime(timezone=True), server_default=func.now())


def new_qr_token() -> str:
    return uuid.uuid4().hex
