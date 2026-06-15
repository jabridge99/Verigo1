from __future__ import annotations

from app.config import settings
from .base import EmailProvider


def get_provider() -> EmailProvider:
    provider = getattr(settings, "email_provider", "smtp")

    if provider == "sendgrid":
        from .sendgrid import SendGridEmailProvider
        return SendGridEmailProvider(api_key=settings.smtp_pass)  # SG uses API key as password

    if provider == "stub" or not settings.smtp_host:
        from .stub import StubEmailProvider
        return StubEmailProvider()

    from .smtp import SMTPEmailProvider
    return SMTPEmailProvider()
