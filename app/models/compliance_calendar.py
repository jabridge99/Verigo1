"""
Compliance Calendar — scheduled compliance obligations and review cycles.

Covers:
  - Customer risk reviews (CDD/EDD renewals, KYC/KYB refresh)
  - Policy reviews and approvals
  - Control testing schedules
  - Staff training expiry
  - AUSTRAC reporting deadlines
  - AML/CTF Program reviews

Review frequency by risk level:
  low    = 36 months
  medium = 24 months
  high   = 12 months
  PEP    = 12 months

Reminder escalation chain: 30d → 14d → 7d → due date → overdue
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
    Index,
    Integer,
    String,
    Text,
    func,
)
from sqlalchemy.orm import relationship

from app.db.database import Base


class CalendarItemType(str, enum.Enum):
    customer_review = "customer_review"  # periodic CDD/EDD/KYC renewal
    kyc_expiry = "kyc_expiry"  # ID document expiry
    edd_review = "edd_review"  # enhanced due diligence refresh
    policy_review = "policy_review"  # AML/CTF policy annual review
    control_test = "control_test"  # control effectiveness test
    training_expiry = "training_expiry"  # staff AML training renewal
    ttr_deadline = "ttr_deadline"  # statutory TTR lodgement deadline
    ifti_deadline = "ifti_deadline"  # statutory IFTI lodgement deadline
    smr_deadline = "smr_deadline"  # statutory SMR lodgement deadline
    aml_program_review = "aml_program_review"  # annual AML/CTF program review
    risk_assessment_review = "risk_assessment_review"  # ML/TF risk assessment review
    independent_review = "independent_review"  # independent/external program review
    high_risk_customer_review = "high_risk_customer_review"  # high-risk/PEP review cycle
    austrac_obligation = "austrac_obligation"  # general AUSTRAC regulatory obligation
    board_reporting = "board_reporting"  # scheduled board compliance report
    credential_expiry = "credential_expiry"  # integration API key/OAuth token expiry
    other = "other"


class CalendarItemStatus(str, enum.Enum):
    scheduled = "scheduled"
    in_progress = "in_progress"
    completed = "completed"
    overdue = "overdue"
    cancelled = "cancelled"
    escalated = "escalated"


class ReminderStage(str, enum.Enum):
    thirty_days = "30_days"
    fourteen_days = "14_days"
    seven_days = "7_days"
    due_date = "due_date"
    overdue = "overdue"


class ComplianceCalendarItem(Base):
    __tablename__ = "compliance_calendar"

    id = Column(String, primary_key=True, default=lambda: f"cal_{uuid4().hex[:12]}")
    org_id = Column(
        String,
        ForeignKey("organisations.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )

    item_type = Column(Enum(CalendarItemType), nullable=False, index=True)
    status = Column(
        Enum(CalendarItemStatus),
        default=CalendarItemStatus.scheduled,
        nullable=False,
        index=True,
    )

    title = Column(String(255), nullable=False)
    description = Column(Text)

    # Linked objects (all optional — one or none applies per item)
    customer_id = Column(String, ForeignKey("customers.id"), nullable=True, index=True)
    report_id = Column(String, nullable=True)  # IFTIReport/TTRReport/SMRReport id
    report_type = Column(
        String(20), nullable=True
    )  # ifti_incoming|ifti_outgoing|ttr|smr
    policy_id = Column(String, nullable=True)
    control_id = Column(String, nullable=True)
    integration_id = Column(String, nullable=True)  # org_integrations.id
    assigned_to = Column(String, nullable=True)  # user_id

    due_date = Column(Date, nullable=False, index=True)
    completed_at = Column(DateTime(timezone=True))
    completed_by = Column(String)
    completion_notes = Column(Text)

    # Recurrence
    is_recurring = Column(Boolean, default=False)
    recurrence_months = Column(Integer)  # e.g. 12, 24, 36
    next_due_date = Column(Date)  # set on completion

    # Escalation
    is_overdue = Column(Boolean, default=False, index=True)
    escalated_to = Column(String)  # user_id of compliance officer
    escalated_at = Column(DateTime(timezone=True))

    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())

    organisation = relationship("Organisation")
    customer = relationship("Customer")
    reminders = relationship(
        "ComplianceReminder",
        back_populates="calendar_item",
        cascade="all, delete-orphan",
    )

    __table_args__ = (
        Index("ix_calendar_org_due", "org_id", "due_date"),
        Index("ix_calendar_org_status", "org_id", "status"),
    )


class ComplianceReminder(Base):
    __tablename__ = "compliance_reminders"

    id = Column(String, primary_key=True, default=lambda: f"rem_{uuid4().hex[:12]}")
    org_id = Column(
        String,
        ForeignKey("organisations.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    calendar_item_id = Column(
        String,
        ForeignKey("compliance_calendar.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )

    stage = Column(Enum(ReminderStage), nullable=False)
    recipient_id = Column(String, nullable=False)  # user_id
    recipient_email = Column(String(255))

    sent_at = Column(DateTime(timezone=True))
    is_sent = Column(Boolean, default=False)
    send_failed = Column(Boolean, default=False)
    failure_reason = Column(String(500))

    # Channels (which were used)
    channel_email = Column(Boolean, default=True)
    channel_in_app = Column(Boolean, default=True)
    channel_sms = Column(Boolean, default=False)

    created_at = Column(DateTime(timezone=True), server_default=func.now())

    organisation = relationship("Organisation")
    calendar_item = relationship("ComplianceCalendarItem", back_populates="reminders")
