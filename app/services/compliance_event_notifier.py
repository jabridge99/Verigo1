"""
Compliance Event Notifier — central notification bus

Single point of truth for firing notifications when compliance events occur.
Called by other services (not by routes directly).

Every compliance event that staff need to act on flows through here:
  - Regulatory deadlines (SMR, IFTI, TTR)
  - Risk-triggered training assignments
  - Customer portal submissions
  - Governance events (board report ready, IR due, control test overdue)
  - AUSTRAC examination pack ready

Design: each notify_* function creates one or more Notification rows and
optionally sends email. The event type drives which users are targeted.
"""
from __future__ import annotations

import logging
from datetime import date
from typing import Optional

from sqlalchemy.orm import Session

from app.models.notification import Notification, NotificationType, NotificationPriority
from app.models.user import User, UserRole

log = logging.getLogger("tvg.notifier")

_NOTIF_ID_PREFIX = "NOTIF"


def _next_id() -> str:
    import uuid
    return f"{_NOTIF_ID_PREFIX}-{uuid.uuid4().hex[:12].upper()}"


def _mlro_and_above(db: Session, org_id: str) -> list[User]:
    return db.query(User).filter(
        User.org_id == org_id,
        User.status == "active",
        User.role.in_([UserRole.admin, UserRole.mlro]),
    ).all()


def _compliance_and_above(db: Session, org_id: str) -> list[User]:
    return db.query(User).filter(
        User.org_id == org_id,
        User.status == "active",
        User.role.in_([UserRole.admin, UserRole.mlro, UserRole.compliance]),
    ).all()


def _create(
    db: Session,
    user_id: Optional[str],
    notif_type: NotificationType,
    priority: NotificationPriority,
    title: str,
    body: str,
    entity_type: Optional[str] = None,
    entity_id: Optional[str] = None,
    link: Optional[str] = None,
    send_email: bool = True,
) -> Notification:
    n = Notification(
        notif_id=_next_id(),
        user_id=user_id,
        notif_type=notif_type,
        priority=priority,
        title=title,
        body=body,
        entity_type=entity_type,
        entity_id=entity_id,
        link=link,
        emailed=False,
    )
    db.add(n)
    db.flush()

    if send_email and user_id:
        _send_email_for(db, n)

    return n


def _notify_users(
    db: Session,
    users: list[User],
    notif_type: NotificationType,
    priority: NotificationPriority,
    title: str,
    body: str,
    entity_type: Optional[str] = None,
    entity_id: Optional[str] = None,
    link: Optional[str] = None,
) -> int:
    count = 0
    for user in users:
        _create(db, user.id, notif_type, priority, title, body,
                entity_type, entity_id, link)
        count += 1
    return count


def _send_email_for(db: Session, notif: Notification) -> None:
    try:
        from app.services import email_service as em
        user = db.query(User).filter_by(id=notif.user_id).first()
        if not user:
            return
        # Generic compliance alert email for new event types
        em.send_compliance_notification(
            to_email=user.email,
            to_name=getattr(user, "full_name", user.email) or user.email,
            subject=notif.title,
            body=notif.body,
            priority=notif.priority.value if hasattr(notif.priority, "value") else notif.priority,
            link=notif.link,
        )
        notif.emailed = True
    except Exception as exc:
        log.warning("Email delivery failed for %s: %s", notif.notif_id, exc)


# ══════════════════════════════════════════════════════════════════════════════
# REGULATORY REPORTING DEADLINES
# ══════════════════════════════════════════════════════════════════════════════

def notify_smr_deadline(
    db: Session,
    org_id: str,
    smr_id: str,
    smr_ref: str,
    days_remaining: int,
) -> int:
    users = _mlro_and_above(db, org_id)
    priority = NotificationPriority.urgent if days_remaining <= 1 else NotificationPriority.high
    title = f"SMR deadline in {days_remaining} day{'s' if days_remaining != 1 else ''} — {smr_ref}"
    body = (
        f"Suspicious Matter Report {smr_ref} must be filed with AUSTRAC within "
        f"{days_remaining} day{'s' if days_remaining != 1 else ''}. "
        f"AML/CTF Act s.41 requires filing within 3 business days of forming the suspicion."
    )
    count = _notify_users(db, users, NotificationType.smr_deadline, priority,
                          title, body, "smr", smr_id, f"/reports/smr/{smr_id}")
    db.commit()
    return count


def notify_ifti_deadline(
    db: Session,
    org_id: str,
    ifti_id: str,
    ifti_ref: str,
    hours_remaining: int,
) -> int:
    users = _mlro_and_above(db, org_id)
    priority = NotificationPriority.urgent if hours_remaining <= 24 else NotificationPriority.high
    title = f"IFTI deadline in {hours_remaining}h — {ifti_ref}"
    body = (
        f"International Funds Transfer Instruction {ifti_ref} must be reported to AUSTRAC "
        f"within {hours_remaining} hours. AML/CTF Act s.45 — 3 business day deadline."
    )
    count = _notify_users(db, users, NotificationType.ifti_deadline, priority,
                          title, body, "ifti", ifti_id, f"/reports/ifti/{ifti_id}")
    db.commit()
    return count


def notify_ttr_deadline(
    db: Session,
    org_id: str,
    ttr_id: str,
    ttr_ref: str,
    days_remaining: int,
) -> int:
    users = _mlro_and_above(db, org_id)
    priority = NotificationPriority.urgent if days_remaining <= 1 else NotificationPriority.high
    title = f"TTR deadline in {days_remaining} day{'s' if days_remaining != 1 else ''} — {ttr_ref}"
    body = (
        f"Threshold Transaction Report {ttr_ref} must be filed with AUSTRAC. "
        f"AML/CTF Act s.43 requires filing within 3 business days of the transaction."
    )
    count = _notify_users(db, users, NotificationType.ttr_deadline, priority,
                          title, body, "ttr", ttr_id, f"/reports/ttr/{ttr_id}")
    db.commit()
    return count


# ══════════════════════════════════════════════════════════════════════════════
# TRAINING
# ══════════════════════════════════════════════════════════════════════════════

def notify_training_assigned(
    db: Session,
    user_id: str,
    course_name: str,
    due_date: date,
    trigger_reason: str,
    record_id: str,
) -> None:
    title = f"Training assigned: {course_name}"
    body = (
        f"You have been assigned '{course_name}' due by {due_date.strftime('%d %b %Y')}. "
        f"Reason: {trigger_reason}"
    )
    _create(db, user_id, NotificationType.training_assigned, NotificationPriority.medium,
            title, body, "training_record", record_id, f"/training/{record_id}")
    db.commit()


def notify_training_overdue(
    db: Session,
    user_id: str,
    org_id: str,
    course_name: str,
    days_overdue: int,
    record_id: str,
) -> None:
    priority = NotificationPriority.urgent if days_overdue > 14 else NotificationPriority.high
    title = f"Training overdue ({days_overdue}d): {course_name}"
    body = (
        f"Mandatory training '{course_name}' is {days_overdue} days overdue. "
        f"This is a regulatory obligation under AML/CTF Act s.36."
    )
    _create(db, user_id, NotificationType.training_overdue, priority,
            title, body, "training_record", record_id, f"/training/{record_id}")

    # Also alert the MLRO
    for mlro in _mlro_and_above(db, org_id):
        if mlro.id != user_id:
            _create(db, mlro.id, NotificationType.training_overdue, priority,
                    f"Staff training overdue: {course_name}",
                    f"A staff member has mandatory training '{course_name}' overdue by {days_overdue} days.",
                    "training_record", record_id, f"/training/{record_id}", send_email=False)
    db.commit()


def notify_assessment_flag(
    db: Session,
    org_id: str,
    user_id: str,
    course_name: str,
    score: float,
    attempt_number: int,
    flag_id: str,
) -> None:
    for mlro in _mlro_and_above(db, org_id):
        _create(
            db, mlro.id, NotificationType.assessment_flag, NotificationPriority.high,
            f"Training assessment failure — {course_name}",
            (f"A staff member scored {score:.0f}% (attempt {attempt_number}) on '{course_name}'. "
             f"{'Oversight flag raised — review required.' if attempt_number >= 2 else 'Please monitor.'} "),
            "assessment_flag", flag_id, f"/training-triggers/assessment-flags/{flag_id}",
        )
    db.commit()


def notify_regulatory_update(
    db: Session,
    org_id: str,
    update_id: str,
    event_ref: str,
    title: str,
    issuing_body: str,
    assignments_created: int,
) -> None:
    users = _compliance_and_above(db, org_id)
    notif_title = f"New {issuing_body.upper()} guidance: {title}"
    body = (
        f"Regulatory update {event_ref} has been published by {issuing_body.upper()}. "
        f"{assignments_created} training assignment(s) have been automatically created for your team."
    )
    _notify_users(db, users, NotificationType.regulatory_update, NotificationPriority.high,
                  notif_title, body, "regulatory_update", update_id,
                  f"/training-triggers/regulatory-updates/{update_id}")
    db.commit()


# ══════════════════════════════════════════════════════════════════════════════
# CUSTOMER PORTAL
# ══════════════════════════════════════════════════════════════════════════════

def notify_portal_submitted(
    db: Session,
    org_id: str,
    session_id: str,
    customer_name: str,
    invited_by_user_id: str,
) -> None:
    # Notify the staff member who sent the invite + compliance team
    targets = set()
    inviter = db.query(User).filter_by(id=invited_by_user_id).first()
    if inviter:
        targets.add(inviter.id)
    for u in _compliance_and_above(db, org_id):
        targets.add(u.id)

    for uid in targets:
        _create(
            db, uid, NotificationType.portal_submitted, NotificationPriority.medium,
            f"Portal submission received — {customer_name}",
            f"{customer_name} has completed their onboarding portal. "
            f"Documents are ready for review.",
            "portal_session", session_id, f"/customer-portal/sessions/{session_id}",
            send_email=(uid == invited_by_user_id),
        )
    db.commit()


# ══════════════════════════════════════════════════════════════════════════════
# GOVERNANCE
# ══════════════════════════════════════════════════════════════════════════════

def notify_independent_review_due(
    db: Session,
    org_id: str,
    review_id: str,
    review_ref: str,
    days_remaining: int,
) -> None:
    users = _mlro_and_above(db, org_id)
    priority = NotificationPriority.urgent if days_remaining <= 7 else NotificationPriority.high
    _notify_users(
        db, users, NotificationType.independent_review_due, priority,
        f"Independent Review due in {days_remaining} days — {review_ref}",
        f"Independent review {review_ref} target completion is in {days_remaining} days. "
        f"AML/CTF Act s.162 requires periodic independent reviews of your AML/CTF program.",
        "independent_review", review_id, f"/independent-reviews/{review_id}",
    )
    db.commit()


def notify_board_report_ready(
    db: Session,
    org_id: str,
    report_id: str,
    report_title: str,
) -> None:
    users = _mlro_and_above(db, org_id)
    _notify_users(
        db, users, NotificationType.board_report_ready, NotificationPriority.medium,
        f"Board report ready for approval — {report_title}",
        f"'{report_title}' has been submitted for MLRO review and approval before distribution.",
        "board_report", report_id, f"/board-reports/{report_id}",
    )
    db.commit()


def notify_control_test_overdue(
    db: Session,
    org_id: str,
    control_id: str,
    control_ref: str,
    days_overdue: int,
) -> None:
    users = _compliance_and_above(db, org_id)
    _notify_users(
        db, users, NotificationType.control_test_overdue, NotificationPriority.high,
        f"Control test overdue ({days_overdue}d) — {control_ref}",
        f"Governance control {control_ref} has a test that is {days_overdue} days overdue. "
        f"Overdue control tests are a finding risk in an AUSTRAC examination.",
        "governance_control", control_id, f"/governance/controls/{control_id}",
    )
    db.commit()


def notify_policy_review_due(
    db: Session,
    org_id: str,
    policy_id: str,
    policy_title: str,
    days_remaining: int,
) -> None:
    users = _compliance_and_above(db, org_id)
    priority = NotificationPriority.high if days_remaining <= 14 else NotificationPriority.medium
    _notify_users(
        db, users, NotificationType.policy_review_due, priority,
        f"Policy review due in {days_remaining} days — {policy_title}",
        f"AML/CTF policy '{policy_title}' is due for review in {days_remaining} days. "
        f"Overdue policy reviews are flagged in AUSTRAC examinations.",
        "policy", policy_id, f"/governance/policies/{policy_id}",
    )
    db.commit()


# ══════════════════════════════════════════════════════════════════════════════
# EXAMINATION PACK
# ══════════════════════════════════════════════════════════════════════════════

def notify_exam_pack_ready(
    db: Session,
    org_id: str,
    pack_id: str,
    pack_ref: str,
    requested_by_user_id: str,
) -> None:
    users = _mlro_and_above(db, org_id)
    targets = {u.id for u in users}
    targets.add(requested_by_user_id)

    for uid in targets:
        _create(
            db, uid, NotificationType.exam_pack_ready, NotificationPriority.high,
            f"AUSTRAC Examination Pack ready — {pack_ref}",
            f"Examination pack {pack_ref} has been generated and is ready for review. "
            f"All sections are frozen and available for export as HTML or CSV.",
            "examination_pack", pack_id, f"/examination-packs/{pack_id}",
        )
    db.commit()
