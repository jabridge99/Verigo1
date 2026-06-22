"""
Smoke test: app/middleware.py's _redis_allow() previously failed OPEN
(allowed the request) on any Redis error, including for the login-rate-limit
tier — a Redis outage silently disabled brute-force protection on the login
endpoint exactly when it would matter most. Fixed by adding a fail_open
parameter, defaulting to True for general API traffic but wired to False
for the "login" bucket in RateLimitMiddleware.dispatch().
"""

import pytest

from app.middleware import _redis_allow


class _BrokenRedis:
    def pipeline(self):
        raise ConnectionError("redis unreachable")


@pytest.mark.asyncio
async def test_redis_allow_fails_open_by_default():
    allowed = await _redis_allow(_BrokenRedis(), "rl:api:1.2.3.4", limit=10)
    assert allowed is True


@pytest.mark.asyncio
async def test_redis_allow_fails_closed_when_requested():
    allowed = await _redis_allow(
        _BrokenRedis(), "rl:login:1.2.3.4", limit=10, fail_open=False
    )
    assert allowed is False
