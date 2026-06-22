"""
Smoke test: RateLimitMiddleware._real_ip() (and auth.py's _client_ip())
unconditionally trusted the client-supplied X-Forwarded-For header to key
per-IP rate-limit buckets. Without a trusted proxy in front of the app,
any client can set an arbitrary/random X-Forwarded-For value on every
request to get a fresh bucket each time, bypassing brute-force
protections entirely. Fixed by only honoring X-Forwarded-For when
settings.trust_proxy_headers is explicitly enabled.
"""

from app.middleware import RateLimitMiddleware
from app.api.routes.auth import _client_ip
from app import config as config_module


class _FakeClient:
    host = "203.0.113.5"


class _FakeRequest:
    def __init__(self, xff):
        self.headers = {"X-Forwarded-For": xff} if xff else {}
        self.client = _FakeClient()


def test_real_ip_ignores_spoofed_xff_by_default(monkeypatch):
    monkeypatch.setattr(config_module.settings, "trust_proxy_headers", False)
    mw = RateLimitMiddleware.__new__(RateLimitMiddleware)
    req = _FakeRequest("1.2.3.4")
    assert mw._real_ip(req) == "203.0.113.5"


def test_real_ip_honors_xff_when_trust_proxy_enabled(monkeypatch):
    monkeypatch.setattr(config_module.settings, "trust_proxy_headers", True)
    mw = RateLimitMiddleware.__new__(RateLimitMiddleware)
    req = _FakeRequest("1.2.3.4")
    assert mw._real_ip(req) == "1.2.3.4"


def test_client_ip_in_auth_ignores_spoofed_xff_by_default(monkeypatch):
    monkeypatch.setattr(config_module.settings, "trust_proxy_headers", False)
    req = _FakeRequest("9.9.9.9")
    assert _client_ip(req) == "203.0.113.5"
