"""
Smoke test: POST /auth/register checked get_user_by_email, then inserted —
classic check-then-insert race. Two concurrent registrations for the same
email could both pass the check before either commits, and the loser hit an
unhandled IntegrityError (500) from the unique constraint on User.email
instead of a clean 409. Simulated here by forcing create_user to raise
IntegrityError as if a concurrent insert won the race.
"""

from unittest.mock import patch

from sqlalchemy.exc import IntegrityError


def test_concurrent_duplicate_registration_returns_409(client):
    with patch(
        "app.api.routes.auth.create_user",
        side_effect=IntegrityError("dup", {}, Exception("unique violation")),
    ):
        resp = client.post(
            "/api/v1/auth/register",
            json={
                "email": "racewinner@test.com",
                "full_name": "Race Winner",
                "password": "SecurePass123!",
            },
        )
    assert resp.status_code == 409
