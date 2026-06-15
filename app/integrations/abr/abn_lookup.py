"""
ABR provider using the free ABN Lookup web service.
Register for a free GUID at: https://abr.business.gov.au/Tools/WebServices
Set ABR_GUID in environment to activate.
"""
from __future__ import annotations

import logging
import xml.etree.ElementTree as ET

import httpx

from app.integrations.base import IntegrationError, ProviderRejectedError
from .base import ABRProvider, ABNRecord

log = logging.getLogger("verigo.integrations.abr")

ABN_LOOKUP_BASE = "https://abr.business.gov.au/abrxmlsearch/AbrXmlSearch.asmx"


class ABNLookupProvider(ABRProvider):
    def __init__(self, guid: str):
        self.guid = guid

    # ── helpers ───────────────────────────────────────────────────────────────

    def _parse_entity(self, root: ET.Element, ns: str) -> ABNRecord | None:
        resp = root.find(f".//{ns}response")
        if resp is None:
            return None
        exc = resp.find(f"{ns}exception")
        if exc is not None:
            msg = exc.findtext(f"{ns}exceptionDescription", "")
            raise ProviderRejectedError("abr", msg)

        entity = resp.find(f"{ns}businessEntity")
        if entity is None:
            return None

        abn = entity.findtext(f"{ns}ABN/{ns}identifierValue", "")
        status = entity.findtext(f"{ns}ABN/{ns}identifierStatus", "")
        entity_type = entity.findtext(f"{ns}entityType/{ns}entityTypeCode", "")
        entity_name = (
            entity.findtext(f"{ns}mainName/{ns}organisationName")
            or entity.findtext(f"{ns}legalName/{ns}givenName", "") + " " +
            entity.findtext(f"{ns}legalName/{ns}familyName", "")
        ).strip()

        gst_el = entity.find(f"{ns}goodsAndServicesTax")
        gst = gst_el is not None and gst_el.findtext(f"{ns}effectiveFrom") is not None

        trading_names = [
            n.findtext(f"{ns}organisationName", "")
            for n in entity.findall(f"{ns}tradingName")
        ]

        address = entity.find(f"{ns}mainBusinessPhysicalAddress")
        state = address.findtext(f"{ns}stateCode") if address is not None else None
        postcode = address.findtext(f"{ns}postcode") if address is not None else None

        acn_el = entity.find(f"{ns}ASICNumber")
        acn = acn_el.text if acn_el is not None else None

        return ABNRecord(
            abn=abn, entity_name=entity_name, entity_type=entity_type,
            status=status, gst_registered=gst, state=state, postcode=postcode,
            acn=acn, trading_names=[t for t in trading_names if t],
        )

    # ── interface ─────────────────────────────────────────────────────────────

    async def lookup_abn(self, abn: str) -> ABNRecord | None:
        clean = abn.replace(" ", "")
        url = (f"{ABN_LOOKUP_BASE}/SearchByABNv202001"
               f"?searchString={clean}&includeHistoricalDetails=N&authenticationGuid={self.guid}")
        async with httpx.AsyncClient(timeout=10) as client:
            resp = await client.get(url)
            resp.raise_for_status()
        ns = "{urn:ABRXMLSearch}"
        root = ET.fromstring(resp.text)
        try:
            return self._parse_entity(root, ns)
        except ProviderRejectedError:
            return None

    async def lookup_acn(self, acn: str) -> ABNRecord | None:
        clean = acn.replace(" ", "")
        url = (f"{ABN_LOOKUP_BASE}/SearchByASICv201408"
               f"?searchString={clean}&includeHistoricalDetails=N&authenticationGuid={self.guid}")
        async with httpx.AsyncClient(timeout=10) as client:
            resp = await client.get(url)
            resp.raise_for_status()
        ns = "{urn:ABRXMLSearch}"
        root = ET.fromstring(resp.text)
        try:
            return self._parse_entity(root, ns)
        except ProviderRejectedError:
            return None

    async def search_by_name(self, name: str, state: str | None = None) -> list[ABNRecord]:
        params = f"?name={name}&guid={self.guid}"
        url = f"{ABN_LOOKUP_BASE}/ABRSearchByNameSimpleProtocol2017{params}"
        async with httpx.AsyncClient(timeout=10) as client:
            resp = await client.get(url)
            resp.raise_for_status()
        # Returns a list of hits — parse each entry
        ns = "{urn:ABRXMLSearch}"
        root = ET.fromstring(resp.text)
        results = []
        for entry in root.findall(f".//{ns}searchResultsRecord"):
            abn = entry.findtext(f"{ns}ABN/{ns}identifierValue", "")
            name_el = (entry.findtext(f"{ns}mainName/{ns}organisationName")
                       or entry.findtext(f"{ns}legalName/{ns}fullName", ""))
            entity_type = entry.findtext(f"{ns}entityType/{ns}entityTypeCode", "")
            status = entry.findtext(f"{ns}ABN/{ns}identifierStatus", "")
            results.append(ABNRecord(
                abn=abn, entity_name=name_el, entity_type=entity_type,
                status=status, gst_registered=False,
            ))
        return results
