"""
Self-hosted OFAC Specially Designated Nationals (SDN) crypto address list.

Same underlying data as the Chainalysis free oracle, sourced instead from
the community-maintained address extraction of Treasury's sdn_advanced.xml:
https://github.com/0xB10C/ofac-sanctioned-digital-currency-addresses

The `lists` branch is regenerated nightly (0 UTC) by GitHub Actions, so we
fetch the relevant per-asset text file and cache it in-memory with a TTL —
no API key, no rate limit, fully self-hosted exact-match lookup.
"""
from __future__ import annotations

import logging
import time

import httpx

from .base import CryptoWalletProvider, WalletIdentification, WalletScreeningResult

log = logging.getLogger("verigo.integrations.crypto.ofac_sdn")

RAW_BASE_URL = (
    "https://raw.githubusercontent.com/0xB10C/"
    "ofac-sanctioned-digital-currency-addresses/lists"
)

# Our CryptoNetwork values -> OFAC list ticker. Polygon has no dedicated list;
# it shares Ethereum's address format, so we fall back to the ETH list as a
# best-effort check (not authoritative for Polygon-specific sanctions).
NETWORK_TO_TICKER: dict[str, str] = {
    "bitcoin": "XBT",
    "ethereum": "ETH",
    "solana": "SOL",
    "tron": "TRX",
    "usdt_erc20": "USDT",
    "usdt_trc20": "USDT",
    "usdc": "USDC",
    "bnb": "BSC",
    "polygon": "ETH",
}

CACHE_TTL_SECONDS = 6 * 60 * 60  # refetch at most every 6 hours per ticker


class OFACSDNProvider(CryptoWalletProvider):
    name = "ofac_sdn"

    def __init__(self):
        self._cache: dict[str, tuple[float, set[str]]] = {}

    async def _addresses_for_ticker(self, ticker: str) -> set[str]:
        cached = self._cache.get(ticker)
        if cached and (time.monotonic() - cached[0]) < CACHE_TTL_SECONDS:
            return cached[1]

        url = f"{RAW_BASE_URL}/sanctioned_addresses_{ticker}.txt"
        async with httpx.AsyncClient(timeout=15) as client:
            resp = await client.get(url)
        if resp.status_code == 404:
            addresses: set[str] = set()
        else:
            resp.raise_for_status()
            addresses = {line.strip() for line in resp.text.splitlines() if line.strip()}

        self._cache[ticker] = (time.monotonic(), addresses)
        return addresses

    async def screen_address(self, address: str, network: str | None = None) -> WalletScreeningResult:
        ticker = NETWORK_TO_TICKER.get(network or "")
        if not ticker:
            return WalletScreeningResult(is_sanctioned=False, identifications=[], provider=self.name, raw=None)

        addresses = await self._addresses_for_ticker(ticker)
        is_match = address in addresses
        identifications = (
            [WalletIdentification(
                category="sanctions",
                name="OFAC SDN",
                description=f"Address found in OFAC SDN sanctioned {ticker} address list",
            )]
            if is_match
            else []
        )
        return WalletScreeningResult(
            is_sanctioned=is_match,
            identifications=identifications,
            provider=self.name,
            raw={"ticker": ticker, "list_size": len(addresses)},
        )
