from __future__ import annotations

import logging
from .base import ABRProvider, ABNRecord

log = logging.getLogger("verigo.integrations.abr")


class StubABRProvider(ABRProvider):
    async def lookup_abn(self, abn: str) -> ABNRecord | None:
        log.info("ABR stub: lookup ABN %s", abn)
        return ABNRecord(abn=abn, entity_name="Stub Entity Pty Ltd",
                         entity_type="PRV", status="Active", gst_registered=True)

    async def lookup_acn(self, acn: str) -> ABNRecord | None:
        log.info("ABR stub: lookup ACN %s", acn)
        return None

    async def search_by_name(self, name: str, state: str | None = None) -> list[ABNRecord]:
        log.info("ABR stub: search '%s'", name)
        return []
