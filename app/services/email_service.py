"""
Email service — renders HTML templates and sends via SMTP.
Falls back to console logging when SMTP is not configured (dev mode).
"""

import os
import smtplib
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText

SMTP_HOST  = os.getenv("SMTP_HOST", "")
SMTP_PORT  = int(os.getenv("SMTP_PORT", "587"))
SMTP_USER  = os.getenv("SMTP_USER", "")
SMTP_PASS  = os.getenv("SMTP_PASS", "")
FROM_EMAIL = os.getenv("FROM_EMAIL", "noreply@verigo.com.au")
FROM_NAME  = os.getenv("FROM_NAME",  "Verigo")
APP_URL    = os.getenv("APP_URL",    "http://localhost:3000")

_BRAND_HEADER = """
<div style="background:#1e3a8a;padding:24px 32px;border-radius:12px 12px 0 0;">
  <span style="color:#fff;font-size:18px;font-weight:700;">Veri<span style="color:#60a5fa">go</span></span>
</div>
"""

_WRAP_OPEN  = '<div style="font-family:Inter,system-ui,sans-serif;max-width:580px;margin:0 auto;background:#0d1526;border-radius:12px;overflow:hidden;">'
_WRAP_CLOSE = '<p style="color:#64748b;font-size:11px;text-align:center;padding:16px;">Verigo · Australian Compliance Operating System<br>© 2025 Verigo Pty Ltd</p></div>'
_BODY_OPEN  = '<div style="padding:28px 32px;">'
_BODY_CLOSE = '</div>'


def _send(to: str, subject: str, html: str) -> bool:
    if not SMTP_HOST or not SMTP_USER:
        print(f"[email DEV] To: {to} | Subject: {subject}")
        print(f"[email DEV] HTML length: {len(html)} chars")
        return True
    try:
        msg = MIMEMultipart("alternative")
        msg["Subject"] = subject
        msg["From"]    = f"{FROM_NAME} <{FROM_EMAIL}>"
        msg["To"]      = to
        msg.attach(MIMEText(html, "html"))
        with smtplib.SMTP(SMTP_HOST, SMTP_PORT) as s:
            s.starttls()
            s.login(SMTP_USER, SMTP_PASS)
            s.sendmail(FROM_EMAIL, to, msg.as_string())
        return True
    except Exception as e:
        print(f"[email ERROR] {e}")
        return False


# ─── Templates ────────────────────────────────────────────────────────────────

def send_magic_link(to: str, full_name: str, token: str) -> bool:
    verify_url = f"{APP_URL}/login?magic={token}"
    html = f"""{_WRAP_OPEN}{_BRAND_HEADER}{_BODY_OPEN}
<h2 style="color:#fff;font-size:22px;margin:0 0 12px;">Your sign-in link</h2>
<p style="color:#94a3b8;font-size:15px;line-height:1.6;">Hi {full_name},<br><br>
Click the button below to sign in to your Verigo workspace. This link expires in <strong style="color:#fff;">15 minutes</strong> and can only be used once.</p>
<a href="{verify_url}" style="display:inline-block;background:#2563eb;color:#fff;padding:14px 28px;border-radius:8px;text-decoration:none;font-weight:600;font-size:15px;margin:20px 0;">Sign In to Verigo</a>
<p style="color:#64748b;font-size:12px;margin-top:20px;">If you didn't request this link, you can safely ignore this email.<br>
Token (for reference): <code style="color:#60a5fa;">{token[:12]}…</code></p>
{_BODY_CLOSE}{_WRAP_CLOSE}"""
    return _send(to, "Your Verigo sign-in link", html)


def send_report_deadline(to: str, full_name: str, report_type: str, report_id: str, days_remaining: int) -> bool:
    urgency_color = "#ef4444" if days_remaining <= 2 else "#f59e0b"
    urgency_label = "URGENT" if days_remaining <= 2 else "ACTION REQUIRED"
    report_url = f"{APP_URL}/reporting"
    html = f"""{_WRAP_OPEN}{_BRAND_HEADER}{_BODY_OPEN}
<div style="background:{urgency_color}22;border:1px solid {urgency_color}55;border-radius:8px;padding:12px 16px;margin-bottom:20px;">
  <span style="color:{urgency_color};font-weight:700;font-size:13px;">{urgency_label}</span>
</div>
<h2 style="color:#fff;font-size:22px;margin:0 0 12px;">{report_type} report due in {days_remaining} day{'s' if days_remaining != 1 else ''}</h2>
<p style="color:#94a3b8;font-size:15px;line-height:1.6;">Hi {full_name},<br><br>
A <strong style="color:#fff;">{report_type}</strong> report (<code style="color:#60a5fa;">{report_id}</code>) must be submitted to AUSTRAC within <strong style="color:{urgency_color};">{days_remaining} day{'s' if days_remaining != 1 else ''}</strong>.</p>
<p style="color:#94a3b8;font-size:14px;">Failure to submit on time may constitute a breach of the AML/CTF Act 2006 and may attract civil or criminal penalties.</p>
<a href="{report_url}" style="display:inline-block;background:#2563eb;color:#fff;padding:14px 28px;border-radius:8px;text-decoration:none;font-weight:600;font-size:15px;margin:20px 0;">Review & Submit Report</a>
{_BODY_CLOSE}{_WRAP_CLOSE}"""
    return _send(to, f"[{urgency_label}] {report_type} due in {days_remaining} day(s) — Verigo", html)


def send_case_assignment(to: str, full_name: str, case_id: str, case_title: str, severity: str, assigned_by: str) -> bool:
    sev_color = {"critical": "#ef4444", "high": "#f97316", "medium": "#f59e0b", "low": "#22c55e"}.get(severity, "#60a5fa")
    case_url = f"{APP_URL}/mlro"
    html = f"""{_WRAP_OPEN}{_BRAND_HEADER}{_BODY_OPEN}
<h2 style="color:#fff;font-size:22px;margin:0 0 12px;">New case assigned to you</h2>
<p style="color:#94a3b8;font-size:15px;line-height:1.6;">Hi {full_name},<br><br>
<strong style="color:#fff;">{assigned_by}</strong> has assigned a compliance case to you.</p>
<div style="background:#111c33;border-radius:8px;padding:16px;margin:16px 0;">
  <div style="color:#64748b;font-size:12px;margin-bottom:4px;">Case ID</div>
  <div style="color:#60a5fa;font-family:monospace;font-size:14px;">{case_id}</div>
  <div style="color:#64748b;font-size:12px;margin:12px 0 4px;">Description</div>
  <div style="color:#fff;font-size:14px;">{case_title}</div>
  <div style="color:#64748b;font-size:12px;margin:12px 0 4px;">Severity</div>
  <span style="background:{sev_color}22;color:{sev_color};padding:2px 10px;border-radius:20px;font-size:12px;font-weight:600;">{severity.upper()}</span>
</div>
<a href="{case_url}" style="display:inline-block;background:#2563eb;color:#fff;padding:14px 28px;border-radius:8px;text-decoration:none;font-weight:600;font-size:15px;margin:8px 0;">Open Case</a>
{_BODY_CLOSE}{_WRAP_CLOSE}"""
    return _send(to, f"Case assigned: {case_id} — Verigo", html)


def send_report_approved(to: str, full_name: str, report_type: str, report_id: str, approved_by: str) -> bool:
    report_url = f"{APP_URL}/reporting"
    html = f"""{_WRAP_OPEN}{_BRAND_HEADER}{_BODY_OPEN}
<h2 style="color:#fff;font-size:22px;margin:0 0 12px;">Report approved for AUSTRAC submission</h2>
<p style="color:#94a3b8;font-size:15px;line-height:1.6;">Hi {full_name},<br><br>
Your <strong style="color:#fff;">{report_type}</strong> report has been approved by <strong style="color:#fff;">{approved_by}</strong> and is ready to be submitted to AUSTRAC.</p>
<div style="background:#111c33;border-radius:8px;padding:16px;margin:16px 0;">
  <div style="color:#64748b;font-size:12px;margin-bottom:4px;">Report ID</div>
  <div style="color:#60a5fa;font-family:monospace;font-size:14px;">{report_id}</div>
</div>
<p style="color:#94a3b8;font-size:14px;margin-bottom:20px;">Please log in and confirm AUSTRAC submission within the required timeframe.</p>
<a href="{report_url}" style="display:inline-block;background:#22c55e;color:#fff;padding:14px 28px;border-radius:8px;text-decoration:none;font-weight:600;font-size:15px;">Submit to AUSTRAC</a>
{_BODY_CLOSE}{_WRAP_CLOSE}"""
    return _send(to, f"Report approved: {report_id} ready for AUSTRAC — Verigo", html)


def send_kyc_review_required(to: str, full_name: str, kyc_id: str, customer_name: str) -> bool:
    kyc_url = f"{APP_URL}/customers"
    html = f"""{_WRAP_OPEN}{_BRAND_HEADER}{_BODY_OPEN}
<h2 style="color:#fff;font-size:22px;margin:0 0 12px;">KYC review required</h2>
<p style="color:#94a3b8;font-size:15px;line-height:1.6;">Hi {full_name},<br><br>
A KYC record for <strong style="color:#fff;">{customer_name}</strong> requires your review.</p>
<div style="background:#111c33;border-radius:8px;padding:16px;margin:16px 0;">
  <div style="color:#64748b;font-size:12px;margin-bottom:4px;">KYC Record ID</div>
  <div style="color:#60a5fa;font-family:monospace;font-size:14px;">{kyc_id}</div>
</div>
<a href="{kyc_url}" style="display:inline-block;background:#2563eb;color:#fff;padding:14px 28px;border-radius:8px;text-decoration:none;font-weight:600;font-size:15px;margin:8px 0;">Review KYC Record</a>
{_BODY_CLOSE}{_WRAP_CLOSE}"""
    return _send(to, f"KYC review required: {customer_name} — Verigo", html)


def send_aml_alert(to: str, full_name: str, alert_type: str, customer_name: str, amount: float) -> bool:
    monitor_url = f"{APP_URL}/monitoring"
    html = f"""{_WRAP_OPEN}{_BRAND_HEADER}{_BODY_OPEN}
<div style="background:#ef444422;border:1px solid #ef444455;border-radius:8px;padding:12px 16px;margin-bottom:20px;">
  <span style="color:#ef4444;font-weight:700;font-size:13px;">AML ALERT</span>
</div>
<h2 style="color:#fff;font-size:22px;margin:0 0 12px;">Suspicious activity detected</h2>
<p style="color:#94a3b8;font-size:15px;line-height:1.6;">Hi {full_name},<br><br>
An AML alert has been triggered for customer <strong style="color:#fff;">{customer_name}</strong>.</p>
<div style="background:#111c33;border-radius:8px;padding:16px;margin:16px 0;">
  <div style="color:#64748b;font-size:12px;margin-bottom:4px;">Alert Type</div>
  <div style="color:#fff;font-size:14px;">{alert_type}</div>
  <div style="color:#64748b;font-size:12px;margin:12px 0 4px;">Transaction Amount</div>
  <div style="color:#f59e0b;font-size:18px;font-weight:700;">A${amount:,.2f}</div>
</div>
<a href="{monitor_url}" style="display:inline-block;background:#ef4444;color:#fff;padding:14px 28px;border-radius:8px;text-decoration:none;font-weight:600;font-size:15px;margin:8px 0;">Review Alert</a>
{_BODY_CLOSE}{_WRAP_CLOSE}"""
    return _send(to, f"AML Alert: {alert_type} — {customer_name} — Verigo", html)
