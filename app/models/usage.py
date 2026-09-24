"""
Metered usage events for pay-per-use third-party checks (e.g. Sumsub KYC/KYB).
One row per billable provider call. Immutable once created — to correct a
charge, create a reversing record rather than editing in place.
"""

import enum
from datetime import datetime
from typing import Optional
from uuid import uuid4

from sqlalchemy import Boolean, Column, DateTime, Enum, Float, String, func
from sqlalchemy.orm import Mapped

from app.db.database import Base


class UsageEventType(str, enum.Enum):
    identity_verification = "identity_verification"  # KYC document + selfie check
    business_verification = "business_verification"  # KYB
    address_verification = "address_verification"
    sanctions_screening = "sanctions_screening"
    other = "other"


class UsageRecordStatus(str, enum.Enum):
    pending = "pending"  # provider call made, awaiting webhook/result
    completed = "completed"  # billable — result received
    failed = "failed"  # provider error — not billed
    voided = "voided"  # manually reversed/credited


class UsageRecord(Base):
    """A single billable provider call. `unit_cost_aud` is what we pay the
    vendor; `billed_amount_aud` is what we charge the tenant (cost + markup).
    Aggregated into an Invoice line item once `invoice_id` is set."""

    __tablename__ = "usage_records"

    id: Mapped[str] = Column(
        String, primary_key=True, default=lambda: f"usage_{uuid4().hex[:14]}"
    )
    org_id: Mapped[str] = Column(String, nullable=False, index=True)
    customer_id: Mapped[Optional[str]] = Column(
        String, index=True
    )  # the end-customer being verified, if applicable

    event_type: Mapped[UsageEventType] = Column(
        Enum(UsageEventType), nullable=False, index=True
    )
    provider: Mapped[str] = Column(String(50), nullable=False)  # e.g. "sumsub"
    provider_reference: Mapped[Optional[str]] = Column(
        String(255), index=True
    )  # applicantId / inspectionId

    status: Mapped[UsageRecordStatus] = Column(
        Enum(UsageRecordStatus),
        default=UsageRecordStatus.pending,
        nullable=False,
        index=True,
    )

    unit_cost_aud: Mapped[float] = Column(Float, nullable=False)
    markup_pct: Mapped[float] = Column(Float, nullable=False, default=0.0)
    billed_amount_aud: Mapped[float] = Column(Float, nullable=False)

    invoiced: Mapped[Optional[bool]] = Column(Boolean, default=False, index=True)
    invoice_id: Mapped[Optional[str]] = Column(String(60), index=True)
    invoiced_at: Mapped[Optional[datetime]] = Column(DateTime(timezone=True))

    created_at: Mapped[Optional[datetime]] = Column(
        DateTime(timezone=True), server_default=func.now(), index=True
    )
