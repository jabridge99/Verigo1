"""
P45: the Integration Hub's connection test and OAuth2 flow both fabricated
success. POST /{slug}/test set health_status=healthy and "Connection
validated" purely from `bool(credentials_encrypted)` -- it never called
the provider. POST /{slug}/oauth/authorize built a fake authorize_url on a
non-existent `*.example` domain, and the frontend never even sent the
user there: it called /oauth/callback directly with a synthetic code,
which unconditionally derived fake tokens and marked the integration
"healthy"/"connected". A compliance officer enabling a provider here (say,
ComplyAdvantage) could reasonably believe a live AML function was now
working when nothing had been verified at all.

Fixed by making /test always report health_status=unknown (it only
confirms credentials were stored, never claims they work), and by making
both OAuth endpoints refuse with 501 -- no provider in this catalog has a
real OAuth2 app configured, so there is nothing to actually connect to.
"""

import uuid

from app.models.integration import (
    IntegrationHealthStatus,
)


def _enable(client, headers, slug, credentials=None):
    return client.post(
        f"/api/v1/integrations/{slug}/enable",
        json={"credentials": credentials or {"api_key": "test-key-123"}, "config": {}},
        headers=headers,
    )


# ── /test no longer fabricates a healthy/validated result ───────────────────


def test_connection_test_reports_unknown_not_healthy_even_with_credentials(
    client, compliance_headers
):
    enable_resp = _enable(client, compliance_headers, "sumsub")
    assert enable_resp.status_code == 201, enable_resp.text

    resp = client.post("/api/v1/integrations/sumsub/test", headers=compliance_headers)
    assert resp.status_code == 200, resp.text
    body = resp.json()
    assert body["health_status"] == IntegrationHealthStatus.unknown.value
    assert "isn't built yet" in body["message"]
    assert "validated" not in body["message"].lower()


def test_connection_test_with_no_credentials_still_reports_no_credentials(
    client, compliance_headers, db
):
    # enable() always stores something, so drop credentials directly to hit
    # the "no credentials" branch.
    enable_resp = _enable(client, compliance_headers, "sumsub")
    integration_id = enable_resp.json()["id"]
    from app.models.integration import OrgIntegration

    row = db.query(OrgIntegration).filter(OrgIntegration.id == integration_id).first()
    row.credentials_encrypted = None
    db.commit()

    resp = client.post("/api/v1/integrations/sumsub/test", headers=compliance_headers)
    assert resp.status_code == 200, resp.text
    body = resp.json()
    assert body["test_passed"] is False
    assert body["health_status"] == IntegrationHealthStatus.unknown.value
    assert body["message"] == "No credentials configured."


# ── OAuth endpoints refuse rather than fabricate a connection ───────────────


def test_start_oauth_refuses_for_oauth2_provider(client, compliance_headers):
    resp = client.post(
        "/api/v1/integrations/salesforce/oauth/authorize", headers=compliance_headers
    )
    assert resp.status_code == 501, resp.text
    assert "isn't implemented" in resp.json()["detail"]


def test_start_oauth_still_validates_provider_exists_and_is_oauth2(
    client, compliance_headers, db
):
    # A non-existent slug should still 404, not 501 -- the refusal only
    # applies once we know it's a real oauth2 provider.
    resp = client.post(
        "/api/v1/integrations/does-not-exist/oauth/authorize",
        headers=compliance_headers,
    )
    assert resp.status_code == 404, resp.text

    # A real, non-oauth2 provider (sumsub uses api_key) should still 409.
    resp2 = client.post(
        "/api/v1/integrations/sumsub/oauth/authorize", headers=compliance_headers
    )
    assert resp2.status_code == 409, resp2.text


def test_start_oauth_does_not_persist_any_oauth_state(client, compliance_headers, db):
    client.post(
        "/api/v1/integrations/salesforce/oauth/authorize", headers=compliance_headers
    )
    from app.models.integration import OrgIntegration

    rows = (
        db.query(OrgIntegration)
        .filter(OrgIntegration.provider_slug == "salesforce")
        .all()
    )
    assert rows == []


def test_complete_oauth_refuses_and_cannot_fabricate_a_connection(
    client, compliance_headers
):
    resp = client.post(
        "/api/v1/integrations/salesforce/oauth/callback",
        json={"code": f"demo_{uuid.uuid4().hex}", "state": "irrelevant"},
        headers=compliance_headers,
    )
    assert resp.status_code == 501, resp.text
    assert "isn't implemented" in resp.json()["detail"]
