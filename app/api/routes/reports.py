"""
AUSTRAC Regulatory Reporting — API routes.
"""

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from typing import Optional
import uuid
from datetime import datetime, timezone

from app.db.database import get_db
from app.models.report import ComplianceReport, ECDDRecord, ReportStatus, ReportType
from app.models.customer import Customer
from app.schemas.report import (
    ReportCreate, ReportSubmit, ReportResponse, ReportUpdate,
    ECDDCreate, ECDDResponse, ReportingSummary,
)
from app.services.ecdd_service import compute_ecdd_score, determine_recommendation
from app.services.risk_scoring import score_to_level
from app.services.reporting_service import (
    auto_generate_from_alert, bulk_auto_generate, reporting_summary,
)

router = APIRouter(prefix="/reports", tags=["Compliance Reports"])


# ─── Reports CRUD ─────────────────────────────────────────────────────────────

@router.post("/", response_model=ReportResponse, status_code=201)
def create_report(payload: ReportCreate, db: Session = Depends(get_db)):
    customer = db.query(Customer).filter(Customer.id == payload.customer_id).first()
    if not customer:
        raise HTTPException(404, "Customer not found")
    from app.services.reporting_service import _report_id, _due_date, _days_remaining, _priority
    rtype = payload.report_type.value
    due = _due_date(rtype)
    report = ComplianceReport(
        report_id=_report_id(),
        risk_level=customer.risk_level,
        austrac_report_type={"ttr":"TTR","ifti_in":"IFTI-I","ifti_out":"IFTI-E","smr":"SMR"}.get(rtype, rtype.upper()),
        due_date=due,
        days_remaining=_days_remaining(due),
        priority=_priority(rtype, _days_remaining(due)),
        **payload.model_dump(),
    )
    db.add(report)
    db.commit()
    db.refresh(report)
    return report


@router.get("/", response_model=list[ReportResponse])
def list_reports(
    industry_id: Optional[str] = None,
    customer_id: Optional[int] = None,
    report_type: Optional[str] = None,
    status: Optional[str] = None,
    priority: Optional[str] = None,
    skip: int = 0,
    limit: int = 50,
    db: Session = Depends(get_db),
):
    q = db.query(ComplianceReport)
    if industry_id:
        q = q.filter_by(industry_id=industry_id)
    if customer_id:
        q = q.filter_by(customer_id=customer_id)
    if report_type:
        q = q.filter(ComplianceReport.report_type == report_type)
    if status:
        q = q.filter(ComplianceReport.status == status)
    if priority:
        q = q.filter(ComplianceReport.priority == priority)
    return q.order_by(ComplianceReport.created_at.desc()).offset(skip).limit(limit).all()


@router.get("/summary", response_model=ReportingSummary)
def get_summary(industry_id: Optional[str] = None, db: Session = Depends(get_db)):
    return reporting_summary(db, industry_id=industry_id)


@router.get("/{report_id}", response_model=ReportResponse)
def get_report(report_id: str, db: Session = Depends(get_db)):
    r = db.query(ComplianceReport).filter_by(report_id=report_id).first()
    if not r:
        raise HTTPException(404, "Report not found")
    return r


@router.patch("/{report_id}", response_model=ReportResponse)
def update_report(report_id: str, payload: ReportUpdate, db: Session = Depends(get_db)):
    r = db.query(ComplianceReport).filter_by(report_id=report_id).first()
    if not r:
        raise HTTPException(404, "Report not found")
    for field, value in payload.model_dump(exclude_none=True).items():
        setattr(r, field, value)
    db.commit()
    db.refresh(r)
    return r


@router.post("/{report_id}/review")
def move_to_review(report_id: str, reviewer: str, db: Session = Depends(get_db)):
    r = db.query(ComplianceReport).filter_by(report_id=report_id).first()
    if not r:
        raise HTTPException(404, "Report not found")
    r.status = ReportStatus.under_review
    r.reviewed_by = reviewer
    db.commit()
    return {"report_id": report_id, "status": r.status}


@router.post("/{report_id}/approve")
def approve_report(report_id: str, approved_by: str, db: Session = Depends(get_db)):
    r = db.query(ComplianceReport).filter_by(report_id=report_id).first()
    if not r:
        raise HTTPException(404, "Report not found")
    r.status = ReportStatus.approved
    r.approved_by = approved_by
    r.mlro_sign_off = True
    db.commit()
    return {"report_id": report_id, "status": r.status}


@router.post("/{report_id}/submit", response_model=ReportResponse)
def submit_report(report_id: str, payload: ReportSubmit, db: Session = Depends(get_db)):
    r = db.query(ComplianceReport).filter_by(report_id=report_id).first()
    if not r:
        raise HTTPException(404, "Report not found")
    if r.status not in (ReportStatus.draft, ReportStatus.under_review, ReportStatus.approved):
        raise HTTPException(400, f"Cannot submit report in status: {r.status}")
    r.status = ReportStatus.submitted
    r.submitted_to = payload.submitted_to
    r.submission_reference = payload.submission_reference or f"REF-{uuid.uuid4().hex[:8].upper()}"
    r.approved_by = payload.approved_by
    r.submitted_at = datetime.now(timezone.utc)
    db.commit()
    db.refresh(r)
    return r


@router.post("/{report_id}/acknowledge")
def acknowledge_report(report_id: str, reference: Optional[str] = None, db: Session = Depends(get_db)):
    r = db.query(ComplianceReport).filter_by(report_id=report_id).first()
    if not r:
        raise HTTPException(404, "Report not found")
    r.status = ReportStatus.acknowledged
    r.acknowledged_at = datetime.now(timezone.utc)
    if reference:
        r.submission_reference = reference
    db.commit()
    return {"report_id": report_id, "status": r.status}


# ─── Auto-generation ──────────────────────────────────────────────────────────

@router.post("/auto-generate/alert/{alert_id}", response_model=ReportResponse)
def auto_generate_from_alert_endpoint(
    alert_id: str,
    industry_id: Optional[str] = None,
    prepared_by: Optional[str] = "system",
    db: Session = Depends(get_db),
):
    from app.models.transaction import TransactionAlert
    alert = db.query(TransactionAlert).filter_by(alert_id=alert_id).first()
    if not alert:
        raise HTTPException(404, "Alert not found")
    report = auto_generate_from_alert(db, alert, industry_id=industry_id, prepared_by=prepared_by or "system")
    if not report:
        raise HTTPException(422, "Alert type does not map to a mandatory AUSTRAC report")
    return report


@router.post("/auto-generate/bulk")
def bulk_auto_generate_endpoint(
    industry_id: Optional[str] = None,
    db: Session = Depends(get_db),
):
    reports = bulk_auto_generate(db, industry_id=industry_id)
    return {"generated": len(reports), "report_ids": [r.report_id for r in reports]}


# ─── ECDD ─────────────────────────────────────────────────────────────────────

@router.post("/ecdd/", response_model=ECDDResponse, status_code=201)
def create_ecdd(payload: ECDDCreate, db: Session = Depends(get_db)):
    customer = db.query(Customer).filter(Customer.id == payload.customer_id).first()
    if not customer:
        raise HTTPException(404, "Customer not found")
    ecdd = ECDDRecord(
        ecdd_id=f"ECDD-{uuid.uuid4().hex[:10].upper()}",
        **payload.model_dump(),
    )
    db.add(ecdd)
    db.flush()
    ecdd.enhanced_risk_score = compute_ecdd_score(ecdd)
    ecdd.recommendation = determine_recommendation(
        ecdd.enhanced_risk_score, bool(ecdd.pep_status), bool(ecdd.adverse_media_found),
    )
    customer.risk_score = max(customer.risk_score or 0, ecdd.enhanced_risk_score)
    customer.risk_level = score_to_level(customer.risk_score)
    customer.is_pep = payload.pep_status
    db.commit()
    db.refresh(ecdd)
    return ecdd


@router.patch("/ecdd/{ecdd_id}/complete")
def complete_ecdd(ecdd_id: str, db: Session = Depends(get_db)):
    ecdd = db.query(ECDDRecord).filter_by(ecdd_id=ecdd_id).first()
    if not ecdd:
        raise HTTPException(404, "ECDD record not found")
    ecdd.status = "completed"
    ecdd.completed_at = datetime.now(timezone.utc)
    db.commit()
    return {"ecdd_id": ecdd_id, "recommendation": ecdd.recommendation, "status": ecdd.status}


@router.get("/ecdd/{customer_id}")
def get_ecdd_records(customer_id: str, db: Session = Depends(get_db)):
    customer = db.query(Customer).filter(Customer.customer_id == customer_id).first()
    if not customer:
        raise HTTPException(404, "Customer not found")
    return db.query(ECDDRecord).filter_by(customer_id=customer.id).all()
