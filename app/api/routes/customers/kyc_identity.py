"""
Customers — individual KYC identity evidence: previous names, identity
documents, selfie verification, address verification. Part of the
customers route package; see __init__.py for the combined router.
"""

from datetime import datetime, timezone
from typing import List

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.api.deps import org_id_for, require_analyst_or_above
from app.db.database import get_db
from app.models.customer import CustomerPreviousName
from app.models.kyc import (
    CustomerAddressVerification,
    CustomerIdentityDocument,
    CustomerSelfieVerification,
    VerificationResult,
)
from app.models.user import User
from app.schemas.customer import (
    AddressVerificationCreate,
    AddressVerificationResponse,
    IdentityDocumentCreate,
    IdentityDocumentResponse,
    IdentityDocumentVerifyUpdate,
    PreviousNameCreate,
    PreviousNameResponse,
    SelfieVerificationCreate,
    SelfieVerificationResponse,
)

from ._shared import _get_customer, _update_checklist_flag

router = APIRouter()


# ── Previous Names ─────────────────────────────────────────────────────────────


@router.post(
    "/{customer_id}/previous-names",
    response_model=PreviousNameResponse,
    status_code=201,
)
def add_previous_name(
    customer_id: str,
    payload: PreviousNameCreate,
    current_user: User = Depends(require_analyst_or_above),
    db: Session = Depends(get_db),
):
    customer = _get_customer(customer_id, org_id_for(current_user), db)
    record = CustomerPreviousName(
        customer_id=customer.id,
        org_id=customer.org_id,
        full_name=payload.full_name,
        name_type=payload.name_type,
        used_from=payload.used_from,
        used_to=payload.used_to,
        reason=payload.reason,
        created_by=current_user.id,
    )
    db.add(record)
    db.commit()
    db.refresh(record)
    return record


@router.get("/{customer_id}/previous-names", response_model=List[PreviousNameResponse])
def list_previous_names(
    customer_id: str,
    current_user: User = Depends(require_analyst_or_above),
    db: Session = Depends(get_db),
):
    _get_customer(customer_id, org_id_for(current_user), db)
    return (
        db.query(CustomerPreviousName)
        .filter(CustomerPreviousName.customer_id == customer_id)
        .order_by(CustomerPreviousName.created_at.desc())
        .all()
    )


# ── Identity Documents ─────────────────────────────────────────────────────────


@router.post(
    "/{customer_id}/identity-documents",
    response_model=IdentityDocumentResponse,
    status_code=201,
)
def add_identity_document(
    customer_id: str,
    payload: IdentityDocumentCreate,
    current_user: User = Depends(require_analyst_or_above),
    db: Session = Depends(get_db),
):
    customer = _get_customer(customer_id, org_id_for(current_user), db)
    doc = CustomerIdentityDocument(
        customer_id=customer.id,
        org_id=customer.org_id,
        uploaded_by=current_user.id,
        **payload.model_dump(exclude_none=True),
    )
    db.add(doc)
    db.commit()
    db.refresh(doc)
    return doc


@router.patch(
    "/{customer_id}/identity-documents/{doc_id}/verify",
    response_model=IdentityDocumentResponse,
)
def verify_identity_document(
    customer_id: str,
    doc_id: str,
    payload: IdentityDocumentVerifyUpdate,
    current_user: User = Depends(require_analyst_or_above),
    db: Session = Depends(get_db),
):
    customer = _get_customer(customer_id, org_id_for(current_user), db)
    doc = (
        db.query(CustomerIdentityDocument)
        .filter(
            CustomerIdentityDocument.id == doc_id,
            CustomerIdentityDocument.customer_id == customer_id,
        )
        .first()
    )
    if not doc:
        raise HTTPException(404, "Identity document not found")

    for field, value in payload.model_dump(exclude_none=True).items():
        setattr(doc, field, value)
    doc.verified_by = current_user.id
    doc.verified_at = datetime.now(timezone.utc)

    if payload.verification_result == VerificationResult.pass_:
        _update_checklist_flag(customer, "identity_document_verified", True, db)

    db.commit()
    db.refresh(doc)
    return doc


@router.get(
    "/{customer_id}/identity-documents", response_model=List[IdentityDocumentResponse]
)
def list_identity_documents(
    customer_id: str,
    current_user: User = Depends(require_analyst_or_above),
    db: Session = Depends(get_db),
):
    _get_customer(customer_id, org_id_for(current_user), db)
    return (
        db.query(CustomerIdentityDocument)
        .filter(CustomerIdentityDocument.customer_id == customer_id)
        .order_by(CustomerIdentityDocument.created_at.desc())
        .all()
    )


# ── Selfie Verification ────────────────────────────────────────────────────────


@router.post(
    "/{customer_id}/selfie-verification",
    response_model=SelfieVerificationResponse,
    status_code=201,
)
def add_selfie_verification(
    customer_id: str,
    payload: SelfieVerificationCreate,
    current_user: User = Depends(require_analyst_or_above),
    db: Session = Depends(get_db),
):
    customer = _get_customer(customer_id, org_id_for(current_user), db)
    overall = (
        VerificationResult.pass_
        if (
            payload.liveness_result == VerificationResult.pass_
            and payload.face_match_result == VerificationResult.pass_
        )
        else VerificationResult.refer
    )

    rec = CustomerSelfieVerification(
        customer_id=customer.id,
        org_id=customer.org_id,
        verification_result=overall,
        verified_at=datetime.now(timezone.utc),
        **payload.model_dump(exclude_none=True),
    )
    db.add(rec)
    if overall == VerificationResult.pass_:
        _update_checklist_flag(customer, "selfie_verified", True, db)
    db.commit()
    db.refresh(rec)
    return rec


@router.get(
    "/{customer_id}/selfie-verifications",
    response_model=List[SelfieVerificationResponse],
)
def list_selfie_verifications(
    customer_id: str,
    current_user: User = Depends(require_analyst_or_above),
    db: Session = Depends(get_db),
):
    _get_customer(customer_id, org_id_for(current_user), db)
    return (
        db.query(CustomerSelfieVerification)
        .filter(CustomerSelfieVerification.customer_id == customer_id)
        .order_by(CustomerSelfieVerification.created_at.desc())
        .all()
    )


# ── Address Verification ───────────────────────────────────────────────────────


@router.post(
    "/{customer_id}/address-verification",
    response_model=AddressVerificationResponse,
    status_code=201,
)
def add_address_verification(
    customer_id: str,
    payload: AddressVerificationCreate,
    current_user: User = Depends(require_analyst_or_above),
    db: Session = Depends(get_db),
):
    customer = _get_customer(customer_id, org_id_for(current_user), db)
    rec = CustomerAddressVerification(
        customer_id=customer.id,
        org_id=customer.org_id,
        uploaded_by=current_user.id,
        **payload.model_dump(exclude_none=True),
    )
    db.add(rec)
    db.commit()
    db.refresh(rec)
    return rec
