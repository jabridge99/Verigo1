"""
IFTI-E Report API (AUSTRAC IFTI-E v1.3 — Electronic Funds Transfers).

Supports:
- Creating IFTI-E records (swift mode or structured mode)
- Listing / retrieving / updating draft records
- Generating AUSTRAC-compatible Excel file for download
- Marking records as submitted
- Building AUSTRAC XML submission payload

Role requirements:
  analyst+    : read, list
  compliance+ : create, update
  mlro+       : submit, mark submitted
"""

import uuid
from datetime import date as _date_type
from datetime import datetime, timezone
from io import BytesIO
from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from fastapi.responses import StreamingResponse
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app.api.routes.auth import _require_roles
from app.db.database import get_db
from app.models.ifti_e import IFTIEDirection, IFTIEMode, IFTIERecord, IFTIEStatus
from app.models.user import User, UserRole
from app.services.ifti_e_service import generate_ifti_e_excel, get_ifti_e, list_ifti_e

router = APIRouter(prefix="/ifti-e", tags=["IFTI-E Reports"])

_READER = _require_roles(
    UserRole.admin, UserRole.mlro, UserRole.compliance, UserRole.analyst
)
_WRITER = _require_roles(UserRole.admin, UserRole.mlro, UserRole.compliance)
_SUBMITTER = _require_roles(UserRole.admin, UserRole.mlro)


# ── Pydantic schemas ──────────────────────────────────────────────────────────

class IFTIECreate(BaseModel):
    direction: IFTIEDirection
    mode: IFTIEMode = IFTIEMode.structured
    date_received: str   # DD/MM/YYYY
    date_available: str  # DD/MM/YYYY
    currency_code: str = "AUD"
    total_amount: float
    transaction_reference: Optional[str] = None
    details_of_payment: Optional[str] = None       # max 140 chars
    sender_to_receiver_info: Optional[str] = None

    # Swift mode
    swift_msg: Optional[str] = None
    payer_same_as_swift_ord_cust: Optional[str] = None   # Yes/No

    # Payer
    payer_full_name: Optional[str] = None
    payer_other_name: Optional[str] = None
    payer_dob: Optional[str] = None   # DD/MM/YYYY
    payer_address: Optional[str] = None
    payer_city: Optional[str] = None
    payer_state: Optional[str] = None
    payer_postcode: Optional[str] = None
    payer_country: Optional[str] = None
    payer_postal_address: Optional[str] = None
    payer_postal_city: Optional[str] = None
    payer_postal_state: Optional[str] = None
    payer_postal_postcode: Optional[str] = None
    payer_postal_country: Optional[str] = None
    payer_phone: Optional[str] = None
    payer_email: Optional[str] = None
    payer_occupation: Optional[str] = None
    payer_abn: Optional[str] = None
    payer_acn: Optional[str] = None
    payer_arbn: Optional[str] = None
    payer_account_number: Optional[str] = None
    payer_business_structure: Optional[str] = None
    payer_id1_type: Optional[str] = None
    payer_id1_number: Optional[str] = None
    payer_id1_issuer: Optional[str] = None
    payer_id2_type: Optional[str] = None
    payer_id2_number: Optional[str] = None
    payer_id2_issuer: Optional[str] = None
    payer_electronic_source: Optional[str] = None

    # Payer institution
    payer_instn_name: Optional[str] = None
    payer_instn_code: Optional[str] = None   # SWIFT BIC
    payer_instn_address: Optional[str] = None
    payer_instn_city: Optional[str] = None
    payer_instn_country: Optional[str] = None

    # Correspondent banks — [{name, code, address, city, country}]
    correspondent_instns: Optional[List[dict]] = None

    # Payee institution (MANDATORY in structured mode)
    payee_instn_name: Optional[str] = None
    payee_instn_code: Optional[str] = None   # SWIFT BIC
    payee_instn_address: Optional[str] = None
    payee_instn_city: Optional[str] = None
    payee_instn_country: Optional[str] = None  # MANDATORY

    # Payee
    payee_full_name: Optional[str] = None
    payee_dob: Optional[str] = None   # DD/MM/YYYY
    payee_business_name: Optional[str] = None
    payee_address: Optional[str] = None
    payee_city: Optional[str] = None
    payee_state: Optional[str] = None
    payee_postcode: Optional[str] = None
    payee_country: Optional[str] = None
    payee_phone: Optional[str] = None
    payee_email: Optional[str] = None
    payee_occupation: Optional[str] = None
    payee_abn: Optional[str] = None
    payee_acn: Optional[str] = None
    payee_arbn: Optional[str] = None
    payee_account_number: Optional[str] = None
    payee_account_iban: Optional[str] = None
    payee_business_structure: Optional[str] = None

    # Reporter
    reporter_full_name: Optional[str] = None
    reporter_job_title: Optional[str] = None
    reporter_phone: Optional[str] = None
    reporter_email: Optional[str] = None


class IFTIEUpdate(BaseModel):
    mode: Optional[IFTIEMode] = None
    date_received: Optional[str] = None
    date_available: Optional[str] = None
    currency_code: Optional[str] = None
    total_amount: Optional[float] = None
    transaction_reference: Optional[str] = None
    details_of_payment: Optional[str] = None
    sender_to_receiver_info: Optional[str] = None
    swift_msg: Optional[str] = None
    payer_same_as_swift_ord_cust: Optional[str] = None
    payer_full_name: Optional[str] = None
    payer_other_name: Optional[str] = None
    payer_dob: Optional[str] = None
    payer_address: Optional[str] = None
    payer_city: Optional[str] = None
    payer_state: Optional[str] = None
    payer_postcode: Optional[str] = None
    payer_country: Optional[str] = None
    payer_postal_address: Optional[str] = None
    payer_postal_city: Optional[str] = None
    payer_postal_state: Optional[str] = None
    payer_postal_postcode: Optional[str] = None
    payer_postal_country: Optional[str] = None
    payer_phone: Optional[str] = None
    payer_email: Optional[str] = None
    payer_occupation: Optional[str] = None
    payer_abn: Optional[str] = None
    payer_acn: Optional[str] = None
    payer_arbn: Optional[str] = None
    payer_account_number: Optional[str] = None
    payer_business_structure: Optional[str] = None
    payer_id1_type: Optional[str] = None
    payer_id1_number: Optional[str] = None
    payer_id1_issuer: Optional[str] = None
    payer_id2_type: Optional[str] = None
    payer_id2_number: Optional[str] = None
    payer_id2_issuer: Optional[str] = None
    payer_electronic_source: Optional[str] = None
    payer_instn_name: Optional[str] = None
    payer_instn_code: Optional[str] = None
    payer_instn_address: Optional[str] = None
    payer_instn_city: Optional[str] = None
    payer_instn_country: Optional[str] = None
    correspondent_instns: Optional[List[dict]] = None
    payee_instn_name: Optional[str] = None
    payee_instn_code: Optional[str] = None
    payee_instn_address: Optional[str] = None
    payee_instn_city: Optional[str] = None
    payee_instn_country: Optional[str] = None
    payee_full_name: Optional[str] = None
    payee_dob: Optional[str] = None
    payee_business_name: Optional[str] = None
    payee_address: Optional[str] = None
    payee_city: Optional[str] = None
    payee_state: Optional[str] = None
    payee_postcode: Optional[str] = None
    payee_country: Optional[str] = None
    payee_phone: Optional[str] = None
    payee_email: Optional[str] = None
    payee_occupation: Optional[str] = None
    payee_abn: Optional[str] = None
    payee_acn: Optional[str] = None
    payee_arbn: Optional[str] = None
    payee_account_number: Optional[str] = None
    payee_account_iban: Optional[str] = None
    payee_business_structure: Optional[str] = None
    reporter_full_name: Optional[str] = None
    reporter_job_title: Optional[str] = None
    reporter_phone: Optional[str] = None
    reporter_email: Optional[str] = None


# ── Helpers ───────────────────────────────────────────────────────────────────

def _parse_date(s: Optional[str]) -> Optional[_date_type]:
    if not s:
        return None
    for fmt in ("%d/%m/%Y", "%Y-%m-%d"):
        try:
            return datetime.strptime(s, fmt).date()
        except ValueError:
            continue
    raise ValueError(f"Cannot parse date: {s!r}")


def _record_dict(r: IFTIERecord) -> dict:
    return {
        "id": r.id,
        "ifti_e_id": r.ifti_e_id,
        "industry_id": r.industry_id,
        "direction": r.direction.value if r.direction else None,
        "mode": r.mode.value if r.mode else None,
        "status": r.status.value if r.status else None,
        "date_received": r.date_received,
        "date_available": r.date_available,
        "currency_code": r.currency_code,
        "total_amount": r.total_amount,
        "transaction_reference": r.transaction_reference,
        "details_of_payment": r.details_of_payment,
        "sender_to_receiver_info": r.sender_to_receiver_info,
        "swift_msg": r.swift_msg,
        "payer_same_as_swift_ord_cust": r.payer_same_as_swift_ord_cust,
        "payer_full_name": r.payer_full_name,
        "payer_other_name": r.payer_other_name,
        "payer_dob": r.payer_dob,
        "payer_address": r.payer_address,
        "payer_city": r.payer_city,
        "payer_state": r.payer_state,
        "payer_postcode": r.payer_postcode,
        "payer_country": r.payer_country,
        "payer_postal_address": r.payer_postal_address,
        "payer_postal_city": r.payer_postal_city,
        "payer_postal_state": r.payer_postal_state,
        "payer_postal_postcode": r.payer_postal_postcode,
        "payer_postal_country": r.payer_postal_country,
        "payer_phone": r.payer_phone,
        "payer_email": r.payer_email,
        "payer_occupation": r.payer_occupation,
        "payer_abn": r.payer_abn,
        "payer_acn": r.payer_acn,
        "payer_arbn": r.payer_arbn,
        "payer_account_number": r.payer_account_number,
        "payer_business_structure": r.payer_business_structure,
        "payer_id1_type": r.payer_id1_type,
        "payer_id1_number": r.payer_id1_number,
        "payer_id1_issuer": r.payer_id1_issuer,
        "payer_id2_type": r.payer_id2_type,
        "payer_id2_number": r.payer_id2_number,
        "payer_id2_issuer": r.payer_id2_issuer,
        "payer_electronic_source": r.payer_electronic_source,
        "payer_instn_name": r.payer_instn_name,
        "payer_instn_code": r.payer_instn_code,
        "payer_instn_address": r.payer_instn_address,
        "payer_instn_city": r.payer_instn_city,
        "payer_instn_country": r.payer_instn_country,
        "correspondent_instns": r.correspondent_instns,
        "payee_instn_name": r.payee_instn_name,
        "payee_instn_code": r.payee_instn_code,
        "payee_instn_address": r.payee_instn_address,
        "payee_instn_city": r.payee_instn_city,
        "payee_instn_country": r.payee_instn_country,
        "payee_full_name": r.payee_full_name,
        "payee_dob": r.payee_dob,
        "payee_business_name": r.payee_business_name,
        "payee_address": r.payee_address,
        "payee_city": r.payee_city,
        "payee_state": r.payee_state,
        "payee_postcode": r.payee_postcode,
        "payee_country": r.payee_country,
        "payee_phone": r.payee_phone,
        "payee_email": r.payee_email,
        "payee_occupation": r.payee_occupation,
        "payee_abn": r.payee_abn,
        "payee_acn": r.payee_acn,
        "payee_arbn": r.payee_arbn,
        "payee_account_number": r.payee_account_number,
        "payee_account_iban": r.payee_account_iban,
        "payee_business_structure": r.payee_business_structure,
        "reporter_full_name": r.reporter_full_name,
        "reporter_job_title": r.reporter_job_title,
        "reporter_phone": r.reporter_phone,
        "reporter_email": r.reporter_email,
        "created_by": r.created_by,
        "submitted_at": r.submitted_at,
        "created_at": r.created_at,
        "updated_at": r.updated_at,
    }


def _apply_create(payload: IFTIECreate, record: IFTIERecord) -> None:
    data = payload.model_dump()
    for field, value in data.items():
        if field in ("date_received", "date_available", "payer_dob", "payee_dob"):
            setattr(record, field, _parse_date(value))
        elif field == "correspondent_instns":
            record.correspondent_instns = value or []
        else:
            setattr(record, field, value)


# ── Routes ────────────────────────────────────────────────────────────────────

@router.get("", response_model=list[dict])
def list_records(
    direction: Optional[IFTIEDirection] = Query(None),
    status: Optional[IFTIEStatus] = Query(None),
    db: Session = Depends(get_db),
    current_user: User = Depends(_READER),
):
    records = list_ifti_e(db, current_user.organisation_id,
                          direction=direction,
                          status=status.value if status else None)
    return [_record_dict(r) for r in records]


@router.post("", status_code=201)
def create_record(
    payload: IFTIECreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(_WRITER),
):
    """
    Create a new IFTI-E draft record.
    In swift mode, swift_msg must be supplied.
    In structured mode, payee_instn_name and payee_instn_country are MANDATORY.
    """
    if payload.mode == IFTIEMode.swift and not payload.swift_msg:
        raise HTTPException(422, "swift_msg is required when mode is 'swift'.")
    if payload.mode == IFTIEMode.structured:
        if not payload.payee_instn_name:
            raise HTTPException(422, "payee_instn_name is required in structured mode.")
        if not payload.payee_instn_country:
            raise HTTPException(422, "payee_instn_country is required in structured mode.")

    record = IFTIERecord(
        ifti_e_id=f"IFTIE-{uuid.uuid4().hex[:12].upper()}",
        industry_id=current_user.organisation_id,
        created_by=current_user.id,
    )
    _apply_create(payload, record)
    db.add(record)
    db.commit()
    db.refresh(record)
    return _record_dict(record)


@router.get("/{record_id}")
def get_record(
    record_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(_READER),
):
    r = get_ifti_e(db, record_id, current_user.organisation_id)
    if not r:
        raise HTTPException(404, "IFTI-E record not found.")
    return _record_dict(r)


@router.patch("/{record_id}")
def update_record(
    record_id: int,
    payload: IFTIEUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(_WRITER),
):
    """Draft and ready records may be edited. Submitted records are immutable."""
    r = get_ifti_e(db, record_id, current_user.organisation_id)
    if not r:
        raise HTTPException(404, "IFTI-E record not found.")
    if r.status == IFTIEStatus.submitted:
        raise HTTPException(409, "Submitted IFTI-E records are immutable.")

    data = payload.model_dump(exclude_none=True)
    date_fields = {"date_received", "date_available", "payer_dob", "payee_dob"}
    for field, value in data.items():
        if field in date_fields:
            setattr(r, field, _parse_date(value))
        else:
            setattr(r, field, value)
    db.commit()
    db.refresh(r)
    return _record_dict(r)


@router.post("/{record_id}/mark-ready")
def mark_ready(
    record_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(_WRITER),
):
    r = get_ifti_e(db, record_id, current_user.organisation_id)
    if not r:
        raise HTTPException(404, "IFTI-E record not found.")
    if r.status != IFTIEStatus.draft:
        raise HTTPException(409, "Only draft records can be marked ready.")
    r.status = IFTIEStatus.ready
    db.commit()
    return {"id": r.id, "status": r.status.value}


@router.post("/{record_id}/submit")
def submit_record(
    record_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(_SUBMITTER),
):
    """Mark as submitted. MLRO/admin only. Records become immutable after submission."""
    r = get_ifti_e(db, record_id, current_user.organisation_id)
    if not r:
        raise HTTPException(404, "IFTI-E record not found.")
    if r.status != IFTIEStatus.ready:
        raise HTTPException(409, "Only ready records can be submitted.")
    r.status = IFTIEStatus.submitted
    r.submitted_at = datetime.now(timezone.utc)
    db.commit()
    return {"id": r.id, "status": r.status.value, "submitted_at": r.submitted_at}


@router.get("/{record_id}/export-excel")
def export_excel(
    record_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(_WRITER),
):
    """
    Download an AUSTRAC-compatible IFTI-E Excel workbook for this record.
    The file matches the AUSTRAC IFTI-E v1.3 template format.
    """
    r = get_ifti_e(db, record_id, current_user.organisation_id)
    if not r:
        raise HTTPException(404, "IFTI-E record not found.")

    xlsx_bytes = generate_ifti_e_excel([r], direction=r.direction)
    filename = f"IFTI-E-{r.ifti_e_id}-{r.direction.value.upper()}.xlsx"
    return StreamingResponse(
        BytesIO(xlsx_bytes),
        media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )


@router.get("/export-excel/bulk")
def export_excel_bulk(
    direction: IFTIEDirection = Query(...),
    status: Optional[IFTIEStatus] = Query(None),
    db: Session = Depends(get_db),
    current_user: User = Depends(_WRITER),
):
    """Export all matching records into a single AUSTRAC IFTI-E Excel workbook."""
    records = list_ifti_e(db, current_user.organisation_id,
                          direction=direction,
                          status=status.value if status else None)
    if not records:
        raise HTTPException(404, "No IFTI-E records found for the given filters.")

    xlsx_bytes = generate_ifti_e_excel(records, direction=direction)
    filename = f"IFTI-E-BULK-{direction.value.upper()}.xlsx"
    return StreamingResponse(
        BytesIO(xlsx_bytes),
        media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )


@router.get("/{record_id}/austrac-payload")
def austrac_payload(
    record_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(_SUBMITTER),
):
    """
    Return structured AUSTRAC XML submission payload for MLRO review.
    The platform provides compliance tooling only — lodgement decisions remain
    with the reporting entity.
    """
    r = get_ifti_e(db, record_id, current_user.organisation_id)
    if not r:
        raise HTTPException(404, "IFTI-E record not found.")

    corr = r.correspondent_instns or []

    payload = {
        "schema": "IFTI-E-1-3",
        "namespace": "http://austrac.gov.au/schema/reporting/IFTI-E-1-3",
        "direction": r.direction.value,
        "mode": r.mode.value,
        "iftiEId": r.ifti_e_id,
        "transactionDetails": {
            "dateReceived": str(r.date_received) if r.date_received else None,
            "dateAvailable": str(r.date_available) if r.date_available else None,
            "currencyCode": r.currency_code,
            "totalAmount": r.total_amount,
            "transactionReference": r.transaction_reference,
            "detailsOfPayment": r.details_of_payment,
            "senderToReceiverInfo": r.sender_to_receiver_info,
        },
        "swiftMode": {
            "swiftMsg": r.swift_msg,
            "payerSameAsSwiftOrdCust": r.payer_same_as_swift_ord_cust,
        } if r.mode == IFTIEMode.swift else None,
        "payer": {
            "fullName": r.payer_full_name,
            "otherName": r.payer_other_name,
            "dob": str(r.payer_dob) if r.payer_dob else None,
            "address": r.payer_address,
            "city": r.payer_city,
            "state": r.payer_state,
            "postcode": r.payer_postcode,
            "country": r.payer_country,
            "postalAddress": r.payer_postal_address,
            "postalCity": r.payer_postal_city,
            "postalState": r.payer_postal_state,
            "postalPostcode": r.payer_postal_postcode,
            "postalCountry": r.payer_postal_country,
            "phone": r.payer_phone,
            "email": r.payer_email,
            "occupation": r.payer_occupation,
            "abn": r.payer_abn,
            "acn": r.payer_acn,
            "arbn": r.payer_arbn,
            "accountNumber": r.payer_account_number,
            "businessStructure": r.payer_business_structure,
            "id1": {"type": r.payer_id1_type, "number": r.payer_id1_number,
                    "issuer": r.payer_id1_issuer} if r.payer_id1_type else None,
            "id2": {"type": r.payer_id2_type, "number": r.payer_id2_number,
                    "issuer": r.payer_id2_issuer} if r.payer_id2_type else None,
            "electronicSource": r.payer_electronic_source,
        },
        "payerInstn": {
            "name": r.payer_instn_name,
            "code": r.payer_instn_code,
            "address": r.payer_instn_address,
            "city": r.payer_instn_city,
            "country": r.payer_instn_country,
        },
        "correspondentInstns": corr,
        "payeeInstn": {
            "name": r.payee_instn_name,
            "code": r.payee_instn_code,
            "address": r.payee_instn_address,
            "city": r.payee_instn_city,
            "country": r.payee_instn_country,
        },
        "payee": {
            "fullName": r.payee_full_name,
            "dob": str(r.payee_dob) if r.payee_dob else None,
            "businessName": r.payee_business_name,
            "address": r.payee_address,
            "city": r.payee_city,
            "state": r.payee_state,
            "postcode": r.payee_postcode,
            "country": r.payee_country,
            "phone": r.payee_phone,
            "email": r.payee_email,
            "occupation": r.payee_occupation,
            "abn": r.payee_abn,
            "acn": r.payee_acn,
            "arbn": r.payee_arbn,
            "accountNumber": r.payee_account_number,
            "iban": r.payee_account_iban,
            "businessStructure": r.payee_business_structure,
        },
        "reporter": {
            "fullName": r.reporter_full_name,
            "jobTitle": r.reporter_job_title,
            "phone": r.reporter_phone,
            "email": r.reporter_email,
        },
        "disclaimer": (
            "The platform provides compliance management tooling only. "
            "It does not make regulatory decisions. "
            "All responsibility remains with the reporting entity."
        ),
    }
    return payload
