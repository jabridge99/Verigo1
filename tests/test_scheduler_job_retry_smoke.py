"""
Smoke test: app/scheduler.py's cron jobs (_job_deadline_check etc.) only
get a natural retry on the next scheduled run (next day/week), so a
transient failure — a brief DB or Redis hiccup — could swallow a whole
run with no automatic recovery within the same day. _run_with_retry()
retries the job body a few times with backoff before giving up, so
transient failures self-heal without waiting for the next cron tick.
"""

from unittest.mock import patch

from app.scheduler import _run_with_retry


def test_run_with_retry_succeeds_after_transient_failures():
    calls = {"count": 0}

    def flaky():
        calls["count"] += 1
        if calls["count"] < 3:
            raise RuntimeError("transient failure")

    with patch("app.scheduler.time.sleep"):
        _run_with_retry("test_job", flaky)

    assert calls["count"] == 3


def test_run_with_retry_gives_up_after_exhausting_attempts():
    calls = {"count": 0}

    def always_fails():
        calls["count"] += 1
        raise RuntimeError("permanent failure")

    with patch("app.scheduler.time.sleep"):
        _run_with_retry("test_job", always_fails)

    assert calls["count"] == 4
