"""
Reports — Threshold Transaction Report (TTR) lifecycle: generate, review,
approve, submit, acknowledge, reject, redraft, plus AUSTRAC CSV export and
Connect API payload building.
Part of the reports route package; see __init__.py for the combined router.
"""

from datetime import datetime, timezone
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query, status
from fastapi.responses import StreamingResponse
from sqlalchemy.orm import Session

from app.api.deps import (
    Pagination,
    org_id_for,
    require_analyst_or_above,
    require_compliance_or_above,
    require_mlro_or_above,
)
from app.api.routes.reports._shared import _assert_editable, _assert_maker_checker, _log
from app.db.database import get_db
from app.models.customer import Customer
from app.models.report import ReportStatus, ReportType, TTRIndustryType, TTRReport
from app.models.transaction import Transaction
from app.models.user import User
from app.services import audit_service
from app.services.reporting_service import (
    generate_ttr_from_transaction,
    register_submission,
)
from app.services.risk_engine import TTR_CTR_THRESHOLD_AUD
from app.services.ttr_service import (
    build_austrac_submission_payload,
    build_industry_detail,
    generate_ttr_csv,
)

router = APIRouter()


def _get_ttr_or_404(report_id: str, org_id: str, db: Session) -> TTRReport:
    r = (
        db.query(TTRReport)
        .filter(TTRReport.id == report_id, TTRReport.org_id == org_id)
        .first()
    )
    if not r:
        raise HTTPException(404, "TTR report not found.")
    return r


def _validate_ttr(r: TTRReport) -> list[str]:
    errors = []
    if not r.transaction_date:
        errors.append("transaction_date is required")
    if not r.total_amount or r.total_amount < TTR_CTR_THRESHOLD_AUD:
        errors.append(
            f"total_amount must be >= AUD {TTR_CTR_THRESHOLD_AUD:,.0f} for a TTR"
        )
    if not r.customer_name:
        errors.append("customer_name is required")
    if not r.reporter_name:
        errors.append("reporter_name is required")
    if not r.reporter_austrac_id:
        errors.append("reporter_austrac_id is required")
    return errors


def _ttr_dict(r: TTRReport) -> dict:
    return {
        "id": r.id,
        "report_ref": r.report_ref,
        "status": r.status.value if r.status else None,
        "priority": r.priority.value if r.priority else None,
        "customer_id": r.customer_id,
        "transaction_id": r.transaction_id,
        "transaction_date": r.transaction_date,
        "total_amount": r.total_amount,
        "currency": r.currency,
        "transaction_type": r.transaction_type,
        "due_date": r.due_date,
        "prepared_by": r.prepared_by,
        "reviewed_by": r.reviewed_by,
        "approved_by": r.approved_by,
        "submitted_by": r.submitted_by,
        "submitted_at": r.submitted_at,
        "acknowledged_at": r.acknowledged_at,
        "created_at": r.created_at,
    }


# ── TTR ──────────────────────────────────────────────────────────────────────


@router.get("/ttr", response_model=list[dict])
def list_ttr(
    status: Optional[ReportStatus] = Query(None),
    customer_id: Optional[str] = Query(None),
    pagination: Pagination = Depends(),
    db: Session = Depends(get_db),
    current_user: User = Depends(require_analyst_or_above),
):
    org_id = org_id_for(current_user)
    q = db.query(TTRReport).filter(TTRReport.org_id == org_id)
    if status:
        q = q.filter(TTRReport.status == status)
    if customer_id:
        q = q.filter(TTRReport.customer_id == customer_id)
    q = q.order_by(TTRReport.created_at.desc())
    return [_ttr_dict(r) for r in pagination.apply(q).all()]


@router.post(
    "/ttr/generate-from-transaction/{txn_id}", status_code=status.HTTP_201_CREATED
)
def generate_ttr(
    txn_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_compliance_or_above),
):
    """Generate a draft TTR from a transaction >= AUD 10,000."""
    org_id = org_id_for(current_user)
    txn = (
        db.query(Transaction)
        .filter(Transaction.id == txn_id, Transaction.org_id == org_id)
        .first()
    )
    if not txn:
        raise HTTPException(404, "Transaction not found.")

    amount_aud = txn.amount_aud or txn.amount
    if amount_aud < TTR_CTR_THRESHOLD_AUD:
        raise HTTPException(
            422,
            f"Transaction amount is below the AUD {TTR_CTR_THRESHOLD_AUD:,.0f} TTR threshold.",
        )

    customer = (
        db.query(Customer)
        .filter(Customer.id == txn.customer_id, Customer.org_id == org_id)
        .first()
    )
    if not customer:
        raise HTTPException(404, "Customer not found.")

    report = generate_ttr_from_transaction(
        txn, customer, db, prepared_by=current_user.id
    )
    db.add(report)
    db.commit()
    db.refresh(report)
    _log(
        db,
        current_user,
        org_id,
        "ttr_report",
        report.id,
        action="ttr_drafted",
        after_state={"transaction_id": txn_id},
    )
    return _ttr_dict(report)


@router.post("/ttr/auto-draft/{txn_id}", status_code=status.HTTP_201_CREATED)
def auto_draft_ttr(
    txn_id: str,
    industry_type: TTRIndustryType = Query(
        ..., description="AUSTRAC industry classification: FBS | GS | ISI | MSB"
    ),
    db: Session = Depends(get_db),
    current_user: User = Depends(require_compliance_or_above),
):
    """
    Generate an industry-specific TTR draft pre-populated with AUSTRAC-format fields.
    industry_type determines which metadata schema is applied (FBS/GS/ISI/MSB).
    """
    org_id = org_id_for(current_user)
    txn = (
        db.query(Transaction)
        .filter(Transaction.id == txn_id, Transaction.org_id == org_id)
        .first()
    )
    if not txn:
        raise HTTPException(404, "Transaction not found.")

    amount_aud = txn.amount_aud or txn.amount
    if amount_aud < TTR_CTR_THRESHOLD_AUD:
        raise HTTPException(
            422,
            f"Transaction amount is below the AUD {TTR_CTR_THRESHOLD_AUD:,.0f} TTR threshold.",
        )

    customer = (
        db.query(Customer)
        .filter(Customer.id == txn.customer_id, Customer.org_id == org_id)
        .first()
    )
    if not customer:
        raise HTTPException(404, "Customer not found.")

    report = generate_ttr_from_transaction(
        txn, customer, db, prepared_by=current_user.id
    )
    report.industry_type = industry_type
    report.industry_detail = build_industry_detail(txn, customer, industry_type)
    db.add(report)
    db.commit()
    db.refresh(report)
    _log(
        db,
        current_user,
        org_id,
        "ttr_report",
        report.id,
        action="ttr_drafted",
        after_state={"transaction_id": txn_id, "industry_type": industry_type.value},
    )
    return _ttr_dict(report)


@router.get("/ttr/{report_id}/export-csv")
def export_ttr_csv(
    report_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_analyst_or_above),
):
    """
    Export an approved TTR as AUSTRAC-format CSV (CRLF line endings).
    Requires industry_type to be set on the report.
    DISCLAIMER: Review the export carefully before lodging with AUSTRAC.
    """
    r = _get_ttr_or_404(report_id, org_id_for(current_user), db)
    if not r.industry_type:
        raise HTTPException(
            422, "Report has no industry_type set. Update the report first."
        )

    csv_bytes = generate_ttr_csv(r).encode("utf-8")
    filename = f"TTR_{r.report_ref or r.id}.csv"
    return StreamingResponse(
        iter([csv_bytes]),
        media_type="text/csv",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )


@router.post("/ttr/{report_id}/submit-austrac")
def submit_ttr_austrac(
    report_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_mlro_or_above),
):
    """
    Build the AUSTRAC Connect API v2 submission payload.
    Returns the payload for review — actual HTTP submission requires a
    Data Exchange Agreement and OAuth 2.0 credentials with AUSTRAC Connect.
    DISCLAIMER: All decisions to lodge with AUSTRAC remain with the reporting entity.
    """
    r = _get_ttr_or_404(report_id, org_id_for(current_user), db)
    if r.status not in (ReportStatus.approved, ReportStatus.submitted):
        raise HTTPException(409, "Report must be approved before AUSTRAC submission.")
    if not r.industry_type:
        raise HTTPException(422, "Report has no industry_type set.")

    payload = build_austrac_submission_payload(r)
    return {
        "report_id": r.id,
        "report_ref": r.report_ref,
        "industry_type": r.industry_type.value if r.industry_type else None,
        "austrac_payload": payload,
        "disclaimer": (
            "This payload is for review only. Actual lodgement with AUSTRAC requires "
            "a valid Data Exchange Agreement and AUSTRAC Connect OAuth 2.0 credentials. "
            "All decisions to lodge remain with the reporting entity."
        ),
    }


@router.get("/ttr/{report_id}")
def get_ttr(
    report_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_analyst_or_above),
):
    return _ttr_dict(_get_ttr_or_404(report_id, org_id_for(current_user), db))


@router.patch("/ttr/{report_id}")
def update_ttr(
    report_id: str,
    payload: dict,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_compliance_or_above),
):
    org_id = org_id_for(current_user)
    r = _get_ttr_or_404(report_id, org_id, db)
    _assert_editable(r, "TTR report")
    _PROTECTED = {
        "id",
        "org_id",
        "report_ref",
        "prepared_by",
        "approved_by",
        "approved_at",
        "submitted_by",
        "submitted_at",
        "acknowledged_at",
        "created_at",
    }
    changed_fields = {k: v for k, v in payload.items() if k not in _PROTECTED}
    for k, v in changed_fields.items():
        setattr(r, k, v)
    r.updated_at = datetime.now(timezone.utc)
    db.commit()
    db.refresh(r)
    _log(
        db,
        current_user,
        org_id,
        "ttr_report",
        r.id,
        action="ttr_updated",
        after_state={k: str(v) for k, v in changed_fields.items()},
    )
    return _ttr_dict(r)


@router.post("/ttr/{report_id}/review")
def review_ttr(
    report_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_compliance_or_above),
):
    org_id = org_id_for(current_user)
    r = _get_ttr_or_404(report_id, org_id, db)
    if r.status != ReportStatus.draft:
        raise HTTPException(409, f"Report must be draft (current: {r.status.value})")
    r.status = ReportStatus.under_review
    r.reviewed_by = current_user.id
    r.updated_at = datetime.now(timezone.utc)
    db.commit()
    _log(
        db,
        current_user,
        org_id,
        "ttr_report",
        r.id,
        action="ttr_reviewed",
        after_state={"status": r.status.value},
    )
    return {"report_id": report_id, "status": r.status.value}


@router.post("/ttr/{report_id}/approve")
def approve_ttr(
    report_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_mlro_or_above),
):
    org_id = org_id_for(current_user)
    r = _get_ttr_or_404(report_id, org_id, db)
    if r.status != ReportStatus.under_review:
        raise HTTPException(
            409, f"Report must be under_review (current: {r.status.value})"
        )
    _assert_maker_checker(r, current_user.id)
    r.status = ReportStatus.approved
    r.approved_by = current_user.id
    r.approved_at = datetime.now(timezone.utc)
    r.updated_at = datetime.now(timezone.utc)
    db.commit()
    _log(
        db,
        current_user,
        org_id,
        "ttr_report",
        r.id,
        action="ttr_approved",
        after_state={"status": r.status.value},
    )
    return {"report_id": report_id, "status": r.status.value}


@router.post("/ttr/{report_id}/submit")
def submit_ttr(
    report_id: str,
    submission_reference: Optional[str] = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_mlro_or_above),
):
    r = _get_ttr_or_404(report_id, org_id_for(current_user), db)
    if r.status != ReportStatus.approved:
        raise HTTPException(409, "Report must be approved before submission.")
    errors = _validate_ttr(r)
    if errors:
        raise HTTPException(
            422,
            {
                "detail": "Validation failed — fix errors before submitting",
                "errors": errors,
            },
        )
    r.status = ReportStatus.submitted
    r.submitted_by = current_user.id
    r.submitted_at = datetime.now(timezone.utc)
    if submission_reference:
        r.submission_reference = submission_reference
    r.updated_at = datetime.now(timezone.utc)
    db.commit()

    register_submission(
        db=db,
        org_id=r.org_id,
        report_type=ReportType.ttr,
        report_id=r.id,
        report_ref=r.report_ref,
        submitted_by=current_user.id,
        austrac_submission_ref=submission_reference,
        amount_aud=r.total_amount,
    )
    audit_service.log_action(
        db,
        action="ttr_submitted",
        entity_type="ttr_report",
        entity_id=r.id,
        actor=current_user.email,
        actor_role=current_user.role.value if current_user.role else None,
        organisation_id=r.org_id,
        after_state={
            "status": r.status.value,
            "submission_reference": submission_reference,
        },
    )
    return {
        "report_id": report_id,
        "status": r.status.value,
        "disclaimer": "This record confirms submission was initiated. Confirm receipt with AUSTRAC.",
    }


@router.post("/ttr/{report_id}/acknowledge")
def acknowledge_ttr(
    report_id: str,
    acknowledgement_ref: Optional[str] = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_compliance_or_above),
):
    org_id = org_id_for(current_user)
    r = _get_ttr_or_404(report_id, org_id, db)
    if r.status != ReportStatus.submitted:
        raise HTTPException(409, "Report must be submitted.")
    r.status = ReportStatus.acknowledged
    r.acknowledged_at = datetime.now(timezone.utc)
    if acknowledgement_ref:
        r.submission_reference = acknowledgement_ref
    r.updated_at = datetime.now(timezone.utc)
    db.commit()
    _log(
        db,
        current_user,
        org_id,
        "ttr_report",
        r.id,
        action="ttr_acknowledged",
        after_state={"status": r.status.value},
    )
    return {"report_id": report_id, "status": r.status.value}


@router.post("/ttr/{report_id}/reject")
def reject_ttr(
    report_id: str,
    reason: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_mlro_or_above),
):
    """
    Reject a TTR under review. Was previously unreachable -- redraft_ttr
    guards on status == rejected, but nothing could ever set it; this is
    the missing counterpart, mirroring reject_ifti.
    """
    org_id = org_id_for(current_user)
    r = _get_ttr_or_404(report_id, org_id, db)
    r.status = ReportStatus.rejected
    r.rejected_reason = reason
    r.updated_at = datetime.now(timezone.utc)
    db.commit()
    _log(
        db,
        current_user,
        org_id,
        "ttr_report",
        r.id,
        action="ttr_rejected",
        after_state={"status": r.status.value},
        notes=reason,
    )
    return {"report_id": report_id, "status": r.status.value}


# ── Pre-submission validation ─────────────────────────────────────────────────


@router.get("/ttr/{report_id}/validate")
def validate_ttr(
    report_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_compliance_or_above),
):
    """Validate mandatory AUSTRAC fields before submission."""
    r = _get_ttr_or_404(report_id, org_id_for(current_user), db)
    errors = _validate_ttr(r)
    return {
        "report_id": report_id,
        "valid": len(errors) == 0,
        "errors": errors,
        "error_count": len(errors),
    }


# ── Rejection → re-draft ──────────────────────────────────────────────────────


@router.post("/ttr/{report_id}/redraft")
def redraft_ttr(
    report_id: str,
    reason: Optional[str] = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_compliance_or_above),
):
    """Reset a rejected TTR to draft for correction."""
    org_id = org_id_for(current_user)
    r = _get_ttr_or_404(report_id, org_id, db)
    if r.status != ReportStatus.rejected:
        raise HTTPException(
            409, f"Only rejected reports can be redrafted (current: {r.status.value})"
        )
    r.status = ReportStatus.draft
    r.rejected_reason = None
    r.approved_by = None
    r.approved_at = None
    r.submitted_by = None
    r.submitted_at = None
    r.submission_reference = None
    r.updated_at = datetime.now(timezone.utc)
    db.commit()
    _log(
        db,
        current_user,
        org_id,
        "ttr_report",
        r.id,
        action="ttr_redrafted",
        after_state={"status": r.status.value},
        notes=reason,
    )
    return {"report_id": report_id, "status": r.status.value}
