import enum

from sqlalchemy import Boolean, Column, DateTime, Enum, Integer, String, Text
from sqlalchemy.sql import func

from app.db.database import Base


class NotificationType(str, enum.Enum):
    # ── Originals ─────────────────────────────────────────────────────────────
    alert = "alert"                         # AML monitoring alert triggered
    report_due = "report_due"               # AUSTRAC report deadline approaching
    report_approved = "report_approved"     # Report approved by MLRO
    case_assigned = "case_assigned"         # Case assigned to user
    case_escalated = "case_escalated"       # Case escalated to MLRO
    kyc_review = "kyc_review"              # KYC record needs review
    magic_link = "magic_link"              # Magic link sent
    system = "system"                      # System message
    ecdd_required = "ecdd_required"        # ECDD assessment required

    # ── Regulatory reporting deadlines ────────────────────────────────────────
    smr_deadline = "smr_deadline"           # SMR approaching AUSTRAC deadline
    ifti_deadline = "ifti_deadline"         # IFTI approaching 3-business-day deadline
    ttr_deadline = "ttr_deadline"           # TTR approaching deadline

    # ── Training ──────────────────────────────────────────────────────────────
    training_assigned = "training_assigned"     # Risk-triggered training auto-assigned
    training_overdue = "training_overdue"       # Mandatory training past due date
    training_completed = "training_completed"   # Staff completed a training course
    assessment_flag = "assessment_flag"         # Staff failed training assessment → MLRO
    regulatory_update = "regulatory_update"     # New AUSTRAC/FATF guidance published

    # ── Customer portal ───────────────────────────────────────────────────────
    portal_submitted = "portal_submitted"       # Customer submitted their portal
    portal_expired = "portal_expired"           # Portal link expired without submission
    portal_doc_rejected = "portal_doc_rejected" # Document rejected → customer notified

    # ── Governance ────────────────────────────────────────────────────────────
    independent_review_due = "independent_review_due"   # IR engagement approaching deadline
    board_report_ready = "board_report_ready"           # Board report ready for MLRO approval
    control_test_overdue = "control_test_overdue"       # Control test past scheduled date
    policy_review_due = "policy_review_due"             # Policy review date approaching

    # ── Examination pack ──────────────────────────────────────────────────────
    exam_pack_ready = "exam_pack_ready"         # AUSTRAC examination pack generated


class NotificationPriority(str, enum.Enum):
    low = "low"
    medium = "medium"
    high = "high"
    urgent = "urgent"


class Notification(Base):
    __tablename__ = "notifications"

    id = Column(Integer, primary_key=True, index=True)
    notif_id = Column(String(60), unique=True, index=True, nullable=False)
    user_id = Column(String(60), index=True)  # None = broadcast
    notif_type = Column(Enum(NotificationType), nullable=False)
    priority = Column(Enum(NotificationPriority), default=NotificationPriority.medium)
    title = Column(String(300), nullable=False)
    body = Column(Text, nullable=False)
    link = Column(String(500))  # frontend deep-link
    entity_type = Column(String(50))  # customer | report | case | alert
    entity_id = Column(String(100))
    read = Column(Boolean, default=False)
    emailed = Column(Boolean, default=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    read_at = Column(DateTime(timezone=True))
