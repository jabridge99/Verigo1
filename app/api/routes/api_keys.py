"""
API Key and Webhook endpoint routes.
"""

from typing import List

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session

from app.api.routes.auth import _current_user
from app.db.database import get_db
from app.models.api_key import WebhookEvent
from app.models.user import User
from app.schemas.api_key import (
    APIKeyCreate,
    APIKeyCreated,
    APIKeyResponse,
    WebhookCreate,
    WebhookDeliveryResponse,
    WebhookResponse,
    WebhookUpdate,
)
from app.services import api_key_service as svc

router = APIRouter(tags=["api-keys"])


# ── API Keys ──────────────────────────────────────────────────────────────────


@router.get("/api-keys", response_model=List[APIKeyResponse])
def list_keys(
    db: Session = Depends(get_db), current_user: User = Depends(_current_user)
):
    return svc.list_api_keys(db, current_user.id)


@router.post("/api-keys", response_model=APIKeyCreated, status_code=201)
def create_key(
    data: APIKeyCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(_current_user),
):
    if current_user.role not in ("admin", "mlro"):
        raise HTTPException(403, "Insufficient permissions")
    key, raw = svc.create_api_key(db, data, current_user.id, current_user.org_id)
    return {**key.__dict__, "raw_key": raw}


@router.delete("/api-keys/{key_id}", status_code=204)
def revoke_key(
    key_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(_current_user),
):
    key = svc.revoke_api_key(db, key_id, current_user.id)
    if not key:
        raise HTTPException(404, "API key not found")


@router.get("/api-keys/events")
def list_events():
    return [e.value for e in WebhookEvent]


# ── Webhooks ──────────────────────────────────────────────────────────────────


@router.get("/webhooks", response_model=List[WebhookResponse])
def list_webhooks(
    db: Session = Depends(get_db), current_user: User = Depends(_current_user)
):
    return svc.list_webhooks(db, current_user.id)


@router.post("/webhooks", response_model=WebhookResponse, status_code=201)
def create_webhook(
    data: WebhookCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(_current_user),
):
    if current_user.role not in ("admin", "mlro"):
        raise HTTPException(403, "Insufficient permissions")
    return svc.create_webhook(db, data, current_user.id, current_user.org_id)


@router.patch("/webhooks/{webhook_id}", response_model=WebhookResponse)
def update_webhook(
    webhook_id: str,
    data: WebhookUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(_current_user),
):
    wh = svc.update_webhook(db, webhook_id, current_user.id, data)
    if not wh:
        raise HTTPException(404, "Webhook not found")
    return wh


@router.delete("/webhooks/{webhook_id}", status_code=204)
def delete_webhook(
    webhook_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(_current_user),
):
    if not svc.delete_webhook(db, webhook_id, current_user.id):
        raise HTTPException(404, "Webhook not found")


@router.get(
    "/webhooks/{webhook_id}/deliveries", response_model=List[WebhookDeliveryResponse]
)
def get_deliveries(
    webhook_id: str,
    limit: int = Query(50, ge=1, le=200),
    db: Session = Depends(get_db),
    current_user: User = Depends(_current_user),
):
    wh = svc.get_webhook(db, webhook_id, current_user.id)
    if not wh:
        raise HTTPException(404, "Webhook not found")
    return svc.list_deliveries(db, webhook_id, limit)


@router.post("/webhooks/{webhook_id}/test")
def test_webhook(
    webhook_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(_current_user),
):
    wh = svc.get_webhook(db, webhook_id, current_user.id)
    if not wh:
        raise HTTPException(404, "Webhook not found")
    delivery = svc.fire_webhook(db, wh, "test.ping", {"message": "Verigo webhook test"})
    return {"success": delivery.success, "status_code": delivery.status_code}
