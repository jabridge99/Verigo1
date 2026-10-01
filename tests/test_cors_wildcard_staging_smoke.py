"""
Smoke test: Settings.check_production_secrets() previously only rejected
wildcard CORS_ORIGINS ("*") when environment == "production". CORSMiddleware
is wired with allow_credentials=True regardless of environment, so a
staging deployment (a valid, commonly internet-exposed environment value)
with the default cors_origins="*" would pass validation and let
CORSMiddleware echo back any request's Origin header with credentials
enabled — a CSRF/cookie-theft hole. Fixed by also rejecting wildcard CORS
for environment == "staging".
"""

import pytest

from app.config import Settings


def test_wildcard_cors_rejected_in_staging():
    with pytest.raises(ValueError, match="CORS_ORIGINS"):
        Settings(environment="staging", cors_origins="*", secret_key="x")


def test_wildcard_cors_rejected_in_production():
    with pytest.raises(ValueError, match="CORS_ORIGINS"):
        Settings(
            environment="production",
            cors_origins="*",
            secret_key="x",
            database_url="postgresql://localhost/test",
        )


def test_explicit_cors_origin_allowed_in_staging():
    s = Settings(
        environment="staging",
        cors_origins="https://staging.example.com",
        secret_key="x",
    )
    assert s.cors_origins_list == ["https://staging.example.com"]


def test_wildcard_cors_allowed_in_development():
    s = Settings(environment="development", cors_origins="*", secret_key="x")
    assert s.cors_origins_list == ["*"]


def test_default_secret_key_rejected_in_staging():
    # Previously only environment == "production" checked this -- a staging
    # deploy left at the default secret would sign valid auth tokens using
    # a value visible in the public source, same class of hole as wildcard
    # CORS in staging above.
    with pytest.raises(ValueError, match="SECRET_KEY"):
        Settings(
            environment="staging",
            cors_origins="https://staging.example.com",
            secret_key="change-me-in-production",
        )


def test_default_secret_key_allowed_in_development():
    s = Settings(
        environment="development",
        cors_origins="*",
        secret_key="change-me-in-production",
    )
    assert s.secret_key == "change-me-in-production"
