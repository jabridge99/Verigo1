from __future__ import annotations

from app.config import settings

from .base import CryptoWalletProvider


def get_provider() -> CryptoWalletProvider:
    provider = getattr(settings, "crypto_provider", "internal")

    if provider == "chainalysis":
        from .chainalysis import ChainalysisProvider

        return ChainalysisProvider(api_key=settings.chainalysis_api_key)

    if provider == "ofac_sdn":
        from .ofac_sdn import OFACSDNProvider

        return OFACSDNProvider()

    if provider == "crypto_apis":
        from .crypto_apis import CryptoAPIsProvider

        return CryptoAPIsProvider(api_key=settings.cryptoapis_api_key)

    if provider == "scorechain":
        from .scorechain import ScorechainProvider

        return ScorechainProvider(api_key=settings.scorechain_api_key)

    if provider == "goplus":
        from .goplus import GoPlusProvider

        return GoPlusProvider(api_key=settings.goplus_api_key)

    if provider == "elliptic":
        from .elliptic import EllipticProvider

        return EllipticProvider(
            api_key=settings.elliptic_api_key, api_secret=settings.elliptic_api_secret
        )

    if provider == "trm_labs":
        raise NotImplementedError(f"{provider} provider not yet implemented")

    raise NotImplementedError("No crypto wallet screening provider configured")
