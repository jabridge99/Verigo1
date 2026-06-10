"""
Production middleware: security headers, request logging, rate limiting.
"""

import time
import logging
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
        response.headers["X-Request-ID"] = request.state.request_id if hasattr(request.state, "request_id") else str(uuid.uuid4())[:8]
        # CSP — tighten in production by removing 'unsafe-inline' once styles are extracted
        response.headers["Content-Security-Policy"] = (
            "default-src 'self'; "
            "script-src 'self' 'unsafe-inline'; "
            "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; "
            "font-src 'self' https://fonts.gstatic.com; "
            "img-src 'self' data: https:; "
            "connect-src 'self'; "
            "frame-ancestors 'none';"
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
        logger.info(
            "[%s] %s %s → %s (%.1fms) %s",
            request_id,
            request.method,
            request.url.path,
            response.status_code,
            duration_ms,
            request.client.host if request.client else "-",
        )
        return response


class RateLimitMiddleware(BaseHTTPMiddleware):
    """
    Simple in-process token-bucket rate limiter.
    For production with multiple workers, use slowapi + Redis instead.
    """

    def __init__(self, app: FastAPI, requests_per_minute: int = 200):
        super().__init__(app)
        self._rpm = requests_per_minute
        self._buckets: dict = {}

    def _allow(self, key: str) -> bool:
        now = time.time()
        window_start = now - 60
        history = self._buckets.get(key, [])
        history = [t for t in history if t > window_start]
        if len(history) >= self._rpm:
            self._buckets[key] = history
            return False
        history.append(now)
        self._buckets[key] = history
        return True

    async def dispatch(self, request: Request, call_next: Callable) -> Response:
        # Auth endpoints get a stricter limit (20/min per IP)
        client_ip = request.client.host if request.client else "unknown"
        is_auth = request.url.path.startswith("/api/v1/auth")
        rpm = 20 if is_auth else self._rpm
        key = f"{client_ip}:{'auth' if is_auth else 'api'}"

        if not self._allow(key):
            return JSONResponse(
                status_code=429,
                content={"detail": "Too many requests. Please slow down."},
                headers={"Retry-After": "60"},
            )
        return await call_next(request)
