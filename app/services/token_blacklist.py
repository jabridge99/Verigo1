"""
JWT revocation blacklist.

Backed by Redis (with TTL matching token expiry) when REDIS_URL is configured,
so revocation is shared across all workers/instances and entries expire
automatically. Falls back to an in-process set in dev when Redis isn't
configured — acceptable locally, NOT safe for multi-worker production.
"""

import logging

from app.config import settings

log = logging.getLogger("tvg.auth")

_KEY_PREFIX = "tvg:jwt_blacklist:"


class _RedisBlacklist:
    def __init__(self, url: str):
        import redis

        self._client = redis.from_url(url, decode_responses=True)
        self._client.ping()

    def add(self, key: str, ttl_seconds: int = 60 * 60 * 24) -> None:
        self._client.set(_KEY_PREFIX + key, "1", ex=ttl_seconds)

    def __contains__(self, key: str) -> bool:
        return self._client.exists(_KEY_PREFIX + key) == 1


class _InProcessBlacklist:
    def __init__(self):
        self._set: set[str] = set()

    def add(self, key: str, ttl_seconds: int = 60 * 60 * 24) -> None:
        # No TTL support — entries persist for process lifetime only.
        self._set.add(key)

    def __contains__(self, key: str) -> bool:
        return key in self._set


def _build_blacklist():
    if settings.redis_url:
        try:
            return _RedisBlacklist(settings.redis_url)
        except Exception as e:
            log.warning(
                "REDIS_URL configured but unreachable (%s) — falling back to "
                "in-process JWT blacklist. Revocation will NOT be shared across workers.",
                e,
            )
    else:
        log.warning(
            "REDIS_URL not configured — using in-process JWT blacklist. "
            "Token revocation will NOT survive restarts or be shared across workers. "
            "Set REDIS_URL before running multiple workers in production."
        )
    return _InProcessBlacklist()


TOKEN_BLACKLIST = _build_blacklist()
