"""Abstract interface for crypto wallet / address risk screening."""
from __future__ import annotations

import abc
from dataclasses import dataclass, field
from typing import Any


@dataclass
class WalletIdentification:
    """A single sanctions/risk identification returned for an address."""
    category: str               # e.g. "sanctions", "darknet", "mixer", "scam"
    name: str | None = None     # designated entity/list name, if provided
    description: str | None = None
    url: str | None = None


@dataclass
class WalletScreeningResult:
    # True if the address was flagged by the provider at all — for
    # sanctions-only providers (Chainalysis, OFAC SDN) this means a literal
    # sanctions-list match; for aggregator providers (GoPlus, Scorechain,
    # Crypto APIs) it means *any* risk flag fired (sanctions, mixer, darknet,
    # scam, etc) — see `identifications` for the specific category breakdown.
    is_sanctioned: bool
    identifications: list[WalletIdentification] = field(default_factory=list)
    provider: str = ""
    raw: Any = None


class CryptoWalletProvider(abc.ABC):

    name: str = "internal"

    @abc.abstractmethod
    async def screen_address(self, address: str, network: str | None = None) -> WalletScreeningResult:
        """Screen a single wallet address for sanctions/risk exposure."""
