"""
Regression test for a confirmed crash in
app/services/auth_service.py's record_security_event(): it constructed
SecurityEvent(..., metadata=json.dumps(meta or {})), but `metadata` is a
reserved attribute name on every SQLAlchemy declarative model (the class's
MetaData object) -- not a real column (the real one is `extra_metadata`).
This raised on every call, silently swallowed by record_security_event()'s
own blanket try/except ("never block auth flows"), meaning the
security_events table has never actually received a row: every login,
MFA, password-change, and magic-link event this function is called for
(dozens of call sites in app/api/routes/auth.py) was silently dropped.

Confirmed via mypy once the SQLAlchemy plugin was enabled
(Unexpected keyword argument "metadata" for "SecurityEvent").
"""

from app.models.security_event import SecurityEvent
from app.services.auth_service import record_security_event


def test_record_security_event_actually_writes_a_row(db, admin_user):
    before = db.query(SecurityEvent).count()

    record_security_event(
        db,
        "login_success",
        admin_user.id,
        ip="203.0.113.9",
        meta={"method": "password"},
    )

    after = db.query(SecurityEvent).count()
    assert after == before + 1

    ev = (
        db.query(SecurityEvent)
        .filter(SecurityEvent.user_id == admin_user.id)
        .order_by(SecurityEvent.id.desc())
        .first()
    )
    assert ev is not None
    assert ev.event_type == "login_success"
    assert ev.ip_address == "203.0.113.9"
    assert "method" in (ev.extra_metadata or "")
