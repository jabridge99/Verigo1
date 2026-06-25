"""
Notification service — create, list, mark-read, and optionally email notifications.
"""

import uuid
from datetime import datetime, timezone
from typing import List, Optional

from sqlalchemy import and_, desc
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.models.notification import Notification, NotificationPriority, NotificationType
from app.models.user import User
from app.schemas.notification import NotificationCreate


def _notif_id() -> str:
    return f"NOTIF-{uuid.uuid4().hex[:12].upper()}"


def create_notification(
    db: Session,
    data: NotificationCreate,
    send_email: bool = False,
    dedupe_key: Optional[str] = None,
) -> Notification:
    """
    Create a notification. Pass dedupe_key for anything that might run more
    than once for the same logical event (deadline reminders, training
    overdue checks, etc. — e.g. f"report_due:{report_id}:{date.today()}").
    If a notification with that key already exists, it's returned as-is
    instead of creating a duplicate (and no second email is sent). The
    notifications.dedupe_key column has a unique constraint, so concurrent
    callers racing on the same key are also covered by the IntegrityError
    fallback below, not just the upfront SELECT.
    """
    if dedupe_key:
        existing = (
            db.query(Notification).filter(Notification.dedupe_key == dedupe_key).first()
        )
        if existing:
            return existing

    notif = Notification(
        notif_id=_notif_id(),
        user_id=data.user_id,
        notif_type=data.notif_type,
        priority=data.priority,
        title=data.title,
        body=data.body,
        link=data.link,
        entity_type=data.entity_type,
        entity_id=data.entity_id,
        dedupe_key=dedupe_key,
        emailed=False,
    )
    db.add(notif)
    try:
        db.commit()
    except IntegrityError:
        db.rollback()
        existing = (
            db.query(Notification).filter(Notification.dedupe_key == dedupe_key).first()
        )
        if existing:
            return existing
        raise
    db.refresh(notif)

    if send_email and data.user_id:
        _try_email(db, notif)

    return notif


def _try_email(db: Session, notif: Notification) -> None:
    from app.services import email_service as em

    user: Optional[User] = db.query(User).filter(User.user_id == notif.user_id).first()
    if not user:
        return

    sent = False
    t = notif.notif_type

    if t == NotificationType.alert:
        sent = em.send_aml_alert(
            user.email,
            user.full_name,
            notif.title,
            notif.entity_id or "Unknown",
            0.0,
        )
    elif t == NotificationType.report_due:
        sent = em.send_report_deadline(
            user.email,
            user.full_name,
            notif.entity_type or "Report",
            notif.entity_id or "",
            3,
        )
    elif t == NotificationType.report_approved:
        sent = em.send_report_approved(
            user.email,
            user.full_name,
            notif.entity_type or "Report",
            notif.entity_id or "",
            "MLRO",
        )
    elif t == NotificationType.case_assigned:
        sent = em.send_case_assignment(
            user.email,
            user.full_name,
            notif.entity_id or "",
            notif.title,
            "medium",
            "System",
        )
    elif t == NotificationType.kyc_review:
        sent = em.send_kyc_review_required(
            user.email,
            user.full_name,
            notif.entity_id or "",
            notif.entity_type or "Customer",
        )
    else:
        return

    if sent:
        notif.emailed = True
        db.commit()


def list_notifications(
    db: Session,
    user_id: str,
    unread_only: bool = False,
    limit: int = 50,
    offset: int = 0,
) -> List[Notification]:
    q = db.query(Notification).filter(
        (Notification.user_id == user_id) | (Notification.user_id == None)  # noqa: E711
    )
    if unread_only:
        q = q.filter(Notification.read == False)  # noqa: E712
    return q.order_by(desc(Notification.created_at)).offset(offset).limit(limit).all()


def get_summary(db: Session, user_id: str) -> dict:
    base = db.query(Notification).filter(
        (Notification.user_id == user_id) | (Notification.user_id == None)  # noqa: E711
    )
    total = base.count()
    unread = base.filter(Notification.read == False).count()  # noqa: E712
    urgent = base.filter(
        and_(
            Notification.read == False,  # noqa: E712
            Notification.priority == NotificationPriority.urgent,
        )
    ).count()
    return {"unread_count": unread, "urgent_count": urgent, "total_count": total}


def mark_read(db: Session, notif_id: str, user_id: str) -> Optional[Notification]:
    notif = (
        db.query(Notification)
        .filter(
            Notification.notif_id == notif_id,
            (Notification.user_id == user_id) | (Notification.user_id == None),  # noqa: E711
        )
        .first()
    )
    if notif and not notif.read:
        notif.read = True
        notif.read_at = datetime.now(timezone.utc)
        db.commit()
        db.refresh(notif)
    return notif


def mark_all_read(db: Session, user_id: str) -> int:
    rows = (
        db.query(Notification)
        .filter(
            (Notification.user_id == user_id) | (Notification.user_id == None),  # noqa: E711
            Notification.read == False,  # noqa: E712
        )
        .all()
    )
    now = datetime.now(timezone.utc)
    for n in rows:
        n.read = True
        n.read_at = now
    db.commit()
    return len(rows)


def broadcast(
    db: Session,
    notif_type: NotificationType,
    priority: NotificationPriority,
    title: str,
    body: str,
    link: Optional[str] = None,
) -> Notification:
    data = NotificationCreate(
        user_id=None,
        notif_type=notif_type,
        priority=priority,
        title=title,
        body=body,
        link=link,
    )
    return create_notification(db, data)
