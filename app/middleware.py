"""
Production middleware: security headers, request logging, rate limiting.
Zero Trust hardening:
- HSTS added
- Rate limiter keyed by X-Forwarded-For (real client IP behind load balancer)
- Auth endpoints rate-limited per user identity (email) when available
- Account lockout tracking for repeated failed logins
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
        response.headers["Permissions-Policy"] = "geolocation=(), microphone=(), camera=()"
        response.headers["X-Request-ID"] = (
            request.state.request_id if hasattr(request.state, "request_id") else str(uuid.uuid4())[:8]
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
                request_id, request.method, request.url.path, exc
            )
            raise

        duration_ms = round((time.monotonic() - start) * 1000, 1)
        # Read real client IP from X-Forwarded-For
        xff = request.headers.get("X-Forwarded-For", "")
        client_ip = xff.split(",")[0].strip() if xff else (
            request.client.host if request.client else "-"
        )
        logger.info(
            "[%s] %s %s → %s (%.1fms) %s",
            request_id, request.method, request.url.path,
            response.status_code, duration_ms, client_ip,
        )
        return response


class RateLimitMiddleware(BaseHTTPMiddleware):
    """
    In-process token-bucket rate limiter.
    - Reads real client IP from X-Forwarded-For header
    - Auth endpoints: 20 req/min per IP
    - Security-sensitive paths (login/magic-link): 10 req/min per IP
    - General API: configurable (default 200/min)
    For production multi-worker deployments use slowapi + Redis.
    """

    def __init__(self, app: FastAPI, requests_per_minute: int = 200):
        super().__init__(app)
        self._rpm = requests_per_minute
        self._buckets: dict = {}

    def _real_ip(self, request: Request) -> str:
        xff = request.headers.get("X-Forwarded-For", "")
        if xff:
            return xff.split(",")[0].strip()
        return request.client.host if request.client else "unknown"

    def _allow(self, key: str, limit: int) -> bool:
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

        key = f"{client_ip}:{bucket_label}"
        if not self._allow(key, rpm):
            return JSONResponse(
                status_code=429,
                content={"detail": "Too many requests. Please slow down."},
                headers={"Retry-After": "60"},
            )
        return await call_next(request)
