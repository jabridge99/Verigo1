"""
AUSTRAC Regulatory Reporting Service.

Handles auto-generation of:
  - TTR  (Threshold Transaction Report)   — due within 10 business days
  - IFTI (International Funds Transfer)   — due within 10 business days
  - SMR  (Suspicious Matter Report)       — due within 3 business days

Statutory deadlines per AML/CTF Act 2006 and AUSTRAC guidance.
"""

import uuid
from datetime import datetime, timedelta, timezone
from typing import Optional
from sqlalchemy.orm import Session

from app.models.report import ComplianceReport, ReportType, ReportStatus, ReportPriority
from app.models.transaction import Transaction, TransactionAlert, AlertType
from app.models.customer import Customer

# Statutory reporting deadlines (business days approximated as calendar days * 1.4)
DEADLINE_DAYS = {
    "ttr":      14,   # 10 business days ≈ 14 calendar days
    "ifti_in":  14,
    "ifti_out": 14,
    "smr":       4,   # 3 business days ≈ 4 calendar days
}

AUSTRAC_FORMS = {
    "ttr":      "TTR",
    "ifti_in":  "IFTI-I",
    "ifti_out": "IFTI-E",
    "smr":      "SMR",
}


def _report_id() -> str:
    return f"RPT-{uuid.uuid4().hex[:10].upper()}"


def _due_date(report_type: str) -> datetime:
    days = DEADLINE_DAYS.get(report_type, 14)
    return datetime.now(timezone.utc) + timedelta(days=days)


def _days_remaining(due: datetime) -> int:
    now = datetime.now(timezone.utc)
    delta = (due.replace(tzinfo=timezone.utc) - now).days
    return max(delta, 0)


def _priority(report_type: str, days_left: int) -> ReportPriority:
    if report_type == "smr" or days_left <= 1:
        return ReportPriority.urgent
    if days_left <= 3:
        return ReportPriority.high
    return ReportPriority.medium


# ─── Auto-generation from alerts ─────────────────────────────────────────────

def auto_generate_from_alert(
    db: Session,
    alert: TransactionAlert,
    industry_id: str = None,
    prepared_by: str = "system",
) -> Optional[ComplianceReport]:
    """
    Create the appropriate AUSTRAC report based on alert type.
    Returns None if this alert type doesn't map to a mandatory report.
    Skips if a non-submitted report already exists for this alert.
    """
    alert_type = alert.alert_type.value if hasattr(alert.alert_type, "value") else alert.alert_type
    txn = db.query(Transaction).filter(Transaction.id == alert.transaction_id).first()
    customer = db.query(Customer).filter(Customer.id == alert.customer_id).first()

    if not txn or not customer:
        return None

    # Determine which AUSTRAC report type applies
    if alert_type == "large_transaction":
        rtype = ReportType.ttr
    elif alert_type == "cross_border":
        is_outbound = txn.transaction_type.value in ("withdrawal", "transfer", "payment")
        rtype = ReportType.ifti_out if is_outbound else ReportType.ifti_in
    elif alert_type in ("sanctions_match", "structuring", "pep_transaction", "unusual_pattern", "rule_triggered", "velocity_breach"):
        rtype = ReportType.smr
    else:
        return None

    # Idempotency: skip if already have a draft/review report for this alert
    existing = (
        db.query(ComplianceReport)
        .filter(
            ComplianceReport.customer_id == customer.id,
            ComplianceReport.report_type == rtype,
            ComplianceReport.status.notin_([ReportStatus.submitted, ReportStatus.acknowledged]),
        )
        .first()
    )
    if existing:
        # Link this alert to the existing report
        existing_ids = existing.alert_ids or []
        if alert.alert_id not in existing_ids:
            existing_ids.append(alert.alert_id)
            existing.alert_ids = existing_ids
            db.commit()
        return existing

    amount = txn.amount_aud or txn.amount
    due = _due_date(rtype.value)
    days_left = _days_remaining(due)

    titles = {
        ReportType.ttr:      f"TTR — {customer.full_name} — AUD ${amount:,.2f}",
        ReportType.ifti_in:  f"IFTI Inbound — {customer.full_name} — {txn.counterparty_country or 'Unknown'}",
        ReportType.ifti_out: f"IFTI Outbound — {customer.full_name} — {txn.counterparty_country or 'Unknown'}",
        ReportType.smr:      f"SMR — {customer.full_name} — {alert_type.replace('_',' ').title()}",
    }

    summaries = {
        ReportType.ttr: (
            f"Cash transaction of AUD ${amount:,.2f} by {customer.full_name} "
            f"({txn.transaction_type.value}) on {txn.transaction_date.strftime('%d %b %Y')} "
            f"meets the threshold reporting obligation under the AML/CTF Act 2006 s.43."
        ),
        ReportType.ifti_in: (
            f"Inbound international funds transfer of AUD ${amount:,.2f} received by "
            f"{customer.full_name} from {txn.counterparty_country or 'unknown jurisdiction'} "
            f"triggers IFTI reporting obligation under AML/CTF Act 2006 s.45."
        ),
        ReportType.ifti_out: (
            f"Outbound international funds transfer of AUD ${amount:,.2f} sent by "
            f"{customer.full_name} to {txn.counterparty_country or 'unknown jurisdiction'} "
            f"triggers IFTI reporting obligation under AML/CTF Act 2006 s.45."
        ),
        ReportType.smr: (
            f"Suspicious matter identified involving {customer.full_name}. "
            f"Alert type: {alert_type.replace('_', ' ')}. "
            f"Transaction amount: AUD ${amount:,.2f}. "
            f"Grounds: {alert.description[:300]}"
        ),
    }

    report = ComplianceReport(
        report_id=_report_id(),
        industry_id=industry_id or alert.industry_id,
        customer_id=customer.id,
        report_type=rtype,
        status=ReportStatus.draft,
        priority=_priority(rtype.value, days_left),
        title=titles[rtype],
        summary=summaries[rtype],
        risk_level=customer.risk_level,
        total_amount_flagged=amount,
        transaction_count=1,
        transaction_ids=[txn.transaction_id],
        alert_ids=[alert.alert_id],
        austrac_report_type=AUSTRAC_FORMS[rtype.value],
        due_date=due,
        days_remaining=days_left,
        prepared_by=prepared_by,
    )
    db.add(report)
    db.commit()
    db.refresh(report)
    return report


def bulk_auto_generate(
    db: Session,
    industry_id: str = None,
    alert_types: list[str] = None,
) -> list[ComplianceReport]:
    """
    Scan open alerts and auto-generate any missing mandatory reports.
    Run as a scheduled job (e.g. daily cron).
    """
    q = db.query(TransactionAlert).filter(TransactionAlert.is_resolved == 0)
    if industry_id:
        q = q.filter_by(industry_id=industry_id)
    if alert_types:
        q = q.filter(TransactionAlert.alert_type.in_(alert_types))

    generated = []
    for alert in q.all():
        report = auto_generate_from_alert(db, alert, industry_id=industry_id)
        if report and report.report_id not in [r.report_id for r in generated]:
            generated.append(report)
    return generated


def reporting_summary(db: Session, industry_id: str = None) -> dict:
    q = db.query(ComplianceReport)
    if industry_id:
        q = q.filter_by(industry_id=industry_id)
    reports = q.all()

    by_type: dict[str, int] = {}
    by_status: dict[str, int] = {}
    overdue = 0
    due_soon = 0
    now = datetime.now(timezone.utc)

    for r in reports:
        rt = r.report_type.value if hasattr(r.report_type, "value") else str(r.report_type)
        by_type[rt] = by_type.get(rt, 0) + 1
        st = r.status.value if hasattr(r.status, "value") else str(r.status)
        by_status[st] = by_status.get(st, 0) + 1
        if r.due_date and r.status not in (ReportStatus.submitted, ReportStatus.acknowledged):
            days = (r.due_date.replace(tzinfo=timezone.utc) - now).days
            if days < 0:
                overdue += 1
            elif days <= 2:
                due_soon += 1

    submitted = by_status.get("submitted", 0) + by_status.get("acknowledged", 0)

    return {
        "total": len(reports),
        "by_type": by_type,
        "by_status": by_status,
        "overdue": overdue,
        "due_soon": due_soon,
        "submitted": submitted,
        "draft": by_status.get("draft", 0),
        "under_review": by_status.get("under_review", 0),
    }
