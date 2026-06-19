"""
Scorechain free Sanctions API — direct + indirect exposure to OFAC/EU/UN/UK
sanctioned entities, darknet, mixers, scams across 21+ chains.
Docs: https://docs.scorechain.com/sanctioned-addresses/
Sign up for a free API key at https://www.scorechain.com/developers/free-sanction-api
Set CRYPTO_PROVIDER=scorechain and SCORECHAIN_API_KEY in env.
Free tier is rate-limited to ~100 requests/hour.

NOTE: Scorechain's docs site returned a bot-blocked 403 to our fetch at
integration time, so the exact response field names below are a best-effort
guess based on public summaries, not a confirmed schema. Confirm against a
live API key before relying on this in production.
"""

from __future__ import annotations

import logging

import httpx

from app.integrations.base import ProviderRejectedError, ProviderUnavailableError

from .base import CryptoWalletProvider, WalletIdentification, WalletScreeningResult

log = logging.getLogger("verigo.integrations.crypto.scorechain")

BASE_URL = "https://api.scorechain.com"


class ScorechainProvider(CryptoWalletProvider):
    name = "scorechain"

    def __init__(self, api_key: str):
        if not api_key:
            raise ProviderUnavailableError(
                "scorechain", "SCORECHAIN_API_KEY not configured"
            )
        self.api_key = api_key

    async def screen_address(
        self, address: str, network: str | None = None
    ) -> WalletScreeningResult:
        async with httpx.AsyncClient(timeout=15, base_url=BASE_URL) as client:
            resp = await client.get(
                "/v1/sanction",
                params={"address": address, "currency": network},
                headers={"X-API-KEY": self.api_key},
            )
        if resp.status_code >= 400:
            raise ProviderRejectedError(
                "scorechain", f"{resp.status_code}: {resp.text}", raw=resp.text
            )

        data = resp.json()
        matches = data.get("matches") or data.get("hits") or []
        is_sanctioned = bool(data.get("sanctioned")) or len(matches) > 0
        identifications = [
            WalletIdentification(
                category=m.get("category", "sanctions"),
                name=m.get("list") or m.get("entity"),
                description=m.get("description"),
            )
            for m in matches
        ]
        return WalletScreeningResult(
            is_sanctioned=is_sanctioned,
            identifications=identifications,
            provider=self.name,
            raw=data,
        )
