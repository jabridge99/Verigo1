"""
Compliance Calendar Service — schedule, remind, and escalate compliance obligations.

Review frequency by risk level:
  low    = 36 months
  medium = 24 months
  high   = 12 months
  PEP    = 12 months

Reminder chain: 30 days → 14 days → 7 days → due date → overdue
"""

from datetime import date, datetime, timedelta, timezone
from typing import Optional

from sqlalchemy.orm import Session

from app.models.compliance_calendar import (
    CalendarItemStatus,
    CalendarItemType,
    ComplianceCalendarItem,
    ComplianceReminder,
    ReminderStage,
)
from app.models.customer import Customer

REVIEW_MONTHS = {
    "low": 36,
    "medium": 24,
    "high": 12,
    "pep": 12,
}

REMINDER_DAYS_BEFORE = {
    ReminderStage.thirty_days: 30,
    ReminderStage.fourteen_days: 14,
    ReminderStage.seven_days: 7,
    ReminderStage.due_date: 0,
}


def create_calendar_item(
    db: Session,
    org_id: str,
    item_type: CalendarItemType,
    title: str,
    due_date: date,
    description: Optional[str] = None,
    customer_id: Optional[str] = None,
    report_id: Optional[str] = None,
    report_type: Optional[str] = None,
    policy_id: Optional[str] = None,
    control_id: Optional[str] = None,
    assigned_to: Optional[str] = None,
    is_recurring: bool = False,
    recurrence_months: Optional[int] = None,
) -> ComplianceCalendarItem:
    item = ComplianceCalendarItem(
        org_id=org_id,
        item_type=item_type,
        title=title,
        description=description,
        due_date=due_date,
        customer_id=customer_id,
        report_id=report_id,
        report_type=report_type,
        policy_id=policy_id,
        control_id=control_id,
        assigned_to=assigned_to,
        is_recurring=is_recurring,
        recurrence_months=recurrence_months,
    )
    db.add(item)
    db.commit()
    db.refresh(item)
    return item


def schedule_customer_review(
    customer: Customer,
    db: Session,
    override_months: Optional[int] = None,
) -> ComplianceCalendarItem:
    """
    Create or replace the next periodic review calendar item for a customer.
    """
    risk_level = (
        customer.risk_level.value
        if hasattr(customer.risk_level, "value")
        else str(customer.risk_level or "medium")
    ).lower()

    is_pep = bool(getattr(customer, "is_pep", False))
    key = "pep" if is_pep else risk_level
    months = override_months or REVIEW_MONTHS.get(key, 24)

    due = (datetime.now(timezone.utc) + timedelta(days=months * 30)).date()

    return create_calendar_item(
        db=db,
        org_id=customer.org_id,
        item_type=CalendarItemType.customer_review,
        title=f"Periodic CDD Review — {getattr(customer, 'full_name', customer.id)}",
        due_date=due,
        customer_id=customer.id,
        is_recurring=True,
        recurrence_months=months,
    )


def schedule_bulk_customer_reviews(
    db: Session,
    org_id: str,
) -> list[ComplianceCalendarItem]:
    """Schedule reviews for all active customers in the org."""
    customers = (
        db.query(Customer)
        .filter(Customer.org_id == org_id, Customer.status == "active")
        .all()
    )
    items = []
    for customer in customers:
        item = schedule_customer_review(customer, db)
        items.append(item)
    return items


def complete_item(
    item_id: str,
    completed_by: str,
    completion_notes: Optional[str],
    db: Session,
) -> ComplianceCalendarItem:
    """
    Mark a calendar item complete. If recurring, create the next occurrence.
    """
    item = (
        db.query(ComplianceCalendarItem)
        .filter(ComplianceCalendarItem.id == item_id)
        .first()
    )
    if not item:
        raise ValueError(f"Calendar item {item_id} not found")

    item.status = CalendarItemStatus.completed
    item.completed_at = datetime.now(timezone.utc)
    item.completed_by = completed_by
    item.completion_notes = completion_notes

    next_item = None
    if item.is_recurring and item.recurrence_months:
        next_due = (
            datetime.now(timezone.utc) + timedelta(days=item.recurrence_months * 30)
        ).date()
        item.next_due_date = next_due
        next_item = ComplianceCalendarItem(
            org_id=item.org_id,
            item_type=item.item_type,
            title=item.title,
            description=item.description,
            due_date=next_due,
            customer_id=item.customer_id,
            policy_id=item.policy_id,
            control_id=item.control_id,
            assigned_to=item.assigned_to,
            is_recurring=True,
            recurrence_months=item.recurrence_months,
        )
        db.add(next_item)

    db.add(item)
    db.commit()
    db.refresh(item)
    return item


def get_upcoming_items(
    db: Session,
    org_id: str,
    days_ahead: int = 30,
    item_type: Optional[CalendarItemType] = None,
) -> list[ComplianceCalendarItem]:
    today = datetime.now(timezone.utc).date()
    cutoff = today + timedelta(days=days_ahead)

    q = db.query(ComplianceCalendarItem).filter(
        ComplianceCalendarItem.org_id == org_id,
        ComplianceCalendarItem.due_date <= cutoff,
        ComplianceCalendarItem.status.notin_(
            [
                CalendarItemStatus.completed,
                CalendarItemStatus.cancelled,
            ]
        ),
    )
    if item_type:
        q = q.filter(ComplianceCalendarItem.item_type == item_type)

    return q.order_by(ComplianceCalendarItem.due_date).all()


def process_due_reminders(db: Session, org_id: str) -> list[ComplianceReminder]:
    """
    Scan open calendar items and create reminder records for each stage that
    has been reached but not yet sent. Called by a scheduled job.
    """
    today = datetime.now(timezone.utc).date()
    items = (
        db.query(ComplianceCalendarItem)
        .filter(
            ComplianceCalendarItem.org_id == org_id,
            ComplianceCalendarItem.status.notin_(
                [
                    CalendarItemStatus.completed,
                    CalendarItemStatus.cancelled,
                ]
            ),
        )
        .all()
    )

    created = []
    for item in items:
        days_until = (item.due_date - today).days

        for stage, threshold in REMINDER_DAYS_BEFORE.items():
            if days_until <= threshold:
                already_sent = (
                    db.query(ComplianceReminder)
                    .filter(
                        ComplianceReminder.calendar_item_id == item.id,
                        ComplianceReminder.stage == stage,
                    )
                    .first()
                )
                if not already_sent and item.assigned_to:
                    reminder = ComplianceReminder(
                        org_id=org_id,
                        calendar_item_id=item.id,
                        stage=stage,
                        recipient_id=item.assigned_to,
                    )
                    db.add(reminder)
                    created.append(reminder)

        # Mark overdue
        if days_until < 0 and item.status != CalendarItemStatus.overdue:
            item.status = CalendarItemStatus.overdue
            item.is_overdue = True
            db.add(item)

            # Overdue reminder
            already_sent = (
                db.query(ComplianceReminder)
                .filter(
                    ComplianceReminder.calendar_item_id == item.id,
                    ComplianceReminder.stage == ReminderStage.overdue,
                )
                .first()
            )
            if not already_sent and item.assigned_to:
                reminder = ComplianceReminder(
                    org_id=org_id,
                    calendar_item_id=item.id,
                    stage=ReminderStage.overdue,
                    recipient_id=item.assigned_to,
                )
                db.add(reminder)
                created.append(reminder)

    db.commit()
    return created


def escalate_overdue_items(
    db: Session,
    org_id: str,
    compliance_officer_id: str,
) -> list[ComplianceCalendarItem]:
    """Escalate items that are overdue to the compliance officer."""
    items = (
        db.query(ComplianceCalendarItem)
        .filter(
            ComplianceCalendarItem.org_id == org_id,
            ComplianceCalendarItem.is_overdue == True,
            ComplianceCalendarItem.escalated_to == None,
        )
        .all()
    )
    for item in items:
        item.status = CalendarItemStatus.escalated
        item.escalated_to = compliance_officer_id
        item.escalated_at = datetime.now(timezone.utc)
        db.add(item)

    db.commit()
    return items
