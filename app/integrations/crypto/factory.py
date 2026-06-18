from __future__ import annotations

from app.config import settings
from .base import CryptoWalletProvider


def get_provider() -> CryptoWalletProvider:
    provider = getattr(settings, "crypto_provider", "internal")

    if provider == "chainalysis":
        from .chainalysis import ChainalysisProvider
        return ChainalysisProvider(api_key=settings.chainalysis_api_key)

    if provider in ("trm_labs", "elliptic"):
        raise NotImplementedError(f"{provider} provider not yet implemented")

    raise NotImplementedError("No crypto wallet screening provider configured")
