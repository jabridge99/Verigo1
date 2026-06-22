"""
Smoke test: api_key_service.update_webhook() previously skipped
_validate_webhook_url() — create_webhook() validated the URL against SSRF
(private IPs, localhost, cloud metadata hosts, non-HTTPS), but update_webhook()
applied incoming fields directly via setattr() with no re-validation. An
attacker could create a webhook with a safe HTTPS URL, then PATCH it to an
internal/metadata address and trigger an outbound request via the existing
test-fire / event-dispatch paths. Fixed by validating data.url in
update_webhook() whenever "url" is present in the update payload.
"""

import pytest

from app.schemas.api_key import WebhookCreate, WebhookUpdate
from app.services import api_key_service as svc


def test_create_webhook_rejects_ssrf_url(db, admin_user):
    with pytest.raises(ValueError):
        svc.create_webhook(
            db,
            WebhookCreate(
                name="evil",
                url="http://169.254.169.254/latest/meta-data/",
                events=["test.ping"],
            ),
            admin_user.id,
            admin_user.org_id,
        )


def test_update_webhook_rejects_ssrf_url(db, admin_user):
    wh = svc.create_webhook(
        db,
        WebhookCreate(
            name="safe",
            url="https://example.com/hook",
            events=["test.ping"],
        ),
        admin_user.id,
        admin_user.org_id,
    )

    with pytest.raises(ValueError):
        svc.update_webhook(
            db,
            wh.webhook_id,
            admin_user.id,
            WebhookUpdate(url="http://169.254.169.254/latest/meta-data/"),
        )


def test_update_webhook_allows_safe_url_change(db, admin_user):
    wh = svc.create_webhook(
        db,
        WebhookCreate(
            name="safe",
            url="https://example.com/hook",
            events=["test.ping"],
        ),
        admin_user.id,
        admin_user.org_id,
    )

    updated = svc.update_webhook(
        db,
        wh.webhook_id,
        admin_user.id,
        WebhookUpdate(url="https://example.org/new-hook"),
    )
    assert updated.url == "https://example.org/new-hook"
