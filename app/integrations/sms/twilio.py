"""
Twilio SMS provider.
Requires: pip install twilio
Set SMS_PROVIDER=twilio, TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, TWILIO_FROM_NUMBER in env.
"""

from __future__ import annotations

import asyncio
import logging

from .base import SMSMessage, SMSProvider

log = logging.getLogger("verigo.integrations.sms.twilio")


class TwilioSMSProvider(SMSProvider):
    def __init__(self, account_sid: str, auth_token: str, from_number: str):
        self.account_sid = account_sid
        self.auth_token = auth_token
        self.from_number = from_number
        self._client = None

    def _get_client(self):
        if self._client is None:
            from twilio.rest import Client

            self._client = Client(self.account_sid, self.auth_token)
        return self._client

    async def send(self, message: SMSMessage) -> bool:
        client = self._get_client()
        from_number = message.from_number or self.from_number

        def _call():
            return client.messages.create(
                body=message.body,
                from_=from_number,
                to=message.to,
            )

        try:
            msg = await asyncio.get_event_loop().run_in_executor(None, _call)
            log.info("SMS sent sid=%s to=%s", msg.sid, message.to)
            return True
        except Exception as exc:
            log.error("Twilio SMS failed: %s", exc)
            return False
