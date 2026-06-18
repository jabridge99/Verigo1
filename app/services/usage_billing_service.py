"""
Metered usage tracking for pay-per-use third-party verification checks.

Every billable provider call (e.g. a Sumsub KYC check) gets a UsageRecord
with the cost we pay the vendor and the marked-up amount we bill the tenant.
Records are aggregated into Invoice line items by `bill_org_usage`.
"""

from __future__ import annotations

from datetime import datetime, timezone

from sqlalchemy.orm import Session

from app.config import settings
from app.models.usage import UsageEventType, UsageRecord, UsageRecordStatus


def record_usage(
    db: Session,
    org_id: str,
    event_type: UsageEventType,
    provider: str,
    customer_id: str | None = None,
    provider_reference: str | None = None,
    unit_cost_aud: float | None = None,
    markup_pct: float | None = None,
    status: UsageRecordStatus = UsageRecordStatus.pending,
) -> UsageRecord:
    """Create a usage record. Call once when the provider request is made
    (status=pending) and again — or update in place — when the result lands."""
    cost = unit_cost_aud if unit_cost_aud is not None else settings.sumsub_unit_cost_aud
    markup = markup_pct if markup_pct is not None else settings.usage_markup_pct
    billed = round(cost * (1 + markup / 100), 4)

    record = UsageRecord(
        org_id=org_id,
        customer_id=customer_id,
        event_type=event_type,
        provider=provider,
        provider_reference=provider_reference,
        status=status,
        unit_cost_aud=cost,
        markup_pct=markup,
        billed_amount_aud=billed,
    )
    db.add(record)
    db.commit()
    db.refresh(record)
    return record


def mark_completed(db: Session, record: UsageRecord) -> UsageRecord:
    record.status = UsageRecordStatus.completed
    db.commit()
    return record


def mark_failed(db: Session, record: UsageRecord) -> UsageRecord:
    """Failed provider calls are not billed."""
    record.status = UsageRecordStatus.failed
    record.billed_amount_aud = 0.0
    db.commit()
    return record


def find_by_reference(
    db: Session, provider: str, provider_reference: str
) -> UsageRecord | None:
    return (
        db.query(UsageRecord)
        .filter(
            UsageRecord.provider == provider,
            UsageRecord.provider_reference == provider_reference,
        )
        .order_by(UsageRecord.created_at.desc())
        .first()
    )


def list_unbilled(db: Session, org_id: str) -> list[UsageRecord]:
    return (
        db.query(UsageRecord)
        .filter(
            UsageRecord.org_id == org_id,
            UsageRecord.status == UsageRecordStatus.completed,
            UsageRecord.invoiced.is_(False),
        )
        .order_by(UsageRecord.created_at)
        .all()
    )


def usage_summary(
    db: Session, org_id: str, period_start: datetime, period_end: datetime
) -> dict:
    records = (
        db.query(UsageRecord)
        .filter(
            UsageRecord.org_id == org_id,
            UsageRecord.status == UsageRecordStatus.completed,
            UsageRecord.created_at >= period_start,
            UsageRecord.created_at <= period_end,
        )
        .all()
    )
    return {
        "org_id": org_id,
        "period_start": period_start,
        "period_end": period_end,
        "check_count": len(records),
        "total_cost_aud": round(sum(r.unit_cost_aud for r in records), 2),
        "total_billed_aud": round(sum(r.billed_amount_aud for r in records), 2),
        "by_event_type": _group_totals(records),
    }


def _group_totals(records: list[UsageRecord]) -> dict:
    out: dict = {}
    for r in records:
        key = r.event_type.value
        bucket = out.setdefault(key, {"count": 0, "billed_aud": 0.0})
        bucket["count"] += 1
        bucket["billed_aud"] = round(bucket["billed_aud"] + r.billed_amount_aud, 2)
    return out


def mark_invoiced(db: Session, org_id: str, invoice_id: str) -> int:
    """Stamp all completed-but-unbilled usage records for this org as invoiced.
    Called after an Invoice line item for usage has been created (e.g. via Stripe
    metered billing or a manual invoice)."""
    records = list_unbilled(db, org_id)
    now = datetime.now(timezone.utc)
    for r in records:
        r.invoiced = True
        r.invoice_id = invoice_id
        r.invoiced_at = now
    db.commit()
    return len(records)
