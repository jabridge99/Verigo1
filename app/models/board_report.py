"""
Board & Executive Reporting — AML/CTF compliance report management.

Report types:
  board_aml          — Quarterly Board AML/CTF Report
  quarterly_compliance — Detailed Quarterly Compliance Report
  risk_committee     — Risk Committee Report
  annual_aml         — Annual AML/CTF Program Report

Report lifecycle:
  draft → under_review → approved → distributed → archived

Reports are generated on demand (snapshot), stored as structured JSON,
and can be exported to PDF-ready HTML.

DISCLAIMER: These reports are generated from workflow data only.
The reporting entity is responsible for the accuracy and completeness
of all compliance reports presented to its Board and management.
"""

import enum
from datetime import date, datetime
from typing import Any, Optional
from uuid import uuid4

from sqlalchemy import (
    JSON,
    Boolean,
    Column,
    Date,
    DateTime,
    Enum,
    ForeignKey,
    Integer,
    String,
    Text,
    func,
)
from sqlalchemy.orm import Mapped

from app.db.database import Base


class BoardReportType(str, enum.Enum):
    board_aml = "board_aml"  # Quarterly Board AML Report
    quarterly_compliance = "quarterly_compliance"  # Detailed Quarterly Compliance
    risk_committee = "risk_committee"  # Risk Committee Report
    annual_aml = "annual_aml"  # Annual AML Program Report


class BoardReportStatus(str, enum.Enum):
    draft = "draft"
    under_review = "under_review"
    approved = "approved"
    distributed = "distributed"
    archived = "archived"


class ReportPeriod(str, enum.Enum):
    q1 = "q1"  # Jan–Mar
    q2 = "q2"  # Apr–Jun
    q3 = "q3"  # Jul–Sep
    q4 = "q4"  # Oct–Dec
    h1 = "h1"  # Jan–Jun (half year)
    h2 = "h2"  # Jul–Dec
    annual = "annual"
    custom = "custom"


class BoardReport(Base):
    """
    A generated Board/Executive compliance report.
    Stores a structured JSON snapshot of compliance data at generation time.
    """

    __tablename__ = "board_reports"

    id: Mapped[str] = Column(
        String, primary_key=True, default=lambda: f"br_{uuid4().hex[:12]}"
    )
    report_ref: Mapped[str] = Column(
        String(30), unique=True, nullable=False, index=True
    )  # BR-2026-Q1-001
    org_id: Mapped[str] = Column(
        String,
        ForeignKey("organisations.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )

    report_type: Mapped[BoardReportType] = Column(Enum(BoardReportType), nullable=False)
    status: Mapped[BoardReportStatus] = Column(
        Enum(BoardReportStatus),
        default=BoardReportStatus.draft,
        nullable=False,
        index=True,
    )
    period: Mapped[ReportPeriod] = Column(Enum(ReportPeriod), nullable=False)

    # ── Report period ─────────────────────────────────────────────────────────
    period_start: Mapped[date] = Column(Date, nullable=False)
    period_end: Mapped[date] = Column(Date, nullable=False)
    report_year: Mapped[int] = Column(Integer, nullable=False)

    # ── Content ───────────────────────────────────────────────────────────────
    title: Mapped[str] = Column(String(500), nullable=False)
    executive_summary: Mapped[Optional[str]] = Column(
        Text
    )  # MLRO / compliance officer narrative
    mlro_commentary: Mapped[Optional[str]] = Column(Text)  # MLRO sign-off commentary
    key_messages: Mapped[Optional[Any]] = Column(
        JSON, default=list
    )  # Bullet points for exec summary

    # ── Snapshot data (generated at creation time) ────────────────────────────
    snapshot_data: Mapped[Optional[Any]] = Column(
        JSON, default=dict
    )  # Full structured report payload
    generated_at: Mapped[Optional[datetime]] = Column(DateTime(timezone=True))
    generated_by: Mapped[Optional[str]] = Column(String)

    # ── Review & Approval ─────────────────────────────────────────────────────
    reviewed_by: Mapped[Optional[str]] = Column(String)
    reviewed_at: Mapped[Optional[datetime]] = Column(DateTime(timezone=True))
    review_notes: Mapped[Optional[str]] = Column(Text)

    approved_by: Mapped[Optional[str]] = Column(String)
    approved_at: Mapped[Optional[datetime]] = Column(DateTime(timezone=True))
    approval_notes: Mapped[Optional[str]] = Column(Text)

    # ── Distribution ──────────────────────────────────────────────────────────
    distributed_to: Mapped[Optional[Any]] = Column(
        JSON, default=list
    )  # ["Board", "Audit Committee", "CEO"]
    distributed_at: Mapped[Optional[datetime]] = Column(DateTime(timezone=True))
    distributed_by: Mapped[Optional[str]] = Column(String)
    distribution_notes: Mapped[Optional[str]] = Column(Text)

    # ── Board response ────────────────────────────────────────────────────────
    board_minutes_ref: Mapped[Optional[str]] = Column(
        String(200)
    )  # Reference to board minutes where noted
    board_resolution: Mapped[Optional[str]] = Column(
        Text
    )  # Board resolution or direction

    # ── Metadata ──────────────────────────────────────────────────────────────
    is_confidential: Mapped[Optional[bool]] = Column(Boolean, default=True)
    version: Mapped[Optional[int]] = Column(Integer, default=1)
    supersedes_id: Mapped[Optional[str]] = Column(
        String, nullable=True
    )  # Previous version

    created_by: Mapped[str] = Column(String, nullable=False)
    created_at: Mapped[Optional[datetime]] = Column(
        DateTime(timezone=True), server_default=func.now()
    )
    updated_at: Mapped[Optional[datetime]] = Column(
        DateTime(timezone=True), onupdate=func.now()
    )
