"""
Health check endpoints — liveness, readiness, and detailed status.

Registered WITHOUT /api/v1 prefix so probes work at:
  GET /health          — liveness  (Kubernetes livenessProbe)
  GET /health/ready    — readiness (Kubernetes readinessProbe)
  GET /health/detailed — admin-only full diagnostics
"""

import asyncio
import logging
import time
from datetime import datetime, timezone
from typing import Optional

from fastapi import APIRouter, Depends, Header, HTTPException
from fastapi.responses import JSONResponse
from sqlalchemy.orm import Session

from app.config import settings
from app.db.database import get_db

log = logging.getLogger("tvg.health")
router = APIRouter(tags=["Health"])

_START_TIME = time.monotonic()


# ── Auth helper for admin-only endpoints ──────────────────────────────────────

def _require_admin(authorization: Optional[str] = Header(None)):
    """Lightweight admin check — raises 401/403 if caller is not an admin user."""
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Not authenticated")
    try:
        from app.services.auth_service import decode_token, get_user_by_id  # type: ignore
        from app.models.user import UserRole, UserStatus
        from app.db.database import SessionLocal

        token = authorization.removeprefix("Bearer ").strip()
        payload = decode_token(token)
        if not payload:
            raise HTTPException(status_code=401, detail="Invalid or expired token")

        db = SessionLocal()
        try:
            user = get_user_by_id(db, payload.get("sub", ""))
            if not user or user.status != UserStatus.active:
                raise HTTPException(status_code=401, detail="User not found or inactive")
            if user.role not in (UserRole.admin, UserRole.super_admin):
                raise HTTPException(status_code=403, detail="Admin role required")
            return user
        finally:
            db.close()
    except HTTPException:
        raise
    except Exception as exc:
        log.warning("Admin auth check failed: %s", exc)
        raise HTTPException(status_code=401, detail="Authentication error")


# ── Liveness ──────────────────────────────────────────────────────────────────

@router.get("/health", status_code=200, summary="Liveness probe")
def liveness():
    """Liveness probe — returns 200 if the process is running."""
    return {"status": "ok", "timestamp": datetime.now(timezone.utc).isoformat()}


# ── Readiness ─────────────────────────────────────────────────────────────────

@router.get("/health/ready", status_code=200, summary="Readiness probe")
async def readiness(db: Session = Depends(get_db)):
    """
    Readiness probe — checks DB connectivity (SELECT 1) and optionally Redis.
    Returns 503 if the database is unreachable.
    """
    checks: dict = {}

    # DB check
    try:
        db.execute(__import__("sqlalchemy").text("SELECT 1"))
        checks["database"] = "ok"
    except Exception as exc:
        log.error("Readiness DB check failed: %s", exc)
        checks["database"] = f"error: {exc}"

    # Redis check (optional — degraded Redis does NOT block readiness)
    if settings.redis_url:
        try:
            from app.services.cache import cache
            redis_ok = await cache.ping()
            checks["redis"] = "ok" if redis_ok else "error"
        except Exception as exc:
            log.warning("Readiness Redis check failed: %s", exc)
            checks["redis"] = "error"
    else:
        checks["redis"] = "not_configured"

    if checks["database"] != "ok":
        return JSONResponse(
            status_code=503,
            content={"status": "unavailable", "checks": checks},
        )

    return {"status": "ready", "checks": checks}


# ── Detailed (admin-only) ─────────────────────────────────────────────────────

@router.get("/health/detailed", status_code=200, summary="Detailed health (admin only)")
async def detailed_health(
    db: Session = Depends(get_db),
    _admin=Depends(_require_admin),
):
    """
    Detailed diagnostics — admin/ops use only (not for automated probes).

    Returns DB pool stats, Redis status, uptime, version, environment,
    and worker_queue_depth (stub 0 — BackgroundTasks are fire-and-forget).
    """
    uptime_seconds = round(time.monotonic() - _START_TIME, 1)
    checks: dict = {}

    # DB check
    try:
        db.execute(__import__("sqlalchemy").text("SELECT 1"))
        checks["database"] = "ok"
    except Exception as exc:
        checks["database"] = f"error: {exc}"

    # Redis check
    if settings.redis_url:
        try:
            from app.services.cache import cache
            redis_ok = await cache.ping()
            checks["redis"] = "ok" if redis_ok else "unreachable"
        except Exception as exc:
            checks["redis"] = f"error: {exc}"
    else:
        checks["redis"] = "not_configured"

    # DB pool info (PostgreSQL only; SQLite pool has no size())
    pool_info: dict = {}
    try:
        from app.db.database import engine
        pool = engine.pool
        pool_info = {
            "size": pool.size() if hasattr(pool, "size") else None,
            "checked_out": pool.checkedout() if hasattr(pool, "checkedout") else None,
            "overflow": pool.overflow() if hasattr(pool, "overflow") else None,
        }
    except Exception:
        pool_info = {}

    return {
        "status": "ok" if checks.get("database") == "ok" else "degraded",
        "version": settings.version,
        "environment": settings.environment,
        "uptime_seconds": uptime_seconds,
        "checks": checks,
        "db_pool": pool_info,
        "db_pool_size": pool_info.get("size"),
        "redis_url_configured": bool(settings.redis_url),
        "worker_queue_depth": 0,  # stub — update when an external queue is added
        "timestamp": datetime.now(timezone.utc).isoformat(),
    }
