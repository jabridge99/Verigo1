from pydantic import BaseModel
from typing import Optional
from datetime import datetime
from app.models.notification import NotificationType, NotificationPriority


class NotificationCreate(BaseModel):
    user_id: Optional[str] = None
    notif_type: NotificationType
    priority: NotificationPriority = NotificationPriority.medium
    title: str
    body: str
    link: Optional[str] = None
    entity_type: Optional[str] = None
    entity_id: Optional[str] = None
    send_email: bool = False


class NotificationResponse(BaseModel):
    id: int
    notif_id: str
    user_id: Optional[str] = None
    notif_type: NotificationType
    priority: NotificationPriority
    title: str
    body: str
    link: Optional[str] = None
    entity_type: Optional[str] = None
    entity_id: Optional[str] = None
    read: bool
    emailed: bool
    created_at: Optional[datetime] = None
    read_at: Optional[datetime] = None

    model_config = {"from_attributes": True}


class NotificationSummary(BaseModel):
    unread_count: int
    urgent_count: int
    total_count: int
