"""
Notification endpoints — list, summary, mark-read, create (admin/system).
"""

from typing import List

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session

from app.api.routes.auth import _current_user
from app.db.database import get_db
from app.models.user import User
from app.schemas.notification import (
    NotificationCreate,
    NotificationResponse,
    NotificationSummary,
)
from app.services import notification_service as svc

router = APIRouter(prefix="/notifications", tags=["notifications"])


@router.get("/summary", response_model=NotificationSummary)
def get_summary(
    db: Session = Depends(get_db),
    current_user: User = Depends(_current_user),
):
    return svc.get_summary(db, current_user.user_id)


@router.get("", response_model=List[NotificationResponse])
def list_notifications(
    unread_only: bool = Query(False),
    limit: int = Query(50, ge=1, le=200),
    offset: int = Query(0, ge=0),
    db: Session = Depends(get_db),
    current_user: User = Depends(_current_user),
):
    return svc.list_notifications(db, current_user.user_id, unread_only, limit, offset)


@router.post("/{notif_id}/read", response_model=NotificationResponse)
def mark_read(
    notif_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(_current_user),
):
    notif = svc.mark_read(db, notif_id, current_user.user_id)
    if not notif:
        raise HTTPException(404, "Notification not found")
    return notif


@router.post("/read-all")
def mark_all_read(
    db: Session = Depends(get_db),
    current_user: User = Depends(_current_user),
):
    count = svc.mark_all_read(db, current_user.user_id)
    return {"marked_read": count}


@router.post("", response_model=NotificationResponse, status_code=201)
def create_notification(
    data: NotificationCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(_current_user),
):
    if current_user.role not in ("admin", "mlro"):
        raise HTTPException(403, "Insufficient permissions")
    return svc.create_notification(db, data, send_email=data.send_email)
