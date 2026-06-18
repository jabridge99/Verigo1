"""Abstract interface for transactional email."""

from __future__ import annotations

import abc
from dataclasses import dataclass, field


@dataclass
class EmailMessage:
    to: list[str]
    subject: str
    html: str
    text: str | None = None
    from_email: str | None = None  # defaults to settings.from_email
    from_name: str | None = None
    reply_to: str | None = None
    cc: list[str] = field(default_factory=list)
    bcc: list[str] = field(default_factory=list)
    attachments: list[dict] = field(
        default_factory=list
    )  # [{filename, content_bytes, mime_type}]
    tags: list[str] = field(default_factory=list)  # for analytics grouping


class EmailProvider(abc.ABC):
    @abc.abstractmethod
    async def send(self, message: EmailMessage) -> bool:
        """Send email. Returns True on success."""
