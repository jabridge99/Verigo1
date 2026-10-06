from typing import Optional

from pydantic import BaseModel

from app.models.task import TaskPriority, TaskType


class TaskCreate(BaseModel):
    task_type: TaskType
    title: str
    description: Optional[str] = None
    priority: TaskPriority = TaskPriority.normal
    case_id: Optional[str] = None
    customer_id: Optional[str] = None
    assigned_to: Optional[str] = None
    due_date: Optional[str] = None  # YYYY-MM-DD
    rfi_channel: Optional[str] = None
    related_document_ids: Optional[list] = None


class TaskUpdate(BaseModel):
    title: Optional[str] = None
    description: Optional[str] = None
    priority: Optional[TaskPriority] = None
    due_date: Optional[str] = None
    rfi_channel: Optional[str] = None
    related_document_ids: Optional[list] = None


class AssignPayload(BaseModel):
    assign_to: str


class CompletePayload(BaseModel):
    notes: Optional[str] = None


class CancelPayload(BaseModel):
    reason: str


class RFIPayload(BaseModel):
    channel: Optional[str] = "email"  # email | portal | mail | in_person
    note: Optional[str] = None
