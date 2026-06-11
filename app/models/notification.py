from sqlalchemy import Column, String, Integer, Boolean, DateTime, Text, Enum
from sqlalchemy.sql import func
import enum
from app.db.database import Base


class NotificationType(str, enum.Enum):
    alert           = "alert"           # AML alert triggered
    report_due      = "report_due"      # AUSTRAC report deadline approaching
    report_approved = "report_approved" # Report approved by MLRO
    case_assigned   = "case_assigned"   # Case assigned to user
    case_escalated  = "case_escalated"  # Case escalated
    kyc_review      = "kyc_review"      # KYC record needs review
    magic_link      = "magic_link"      # Magic link sent
    system          = "system"          # System message
    ecdd_required   = "ecdd_required"   # ECDD assessment required


class NotificationPriority(str, enum.Enum):
    low    = "low"
    medium = "medium"
    high   = "high"
    urgent = "urgent"


class Notification(Base):
    __tablename__ = "notifications"

    id           = Column(Integer, primary_key=True, index=True)
    notif_id     = Column(String(60), unique=True, index=True, nullable=False)
    user_id      = Column(String(60), index=True)          # None = broadcast
    notif_type   = Column(Enum(NotificationType), nullable=False)
    priority     = Column(Enum(NotificationPriority), default=NotificationPriority.medium)
    title        = Column(String(300), nullable=False)
    body         = Column(Text, nullable=False)
    link         = Column(String(500))                     # frontend deep-link
    entity_type  = Column(String(50))                      # customer | report | case | alert
    entity_id    = Column(String(100))
    read         = Column(Boolean, default=False)
    emailed      = Column(Boolean, default=False)
    created_at   = Column(DateTime(timezone=True), server_default=func.now())
    read_at      = Column(DateTime(timezone=True))
