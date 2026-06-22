"""
Smoke test: Settings.secret_key previously defaulted to
secrets.token_urlsafe(32), generated fresh per process. With multiple
worker processes, each got a different secret, so JWTs signed by one worker
failed validation on another — and the value could never equal the literal
"change-me-in-production" string the production startup guard checks for,
silently defeating that guard. Fixed by defaulting to that literal
placeholder.
"""

from app.config import Settings


def test_secret_key_default_is_consistent_across_instances():
    a = Settings(database_url="sqlite:///./a.db")
    b = Settings(database_url="sqlite:///./b.db")
    assert a.secret_key == b.secret_key


def test_unset_secret_key_is_caught_by_production_guard():
    import pytest

    with pytest.raises(ValueError, match="SECRET_KEY"):
        Settings(
            environment="production",
            database_url="postgresql://localhost/test",
            cors_origins="https://app.example.com",
        )
