"""
Crypto APIs "Verify Address" — pay-as-you-go AML/sanctions screening across
20+ chains. Docs: https://cryptoapis.io/products/verify-address
Set CRYPTO_PROVIDER=crypto_apis and CRYPTOAPIS_API_KEY in env.

NOTE: Crypto APIs' exact response schema for this endpoint could not be
verified against live docs at integration time (the docs site returned a
bot-blocked 403 to our fetch). The request shape (x-api-key header, REST v2
base URL) follows their documented general conventions; the response parsing
below is intentionally defensive (looks for several plausible field names)
rather than hard-coded to one assumed shape. Confirm exact field names
against a live sandbox call before relying on this in production, and
extend `_is_flagged`/field lookups if the real response differs.
"""
from __future__ import annotations

import logging

import httpx

from app.integrations.base import ProviderRejectedError, ProviderUnavailableError
from .base import CryptoWalletProvider, WalletIdentification, WalletScreeningResult

log = logging.getLogger("verigo.integrations.crypto.crypto_apis")

BASE_URL = "https://rest.cryptoapis.io/v2"

# Our CryptoNetwork -> Crypto APIs blockchain identifier (best-effort mapping;
# confirm against the live "supported blockchains" list before going live).
NETWORK_TO_BLOCKCHAIN: dict[str, str] = {
    "bitcoin": "bitcoin",
    "ethereum": "ethereum",
    "tron": "tron",
    "bnb": "binance-smart-chain",
    "polygon": "polygon-pos",
}


class CryptoAPIsProvider(CryptoWalletProvider):
    name = "crypto_apis"

    def __init__(self, api_key: str):
        if not api_key:
            raise ProviderUnavailableError("crypto_apis", "CRYPTOAPIS_API_KEY not configured")
        self.api_key = api_key

    async def screen_address(self, address: str, network: str | None = None) -> WalletScreeningResult:
        blockchain = NETWORK_TO_BLOCKCHAIN.get(network or "", network or "")
        async with httpx.AsyncClient(timeout=15, base_url=BASE_URL) as client:
            resp = await client.get(
                f"/aml/addresses/{address}",
                params={"blockchain": blockchain},
                headers={"x-api-key": self.api_key},
            )
        if resp.status_code >= 400:
            raise ProviderRejectedError("crypto_apis", f"{resp.status_code}: {resp.text}", raw=resp.text)

        data = resp.json()
        item = data.get("data", data) if isinstance(data, dict) else {}
        attrs = item.get("item", item.get("attributes", item)) if isinstance(item, dict) else {}

        is_sanctioned = bool(
            attrs.get("isSanctioned")
            or attrs.get("sanctioned")
            or (attrs.get("riskScore") or 0) >= 80
        )
        identifications = []
        for label in attrs.get("labels", []) or attrs.get("categories", []) or []:
            identifications.append(WalletIdentification(category=str(label)))

        return WalletScreeningResult(
            is_sanctioned=is_sanctioned,
            identifications=identifications,
            provider=self.name,
            raw=data,
        )
