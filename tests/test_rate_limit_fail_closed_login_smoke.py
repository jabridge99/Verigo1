"""
Smoke test: RateLimitMiddleware.dispatch() must not fail OPEN (i.e. silently
disable all rate limiting) when Redis errors out mid-request — including for
the login-rate-limit tier, where that would disable brute-force protection
exactly when it matters most. Fixed by catching Redis errors at the dispatch
call site, permanently disabling the Redis backend for that worker, and
falling back to the in-process limiter, which still enforces the configured
limit.
"""

import pytest

from app.middleware import RateLimitMiddleware, _in_process_limiter


class _BrokenRedis:
    def pipeline(self):
        raise ConnectionError("redis unreachable")


class _FakeClient:
    host = "203.0.113.5"


class _FakeRequest:
    def __init__(self, path):
        self.headers = {}
        self.client = _FakeClient()
        self.url = type("_U", (), {"path": path})()


@pytest.mark.asyncio
async def test_redis_failure_falls_back_to_in_process_limiter_and_still_enforces_limit():
    mw = RateLimitMiddleware.__new__(RateLimitMiddleware)
    mw._rpm = 200
    mw._redis = _BrokenRedis()
    mw._redis_checked = True

    _in_process_limiter._buckets.pop("203.0.113.5:login", None)

    req = _FakeRequest("/api/v1/auth/login")

    async def call_next(request):
        return "ok"

    for _ in range(10):
        result = await mw.dispatch(req, call_next)
        assert result == "ok"

    # Redis backend should now be permanently disabled for this worker.
    assert mw._redis is None

    # The 11th request exceeds the login tier's 10/min limit via the
    # in-process fallback — rate limiting was NOT disabled by the Redis error.
    result = await mw.dispatch(req, call_next)
    assert result != "ok"
    assert result.status_code == 429
