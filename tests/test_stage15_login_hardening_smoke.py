"""
Stage 15 (Security Hardening): the User model has always had
failed_login_count/locked_until columns, but nothing ever read or wrote
them -- authenticate_user() only checked the password and status, so a
distributed credential-stuffing attack (a handful of wrong-password
attempts per account, from many different IPs) was throttled by nothing at
all; RateLimitMiddleware's login limit is per-IP only. Fixed by wiring the
existing columns into authenticate_user() and the /auth/login endpoint.

Also: /auth/register never enforced any password length/complexity, while
/me/change-password and /password-reset/confirm both require >=12 chars --
fixed by applying the same rule at registration.
"""

from app.services.auth_service import (
    FAILED_LOGIN_LOCK_THRESHOLD,
    account_lock_remaining,
    authenticate_user,
)


def _register(client, email: str, password: str = "SecurePass123!"):
    return client.post(
        "/api/v1/auth/register",
        json={"email": email, "full_name": "Lockout Test", "password": password},
    )


def test_account_locks_after_repeated_failed_logins(client, db):
    email = "lockout-target@test.com"
    resp = _register(client, email)
    assert resp.status_code == 201, resp.text

    for _ in range(FAILED_LOGIN_LOCK_THRESHOLD):
        bad = client.post(
            "/api/v1/auth/login",
            json={"email": email, "password": "definitely-wrong"},
        )
        assert bad.status_code == 401

    # One more attempt, even with the *correct* password, is now blocked --
    # this is the actual lockout, not just another failed attempt.
    locked = client.post(
        "/api/v1/auth/login", json={"email": email, "password": "SecurePass123!"}
    )
    assert locked.status_code == 423
    assert "locked" in locked.json()["detail"].lower()


def test_successful_login_resets_failed_count(client, db):
    email = "lockout-reset@test.com"
    resp = _register(client, email, "SecurePass123!")
    assert resp.status_code == 201, resp.text

    for _ in range(FAILED_LOGIN_LOCK_THRESHOLD - 1):
        client.post(
            "/api/v1/auth/login",
            json={"email": email, "password": "definitely-wrong"},
        )

    ok = client.post(
        "/api/v1/auth/login", json={"email": email, "password": "SecurePass123!"}
    )
    assert ok.status_code == 200

    from app.services.auth_service import get_user_by_email

    user = get_user_by_email(db, email)
    assert user.failed_login_count == 0
    assert user.locked_until is None


def test_authenticate_user_directly_enforces_lockout(db):
    import uuid

    from app.models.user import User, UserRole, UserStatus
    from app.services.auth_service import hash_password

    user = User(
        email=f"direct-{uuid.uuid4().hex[:6]}@test.com",
        full_name="Direct Test",
        hashed_password=hash_password("SecurePass123!"),
        role=UserRole.analyst,
        status=UserStatus.active,
    )
    db.add(user)
    db.commit()

    for _ in range(FAILED_LOGIN_LOCK_THRESHOLD):
        result = authenticate_user(db, user.email, "wrong-password")
        assert result is None

    db.refresh(user)
    assert account_lock_remaining(user) is not None
    # Correct password no longer works while locked.
    assert authenticate_user(db, user.email, "SecurePass123!") is None


def test_registration_rejects_short_password(client):
    resp = _register(client, "short-pw@test.com", "tiny1")
    assert resp.status_code == 400
    assert "12 characters" in resp.json()["detail"]


def test_registration_accepts_password_meeting_length(client):
    resp = _register(client, "long-enough-pw@test.com", "SecurePass123!")
    assert resp.status_code == 201, resp.text
