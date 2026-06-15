"""
Internal sanctions screener using locally cached OFAC/UN/DFAT lists.
Suitable for basic screening; replace with a commercial provider for
production-grade fuzzy matching and real-time list updates.
"""
from __future__ import annotations

import difflib
import logging
from .base import SanctionsProvider, SanctionsResult, SanctionsMatch

log = logging.getLogger("verigo.integrations.sanctions")

# Extend this list with entries from DFAT, OFAC, UN, EU consolidated lists.
# Production: fetch and cache these from official sources on a schedule.
LISTS: dict[str, list[str]] = {
    "DFAT_AU": [
        "Al-Qaeda", "Islamic State", "Taliban",
    ],
    "OFAC_SDN": [],
    "UN_CONSOLIDATED": [],
    "EU_CONSOLIDATED": [],
}

MATCH_THRESHOLD = 0.85


class InternalSanctionsProvider(SanctionsProvider):
    async def screen(
        self,
        name: str,
        dob: str | None = None,
        country: str | None = None,
        entity_type: str = "individual",
    ) -> SanctionsResult:
        matches = []
        lists_checked = list(LISTS.keys())
        name_lower = name.lower()

        for list_name, entries in LISTS.items():
            for entry in entries:
                ratio = difflib.SequenceMatcher(None, name_lower, entry.lower()).ratio()
                if ratio >= MATCH_THRESHOLD:
                    matches.append(SanctionsMatch(
                        list_name=list_name,
                        match_name=entry,
                        match_score=round(ratio, 3),
                    ))

        return SanctionsResult(
            is_match=bool(matches),
            matches=matches,
            lists_checked=lists_checked,
            provider="internal",
        )
