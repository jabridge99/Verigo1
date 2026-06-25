"""Dev-mode email provider — logs to console instead of sending."""

from __future__ import annotations

from .base import EmailProvider


class ConsoleEmailProvider(EmailProvider):
    def send(self, to: str, subject: str, html: str) -> bool:
        print(f"[email DEV] To: {to} | Subject: {subject}")
        print(f"[email DEV] HTML length: {len(html)} chars")
        return True
