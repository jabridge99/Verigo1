from __future__ import annotations

from app.config import settings
from .base import ABRProvider


def get_provider() -> ABRProvider:
    guid = getattr(settings, "abr_guid", "")
    if guid:
        from .abn_lookup import ABNLookupProvider
        return ABNLookupProvider(guid=guid)
    from .stub import StubABRProvider
    return StubABRProvider()
