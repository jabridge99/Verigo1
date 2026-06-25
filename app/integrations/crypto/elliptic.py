"""
Elliptic wallet screening (Lens / Discovery "Wallet" endpoint) — enterprise
crypto risk & sanctions screening across 50+ blockchains.
Docs: https://docs.elliptic.co (Wallet Screening API).

Auth: Elliptic uses HMAC-SHA256 request signing — every request is signed
with an API key + secret pair over (timestamp + method + path + body), sent
as the `x-access-key`, `x-access-sign`, and `x-access-timestamp` headers.

Set CRYPTO_PROVIDER=elliptic, ELLIPTIC_API_KEY and ELLIPTIC_API_SECRET in env.

NOTE: Elliptic is an enterprise/sales-gated product — there is no public
self-serve sandbox to verify the exact response schema at integration time.
The signing scheme and endpoint shape below follow Elliptic's publicly
documented conventions; response parsing is intentionally defensive (checks
several plausible field names) rather than hard-coded to one assumed shape.
Confirm both the signing scheme and response fields against a live contract
sandbox before relying on this in production.
"""

from __future__ import annotations

import base64
import hashlib
import hmac
import logging
import time

import httpx

from app.integrations.base import ProviderRejectedError, ProviderUnavailableError

from .base import CryptoWalletProvider, WalletIdentification, WalletScreeningResult

log = logging.getLogger("verigo.integrations.crypto.elliptic")

BASE_URL = "https://aml-api.elliptic.co"
WALLET_PATH = "/v2/wallet/synchronous"

# Our CryptoNetwork -> Elliptic blockchain identifier (best-effort mapping;
# confirm against the live "supported assets" list before going live).
NETWORK_TO_ASSET: dict[str, str] = {
    "bitcoin": "bitcoin",
    "ethereum": "ethereum",
    "solana": "solana",
    "tron": "tron",
    "usdt_erc20": "tether",
    "usdt_trc20": "tether",
    "usdc": "usd_coin",
    "bnb": "binance",
    "polygon": "polygon",
}


class EllipticProvider(CryptoWalletProvider):
    name = "elliptic"

    def __init__(self, api_key: str, api_secret: str):
        if not api_key or not api_secret:
            raise ProviderUnavailableError(
                "elliptic", "ELLIPTIC_API_KEY / ELLIPTIC_API_SECRET not configured"
            )
        self.api_key = api_key
        self.api_secret = api_secret

    def _sign(self, method: str, path: str, timestamp: str, body: str) -> str:
        message = f"{timestamp}{method}{path}{body}".encode()
        digest = hmac.new(self.api_secret.encode(), message, hashlib.sha256).digest()
        return base64.b64encode(digest).decode()

    async def screen_address(
        self, address: str, network: str | None = None
    ) -> WalletScreeningResult:
        asset = NETWORK_TO_ASSET.get(network or "", network or "")
        body_dict = {
            "subject": {"asset": asset, "blockchain": asset, "hash": address},
            "type": "wallet_exposure",
        }
        body = httpx.Request(
            "POST", BASE_URL + WALLET_PATH, json=body_dict
        ).content.decode()
        timestamp = str(int(time.time() * 1000))
        signature = self._sign("POST", WALLET_PATH, timestamp, body)

        headers = {
            "x-access-key": self.api_key,
            "x-access-sign": signature,
            "x-access-timestamp": timestamp,
            "Content-Type": "application/json",
        }
        async with httpx.AsyncClient(timeout=15, base_url=BASE_URL) as client:
            resp = await client.post(WALLET_PATH, content=body, headers=headers)

        if resp.status_code >= 400:
            raise ProviderRejectedError(
                "elliptic", f"{resp.status_code}: {resp.text}", raw=resp.text
            )

        data = resp.json()
        risk_score = data.get("risk_score") or data.get("riskScore") or 0
        type_categories = data.get("type_category") or data.get("categories") or []

        identifications = []
        for cat in type_categories:
            identifications.append(WalletIdentification(category=str(cat)))

        is_sanctioned = bool(
            data.get("is_sanctioned")
            or data.get("sanctioned")
            or "sanctions" in [str(c).lower() for c in type_categories]
            or risk_score >= 8  # Elliptic uses a 0-10 risk scale by convention
        )

        return WalletScreeningResult(
            is_sanctioned=is_sanctioned,
            identifications=identifications,
            provider=self.name,
            raw=data,
        )
