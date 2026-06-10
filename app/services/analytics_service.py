"""
Analytics service — aggregates compliance metrics for the reporting dashboard.
"""

from datetime import datetime, timezone, timedelta
from typing import Optional
from sqlalchemy.orm import Session
from sqlalchemy import func, case, and_

from app.models.customer import Customer, RiskLevel, CustomerStatus
from app.models.kyc import KYCRecord, KYCStatus
from app.models.transaction import Transaction
from app.models.report import Report, ReportStatus, ReportType
from app.models.audit import AuditLog


def _now():
    return datetime.now(timezone.utc)


def _days_ago(n: int):
    return _now() - timedelta(days=n)


# ── Customer Analytics ─────────────────────────────────────────────────────────

def customer_risk_breakdown(db: Session, industry_id: Optional[str] = None):
    q = db.query(Customer)
    if industry_id:
        q = q.filter(Customer.industry_id == industry_id)
    total = q.count()
    breakdown = {}
    for level in RiskLevel:
        breakdown[level.value] = q.filter(Customer.risk_level == level).count()
    return {"total": total, "by_risk": breakdown}


def customer_onboarding_trend(db: Session, days: int = 30, industry_id: Optional[str] = None):
    since = _days_ago(days)
    q = db.query(
        func.date(Customer.created_at).label("day"),
        func.count().label("count"),
    ).filter(Customer.created_at >= since)
    if industry_id:
        q = q.filter(Customer.industry_id == industry_id)
    rows = q.group_by(func.date(Customer.created_at)).order_by("day").all()
    return [{"date": str(r.day), "count": r.count} for r in rows]


# ── Transaction Analytics ──────────────────────────────────────────────────────

def transaction_volume_trend(db: Session, days: int = 30, industry_id: Optional[str] = None):
    since = _days_ago(days)
    q = db.query(
        func.date(Transaction.created_at).label("day"),
        func.count().label("count"),
        func.coalesce(func.sum(Transaction.amount), 0).label("volume"),
    ).filter(Transaction.created_at >= since)
    if industry_id:
        q = q.filter(Transaction.industry_id == industry_id)
    rows = q.group_by(func.date(Transaction.created_at)).order_by("day").all()
    return [{"date": str(r.day), "count": r.count, "volume": float(r.volume)} for r in rows]


def flagged_transaction_stats(db: Session, industry_id: Optional[str] = None):
    q = db.query(Transaction)
    if industry_id:
        q = q.filter(Transaction.industry_id == industry_id)
    total = q.count()
    suspicious = q.filter(Transaction.is_suspicious == 1).count()
    return {
        "total": total,
        "flagged": suspicious,
        "flagged_pct": round(suspicious / total * 100, 1) if total else 0,
    }


# ── KYC Analytics ─────────────────────────────────────────────────────────────

def kyc_status_breakdown(db: Session, industry_id: Optional[str] = None):
    q = db.query(KYCRecord)
    if industry_id:
        q = q.filter(KYCRecord.industry_id == industry_id)
    breakdown = {}
    for status in KYCStatus:
        breakdown[status.value] = q.filter(KYCRecord.status == status).count()
    return {"total": q.count(), "by_status": breakdown}


# ── Reporting Analytics ────────────────────────────────────────────────────────

def report_stats(db: Session, industry_id: Optional[str] = None):
    q = db.query(Report)
    if industry_id:
        q = q.filter(Report.industry_id == industry_id)
    total = q.count()
    by_status = {}
    for s in ReportStatus:
        by_status[s.value] = q.filter(Report.status == s).count()
    by_type = {}
    for t in ReportType:
        by_type[t.value] = q.filter(Report.report_type == t).count()
    return {"total": total, "by_status": by_status, "by_type": by_type}


def report_submission_trend(db: Session, days: int = 90, industry_id: Optional[str] = None):
    since = _days_ago(days)
    q = db.query(
        func.date(Report.created_at).label("day"),
        func.count().label("count"),
    ).filter(Report.created_at >= since)
    if industry_id:
        q = q.filter(Report.industry_id == industry_id)
    rows = q.group_by(func.date(Report.created_at)).order_by("day").all()
    return [{"date": str(r.day), "count": r.count} for r in rows]


# ── Audit Analytics ────────────────────────────────────────────────────────────

def audit_activity_trend(db: Session, days: int = 30, industry_id: Optional[str] = None):
    since = _days_ago(days)
    q = db.query(
        func.date(AuditLog.created_at).label("day"),
        func.count().label("count"),
    ).filter(AuditLog.created_at >= since)
    if industry_id:
        q = q.filter(AuditLog.industry_id == industry_id)
    rows = q.group_by(func.date(AuditLog.created_at)).order_by("day").all()
    return [{"date": str(r.day), "count": r.count} for r in rows]


# ── Composite Dashboard Summary ────────────────────────────────────────────────

def dashboard_summary(db: Session, industry_id: Optional[str] = None):
    customers = customer_risk_breakdown(db, industry_id)
    txn = flagged_transaction_stats(db, industry_id)
    kyc = kyc_status_breakdown(db, industry_id)
    rpt = report_stats(db, industry_id)

    pending_kyc = kyc["by_status"].get("pending_review", 0)
    overdue_reports = rpt["by_status"].get("draft", 0)

    return {
        "customers": customers,
        "transactions": txn,
        "kyc": kyc,
        "reports": rpt,
        "alerts": {
            "pending_kyc_reviews": pending_kyc,
            "overdue_reports": overdue_reports,
            "high_risk_customers": customers["by_risk"].get("high", 0) + customers["by_risk"].get("very_high", 0),
        },
    }
