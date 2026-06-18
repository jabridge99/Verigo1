from __future__ import annotations

from app.config import settings

from .base import SanctionsProvider


def get_provider() -> SanctionsProvider:
    provider = getattr(settings, "sanctions_provider", "internal")

    if provider == "complyadvantage":
        from .complyadvantage import ComplyAdvantageProvider

        return ComplyAdvantageProvider(api_key=settings.complyadvantage_api_key)

    if provider == "worldcheck":
        # Future: from .worldcheck import WorldCheckProvider
        raise NotImplementedError("WorldCheck provider not yet implemented")

    # Default: internal list matching
    from .internal import InternalSanctionsProvider

    return InternalSanctionsProvider()
