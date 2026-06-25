"""
Phase G — transactional email abstraction. Console provider is used in
tests (default backend), so these verify template rendering and that
verification/password-reset requests trigger a send without raising.
"""

from app.models.user import UserRole, UserStatus
from app.services import email_service
from app.services.email.console import ConsoleEmailProvider
from app.services.email.factory import get_email_provider
from tests.conftest import _make_user


def test_default_provider_is_console():
    assert isinstance(get_email_provider(), ConsoleEmailProvider)


def test_send_email_verification_succeeds():
    assert email_service.send_email_verification("user@example.com", "Jane Doe", "tok123") is True


def test_send_password_reset_succeeds():
    assert email_service.send_password_reset("user@example.com", "Jane Doe", "tok456") is True


def test_send_training_reminder_succeeds():
    assert email_service.send_training_reminder(
        "user@example.com", "Jane Doe", "AML/CTF Fundamentals", "2026-07-01"
    ) is True


def test_send_review_reminder_succeeds():
    assert email_service.send_review_reminder(
        "user@example.com", "Jane Doe", "Acme Pty Ltd", "REV-001", "2026-07-15"
    ) is True


def test_send_smr_review_notice_succeeds():
    assert email_service.send_smr_review_notice(
        "user@example.com", "Jane Doe", "SMR-001", "Acme Pty Ltd", 2
    ) is True


def test_email_verify_request_triggers_send(client, db):
    user = _make_user(db, UserRole.analyst, industry_id="IND-EMAIL-001")
    user.email_verified = False
    db.commit()
    res = client.post("/api/v1/auth/email/verify/request", json={"email": user.email})
    assert res.status_code == 200
    assert "dev_token" in res.json()


def test_password_reset_request_triggers_send(client, db):
    user = _make_user(db, UserRole.analyst, industry_id="IND-EMAIL-002")
    user.status = UserStatus.active
    user.hashed_password = "sha256$dummy"
    db.commit()
    res = client.post("/api/v1/auth/password-reset/request", json={"email": user.email})
    assert res.status_code == 200
    assert "dev_token" in res.json()
