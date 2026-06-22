"""
API key and webhook management service.
"""

import hashlib
import hmac
import json
import secrets
import uuid
from datetime import datetime, timedelta, timezone
from typing import List, Optional, Tuple

import httpx
from sqlalchemy import desc
from sqlalchemy.orm import Session

from app.models.api_key import (
    APIKey,
    APIKeyStatus,
    WebhookDelivery,
    WebhookEndpoint,
    WebhookStatus,
)
from app.schemas.api_key import APIKeyCreate, WebhookCreate, WebhookUpdate

# ── Helpers ───────────────────────────────────────────────────────────────────


def _uid() -> str:
    return uuid.uuid4().hex[:12].upper()


def _hash_key(raw: str) -> str:
    return hashlib.sha256(raw.encode()).hexdigest()


# ── API Keys ──────────────────────────────────────────────────────────────────


def create_api_key(
    db: Session, data: APIKeyCreate, user_id: str, industry_id: Optional[str]
) -> Tuple[APIKey, str]:
    raw = f"tvg_live_{secrets.token_urlsafe(32)}"
    prefix = raw[:12]
    expires_at = None
    if data.expires_days:
        expires_at = datetime.now(timezone.utc) + timedelta(days=data.expires_days)

    key = APIKey(
        key_id=f"KEY-{_uid()}",
        name=data.name,
        key_hash=_hash_key(raw),
        key_prefix=prefix,
        user_id=user_id,
        industry_id=industry_id,
        scopes=data.scopes,
        expires_at=expires_at,
    )
    db.add(key)
    db.commit()
    db.refresh(key)
    return key, raw


def list_api_keys(db: Session, user_id: str) -> List[APIKey]:
    return (
        db.query(APIKey)
        .filter(APIKey.user_id == user_id)
        .order_by(desc(APIKey.created_at))
        .all()
    )


def revoke_api_key(db: Session, key_id: str, user_id: str) -> Optional[APIKey]:
    key = (
        db.query(APIKey)
        .filter(APIKey.key_id == key_id, APIKey.user_id == user_id)
        .first()
    )
    if not key:
        return None
    key.status = APIKeyStatus.revoked
    key.revoked_at = datetime.now(timezone.utc)
    db.commit()
    db.refresh(key)
    return key


def _validate_webhook_url(url: str) -> None:
    """
    Block SSRF: reject private IPs, localhost, metadata endpoints, and non-HTTPS.
    """
    import ipaddress
    from urllib.parse import urlparse

    parsed = urlparse(url)
    if parsed.scheme != "https":
        raise ValueError("Webhook URL must use HTTPS")
    host = parsed.hostname or ""
    # Block cloud metadata endpoints
    _BLOCKED_HOSTS = {
        "169.254.169.254",
        "metadata.google.internal",
        "metadata.internal",
    }
    if host.lower() in _BLOCKED_HOSTS or host.lower().endswith(".internal"):
        raise ValueError(f"Webhook URL host '{host}' is not allowed")
    try:
        ip = ipaddress.ip_address(host)
        if ip.is_private or ip.is_loopback or ip.is_link_local or ip.is_reserved:
            raise ValueError(
                f"Webhook URL must not target a private/loopback/reserved IP: {host}"
            )
    except ValueError as e:
        if "Webhook URL" in str(e):
            raise
        pass  # not a raw IP — hostname is fine


def authenticate_api_key(db: Session, raw: str) -> Optional[APIKey]:
    key = (
        db.query(APIKey)
        .filter(
            APIKey.key_hash == _hash_key(raw),
            APIKey.status == APIKeyStatus.active,
        )
        .first()
    )
    if not key:
        return None
    if key.expires_at and key.expires_at.replace(tzinfo=timezone.utc) < datetime.now(
        timezone.utc
    ):
        key.status = APIKeyStatus.expired
        db.commit()
        return None
    key.last_used_at = datetime.now(timezone.utc)
    db.commit()
    return key


# ── Webhooks ──────────────────────────────────────────────────────────────────


def create_webhook(
    db: Session, data: WebhookCreate, user_id: str, industry_id: Optional[str]
) -> WebhookEndpoint:
    _validate_webhook_url(data.url)
    wh = WebhookEndpoint(
        webhook_id=f"WH-{_uid()}",
        name=data.name,
        url=data.url,
        secret=secrets.token_hex(32),
        events=data.events,
        user_id=user_id,
        industry_id=industry_id,
    )
    db.add(wh)
    db.commit()
    db.refresh(wh)
    return wh


def list_webhooks(db: Session, user_id: str) -> List[WebhookEndpoint]:
    return (
        db.query(WebhookEndpoint)
        .filter(WebhookEndpoint.user_id == user_id)
        .order_by(desc(WebhookEndpoint.created_at))
        .all()
    )


def get_webhook(
    db: Session, webhook_id: str, user_id: str
) -> Optional[WebhookEndpoint]:
    return (
        db.query(WebhookEndpoint)
        .filter(
            WebhookEndpoint.webhook_id == webhook_id,
            WebhookEndpoint.user_id == user_id,
        )
        .first()
    )


def update_webhook(
    db: Session, webhook_id: str, user_id: str, data: WebhookUpdate
) -> Optional[WebhookEndpoint]:
    wh = get_webhook(db, webhook_id, user_id)
    if not wh:
        return None
    updates = data.model_dump(exclude_unset=True)
    if "url" in updates:
        _validate_webhook_url(updates["url"])
    for field, val in updates.items():
        setattr(wh, field, val)
    db.commit()
    db.refresh(wh)
    return wh


def delete_webhook(db: Session, webhook_id: str, user_id: str) -> bool:
    wh = get_webhook(db, webhook_id, user_id)
    if not wh:
        return False
    db.delete(wh)
    db.commit()
    return True


def list_deliveries(
    db: Session, webhook_id: str, limit: int = 50
) -> List[WebhookDelivery]:
    return (
        db.query(WebhookDelivery)
        .filter(WebhookDelivery.webhook_id == webhook_id)
        .order_by(desc(WebhookDelivery.delivered_at))
        .limit(limit)
        .all()
    )


def _sign_payload(secret: str, body: str) -> str:
    return hmac.new(secret.encode(), body.encode(), hashlib.sha256).hexdigest()


def check_api_key_scope(key: APIKey, required_scope: str) -> bool:
    """Enforce declared scopes — * grants all, otherwise exact match."""
    scopes = key.scopes or []
    if isinstance(scopes, str):
        import json as _json

        try:
            scopes = _json.loads(scopes)
        except Exception:
            scopes = [scopes]
    return "*" in scopes or required_scope in scopes


def fire_webhook(
    db: Session, wh: WebhookEndpoint, event: str, payload: dict
) -> WebhookDelivery:
    ts = str(int(datetime.now(timezone.utc).timestamp()))
    body = json.dumps({"event": event, "data": payload, "timestamp": ts})
    # Include timestamp in HMAC to prevent replay attacks
    signed_content = f"{ts}.{body}"
    sig = hmac.new(
        wh.secret.encode(), signed_content.encode(), hashlib.sha256
    ).hexdigest()
    headers = {
        "Content-Type": "application/json",
        "X-TVG-Event": event,
        "X-TVG-Timestamp": ts,
        "X-TVG-Signature": f"sha256={sig}",
        "X-TVG-Webhook-ID": wh.webhook_id,
    }
    status_code = None
    response_body = None
    success = False
    try:
        resp = httpx.post(wh.url, content=body, headers=headers, timeout=10)
        status_code = resp.status_code
        response_body = resp.text[:2000]
        success = 200 <= resp.status_code < 300
    except Exception as e:
        response_body = str(e)[:500]

    delivery = WebhookDelivery(
        delivery_id=f"DEL-{_uid()}",
        webhook_id=wh.webhook_id,
        event=event,
        payload=payload,
        status_code=status_code,
        response_body=response_body,
        success=success,
    )
    db.add(delivery)

    wh.last_fired_at = datetime.now(timezone.utc)
    if success:
        wh.failure_count = 0
    else:
        wh.failure_count = (wh.failure_count or 0) + 1
        if wh.failure_count >= 10:
            wh.status = WebhookStatus.failed

    db.commit()
    db.refresh(delivery)
    return delivery


def dispatch_event(
    db: Session, event: str, payload: dict, industry_id: Optional[str] = None
) -> List[WebhookDelivery]:
    q = db.query(WebhookEndpoint).filter(WebhookEndpoint.status == WebhookStatus.active)
    if industry_id:
        q = q.filter(WebhookEndpoint.industry_id == industry_id)
    endpoints = q.all()
    deliveries = []
    for wh in endpoints:
        if event in (wh.events or []):
            deliveries.append(fire_webhook(db, wh, event, payload))
    return deliveries
