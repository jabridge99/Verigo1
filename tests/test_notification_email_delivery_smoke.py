"""
Smoke tests for two confirmed broken email-delivery call sites found via
mypy triage, both silently swallowed by an outer `except Exception` so
neither ever crashed a caller -- they just never actually sent an email:

1. app/services/compliance_event_notifier.py's _send_email_for() called
   email_service.send_compliance_notification() with kwargs (to_email,
   to_name, priority, link) that don't exist on its real signature
   (to, full_name, title, ..., action_url, urgency) and omitted the
   required `title` argument entirely -- every compliance notification
   that should have triggered an email (SMR/IFTI/TTR deadlines, training
   overdue, policy review due, etc.) silently failed to send one.

2. app/worker.py's send_reminder_emails() imported a `send_email`
   function that does not exist anywhere in app/services/email_service.py
   (there is no generic send_email() -- send_compliance_notification()
   is the generic one, per its own docstring: "used by
   compliance_event_notifier for all event types"), and separately used
   ComplianceCalendarItem.assigned_to (a user_id column) as if it were
   an email address via a nonexistent `assigned_to_email` attribute --
   every compliance-calendar reminder email has always failed to send.
"""

from datetime import date

from app.models.notification import (
    Notification,
    NotificationPriority,
    NotificationType,
)
from app.models.user import UserRole
from tests.conftest import TestingSession, _make_org, _make_user


def test_send_email_for_calls_real_signature(db, monkeypatch):
    from app.services import compliance_event_notifier as notifier

    user = _make_user(db, UserRole.compliance)

    captured = {}

    def _fake_send_compliance_notification(**kwargs):
        captured.update(kwargs)
        return True

    monkeypatch.setattr(
        "app.services.email_service.send_compliance_notification",
        _fake_send_compliance_notification,
    )

    notif = Notification(
        notif_id="ntf_test123",
        user_id=user.id,
        notif_type=NotificationType.smr_deadline,
        priority=NotificationPriority.high,
        title="SMR deadline approaching",
        body="An SMR is due in 1 day.",
    )
    db.add(notif)
    db.flush()

    notifier._send_email_for(db, notif)

    assert captured["to"] == user.email
    assert captured["title"] == "SMR deadline approaching"
    assert captured["body"] == "An SMR is due in 1 day."
    assert notif.emailed is True


def test_worker_send_reminder_emails_does_not_crash(db, monkeypatch):
    import asyncio

    from app.models.compliance_calendar import CalendarItemType, ComplianceCalendarItem
    from app.worker import send_reminder_emails

    org = _make_org(db)
    user = _make_user(db, UserRole.compliance, industry_id=org.id)

    item = ComplianceCalendarItem(
        org_id=org.id,
        item_type=CalendarItemType.policy_review,
        title="Annual AML policy review",
        due_date=date.today(),
        assigned_to=user.id,
    )
    db.add(item)
    db.commit()

    captured = {}
    monkeypatch.setattr(
        "app.services.email_service.send_compliance_notification",
        lambda **kwargs: captured.update(kwargs) or True,
    )
    # send_reminder_emails() opens its own SessionLocal() rather than
    # accepting an injected session (it runs as a BackgroundTask, outside
    # request-scoped DI) -- bind it to this test's own connection/
    # transaction so it can see the uncommitted item/user rows above.
    monkeypatch.setattr(
        "app.db.database.SessionLocal",
        lambda: TestingSession(bind=db.connection()),
    )

    asyncio.run(send_reminder_emails(org.id, [item.id]))

    assert captured.get("to") == user.email
    assert "Annual AML policy review" in captured.get("title", "")
