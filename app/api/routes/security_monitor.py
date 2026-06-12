"""
Security Monitoring Dashboard API — Part 9 of enterprise security review.
Aggregates security events for the SOC/compliance dashboard.
All endpoints restricted to admin/mlro.
"""

from collections import defaultdict
from datetime import datetime, timedelta, timezone
from typing import Optional

from fastapi import APIRouter, Depends, Query
from sqlalchemy import desc, func
from sqlalchemy.orm import Session

from app.api.routes.auth import _require_roles
from app.db.database import get_db
from app.models.security_event import SecurityEvent
from app.models.user import User, UserRole

router = APIRouter(prefix="/security", tags=["Security Monitor"])

_PRIV = _require_roles(UserRole.admin, UserRole.mlro)


def _since(days: int) -> datetime:
    return datetime.now(timezone.utc) - timedelta(days=days)


@router.get("/events")
def list_security_events(
    event_type: Optional[str] = None,
    user_id: Optional[str] = None,
    days: int = Query(7, ge=1, le=365),
    skip: int = Query(0, ge=0),
    limit: int = Query(100, ge=1, le=1000),
    db: Session = Depends(get_db),
    current_user: User = Depends(_PRIV),
):
    """Paginated raw security event log."""
    q = db.query(SecurityEvent).filter(SecurityEvent.created_at >= _since(days))
    if event_type:
        q = q.filter(SecurityEvent.event_type == event_type)
    if user_id:
        q = q.filter(SecurityEvent.user_id == user_id)
    total = q.count()
    events = q.order_by(desc(SecurityEvent.created_at)).offset(skip).limit(limit).all()
    return {
        "total": total,
        "events": [
            {
                "event_id": e.event_id,
                "event_type": e.event_type,
                "user_id": e.user_id,
                "ip_address": e.ip_address,
                "created_at": e.created_at.isoformat() if e.created_at else None,
            }
            for e in events
        ],
    }


@router.get("/summary")
def security_summary(
    days: int = Query(30, ge=1, le=365),
    db: Session = Depends(get_db),
    current_user: User = Depends(_PRIV),
):
    """High-level security KPI summary for dashboard cards."""
    since = _since(days)
    q = db.query(SecurityEvent).filter(SecurityEvent.created_at >= since)

    total = q.count()
    by_type = (
        db.query(SecurityEvent.event_type, func.count(SecurityEvent.id).label("cnt"))
        .filter(SecurityEvent.created_at >= since)
        .group_by(SecurityEvent.event_type)
        .all()
    )
    type_counts = {row.event_type: row.cnt for row in by_type}

    failed_logins      = type_counts.get("login_failed", 0)
    mfa_failures       = type_counts.get("mfa_failed", 0)
    role_changes       = type_counts.get("role_changed", 0)
    user_suspensions   = type_counts.get("user_suspended", 0)
    magic_link_invalid = type_counts.get("magic_link_invalid", 0)

    # Unique IPs with >10 failed logins → brute-force candidates
    brute_force_ips = (
        db.query(SecurityEvent.ip_address, func.count(SecurityEvent.id).label("cnt"))
        .filter(
            SecurityEvent.event_type == "login_failed",
            SecurityEvent.created_at >= since,
            SecurityEvent.ip_address is not None,
            SecurityEvent.ip_address != "unknown",
        )
        .group_by(SecurityEvent.ip_address)
        .having(func.count(SecurityEvent.id) > 10)
        .all()
    )

    return {
        "period_days": days,
        "total_events": total,
        "failed_logins": failed_logins,
        "mfa_failures": mfa_failures,
        "role_changes": role_changes,
        "user_suspensions": user_suspensions,
        "invalid_magic_links": magic_link_invalid,
        "brute_force_candidates": [
            {"ip": row.ip_address, "failed_attempts": row.cnt}
            for row in brute_force_ips
        ],
    }


@router.get("/failed-logins")
def failed_login_analysis(
    days: int = Query(7, ge=1, le=90),
    db: Session = Depends(get_db),
    current_user: User = Depends(_PRIV),
):
    """Failed login breakdown by IP and time bucket for anomaly detection."""
    since = _since(days)
    events = (
        db.query(SecurityEvent)
        .filter(
            SecurityEvent.event_type == "login_failed",
            SecurityEvent.created_at >= since,
        )
        .order_by(desc(SecurityEvent.created_at))
        .all()
    )

    by_ip: dict = defaultdict(int)
    by_hour: dict = defaultdict(int)
    for e in events:
        by_ip[e.ip_address or "unknown"] += 1
        if e.created_at:
            hour_key = e.created_at.strftime("%Y-%m-%dT%H:00Z")
            by_hour[hour_key] += 1

    return {
        "total": len(events),
        "by_ip": [{"ip": ip, "count": cnt} for ip, cnt in sorted(by_ip.items(), key=lambda x: -x[1])[:50]],
        "by_hour": [{"hour": h, "count": c} for h, c in sorted(by_hour.items())],
    }


@router.get("/role-changes")
def role_change_audit(
    days: int = Query(90, ge=1, le=365),
    db: Session = Depends(get_db),
    current_user: User = Depends(_PRIV),
):
    """All role escalation events in the period."""
    import json
    events = (
        db.query(SecurityEvent)
        .filter(
            SecurityEvent.event_type == "role_changed",
            SecurityEvent.created_at >= _since(days),
        )
        .order_by(desc(SecurityEvent.created_at))
        .all()
    )
    result = []
    for e in events:
        meta = {}
        try:
            meta = json.loads(e.metadata or "{}")
        except Exception:
            pass
        result.append({
            "event_id": e.event_id,
            "actor_user_id": e.user_id,
            "target_user_id": meta.get("target"),
            "from_role": meta.get("from"),
            "to_role": meta.get("to"),
            "ip_address": e.ip_address,
            "created_at": e.created_at.isoformat() if e.created_at else None,
        })
    return {"total": len(result), "events": result}


@router.get("/mfa-status")
def mfa_adoption(
    db: Session = Depends(get_db),
    current_user: User = Depends(_PRIV),
):
    """MFA adoption rate across all users."""
    from app.models.user import User as UserModel
    total = db.query(UserModel).count()
    mfa_on = db.query(UserModel).filter(UserModel.mfa_enabled).count()
    mfa_off = total - mfa_on
    return {
        "total_users": total,
        "mfa_enabled": mfa_on,
        "mfa_disabled": mfa_off,
        "adoption_pct": round(mfa_on / total * 100, 1) if total else 0,
    }


@router.get("/alerts")
def active_alerts(
    db: Session = Depends(get_db),
    current_user: User = Depends(_PRIV),
):
    """
    Heuristic alert generation based on recent security events.
    Returns actionable alerts for the dashboard alert panel.
    """
    alerts = []
    since_1h = _since(0.042)   # 1 hour
    since_24h = _since(1)

    # Brute-force: >20 failed logins from single IP in last hour
    brute = (
        db.query(SecurityEvent.ip_address, func.count(SecurityEvent.id).label("cnt"))
        .filter(
            SecurityEvent.event_type == "login_failed",
            SecurityEvent.created_at >= since_1h,
            SecurityEvent.ip_address is not None,
        )
        .group_by(SecurityEvent.ip_address)
        .having(func.count(SecurityEvent.id) > 20)
        .all()
    )
    for row in brute:
        alerts.append({
            "severity": "critical",
            "type": "brute_force",
            "message": f"Brute-force suspected: {row.cnt} failed logins from {row.ip_address} in last hour",
            "ip_address": row.ip_address,
        })

    # Role escalation in last 24h
    role_count = (
        db.query(SecurityEvent)
        .filter(SecurityEvent.event_type == "role_changed", SecurityEvent.created_at >= since_24h)
        .count()
    )
    if role_count > 0:
        alerts.append({
            "severity": "high",
            "type": "role_escalation",
            "message": f"{role_count} role change(s) in the last 24 hours — review audit log",
        })

    # MFA disabled in last 24h
    mfa_off = (
        db.query(SecurityEvent)
        .filter(SecurityEvent.event_type == "mfa_disabled", SecurityEvent.created_at >= since_24h)
        .count()
    )
    if mfa_off > 0:
        alerts.append({
            "severity": "high",
            "type": "mfa_disabled",
            "message": f"{mfa_off} user(s) disabled MFA in the last 24 hours",
        })

    return {"alert_count": len(alerts), "alerts": alerts}
