"""SMTP email provider. Works with any SMTP relay (SendGrid, Postmark, SES, etc.)."""

from __future__ import annotations

import logging
import smtplib
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText

from app.config import settings

from .base import EmailMessage, EmailProvider

log = logging.getLogger("verigo.integrations.email.smtp")


class SMTPEmailProvider(EmailProvider):
    async def send(self, message: EmailMessage) -> bool:
        from_email = message.from_email or settings.from_email
        from_name = message.from_name or settings.from_name

        msg = MIMEMultipart("alternative")
        msg["Subject"] = message.subject
        msg["From"] = f"{from_name} <{from_email}>"
        msg["To"] = ", ".join(message.to)
        if message.reply_to:
            msg["Reply-To"] = message.reply_to

        if message.text:
            msg.attach(MIMEText(message.text, "plain"))
        msg.attach(MIMEText(message.html, "html"))

        try:
            with smtplib.SMTP(settings.smtp_host, settings.smtp_port) as server:
                server.ehlo()
                server.starttls()
                if settings.smtp_user:
                    server.login(settings.smtp_user, settings.smtp_pass)
                server.sendmail(from_email, message.to, msg.as_string())
            log.info("Email sent to %s subject='%s'", message.to, message.subject)
            return True
        except Exception as exc:
            log.error("SMTP send failed: %s", exc)
            return False
