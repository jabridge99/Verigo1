"""
AUSTRAC Examination Pack

A consolidated, point-in-time snapshot of everything an AUSTRAC examiner
requests on arrival for a s.167 examination (AML/CTF Act 2006).

Sections included:
  1. aml_program          — AML/CTF program overview and risk assessment status
  2. customer_profile     — risk distribution, PEP/sanctions counts, CDD levels
  3. transaction_monitoring — rules, alert stats, alert→SMR conversion rate
  4. smr_register         — all SMRs filed in the examination period
  5. ifti_register        — all IFTIs and IFTI-Es filed
  6. ttr_register         — all TTRs filed
  7. training_records     — completion rates, overdue, gap analysis
  8. independent_reviews  — review engagements, findings, remediation
  9. policy_register      — all policies, versions, attestation rates
  10. control_testing     — control tests, findings, remediation status
  11. notification_history — evidence that staff were alerted to issues (governance proof)
"""

from __future__ import annotations

import enum
from datetime import date, datetime
from typing import Any, Optional
from uuid import uuid4

from sqlalchemy import JSON, Boolean, Column, Date, DateTime, Enum, String, Text, func
from sqlalchemy.orm import Mapped

from app.db.database import Base


class ExaminationPackStatus(str, enum.Enum):
    draft = "draft"
    generating = "generating"
    ready = "ready"
    delivered = "delivered"
    archived = "archived"


EXAMINATION_SECTIONS = [
    "aml_program",
    "customer_profile",
    "transaction_monitoring",
    "smr_register",
    "ifti_register",
    "ttr_register",
    "training_records",
    "independent_reviews",
    "policy_register",
    "control_testing",
    "notification_history",
]


class ExaminationPack(Base):
    __tablename__ = "examination_packs"

    id: Mapped[str] = Column(
        String, primary_key=True, default=lambda: f"ep_{uuid4().hex[:12]}"
    )
    org_id: Mapped[str] = Column(String, nullable=False, index=True)
    pack_ref: Mapped[str] = Column(String(50), unique=True, nullable=False)
    # e.g. "EXAM-2026-001" — sequential per org

    # ── Examination scope ─────────────────────────────────────────────────────
    period_start: Mapped[date] = Column(Date, nullable=False)
    period_end: Mapped[date] = Column(Date, nullable=False)
    sections: Mapped[Optional[Any]] = Column(
        JSON, default=list
    )  # subset of EXAMINATION_SECTIONS

    # ── Examiner details ──────────────────────────────────────────────────────
    examiner_name: Mapped[Optional[str]] = Column(String(255))
    examiner_agency: Mapped[Optional[str]] = Column(String(100), default="AUSTRAC")
    examination_ref: Mapped[Optional[str]] = Column(
        String(100)
    )  # AUSTRAC's own reference number

    # ── Lifecycle ─────────────────────────────────────────────────────────────
    status: Mapped[ExaminationPackStatus] = Column(
        Enum(ExaminationPackStatus),
        default=ExaminationPackStatus.draft,
        nullable=False,
        index=True,
    )
    requested_by: Mapped[str] = Column(String, nullable=False)
    generated_at: Mapped[Optional[datetime]] = Column(DateTime(timezone=True))
    delivered_at: Mapped[Optional[datetime]] = Column(DateTime(timezone=True))
    delivered_by: Mapped[Optional[str]] = Column(String)
    delivery_notes: Mapped[Optional[str]] = Column(Text)

    # ── Frozen snapshot (JSON) ────────────────────────────────────────────────
    snapshot_data: Mapped[Optional[Any]] = Column(JSON, default=dict)
    # Structure: { "section_name": { ...data... }, ... }
    # Frozen at generation time — never changes after status = ready

    # ── Summary metrics (top-level, for quick display) ────────────────────────
    summary_metrics: Mapped[Optional[Any]] = Column(JSON, default=dict)
    # {
    #   "total_customers": 412,
    #   "high_risk_customers": 18,
    #   "smrs_filed": 3,
    #   "iftis_filed": 241,
    #   "training_completion_pct": 94.2,
    #   "open_ir_findings": 2,
    #   "policies_overdue_review": 1,
    #   ...
    # }

    generation_errors: Mapped[Optional[Any]] = Column(
        JSON, default=list
    )  # any section errors during generation

    is_confidential: Mapped[Optional[bool]] = Column(Boolean, default=True)
    version: Mapped[Optional[str]] = Column(String(10), default="1.0")

    created_at: Mapped[Optional[datetime]] = Column(
        DateTime(timezone=True), server_default=func.now()
    )
    updated_at: Mapped[Optional[datetime]] = Column(
        DateTime(timezone=True), onupdate=func.now()
    )
