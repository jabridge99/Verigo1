"""
API Key endpoint routes.

Webhook endpoints (a distinct resource that used to share this file with no
shared prefix) live in app/api/routes/webhooks.py.
"""

from typing import List

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.api.routes.auth import _current_user
from app.db.database import get_db
from app.models.api_key import WebhookEvent
from app.models.user import User
from app.schemas.api_key import APIKeyCreate, APIKeyCreated, APIKeyResponse
from app.services import api_key_service as svc

router = APIRouter(tags=["api-keys"])


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
