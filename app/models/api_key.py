import enum
from datetime import datetime
from typing import Any, Optional

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
from sqlalchemy.orm import Mapped
from sqlalchemy.sql import func

from app.db.database import Base


class APIKeyStatus(str, enum.Enum):
    active = "active"
    revoked = "revoked"
    expired = "expired"


class WebhookEvent(str, enum.Enum):
    aml_alert_created = "aml_alert.created"
    kyc_status_changed = "kyc.status_changed"
    report_submitted = "report.submitted"
    report_approved = "report.approved"
    case_assigned = "case.assigned"
    case_escalated = "case.escalated"
    customer_created = "customer.created"
    customer_risk_changed = "customer.risk_changed"
    transaction_flagged = "transaction.flagged"


class WebhookStatus(str, enum.Enum):
    active = "active"
    disabled = "disabled"
    failed = "failed"


class APIKey(Base):
    __tablename__ = "api_keys"

    id: Mapped[int] = Column(Integer, primary_key=True, index=True)
    key_id: Mapped[str] = Column(String(60), unique=True, index=True, nullable=False)
    name: Mapped[str] = Column(String(200), nullable=False)
    key_hash: Mapped[str] = Column(String(128), nullable=False)  # SHA-256 of raw key
    key_prefix: Mapped[str] = Column(String(12), nullable=False)  # tvg_live_XXXX
    user_id: Mapped[str] = Column(String(60), nullable=False)
    industry_id: Mapped[Optional[str]] = Column(String(100))
    organisation_id: Mapped[Optional[str]] = Column(
        String(36), ForeignKey("organisations.id", ondelete="CASCADE"), index=True
    )
    status: Mapped[Optional[APIKeyStatus]] = Column(
        Enum(APIKeyStatus), default=APIKeyStatus.active
    )
    scopes: Mapped[Optional[Any]] = Column(
        JSON, default=list
    )  # ["customers:read", ...]
    last_used_at: Mapped[Optional[datetime]] = Column(DateTime(timezone=True))
    expires_at: Mapped[Optional[datetime]] = Column(DateTime(timezone=True))
    created_at: Mapped[Optional[datetime]] = Column(
        DateTime(timezone=True), server_default=func.now()
    )
    revoked_at: Mapped[Optional[datetime]] = Column(DateTime(timezone=True))


class WebhookEndpoint(Base):
    __tablename__ = "webhook_endpoints"

    id: Mapped[int] = Column(Integer, primary_key=True, index=True)
    webhook_id: Mapped[str] = Column(
        String(60), unique=True, index=True, nullable=False
    )
    name: Mapped[str] = Column(String(200), nullable=False)
    url: Mapped[str] = Column(String(1000), nullable=False)
    secret: Mapped[str] = Column(String(128), nullable=False)  # HMAC signing secret
    events: Mapped[Optional[Any]] = Column(
        JSON, default=list
    )  # list of WebhookEvent values
    user_id: Mapped[str] = Column(String(60), nullable=False)
    industry_id: Mapped[Optional[str]] = Column(String(100))
    organisation_id: Mapped[Optional[str]] = Column(
        String(36), ForeignKey("organisations.id", ondelete="CASCADE"), index=True
    )
    status: Mapped[Optional[WebhookStatus]] = Column(
        Enum(WebhookStatus), default=WebhookStatus.active
    )
    failure_count: Mapped[Optional[int]] = Column(Integer, default=0)
    last_fired_at: Mapped[Optional[datetime]] = Column(DateTime(timezone=True))
    created_at: Mapped[Optional[datetime]] = Column(
        DateTime(timezone=True), server_default=func.now()
    )


class WebhookDelivery(Base):
    __tablename__ = "webhook_deliveries"

    id: Mapped[int] = Column(Integer, primary_key=True, index=True)
    delivery_id: Mapped[str] = Column(
        String(60), unique=True, index=True, nullable=False
    )
    webhook_id: Mapped[str] = Column(String(60), nullable=False)
    event: Mapped[str] = Column(String(100), nullable=False)
    payload: Mapped[Optional[Any]] = Column(JSON)
    status_code: Mapped[Optional[int]] = Column(Integer)
    response_body: Mapped[Optional[str]] = Column(Text)
    success: Mapped[Optional[bool]] = Column(Boolean, default=False)
    attempt: Mapped[Optional[int]] = Column(Integer, default=1)
    delivered_at: Mapped[Optional[datetime]] = Column(
        DateTime(timezone=True), server_default=func.now()
    )
