"""
Immutable audit log — one row per system event.
Records are NEVER modified after creation.
"""

import enum
from uuid import uuid4

from sqlalchemy import JSON, Column, DateTime, Enum, ForeignKey, Index, String, func
from sqlalchemy.orm import relationship

from app.db.database import Base


class AuditEventType(str, enum.Enum):
    # Transactions
    transaction_created = "transaction_created"
    transaction_updated = "transaction_updated"
    transaction_monitoring_run = "transaction_monitoring_run"

    # Alerts
    alert_triggered = "alert_triggered"
    alert_assigned = "alert_assigned"
    alert_reviewed = "alert_reviewed"
    alert_escalated = "alert_escalated"
    alert_smr_flagged = "alert_smr_flagged"

    # Cases
    case_created = "case_created"
    case_updated = "case_updated"
    case_status_changed = "case_status_changed"
    case_closed = "case_closed"
    case_note_added = "case_note_added"
    case_evidence_added = "case_evidence_added"
    case_alert_linked = "case_alert_linked"

    # SMR workflow
    smr_considered = "smr_considered"
    smr_lodged = "smr_lodged"

    # Regulatory reports
    ifti_created = "ifti_created"
    ifti_updated = "ifti_updated"
    ifti_submitted = "ifti_submitted"
    ifti_acknowledged = "ifti_acknowledged"
    ifti_rejected = "ifti_rejected"
    ttr_created = "ttr_created"
    ttr_updated = "ttr_updated"
    ttr_submitted = "ttr_submitted"
    ttr_acknowledged = "ttr_acknowledged"
    smr_report_created = "smr_report_created"
    smr_report_updated = "smr_report_updated"
    smr_report_submitted = "smr_report_submitted"
    smr_report_acknowledged = "smr_report_acknowledged"
    report_approved = "report_approved"
    report_rejected = "report_rejected"
    filing_registered = "filing_registered"

    # IFTI receipts
    ifti_receipt_generated = "ifti_receipt_generated"
    ifti_receipt_voided = "ifti_receipt_voided"

    # Risk & screening
    risk_score_changed = "risk_score_changed"
    screening_completed = "screening_completed"
    kyc_verified = "kyc_verified"
    cdd_level_changed = "cdd_level_changed"
    pep_status_changed = "pep_status_changed"

    # Customers
    customer_created = "customer_created"
    customer_updated = "customer_updated"
    customer_status_changed = "customer_status_changed"
    customer_review_completed = "customer_review_completed"

    # Monitoring rules
    rule_created = "rule_created"
    rule_modified = "rule_modified"
    rule_status_changed = "rule_status_changed"
    rule_deleted = "rule_deleted"

    # Compliance calendar
    calendar_item_created = "calendar_item_created"
    calendar_item_completed = "calendar_item_completed"
    calendar_item_overdue = "calendar_item_overdue"
    reminder_sent = "reminder_sent"

    # Governance
    policy_created = "policy_created"
    policy_approved = "policy_approved"
    control_test_completed = "control_test_completed"
    training_completed = "training_completed"

    # Auth
    user_login = "user_login"
    user_logout = "user_logout"
    password_changed = "password_changed"
    user_created = "user_created"
    user_role_changed = "user_role_changed"

    # Documents
    document_uploaded = "document_uploaded"
    document_deleted = "document_deleted"

    other = "other"


class AuditLog(Base):
    """
    Immutable compliance audit trail.
    One row per event — never updated or deleted.
    """

    __tablename__ = "audit_logs"

    id = Column(String, primary_key=True, default=lambda: f"aud_{uuid4().hex[:14]}")
    org_id = Column(String, ForeignKey("organisations.id", ondelete="CASCADE"), nullable=False, index=True)

    event_type = Column(Enum(AuditEventType), nullable=False, index=True)
    actor_id = Column(String, index=True)  # user_id; None for system events
    actor_role = Column(String(50))  # role at time of event
    action = Column(String(200), nullable=False)  # human-readable summary

    object_type = Column(String(100), index=True)  # e.g. "IFTIReport", "Case"
    object_id = Column(String, index=True)  # PK of the affected object

    old_value = Column(JSON)  # snapshot before change
    new_value = Column(JSON)  # snapshot after change

    ip_address = Column(String(45))  # IPv4 or IPv6
    user_agent = Column(String(500))
    session_id = Column(String(100))
    request_id = Column(String(100))

    reason = Column(String(1000))  # operator-supplied justification
    log_metadata = Column(JSON)  # arbitrary extra context

    created_at = Column(DateTime(timezone=True), server_default=func.now(), index=True)
    # Intentionally NO updated_at — immutable record

    organisation = relationship("Organisation", back_populates="audit_logs")

    __table_args__ = (
        Index("ix_audit_org_event", "org_id", "event_type"),
        Index("ix_audit_object", "object_type", "object_id"),
        Index("ix_audit_actor", "actor_id", "created_at"),
    )
