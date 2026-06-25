"""SMTP email provider — used for self-hosted / custom mail relays."""

from __future__ import annotations

import smtplib
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText

from .base import EmailProvider


class SMTPEmailProvider(EmailProvider):
    def __init__(
        self,
        host: str,
        port: int,
        user: str,
        password: str,
        from_email: str,
        from_name: str,
    ):
        self.host = host
        self.port = port
        self.user = user
        self.password = password
        self.from_email = from_email
        self.from_name = from_name

    def send(self, to: str, subject: str, html: str) -> bool:
        try:
            msg = MIMEMultipart("alternative")
            msg["Subject"] = subject
            msg["From"] = f"{self.from_name} <{self.from_email}>"
            msg["To"] = to
            msg.attach(MIMEText(html, "html"))
            with smtplib.SMTP(self.host, self.port) as s:
                s.starttls()
                s.login(self.user, self.password)
                s.sendmail(self.from_email, to, msg.as_string())
            return True
        except Exception as e:
            print(f"[email ERROR] {e}")
            return False
