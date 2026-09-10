"""
POST /screening/run, /quick-screen, /re-screen, and /batch (plus onboarding's
sanctions check) previously always called _simulate_screening() for every
screening type, including sanctions and PEP -- hardcoded to always return
status=clear, match_count=0, regardless of the name screened. A real
provider layer already existed (app.integrations.sanctions,
app.integrations.pep) but nothing called it.

Fixed by routing sanctions/ubo_sanctions and pep/ubo_pep screening_types to
the configured provider (SANCTIONS_PROVIDER / PEP_PROVIDER). Every other
screening_type still uses the simulation placeholder -- no regression there,
and this file doesn't test them.
"""

import uuid

import pytest

from app.models.customer import Customer, CustomerStatus, CustomerType
from app.models.onboarding import CustomerType as OBCustomerType
from app.models.onboarding import OnboardingSession, SessionStatus
from app.models.organisation import IndustryType, Organisation
from app.models.screening import ScreeningAlert, ScreeningRecord, ScreeningStatus
from app.services.onboarding_service import submit_onboarding


def _make_customer(db, org_id, full_name):
    customer = Customer(
        customer_ref=f"CUST-{uuid.uuid4().hex[:8]}",
        org_id=org_id,
        customer_type=CustomerType.individual,
        status=CustomerStatus.active,
        full_name=full_name,
    )
    db.add(customer)
    db.commit()
    db.refresh(customer)
    return customer


# ── Sanctions -- default InternalSanctionsProvider (real DFAT entries) ──────


def test_screening_run_sanctions_finds_a_real_dfat_match(
    client, compliance_headers, compliance_user, db
):
    # "Al-Qaeda" is a real entry in InternalSanctionsProvider's DFAT_AU list
    # (app/integrations/sanctions/internal.py) -- the default SANCTIONS_PROVIDER.
    customer = _make_customer(db, compliance_user.org_id, "Al-Qaeda")

    resp = client.post(
        "/api/v1/screening/run",
        json={"customer_id": customer.id, "screening_types": ["sanctions"]},
        headers=compliance_headers,
    )
    assert resp.status_code == 201, resp.text
    record = resp.json()["records"][0]
    assert record["status"] == ScreeningStatus.potential_match.value
    assert record["match_count"] >= 1

    db_record = (
        db.query(ScreeningRecord).filter(ScreeningRecord.id == record["id"]).first()
    )
    assert db_record.status == ScreeningStatus.potential_match

    alert = (
        db.query(ScreeningAlert)
        .filter(ScreeningAlert.screening_record_id == record["id"])
        .first()
    )
    assert alert is not None, "a match must raise a ScreeningAlert"


def test_screening_run_sanctions_clear_for_unrelated_name(
    client, compliance_headers, compliance_user, db
):
    customer = _make_customer(db, compliance_user.org_id, "Totally Unrelated Person")

    resp = client.post(
        "/api/v1/screening/run",
        json={"customer_id": customer.id, "screening_types": ["sanctions"]},
        headers=compliance_headers,
    )
    assert resp.status_code == 201, resp.text
    record = resp.json()["records"][0]
    assert record["status"] == ScreeningStatus.clear.value
    assert record["match_count"] == 0


def test_quick_screen_sanctions_uses_real_provider(client, analyst_headers):
    resp = client.post(
        "/api/v1/screening/quick-screen",
        json={"category": "sanctions", "query": "Taliban"},
        headers=analyst_headers,
    )
    assert resp.status_code == 200, resp.text
    body = resp.json()
    assert body["match_found"] is True
    assert body["lists_checked"]  # real provider reports which lists it checked


# ── PEP -- routed through the real (config-selectable) provider factory ─────


def test_screening_run_pep_uses_real_provider_when_configured(
    client, compliance_headers, compliance_user, db, monkeypatch
):
    """Default PEP_PROVIDER is "stub" (no free public PEP dataset exists),
    so this proves the routing itself is real -- not that the default
    behaviour changed -- by swapping in a fake provider that reports a
    match, the same way test_crypto_wallet_screening.py proves its routing."""

    class _FakeMatch:
        match_name = "Jane Politician"
        match_score = 0.95
        pep_tier = "Tier 1"
        position = "Minister"
        country = "AU"

    class _FakeResult:
        is_pep = True
        matches = [_FakeMatch()]
        provider = "fake"

    class _FakeProvider:
        async def screen(self, name, dob=None, country=None):
            return _FakeResult()

    monkeypatch.setattr(
        "app.api.routes.screening.get_pep_provider", lambda: _FakeProvider()
    )
    customer = _make_customer(db, compliance_user.org_id, "Jane Politician")

    resp = client.post(
        "/api/v1/screening/run",
        json={"customer_id": customer.id, "screening_types": ["pep"]},
        headers=compliance_headers,
    )
    assert resp.status_code == 201, resp.text
    record = resp.json()["records"][0]
    assert record["status"] == ScreeningStatus.potential_match.value
    assert record["match_count"] == 1


def test_screening_run_pep_default_is_clear_but_real_code_path(
    client, compliance_headers, compliance_user, db
):
    """Default StubPEPProvider always returns is_pep=False (no free public
    PEP dataset) -- confirms that's still true post-fix, i.e. nothing here
    regressed even though the default provider itself has no real data."""
    customer = _make_customer(db, compliance_user.org_id, "Ordinary Citizen")

    resp = client.post(
        "/api/v1/screening/run",
        json={"customer_id": customer.id, "screening_types": ["pep"]},
        headers=compliance_headers,
    )
    assert resp.status_code == 201, resp.text
    assert resp.json()["records"][0]["status"] == ScreeningStatus.clear.value


# ── Onboarding's early sanctions check ───────────────────────────────────────


@pytest.mark.asyncio
async def test_onboarding_submit_flags_real_sanctions_match(db):
    org = Organisation(
        name="Sanctions Onboarding Test Org",
        industry_id="digital-currency-exchange",
        industry_type=IndustryType.vasp,
    )
    db.add(org)
    db.commit()

    session = OnboardingSession(
        session_id=f"OBS-{uuid.uuid4().hex[:8].upper()}",
        industry_id=org.industry_id,
        organisation_id=org.id,
        customer_type=OBCustomerType.individual,
        applicant_name="Islamic State",  # real DFAT_AU entry
        applicant_email=f"applicant-{uuid.uuid4().hex[:6]}@example.com",
        invite_token=uuid.uuid4().hex,
        status=SessionStatus.in_progress,
    )
    db.add(session)
    db.commit()

    result = await submit_onboarding(db, session)

    customer = db.query(Customer).filter(Customer.id == result["customer_id"]).first()
    assert customer.is_sanctions_match is True
