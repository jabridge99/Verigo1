"""
Customers — KYB business evidence: business detail, beneficial owners,
corporate documents. Part of the customers route package; see __init__.py
for the combined router.
"""

from datetime import datetime, timezone
from typing import List

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.api.deps import org_id_for, require_analyst_or_above
from app.db.database import get_db
from app.models.customer import BeneficialOwner, BusinessDetail, CorporateDocument
from app.models.user import User
from app.schemas.customer import (
    BeneficialOwnerCreate,
    BeneficialOwnerResponse,
    BeneficialOwnerUpdate,
    BusinessDetailCreate,
    BusinessDetailResponse,
    CorporateDocumentCreate,
    CorporateDocumentResponse,
)

from ._shared import _get_customer, _update_checklist_flag

router = APIRouter()


# ── Business Detail (KYB) ──────────────────────────────────────────────────────


@router.post(
    "/{customer_id}/business-detail",
    response_model=BusinessDetailResponse,
    status_code=201,
)
def create_business_detail(
    customer_id: str,
    payload: BusinessDetailCreate,
    current_user: User = Depends(require_analyst_or_above),
    db: Session = Depends(get_db),
):
    customer = _get_customer(customer_id, org_id_for(current_user), db)
    if customer.business_detail_id:
        raise HTTPException(409, "Business detail already exists — use PATCH")

    detail = BusinessDetail(
        org_id=customer.org_id,
        customer_id=customer.id,
        **payload.model_dump(exclude_none=True),
    )
    db.add(detail)
    db.flush()
    customer.business_detail_id = detail.id
    db.commit()
    db.refresh(detail)
    return detail


@router.get("/{customer_id}/business-detail", response_model=BusinessDetailResponse)
def get_business_detail(
    customer_id: str,
    current_user: User = Depends(require_analyst_or_above),
    db: Session = Depends(get_db),
):
    customer = _get_customer(customer_id, org_id_for(current_user), db)
    if not customer.business_detail_id:
        raise HTTPException(404, "No business detail on record")
    return customer.business_detail


# ── Beneficial Owners ──────────────────────────────────────────────────────────


@router.post(
    "/{customer_id}/beneficial-owners",
    response_model=BeneficialOwnerResponse,
    status_code=201,
)
def add_beneficial_owner(
    customer_id: str,
    payload: BeneficialOwnerCreate,
    current_user: User = Depends(require_analyst_or_above),
    db: Session = Depends(get_db),
):
    customer = _get_customer(customer_id, org_id_for(current_user), db)
    ubo = BeneficialOwner(
        customer_id=customer.id,
        org_id=customer.org_id,
        created_by=current_user.id,
        **payload.model_dump(exclude_none=True),
    )
    db.add(ubo)
    _update_checklist_flag(customer, "ubo_identified", True, db)
    db.commit()
    db.refresh(ubo)
    return ubo


@router.get(
    "/{customer_id}/beneficial-owners", response_model=List[BeneficialOwnerResponse]
)
def list_beneficial_owners(
    customer_id: str,
    current_user: User = Depends(require_analyst_or_above),
    db: Session = Depends(get_db),
):
    _get_customer(customer_id, org_id_for(current_user), db)
    return (
        db.query(BeneficialOwner)
        .filter(BeneficialOwner.customer_id == customer_id)
        .order_by(BeneficialOwner.created_at)
        .all()
    )


@router.patch(
    "/{customer_id}/beneficial-owners/{ubo_id}", response_model=BeneficialOwnerResponse
)
def update_beneficial_owner(
    customer_id: str,
    ubo_id: str,
    payload: BeneficialOwnerUpdate,
    current_user: User = Depends(require_analyst_or_above),
    db: Session = Depends(get_db),
):
    _get_customer(customer_id, org_id_for(current_user), db)
    ubo = (
        db.query(BeneficialOwner)
        .filter(
            BeneficialOwner.id == ubo_id, BeneficialOwner.customer_id == customer_id
        )
        .first()
    )
    if not ubo:
        raise HTTPException(404, "Beneficial owner not found")
    for field, value in payload.model_dump(exclude_none=True).items():
        setattr(ubo, field, value)
    if payload.verified:
        ubo.verified_by = current_user.id
        ubo.verified_at = datetime.now(timezone.utc)
        customer = _get_customer(customer_id, org_id_for(current_user), db)
        _update_checklist_flag(customer, "ubo_verified", True, db)
    db.commit()
    db.refresh(ubo)
    return ubo


# ── Corporate Documents ────────────────────────────────────────────────────────


@router.post(
    "/{customer_id}/corporate-documents",
    response_model=CorporateDocumentResponse,
    status_code=201,
)
def add_corporate_document(
    customer_id: str,
    payload: CorporateDocumentCreate,
    current_user: User = Depends(require_analyst_or_above),
    db: Session = Depends(get_db),
):
    customer = _get_customer(customer_id, org_id_for(current_user), db)
    doc = CorporateDocument(
        customer_id=customer.id,
        org_id=customer.org_id,
        uploaded_by=current_user.id,
        **payload.model_dump(exclude_none=True),
    )
    db.add(doc)
    db.commit()
    db.refresh(doc)
    return doc


@router.get(
    "/{customer_id}/corporate-documents", response_model=List[CorporateDocumentResponse]
)
def list_corporate_documents(
    customer_id: str,
    current_user: User = Depends(require_analyst_or_above),
    db: Session = Depends(get_db),
):
    _get_customer(customer_id, org_id_for(current_user), db)
    return (
        db.query(CorporateDocument)
        .filter(CorporateDocument.customer_id == customer_id)
        .order_by(CorporateDocument.created_at.desc())
        .all()
    )
