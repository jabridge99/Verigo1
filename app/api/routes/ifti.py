"""
IFTI-DRA Report API.

The canonical IFTI backend (see PARKING_LOT.md P28 for the retired
alternatives): the user-facing workflow this app actually needs to support
is filling AUSTRAC's official IFTI-DRA Excel template and lodging it
manually via AUSTRAC Online -- generate_ifti_excel() in ifti_service.py
produces that template exactly. This file supplies the maker-checker
workflow and audit trail around it (previously only app/api/routes/reports.py
had that, on a model with no Excel export at all).

Supports:
- Creating IFTI-IN and IFTI-OUT records manually or from a cross-border transaction
- Listing/editing draft records
- Maker-checker workflow: draft -> under_review -> approved -> submitted ->
  acknowledged, with reject -> redraft as a side path (reviewer != approver
  enforced on approval)
- Generating AUSTRAC-compatible Excel file (download) for lodgement
- Every mutating action written to the audit trail (entity_type "ifti_record")

All endpoints require authentication. Generation requires compliance+ role;
approve/submit/reject require mlro+.
"""

import uuid
from datetime import date as _date_type
from datetime import datetime, timezone
from io import BytesIO
from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from fastapi.responses import StreamingResponse
from pydantic import BaseModel, field_serializer
from sqlalchemy.orm import Session

from app.api.routes.auth import _require_roles
from app.db.database import get_db
from app.models.customer import Customer
from app.models.ifti import IFTIDirection, IFTIRecord, IFTIStatus
from app.models.report import ReportType
from app.models.transaction import Transaction
from app.models.user import User, UserRole
from app.services import audit_service
from app.services.ifti_service import (
    generate_ifti_excel,
    generate_ifti_from_transaction,
    get_ifti,
    list_ifti,
)
from app.services.reporting_service import register_submission

router = APIRouter(prefix="/ifti", tags=["IFTI Reports"])

_READER = _require_roles(
    UserRole.admin, UserRole.mlro, UserRole.compliance, UserRole.analyst
)
_WRITER = _require_roles(UserRole.admin, UserRole.mlro, UserRole.compliance)
_APPROVER = _require_roles(UserRole.admin, UserRole.mlro)


def _log(
    db: Session,
    current_user: User,
    org_id: Optional[str],
    entity_id: str,
    action: str,
    after_state: Optional[dict] = None,
    notes: Optional[str] = None,
) -> None:
    """
    IFTI-DRA audit trail, same convention as cases.py/reports.py's _log():
    every draft/review/approve/submit/acknowledge/reject/redraft action is
    written to entity_type "ifti_record", queryable via GET /audit/.
    """
    audit_service.log_action(
        db,
        action=action,
        entity_type="ifti_record",
        entity_id=entity_id,
        actor=current_user.email,
        actor_role=current_user.role.value if current_user.role else None,
        organisation_id=org_id,
        after_state=after_state,
        notes=notes,
    )


def _assert_maker_checker(record: IFTIRecord, approver_id: str) -> None:
    if record.reviewed_by and record.reviewed_by == approver_id:
        raise HTTPException(
            403, "Maker-checker violation: approver cannot be the same as reviewer."
        )


def _validate_ifti_record(r: IFTIRecord) -> List[str]:
    errors = []
    if not r.date_received:
        errors.append("date_received is required")
    if not r.date_available:
        errors.append("date_available is required")
    if not r.total_amount or r.total_amount <= 0:
        errors.append("total_amount must be > 0")
    if not r.currency_code:
        errors.append("currency_code is required")
    if not r.direction:
        errors.append("direction (incoming/outgoing) is required")
    if not r.reporter_full_name:
        errors.append("reporter_full_name is required")
    if not r.reporter_austrac_id:
        errors.append(
            "reporter_austrac_id is required (your AUSTRAC reporting entity ID)"
        )
    return errors


# ── Pydantic schemas ──────────────────────────────────────────────────────────


class IFTICreate(BaseModel):
    direction: IFTIDirection
    date_received: str  # DD/MM/YYYY
    date_available: str  # DD/MM/YYYY
    currency_code: str = "AUD"
    total_amount: float
    transfer_type: str = "Money"
    property_description: Optional[str] = None
    transaction_reference: Optional[str] = None

    # Ordering customer
    oc_full_name: Optional[str] = None
    oc_other_name: Optional[str] = None
    oc_dob: Optional[str] = None  # DD/MM/YYYY
    oc_address: Optional[str] = None
    oc_city: Optional[str] = None
    oc_state: Optional[str] = None
    oc_postcode: Optional[str] = None
    oc_country: Optional[str] = None
    oc_postal_address: Optional[str] = None
    oc_postal_city: Optional[str] = None
    oc_postal_state: Optional[str] = None
    oc_postal_postcode: Optional[str] = None
    oc_postal_country: Optional[str] = None
    oc_phone: Optional[str] = None
    oc_email: Optional[str] = None
    oc_occupation: Optional[str] = None
    oc_abn: Optional[str] = None
    oc_acn: Optional[str] = None
    oc_arbn: Optional[str] = None
    oc_customer_number: Optional[str] = None
    oc_account_number: Optional[str] = None
    oc_business_structure: Optional[str] = None
    # ID (OUT only)
    oc_id1_type: Optional[str] = None
    oc_id1_type_other: Optional[str] = None
    oc_id1_number: Optional[str] = None
    oc_id1_issuer: Optional[str] = None
    oc_id2_type: Optional[str] = None
    oc_id2_type_other: Optional[str] = None
    oc_id2_number: Optional[str] = None
    oc_id2_issuer: Optional[str] = None
    oc_electronic_source: Optional[str] = None

    # Beneficiary customer
    bc_full_name: Optional[str] = None
    bc_dob: Optional[str] = None
    bc_business_name: Optional[str] = None
    bc_address: Optional[str] = None
    bc_city: Optional[str] = None
    bc_state: Optional[str] = None
    bc_postcode: Optional[str] = None
    bc_country: Optional[str] = None
    bc_postal_address: Optional[str] = None
    bc_postal_city: Optional[str] = None
    bc_postal_state: Optional[str] = None
    bc_postal_postcode: Optional[str] = None
    bc_postal_country: Optional[str] = None
    bc_phone: Optional[str] = None
    bc_email: Optional[str] = None
    bc_occupation: Optional[str] = None
    bc_abn: Optional[str] = None
    bc_acn: Optional[str] = None
    bc_arbn: Optional[str] = None
    bc_business_structure: Optional[str] = None
    bc_account_number: Optional[str] = None
    bc_institution_name: Optional[str] = None  # InstitutionWithAccount.name (MANDATORY)
    bc_institution_city: Optional[str] = None  # InstitutionWithAccount.city (MANDATORY)
    bc_institution_country: Optional[str] = None

    # Accept block
    retail_id_number: Optional[str] = None
    accept_full_name: Optional[str] = None
    accept_other_name: Optional[str] = None
    accept_dob: Optional[str] = None
    accept_address: Optional[str] = None
    accept_city: Optional[str] = None
    accept_state: Optional[str] = None
    accept_postcode: Optional[str] = None
    accept_country: Optional[str] = None
    accept_postal_address: Optional[str] = None
    accept_postal_city: Optional[str] = None
    accept_postal_state: Optional[str] = None
    accept_postal_postcode: Optional[str] = None
    accept_postal_country: Optional[str] = None
    accept_phone: Optional[str] = None
    accept_email: Optional[str] = None
    accept_occupation: Optional[str] = None
    accept_abn: Optional[str] = None
    accept_acn: Optional[str] = None
    # orderingInstn.foreignBased — MANDATORY per IFTI-DRA-1-2 schema
    # "Yes" if ordering institution is foreign-based, "No" if Australian
    accept_foreign_based: Optional[str] = "No"
    accept_business_structure: Optional[str] = None
    is_accepting_money: Optional[str] = "Yes"
    is_sending_instruction: Optional[str] = "Yes"

    diff_accept_full_name: Optional[str] = None
    diff_accept_address: Optional[str] = None
    diff_accept_city: Optional[str] = None
    diff_accept_state: Optional[str] = None
    diff_accept_postcode: Optional[str] = None
    diff_accept_country: Optional[str] = None

    # Send block
    send_full_name: Optional[str] = None
    send_other_name: Optional[str] = None
    send_dob: Optional[str] = None
    send_address: Optional[str] = None
    send_city: Optional[str] = None
    send_state: Optional[str] = None
    send_postcode: Optional[str] = None
    send_country: Optional[str] = None
    send_postal_address: Optional[str] = None
    send_postal_city: Optional[str] = None
    send_postal_state: Optional[str] = None
    send_postal_postcode: Optional[str] = None
    send_postal_country: Optional[str] = None
    send_phone: Optional[str] = None
    send_email: Optional[str] = None
    send_occupation: Optional[str] = None
    send_abn: Optional[str] = None
    send_acn: Optional[str] = None
    send_arbn: Optional[str] = None
    send_business_structure: Optional[str] = None

    # Receive block
    recv_full_name: Optional[str] = None
    recv_address: Optional[str] = None
    recv_city: Optional[str] = None
    recv_state: Optional[str] = None
    recv_postcode: Optional[str] = None
    recv_country: Optional[str] = None
    is_distributing: Optional[str] = "Yes"
    has_retail_outlet: Optional[str] = "No"

    # Distribute block
    dist_full_name: Optional[str] = None
    dist_address: Optional[str] = None
    dist_city: Optional[str] = None
    dist_state: Optional[str] = None
    dist_postcode: Optional[str] = None
    dist_country: Optional[str] = None

    # Retail outlet
    retail_full_name: Optional[str] = None
    retail_address: Optional[str] = None
    retail_city: Optional[str] = None
    retail_state: Optional[str] = None
    retail_postcode: Optional[str] = None
    retail_country: Optional[str] = None

    # initiatingInstn (optional intermediate institution — IFTI-DRA section 7.6)
    init_instn_same_as_ordering: Optional[str] = None  # Yes | No
    init_instn_full_name: Optional[str] = None
    init_instn_address: Optional[str] = None
    init_instn_city: Optional[str] = None
    init_instn_country: Optional[str] = None

    # Reason + reporter
    reason_for_transfer: Optional[str] = None
    reporter_full_name: Optional[str] = None
    reporter_job_title: Optional[str] = None
    reporter_phone: Optional[str] = None
    reporter_email: Optional[str] = None
    reporter_austrac_id: Optional[str] = None


class IFTIResponse(BaseModel):
    ifti_id: str
    direction: IFTIDirection
    status: IFTIStatus
    date_received: Optional[_date_type] = None
    date_available: Optional[_date_type] = None
    currency_code: Optional[str] = None
    total_amount: Optional[float] = None
    transfer_type: Optional[str] = None
    transaction_reference: Optional[str] = None
    oc_full_name: Optional[str] = None
    bc_full_name: Optional[str] = None
    reason_for_transfer: Optional[str] = None
    reporter_full_name: Optional[str] = None
    reporter_email: Optional[str] = None
    reporter_austrac_id: Optional[str] = None
    industry_id: Optional[str] = None
    created_by: Optional[str] = None
    reviewed_by: Optional[str] = None
    approved_by: Optional[str] = None
    approved_at: Optional[datetime] = None
    rejected_reason: Optional[str] = None
    submission_reference: Optional[str] = None
    submitted_at: Optional[datetime] = None
    acknowledged_at: Optional[datetime] = None
    due_date: Optional[_date_type] = None
    created_at: Optional[datetime] = None

    model_config = {"from_attributes": True}

    @field_serializer("date_received", "date_available")
    def _fmt_date(self, v: Optional[_date_type]) -> Optional[str]:
        return v.strftime("%d/%m/%Y") if v else None


def _parse_date(val: Optional[str]):
    if not val:
        return None
    for fmt in ("%d/%m/%Y", "%Y-%m-%d", "%d-%m-%Y"):
        try:
            return datetime.strptime(val, fmt).date()
        except ValueError:
            pass
    return None


def _apply_fields(record: IFTIRecord, data: IFTICreate):
    for field, value in data.model_dump(exclude={"direction"}).items():
        if field in (
            "date_received",
            "date_available",
            "oc_dob",
            "bc_dob",
            "accept_dob",
            "send_dob",
        ):
            setattr(record, field, _parse_date(value))
        else:
            setattr(record, field, value)


# ── Endpoints ─────────────────────────────────────────────────────────────────


@router.get("/", response_model=List[IFTIResponse])
def list_records(
    direction: Optional[IFTIDirection] = None,
    status: Optional[IFTIStatus] = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(_READER),
):
    industry_id = None if current_user.is_super_admin else current_user.org_id
    return list_ifti(db, industry_id=industry_id, direction=direction, status=status)


@router.post("/", response_model=IFTIResponse, status_code=201)
def create_record(
    payload: IFTICreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(_WRITER),
):
    record = IFTIRecord(
        ifti_id=f"IFTI-{uuid.uuid4().hex[:12].upper()}",
        industry_id=current_user.org_id,
        direction=payload.direction,
        created_by=current_user.id,
    )
    _apply_fields(record, payload)
    db.add(record)
    db.commit()
    db.refresh(record)
    _log(
        db,
        current_user,
        current_user.org_id,
        record.ifti_id,
        action="ifti_drafted",
        after_state={"direction": record.direction.value},
    )
    return record


@router.post(
    "/generate-from-transaction/{txn_id}",
    response_model=IFTIResponse,
    status_code=201,
)
def generate_record(
    txn_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(_WRITER),
):
    """Generate a draft IFTI-DRA record pre-populated from a cross-border transaction."""
    org_id = current_user.org_id
    txn = (
        db.query(Transaction)
        .filter(Transaction.id == txn_id, Transaction.org_id == org_id)
        .first()
    )
    if not txn:
        raise HTTPException(404, "Transaction not found.")
    if not txn.is_cross_border:
        raise HTTPException(
            422, "Transaction is not cross-border — IFTI may not be required."
        )
    customer = (
        db.query(Customer)
        .filter(Customer.id == txn.customer_id, Customer.org_id == org_id)
        .first()
    )
    if not customer:
        raise HTTPException(404, "Customer not found.")

    record = generate_ifti_from_transaction(txn, customer, created_by=current_user.id)
    db.add(record)
    db.commit()
    db.refresh(record)
    _log(
        db,
        current_user,
        org_id,
        record.ifti_id,
        action="ifti_drafted",
        after_state={"transaction_id": txn_id, "direction": record.direction.value},
    )
    return record


@router.get("/{ifti_id}", response_model=IFTIResponse)
def get_record(
    ifti_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(_READER),
):
    r = get_ifti(db, ifti_id)
    if not r:
        raise HTTPException(404, "IFTI record not found")
    if not current_user.is_super_admin and r.industry_id != current_user.org_id:
        raise HTTPException(403, "Access denied")
    return r


@router.patch("/{ifti_id}", response_model=IFTIResponse)
def update_record(
    ifti_id: str,
    payload: IFTICreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(_WRITER),
):
    r = get_ifti(db, ifti_id)
    if not r:
        raise HTTPException(404, "IFTI record not found")
    if not current_user.is_super_admin and r.industry_id != current_user.org_id:
        raise HTTPException(403, "Access denied")
    if r.status not in (IFTIStatus.draft, IFTIStatus.under_review):
        raise HTTPException(
            400, f"Cannot edit an IFTI record in status: {r.status.value}"
        )
    _apply_fields(r, payload)
    db.commit()
    db.refresh(r)
    _log(
        db,
        current_user,
        r.industry_id,
        r.ifti_id,
        action="ifti_updated",
    )
    return r


@router.post("/{ifti_id}/review", response_model=IFTIResponse)
def review_record(
    ifti_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(_WRITER),
):
    r = get_ifti(db, ifti_id)
    if not r:
        raise HTTPException(404, "IFTI record not found")
    if not current_user.is_super_admin and r.industry_id != current_user.org_id:
        raise HTTPException(403, "Access denied")
    if r.status != IFTIStatus.draft:
        raise HTTPException(
            409, f"Record must be in draft status (current: {r.status.value})"
        )
    r.status = IFTIStatus.under_review
    r.reviewed_by = current_user.id
    r.updated_at = datetime.now(timezone.utc)
    db.commit()
    db.refresh(r)
    _log(
        db,
        current_user,
        r.industry_id,
        r.ifti_id,
        action="ifti_reviewed",
        after_state={"status": r.status.value},
    )
    return r


@router.post("/{ifti_id}/approve", response_model=IFTIResponse)
def approve_record(
    ifti_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(_APPROVER),
):
    r = get_ifti(db, ifti_id)
    if not r:
        raise HTTPException(404, "IFTI record not found")
    if not current_user.is_super_admin and r.industry_id != current_user.org_id:
        raise HTTPException(403, "Access denied")
    if r.status != IFTIStatus.under_review:
        raise HTTPException(
            409, f"Record must be under_review (current: {r.status.value})"
        )
    _assert_maker_checker(r, current_user.id)
    r.status = IFTIStatus.approved
    r.approved_by = current_user.id
    r.approved_at = datetime.now(timezone.utc)
    r.updated_at = datetime.now(timezone.utc)
    db.commit()
    db.refresh(r)
    _log(
        db,
        current_user,
        r.industry_id,
        r.ifti_id,
        action="ifti_approved",
        after_state={"status": r.status.value},
    )
    return r


@router.post("/{ifti_id}/submit", response_model=IFTIResponse)
def submit_record(
    ifti_id: str,
    submission_reference: Optional[str] = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(_APPROVER),
):
    r = get_ifti(db, ifti_id)
    if not r:
        raise HTTPException(404, "IFTI record not found")
    if not current_user.is_super_admin and r.industry_id != current_user.org_id:
        raise HTTPException(403, "Access denied")
    if r.status != IFTIStatus.approved:
        raise HTTPException(
            409,
            f"Record must be approved before submission (current: {r.status.value})",
        )
    errors = _validate_ifti_record(r)
    if errors:
        raise HTTPException(
            422,
            {
                "detail": "Validation failed — fix errors before submitting",
                "errors": errors,
            },
        )
    r.status = IFTIStatus.submitted
    r.submitted_at = datetime.now(timezone.utc)
    if submission_reference:
        r.submission_reference = submission_reference
    r.updated_at = datetime.now(timezone.utc)
    db.commit()
    db.refresh(r)

    register_submission(
        db=db,
        org_id=r.industry_id,
        report_type=ReportType.ifti_incoming
        if r.direction == IFTIDirection.incoming
        else ReportType.ifti_outgoing,
        report_id=r.ifti_id,
        report_ref=r.ifti_id,
        submitted_by=current_user.id,
        austrac_submission_ref=submission_reference,
        amount_aud=float(r.total_amount) if r.total_amount is not None else None,
    )
    _log(
        db,
        current_user,
        r.industry_id,
        r.ifti_id,
        action="ifti_submitted",
        after_state={
            "status": r.status.value,
            "submission_reference": submission_reference,
        },
    )
    return r


@router.post("/{ifti_id}/acknowledge", response_model=IFTIResponse)
def acknowledge_record(
    ifti_id: str,
    acknowledgement_ref: Optional[str] = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(_WRITER),
):
    r = get_ifti(db, ifti_id)
    if not r:
        raise HTTPException(404, "IFTI record not found")
    if not current_user.is_super_admin and r.industry_id != current_user.org_id:
        raise HTTPException(403, "Access denied")
    if r.status != IFTIStatus.submitted:
        raise HTTPException(
            409, f"Record must be submitted (current: {r.status.value})"
        )
    r.status = IFTIStatus.acknowledged
    r.acknowledged_at = datetime.now(timezone.utc)
    if acknowledgement_ref:
        r.submission_reference = acknowledgement_ref
    r.updated_at = datetime.now(timezone.utc)
    db.commit()
    db.refresh(r)
    _log(
        db,
        current_user,
        r.industry_id,
        r.ifti_id,
        action="ifti_acknowledged",
        after_state={"status": r.status.value},
    )
    return r


@router.post("/{ifti_id}/reject", response_model=IFTIResponse)
def reject_record(
    ifti_id: str,
    reason: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(_APPROVER),
):
    r = get_ifti(db, ifti_id)
    if not r:
        raise HTTPException(404, "IFTI record not found")
    if not current_user.is_super_admin and r.industry_id != current_user.org_id:
        raise HTTPException(403, "Access denied")
    r.status = IFTIStatus.rejected
    r.rejected_reason = reason
    r.updated_at = datetime.now(timezone.utc)
    db.commit()
    db.refresh(r)
    _log(
        db,
        current_user,
        r.industry_id,
        r.ifti_id,
        action="ifti_rejected",
        after_state={"status": r.status.value},
        notes=reason,
    )
    return r


@router.post("/{ifti_id}/redraft", response_model=IFTIResponse)
def redraft_record(
    ifti_id: str,
    reason: Optional[str] = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(_WRITER),
):
    """Reset a rejected IFTI-DRA record to draft for correction and resubmission."""
    r = get_ifti(db, ifti_id)
    if not r:
        raise HTTPException(404, "IFTI record not found")
    if not current_user.is_super_admin and r.industry_id != current_user.org_id:
        raise HTTPException(403, "Access denied")
    if r.status != IFTIStatus.rejected:
        raise HTTPException(
            409, f"Only rejected records can be redrafted (current: {r.status.value})"
        )
    r.status = IFTIStatus.draft
    r.rejected_reason = None
    r.reviewed_by = None
    r.approved_by = None
    r.approved_at = None
    r.submitted_at = None
    r.submission_reference = None
    r.updated_at = datetime.now(timezone.utc)
    db.commit()
    db.refresh(r)
    _log(
        db,
        current_user,
        r.industry_id,
        r.ifti_id,
        action="ifti_redrafted",
        after_state={"status": r.status.value},
        notes=reason,
    )
    return r


@router.get("/{ifti_id}/validate")
def validate_record(
    ifti_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(_WRITER),
):
    """Validate mandatory AUSTRAC fields before submission. Returns error list."""
    r = get_ifti(db, ifti_id)
    if not r:
        raise HTTPException(404, "IFTI record not found")
    if not current_user.is_super_admin and r.industry_id != current_user.org_id:
        raise HTTPException(403, "Access denied")
    errors = _validate_ifti_record(r)
    return {
        "ifti_id": ifti_id,
        "valid": len(errors) == 0,
        "errors": errors,
        "error_count": len(errors),
    }


@router.delete("/{ifti_id}", status_code=204)
def delete_record(
    ifti_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(_WRITER),
):
    r = get_ifti(db, ifti_id)
    if not r:
        raise HTTPException(404, "IFTI record not found")
    if r.status in (IFTIStatus.submitted, IFTIStatus.acknowledged):
        raise HTTPException(400, "Cannot delete a submitted record")
    if not current_user.is_super_admin and r.industry_id != current_user.org_id:
        raise HTTPException(403, "Access denied")
    industry_id, record_ifti_id = r.industry_id, r.ifti_id
    db.delete(r)
    db.commit()
    _log(
        db,
        current_user,
        industry_id,
        record_ifti_id,
        action="ifti_deleted",
    )


# ── Excel download ────────────────────────────────────────────────────────────


@router.get("/export/{direction}")
def export_excel(
    direction: IFTIDirection,
    status: Optional[str] = Query(None),
    db: Session = Depends(get_db),
    current_user: User = Depends(_WRITER),
):
    """
    Generate and download an AUSTRAC-compatible IFTI Excel spreadsheet.

    The downloaded file matches the official AUSTRAC IFTI-DRA IN / OUT template
    exactly — open it, verify, then copy-paste rows into AUSTRAC Online and submit.
    """
    industry_id = None if current_user.is_super_admin else current_user.org_id
    records = list_ifti(db, industry_id=industry_id, direction=direction, status=status)

    if not records:
        raise HTTPException(
            404,
            f"No {direction} IFTI records found"
            + (f" with status={status}" if status else ""),
        )

    xlsx_bytes = generate_ifti_excel(records, direction=direction)
    label = "OUT" if direction == IFTIDirection.outgoing else "IN"
    filename = f"IFTI_DRA_{label}_{datetime.now().strftime('%Y%m%d_%H%M%S')}.xlsx"

    return StreamingResponse(
        BytesIO(xlsx_bytes),
        media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        headers={
            "Content-Disposition": f'attachment; filename="{filename}"',
            "X-Record-Count": str(len(records)),
        },
    )


@router.post("/export/batch")
def export_selected(
    ifti_ids: List[str],
    direction: IFTIDirection,
    db: Session = Depends(get_db),
    current_user: User = Depends(_WRITER),
):
    """Export a specific selection of IFTI records to Excel."""
    from sqlalchemy import or_

    from app.models.ifti import IFTIRecord as IFTIModel

    if current_user.is_super_admin:
        industry_id = None
        organisation_id = None
    else:
        industry_id = current_user.industry_id
        organisation_id = getattr(current_user, "primary_organisation_id", None)
    q = db.query(IFTIModel).filter(
        IFTIModel.ifti_id.in_(ifti_ids),
        IFTIModel.direction == direction,
    )
    if organisation_id:
        q = q.filter(
            or_(
                IFTIModel.organisation_id == organisation_id,
                (IFTIModel.organisation_id.is_(None))
                & (IFTIModel.industry_id == industry_id),
            )
        )
    elif industry_id:
        q = q.filter(IFTIModel.industry_id == industry_id)
    records = q.all()

    if not records:
        raise HTTPException(404, "No matching records found")

    xlsx_bytes = generate_ifti_excel(records, direction=direction)
    label = "OUT" if direction == IFTIDirection.outgoing else "IN"
    filename = f"IFTI_DRA_{label}_BATCH_{datetime.now().strftime('%Y%m%d_%H%M%S')}.xlsx"

    return StreamingResponse(
        BytesIO(xlsx_bytes),
        media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )
