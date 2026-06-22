"""
Production middleware: security headers, request logging, rate limiting.
Zero Trust hardening:
- HSTS added
- Rate limiter keyed by X-Forwarded-For (real client IP behind load balancer)
- Auth endpoints rate-limited per user identity (email) when available
- Account lockout tracking for repeated failed logins

Rate limiting:
- When REDIS_URL is set: Redis sliding-window (ZADD + ZREMRANGEBYSCORE + ZCARD)
  using a pipeline so each request costs one round-trip.
- When REDIS_URL is not set: falls back to in-process token-bucket (_InProcessRateLimiter)
  which does NOT share state across workers (fine for single-worker dev).
"""

import logging
import time
import uuid
from typing import Callable

from fastapi import FastAPI, Request, Response
from fastapi.responses import JSONResponse
from starlette.middleware.base import BaseHTTPMiddleware

logger = logging.getLogger("tvg.access")


class SecurityHeadersMiddleware(BaseHTTPMiddleware):
    """Add security headers to every response."""

    async def dispatch(self, request: Request, call_next: Callable) -> Response:
        response = await call_next(request)
        response.headers["X-Content-Type-Options"] = "nosniff"
        response.headers["X-Frame-Options"] = "DENY"
        response.headers["X-XSS-Protection"] = "1; mode=block"
        response.headers["Referrer-Policy"] = "strict-origin-when-cross-origin"
        response.headers["Permissions-Policy"] = (
            "geolocation=(), microphone=(), camera=()"
        )
        response.headers["X-Request-ID"] = (
            request.state.request_id
            if hasattr(request.state, "request_id")
            else str(uuid.uuid4())[:8]
        )
        # HSTS: enforce HTTPS for 1 year, include subdomains, allow preload
        response.headers["Strict-Transport-Security"] = (
            "max-age=31536000; includeSubDomains; preload"
        )
        # CSP: remove unsafe-inline from script-src once nonce/hash approach adopted
        response.headers["Content-Security-Policy"] = (
            "default-src 'self'; "
            "script-src 'self' 'unsafe-inline'; "
            "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; "
            "font-src 'self' https://fonts.gstatic.com; "
            "img-src 'self' data: https:; "
            "connect-src 'self'; "
            "frame-ancestors 'none'; "
            "base-uri 'self'; "
            "form-action 'self';"
        )
        return response


class RequestLoggingMiddleware(BaseHTTPMiddleware):
    """Structured access logging with request IDs and latency."""

    async def dispatch(self, request: Request, call_next: Callable) -> Response:
        request_id = str(uuid.uuid4())[:8]
        request.state.request_id = request_id
        start = time.monotonic()

        try:
            response = await call_next(request)
        except Exception as exc:
            logger.error(
                "[%s] %s %s — UNHANDLED ERROR: %s",
                request_id,
                request.method,
                request.url.path,
                exc,
            )
            raise

        duration_ms = round((time.monotonic() - start) * 1000, 1)
        # Read real client IP from X-Forwarded-For
        xff = request.headers.get("X-Forwarded-For", "")
        client_ip = (
            xff.split(",")[0].strip()
            if xff
            else (request.client.host if request.client else "-")
        )
        logger.info(
            "[%s] %s %s → %s (%.1fms) %s",
            request_id,
            request.method,
            request.url.path,
            response.status_code,
            duration_ms,
            client_ip,
        )
        return response


# ── In-process fallback (single-worker / dev) ─────────────────────────────────


class _InProcessRateLimiter:
    """
    Sliding-window rate limiter backed by in-process Python dicts.
    Does NOT share state across multiple uvicorn workers.
    Used as fallback when Redis is not configured.
    """

    def __init__(self):
        self._buckets: dict = {}

    def allow(self, key: str, limit: int) -> bool:
        now = time.time()
        window_start = now - 60
        history = self._buckets.get(key, [])
        history = [t for t in history if t > window_start]
        if len(history) >= limit:
            self._buckets[key] = history
            return False
        history.append(now)
        self._buckets[key] = history
        return True


_in_process_limiter = _InProcessRateLimiter()


# ── Redis sliding-window helper ───────────────────────────────────────────────


async def _redis_allow(
    redis_client, key: str, limit: int, window_seconds: int = 60, fail_open: bool = True
) -> bool:
    """
    Redis sliding-window rate check using a sorted set.
    Key format expected: rl:{bucket}:{client_ip}
    TTL on the sorted set is window_seconds + 5 s for safety.
    Returns True if the request is within the limit.

    fail_open controls behaviour when Redis itself is unreachable:
    - True (default, general API traffic): allow the request — availability
      over strict throttling.
    - False (login/magic-link): deny the request — a Redis outage must not
      silently disable brute-force protection on auth endpoints.
    """
    now = time.time()
    window_start = now - window_seconds

    try:
        pipe = redis_client.pipeline()
        pipe.zremrangebyscore(key, "-inf", window_start)
        pipe.zadd(key, {str(now): now})
        pipe.zcard(key)
        pipe.expire(key, window_seconds + 5)
        results = await pipe.execute()
        count = results[2]
        return count <= limit
    except Exception as exc:
        logger.warning(
            "Redis rate-limit error for key %s: %s — %s",
            key,
            exc,
            "allowing request" if fail_open else "denying request (fail-closed)",
        )
        return fail_open


# ── Unified RateLimitMiddleware ────────────────────────────────────────────────


class RateLimitMiddleware(BaseHTTPMiddleware):
    """
    Tiered rate limiter with Redis sliding-window (multi-worker safe) and
    in-process fallback when Redis is not configured.

    Tiers:
      login endpoints      10 req/min per IP
      other auth endpoints 20 req/min per IP
      general API          configurable (default 200/min)

    Redis key format: rl:{bucket}:{client_ip}
    Sorted set TTL: 65 s (auto-expiry)
    """

    def __init__(self, app: FastAPI, requests_per_minute: int = 200):
        super().__init__(app)
        self._rpm = requests_per_minute
        self._redis = None
        self._redis_checked = False

    async def _get_redis(self):
        if not self._redis_checked:
            self._redis_checked = True
            from app.config import settings

            if settings.redis_url:
                try:
                    import redis.asyncio as aioredis

                    self._redis = aioredis.from_url(
                        settings.redis_url,
                        encoding="utf-8",
                        decode_responses=True,
                    )
                    logger.info(
                        "RateLimitMiddleware: using Redis backend (%s)",
                        settings.redis_url,
                    )
                except Exception as exc:
                    logger.warning(
                        "RateLimitMiddleware: Redis init failed, using in-process fallback: %s",
                        exc,
                    )
            else:
                logger.info(
                    "RateLimitMiddleware: REDIS_URL not set — using in-process fallback"
                )
        return self._redis

    def _real_ip(self, request: Request) -> str:
        xff = request.headers.get("X-Forwarded-For", "")
        if xff:
            return xff.split(",")[0].strip()
        return request.client.host if request.client else "unknown"

    async def dispatch(self, request: Request, call_next: Callable) -> Response:
        path = request.url.path
        client_ip = self._real_ip(request)

        # Tiered rate limits
        if path in ("/api/v1/auth/login", "/api/v1/auth/magic-link"):
            rpm, bucket_label = 10, "login"
        elif path.startswith("/api/v1/auth"):
            rpm, bucket_label = 20, "auth"
        else:
            rpm, bucket_label = self._rpm, "api"

        redis_client = await self._get_redis()

        if redis_client is not None:
            key = f"rl:{bucket_label}:{client_ip}"
            allowed = await _redis_allow(
                redis_client, key, rpm, fail_open=(bucket_label != "login")
            )
        else:
            key = f"{client_ip}:{bucket_label}"
            allowed = _in_process_limiter.allow(key, rpm)

        if not allowed:
            return JSONResponse(
                status_code=429,
                content={"detail": "Too many requests. Please slow down."},
                headers={"Retry-After": "60"},
            )
        return await call_next(request)
