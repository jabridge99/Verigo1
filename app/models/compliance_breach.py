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

    id = Column(String, primary_key=True, default=lambda: f"cb_{uuid4().hex[:12]}")
    org_id = Column(
        String,
        ForeignKey("organisations.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )

    title = Column(String(500), nullable=False)
    description = Column(Text, nullable=False)
    severity = Column(Enum(BreachSeverity), nullable=False, index=True)
    status = Column(
        Enum(BreachStatus), default=BreachStatus.open, nullable=False, index=True
    )

    identified_date = Column(Date, nullable=False, index=True)
    identified_by = Column(String, ForeignKey("users.id", ondelete="SET NULL"))

    # Optional provenance -- set only when a formal review/test actually
    # surfaced this breach, rather than it being self-identified.
    source_review_id = Column(
        String, ForeignKey("independent_reviews.id", ondelete="SET NULL")
    )
    source_control_test_id = Column(
        String, ForeignKey("control_tests.id", ondelete="SET NULL")
    )

    # ── AUSTRAC notification ──────────────────────────────────────────────────
    reported_to_austrac = Column(Boolean, default=False)
    austrac_reference = Column(String(100))
    austrac_reported_at = Column(DateTime(timezone=True))

    # ── Remediation ────────────────────────────────────────────────────────────
    remediation_notes = Column(Text)
    remediated_date = Column(Date)
    closed_by = Column(String, ForeignKey("users.id", ondelete="SET NULL"))
    closed_at = Column(DateTime(timezone=True))

    created_by = Column(String, nullable=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())
