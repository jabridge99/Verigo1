"""
Background job scheduler using APScheduler.

Jobs:
  - deadline_check   daily   02:00 AEST  — scan all pending reports/training/controls for due dates
  - snapshot_capture weekly  Sun 01:00   — capture org metrics snapshots for all active orgs
  - benchmark_compute weekly Sun 01:30   — recompute industry benchmark distributions

Scheduler is started in the FastAPI lifespan and shut down cleanly on exit.
"""

import logging

import sentry_sdk
from apscheduler.schedulers.background import BackgroundScheduler
from apscheduler.triggers.cron import CronTrigger

log = logging.getLogger("tvg.scheduler")

_scheduler: BackgroundScheduler | None = None


# ── Job implementations ───────────────────────────────────────────────────────


@sentry_sdk.crons.monitor(
    monitor_slug="deadline-check",
    monitor_config={
        "schedule": {"type": "crontab", "value": "0 2 * * *"},
        "timezone": "Australia/Sydney",
        "checkin_margin": 10,
        "max_runtime": 30,
        "failure_issue_threshold": 1,
    },
)
def _job_deadline_check():
    from app.services.distributed_lock import job_lock

    try:
        with job_lock("deadline_check", ttl_seconds=1800) as acquired:
            if not acquired:
                log.info("deadline_check skipped — lock held by another worker")
                return

            from app.db.database import SessionLocal
            from app.services.notification_scheduler import run_all_deadline_checks

            db = SessionLocal()
            try:
                result = run_all_deadline_checks(db)
                log.info("Deadline check complete: %s", result)
            finally:
                db.close()
    except Exception:
        log.exception("deadline_check job failed")


@sentry_sdk.crons.monitor(
    monitor_slug="snapshot-capture",
    monitor_config={
        "schedule": {"type": "crontab", "value": "0 1 * * 0"},
        "timezone": "Australia/Sydney",
        "checkin_margin": 10,
        "max_runtime": 30,
        "failure_issue_threshold": 1,
    },
)
def _job_capture_snapshots():
    from app.services.distributed_lock import job_lock

    try:
        with job_lock("snapshot_capture", ttl_seconds=1800) as acquired:
            if not acquired:
                log.info("snapshot_capture skipped — lock held by another worker")
                return

            from app.db.database import SessionLocal
            from app.models.benchmark import SnapshotPeriod
            from app.services import benchmark_service as svc

            db = SessionLocal()
            try:
                result = svc.capture_all_org_snapshots(db, SnapshotPeriod.weekly)
                log.info("Snapshot capture complete: %s", result)
            finally:
                db.close()
    except Exception:
        log.exception("capture_snapshots job failed")


@sentry_sdk.crons.monitor(
    monitor_slug="benchmark-compute",
    monitor_config={
        "schedule": {"type": "crontab", "value": "30 1 * * 0"},
        "timezone": "Australia/Sydney",
        "checkin_margin": 10,
        "max_runtime": 30,
        "failure_issue_threshold": 1,
    },
)
def _job_compute_benchmarks():
    from app.services.distributed_lock import job_lock

    try:
        with job_lock("benchmark_compute", ttl_seconds=1800) as acquired:
            if not acquired:
                log.info("benchmark_compute skipped — lock held by another worker")
                return

            from app.db.database import SessionLocal
            from app.services import benchmark_service as svc

            db = SessionLocal()
            try:
                result = svc.compute_industry_benchmarks(db)
                log.info("Benchmark compute complete: %s", result)
            finally:
                db.close()
    except Exception:
        log.exception("compute_benchmarks job failed")


# ── Lifecycle ─────────────────────────────────────────────────────────────────


def start_scheduler():
    global _scheduler
    _scheduler = BackgroundScheduler(timezone="Australia/Sydney")

    _scheduler.add_job(
        _job_deadline_check,
        CronTrigger(hour=2, minute=0),
        id="deadline_check",
        replace_existing=True,
        name="Daily compliance deadline check",
    )
    _scheduler.add_job(
        _job_capture_snapshots,
        CronTrigger(day_of_week="sun", hour=1, minute=0),
        id="snapshot_capture",
        replace_existing=True,
        name="Weekly org metrics snapshot",
    )
    _scheduler.add_job(
        _job_compute_benchmarks,
        CronTrigger(day_of_week="sun", hour=1, minute=30),
        id="benchmark_compute",
        replace_existing=True,
        name="Weekly industry benchmark computation",
    )

    _scheduler.start()
    log.info(
        "Scheduler started — %d jobs registered: %s",
        len(_scheduler.get_jobs()),
        [j.id for j in _scheduler.get_jobs()],
    )
    return _scheduler


def stop_scheduler():
    global _scheduler
    if _scheduler and _scheduler.running:
        _scheduler.shutdown(wait=False)
        log.info("Scheduler stopped")
    _scheduler = None


def get_scheduler() -> BackgroundScheduler | None:
    return _scheduler
