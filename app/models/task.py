"""
Task & RFI Workflow Model.

Tracks investigation steps within cases — from requesting source-of-funds
documents through compliance approval to SMR lodgement.

Every status transition creates an immutable TaskEvent.
All completions require explicit human action — never auto-complete.
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
    String,
    Text,
    func,
)
from sqlalchemy.orm import Mapped

from app.db.database import Base


class TaskStatus(str, enum.Enum):
    open = "open"
    in_progress = "in_progress"
    waiting_response = "waiting_response"  # RFI sent, awaiting customer reply
    completed = "completed"
    cancelled = "cancelled"
    overdue = "overdue"


class TaskType(str, enum.Enum):
    request_sof = "request_sof"  # Request Source of Funds docs
    request_sow = "request_sow"  # Request Source of Wealth docs
    request_id = "request_id"  # Request ID documents
    review_evidence = "review_evidence"  # Officer reviews uploaded evidence
    compliance_approval = "compliance_approval"  # Compliance officer sign-off
    mlro_review = "mlro_review"  # MLRO review step
    customer_interview = "customer_interview"  # Schedule/record interview
    verify_document = "verify_document"  # Verify a specific document
    submit_smr = "submit_smr"  # SMR lodgement task
    request_asic_extract = "request_asic_extract"  # Pull ASIC company extract
    internal_review = "internal_review"  # General internal review
    compliance_task = (
        "compliance_task"  # AML/CTF Program obligation — not tied to a case/customer
    )
    other = "other"


class TaskPriority(str, enum.Enum):
    low = "low"
    normal = "normal"
    high = "high"
    urgent = "urgent"


class Task(Base):
    """
    A single workflow step within a case or customer investigation.
    All status changes are logged to TaskEvent (immutable).
    """

    __tablename__ = "tasks"

    id: Mapped[str] = Column(
        String, primary_key=True, default=lambda: f"task_{uuid4().hex[:12]}"
    )
    task_ref: Mapped[str] = Column(String(30), unique=True, nullable=False, index=True)
    org_id: Mapped[str] = Column(
        String,
        ForeignKey("organisations.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    case_id: Mapped[Optional[str]] = Column(
        String, ForeignKey("cases.id", ondelete="SET NULL"), nullable=True, index=True
    )
    customer_id: Mapped[Optional[str]] = Column(
        String,
        ForeignKey("customers.id", ondelete="SET NULL"),
        nullable=True,
        index=True,
    )

    task_type: Mapped[TaskType] = Column(Enum(TaskType), nullable=False)
    status: Mapped[TaskStatus] = Column(
        Enum(TaskStatus), default=TaskStatus.open, nullable=False, index=True
    )
    priority: Mapped[TaskPriority] = Column(
        Enum(TaskPriority), default=TaskPriority.normal, nullable=False
    )

    title: Mapped[str] = Column(String(500), nullable=False)
    description: Mapped[Optional[str]] = Column(Text)

    # ── Assignment ─────────────────────────────────────────────────────────────
    assigned_to: Mapped[Optional[str]] = Column(String)  # user_id
    assigned_by: Mapped[Optional[str]] = Column(String)
    assigned_at: Mapped[Optional[datetime]] = Column(DateTime(timezone=True))

    # ── Deadline ───────────────────────────────────────────────────────────────
    due_date: Mapped[Optional[date]] = Column(Date, index=True)
    is_overdue: Mapped[Optional[bool]] = Column(Boolean, default=False)

    # ── Completion ─────────────────────────────────────────────────────────────
    completed_by: Mapped[Optional[str]] = Column(String)
    completed_at: Mapped[Optional[datetime]] = Column(DateTime(timezone=True))
    completion_notes: Mapped[Optional[str]] = Column(Text)

    # ── Cancellation ───────────────────────────────────────────────────────────
    cancelled_by: Mapped[Optional[str]] = Column(String)
    cancelled_at: Mapped[Optional[datetime]] = Column(DateTime(timezone=True))
    cancellation_reason: Mapped[Optional[str]] = Column(Text)

    # ── RFI (Request for Information) ─────────────────────────────────────────
    rfi_sent_at: Mapped[Optional[datetime]] = Column(DateTime(timezone=True))
    rfi_response_received_at: Mapped[Optional[datetime]] = Column(
        DateTime(timezone=True)
    )
    rfi_channel: Mapped[Optional[str]] = Column(
        String(50)
    )  # email | portal | mail | in_person

    # ── Linked documents ───────────────────────────────────────────────────────
    related_document_ids: Mapped[Optional[Any]] = Column(
        JSON, default=list
    )  # doc_id list

    created_by: Mapped[str] = Column(String, nullable=False)
    created_at: Mapped[Optional[datetime]] = Column(
        DateTime(timezone=True), server_default=func.now()
    )
    updated_at: Mapped[Optional[datetime]] = Column(
        DateTime(timezone=True), onupdate=func.now()
    )


class TaskEvent(Base):
    """
    Immutable audit trail entry for a Task.
    One row per transition — never updated or deleted.
    """

    __tablename__ = "task_events"

    id: Mapped[str] = Column(
        String, primary_key=True, default=lambda: f"tev_{uuid4().hex[:10]}"
    )
    task_id: Mapped[str] = Column(
        String, ForeignKey("tasks.id", ondelete="CASCADE"), nullable=False, index=True
    )
    org_id: Mapped[str] = Column(String, nullable=False)

    event_type: Mapped[str] = Column(String(50), nullable=False)
    # created | assigned | status_changed | completed | cancelled | rfi_sent | rfi_received | note_added
    from_status: Mapped[Optional[str]] = Column(String(50))
    to_status: Mapped[Optional[str]] = Column(String(50))
    actor_id: Mapped[Optional[str]] = Column(String)  # user_id who triggered the event
    note: Mapped[Optional[str]] = Column(Text)

    created_at: Mapped[Optional[datetime]] = Column(
        DateTime(timezone=True), server_default=func.now()
    )
