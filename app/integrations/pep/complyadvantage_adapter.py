"""Adapts ComplyAdvantage sanctions results to PEPResult."""

from __future__ import annotations

from app.integrations.sanctions.complyadvantage import ComplyAdvantageProvider

from .base import PEPMatch, PEPProvider, PEPResult


class ComplyAdvantagePEPAdapter(PEPProvider):
    def __init__(self, ca: ComplyAdvantageProvider):
        self._ca = ca

    async def screen(
        self, name: str, dob: str | None = None, country: str | None = None
    ) -> PEPResult:
        result = await self._ca.screen(name, dob, country, entity_type="individual")
        pep_matches = []
        for m in result.matches:
            if "pep" in m.list_name.lower():
                pep_matches.append(
                    PEPMatch(
                        match_name=m.match_name,
                        match_score=m.match_score,
                        details=m.details,
                    )
                )
        return PEPResult(
            is_pep=bool(pep_matches),
            matches=pep_matches,
            provider="complyadvantage",
            raw=result.raw,
        )
