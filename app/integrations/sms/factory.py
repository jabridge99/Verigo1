from __future__ import annotations

from app.config import settings
from .base import SMSProvider


def get_provider() -> SMSProvider:
    provider = getattr(settings, "sms_provider", "stub")

    if provider == "twilio":
        from .twilio import TwilioSMSProvider
        return TwilioSMSProvider(
            account_sid=settings.twilio_account_sid,
            auth_token=settings.twilio_auth_token,
            from_number=settings.twilio_from_number,
        )

    if provider == "messagebird":
        raise NotImplementedError("MessageBird SMS provider not yet implemented")

    from .stub import StubSMSProvider
    return StubSMSProvider()
