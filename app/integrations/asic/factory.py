from __future__ import annotations

from app.config import settings

from .base import ASICProvider


def get_provider() -> ASICProvider:
    api_key = getattr(settings, "asic_api_key", "")
    if api_key:
        # Future: from .asic_connect import ASICConnectProvider
        raise NotImplementedError("ASIC Connect API provider not yet implemented")
    from .stub import StubASICProvider

    return StubASICProvider()
