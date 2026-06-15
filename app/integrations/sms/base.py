"""Abstract interface for SMS / messaging."""
from __future__ import annotations

import abc
from dataclasses import dataclass


@dataclass
class SMSMessage:
    to: str             # E.164 format e.g. +61412345678
    body: str
    from_number: str | None = None   # defaults to settings.sms_from_number


class SMSProvider(abc.ABC):

    @abc.abstractmethod
    async def send(self, message: SMSMessage) -> bool:
        """Send SMS. Returns True on success."""
