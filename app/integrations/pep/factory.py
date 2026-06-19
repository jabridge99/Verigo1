from __future__ import annotations

from app.config import settings

from .base import PEPProvider


def get_provider() -> PEPProvider:
    provider = getattr(settings, "pep_provider", "stub")

    if provider == "complyadvantage":
        # ComplyAdvantage covers both sanctions + PEP in one API call
        from app.integrations.sanctions.complyadvantage import ComplyAdvantageProvider

        from .complyadvantage_adapter import ComplyAdvantagePEPAdapter

        base = ComplyAdvantageProvider(api_key=settings.complyadvantage_api_key)
        return ComplyAdvantagePEPAdapter(base)

    if provider == "worldcheck":
        raise NotImplementedError("WorldCheck PEP provider not yet implemented")

    from .stub import StubPEPProvider

    return StubPEPProvider()
