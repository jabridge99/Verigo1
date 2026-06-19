"""
Redis-backed cache service with graceful degradation.

When REDIS_URL is not configured the cache silently no-ops so the app
works in development without Redis installed.

TTL defaults:
  org_config       300 s
  risk_scores       60 s
  screening_lists 3600 s
"""

import json
import logging
from typing import Any, Optional

from app.config import settings

log = logging.getLogger("tvg.cache")

# TTL constants (seconds)
TTL_ORG_CONFIG = 300
TTL_RISK_SCORES = 60
TTL_SCREENING_LISTS = 3600


def get_redis():
    """Return an async Redis client if REDIS_URL is configured, else None."""
    if not settings.redis_url:
        return None
    try:
        import redis.asyncio as aioredis

        return aioredis.from_url(
            settings.redis_url,
            encoding="utf-8",
            decode_responses=True,
        )
    except Exception as exc:
        log.warning("Redis connection failed — cache disabled: %s", exc)
        return None


class CacheService:
    """
    Async cache backed by Redis.  All methods are safe to call when Redis
    is unavailable — they silently return None / do nothing.
    """

    def __init__(self):
        self._client = None
        self._tried = False

    async def _get_client(self):
        if not self._tried:
            self._tried = True
            self._client = get_redis()
        return self._client

    async def get(self, key: str) -> Optional[Any]:
        """Return cached value or None."""
        client = await self._get_client()
        if client is None:
            return None
        try:
            raw = await client.get(key)
            if raw is None:
                return None
            return json.loads(raw)
        except Exception as exc:
            log.debug("Cache GET error [%s]: %s", key, exc)
            return None

    async def set(
        self, key: str, value: Any, ttl_seconds: int = TTL_ORG_CONFIG
    ) -> bool:
        """Store value as JSON with a TTL.  Returns True on success."""
        client = await self._get_client()
        if client is None:
            return False
        try:
            await client.setex(key, ttl_seconds, json.dumps(value, default=str))
            return True
        except Exception as exc:
            log.debug("Cache SET error [%s]: %s", key, exc)
            return False

    async def delete(self, key: str) -> bool:
        """Delete a single key.  Returns True on success."""
        client = await self._get_client()
        if client is None:
            return False
        try:
            await client.delete(key)
            return True
        except Exception as exc:
            log.debug("Cache DELETE error [%s]: %s", key, exc)
            return False

    async def delete_pattern(self, pattern: str) -> int:
        """
        Delete all keys matching a glob pattern.
        Returns count of deleted keys (0 on error or no Redis).
        """
        client = await self._get_client()
        if client is None:
            return 0
        try:
            keys = await client.keys(pattern)
            if not keys:
                return 0
            return await client.delete(*keys)
        except Exception as exc:
            log.debug("Cache DELETE_PATTERN error [%s]: %s", pattern, exc)
            return 0

    async def ping(self) -> bool:
        """Check Redis connectivity.  Returns False when unavailable."""
        client = await self._get_client()
        if client is None:
            return False
        try:
            return await client.ping()
        except Exception:
            return False


# Module-level singleton
cache = CacheService()
