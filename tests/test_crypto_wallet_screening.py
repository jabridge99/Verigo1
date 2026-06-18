"""Tests for the Chainalysis free-tier crypto wallet sanctions screening
integration and the /screening/crypto-wallet route."""
import uuid

import httpx
import pytest

from app import config as config_module
from app.integrations.base import ProviderUnavailableError
from app.integrations.crypto import factory as crypto_factory
from app.integrations.crypto.chainalysis import ChainalysisProvider
from app.models.customer import Customer, CustomerStatus, CustomerType
from app.models.screening import CryptoProvider, CryptoWalletScreening


def _make_customer(db, org_id):
    customer = Customer(
        customer_ref=f"CUST-{uuid.uuid4().hex[:8]}",
        org_id=org_id,
        customer_type=CustomerType.individual,
        status=CustomerStatus.active,
        full_name="Jane Doe",
    )
    db.add(customer)
    db.commit()
    db.refresh(customer)
    return customer


# ── ChainalysisProvider ──────────────────────────────────────────────────────

def test_chainalysis_provider_requires_api_key():
    with pytest.raises(ProviderUnavailableError):
        ChainalysisProvider("")


@pytest.mark.asyncio
async def test_chainalysis_screen_address_no_match(monkeypatch):
    provider = ChainalysisProvider("test-key")

    class _Resp:
        status_code = 200
        def json(self):
            return {"identifications": []}

    async def _fake_get(self, url, headers=None):
        assert headers["Token"] == "test-key"
        return _Resp()

    monkeypatch.setattr(httpx.AsyncClient, "get", _fake_get)
    result = await provider.screen_address("1BoatSLRHtKNngkdXEeobR76b53LETtpyT")
    assert result.is_sanctioned is False
    assert result.identifications == []


@pytest.mark.asyncio
async def test_chainalysis_screen_address_match(monkeypatch):
    provider = ChainalysisProvider("test-key")

    class _Resp:
        status_code = 200
        def json(self):
            return {
                "identifications": [
                    {"category": "sanctions", "name": "OFAC SDN", "description": "Lazarus Group", "url": None}
                ]
            }

    async def _fake_get(self, url, headers=None):
        return _Resp()

    monkeypatch.setattr(httpx.AsyncClient, "get", _fake_get)
    result = await provider.screen_address("0xSomeSanctionedAddress")
    assert result.is_sanctioned is True
    assert result.identifications[0].category == "sanctions"
    assert result.identifications[0].name == "OFAC SDN"


# ── factory ──────────────────────────────────────────────────────────────────

def test_get_crypto_provider_raises_when_internal(monkeypatch):
    monkeypatch.setattr(config_module.settings, "crypto_provider", "internal")
    with pytest.raises(NotImplementedError):
        crypto_factory.get_provider()


def test_get_crypto_provider_returns_chainalysis_when_configured(monkeypatch):
    monkeypatch.setattr(config_module.settings, "crypto_provider", "chainalysis")
    monkeypatch.setattr(config_module.settings, "chainalysis_api_key", "test-key")
    provider = crypto_factory.get_provider()
    assert isinstance(provider, ChainalysisProvider)


@pytest.mark.parametrize(
    "provider_name,extra_setting",
    [
        ("ofac_sdn", None),
        ("crypto_apis", ("cryptoapis_api_key", "test-key")),
        ("scorechain", ("scorechain_api_key", "test-key")),
        ("goplus", None),
    ],
)
def test_get_crypto_provider_returns_each_provider(monkeypatch, provider_name, extra_setting):
    monkeypatch.setattr(config_module.settings, "crypto_provider", provider_name)
    if extra_setting:
        monkeypatch.setattr(config_module.settings, extra_setting[0], extra_setting[1])
    provider = crypto_factory.get_provider()
    assert provider.name == provider_name


def test_crypto_apis_provider_requires_api_key():
    from app.integrations.crypto.crypto_apis import CryptoAPIsProvider
    with pytest.raises(ProviderUnavailableError):
        CryptoAPIsProvider("")


def test_scorechain_provider_requires_api_key():
    from app.integrations.crypto.scorechain import ScorechainProvider
    with pytest.raises(ProviderUnavailableError):
        ScorechainProvider("")


def test_goplus_provider_allows_no_api_key():
    from app.integrations.crypto.goplus import GoPlusProvider
    GoPlusProvider("")  # GoPlus has a free unauthenticated quota


# ── OFACSDNProvider ──────────────────────────────────────────────────────────

@pytest.mark.asyncio
async def test_ofac_sdn_unsupported_network_returns_clear():
    from app.integrations.crypto.ofac_sdn import OFACSDNProvider
    provider = OFACSDNProvider()
    result = await provider.screen_address("some-address", network="other")
    assert result.is_sanctioned is False


@pytest.mark.asyncio
async def test_ofac_sdn_matches_cached_address(monkeypatch):
    from app.integrations.crypto.ofac_sdn import OFACSDNProvider
    provider = OFACSDNProvider()

    class _Resp:
        status_code = 200
        text = "1BadAddress\n2AnotherAddress\n"
        def raise_for_status(self):
            pass

    async def _fake_get(self, url):
        assert "sanctioned_addresses_XBT.txt" in url
        return _Resp()

    monkeypatch.setattr(httpx.AsyncClient, "get", _fake_get)
    result = await provider.screen_address("1BadAddress", network="bitcoin")
    assert result.is_sanctioned is True
    assert result.identifications[0].name == "OFAC SDN"

    # second call should hit the in-memory cache, not refetch
    async def _fail_get(self, url):
        raise AssertionError("should not refetch within TTL")

    monkeypatch.setattr(httpx.AsyncClient, "get", _fail_get)
    result2 = await provider.screen_address("2AnotherAddress", network="bitcoin")
    assert result2.is_sanctioned is True


@pytest.mark.asyncio
async def test_ofac_sdn_no_match(monkeypatch):
    from app.integrations.crypto.ofac_sdn import OFACSDNProvider
    provider = OFACSDNProvider()

    class _Resp:
        status_code = 200
        text = "1BadAddress\n"
        def raise_for_status(self):
            pass

    async def _fake_get(self, url):
        return _Resp()

    monkeypatch.setattr(httpx.AsyncClient, "get", _fake_get)
    result = await provider.screen_address("1CleanAddress", network="bitcoin")
    assert result.is_sanctioned is False


# ── /screening/crypto-wallet route ──────────────────────────────────────────

def test_crypto_wallet_route_falls_back_to_simulation_when_unconfigured(
    client, compliance_headers, compliance_user, db, monkeypatch
):
    monkeypatch.setattr(config_module.settings, "crypto_provider", "internal")
    customer = _make_customer(db, compliance_user.org_id)
    resp = client.post(
        "/api/v1/screening/crypto-wallet",
        json={
            "customer_id": customer.id,
            "wallet_address": "1BoatSLRHtKNngkdXEeobR76b53LETtpyT",
            "network": "bitcoin",
        },
        headers=compliance_headers,
    )
    assert resp.status_code == 201
    body = resp.json()
    assert body["risk_score"] is None
    assert "Simulation only" in body["risk_details"]["note"]


def test_crypto_wallet_route_uses_chainalysis_when_configured(
    client, compliance_headers, compliance_user, db, monkeypatch
):
    monkeypatch.setattr(config_module.settings, "crypto_provider", "chainalysis")
    monkeypatch.setattr(config_module.settings, "chainalysis_api_key", "test-key")
    customer = _make_customer(db, compliance_user.org_id)

    class _FakeResult:
        is_sanctioned = True
        identifications = []
        raw = {"identifications": [{"category": "sanctions"}]}

    class _FakeProvider:
        name = "chainalysis"

        async def screen_address(self, address, network=None):
            return _FakeResult()

    monkeypatch.setattr(
        "app.api.routes.screening.get_crypto_provider", lambda: _FakeProvider()
    )
    resp = client.post(
        "/api/v1/screening/crypto-wallet",
        json={
            "customer_id": customer.id,
            "wallet_address": "0xSanctionedAddress",
            "network": "ethereum",
        },
        headers=compliance_headers,
    )
    assert resp.status_code == 201
    body = resp.json()
    assert body["risk_score"] == 100.0
    assert body["risk_category"] == "sanctioned"
    assert body["sanctioned_exposure_pct"] == 100.0

    screening = db.query(CryptoWalletScreening).filter(
        CryptoWalletScreening.wallet_address == "0xSanctionedAddress"
    ).first()
    assert screening.provider == CryptoProvider.chainalysis


def test_crypto_wallet_route_requires_compliance_role(client, analyst_headers, analyst_user, db):
    customer = _make_customer(db, analyst_user.org_id)
    resp = client.post(
        "/api/v1/screening/crypto-wallet",
        json={
            "customer_id": customer.id,
            "wallet_address": "1BoatSLRHtKNngkdXEeobR76b53LETtpyT",
            "network": "bitcoin",
        },
        headers=analyst_headers,
    )
    assert resp.status_code == 403
