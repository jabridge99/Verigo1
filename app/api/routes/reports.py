"""
AUSTRAC Regulatory Reporting API.

Covers IFTI, TTR, SMR reports and the immutable Filing Register.

Role permissions:
  - analyst+      : read reports, generate drafts from transactions/cases
  - compliance+   : update drafts, move to review
  - mlro+         : approve, submit, acknowledge, reject
  - Maker-checker : reviewer ≠ approver enforced on all regulatory reports

DISCLAIMER: This API provides compliance workflow tooling only.
All decisions to lodge reports with AUSTRAC remain with the reporting entity.
"""
from datetime import datetime, timezone
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query, status
from fastapi.responses import StreamingResponse
from sqlalchemy.orm import Session

from app.api.deps import (
    Pagination,
    get_current_user,
    org_id_for,
    require_analyst_or_above,
    require_compliance_or_above,
    require_mlro_or_above,
)
from app.db.database import get_db
from app.models.case import Case
from app.models.customer import Customer
from app.models.report import (
    FilingRegisterEntry,
    IFTIDirection,
    IFTIReport,
    ReportPriority,
    ReportStatus,
    ReportType,
    SMRDesignatedSvc,
    SMROffenceType,
    SMRReport,
    SMRSuspReason,
    TTRIndustryType,
    TTRReport,
)
from app.models.transaction import Transaction
from app.models.user import User
from app.services.reporting_service import (
    generate_ifti_from_transaction,
    generate_smr_from_case,
    generate_ttr_from_transaction,
    register_submission,
    reporting_summary,
)
from app.services.ttr_service import (
    build_industry_detail,
    build_austrac_submission_payload,
    generate_ttr_csv,
)

router = APIRouter(prefix="/reports", tags=["Regulatory Reports"])


# ── Helpers ──────────────────────────────────────────────────────────────────

def _get_ifti_or_404(report_id: str, org_id: str, db: Session) -> IFTIReport:
    r = db.query(IFTIReport).filter(
        IFTIReport.id == report_id, IFTIReport.org_id == org_id
    ).first()
    if not r:
        raise HTTPException(404, "IFTI report not found.")
    return r


def _get_ttr_or_404(report_id: str, org_id: str, db: Session) -> TTRReport:
    r = db.query(TTRReport).filter(
        TTRReport.id == report_id, TTRReport.org_id == org_id
    ).first()
    if not r:
        raise HTTPException(404, "TTR report not found.")
    return r


def _get_smr_or_404(report_id: str, org_id: str, db: Session) -> SMRReport:
    r = db.query(SMRReport).filter(
        SMRReport.id == report_id, SMRReport.org_id == org_id
    ).first()
    if not r:
        raise HTTPException(404, "SMR report not found.")
    return r


def _assert_editable(report, label: str):
    if report.status not in (ReportStatus.draft, ReportStatus.under_review):
        raise HTTPException(409, f"{label} cannot be edited in status: {report.status.value}")


def _assert_maker_checker(report, approver_id: str):
    if report.reviewed_by and report.reviewed_by == approver_id:
        raise HTTPException(403, "Maker-checker violation: approver cannot be the same as reviewer.")


# ── Summary / Dashboard ───────────────────────────────────────────────────────

@router.get("/summary")
def get_reporting_summary(
    db: Session = Depends(get_db),
    current_user: User = Depends(require_analyst_or_above),
):
    return reporting_summary(db, org_id_for(current_user))


# ── IFTI ─────────────────────────────────────────────────────────────────────

@router.get("/ifti", response_model=list[dict])
def list_ifti(
    direction: Optional[IFTIDirection] = Query(None),
    status: Optional[ReportStatus] = Query(None),
    customer_id: Optional[str] = Query(None),
    pagination: Pagination = Depends(),
    db: Session = Depends(get_db),
    current_user: User = Depends(require_analyst_or_above),
):
    org_id = org_id_for(current_user)
    q = db.query(IFTIReport).filter(IFTIReport.org_id == org_id)
    if direction:
        q = q.filter(IFTIReport.direction == direction)
    if status:
        q = q.filter(IFTIReport.status == status)
    if customer_id:
        q = q.filter(IFTIReport.customer_id == customer_id)
    q = q.order_by(IFTIReport.created_at.desc())
    reports = pagination.apply(q).all()
    return [_ifti_dict(r) for r in reports]


@router.post("/ifti/generate-from-transaction/{txn_id}", status_code=status.HTTP_201_CREATED)
def generate_ifti(
    txn_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_compliance_or_above),
):
    """Generate a draft IFTI report pre-populated from a cross-border transaction."""
    org_id = org_id_for(current_user)
    txn = db.query(Transaction).filter(
        Transaction.id == txn_id, Transaction.org_id == org_id
    ).first()
    if not txn:
        raise HTTPException(404, "Transaction not found.")
    if not txn.is_cross_border:
        raise HTTPException(422, "Transaction is not cross-border — IFTI may not be required.")

    customer = db.query(Customer).filter(
        Customer.id == txn.customer_id, Customer.org_id == org_id
    ).first()
    if not customer:
        raise HTTPException(404, "Customer not found.")

    report = generate_ifti_from_transaction(
        txn, customer, db, prepared_by=current_user.id
    )
    db.add(report)
    db.commit()
    db.refresh(report)
    return _ifti_dict(report)


@router.get("/ifti/{report_id}")
def get_ifti(
    report_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_analyst_or_above),
):
    return _ifti_dict(_get_ifti_or_404(report_id, org_id_for(current_user), db))


@router.patch("/ifti/{report_id}")
def update_ifti(
    report_id: str,
    payload: dict,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_compliance_or_above),
):
    org_id = org_id_for(current_user)
    r = _get_ifti_or_404(report_id, org_id, db)
    _assert_editable(r, "IFTI report")
    _PROTECTED = {"id", "org_id", "report_ref", "prepared_by", "approved_by",
                  "approved_at", "submitted_by", "submitted_at", "acknowledged_at",
                  "created_at"}
    for k, v in payload.items():
        if k not in _PROTECTED:
            setattr(r, k, v)
    r.updated_at = datetime.now(timezone.utc)
    db.commit()
    db.refresh(r)
    return _ifti_dict(r)


@router.post("/ifti/{report_id}/review")
def review_ifti(
    report_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_compliance_or_above),
):
    org_id = org_id_for(current_user)
    r = _get_ifti_or_404(report_id, org_id, db)
    if r.status != ReportStatus.draft:
        raise HTTPException(409, f"Report must be in draft status (current: {r.status.value})")
    r.status = ReportStatus.under_review
    r.reviewed_by = current_user.id
    r.updated_at = datetime.now(timezone.utc)
    db.commit()
    return {"report_id": report_id, "status": r.status.value, "reviewed_by": r.reviewed_by}


@router.post("/ifti/{report_id}/approve")
def approve_ifti(
    report_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_mlro_or_above),
):
    org_id = org_id_for(current_user)
    r = _get_ifti_or_404(report_id, org_id, db)
    if r.status != ReportStatus.under_review:
        raise HTTPException(409, f"Report must be under_review (current: {r.status.value})")
    _assert_maker_checker(r, current_user.id)
    r.status = ReportStatus.approved
    r.approved_by = current_user.id
    r.approved_at = datetime.now(timezone.utc)
    r.updated_at = datetime.now(timezone.utc)
    db.commit()
    return {"report_id": report_id, "status": r.status.value, "approved_by": r.approved_by}


@router.post("/ifti/{report_id}/submit")
def submit_ifti(
    report_id: str,
    submission_reference: Optional[str] = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_mlro_or_above),
):
    org_id = org_id_for(current_user)
    r = _get_ifti_or_404(report_id, org_id, db)
    if r.status != ReportStatus.approved:
        raise HTTPException(409, f"Report must be approved before submission (current: {r.status.value})")
    r.status = ReportStatus.submitted
    r.submitted_by = current_user.id
    r.submitted_at = datetime.now(timezone.utc)
    if submission_reference:
        r.submission_reference = submission_reference
    r.updated_at = datetime.now(timezone.utc)
    db.commit()

    register_submission(
        db=db,
        org_id=org_id,
        report_type=ReportType.ifti_incoming if r.direction == IFTIDirection.incoming else ReportType.ifti_outgoing,
        report_id=r.id,
        report_ref=r.report_ref,
        submitted_by=current_user.id,
        austrac_submission_ref=submission_reference,
        amount_aud=r.amount_aud,
    )

    return {"report_id": report_id, "status": r.status.value, "submitted_at": r.submitted_at}


@router.post("/ifti/{report_id}/acknowledge")
def acknowledge_ifti(
    report_id: str,
    acknowledgement_ref: Optional[str] = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_compliance_or_above),
):
    org_id = org_id_for(current_user)
    r = _get_ifti_or_404(report_id, org_id, db)
    if r.status != ReportStatus.submitted:
        raise HTTPException(409, f"Report must be submitted (current: {r.status.value})")
    r.status = ReportStatus.acknowledged
    r.acknowledged_at = datetime.now(timezone.utc)
    if acknowledgement_ref:
        r.submission_reference = acknowledgement_ref
    r.updated_at = datetime.now(timezone.utc)
    db.commit()
    return {"report_id": report_id, "status": r.status.value}


@router.post("/ifti/{report_id}/reject")
def reject_ifti(
    report_id: str,
    reason: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_mlro_or_above),
):
    org_id = org_id_for(current_user)
    r = _get_ifti_or_404(report_id, org_id, db)
    r.status = ReportStatus.rejected
    r.rejected_reason = reason
    r.updated_at = datetime.now(timezone.utc)
    db.commit()
    return {"report_id": report_id, "status": r.status.value}


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


@router.post("/ttr/generate-from-transaction/{txn_id}", status_code=status.HTTP_201_CREATED)
def generate_ttr(
    txn_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_compliance_or_above),
):
    """Generate a draft TTR from a transaction >= AUD 10,000."""
    org_id = org_id_for(current_user)
    txn = db.query(Transaction).filter(
        Transaction.id == txn_id, Transaction.org_id == org_id
    ).first()
    if not txn:
        raise HTTPException(404, "Transaction not found.")

    amount_aud = txn.amount_aud or txn.amount
    if amount_aud < 10_000:
        raise HTTPException(422, "Transaction amount is below the AUD 10,000 TTR threshold.")

    customer = db.query(Customer).filter(
        Customer.id == txn.customer_id, Customer.org_id == org_id
    ).first()
    if not customer:
        raise HTTPException(404, "Customer not found.")

    report = generate_ttr_from_transaction(txn, customer, db, prepared_by=current_user.id)
    db.add(report)
    db.commit()
    db.refresh(report)
    return _ttr_dict(report)


@router.post("/ttr/auto-draft/{txn_id}", status_code=status.HTTP_201_CREATED)
def auto_draft_ttr(
    txn_id: str,
    industry_type: TTRIndustryType = Query(..., description="AUSTRAC industry classification: FBS | GS | ISI | MSB"),
    db: Session = Depends(get_db),
    current_user: User = Depends(require_compliance_or_above),
):
    """
    Generate an industry-specific TTR draft pre-populated with AUSTRAC-format fields.
    industry_type determines which metadata schema is applied (FBS/GS/ISI/MSB).
    """
    org_id = org_id_for(current_user)
    txn = db.query(Transaction).filter(
        Transaction.id == txn_id, Transaction.org_id == org_id
    ).first()
    if not txn:
        raise HTTPException(404, "Transaction not found.")

    amount_aud = txn.amount_aud or txn.amount
    if amount_aud < 10_000:
        raise HTTPException(422, "Transaction amount is below the AUD 10,000 TTR threshold.")

    customer = db.query(Customer).filter(
        Customer.id == txn.customer_id, Customer.org_id == org_id
    ).first()
    if not customer:
        raise HTTPException(404, "Customer not found.")

    report = generate_ttr_from_transaction(txn, customer, db, prepared_by=current_user.id)
    report.industry_type = industry_type
    report.industry_detail = build_industry_detail(txn, customer, industry_type)
    db.add(report)
    db.commit()
    db.refresh(report)
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
        raise HTTPException(422, "Report has no industry_type set. Update the report first.")

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
    r = _get_ttr_or_404(report_id, org_id_for(current_user), db)
    _assert_editable(r, "TTR report")
    _PROTECTED = {"id", "org_id", "report_ref", "prepared_by", "approved_by",
                  "approved_at", "submitted_by", "submitted_at", "acknowledged_at", "created_at"}
    for k, v in payload.items():
        if k not in _PROTECTED:
            setattr(r, k, v)
    r.updated_at = datetime.now(timezone.utc)
    db.commit()
    db.refresh(r)
    return _ttr_dict(r)


@router.post("/ttr/{report_id}/review")
def review_ttr(
    report_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_compliance_or_above),
):
    r = _get_ttr_or_404(report_id, org_id_for(current_user), db)
    if r.status != ReportStatus.draft:
        raise HTTPException(409, f"Report must be draft (current: {r.status.value})")
    r.status = ReportStatus.under_review
    r.reviewed_by = current_user.id
    r.updated_at = datetime.now(timezone.utc)
    db.commit()
    return {"report_id": report_id, "status": r.status.value}


@router.post("/ttr/{report_id}/approve")
def approve_ttr(
    report_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_mlro_or_above),
):
    r = _get_ttr_or_404(report_id, org_id_for(current_user), db)
    if r.status != ReportStatus.under_review:
        raise HTTPException(409, f"Report must be under_review (current: {r.status.value})")
    _assert_maker_checker(r, current_user.id)
    r.status = ReportStatus.approved
    r.approved_by = current_user.id
    r.approved_at = datetime.now(timezone.utc)
    r.updated_at = datetime.now(timezone.utc)
    db.commit()
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
    return {"report_id": report_id, "status": r.status.value}


@router.post("/ttr/{report_id}/acknowledge")
def acknowledge_ttr(
    report_id: str,
    acknowledgement_ref: Optional[str] = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_compliance_or_above),
):
    r = _get_ttr_or_404(report_id, org_id_for(current_user), db)
    if r.status != ReportStatus.submitted:
        raise HTTPException(409, "Report must be submitted.")
    r.status = ReportStatus.acknowledged
    r.acknowledged_at = datetime.now(timezone.utc)
    if acknowledgement_ref:
        r.submission_reference = acknowledgement_ref
    r.updated_at = datetime.now(timezone.utc)
    db.commit()
    return {"report_id": report_id, "status": r.status.value}


# ── SMR ──────────────────────────────────────────────────────────────────────

# IMPORTANT: /smr/enums MUST be registered before /smr/{report_id} — FastAPI matches
# routes in declaration order and "enums" would otherwise be treated as a report_id.
@router.get("/smr/enums")
def smr_enums():
    """Return valid enum values for SMR designated service codes, suspicion reasons, and offence types."""
    return {
        "designated_svcs": [e.value for e in SMRDesignatedSvc],
        "susp_reason_codes": [e.value for e in SMRSuspReason],
        "offence_types": [e.value for e in SMROffenceType],
    }


@router.get("/smr", response_model=list[dict])
def list_smr(
    status: Optional[ReportStatus] = Query(None),
    customer_id: Optional[str] = Query(None),
    is_terrorism_related: Optional[bool] = Query(None),
    pagination: Pagination = Depends(),
    db: Session = Depends(get_db),
    current_user: User = Depends(require_analyst_or_above),
):
    org_id = org_id_for(current_user)
    q = db.query(SMRReport).filter(SMRReport.org_id == org_id)
    if status:
        q = q.filter(SMRReport.status == status)
    if customer_id:
        q = q.filter(SMRReport.customer_id == customer_id)
    if is_terrorism_related is not None:
        q = q.filter(SMRReport.is_terrorism_related == is_terrorism_related)
    q = q.order_by(SMRReport.created_at.desc())
    return [_smr_dict(r) for r in pagination.apply(q).all()]


@router.post("/smr/generate-from-case/{case_id}", status_code=status.HTTP_201_CREATED)
def generate_smr(
    case_id: str,
    suspicion_grounds: str,
    is_terrorism_related: bool = False,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_mlro_or_above),
):
    """
    Generate a draft SMR pre-populated from a case.
    Suspicion grounds must be supplied by the MLRO — never auto-populated.

    DISCLAIMER: The decision to lodge an SMR remains with the reporting entity.
    """
    org_id = org_id_for(current_user)
    case = db.query(Case).filter(Case.id == case_id, Case.org_id == org_id).first()
    if not case:
        raise HTTPException(404, "Case not found.")
    if not case.is_smr_candidate:
        raise HTTPException(422, "Case has not been flagged as an SMR candidate.")
    if not case.smr_considered:
        raise HTTPException(422, "MLRO must complete smr/consider on the case before generating an SMR.")

    customer = db.query(Customer).filter(
        Customer.id == case.customer_id, Customer.org_id == org_id
    ).first()
    if not customer:
        raise HTTPException(404, "Customer not found.")

    report = generate_smr_from_case(
        case=case,
        customer=customer,
        db=db,
        prepared_by=current_user.id,
        suspicion_grounds=suspicion_grounds,
        is_terrorism_related=is_terrorism_related,
    )
    db.add(report)
    db.commit()
    db.refresh(report)
    return _smr_dict(report)


@router.get("/smr/{report_id}")
def get_smr(
    report_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_analyst_or_above),
):
    return _smr_dict(_get_smr_or_404(report_id, org_id_for(current_user), db))


@router.patch("/smr/{report_id}")
def update_smr(
    report_id: str,
    payload: dict,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_compliance_or_above),
):
    """Only draft/under_review SMRs can be edited. All SMR fields require explicit human action."""
    r = _get_smr_or_404(report_id, org_id_for(current_user), db)
    _assert_editable(r, "SMR report")
    _PROTECTED = {"id", "org_id", "report_ref", "prepared_by", "mlro_sign_off",
                  "mlro_signed_at", "submitted_by", "submitted_at", "acknowledged_at",
                  "created_at", "updated_at", "is_terrorism_related"}
    for k, v in payload.items():
        if k not in _PROTECTED:
            setattr(r, k, v)
    # Derive 24h deadline flag from offence_type — never trust the caller to set it
    r.is_terrorism_related = (r.offence_type == SMROffenceType.TERRORISM.value)
    r.updated_at = datetime.now(timezone.utc)
    db.commit()
    db.refresh(r)
    return _smr_dict(r)


@router.post("/smr/{report_id}/review")
def review_smr(
    report_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_compliance_or_above),
):
    r = _get_smr_or_404(report_id, org_id_for(current_user), db)
    if r.status != ReportStatus.draft:
        raise HTTPException(409, "SMR must be in draft status.")
    r.status = ReportStatus.under_review
    r.reviewed_by = current_user.id
    r.updated_at = datetime.now(timezone.utc)
    db.commit()
    return {"report_id": report_id, "status": r.status.value}


@router.post("/smr/{report_id}/mlro-sign-off")
def mlro_sign_off_smr(
    report_id: str,
    notes: Optional[str] = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_mlro_or_above),
):
    """
    MLRO sign-off — required before SMR submission.
    Enforces maker-checker: MLRO cannot sign off if they also reviewed the report.
    """
    r = _get_smr_or_404(report_id, org_id_for(current_user), db)
    if r.status != ReportStatus.under_review:
        raise HTTPException(409, "SMR must be under_review for MLRO sign-off.")
    _assert_maker_checker(r, current_user.id)
    r.status = ReportStatus.approved
    r.mlro_sign_off = current_user.id
    r.mlro_signed_at = datetime.now(timezone.utc)
    r.mlro_sign_off_notes = notes
    r.approved_by = current_user.id
    r.approved_at = datetime.now(timezone.utc)
    r.updated_at = datetime.now(timezone.utc)
    db.commit()
    return {
        "report_id": report_id,
        "status": r.status.value,
        "mlro_sign_off": r.mlro_sign_off,
        "disclaimer": "MLRO sign-off confirms this draft has been reviewed. The decision to lodge remains with the reporting entity.",
    }


@router.post("/smr/{report_id}/submit")
def submit_smr(
    report_id: str,
    submission_reference: Optional[str] = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_mlro_or_above),
):
    r = _get_smr_or_404(report_id, org_id_for(current_user), db)
    if r.status != ReportStatus.approved:
        raise HTTPException(409, "SMR requires MLRO sign-off (approved status) before submission.")
    if not r.mlro_sign_off:
        raise HTTPException(422, "MLRO sign-off is required before submission.")
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
        report_type=ReportType.smr,
        report_id=r.id,
        report_ref=r.report_ref,
        submitted_by=current_user.id,
        austrac_submission_ref=submission_reference,
        amount_aud=r.total_amount,
    )
    return {
        "report_id": report_id,
        "status": r.status.value,
        "submitted_at": r.submitted_at,
        "disclaimer": "This record confirms submission was initiated. Confirm receipt with AUSTRAC.",
    }


@router.post("/smr/{report_id}/acknowledge")
def acknowledge_smr(
    report_id: str,
    acknowledgement_ref: Optional[str] = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_compliance_or_above),
):
    r = _get_smr_or_404(report_id, org_id_for(current_user), db)
    if r.status != ReportStatus.submitted:
        raise HTTPException(409, "SMR must be submitted.")
    r.status = ReportStatus.acknowledged
    r.acknowledged_at = datetime.now(timezone.utc)
    if acknowledgement_ref:
        r.submission_reference = acknowledgement_ref
    r.updated_at = datetime.now(timezone.utc)
    db.commit()
    return {"report_id": report_id, "status": r.status.value}


# ── Filing Register ───────────────────────────────────────────────────────────

@router.get("/filing-register")
def list_filing_register(
    report_type: Optional[ReportType] = Query(None),
    pagination: Pagination = Depends(),
    db: Session = Depends(get_db),
    current_user: User = Depends(require_analyst_or_above),
):
    org_id = org_id_for(current_user)
    q = db.query(FilingRegisterEntry).filter(FilingRegisterEntry.org_id == org_id)
    if report_type:
        q = q.filter(FilingRegisterEntry.report_type == report_type)
    q = q.order_by(FilingRegisterEntry.submitted_at.desc())
    entries = pagination.apply(q).all()
    return [_filing_dict(e) for e in entries]


@router.get("/filing-register/{entry_id}")
def get_filing_entry(
    entry_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_analyst_or_above),
):
    org_id = org_id_for(current_user)
    e = db.query(FilingRegisterEntry).filter(
        FilingRegisterEntry.id == entry_id, FilingRegisterEntry.org_id == org_id
    ).first()
    if not e:
        raise HTTPException(404, "Filing register entry not found.")
    return _filing_dict(e)


# ── Serialisers ───────────────────────────────────────────────────────────────

def _ifti_dict(r: IFTIReport) -> dict:
    return {
        "id": r.id,
        "report_ref": r.report_ref,
        "direction": r.direction.value if r.direction else None,
        "status": r.status.value if r.status else None,
        "priority": r.priority.value if r.priority else None,
        "customer_id": r.customer_id,
        "transaction_id": r.transaction_id,
        "date_received": r.date_received,
        "total_amount": r.total_amount,
        "currency": r.currency,
        "amount_aud": r.amount_aud,
        "due_date": r.due_date,
        "prepared_by": r.prepared_by,
        "reviewed_by": r.reviewed_by,
        "approved_by": r.approved_by,
        "submitted_by": r.submitted_by,
        "submitted_at": r.submitted_at,
        "submission_reference": r.submission_reference,
        "acknowledged_at": r.acknowledged_at,
        "created_at": r.created_at,
    }


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


def _smr_dict(r: SMRReport) -> dict:
    return {
        "id": r.id,
        "report_ref": r.report_ref,
        "re_report_ref": r.re_report_ref,
        "status": r.status.value if r.status else None,
        "priority": r.priority.value if r.priority else None,
        "customer_id": r.customer_id,
        "case_id": r.case_id,
        # <header>
        "intercept_flag": r.intercept_flag,
        "reporting_branch_id": r.reporting_branch_id,
        "reporting_branch_name": r.reporting_branch_name,
        # <smDetails>
        "designated_svcs": r.designated_svcs,
        "designated_svc_provided": r.designated_svc_provided,
        "designated_svc_requested": r.designated_svc_requested,
        "designated_svc_enquiry": r.designated_svc_enquiry,
        "susp_reason_codes": r.susp_reason_codes,
        "grand_total": r.grand_total,
        "grand_total_currency": r.grand_total_currency,
        # <suspGrounds>
        "matter_date": r.matter_date,
        "suspicion_grounds": r.suspicion_grounds,
        # <suspPerson> (primary)
        "subject_name": r.subject_name,
        "subject_dob": r.subject_dob,
        "subject_address": r.subject_address,
        "subject_city": r.subject_city,
        "subject_state": r.subject_state,
        "subject_postcode": r.subject_postcode,
        "subject_country": r.subject_country,
        "subject_email": r.subject_email,
        "subject_occupation": r.subject_occupation,
        "subject_abn": r.subject_abn,
        "subject_acn": r.subject_acn,
        "subject_arbn": r.subject_arbn,
        "subject_id_type": r.subject_id_type,
        "subject_id_number": r.subject_id_number,
        "subject_id_issue_date": r.subject_id_issue_date,
        "subject_id_expiry_date": r.subject_id_expiry_date,
        "subject_id_issuer": r.subject_id_issuer,
        "subject_electronic_source": r.subject_electronic_source,
        "subject_device_identifier": r.subject_device_identifier,
        "subject_business_name": r.subject_business_name,
        "subject_business_struct": r.subject_business_struct,
        "subject_business_ben_name": r.subject_business_ben_name,
        "subject_business_holder_name": r.subject_business_holder_name,
        "subject_incorp_country": r.subject_incorp_country,
        "subject_citizen_countries": r.subject_citizen_countries,
        "subject_digital_currency_wallets": r.subject_digital_currency_wallets,
        "subject_account_number": r.subject_account_number,
        "subject_account_bsb": r.subject_account_bsb,
        "subject_account_name": r.subject_account_name,
        "subject_account_institution": r.subject_account_institution,
        "subject_is_customer": r.subject_is_customer,
        # Additional persons
        "susp_persons": r.susp_persons,
        "other_persons": r.other_persons,
        "unident_persons": r.unident_persons,
        # <txnDetail>
        "txn_details": r.txn_details,
        "transaction_ids": r.transaction_ids,
        "total_amount": r.total_amount,
        "currency": r.currency,
        # <additionalDetails>
        "offence_type": r.offence_type,
        "is_terrorism_related": r.is_terrorism_related,
        "prev_reported_refs": r.prev_reported_refs,
        "other_aus_gov_reports": r.other_aus_gov_reports,
        # Narrative
        "narrative": r.narrative,
        "evidence_summary": r.evidence_summary,
        "related_smr_refs": r.related_smr_refs,
        "supporting_documents": r.supporting_documents,
        # Workflow
        "due_date": r.due_date,
        "reporter_name": r.reporter_name,
        "reporter_abn": r.reporter_abn,
        "reporter_austrac_id": r.reporter_austrac_id,
        "mlro_sign_off": r.mlro_sign_off,
        "mlro_signed_at": r.mlro_signed_at,
        "mlro_sign_off_notes": r.mlro_sign_off_notes,
        "prepared_by": r.prepared_by,
        "reviewed_by": r.reviewed_by,
        "submitted_by": r.submitted_by,
        "submitted_at": r.submitted_at,
        "submission_reference": r.submission_reference,
        "acknowledged_at": r.acknowledged_at,
        "rejected_reason": r.rejected_reason,
        "created_at": r.created_at,
        "updated_at": r.updated_at,
        "disclaimer": "DISCLAIMER: The decision to lodge an SMR remains entirely with the reporting entity.",
    }


def _filing_dict(e: FilingRegisterEntry) -> dict:
    return {
        "id": e.id,
        "report_type": e.report_type.value if e.report_type else None,
        "report_ref": e.report_ref,
        "report_id": e.report_id,
        "austrac_submission_ref": e.austrac_submission_ref,
        "submitted_by": e.submitted_by,
        "submitted_at": e.submitted_at,
        "status": e.status,
        "acknowledgement_ref": e.acknowledgement_ref,
        "acknowledgement_at": e.acknowledgement_at,
        "amount_aud": e.amount_aud,
        "notes": e.notes,
        "supersedes_id": e.supersedes_id,
        "created_at": e.created_at,
    }
