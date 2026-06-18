"""
Chainalysis free Sanctions Screening API for crypto addresses.
Docs: https://www.chainalysis.com/free-cryptocurrency-sanctions-screening-tools/
Sign up to get an API key (emailed instantly, no sales call). Set
CRYPTO_PROVIDER=chainalysis and CHAINALYSIS_API_KEY in env.

This is a free, rate-limited (5000 req / 5 min) sanctions-only lookup — it
returns whether an address has been directly identified on a sanctions list
(OFAC SDN and others). It does NOT provide cluster-level risk scoring,
exposure percentages, or transaction-graph analysis; that requires a paid
provider (TRM Labs / Elliptic).
"""

from __future__ import annotations

import logging

import httpx

from app.integrations.base import ProviderRejectedError, ProviderUnavailableError

from .base import CryptoWalletProvider, WalletIdentification, WalletScreeningResult

log = logging.getLogger("verigo.integrations.crypto.chainalysis")

BASE_URL = "https://public.chainalysis.com/api/v1"


class ChainalysisProvider(CryptoWalletProvider):
    name = "chainalysis"

    def __init__(self, api_key: str):
        if not api_key:
            raise ProviderUnavailableError(
                "chainalysis", "CHAINALYSIS_API_KEY not configured"
            )
        self.api_key = api_key

    async def screen_address(
        self, address: str, network: str | None = None
    ) -> WalletScreeningResult:
        async with httpx.AsyncClient(timeout=15, base_url=BASE_URL) as client:
            resp = await client.get(
                f"/address/{address}",
                headers={"Token": self.api_key},
            )
        if resp.status_code >= 400:
            raise ProviderRejectedError(
                "chainalysis", f"{resp.status_code}: {resp.text}", raw=resp.text
            )

        data = resp.json()
        raw_identifications = (
            data if isinstance(data, list) else data.get("identifications", [])
        )
        identifications = [
            WalletIdentification(
                category=item.get("category", "sanctions"),
                name=item.get("name"),
                description=item.get("description"),
                url=item.get("url"),
            )
            for item in raw_identifications
        ]
        return WalletScreeningResult(
            is_sanctioned=len(identifications) > 0,
            identifications=identifications,
            provider=self.name,
            raw=data,
        )
