from __future__ import annotations

import logging
from .base import SMSProvider, SMSMessage

log = logging.getLogger("verigo.integrations.sms")


class StubSMSProvider(SMSProvider):
    async def send(self, message: SMSMessage) -> bool:
        log.info("SMS STUB to=%s body='%s'", message.to, message.body[:50])
        return True
