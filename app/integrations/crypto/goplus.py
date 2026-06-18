"""
GoPlus Security "Malicious Address" API — aggregates SlowMist, BlockSec,
OFAC, and Chainabuse risk signals for EVM-chain addresses.
Docs: https://docs.gopluslabs.io/reference/api-overview
GoPlus is EVM-only (Ethereum, BSC, Polygon, etc.) — Bitcoin/Solana/Tron
addresses are not covered and `screen_address` returns a clear (unscreened)
result for them rather than guessing.
Set CRYPTO_PROVIDER=goplus and (optionally) GOPLUS_API_KEY in env — a basic
free quota works without a key; an API key/secret from the GoPlus console
raises the rate limit.

NOTE: docs.gopluslabs.io returned a bot-blocked 403 to our fetch at
integration time. The endpoint/response shape below follows GoPlus's
publicly described "address_security" pattern from secondary sources, not a
confirmed live schema — verify before relying on this in production.
"""
from __future__ import annotations

import logging

import httpx

from app.integrations.base import ProviderRejectedError
from .base import CryptoWalletProvider, WalletIdentification, WalletScreeningResult

log = logging.getLogger("verigo.integrations.crypto.goplus")

BASE_URL = "https://api.gopluslabs.io"

# GoPlus malicious-address coverage is EVM-only.
NETWORK_TO_CHAIN_ID: dict[str, str] = {
    "ethereum": "1",
    "bnb": "56",
    "polygon": "137",
}

RISK_FLAGS = [
    "cybercrime", "money_laundering", "financial_crime", "darkweb_transactions",
    "blacklist_doubt", "stealing_attack", "fake_kyc", "malicious_mining",
    "mixer", "sanctioned",
]


class GoPlusProvider(CryptoWalletProvider):
    name = "goplus"

    def __init__(self, api_key: str = ""):
        self.api_key = api_key

    async def screen_address(self, address: str, network: str | None = None) -> WalletScreeningResult:
        chain_id = NETWORK_TO_CHAIN_ID.get(network or "")
        if not chain_id:
            return WalletScreeningResult(is_sanctioned=False, identifications=[], provider=self.name, raw=None)

        headers = {"Authorization": self.api_key} if self.api_key else {}
        async with httpx.AsyncClient(timeout=15, base_url=BASE_URL) as client:
            resp = await client.get(
                f"/api/v1/address_security/{chain_id}",
                params={"addresses": address},
                headers=headers,
            )
        if resp.status_code >= 400:
            raise ProviderRejectedError("goplus", f"{resp.status_code}: {resp.text}", raw=resp.text)

        data = resp.json()
        result = (data.get("result") or {}).get(address.lower(), {})
        identifications = [
            WalletIdentification(category=flag)
            for flag in RISK_FLAGS
            if str(result.get(flag, "0")) == "1"
        ]
        return WalletScreeningResult(
            is_sanctioned=len(identifications) > 0,
            identifications=identifications,
            provider=self.name,
            raw=data,
        )
