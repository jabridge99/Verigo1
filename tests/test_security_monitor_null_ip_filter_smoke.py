"""
Regression test for a confirmed logic bug in
app/api/routes/security_monitor.py's security_summary() and
active_alerts(): both built their brute-force-detection query with
`SecurityEvent.ip_address is not None` inside `.filter(...)`.

That's a Python identity check against the SQLAlchemy class attribute
itself (never actually None), not a SQL predicate -- it always evaluates
to the constant True, so events with a NULL ip_address were silently
NOT excluded from the brute-force count. Confirmed via mypy once the
SQLAlchemy plugin was enabled ("bool" is not a valid filter() argument
type). Fixed to `.is_not(None)`, the real SQL IS NOT NULL predicate.
"""

import uuid
from datetime import datetime, timedelta, timezone

from app.models.security_event import SecurityEvent
from tests.conftest import _auth


def _event(ip_address, minutes_ago=1):
    return SecurityEvent(
        event_id=f"sec_{uuid.uuid4().hex[:12]}",
        event_type="login_failed",
        ip_address=ip_address,
        created_at=datetime.now(timezone.utc) - timedelta(minutes=minutes_ago),
    )


def test_null_ip_failed_logins_excluded_from_brute_force_alert(
    client, super_admin_user, db
):
    # 25 failed logins with no ip_address recorded -- previously counted
    # toward brute-force detection despite the filter meant to exclude them.
    for _ in range(25):
        db.add(_event(None))
    db.commit()

    resp = client.get("/api/v1/security/alerts", headers=_auth(super_admin_user))
    assert resp.status_code == 200, resp.text
    alerts = resp.json()["alerts"] if "alerts" in resp.json() else resp.json()
    brute_force = [a for a in alerts if a.get("type") == "brute_force"]
    assert brute_force == []


def test_real_ip_still_triggers_brute_force_alert(client, super_admin_user, db):
    for _ in range(25):
        db.add(_event("203.0.113.7"))
    db.commit()

    resp = client.get("/api/v1/security/alerts", headers=_auth(super_admin_user))
    assert resp.status_code == 200, resp.text
    alerts = resp.json()["alerts"] if "alerts" in resp.json() else resp.json()
    brute_force = [a for a in alerts if a.get("type") == "brute_force"]
    assert len(brute_force) == 1
    assert brute_force[0]["ip_address"] == "203.0.113.7"


def test_role_change_audit_reads_real_metadata(client, super_admin_user, db):
    """
    role_change_audit() read e.metadata -- not a real column (the real
    one is extra_metadata) but a valid attribute on every SQLAlchemy
    declarative class (the class's own MetaData object), so on a
    freshly-queried row json.loads() always got a MetaData object
    instead of a JSON string, always raised, and was always silently
    swallowed by the surrounding try/except -- every role-change event
    the audit endpoint ever returned had target_user_id/from_role/
    to_role hardcoded to None regardless of what was actually recorded.
    """
    import json

    db.add(
        SecurityEvent(
            event_id=f"sec_{uuid.uuid4().hex[:12]}",
            event_type="role_changed",
            extra_metadata=json.dumps(
                {"target": "usr_abc123", "from": "analyst", "to": "compliance"}
            ),
            created_at=datetime.now(timezone.utc),
        )
    )
    db.commit()

    resp = client.get("/api/v1/security/role-changes", headers=_auth(super_admin_user))
    assert resp.status_code == 200, resp.text
    events = resp.json()["events"]
    assert len(events) == 1
    assert events[0]["target_user_id"] == "usr_abc123"
    assert events[0]["from_role"] == "analyst"
    assert events[0]["to_role"] == "compliance"
