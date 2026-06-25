import enum

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

    id = Column(Integer, primary_key=True, index=True)
    key_id = Column(String(60), unique=True, index=True, nullable=False)
    name = Column(String(200), nullable=False)
    key_hash = Column(String(128), nullable=False)  # SHA-256 of raw key
    key_prefix = Column(String(12), nullable=False)  # tvg_live_XXXX
    user_id = Column(String(60), nullable=False)
    industry_id = Column(String(100))
    organisation_id = Column(
        String(36), ForeignKey("organisations.id", ondelete="CASCADE"), index=True
    )
    status = Column(Enum(APIKeyStatus), default=APIKeyStatus.active)
    scopes = Column(JSON, default=list)  # ["customers:read", ...]
    last_used_at = Column(DateTime(timezone=True))
    expires_at = Column(DateTime(timezone=True))
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    revoked_at = Column(DateTime(timezone=True))


class WebhookEndpoint(Base):
    __tablename__ = "webhook_endpoints"

    id = Column(Integer, primary_key=True, index=True)
    webhook_id = Column(String(60), unique=True, index=True, nullable=False)
    name = Column(String(200), nullable=False)
    url = Column(String(1000), nullable=False)
    secret = Column(String(128), nullable=False)  # HMAC signing secret
    events = Column(JSON, default=list)  # list of WebhookEvent values
    user_id = Column(String(60), nullable=False)
    industry_id = Column(String(100))
    organisation_id = Column(
        String(36), ForeignKey("organisations.id", ondelete="CASCADE"), index=True
    )
    status = Column(Enum(WebhookStatus), default=WebhookStatus.active)
    failure_count = Column(Integer, default=0)
    last_fired_at = Column(DateTime(timezone=True))
    created_at = Column(DateTime(timezone=True), server_default=func.now())


class WebhookDelivery(Base):
    __tablename__ = "webhook_deliveries"

    id = Column(Integer, primary_key=True, index=True)
    delivery_id = Column(String(60), unique=True, index=True, nullable=False)
    webhook_id = Column(String(60), nullable=False)
    event = Column(String(100), nullable=False)
    payload = Column(JSON)
    status_code = Column(Integer)
    response_body = Column(Text)
    success = Column(Boolean, default=False)
    attempt = Column(Integer, default=1)
    delivered_at = Column(DateTime(timezone=True), server_default=func.now())
