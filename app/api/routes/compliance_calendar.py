"""
Compliance Calendar API — manage scheduled compliance obligations and review cycles.

Roles:
  GET endpoints         — analyst+
  POST/PATCH endpoints  — compliance+
  Escalate              — mlro+
"""
from datetime import date
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query, status
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app.api.deps import (
    Pagination,
    get_current_user,
    org_id_for,
    require_analyst_or_above,
    require_compliance_or_above,
    require_mlro_or_above,
)
from app.db.database import get_db
from app.models.compliance_calendar import (
    CalendarItemStatus,
    CalendarItemType,
    ComplianceCalendarItem,
    ComplianceReminder,
    ReminderStage,
)
from app.models.user import User
from app.services.compliance_calendar_service import (
    complete_item,
    create_calendar_item,
    escalate_overdue_items,
    get_upcoming_items,
    process_due_reminders,
    schedule_bulk_customer_reviews,
)

router = APIRouter(prefix="/compliance-calendar", tags=["Compliance Calendar"])


class CalendarItemCreate(BaseModel):
    item_type: CalendarItemType
    title: str
    due_date: date
    description: Optional[str] = None
    customer_id: Optional[str] = None
    report_id: Optional[str] = None
    report_type: Optional[str] = None
    policy_id: Optional[str] = None
    control_id: Optional[str] = None
    assigned_to: Optional[str] = None
    is_recurring: bool = False
    recurrence_months: Optional[int] = None


class CompleteItemRequest(BaseModel):
    completion_notes: Optional[str] = None


def _item_dict(item: ComplianceCalendarItem) -> dict:
    return {
        "id": item.id,
        "item_type": item.item_type.value if item.item_type else None,
        "status": item.status.value if item.status else None,
        "title": item.title,
        "description": item.description,
        "due_date": item.due_date,
        "customer_id": item.customer_id,
        "report_id": item.report_id,
        "assigned_to": item.assigned_to,
        "is_recurring": item.is_recurring,
        "recurrence_months": item.recurrence_months,
        "next_due_date": item.next_due_date,
        "completed_at": item.completed_at,
        "completed_by": item.completed_by,
        "is_overdue": item.is_overdue,
        "escalated_to": item.escalated_to,
        "escalated_at": item.escalated_at,
        "created_at": item.created_at,
    }


def _reminder_dict(r: ComplianceReminder) -> dict:
    return {
        "id": r.id,
        "calendar_item_id": r.calendar_item_id,
        "stage": r.stage.value if r.stage else None,
        "recipient_id": r.recipient_id,
        "recipient_email": r.recipient_email,
        "is_sent": r.is_sent,
        "sent_at": r.sent_at,
        "send_failed": r.send_failed,
        "channel_email": r.channel_email,
        "channel_in_app": r.channel_in_app,
        "channel_sms": r.channel_sms,
        "created_at": r.created_at,
    }


@router.get("/dashboard")
def get_calendar_dashboard(
    db: Session = Depends(get_db),
    current_user: User = Depends(require_analyst_or_above),
):
    from sqlalchemy import func
    org_id = org_id_for(current_user)

    total = db.query(func.count(ComplianceCalendarItem.id)).filter(
        ComplianceCalendarItem.org_id == org_id,
        ComplianceCalendarItem.status.notin_([CalendarItemStatus.completed, CalendarItemStatus.cancelled]),
    ).scalar()

    overdue = db.query(func.count(ComplianceCalendarItem.id)).filter(
        ComplianceCalendarItem.org_id == org_id,
        ComplianceCalendarItem.is_overdue == True,
        ComplianceCalendarItem.status.notin_([CalendarItemStatus.completed, CalendarItemStatus.cancelled]),
    ).scalar()

    upcoming_30d = len(get_upcoming_items(db, org_id, days_ahead=30))

    by_type = (
        db.query(ComplianceCalendarItem.item_type, func.count(ComplianceCalendarItem.id))
        .filter(ComplianceCalendarItem.org_id == org_id)
        .group_by(ComplianceCalendarItem.item_type)
        .all()
    )

    pending_reminders = db.query(func.count(ComplianceReminder.id)).filter(
        ComplianceReminder.org_id == org_id,
        ComplianceReminder.is_sent == False,
        ComplianceReminder.send_failed == False,
    ).scalar()

    return {
        "open_items": total,
        "overdue": overdue,
        "due_within_30_days": upcoming_30d,
        "by_type": {str(t): c for t, c in by_type},
        "pending_reminders": pending_reminders,
    }


@router.get("")
def list_calendar_items(
    item_type: Optional[CalendarItemType] = Query(None),
    status: Optional[CalendarItemStatus] = Query(None),
    customer_id: Optional[str] = Query(None),
    is_overdue: Optional[bool] = Query(None),
    pagination: Pagination = Depends(),
    db: Session = Depends(get_db),
    current_user: User = Depends(require_analyst_or_above),
):
    org_id = org_id_for(current_user)
    q = db.query(ComplianceCalendarItem).filter(ComplianceCalendarItem.org_id == org_id)
    if item_type:
        q = q.filter(ComplianceCalendarItem.item_type == item_type)
    if status:
        q = q.filter(ComplianceCalendarItem.status == status)
    if customer_id:
        q = q.filter(ComplianceCalendarItem.customer_id == customer_id)
    if is_overdue is not None:
        q = q.filter(ComplianceCalendarItem.is_overdue == is_overdue)
    q = q.order_by(ComplianceCalendarItem.due_date)
    return [_item_dict(i) for i in pagination.apply(q).all()]


@router.post("", status_code=status.HTTP_201_CREATED)
def create_item(
    payload: CalendarItemCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_compliance_or_above),
):
    org_id = org_id_for(current_user)
    item = create_calendar_item(db=db, org_id=org_id, **payload.model_dump())
    return _item_dict(item)


@router.get("/upcoming")
def get_upcoming(
    days_ahead: int = Query(30, ge=1, le=365),
    item_type: Optional[CalendarItemType] = Query(None),
    db: Session = Depends(get_db),
    current_user: User = Depends(require_analyst_or_above),
):
    items = get_upcoming_items(db, org_id_for(current_user), days_ahead=days_ahead, item_type=item_type)
    return [_item_dict(i) for i in items]


@router.get("/{item_id}")
def get_item(
    item_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_analyst_or_above),
):
    org_id = org_id_for(current_user)
    item = db.query(ComplianceCalendarItem).filter(
        ComplianceCalendarItem.id == item_id,
        ComplianceCalendarItem.org_id == org_id,
    ).first()
    if not item:
        raise HTTPException(404, "Calendar item not found.")
    return _item_dict(item)


@router.post("/{item_id}/complete")
def complete_calendar_item(
    item_id: str,
    payload: CompleteItemRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_compliance_or_above),
):
    org_id = org_id_for(current_user)
    item = db.query(ComplianceCalendarItem).filter(
        ComplianceCalendarItem.id == item_id,
        ComplianceCalendarItem.org_id == org_id,
    ).first()
    if not item:
        raise HTTPException(404, "Calendar item not found.")
    if item.status == CalendarItemStatus.completed:
        raise HTTPException(409, "Item is already completed.")

    updated = complete_item(item_id, current_user.id, payload.completion_notes, db)
    return _item_dict(updated)


@router.post("/schedule-customer-reviews")
def schedule_reviews(
    db: Session = Depends(get_db),
    current_user: User = Depends(require_compliance_or_above),
):
    """Bulk-schedule periodic CDD review items for all active customers."""
    org_id = org_id_for(current_user)
    items = schedule_bulk_customer_reviews(db, org_id)
    return {"scheduled": len(items)}


@router.post("/process-reminders")
def trigger_reminder_processing(
    db: Session = Depends(get_db),
    current_user: User = Depends(require_compliance_or_above),
):
    """
    Scan open items and create pending reminder records for stages reached.
    Intended for scheduled job invocation; can also be triggered manually.
    """
    org_id = org_id_for(current_user)
    reminders = process_due_reminders(db, org_id)
    return {"reminders_created": len(reminders)}


@router.post("/escalate-overdue")
def escalate_overdue(
    compliance_officer_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_mlro_or_above),
):
    """Escalate all overdue items to the named compliance officer."""
    org_id = org_id_for(current_user)
    items = escalate_overdue_items(db, org_id, compliance_officer_id)
    return {"escalated": len(items), "item_ids": [i.id for i in items]}


@router.get("/reminders/pending")
def list_pending_reminders(
    pagination: Pagination = Depends(),
    db: Session = Depends(get_db),
    current_user: User = Depends(require_analyst_or_above),
):
    org_id = org_id_for(current_user)
    q = db.query(ComplianceReminder).filter(
        ComplianceReminder.org_id == org_id,
        ComplianceReminder.is_sent == False,
        ComplianceReminder.send_failed == False,
    ).order_by(ComplianceReminder.created_at)
    return [_reminder_dict(r) for r in pagination.apply(q).all()]


@router.patch("/reminders/{reminder_id}/mark-sent")
def mark_reminder_sent(
    reminder_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_compliance_or_above),
):
    """Mark a reminder as sent (called by notification delivery layer)."""
    from datetime import datetime, timezone
    org_id = org_id_for(current_user)
    r = db.query(ComplianceReminder).filter(
        ComplianceReminder.id == reminder_id,
        ComplianceReminder.org_id == org_id,
    ).first()
    if not r:
        raise HTTPException(404, "Reminder not found.")
    r.is_sent = True
    r.sent_at = datetime.now(timezone.utc)
    db.commit()
    return _reminder_dict(r)
