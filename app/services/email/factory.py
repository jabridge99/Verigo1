"""
EmailProvider factory.

Backend resolved from EMAIL_BACKEND env var: console (default in dev),
smtp, or resend. Falls back to console if a configured backend is
missing required credentials, so the app never crashes for lack of mail
config — it just logs instead of sending.
"""

from __future__ import annotations

from app.config import settings

from .base import EmailProvider

_provider: EmailProvider | None = None


def _build_provider() -> EmailProvider:
    backend = (getattr(settings, "email_backend", "") or "console").lower()

    if backend == "resend" and settings.resend_api_key:
        from .resend import ResendEmailProvider

        return ResendEmailProvider(
            api_key=settings.resend_api_key,
            from_email=settings.from_email,
            from_name=settings.from_name,
        )

    if backend == "smtp" and settings.smtp_host and settings.smtp_user:
        from .smtp import SMTPEmailProvider

        return SMTPEmailProvider(
            host=settings.smtp_host,
            port=settings.smtp_port,
            user=settings.smtp_user,
            password=settings.smtp_pass,
            from_email=settings.from_email,
            from_name=settings.from_name,
        )

    from .console import ConsoleEmailProvider

    return ConsoleEmailProvider()


def get_email_provider() -> EmailProvider:
    global _provider
    if _provider is None:
        _provider = _build_provider()
    return _provider


def reset_email_provider_cache() -> None:
    """Drop the cached provider — call after EMAIL_BACKEND / credentials change."""
    global _provider
    _provider = None
