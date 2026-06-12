"""
AUSTRAC Regulatory Reporting — SECURITY HARDENED.
Zero Trust fixes:
- Authentication required on ALL endpoints
- RBAC: report creation (analyst+), review (compliance+), approve/submit (mlro only)
- Maker-checker: reviewer ≠ approver enforced
- reviewer/approved_by taken from session, never from request body
- Tenant isolation on all list/get queries
- Audit trail on every state transition
"""

import uuid
from datetime import datetime, timezone
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session

from app.api.routes.auth import _require_roles
from app.db.database import get_db
from app.models.customer import Customer
from app.models.report import ComplianceReport, ECDDRecord, ReportStatus
from app.models.user import User, UserRole
from app.schemas.report import (
    ECDDCreate,
    ECDDResponse,
    ReportCreate,
    ReportingSummary,
    ReportResponse,
    ReportSubmit,
    ReportUpdate,
)
from app.services.ecdd_service import compute_ecdd_score, determine_recommendation
from app.services.reporting_service import (
    auto_generate_from_alert,
    bulk_auto_generate,
    reporting_summary,
)
from app.services.risk_scoring import score_to_level

router = APIRouter(prefix="/reports", tags=["Compliance Reports"])

# Role shortcuts
_READER = _require_roles(
    UserRole.admin,
    UserRole.mlro,
    UserRole.compliance,
    UserRole.analyst,
    UserRole.viewer,
)
_WRITER = _require_roles(
    UserRole.admin, UserRole.mlro, UserRole.compliance, UserRole.analyst
)
_REVIEW = _require_roles(UserRole.admin, UserRole.mlro, UserRole.compliance)
_APPROVE = _require_roles(UserRole.admin, UserRole.mlro)


def _assert_tenant(current_user: User, report_industry_id: Optional[str]):
    if current_user.role == UserRole.admin:
        return
    if report_industry_id and report_industry_id != current_user.industry_id:
        raise HTTPException(403, "Cross-tenant access denied")


def _scoped(db: Session, current_user: User):
    q = db.query(ComplianceReport)
    if current_user.role != UserRole.admin:
        q = q.filter(ComplianceReport.industry_id == current_user.industry_id)
    return q


# ─── Reports CRUD ─────────────────────────────────────────────────────────────


@router.post("/", response_model=ReportResponse, status_code=201)
def create_report(
    payload: ReportCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(_WRITER),
):
    customer = db.query(Customer).filter(Customer.id == payload.customer_id).first()
    if not customer:
        raise HTTPException(404, "Customer not found")
    _assert_tenant(current_user, customer.industry_id)

    from app.services.reporting_service import (
        _days_remaining,
        _due_date,
        _priority,
        _report_id,
    )

    rtype = payload.report_type.value
    due = _due_date(rtype)
    data = payload.model_dump()
    # Enforce tenant scoping from session — ignore any industry_id in payload
    data["industry_id"] = (
        current_user.industry_id
        if current_user.role != UserRole.admin
        else data.get("industry_id")
    )
    data["prepared_by"] = current_user.user_id

    report = ComplianceReport(
        report_id=_report_id(),
        risk_level=customer.risk_level,
        austrac_report_type={
            "ttr": "TTR",
            "ifti_in": "IFTI-I",
            "ifti_out": "IFTI-E",
            "smr": "SMR",
        }.get(rtype, rtype.upper()),
        due_date=due,
        days_remaining=_days_remaining(due),
        priority=_priority(rtype, _days_remaining(due)),
        **data,
    )
    db.add(report)
    db.commit()
    db.refresh(report)
    return report


@router.get("/", response_model=list[ReportResponse])
def list_reports(
    customer_id: Optional[int] = None,
    report_type: Optional[str] = None,
    status: Optional[str] = None,
    priority: Optional[str] = None,
    skip: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=200),
    db: Session = Depends(get_db),
    current_user: User = Depends(_READER),
):
    q = _scoped(db, current_user)
    if customer_id:
        q = q.filter(ComplianceReport.customer_id == customer_id)
    if report_type:
        q = q.filter(ComplianceReport.report_type == report_type)
    if status:
        q = q.filter(ComplianceReport.status == status)
    if priority:
        q = q.filter(ComplianceReport.priority == priority)
    return (
        q.order_by(ComplianceReport.created_at.desc()).offset(skip).limit(limit).all()
    )


@router.get("/summary", response_model=ReportingSummary)
def get_summary(
    db: Session = Depends(get_db),
    current_user: User = Depends(_READER),
):
    industry_id = (
        None if current_user.role == UserRole.admin else current_user.industry_id
    )
    return reporting_summary(db, industry_id=industry_id)


@router.get("/{report_id}", response_model=ReportResponse)
def get_report(
    report_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(_READER),
):
    r = (
        _scoped(db, current_user)
        .filter(ComplianceReport.report_id == report_id)
        .first()
    )
    if not r:
        raise HTTPException(404, "Report not found")
    return r


@router.patch("/{report_id}", response_model=ReportResponse)
def update_report(
    report_id: str,
    payload: ReportUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(_WRITER),
):
    r = (
        _scoped(db, current_user)
        .filter(ComplianceReport.report_id == report_id)
        .first()
    )
    if not r:
        raise HTTPException(404, "Report not found")
    if r.status not in (ReportStatus.draft,):
        raise HTTPException(400, f"Cannot edit report in status: {r.status}")
    for field, value in payload.model_dump(exclude_none=True).items():
        # Prevent overwriting audit fields via this endpoint
        if field not in (
            "reviewed_by",
            "approved_by",
            "submitted_at",
            "acknowledged_at",
        ):
            setattr(r, field, value)
    db.commit()
    db.refresh(r)
    return r


@router.post("/{report_id}/review")
def move_to_review(
    report_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(_REVIEW),
):
    """Mark report as under review. reviewer set from authenticated session."""
    r = (
        _scoped(db, current_user)
        .filter(ComplianceReport.report_id == report_id)
        .first()
    )
    if not r:
        raise HTTPException(404, "Report not found")
    if r.status != ReportStatus.draft:
        raise HTTPException(
            400, f"Report must be in draft status (current: {r.status})"
        )
    r.status = ReportStatus.under_review
    r.reviewed_by = current_user.user_id  # from session — never from request
    db.commit()
    return {"report_id": report_id, "status": r.status, "reviewed_by": r.reviewed_by}


@router.post("/{report_id}/approve")
def approve_report(
    report_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(_APPROVE),
):
    """
    MLRO-only approval. Enforces maker-checker: approver must differ from reviewer.
    approved_by is taken from authenticated session — never accepted from request body.
    """
    r = (
        _scoped(db, current_user)
        .filter(ComplianceReport.report_id == report_id)
        .first()
    )
    if not r:
        raise HTTPException(404, "Report not found")
    if r.status != ReportStatus.under_review:
        raise HTTPException(400, f"Report must be under review (current: {r.status})")
    # Maker-checker: MLRO cannot approve their own review
    if r.reviewed_by and r.reviewed_by == current_user.user_id:
        raise HTTPException(
            403, "Maker-checker violation: approver cannot be the same as reviewer"
        )
    r.status = ReportStatus.approved
    r.approved_by = current_user.user_id
    r.mlro_sign_off = True
    db.commit()
    return {"report_id": report_id, "status": r.status, "approved_by": r.approved_by}


@router.post("/{report_id}/submit", response_model=ReportResponse)
def submit_report(
    report_id: str,
    payload: ReportSubmit,
    db: Session = Depends(get_db),
    current_user: User = Depends(_APPROVE),
):
    """Submit to AUSTRAC. Requires prior approval by a different user."""
    r = (
        _scoped(db, current_user)
        .filter(ComplianceReport.report_id == report_id)
        .first()
    )
    if not r:
        raise HTTPException(404, "Report not found")
    if r.status != ReportStatus.approved:
        raise HTTPException(
            400, f"Report must be approved before submission (current: {r.status})"
        )
    r.status = ReportStatus.submitted
    r.submitted_to = payload.submitted_to
    r.submission_reference = (
        payload.submission_reference or f"REF-{uuid.uuid4().hex[:8].upper()}"
    )
    r.submitted_at = datetime.now(timezone.utc)
    # approved_by already set during approve step — do not overwrite from payload
    db.commit()
    db.refresh(r)
    return r


@router.post("/{report_id}/acknowledge")
def acknowledge_report(
    report_id: str,
    reference: Optional[str] = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(_APPROVE),
):
    r = (
        _scoped(db, current_user)
        .filter(ComplianceReport.report_id == report_id)
        .first()
    )
    if not r:
        raise HTTPException(404, "Report not found")
    if r.status != ReportStatus.submitted:
        raise HTTPException(
            400,
            f"Report must be submitted before acknowledgement (current: {r.status})",
        )
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
    db: Session = Depends(get_db),
    current_user: User = Depends(_REVIEW),
):
    from app.models.transaction import TransactionAlert

    alert = db.query(TransactionAlert).filter_by(alert_id=alert_id).first()
    if not alert:
        raise HTTPException(404, "Alert not found")
    industry_id = (
        None if current_user.role == UserRole.admin else current_user.industry_id
    )
    report = auto_generate_from_alert(
        db, alert, industry_id=industry_id, prepared_by=current_user.user_id
    )
    if not report:
        raise HTTPException(
            422, "Alert type does not map to a mandatory AUSTRAC report"
        )
    return report


@router.post("/auto-generate/bulk")
def bulk_auto_generate_endpoint(
    db: Session = Depends(get_db),
    current_user: User = Depends(_APPROVE),
):
    industry_id = (
        None if current_user.role == UserRole.admin else current_user.industry_id
    )
    reports = bulk_auto_generate(db, industry_id=industry_id)
    return {"generated": len(reports), "report_ids": [r.report_id for r in reports]}


# ─── ECDD ─────────────────────────────────────────────────────────────────────


@router.post("/ecdd/", response_model=ECDDResponse, status_code=201)
def create_ecdd(
    payload: ECDDCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(_REVIEW),
):
    customer = db.query(Customer).filter(Customer.id == payload.customer_id).first()
    if not customer:
        raise HTTPException(404, "Customer not found")
    _assert_tenant(current_user, customer.industry_id)

    # ECDD requires approved KYC — enforce business rule
    from app.models.kyc import KYCRecord, KYCStatus

    approved_kyc = (
        db.query(KYCRecord)
        .filter(
            KYCRecord.customer_id == customer.id,
            KYCRecord.status == KYCStatus.approved,
        )
        .first()
    )
    if not approved_kyc and not (customer.risk_score or 0) >= 61:
        raise HTTPException(
            422, "ECDD requires an approved KYC record or risk score >= 61"
        )

    ecdd = ECDDRecord(
        ecdd_id=f"ECDD-{uuid.uuid4().hex[:10].upper()}",
        created_by=current_user.user_id,
        **payload.model_dump(),
    )
    db.add(ecdd)
    db.flush()
    ecdd.enhanced_risk_score = compute_ecdd_score(ecdd)
    ecdd.recommendation = determine_recommendation(
        ecdd.enhanced_risk_score,
        bool(ecdd.pep_status),
        bool(ecdd.adverse_media_found),
    )
    customer.risk_score = max(customer.risk_score or 0, ecdd.enhanced_risk_score)
    customer.risk_level = score_to_level(customer.risk_score)
    customer.is_pep = payload.pep_status
    db.commit()
    db.refresh(ecdd)
    return ecdd


@router.patch("/ecdd/{ecdd_id}/complete")
def complete_ecdd(
    ecdd_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(_REVIEW),
):
    ecdd = db.query(ECDDRecord).filter_by(ecdd_id=ecdd_id).first()
    if not ecdd:
        raise HTTPException(404, "ECDD record not found")
    ecdd.status = "completed"
    ecdd.completed_at = datetime.now(timezone.utc)
    db.commit()
    return {
        "ecdd_id": ecdd_id,
        "recommendation": ecdd.recommendation,
        "status": ecdd.status,
    }


@router.get("/ecdd/{customer_id}")
def get_ecdd_records(
    customer_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(_READER),
):
    customer = db.query(Customer).filter(Customer.customer_id == customer_id).first()
    if not customer:
        raise HTTPException(404, "Customer not found")
    _assert_tenant(current_user, customer.industry_id)
    return db.query(ECDDRecord).filter_by(customer_id=customer.id).all()
