"""Abstract interface for PEP (Politically Exposed Person) screening."""

from __future__ import annotations

import abc
from dataclasses import dataclass, field
from typing import Any


@dataclass
class PEPMatch:
    match_name: str
    match_score: float
    pep_tier: str | None = (
        None  # Tier 1 (head of state), Tier 2 (senior official), Tier 3 (associate)
    )
    position: str | None = None
    country: str | None = None
    active: bool = True
    details: dict = field(default_factory=dict)


@dataclass
class PEPResult:
    is_pep: bool
    matches: list[PEPMatch] = field(default_factory=list)
    provider: str = ""
    raw: Any = None


class PEPProvider(abc.ABC):
    @abc.abstractmethod
    async def screen(
        self,
        name: str,
        dob: str | None = None,
        country: str | None = None,
    ) -> PEPResult:
        """Screen a person against PEP databases."""
