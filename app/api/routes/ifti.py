"""
IFTI Report API.

Supports:
- Creating IFTI-IN and IFTI-OUT records manually or from a transaction
- Listing/editing draft records
- Generating AUSTRAC-compatible Excel file (download)
- Marking records as submitted

All endpoints require authentication. Generation requires compliance+ role.
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
from app.models.ifti import IFTIDirection, IFTIRecord, IFTIStatus
from app.models.user import User, UserRole
from app.services.ifti_service import generate_ifti_excel, get_ifti, list_ifti
from app.services.tenant_scope import assert_tenant, scope_fields

router = APIRouter(prefix="/ifti", tags=["IFTI Reports"])

_READER = _require_roles(
    UserRole.admin, UserRole.mlro, UserRole.compliance, UserRole.analyst
)
_WRITER = _require_roles(UserRole.admin, UserRole.mlro, UserRole.compliance)


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
    industry_id: Optional[str] = None
    created_by: Optional[str] = None

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
    industry_id = None if current_user.role == UserRole.admin else current_user.org_id
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
    if current_user.role != UserRole.admin and r.industry_id != current_user.org_id:
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
    if current_user.role != UserRole.admin and r.industry_id != current_user.org_id:
        raise HTTPException(403, "Access denied")
    if r.status == IFTIStatus.submitted:
        raise HTTPException(400, "Cannot edit a submitted IFTI record")
    _apply_fields(r, payload)
    db.commit()
    db.refresh(r)
    return r


@router.post("/{ifti_id}/ready")
def mark_ready(
    ifti_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(_WRITER),
):
    r = get_ifti(db, ifti_id)
    if not r:
        raise HTTPException(404, "IFTI record not found")
    r.status = IFTIStatus.ready
    db.commit()
    return {"ifti_id": ifti_id, "status": r.status}


@router.post("/{ifti_id}/submitted")
def mark_submitted(
    ifti_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(_require_roles(UserRole.admin, UserRole.mlro)),
):
    r = get_ifti(db, ifti_id)
    if not r:
        raise HTTPException(404, "IFTI record not found")
    r.status = IFTIStatus.submitted
    r.submitted_at = datetime.now(timezone.utc)
    db.commit()
    return {"ifti_id": ifti_id, "status": r.status}


@router.delete("/{ifti_id}", status_code=204)
def delete_record(
    ifti_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(_WRITER),
):
    r = get_ifti(db, ifti_id)
    if not r:
        raise HTTPException(404, "IFTI record not found")
    if r.status == IFTIStatus.submitted:
        raise HTTPException(400, "Cannot delete a submitted record")
    if current_user.role != UserRole.admin and r.industry_id != current_user.org_id:
        raise HTTPException(403, "Access denied")
    db.delete(r)
    db.commit()


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
    industry_id = None if current_user.role == UserRole.admin else current_user.org_id
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

    scoped = scope_fields(current_user)
    industry_id = scoped.get("industry_id")
    organisation_id = scoped.get("organisation_id")
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
