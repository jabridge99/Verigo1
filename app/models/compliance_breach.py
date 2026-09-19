"""
Compliance Breach Tracking — P34.

Standalone log of AML/CTF compliance breaches an org identifies, independent
of whether an independent review or control test happened to surface it
(most are self-identified during BAU, a customer complaint, or a regulator
notification, not every breach traces back to a formal review/test cycle —
that's why this isn't folded into ReviewFinding/ControlTestFinding, which
both require a parent review/test record).

Feeds the CO Quarterly Compliance Report's (VERIGO-GEN-COR) "Breaches
Identified This Quarter" section (see board_reporting_service.py's
_breaches_quarterly_section()).

Lifecycle: open -> remediated -> closed (or risk_accepted, closed without a fix)

DISCLAIMER: This module provides workflow tooling only. All compliance
decisions remain with the reporting entity.
"""

import enum
from datetime import date, datetime
from typing import Optional
from uuid import uuid4

from sqlalchemy import (
    Boolean,
    Column,
    Date,
    DateTime,
    Enum,
    ForeignKey,
    String,
    Text,
    func,
)
from sqlalchemy.orm import Mapped

from app.db.database import Base

# ── Enums ─────────────────────────────────────────────────────────────────────


class BreachSeverity(str, enum.Enum):
    critical = "critical"  # immediate AUSTRAC notification likely required
    high = "high"
    medium = "medium"
    low = "low"


class BreachStatus(str, enum.Enum):
    open = "open"
    remediated = "remediated"
    closed = "closed"
    risk_accepted = (
        "risk_accepted"  # MLRO/Board accepted residual risk, closed without a fix
    )


# ── Compliance Breach ───────────────────────────────────────────────────────────


class ComplianceBreach(Base):
    """
    A single identified AML/CTF compliance breach or control failure --
    e.g. a missed SMR lodgement deadline, a CDD step skipped on a real
    customer, an unauthorised disclosure. Not every breach is reportable to
    AUSTRAC; `reported_to_austrac` records whether this one was.
    """

    __tablename__ = "compliance_breaches"

    id: Mapped[str] = Column(
        String, primary_key=True, default=lambda: f"cb_{uuid4().hex[:12]}"
    )
    org_id: Mapped[str] = Column(
        String,
        ForeignKey("organisations.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )

    title: Mapped[str] = Column(String(500), nullable=False)
    description: Mapped[str] = Column(Text, nullable=False)
    severity: Mapped[BreachSeverity] = Column(
        Enum(BreachSeverity), nullable=False, index=True
    )
    status: Mapped[BreachStatus] = Column(
        Enum(BreachStatus), default=BreachStatus.open, nullable=False, index=True
    )

    identified_date: Mapped[date] = Column(Date, nullable=False, index=True)
    identified_by: Mapped[Optional[str]] = Column(
        String, ForeignKey("users.id", ondelete="SET NULL")
    )

    # Optional provenance -- set only when a formal review/test actually
    # surfaced this breach, rather than it being self-identified.
    source_review_id: Mapped[Optional[str]] = Column(
        String, ForeignKey("independent_reviews.id", ondelete="SET NULL")
    )
    source_control_test_id: Mapped[Optional[str]] = Column(
        String, ForeignKey("control_tests.id", ondelete="SET NULL")
    )

    # ── AUSTRAC notification ──────────────────────────────────────────────────
    reported_to_austrac: Mapped[Optional[bool]] = Column(Boolean, default=False)
    austrac_reference: Mapped[Optional[str]] = Column(String(100))
    austrac_reported_at: Mapped[Optional[datetime]] = Column(DateTime(timezone=True))

    # ── Remediation ────────────────────────────────────────────────────────────
    remediation_notes: Mapped[Optional[str]] = Column(Text)
    remediated_date: Mapped[Optional[date]] = Column(Date)
    closed_by: Mapped[Optional[str]] = Column(
        String, ForeignKey("users.id", ondelete="SET NULL")
    )
    closed_at: Mapped[Optional[datetime]] = Column(DateTime(timezone=True))

    created_by: Mapped[str] = Column(String, nullable=False)
    created_at: Mapped[Optional[datetime]] = Column(
        DateTime(timezone=True), server_default=func.now()
    )
    updated_at: Mapped[Optional[datetime]] = Column(
        DateTime(timezone=True), onupdate=func.now()
    )
