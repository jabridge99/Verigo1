"""
Smoke test: app.services.auth_service.seed_master_admin resyncs the master
admin's password/role to MASTER_ADMIN_PASSWORD on every boot, but previously
left no audit trail — an investigator would have no record of when/why this
privileged account's credentials changed. Fixed by writing a LegacyAuditLog
entry whenever a resync actually changes something.
"""

from app.config import settings
from app.models.audit import LegacyAuditLog
from app.models.user import User, UserStatus
from app.services.auth_service import hash_password, seed_master_admin


def test_password_resync_writes_audit_entry(db, monkeypatch):
    monkeypatch.setattr(settings, "master_admin_email", "boss@example.com")
    monkeypatch.setattr(settings, "master_admin_password", "CorrectHorseBattery1!")

    user = User(
        email="boss@example.com",
        full_name="Master Admin",
        hashed_password=hash_password("some-stale-password"),
        role="admin",
        status=UserStatus.active,
        email_verified=True,
        is_super_admin=True,
    )
    db.add(user)
    db.commit()

    seed_master_admin(db)

    entries = (
        db.query(LegacyAuditLog)
        .filter(LegacyAuditLog.action == "master_admin.resync")
        .all()
    )
    assert len(entries) == 1
    assert "password" in entries[0].notes


def test_no_resync_means_no_audit_entry(db, monkeypatch):
    monkeypatch.setattr(settings, "master_admin_email", "boss2@example.com")
    monkeypatch.setattr(settings, "master_admin_password", "CorrectHorseBattery1!")

    user = User(
        email="boss2@example.com",
        full_name="Master Admin",
        hashed_password=hash_password("CorrectHorseBattery1!"),
        role="admin",
        status=UserStatus.active,
        email_verified=True,
        is_super_admin=True,
    )
    db.add(user)
    db.commit()

    seed_master_admin(db)

    entries = (
        db.query(LegacyAuditLog)
        .filter(LegacyAuditLog.action == "master_admin.resync")
        .all()
    )
    assert len(entries) == 0
