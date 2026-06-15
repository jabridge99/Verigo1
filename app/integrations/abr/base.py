"""Abstract interface for Australian Business Register (ABR) lookups."""
from __future__ import annotations

import abc
from dataclasses import dataclass, field
from typing import Any


@dataclass
class ABNRecord:
    abn: str
    entity_name: str
    entity_type: str               # Company, Individual/Sole Trader, Trust, etc.
    status: str                    # Active, Cancelled
    gst_registered: bool
    state: str | None = None
    postcode: str | None = None
    acn: str | None = None
    trading_names: list[str] = field(default_factory=list)
    raw: Any = None


class ABRProvider(abc.ABC):

    @abc.abstractmethod
    async def lookup_abn(self, abn: str) -> ABNRecord | None:
        """Look up entity by ABN. Returns None if not found."""

    @abc.abstractmethod
    async def lookup_acn(self, acn: str) -> ABNRecord | None:
        """Look up entity by ACN (company number)."""

    @abc.abstractmethod
    async def search_by_name(self, name: str, state: str | None = None) -> list[ABNRecord]:
        """Search businesses by name."""
