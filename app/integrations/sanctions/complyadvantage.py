"""
ComplyAdvantage sanctions screening provider.
Docs: https://docs.complyadvantage.com/api-docs
Set SANCTIONS_PROVIDER=complyadvantage and COMPLYADVANTAGE_API_KEY in env.
"""

from __future__ import annotations

import logging

import httpx

from app.integrations.base import ProviderRejectedError

from .base import SanctionsMatch, SanctionsProvider, SanctionsResult

log = logging.getLogger("verigo.integrations.sanctions.complyadvantage")

BASE_URL = "https://api.complyadvantage.com"


class ComplyAdvantageProvider(SanctionsProvider):
    def __init__(self, api_key: str):
        self.api_key = api_key

    async def screen(
        self,
        name: str,
        dob: str | None = None,
        country: str | None = None,
        entity_type: str = "individual",
    ) -> SanctionsResult:
        payload: dict = {
            "search_term": name,
            "fuzziness": 0.6,
            "filters": {"types": ["sanction", "warning", "pep"]},
        }
        if dob:
            payload["birth_year"] = dob[:4]
        if country:
            payload.setdefault("filters", {})["birth_country"] = country

        async with httpx.AsyncClient(timeout=15) as client:
            resp = await client.post(
                f"{BASE_URL}/searches",
                json=payload,
                auth=(self.api_key, ""),
            )
            if resp.status_code != 200:
                raise ProviderRejectedError("complyadvantage", resp.text)
            data = resp.json()

        hits = data.get("content", {}).get("data", {}).get("hits", [])
        matches = []
        for hit in hits:
            doc = hit.get("doc", {})
            score = hit.get("score", 0.0)
            for source in doc.get("sources", []):
                if source.get("types", []):
                    matches.append(
                        SanctionsMatch(
                            list_name=source.get("name", "unknown"),
                            match_name=doc.get("name", name),
                            match_score=min(score / 100, 1.0),
                            details=doc,
                        )
                    )

        return SanctionsResult(
            is_match=bool(matches),
            matches=matches,
            lists_checked=["COMPLYADVANTAGE"],
            provider="complyadvantage",
            raw=data,
        )
