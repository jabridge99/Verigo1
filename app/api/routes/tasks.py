"""
Task & RFI Workflow API.

Tracks investigation steps within cases — assigning officers, issuing RFIs,
requesting SOF/SOW documents, and recording compliance approvals.

Every status transition creates an immutable TaskEvent.
All completions require explicit human action — never auto-complete.

Role permissions:
  analyst+    : read, list
  compliance+ : create, update, assign, complete, send-rfi, rfi-received
  mlro+       : cancel
"""

from datetime import datetime, timezone
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app.api.deps import (
    Pagination,
    org_id_for,
    require_analyst_or_above,
    require_compliance_or_above,
    require_mlro_or_above,
)
from app.db.database import get_db
from app.models.task import Task, TaskEvent, TaskPriority, TaskStatus, TaskType
from app.models.user import User

router = APIRouter(prefix="/tasks", tags=["Tasks & RFI Workflow"])


# ── Helpers ───────────────────────────────────────────────────────────────────


def _next_task_ref(db: Session, org_id: str) -> str:
    count = db.query(Task).filter(Task.org_id == org_id).count()
    return f"TASK-{count + 1:04d}"


def _get_task_or_404(task_id: str, org_id: str, db: Session) -> Task:
    t = db.query(Task).filter(Task.id == task_id, Task.org_id == org_id).first()
    if not t:
        raise HTTPException(404, "Task not found.")
    return t


def _log_event(
    db: Session,
    task: Task,
    event_type: str,
    actor_id: str,
    from_status: str = None,
    to_status: str = None,
    note: str = None,
) -> None:
    ev = TaskEvent(
        task_id=task.id,
        org_id=task.org_id,
        event_type=event_type,
        from_status=from_status,
        to_status=to_status,
        actor_id=actor_id,
        note=note,
    )
    db.add(ev)


def _task_dict(t: Task) -> dict:
    return {
        "id": t.id,
        "task_ref": t.task_ref,
        "org_id": t.org_id,
        "case_id": t.case_id,
        "customer_id": t.customer_id,
        "task_type": t.task_type.value if t.task_type else None,
        "status": t.status.value if t.status else None,
        "priority": t.priority.value if t.priority else None,
        "title": t.title,
        "description": t.description,
        "assigned_to": t.assigned_to,
        "assigned_by": t.assigned_by,
        "assigned_at": t.assigned_at,
        "due_date": t.due_date,
        "is_overdue": t.is_overdue,
        "completed_by": t.completed_by,
        "completed_at": t.completed_at,
        "completion_notes": t.completion_notes,
        "cancelled_by": t.cancelled_by,
        "cancelled_at": t.cancelled_at,
        "cancellation_reason": t.cancellation_reason,
        "rfi_sent_at": t.rfi_sent_at,
        "rfi_response_received_at": t.rfi_response_received_at,
        "rfi_channel": t.rfi_channel,
        "related_document_ids": t.related_document_ids,
        "created_by": t.created_by,
        "created_at": t.created_at,
        "updated_at": t.updated_at,
    }


# ── Pydantic schemas ──────────────────────────────────────────────────────────


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


# ── Routes ────────────────────────────────────────────────────────────────────


@router.post("", status_code=201)
def create_task(
    payload: TaskCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_compliance_or_above),
):
    org_id = org_id_for(current_user)
    now = datetime.now(timezone.utc)

    due = None
    if payload.due_date:
        from datetime import date

        due = date.fromisoformat(payload.due_date)

    t = Task(
        task_ref=_next_task_ref(db, org_id),
        org_id=org_id,
        case_id=payload.case_id,
        customer_id=payload.customer_id,
        task_type=payload.task_type,
        title=payload.title,
        description=payload.description,
        priority=payload.priority,
        due_date=due,
        rfi_channel=payload.rfi_channel,
        related_document_ids=payload.related_document_ids or [],
        created_by=current_user.id,
    )
    if payload.assigned_to:
        t.assigned_to = payload.assigned_to
        t.assigned_by = current_user.id
        t.assigned_at = now

    db.add(t)
    db.flush()
    _log_event(db, t, "created", current_user.id, to_status=TaskStatus.open.value)
    if payload.assigned_to:
        _log_event(
            db,
            t,
            "assigned",
            current_user.id,
            note=f"Assigned to {payload.assigned_to}",
        )
    db.commit()
    db.refresh(t)
    return _task_dict(t)


@router.get("", response_model=list[dict])
def list_tasks(
    status: Optional[TaskStatus] = Query(None),
    task_type: Optional[TaskType] = Query(None),
    assigned_to: Optional[str] = Query(None),
    case_id: Optional[str] = Query(None),
    customer_id: Optional[str] = Query(None),
    pagination: Pagination = Depends(),
    db: Session = Depends(get_db),
    current_user: User = Depends(require_analyst_or_above),
):
    org_id = org_id_for(current_user)
    q = db.query(Task).filter(Task.org_id == org_id)
    if status:
        q = q.filter(Task.status == status)
    if task_type:
        q = q.filter(Task.task_type == task_type)
    if assigned_to:
        q = q.filter(Task.assigned_to == assigned_to)
    if case_id:
        q = q.filter(Task.case_id == case_id)
    if customer_id:
        q = q.filter(Task.customer_id == customer_id)
    q = q.order_by(Task.created_at.desc())
    return [_task_dict(t) for t in pagination.apply(q).all()]


@router.get("/{task_id}")
def get_task(
    task_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_analyst_or_above),
):
    t = _get_task_or_404(task_id, org_id_for(current_user), db)
    result = _task_dict(t)
    events = (
        db.query(TaskEvent)
        .filter(TaskEvent.task_id == task_id)
        .order_by(TaskEvent.created_at)
        .all()
    )
    result["events"] = [
        {
            "id": e.id,
            "event_type": e.event_type,
            "from_status": e.from_status,
            "to_status": e.to_status,
            "actor_id": e.actor_id,
            "note": e.note,
            "created_at": e.created_at,
        }
        for e in events
    ]
    return result


@router.patch("/{task_id}")
def update_task(
    task_id: str,
    payload: TaskUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_compliance_or_above),
):
    t = _get_task_or_404(task_id, org_id_for(current_user), db)
    if t.status in (TaskStatus.completed, TaskStatus.cancelled):
        raise HTTPException(409, "Completed or cancelled tasks cannot be edited.")

    data = payload.model_dump(exclude_none=True)
    if "due_date" in data:
        from datetime import date

        data["due_date"] = date.fromisoformat(data["due_date"])
    for k, v in data.items():
        setattr(t, k, v)
    db.commit()
    db.refresh(t)
    return _task_dict(t)


@router.post("/{task_id}/assign")
def assign_task(
    task_id: str,
    payload: AssignPayload,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_compliance_or_above),
):
    t = _get_task_or_404(task_id, org_id_for(current_user), db)
    if t.status in (TaskStatus.completed, TaskStatus.cancelled):
        raise HTTPException(409, "Cannot reassign a completed or cancelled task.")

    prev = t.assigned_to
    t.assigned_to = payload.assign_to
    t.assigned_by = current_user.id
    t.assigned_at = datetime.now(timezone.utc)
    if t.status == TaskStatus.open:
        t.status = TaskStatus.in_progress

    _log_event(
        db,
        t,
        "assigned",
        current_user.id,
        note=f"Reassigned from {prev} to {payload.assign_to}",
    )
    db.commit()
    return {"task_id": task_id, "assigned_to": t.assigned_to, "status": t.status.value}


@router.post("/{task_id}/complete")
def complete_task(
    task_id: str,
    payload: CompletePayload,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_compliance_or_above),
):
    t = _get_task_or_404(task_id, org_id_for(current_user), db)
    if t.status == TaskStatus.completed:
        raise HTTPException(409, "Task already completed.")
    if t.status == TaskStatus.cancelled:
        raise HTTPException(409, "Cannot complete a cancelled task.")

    prev = t.status.value
    t.status = TaskStatus.completed
    t.completed_by = current_user.id
    t.completed_at = datetime.now(timezone.utc)
    t.completion_notes = payload.notes

    _log_event(
        db,
        t,
        "completed",
        current_user.id,
        from_status=prev,
        to_status=TaskStatus.completed.value,
        note=payload.notes,
    )
    db.commit()
    return {
        "task_id": task_id,
        "status": t.status.value,
        "completed_at": t.completed_at,
    }


@router.post("/{task_id}/cancel")
def cancel_task(
    task_id: str,
    payload: CancelPayload,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_mlro_or_above),
):
    t = _get_task_or_404(task_id, org_id_for(current_user), db)
    if t.status in (TaskStatus.completed, TaskStatus.cancelled):
        raise HTTPException(409, f"Task is already {t.status.value}.")

    prev = t.status.value
    t.status = TaskStatus.cancelled
    t.cancelled_by = current_user.id
    t.cancelled_at = datetime.now(timezone.utc)
    t.cancellation_reason = payload.reason

    _log_event(
        db,
        t,
        "cancelled",
        current_user.id,
        from_status=prev,
        to_status=TaskStatus.cancelled.value,
        note=payload.reason,
    )
    db.commit()
    return {"task_id": task_id, "status": t.status.value}


@router.post("/{task_id}/send-rfi")
def send_rfi(
    task_id: str,
    payload: RFIPayload,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_compliance_or_above),
):
    """Mark that an RFI (Request for Information) has been sent to the customer."""
    t = _get_task_or_404(task_id, org_id_for(current_user), db)
    if t.status in (TaskStatus.completed, TaskStatus.cancelled):
        raise HTTPException(409, "Cannot send RFI on a closed task.")

    prev = t.status.value
    t.status = TaskStatus.waiting_response
    t.rfi_sent_at = datetime.now(timezone.utc)
    t.rfi_channel = payload.channel or t.rfi_channel

    _log_event(
        db,
        t,
        "rfi_sent",
        current_user.id,
        from_status=prev,
        to_status=TaskStatus.waiting_response.value,
        note=payload.note or f"RFI sent via {t.rfi_channel}",
    )
    db.commit()
    return {
        "task_id": task_id,
        "status": t.status.value,
        "rfi_sent_at": t.rfi_sent_at,
        "rfi_channel": t.rfi_channel,
    }


@router.post("/{task_id}/rfi-received")
def rfi_received(
    task_id: str,
    note: Optional[str] = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_compliance_or_above),
):
    """Mark that the customer's RFI response has been received."""
    t = _get_task_or_404(task_id, org_id_for(current_user), db)
    if t.status != TaskStatus.waiting_response:
        raise HTTPException(409, "Task is not in waiting_response status.")

    t.status = TaskStatus.in_progress
    t.rfi_response_received_at = datetime.now(timezone.utc)

    _log_event(
        db,
        t,
        "rfi_received",
        current_user.id,
        from_status=TaskStatus.waiting_response.value,
        to_status=TaskStatus.in_progress.value,
        note=note or "RFI response received",
    )
    db.commit()
    return {
        "task_id": task_id,
        "status": t.status.value,
        "rfi_response_received_at": t.rfi_response_received_at,
    }


@router.get("/{task_id}/events")
def get_task_events(
    task_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_analyst_or_above),
):
    """Return the full immutable event log for a task."""
    org_id = org_id_for(current_user)
    _get_task_or_404(task_id, org_id, db)
    events = (
        db.query(TaskEvent)
        .filter(TaskEvent.task_id == task_id)
        .order_by(TaskEvent.created_at)
        .all()
    )
    return [
        {
            "id": e.id,
            "event_type": e.event_type,
            "from_status": e.from_status,
            "to_status": e.to_status,
            "actor_id": e.actor_id,
            "note": e.note,
            "created_at": e.created_at,
        }
        for e in events
    ]
