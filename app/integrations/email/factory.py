from __future__ import annotations

from app.config import settings

from .base import EmailProvider


def get_provider() -> EmailProvider:
    provider = getattr(settings, "email_provider", "smtp")

    # "sendgrid" is not a separate REST client -- app/integrations/email/
    # has no sendgrid.py, so EMAIL_PROVIDER=sendgrid would ModuleNotFoundError
    # here (found digging into P45's "real" Integration Hub connection
    # check for SendGrid). SendGrid is used via its documented SMTP relay
    # instead (smtp.sendgrid.net, username "apikey", the API key as the
    # password) -- point EMAIL_PROVIDER at "smtp" with those settings, same
    # as SMTPEmailProvider's own docstring already says ("Works with any
    # SMTP relay (SendGrid, Postmark, SES, etc.)").
    if provider == "stub" or not settings.smtp_host:
        from .stub import StubEmailProvider

        return StubEmailProvider()

    from .smtp import SMTPEmailProvider

    return SMTPEmailProvider()
