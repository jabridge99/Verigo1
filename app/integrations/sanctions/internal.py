"""
Internal sanctions screener. Fuzzy-matches a name against the DFAT, OFAC and
UN consolidated sanctions lists, which are all published free by their
respective governments with no API key or licence required (see
PARKING_LOT.md P42). EU_CONSOLIDATED is listed but not yet wired to a free
source -- a known gap, not a removed feature.

Live fetching is gated behind settings.sanctions_live_lists_enabled
(default off) so dev/test runs never depend on three government websites
being reachable or fast. When disabled, or when a fetch fails outright
before any successful fetch has been cached, DFAT_AU falls back to a small
built-in seed (the same three well-known entries this module always shipped
with) so screening never silently runs against zero sanctions data; OFAC_SDN
and UN_CONSOLIDATED have no such seed (they were empty before this change
too) and simply stay empty until a live fetch succeeds.

Source formats (verified via web search, September 2026 -- these are
outside our control and can change without notice; a parsing failure is
logged and treated the same as a fetch failure, never raised):
  - OFAC SDN: sanctionslistservice.ofac.treas.gov's SDN.CSV, a headerless
    CSV where column index 1 is the primary name.
  - UN Security Council Consolidated List: scsanctions.un.org's
    consolidated.xml. INDIVIDUAL elements carry FIRST_NAME/SECOND_NAME/
    THIRD_NAME/FOURTH_NAME; ENTITY elements carry the full entity name in
    FIRST_NAME.
  - DFAT Consolidated List: dfat.gov.au's regulation8_consolidated.xlsx,
    whose header row has a "Name of Individual or Entity" column (the
    column position isn't hardcoded -- it's located by header text so a
    reordering of columns doesn't silently start reading the wrong field).
"""

from __future__ import annotations

import csv
import difflib
import io
import logging
import time
import xml.etree.ElementTree as ET

import httpx
import openpyxl

from app.config import settings

from .base import SanctionsMatch, SanctionsProvider, SanctionsResult

log = logging.getLogger("verigo.integrations.sanctions")

OFAC_SDN_CSV_URL = "https://sanctionslistservice.ofac.treas.gov/api/download/SDN.CSV"
UN_CONSOLIDATED_XML_URL = "https://scsanctions.un.org/resources/xml/en/consolidated.xml"
DFAT_CONSOLIDATED_XLSX_URL = (
    "https://www.dfat.gov.au/sites/default/files/regulation8_consolidated.xlsx"
)

# Last-resort seed for DFAT_AU only -- see module docstring.
DFAT_SEED_FALLBACK: list[str] = ["Al-Qaeda", "Islamic State", "Taliban"]

CACHE_TTL_SECONDS = 12 * 60 * 60  # refetch at most twice a day per list
FETCH_TIMEOUT_SECONDS = 30

MATCH_THRESHOLD = 0.85


async def _fetch_text(url: str) -> str:
    async with httpx.AsyncClient(timeout=FETCH_TIMEOUT_SECONDS) as client:
        resp = await client.get(url)
    resp.raise_for_status()
    return resp.text


async def _fetch_bytes(url: str) -> bytes:
    async with httpx.AsyncClient(timeout=FETCH_TIMEOUT_SECONDS) as client:
        resp = await client.get(url)
    resp.raise_for_status()
    return resp.content


async def _fetch_ofac_sdn() -> list[str]:
    text = await _fetch_text(OFAC_SDN_CSV_URL)
    names = []
    for row in csv.reader(io.StringIO(text)):
        if len(row) > 1 and row[1].strip():
            names.append(row[1].strip())
    return names


async def _fetch_un_consolidated() -> list[str]:
    content = await _fetch_bytes(UN_CONSOLIDATED_XML_URL)
    root = ET.fromstring(content)

    names = []
    for individual in root.iter("INDIVIDUAL"):
        parts = [
            (individual.findtext(tag) or "").strip()
            for tag in ("FIRST_NAME", "SECOND_NAME", "THIRD_NAME", "FOURTH_NAME")
        ]
        full_name = " ".join(part for part in parts if part)
        if full_name:
            names.append(full_name)

    for entity in root.iter("ENTITY"):
        entity_name = (entity.findtext("FIRST_NAME") or "").strip()
        if entity_name:
            names.append(entity_name)

    return names


def _find_dfat_name_column(header_row: tuple) -> int | None:
    for idx, cell in enumerate(header_row):
        if isinstance(cell, str) and "name of individual or entity" in cell.lower():
            return idx
    return None


async def _fetch_dfat_consolidated() -> list[str]:
    content = await _fetch_bytes(DFAT_CONSOLIDATED_XLSX_URL)
    workbook = openpyxl.load_workbook(
        io.BytesIO(content), read_only=True, data_only=True
    )
    worksheet = workbook.active

    names: list[str] = []
    name_column: int | None = None
    for row in worksheet.iter_rows(values_only=True):
        if name_column is None:
            name_column = _find_dfat_name_column(row)
            continue
        if name_column < len(row) and row[name_column]:
            names.append(str(row[name_column]).strip())

    if name_column is None:
        raise ValueError("DFAT xlsx has no 'Name of Individual or Entity' column")
    return names


_FETCHERS = {
    "DFAT_AU": _fetch_dfat_consolidated,
    "OFAC_SDN": _fetch_ofac_sdn,
    "UN_CONSOLIDATED": _fetch_un_consolidated,
}

# EU_CONSOLIDATED: no free source wired up yet -- always checked, always empty.
_STATIC_LISTS: dict[str, list[str]] = {"EU_CONSOLIDATED": []}

_cache: dict[str, tuple[float, list[str]]] = {}


async def _names_for_list(list_name: str) -> list[str]:
    if not settings.sanctions_live_lists_enabled:
        return DFAT_SEED_FALLBACK if list_name == "DFAT_AU" else []

    cached = _cache.get(list_name)
    if cached and (time.monotonic() - cached[0]) < CACHE_TTL_SECONDS:
        return cached[1]

    try:
        names = await _FETCHERS[list_name]()
    except Exception:
        log.warning(
            "sanctions list fetch failed for %s; using last cached copy",
            list_name,
            exc_info=True,
        )
        if cached:
            return cached[1]
        return DFAT_SEED_FALLBACK if list_name == "DFAT_AU" else []

    _cache[list_name] = (time.monotonic(), names)
    return names


class InternalSanctionsProvider(SanctionsProvider):
    async def screen(
        self,
        name: str,
        dob: str | None = None,
        country: str | None = None,
        entity_type: str = "individual",
    ) -> SanctionsResult:
        matches = []
        lists_checked = [*_FETCHERS.keys(), *_STATIC_LISTS.keys()]
        name_lower = name.lower()

        for list_name in lists_checked:
            entries = (
                await _names_for_list(list_name)
                if list_name in _FETCHERS
                else _STATIC_LISTS[list_name]
            )
            for entry in entries:
                ratio = difflib.SequenceMatcher(None, name_lower, entry.lower()).ratio()
                if ratio >= MATCH_THRESHOLD:
                    matches.append(
                        SanctionsMatch(
                            list_name=list_name,
                            match_name=entry,
                            match_score=round(ratio, 3),
                        )
                    )

        return SanctionsResult(
            is_match=bool(matches),
            matches=matches,
            lists_checked=lists_checked,
            provider="internal",
        )
