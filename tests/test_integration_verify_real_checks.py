"""
P45 ("build the real one"): app.services.integration_verify wires
POST /{slug}/test to a genuine, read-only call against the real vendor API
for the providers VeriGo already has a working adapter for (Sumsub,
ComplyAdvantage, Chainalysis, Elliptic, ABR) plus two more with a
standard, well-documented credential-verification call (Twilio's account
fetch; an SMTP auth handshake for the SendGrid/SES email relays). Every
other provider in the 48-provider catalog keeps the honest "not built
yet" response from the earlier P45 fix.

These tests mock the transport layer (httpx.AsyncClient / smtplib.SMTP)
the same way the rest of this codebase's provider adapters are tested
(see test_crypto_wallet_screening.py) -- no real vendor account or
network access is used or required.
"""

import smtplib

import httpx
import pytest

from app.integrations.base import ProviderRejectedError
from app.services.integration_verify import verify_credentials


class _Resp:
    def __init__(self, status_code=200, json_data=None, text="", content=b"1"):
        self.status_code = status_code
        self._json = json_data if json_data is not None else {}
        self.text = text
        self.content = content

    def json(self):
        return self._json

    def raise_for_status(self):
        if self.status_code >= 400:
            raise RuntimeError(f"HTTP {self.status_code}")


# ── Unknown slug / missing fields ────────────────────────────────────────────


@pytest.mark.asyncio
async def test_verify_credentials_returns_none_for_unwired_provider():
    result = await verify_credentials("onfido", {"api_key": "x"})
    assert result is None


@pytest.mark.asyncio
async def test_missing_fields_reported_without_any_network_call(monkeypatch):
    called = []
    monkeypatch.setattr(httpx.AsyncClient, "request", lambda *a, **k: called.append(1))
    passed, message = await verify_credentials("sumsub", {})
    assert passed is False
    assert "app_token" in message and "secret_key" in message
    assert called == []


# ── Sumsub ────────────────────────────────────────────────────────────────────


@pytest.mark.asyncio
async def test_verify_sumsub_success(monkeypatch):
    async def _fake_request(self, method, path, content=None, headers=None):
        assert method == "POST"
        assert "/resources/accessTokens" in path
        return _Resp(json_data={"token": "tok_123"})

    monkeypatch.setattr(httpx.AsyncClient, "request", _fake_request)
    passed, message = await verify_credentials(
        "sumsub", {"app_token": "at", "secret_key": "sk"}
    )
    assert passed is True
    assert "issued a test access token" in message


@pytest.mark.asyncio
async def test_verify_sumsub_bad_credentials(monkeypatch):
    async def _fake_request(self, method, path, content=None, headers=None):
        return _Resp(status_code=401, text="Unauthorized")

    monkeypatch.setattr(httpx.AsyncClient, "request", _fake_request)
    passed, message = await verify_credentials(
        "sumsub", {"app_token": "bad", "secret_key": "bad"}
    )
    assert passed is False
    assert "rejected" in message.lower()


# ── ComplyAdvantage ───────────────────────────────────────────────────────────


@pytest.mark.asyncio
async def test_verify_complyadvantage_success(monkeypatch):
    async def _fake_post(self, url, json=None, auth=None):
        assert "searches" in url
        return _Resp(json_data={"content": {"data": {"hits": []}}})

    monkeypatch.setattr(httpx.AsyncClient, "post", _fake_post)
    passed, message = await verify_credentials("complyadvantage", {"api_key": "k"})
    assert passed is True
    assert "ComplyAdvantage" in message


@pytest.mark.asyncio
async def test_verify_complyadvantage_rejected(monkeypatch):
    async def _fake_post(self, url, json=None, auth=None):
        return _Resp(status_code=403, text="Forbidden")

    monkeypatch.setattr(httpx.AsyncClient, "post", _fake_post)
    passed, message = await verify_credentials("complyadvantage", {"api_key": "bad"})
    assert passed is False
    assert "rejected" in message.lower()


# ── Chainalysis ───────────────────────────────────────────────────────────────


@pytest.mark.asyncio
async def test_verify_chainalysis_success(monkeypatch):
    async def _fake_get(self, url, headers=None):
        assert headers["Token"] == "k"
        return _Resp(json_data={"identifications": []})

    monkeypatch.setattr(httpx.AsyncClient, "get", _fake_get)
    passed, message = await verify_credentials("chainalysis", {"api_key": "k"})
    assert passed is True
    assert "Chainalysis" in message


@pytest.mark.asyncio
async def test_verify_chainalysis_rejected(monkeypatch):
    async def _fake_get(self, url, headers=None):
        return _Resp(status_code=401, text="bad token")

    monkeypatch.setattr(httpx.AsyncClient, "get", _fake_get)
    passed, _message = await verify_credentials("chainalysis", {"api_key": "bad"})
    assert passed is False


# ── Elliptic ──────────────────────────────────────────────────────────────────


@pytest.mark.asyncio
async def test_verify_elliptic_success(monkeypatch):
    async def _fake_post(self, path, content=None, headers=None):
        return _Resp(json_data={"risk_score": 0})

    monkeypatch.setattr(httpx.AsyncClient, "post", _fake_post)
    passed, message = await verify_credentials(
        "elliptic", {"api_key": "k", "api_secret": "s"}
    )
    assert passed is True
    assert "Elliptic" in message


@pytest.mark.asyncio
async def test_verify_elliptic_missing_secret():
    passed, message = await verify_credentials("elliptic", {"api_key": "k"})
    assert passed is False
    assert "api_secret" in message


# ── ABR ───────────────────────────────────────────────────────────────────────


@pytest.mark.asyncio
async def test_verify_abr_success(monkeypatch):
    xml = (
        '<?xml version="1.0"?><ABRSearchByNameSimpleResult '
        'xmlns="urn:ABRXMLSearch"></ABRSearchByNameSimpleResult>'
    )

    async def _fake_get(self, url):
        assert "guid=" in url
        return _Resp(text=xml)

    monkeypatch.setattr(httpx.AsyncClient, "get", _fake_get)
    passed, message = await verify_credentials("abr", {"guid": "g"})
    assert passed is True
    assert "ABR" in message


@pytest.mark.asyncio
async def test_verify_abr_reports_unreachable_on_transport_error(monkeypatch):
    # search_by_name() only raises on an HTTP-level error (raise_for_status()) --
    # ABR returns 200 with an embedded <exception> element for an invalid
    # GUID, which this adapter method doesn't parse (documented in
    # _verify_abr's own comment and tracked in PARKING_LOT.md), so a real
    # HTTP failure is the only failure mode this check can actually catch.
    async def _fake_get(self, url):
        return _Resp(status_code=500, text="Internal Server Error")

    monkeypatch.setattr(httpx.AsyncClient, "get", _fake_get)
    passed, message = await verify_credentials("abr", {"guid": "whatever"})
    assert passed is False
    assert "Could not reach" in message


# ── Twilio SMS ────────────────────────────────────────────────────────────────


@pytest.mark.asyncio
async def test_verify_twilio_success(monkeypatch):
    async def _fake_get(self, url, auth=None):
        assert auth == ("AC123", "tok")
        return _Resp(status_code=200)

    monkeypatch.setattr(httpx.AsyncClient, "get", _fake_get)
    passed, _message = await verify_credentials(
        "twilio_sms", {"account_sid": "AC123", "auth_token": "tok"}
    )
    assert passed is True


@pytest.mark.asyncio
async def test_verify_twilio_bad_credentials(monkeypatch):
    async def _fake_get(self, url, auth=None):
        return _Resp(status_code=401)

    monkeypatch.setattr(httpx.AsyncClient, "get", _fake_get)
    passed, message = await verify_credentials(
        "twilio_sms", {"account_sid": "AC123", "auth_token": "bad"}
    )
    assert passed is False
    assert "rejected" in message.lower()


# ── SendGrid / SES (shared SMTP relay check) ─────────────────────────────────


class _FakeSMTP:
    def __init__(self, host, port, timeout=None):
        self.host = host
        self.port = port

    def __enter__(self):
        return self

    def __exit__(self, *a):
        return False

    def ehlo(self):
        pass

    def starttls(self):
        pass

    def login(self, username, password):
        if password != "good-password":
            raise smtplib.SMTPAuthenticationError(535, b"bad creds")


@pytest.mark.asyncio
@pytest.mark.parametrize("slug", ["sendgrid", "ses"])
async def test_verify_smtp_relay_success(monkeypatch, slug):
    monkeypatch.setattr(smtplib, "SMTP", _FakeSMTP)
    passed, message = await verify_credentials(
        slug,
        {
            "smtp_host": "smtp.example.com",
            "smtp_username": "apikey",
            "smtp_password": "good-password",
        },
    )
    assert passed is True
    assert "smtp.example.com" in message


@pytest.mark.asyncio
async def test_verify_smtp_relay_bad_password(monkeypatch):
    monkeypatch.setattr(smtplib, "SMTP", _FakeSMTP)
    passed, message = await verify_credentials(
        "sendgrid",
        {
            "smtp_host": "smtp.example.com",
            "smtp_username": "apikey",
            "smtp_password": "wrong",
        },
    )
    assert passed is False
    assert "rejected" in message.lower()


@pytest.mark.asyncio
async def test_provider_rejected_error_repr_is_readable():
    # Sanity check that our messages interpolate cleanly against the real
    # exception shape used across every adapter in this codebase.
    exc = ProviderRejectedError("sumsub", "401: unauthorized")
    assert "sumsub" in str(exc)
