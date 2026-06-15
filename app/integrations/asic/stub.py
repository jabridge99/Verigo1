from __future__ import annotations

import logging
from .base import ASICProvider, CompanyRecord

log = logging.getLogger("verigo.integrations.asic")


class StubASICProvider(ASICProvider):
    async def lookup_company(self, acn: str) -> CompanyRecord | None:
        log.info("ASIC stub: lookup ACN %s", acn)
        return CompanyRecord(acn=acn, name="Stub Company Pty Ltd",
                             status="Registered", company_type="Proprietary")

    async def search_companies(self, name: str) -> list[CompanyRecord]:
        log.info("ASIC stub: search '%s'", name)
        return []

    async def get_directors(self, acn: str) -> list[dict]:
        return []
