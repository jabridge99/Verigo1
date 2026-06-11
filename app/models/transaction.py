from sqlalchemy import Column, String, Integer, DateTime, Enum, Text, ForeignKey, Float, Boolean, JSON
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
import enum
from app.db.database import Base


class TransactionType(str, enum.Enum):
    deposit    = "deposit"
    withdrawal = "withdrawal"
    transfer   = "transfer"
    payment    = "payment"
    exchange   = "exchange"


class TransactionStatus(str, enum.Enum):
    pending      = "pending"
    completed    = "completed"
    flagged      = "flagged"
    blocked      = "blocked"
    under_review = "under_review"
    cleared      = "cleared"


class AlertType(str, enum.Enum):
    large_transaction = "large_transaction"
    structuring       = "structuring"
    rapid_movement    = "rapid_movement"
    high_risk_country = "high_risk_country"
    unusual_pattern   = "unusual_pattern"
    sanctions_match   = "sanctions_match"
    velocity_breach   = "velocity_breach"
    cross_border      = "cross_border"
    pep_transaction   = "pep_transaction"
    rule_triggered    = "rule_triggered"


class AlertStatus(str, enum.Enum):
    open         = "open"
    under_review = "under_review"
    escalated    = "escalated"
    dismissed    = "dismissed"
    resolved     = "resolved"
    reported     = "reported"


class AlertSeverity(str, enum.Enum):
    low      = "low"
    medium   = "medium"
    high     = "high"
    critical = "critical"


class Transaction(Base):
    __tablename__ = "transactions"

    id                   = Column(Integer, primary_key=True, index=True)
    transaction_id       = Column(String(50), unique=True, index=True, nullable=False)
    customer_id          = Column(Integer, ForeignKey("customers.id"), nullable=False)
    transaction_type     = Column(Enum(TransactionType), nullable=False)
    amount               = Column(Float, nullable=False)
    currency             = Column(String(10), default="AUD")
    amount_aud           = Column(Float)
    counterparty_name    = Column(String(200))
    counterparty_account = Column(String(100))
    counterparty_country = Column(String(10))
    counterparty_bank    = Column(String(200))
    is_cross_border      = Column(Boolean, default=False)
    description          = Column(Text)
    reference            = Column(String(200))
    channel              = Column(String(50))
    industry_id          = Column(String(100))
    status               = Column(Enum(TransactionStatus), default=TransactionStatus.pending)
    risk_score           = Column(Float, default=0.0)
    is_suspicious        = Column(Integer, default=0)
    alert_type           = Column(Enum(AlertType))
    alert_details        = Column(Text)
    rule_matches         = Column(JSON)
    transaction_date     = Column(DateTime(timezone=True), nullable=False)
    created_at           = Column(DateTime(timezone=True), server_default=func.now())

    customer = relationship("Customer", back_populates="transactions")
    alerts   = relationship("TransactionAlert", back_populates="transaction",
                            cascade="all, delete-orphan")


class TransactionAlert(Base):
    __tablename__ = "transaction_alerts"

    id               = Column(Integer, primary_key=True, index=True)
    alert_id         = Column(String(50), unique=True, index=True, nullable=False)
    transaction_id   = Column(Integer, ForeignKey("transactions.id"), nullable=False)
    customer_id      = Column(Integer, ForeignKey("customers.id"))
    industry_id      = Column(String(100))
    alert_type       = Column(Enum(AlertType), nullable=False)
    severity         = Column(Enum(AlertSeverity), nullable=False)
    status           = Column(Enum(AlertStatus), default=AlertStatus.open)
    description      = Column(Text, nullable=False)
    rule_id          = Column(String(50))
    rule_name        = Column(String(200))
    action_taken     = Column(String(100))
    notes            = Column(Text)
    assigned_to      = Column(String(200))
    escalated_to     = Column(String(200))
    is_resolved      = Column(Integer, default=0)
    resolved_by      = Column(String(100))
    resolution_notes = Column(Text)
    created_at       = Column(DateTime(timezone=True), server_default=func.now())
    updated_at       = Column(DateTime(timezone=True), onupdate=func.now())
    resolved_at      = Column(DateTime(timezone=True))

    transaction = relationship("Transaction", back_populates="alerts")
    customer    = relationship("Customer")


class MonitoringCase(Base):
    __tablename__ = "monitoring_cases"

    id          = Column(Integer, primary_key=True, index=True)
    case_id     = Column(String(50), unique=True, index=True, nullable=False)
    customer_id = Column(Integer, ForeignKey("customers.id"), nullable=False)
    industry_id = Column(String(100))
    title       = Column(String(300), nullable=False)
    description = Column(Text)
    severity    = Column(Enum(AlertSeverity), default=AlertSeverity.medium)
    status      = Column(String(50), default="open")
    assigned_to = Column(String(200))
    alert_ids   = Column(JSON)
    notes       = Column(Text)
    created_by  = Column(String(200))
    created_at  = Column(DateTime(timezone=True), server_default=func.now())
    updated_at  = Column(DateTime(timezone=True), onupdate=func.now())
    closed_at   = Column(DateTime(timezone=True))

    customer = relationship("Customer")
