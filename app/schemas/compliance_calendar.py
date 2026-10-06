from datetime import date
from typing import Optional

from pydantic import BaseModel

from app.models.compliance_calendar import CalendarItemType


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
