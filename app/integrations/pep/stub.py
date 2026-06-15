from __future__ import annotations

import logging
from .base import PEPProvider, PEPResult

log = logging.getLogger("verigo.integrations.pep")


class StubPEPProvider(PEPProvider):
    async def screen(self, name: str, dob: str | None = None, country: str | None = None) -> PEPResult:
        log.info("PEP stub: screening '%s'", name)
        return PEPResult(is_pep=False, matches=[], provider="stub")
