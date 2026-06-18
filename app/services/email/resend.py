"""Resend (https://resend.com) email provider."""

from __future__ import annotations

import httpx

from .base import EmailProvider

_API_URL = "https://api.resend.com/emails"


class ResendEmailProvider(EmailProvider):
    def __init__(self, api_key: str, from_email: str, from_name: str):
        self.api_key = api_key
        self.from_email = from_email
        self.from_name = from_name

    def send(self, to: str, subject: str, html: str) -> bool:
        try:
            resp = httpx.post(
                _API_URL,
                headers={"Authorization": f"Bearer {self.api_key}"},
                json={
                    "from": f"{self.from_name} <{self.from_email}>",
                    "to": [to],
                    "subject": subject,
                    "html": html,
                },
                timeout=10.0,
            )
            resp.raise_for_status()
            return True
        except Exception as e:
            print(f"[email ERROR] Resend send failed: {e}")
            return False
