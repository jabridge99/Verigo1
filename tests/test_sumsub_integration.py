"""Tests for Sumsub identity provider, usage billing service, and the
/kyc/sumsub/token + /kyc/webhooks/sumsub routes."""
import hashlib
import hmac
import json
import uuid

import pytest

from app import config as config_module
from app.integrations.base import ProviderUnavailableError
from app.integrations.identity import factory as identity_factory
from app.integrations.identity.sumsub import SumsubProvider
from app.models.customer import Customer, CustomerStatus, CustomerType
from app.models.usage import UsageEventType, UsageRecordStatus
from app.services.usage_billing_service import (
    find_by_reference,
    mark_completed,
    mark_failed,
    record_usage,
    usage_summary,
)


def _make_customer(db, org_id, status=CustomerStatus.draft):
    customer = Customer(
        customer_ref=f"CUST-{uuid.uuid4().hex[:8]}",
        org_id=org_id,
        customer_type=CustomerType.individual,
        status=status,
        full_name="Jane Doe",
    )
    db.add(customer)
    db.commit()
    db.refresh(customer)
    return customer


# ── SumsubProvider signing / webhook verification ───────────────────────────

def test_sumsub_webhook_signature_valid():
    provider = SumsubProvider("app-token", "secret-key", "https://api.sumsub.com")
    body = b'{"type": "applicantReviewed"}'
    sig = hmac.new(b"secret-key", body, hashlib.sha256).hexdigest()
    assert provider.verify_webhook_signature(body, sig) is True


def test_sumsub_webhook_signature_invalid():
    provider = SumsubProvider("app-token", "secret-key", "https://api.sumsub.com")
    body = b'{"type": "applicantReviewed"}'
    assert provider.verify_webhook_signature(body, "deadbeef") is False


def test_sumsub_provider_requires_credentials():
    with pytest.raises(ProviderUnavailableError):
        SumsubProvider("", "", "https://api.sumsub.com")


def test_sumsub_parse_webhook_event_pass():
    provider = SumsubProvider("app-token", "secret-key", "https://api.sumsub.com")
    payload = {
        "applicantId": "applicant-1",
        "externalUserId": "cust-1",
        "reviewResult": {"reviewAnswer": "GREEN"},
    }
    status = provider.parse_webhook_event(payload)
    assert status.review_result == "pass"
    assert status.external_user_id == "cust-1"


def test_sumsub_parse_webhook_event_fail():
    provider = SumsubProvider("app-token", "secret-key", "https://api.sumsub.com")
    payload = {
        "applicantId": "applicant-1",
        "externalUserId": "cust-1",
        "reviewResult": {"reviewAnswer": "RED"},
    }
    status = provider.parse_webhook_event(payload)
    assert status.review_result == "fail"


# ── factory ──────────────────────────────────────────────────────────────────

def test_get_provider_raises_when_internal(monkeypatch):
    monkeypatch.setattr(config_module.settings, "identity_provider", "internal")
    with pytest.raises(NotImplementedError):
        identity_factory.get_provider()


def test_get_provider_returns_sumsub_when_configured(monkeypatch):
    monkeypatch.setattr(config_module.settings, "identity_provider", "sumsub")
    monkeypatch.setattr(config_module.settings, "sumsub_app_token", "tok")
    monkeypatch.setattr(config_module.settings, "sumsub_secret_key", "secret")
    provider = identity_factory.get_provider()
    assert isinstance(provider, SumsubProvider)


# ── usage_billing_service ───────────────────────────────────────────────────

def test_record_usage_computes_billed_amount(db, admin_user):
    record = record_usage(
        db,
        org_id=admin_user.org_id,
        event_type=UsageEventType.identity_verification,
        provider="sumsub",
        customer_id="cust-1",
        provider_reference="cust-1",
        unit_cost_aud=2.0,
        markup_pct=50.0,
    )
    assert record.billed_amount_aud == 3.0
    assert record.status == UsageRecordStatus.pending


def test_mark_completed_and_failed(db, admin_user):
    record = record_usage(
        db,
        org_id=admin_user.org_id,
        event_type=UsageEventType.identity_verification,
        provider="sumsub",
        provider_reference="ref-1",
        unit_cost_aud=2.0,
        markup_pct=50.0,
    )
    mark_completed(db, record)
    assert record.status == UsageRecordStatus.completed
    assert record.billed_amount_aud == 3.0

    record2 = record_usage(
        db,
        org_id=admin_user.org_id,
        event_type=UsageEventType.identity_verification,
        provider="sumsub",
        provider_reference="ref-2",
        unit_cost_aud=2.0,
        markup_pct=50.0,
    )
    mark_failed(db, record2)
    assert record2.status == UsageRecordStatus.failed
    assert record2.billed_amount_aud == 0.0


def test_find_by_reference_returns_latest(db, admin_user):
    from datetime import datetime, timedelta, timezone

    first = record_usage(
        db, org_id=admin_user.org_id, event_type=UsageEventType.identity_verification,
        provider="sumsub", provider_reference="dup-ref", unit_cost_aud=2.0, markup_pct=0,
    )
    first.created_at = datetime.now(timezone.utc) - timedelta(hours=1)
    db.commit()
    second = record_usage(
        db, org_id=admin_user.org_id, event_type=UsageEventType.identity_verification,
        provider="sumsub", provider_reference="dup-ref", unit_cost_aud=2.0, markup_pct=0,
    )
    found = find_by_reference(db, "sumsub", "dup-ref")
    assert found.id == second.id


def test_usage_summary_aggregates(db, admin_user):
    from datetime import datetime, timedelta, timezone

    r1 = record_usage(
        db, org_id=admin_user.org_id, event_type=UsageEventType.identity_verification,
        provider="sumsub", provider_reference="s1", unit_cost_aud=2.0, markup_pct=50,
    )
    mark_completed(db, r1)
    r2 = record_usage(
        db, org_id=admin_user.org_id, event_type=UsageEventType.business_verification,
        provider="sumsub", provider_reference="s2", unit_cost_aud=4.0, markup_pct=50,
    )
    mark_completed(db, r2)

    start = datetime.now(timezone.utc) - timedelta(days=1)
    end = datetime.now(timezone.utc) + timedelta(days=1)
    summary = usage_summary(db, admin_user.org_id, start, end)
    assert summary["check_count"] == 2
    assert summary["total_billed_aud"] == 9.0
    assert "identity_verification" in summary["by_event_type"]
    assert "business_verification" in summary["by_event_type"]


# ── /kyc/{customer_id}/sumsub/token route ───────────────────────────────────

def test_sumsub_token_route_503_when_internal(client, admin_headers, admin_user, db):
    customer = _make_customer(db, admin_user.org_id)
    resp = client.post(f"/api/v1/kyc/{customer.id}/sumsub/token", headers=admin_headers)
    assert resp.status_code == 503


def test_sumsub_token_route_404_unknown_customer(client, admin_headers):
    resp = client.post("/api/v1/kyc/does-not-exist/sumsub/token", headers=admin_headers)
    assert resp.status_code == 404


def test_sumsub_token_route_403_cross_tenant(client, analyst_headers, analyst_user, db):
    other_org_user_customer = _make_customer(db, "some-other-org-id")
    resp = client.post(
        f"/api/v1/kyc/{other_org_user_customer.id}/sumsub/token", headers=analyst_headers
    )
    assert resp.status_code == 403


def test_sumsub_token_route_success(client, admin_headers, admin_user, db, monkeypatch):
    customer = _make_customer(db, admin_user.org_id)

    class _FakeToken:
        token = "fake-token"
        applicant_id = customer.id
        expires_in_seconds = 600

    class _FakeProvider:
        name = "sumsub"

        async def generate_access_token(self, applicant_external_user_id, level_name):
            return _FakeToken()

    monkeypatch.setattr(
        "app.api.routes.kyc.get_provider", lambda: _FakeProvider()
    )
    resp = client.post(f"/api/v1/kyc/{customer.id}/sumsub/token", headers=admin_headers)
    assert resp.status_code == 200
    body = resp.json()
    assert body["token"] == "fake-token"

    usage = find_by_reference(db, "sumsub", customer.id)
    assert usage is not None
    assert usage.status == UsageRecordStatus.pending


# ── /kyc/webhooks/sumsub route ──────────────────────────────────────────────

def _sign(body: bytes, secret: str) -> str:
    return hmac.new(secret.encode(), body, hashlib.sha256).hexdigest()


def test_webhook_rejects_bad_signature(client, monkeypatch, admin_user):
    monkeypatch.setattr(config_module.settings, "identity_provider", "sumsub")
    monkeypatch.setattr(config_module.settings, "sumsub_app_token", "tok")
    monkeypatch.setattr(config_module.settings, "sumsub_secret_key", "secret")

    payload = {"applicantId": "a1", "externalUserId": "c1", "reviewResult": {"reviewAnswer": "GREEN"}}
    body = json.dumps(payload).encode()
    resp = client.post(
        "/api/v1/kyc/webhooks/sumsub",
        content=body,
        headers={"x-payload-digest": "bad-signature", "content-type": "application/json"},
    )
    assert resp.status_code == 401


def test_webhook_marks_usage_completed_and_advances_customer(
    client, monkeypatch, db, admin_user
):
    monkeypatch.setattr(config_module.settings, "identity_provider", "sumsub")
    monkeypatch.setattr(config_module.settings, "sumsub_app_token", "tok")
    monkeypatch.setattr(config_module.settings, "sumsub_secret_key", "secret")

    customer = _make_customer(db, admin_user.org_id, status=CustomerStatus.pending)
    record_usage(
        db,
        org_id=admin_user.org_id,
        event_type=UsageEventType.identity_verification,
        provider="sumsub",
        customer_id=customer.id,
        provider_reference=customer.id,
        status=UsageRecordStatus.pending,
    )

    payload = {
        "applicantId": "applicant-xyz",
        "externalUserId": customer.id,
        "reviewResult": {"reviewAnswer": "GREEN"},
    }
    body = json.dumps(payload).encode()
    sig = _sign(body, "secret")
    resp = client.post(
        "/api/v1/kyc/webhooks/sumsub",
        content=body,
        headers={"x-payload-digest": sig, "content-type": "application/json"},
    )
    assert resp.status_code == 200

    usage = find_by_reference(db, "sumsub", customer.id)
    assert usage.status == UsageRecordStatus.completed

    db.refresh(customer)
    assert customer.status == CustomerStatus.under_review


# ── /billing/usage route ─────────────────────────────────────────────────────

def test_billing_usage_route(client, admin_headers, admin_user, db):
    from datetime import datetime, timedelta, timezone

    r1 = record_usage(
        db, org_id=admin_user.org_id, event_type=UsageEventType.identity_verification,
        provider="sumsub", provider_reference="bill-1", unit_cost_aud=2.0, markup_pct=50,
    )
    mark_completed(db, r1)

    start = (datetime.now(timezone.utc) - timedelta(days=1)).isoformat()
    end = (datetime.now(timezone.utc) + timedelta(days=1)).isoformat()
    resp = client.get(
        "/api/v1/billing/usage",
        params={"period_start": start, "period_end": end},
        headers=admin_headers,
    )
    assert resp.status_code == 200
    body = resp.json()
    assert body["check_count"] == 1
    assert body["total_billed_aud"] == 3.0
