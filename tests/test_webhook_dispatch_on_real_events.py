"""
P44: fire_webhook()/dispatch_event() (app/services/api_key_service.py) were
real -- genuine HMAC-signed httpx.post() delivery -- but dispatch_event()
had no callers anywhere. A customer could register a webhook for
"customer.created" or "aml_alert.created" and it would simply never fire.

Fixed by calling dispatch_event_background() (a BackgroundTasks-safe
wrapper -- see its docstring for why it opens its own DB session) from
customers.py::create_customer() and screening.py::run_screening()'s
alert-raising branch.

Two tiers of test here:
- Route-level: patch each route module's own `dispatch_event_background`
  name (same technique test_crypto_wallet_screening.py already uses for
  get_crypto_provider) to prove the route calls it with the right
  event/payload -- without fighting the fact that a background task's own
  DB session can't see this test suite's per-test nested transaction (the
  `db` fixture binds a session to one externally-managed connection+
  transaction, so a genuinely separate connection -- which is what
  SessionLocal() always opens -- never sees its uncommitted-to-the-file
  writes; that's what keeps tests isolated from each other).
- dispatch_event_background() itself, tested in isolation below with its
  own plain (non-nested-transaction) sessions, proving the "opens its own
  session, delivers, swallows exceptions" mechanics actually work.
"""

import uuid

import httpx
import pytest

from app.models.api_key import WebhookDelivery, WebhookEndpoint
from app.schemas.api_key import WebhookCreate
from app.services import api_key_service as svc
from app.services.api_key_service import dispatch_event_background
from tests.conftest import TestingSession, engine


def _register_webhook(db, user_id, org_id, events):
    return svc.create_webhook(
        db,
        WebhookCreate(
            name=f"Test hook {uuid.uuid4().hex[:6]}",
            url="https://example.com/hook",
            events=events,
        ),
        user_id,
        org_id,
    )


# ── Route wiring: customer.created / aml_alert.created ───────────────────────


def test_create_customer_dispatches_customer_created_event(
    client, admin_user, admin_headers, monkeypatch
):
    calls = []
    monkeypatch.setattr(
        "app.api.routes.customers.dispatch_event_background",
        lambda event, payload, industry_id=None: calls.append(
            (event, payload, industry_id)
        ),
    )

    resp = client.post(
        "/api/v1/customers",
        json={
            "customer_type": "individual",
            "full_name": "Webhook Test Customer",
            "email": f"webhook-{uuid.uuid4().hex[:6]}@example.com",
        },
        headers=admin_headers,
    )
    assert resp.status_code == 201, resp.text

    assert len(calls) == 1
    event, payload, org_id = calls[0]
    assert event == "customer.created"
    assert payload["customer_id"] == resp.json()["id"]
    assert org_id == admin_user.org_id


def test_run_screening_dispatches_aml_alert_created_on_match(
    client, compliance_headers, compliance_user, monkeypatch
):
    calls = []
    monkeypatch.setattr(
        "app.api.routes.screening.dispatch_event_background",
        lambda event, payload, industry_id=None: calls.append(
            (event, payload, industry_id)
        ),
    )
    monkeypatch.setattr(
        "app.api.routes.customers.dispatch_event_background", lambda *a, **k: None
    )

    create_resp = client.post(
        "/api/v1/customers",
        json={
            "customer_type": "individual",
            # "Al-Qaeda" is a real DFAT entry (InternalSanctionsProvider,
            # the default SANCTIONS_PROVIDER) -- guaranteed to raise an alert.
            "full_name": "Al-Qaeda",
            "email": f"webhook-alert-{uuid.uuid4().hex[:6]}@example.com",
        },
        headers=compliance_headers,
    )
    assert create_resp.status_code == 201, create_resp.text
    customer_id = create_resp.json()["id"]

    resp = client.post(
        "/api/v1/screening/run",
        json={"customer_id": customer_id, "screening_types": ["sanctions"]},
        headers=compliance_headers,
    )
    assert resp.status_code == 201, resp.text

    assert len(calls) == 1
    event, payload, org_id = calls[0]
    assert event == "aml_alert.created"
    assert payload["customer_id"] == customer_id
    assert org_id == compliance_user.org_id


def test_run_screening_does_not_dispatch_when_clear(
    client, compliance_headers, compliance_user, monkeypatch, db
):
    from app.models.customer import Customer, CustomerStatus, CustomerType

    calls = []
    monkeypatch.setattr(
        "app.api.routes.screening.dispatch_event_background",
        lambda *a, **k: calls.append(a),
    )
    customer = Customer(
        customer_ref=f"CUST-{uuid.uuid4().hex[:8]}",
        org_id=compliance_user.org_id,
        customer_type=CustomerType.individual,
        status=CustomerStatus.active,
        full_name="Totally Unrelated Person",
    )
    db.add(customer)
    db.commit()
    db.refresh(customer)

    resp = client.post(
        "/api/v1/screening/run",
        json={"customer_id": customer.id, "screening_types": ["sanctions"]},
        headers=compliance_headers,
    )
    assert resp.status_code == 201, resp.text
    assert calls == []


# ── dispatch_event_background() mechanics, in isolation ──────────────────────


@pytest.fixture
def plain_session():
    """A session bound to the test engine directly (not the `db` fixture's
    nested-transaction pattern), so its commits are genuinely visible to
    other connections -- needed here since dispatch_event_background()
    always opens a fresh connection via SessionLocal()."""
    session = TestingSession(bind=engine)
    yield session
    session.query(WebhookDelivery).delete()
    session.query(WebhookEndpoint).delete()
    session.commit()
    session.close()


def test_dispatch_event_background_delivers_to_real_webhook(plain_session, monkeypatch):
    monkeypatch.setattr("app.db.database.SessionLocal", TestingSession)

    wh = svc.create_webhook(
        plain_session,
        WebhookCreate(
            name="Isolation test hook",
            url="https://example.com/hook",
            events=["customer.created"],
        ),
        "usr_test",
        "org_isolation_test",
    )

    calls = []

    def _fake_post(url, content=None, headers=None, timeout=None):
        calls.append(headers["X-TVG-Event"])

        class _Resp:
            status_code = 200
            text = "ok"

        return _Resp()

    monkeypatch.setattr(httpx, "post", _fake_post)

    dispatch_event_background(
        "customer.created", {"customer_id": "cust_123"}, "org_isolation_test"
    )

    assert calls == ["customer.created"]
    plain_session.refresh(wh)
    assert wh.last_fired_at is not None


def test_dispatch_event_background_swallows_exceptions(monkeypatch):
    """A delivery failure must never propagate back into the request that
    triggered it -- by the time this runs, the response has already been
    sent."""

    def _boom(db, event, payload, industry_id=None):
        raise RuntimeError("simulated failure")

    monkeypatch.setattr("app.services.api_key_service.dispatch_event", _boom)

    dispatch_event_background("customer.created", {}, "org_x")  # must not raise
