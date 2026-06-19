from __future__ import annotations

from app.config import settings

from .base import IdentityProvider


def get_provider() -> IdentityProvider:
    provider = getattr(settings, "identity_provider", "internal")

    if provider == "sumsub":
        from .sumsub import SumsubProvider

        return SumsubProvider(
            app_token=settings.sumsub_app_token,
            secret_key=settings.sumsub_secret_key,
            base_url=settings.sumsub_base_url,
        )

    raise NotImplementedError(
        f"No hosted identity provider configured for IDENTITY_PROVIDER={provider!r} — "
        "internal verification uses app.services.identity_verification directly, "
        "not this provider abstraction."
    )
