"""
P42: InternalSanctionsProvider's DFAT/OFAC/UN lists were hardcoded to three
made-up entries (only DFAT_AU had any content at all) -- a real fuzzy-match
call against real names had almost no chance of ever matching anything real.

Fixed by adding real fetch-and-cache functions for the DFAT Consolidated
List (xlsx), OFAC SDN (csv) and UN Security Council Consolidated List
(xml), all published free with no API key. Live fetching is gated behind
settings.sanctions_live_lists_enabled (default off) so the rest of the test
suite -- which calls the sanctions provider incidentally through screening/
onboarding flows -- never depends on three government websites being
reachable; these tests are the only ones that flip the flag on, and they
always mock httpx so no real network call is made.
"""

from __future__ import annotations

import io

import httpx
import openpyxl
import pytest

from app.integrations.sanctions import internal as internal_module
from app.integrations.sanctions.internal import (
    DFAT_SEED_FALLBACK,
    InternalSanctionsProvider,
    _fetch_dfat_consolidated,
    _fetch_ofac_sdn,
    _fetch_un_consolidated,
    _names_for_list,
)

UN_XML_FIXTURE = b"""<?xml version="1.0" encoding="UTF-8"?>
<CONSOLIDATED_LIST>
  <INDIVIDUALS>
    <INDIVIDUAL>
      <FIRST_NAME>Osama</FIRST_NAME>
      <SECOND_NAME>bin</SECOND_NAME>
      <THIRD_NAME>Laden</THIRD_NAME>
    </INDIVIDUAL>
  </INDIVIDUALS>
  <ENTITIES>
    <ENTITY>
      <FIRST_NAME>Fictional Sanctioned Front Company</FIRST_NAME>
    </ENTITY>
  </ENTITIES>
</CONSOLIDATED_LIST>
"""


def _dfat_xlsx_bytes() -> bytes:
    wb = openpyxl.Workbook()
    ws = wb.active
    ws.append(["Reference", "Type", "Name of Individual or Entity", "Address"])
    ws.append(["1234", "Individual", "Kim Jong Fictional", ""])
    ws.append(["1235", "Entity", "Fictional Sanctioned Bank", ""])
    buf = io.BytesIO()
    wb.save(buf)
    return buf.getvalue()


class _FakeResponse:
    def __init__(self, *, text: str | None = None, content: bytes | None = None):
        self._text = text
        self._content = content
        self.status_code = 200

    @property
    def text(self):
        return self._text

    @property
    def content(self):
        return self._content

    def raise_for_status(self):
        pass


@pytest.fixture(autouse=True)
def _clear_cache():
    internal_module._cache.clear()
    yield
    internal_module._cache.clear()


# ── Individual fetcher parsing ───────────────────────────────────────────────


@pytest.mark.asyncio
async def test_fetch_ofac_sdn_parses_csv(monkeypatch):
    csv_text = (
        '1,"BIN LADEN, Usama",individual,"[SDGT]","",,,,,,\r\n'
        '2,"FICTIONAL SANCTIONED VESSEL CO",entity,"[SDNTK]","",,,,,,\r\n'
    )

    async def _fake_get(self, url):
        assert url == internal_module.OFAC_SDN_CSV_URL
        return _FakeResponse(text=csv_text)

    monkeypatch.setattr(httpx.AsyncClient, "get", _fake_get)
    names = await _fetch_ofac_sdn()
    assert names == ["BIN LADEN, Usama", "FICTIONAL SANCTIONED VESSEL CO"]


@pytest.mark.asyncio
async def test_fetch_un_consolidated_parses_individuals_and_entities(monkeypatch):
    async def _fake_get(self, url):
        assert url == internal_module.UN_CONSOLIDATED_XML_URL
        return _FakeResponse(content=UN_XML_FIXTURE)

    monkeypatch.setattr(httpx.AsyncClient, "get", _fake_get)
    names = await _fetch_un_consolidated()
    assert "Osama bin Laden" in names
    assert "Fictional Sanctioned Front Company" in names


@pytest.mark.asyncio
async def test_fetch_dfat_consolidated_locates_name_column_by_header(monkeypatch):
    xlsx_bytes = _dfat_xlsx_bytes()

    async def _fake_get(self, url):
        assert url == internal_module.DFAT_CONSOLIDATED_XLSX_URL
        return _FakeResponse(content=xlsx_bytes)

    monkeypatch.setattr(httpx.AsyncClient, "get", _fake_get)
    names = await _fetch_dfat_consolidated()
    assert names == ["Kim Jong Fictional", "Fictional Sanctioned Bank"]


# ── Caching / fallback behaviour of _names_for_list ─────────────────────────


@pytest.mark.asyncio
async def test_names_for_list_returns_seed_when_live_lists_disabled(monkeypatch):
    monkeypatch.setattr(internal_module.settings, "sanctions_live_lists_enabled", False)
    assert await _names_for_list("DFAT_AU") == DFAT_SEED_FALLBACK
    assert await _names_for_list("OFAC_SDN") == []


@pytest.mark.asyncio
async def test_names_for_list_fetches_and_caches_when_enabled(monkeypatch):
    monkeypatch.setattr(internal_module.settings, "sanctions_live_lists_enabled", True)
    calls = []

    async def _fake_fetch():
        calls.append(1)
        return ["Live Fetched Name"]

    monkeypatch.setitem(internal_module._FETCHERS, "OFAC_SDN", _fake_fetch)

    first = await _names_for_list("OFAC_SDN")
    second = await _names_for_list("OFAC_SDN")
    assert first == ["Live Fetched Name"]
    assert second == ["Live Fetched Name"]
    assert len(calls) == 1  # second call served from cache, not refetched


@pytest.mark.asyncio
async def test_names_for_list_falls_back_to_seed_on_first_ever_failure(monkeypatch):
    monkeypatch.setattr(internal_module.settings, "sanctions_live_lists_enabled", True)

    async def _fake_fetch_fails():
        raise httpx.ConnectError("no route to host")

    monkeypatch.setitem(internal_module._FETCHERS, "DFAT_AU", _fake_fetch_fails)
    assert await _names_for_list("DFAT_AU") == DFAT_SEED_FALLBACK


@pytest.mark.asyncio
async def test_names_for_list_falls_back_to_last_good_cache_on_later_failure(
    monkeypatch,
):
    monkeypatch.setattr(internal_module.settings, "sanctions_live_lists_enabled", True)
    attempt = {"n": 0}

    async def _fake_fetch(*, attempt=attempt):
        attempt["n"] += 1
        if attempt["n"] == 1:
            return ["First Successful Fetch"]
        raise httpx.ConnectError("temporary outage")

    monkeypatch.setitem(internal_module._FETCHERS, "UN_CONSOLIDATED", _fake_fetch)

    first = await _names_for_list("UN_CONSOLIDATED")
    internal_module._cache["UN_CONSOLIDATED"] = (0.0, first)  # force TTL expiry
    second = await _names_for_list("UN_CONSOLIDATED")
    assert first == ["First Successful Fetch"]
    assert second == ["First Successful Fetch"]  # served stale cache, not []


# ── End-to-end via InternalSanctionsProvider.screen() ───────────────────────


@pytest.mark.asyncio
async def test_screen_matches_a_live_fetched_name(monkeypatch):
    monkeypatch.setattr(internal_module.settings, "sanctions_live_lists_enabled", True)

    async def _fake_ofac():
        return ["Fictional Live Sanctioned Person"]

    async def _fake_empty():
        return []

    monkeypatch.setitem(internal_module._FETCHERS, "OFAC_SDN", _fake_ofac)
    monkeypatch.setitem(internal_module._FETCHERS, "DFAT_AU", _fake_empty)
    monkeypatch.setitem(internal_module._FETCHERS, "UN_CONSOLIDATED", _fake_empty)

    provider = InternalSanctionsProvider()
    result = await provider.screen("Fictional Live Sanctioned Person")
    assert result.is_match is True
    assert result.matches[0].list_name == "OFAC_SDN"
    assert set(result.lists_checked) == {
        "DFAT_AU",
        "OFAC_SDN",
        "UN_CONSOLIDATED",
        "EU_CONSOLIDATED",
    }
