from __future__ import annotations

import logging

from .base import EmailMessage, EmailProvider

log = logging.getLogger("verigo.integrations.email")


class StubEmailProvider(EmailProvider):
    async def send(self, message: EmailMessage) -> bool:
        log.info("EMAIL STUB to=%s subject='%s'", message.to, message.subject)
        return True
