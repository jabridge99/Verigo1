"""
Reports — Suspicious Matter Report (SMR) lifecycle: generate, review,
MLRO sign-off, submit, acknowledge, reject, redraft.
Part of the reports route package; see __init__.py for the combined router.
"""

from datetime import datetime, timezone
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query, status
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
from app.models.case import Case
from app.models.customer import Customer
from app.models.report import (
    ReportStatus,
    ReportType,
    SMRDesignatedSvc,
    SMROffenceType,
    SMRReport,
    SMRSuspReason,
)
from app.models.user import User
from app.services import audit_service
from app.services.reporting_service import generate_smr_from_case, register_submission

router = APIRouter()


def _get_smr_or_404(report_id: str, org_id: str, db: Session) -> SMRReport:
    r = (
        db.query(SMRReport)
        .filter(SMRReport.id == report_id, SMRReport.org_id == org_id)
        .first()
    )
    if not r:
        raise HTTPException(404, "SMR report not found.")
    return r


def _validate_smr(r: SMRReport) -> list[str]:
    errors = []
    if not r.matter_date:
        errors.append("matter_date is required")
    if not r.suspicion_grounds or len(r.suspicion_grounds.strip()) < 10:
        errors.append("suspicion_grounds must be provided (minimum 10 characters)")
    if not r.designated_svcs:
        errors.append(
            "designated_svcs is required (at least 1 AUSTRAC service code, per SMR-2-0)"
        )
    if not r.susp_reason_codes:
        errors.append("susp_reason_codes is required (at least 1 suspicion reason)")
    if not r.offence_type:
        errors.append(
            "offence_type is required (additionalDetails.offence — MANDATORY per SMR-2-0)"
        )
    if not r.grand_total or r.grand_total <= 0:
        errors.append(
            "grand_total is required (smDetails.grandTotal — MANDATORY per SMR-2-0)"
        )
    if not r.mlro_sign_off:
        errors.append("MLRO sign-off is required before submission")
    if not r.reporter_name:
        errors.append("reporter_name is required")
    if not r.reporter_austrac_id:
        errors.append("reporter_austrac_id is required")
    return errors


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
        raise HTTPException(
            422, "MLRO must complete smr/consider on the case before generating an SMR."
        )

    customer = (
        db.query(Customer)
        .filter(Customer.id == case.customer_id, Customer.org_id == org_id)
        .first()
    )
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
    _log(
        db,
        current_user,
        org_id,
        "smr_report",
        report.id,
        action="smr_drafted",
        after_state={"case_id": case_id, "is_terrorism_related": is_terrorism_related},
    )
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
    org_id = org_id_for(current_user)
    r = _get_smr_or_404(report_id, org_id, db)
    _assert_editable(r, "SMR report")
    _PROTECTED = {
        "id",
        "org_id",
        "report_ref",
        "prepared_by",
        "mlro_sign_off",
        "mlro_signed_at",
        "submitted_by",
        "submitted_at",
        "acknowledged_at",
        "created_at",
        "updated_at",
        "is_terrorism_related",
    }
    changed_fields = {k: v for k, v in payload.items() if k not in _PROTECTED}
    for k, v in changed_fields.items():
        setattr(r, k, v)
    # Derive 24h deadline flag from offence_type — never trust the caller to set it
    r.is_terrorism_related = r.offence_type == SMROffenceType.TERRORISM.value
    r.updated_at = datetime.now(timezone.utc)
    db.commit()
    db.refresh(r)
    _log(
        db,
        current_user,
        org_id,
        "smr_report",
        r.id,
        action="smr_updated",
        after_state={k: str(v) for k, v in changed_fields.items()},
    )
    return _smr_dict(r)


@router.post("/smr/{report_id}/review")
def review_smr(
    report_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_compliance_or_above),
):
    org_id = org_id_for(current_user)
    r = _get_smr_or_404(report_id, org_id, db)
    if r.status != ReportStatus.draft:
        raise HTTPException(409, "SMR must be in draft status.")
    r.status = ReportStatus.under_review
    r.reviewed_by = current_user.id
    r.updated_at = datetime.now(timezone.utc)
    db.commit()
    _log(
        db,
        current_user,
        org_id,
        "smr_report",
        r.id,
        action="smr_reviewed",
        after_state={"status": r.status.value},
    )
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
    org_id = org_id_for(current_user)
    r = _get_smr_or_404(report_id, org_id, db)
    if r.status != ReportStatus.under_review:
        raise HTTPException(409, "SMR must be under_review for MLRO sign-off.")
    _assert_maker_checker(r, current_user.id)
    r.status = ReportStatus.approved
    r.mlro_sign_off = current_user.id
    r.mlro_signed_at = datetime.now(timezone.utc)
    r.mlro_sign_off_notes = notes
    r.updated_at = datetime.now(timezone.utc)
    db.commit()
    _log(
        db,
        current_user,
        org_id,
        "smr_report",
        r.id,
        action="smr_mlro_signed_off",
        after_state={"status": r.status.value},
        notes=notes,
    )
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
        raise HTTPException(
            409, "SMR requires MLRO sign-off (approved status) before submission."
        )
    errors = _validate_smr(r)
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
        report_type=ReportType.smr,
        report_id=r.id,
        report_ref=r.report_ref,
        submitted_by=current_user.id,
        austrac_submission_ref=submission_reference,
        amount_aud=r.total_amount,
    )
    audit_service.log_action(
        db,
        action="smr_submitted",
        entity_type="smr_report",
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
    org_id = org_id_for(current_user)
    r = _get_smr_or_404(report_id, org_id, db)
    if r.status != ReportStatus.submitted:
        raise HTTPException(409, "SMR must be submitted.")
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
        "smr_report",
        r.id,
        action="smr_acknowledged",
        after_state={"status": r.status.value},
    )
    return {"report_id": report_id, "status": r.status.value}


@router.post("/smr/{report_id}/reject")
def reject_smr(
    report_id: str,
    reason: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_mlro_or_above),
):
    """
    Reject an SMR under review or awaiting sign-off. Was previously
    unreachable -- redraft_smr guards on status == rejected, but nothing
    could ever set it; this is the missing counterpart, mirroring reject_ifti.
    """
    org_id = org_id_for(current_user)
    r = _get_smr_or_404(report_id, org_id, db)
    r.status = ReportStatus.rejected
    r.rejected_reason = reason
    r.updated_at = datetime.now(timezone.utc)
    db.commit()
    _log(
        db,
        current_user,
        org_id,
        "smr_report",
        r.id,
        action="smr_rejected",
        after_state={"status": r.status.value},
        notes=reason,
    )
    return {"report_id": report_id, "status": r.status.value}


# ── Pre-submission validation ─────────────────────────────────────────────────


@router.get("/smr/{report_id}/validate")
def validate_smr_report(
    report_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_compliance_or_above),
):
    """
    Validate all mandatory AUSTRAC SMR-2-0 fields before submission.
    Includes MLRO sign-off check. Decision to lodge remains with the reporting entity.
    """
    r = _get_smr_or_404(report_id, org_id_for(current_user), db)
    errors = _validate_smr(r)
    return {
        "report_id": report_id,
        "valid": len(errors) == 0,
        "errors": errors,
        "error_count": len(errors),
        "disclaimer": "Validation checks mandatory fields only. Decisions to lodge with AUSTRAC remain with the reporting entity.",
    }


# ── Rejection → re-draft ──────────────────────────────────────────────────────


@router.post("/smr/{report_id}/redraft")
def redraft_smr(
    report_id: str,
    reason: Optional[str] = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_compliance_or_above),
):
    """
    Reset a rejected SMR to draft for correction.
    MLRO sign-off is cleared and must be re-obtained before resubmission.
    """
    org_id = org_id_for(current_user)
    r = _get_smr_or_404(report_id, org_id, db)
    if r.status != ReportStatus.rejected:
        raise HTTPException(
            409, f"Only rejected reports can be redrafted (current: {r.status.value})"
        )
    r.status = ReportStatus.draft
    r.rejected_reason = None
    r.mlro_sign_off = None
    r.mlro_signed_at = None
    r.mlro_sign_off_notes = None
    r.submitted_by = None
    r.submitted_at = None
    r.submission_reference = None
    r.updated_at = datetime.now(timezone.utc)
    db.commit()
    _log(
        db,
        current_user,
        org_id,
        "smr_report",
        r.id,
        action="smr_redrafted",
        after_state={"status": r.status.value},
        notes=reason,
    )
    return {
        "report_id": report_id,
        "status": r.status.value,
        "note": "MLRO sign-off cleared — must be re-obtained before resubmission.",
    }
