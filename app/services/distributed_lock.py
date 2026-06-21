"""
Redis-backed distributed lock for scheduled jobs.

Production runs multiple uvicorn worker processes (see Dockerfile/
railway.json --workers 2), and app/scheduler.py's BackgroundScheduler is
started per-process in the FastAPI lifespan — so without a cross-process
lock, every worker fires the same cron job at the same time, producing
duplicate notifications/emails and duplicate snapshot/benchmark rows.
"""

import logging
from contextlib import contextmanager

from app.config import settings

log = logging.getLogger("tvg.lock")


def _get_redis():
    if not settings.redis_url:
        return None
    try:
        import redis

        return redis.from_url(settings.redis_url, decode_responses=True)
    except Exception as exc:
        log.warning("Redis connection failed — distributed lock disabled: %s", exc)
        return None


@contextmanager
def job_lock(name: str, ttl_seconds: int = 1800):
    """
    Yields True if the lock was acquired (caller should run the job), or
    False if another worker/instance already holds it (caller should
    skip this run). Backed by Redis SET NX EX so the lock self-expires
    even if a worker crashes mid-job. When Redis is unavailable, fails
    open (always acquires) so jobs still run in dev/test setups that
    don't run Redis — this lock only matters once you have more than one
    process running the scheduler.
    """
    client = _get_redis()
    if client is None:
        yield True
        return

    key = f"job_lock:{name}"
    acquired = False
    try:
        acquired = bool(client.set(key, "1", nx=True, ex=ttl_seconds))
        yield acquired
    finally:
        if acquired:
            try:
                client.delete(key)
            except Exception:
                pass
