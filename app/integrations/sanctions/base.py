"""Abstract interface for sanctions screening."""

from __future__ import annotations

import abc
from dataclasses import dataclass, field
from typing import Any


@dataclass
class SanctionsMatch:
    list_name: str  # OFAC_SDN, UN_CONSOLIDATED, EU_CONSOLIDATED, DFAT_AU
    match_name: str
    match_score: float  # 0.0–1.0
    program: str | None = None
    entry_date: str | None = None
    details: dict = field(default_factory=dict)


@dataclass
class SanctionsResult:
    is_match: bool
    matches: list[SanctionsMatch] = field(default_factory=list)
    lists_checked: list[str] = field(default_factory=list)
    provider: str = ""
    raw: Any = None


class SanctionsProvider(abc.ABC):
    @abc.abstractmethod
    async def screen(
        self,
        name: str,
        dob: str | None = None,
        country: str | None = None,
        entity_type: str = "individual",  # individual | organisation
    ) -> SanctionsResult:
        """Screen a name against sanctions lists."""
