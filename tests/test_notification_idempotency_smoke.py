"""
Smoke test for Critical #12 (idempotency half): create_notification()
previously always inserted a new row with no way to detect "this same
logical event already produced a notification" — any caller invoked
twice (a retried request, or a future scheduled reminder job run twice)
would create duplicate notifications and duplicate emails. Verifies that
passing the same dedupe_key returns the existing row instead of creating
a duplicate.
"""

from app.models.notification import Notification, NotificationPriority, NotificationType
from app.schemas.notification import NotificationCreate
from app.services.notification_service import create_notification


def _payload(user_id: str) -> NotificationCreate:
    return NotificationCreate(
        user_id=user_id,
        notif_type=NotificationType.report_due,
        priority=NotificationPriority.high,
        title="AUSTRAC SMR deadline approaching",
        body="3 business days remaining",
    )


def test_same_dedupe_key_does_not_create_duplicate(db, analyst_user):
    key = f"smr_deadline:report-123:2026-06-21"

    first = create_notification(db, _payload(analyst_user.id), dedupe_key=key)
    second = create_notification(db, _payload(analyst_user.id), dedupe_key=key)

    assert first.id == second.id
    count = db.query(Notification).filter_by(dedupe_key=key).count()
    assert count == 1


def test_no_dedupe_key_allows_multiple_notifications(db, analyst_user):
    first = create_notification(db, _payload(analyst_user.id))
    second = create_notification(db, _payload(analyst_user.id))

    assert first.id != second.id
