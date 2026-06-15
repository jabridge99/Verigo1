from __future__ import annotations

from app.config import settings
from .base import AUSTRACProvider


def get_provider() -> AUSTRACProvider:
    """Return configured AUSTRAC provider. Swap stub for real when API creds exist."""
    austrac_api_key = getattr(settings, "austrac_api_key", "")
    if austrac_api_key:
        # Future: from .online import AUSTRACOnlineProvider; return AUSTRACOnlineProvider(...)
        raise NotImplementedError("AUSTRAC Online API provider not yet implemented")
    from .stub import StubAUSTRACProvider
    return StubAUSTRACProvider()
