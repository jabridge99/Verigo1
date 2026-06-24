"""
Smoke test for Critical #12: app/scheduler.py's BackgroundScheduler runs
in-process, and production runs multiple uvicorn workers (Dockerfile /
railway.json --workers 2) — each worker starts its own scheduler, so
without a cross-process lock every worker fires the same cron job at the
same time. job_lock() (app/services/distributed_lock.py) guards each job
body; this test verifies the lock semantics directly (no real Redis in
this test environment, so it also verifies the fail-open fallback) and
that compliance_event_notifier's dedupe_key wiring actually prevents a
duplicate notification when the same deadline check fires twice.
"""

from datetime import date
from unittest.mock import MagicMock, patch

from app.models.notification import Notification, NotificationType
from app.services import compliance_event_notifier as notifier
from app.services.distributed_lock import job_lock


def test_job_lock_fails_open_without_redis():
    with patch("app.services.distributed_lock.settings") as mock_settings:
        mock_settings.redis_url = None
        with job_lock("some_job") as acquired:
            assert acquired is True


def test_job_lock_second_caller_does_not_acquire():
    fake_store = {}

    class FakeRedis:
        def set(self, key, value, nx=False, ex=None):
            if nx and key in fake_store:
                return None
            fake_store[key] = value
            return True

        def delete(self, key):
            fake_store.pop(key, None)

    with patch(
        "app.services.distributed_lock._get_redis", return_value=FakeRedis()
    ):
        with job_lock("deadline_check") as first:
            assert first is True
            with job_lock("deadline_check") as second:
                assert second is False


def test_smr_deadline_notification_is_deduped_on_repeat_run(db, mlro_user):
    count1 = notifier.notify_smr_deadline(
        db, mlro_user.org_id, "smr-1", "SMR-REF-1", days_remaining=1
    )
    count2 = notifier.notify_smr_deadline(
        db, mlro_user.org_id, "smr-1", "SMR-REF-1", days_remaining=1
    )

    assert count1 == 1
    assert count2 == 1
    rows = (
        db.query(Notification)
        .filter(
            Notification.notif_type == NotificationType.smr_deadline,
            Notification.entity_id == "smr-1",
        )
        .all()
    )
    assert len(rows) == 1
    assert rows[0].dedupe_key == f"smr_deadline:smr-1:{date.today()}:{mlro_user.id}"
