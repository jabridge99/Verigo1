"""
Verification Marketplace API.

Endpoints:
  GET    /marketplace/providers           — list available providers (system + org-custom)
  POST   /marketplace/providers           — add an org-custom provider (compliance+)
  PATCH  /marketplace/providers/{id}      — update an org-custom provider (compliance+)
  GET    /marketplace/orders              — list verification orders (filter by entity)
  POST   /marketplace/orders              — request a verification check
  POST   /marketplace/orders/{id}/complete — record a result (manual/hybrid sign-off
                                              or API callback), bills via UsageRecord

DISCLAIMER: Verification orders support the compliance workflow only.
All regulatory decisions remain with the reporting entity.
"""

from typing import Optional
from uuid import uuid4

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel, Field
from sqlalchemy import or_
from sqlalchemy.orm import Session

from app.api.deps import (
    org_id_for,
    require_analyst_or_above,
    require_compliance_or_above,
)
from app.db.database import get_db
from app.models.marketplace import (
    VerificationCheckType,
    VerificationIntegrationMode,
    VerificationOrder,
    VerificationOrderStatus,
    VerificationProvider,
)
from app.models.user import User
from app.services.marketplace_service import complete_order

router = APIRouter(prefix="/marketplace", tags=["Verification Marketplace"])

DISCLAIMER = (
    "Verification orders support the compliance workflow only. "
    "All regulatory decisions remain with the reporting entity."
)


class ProviderCreate(BaseModel):
    name: str = Field(..., min_length=2, max_length=150)
    description: Optional[str] = None
    check_type: VerificationCheckType
    integration_mode: VerificationIntegrationMode = VerificationIntegrationMode.manual
    vendor_key: Optional[str] = Field(None, max_length=50)
    unit_cost_aud: float = Field(0.0, ge=0.0)
    markup_pct: float = Field(0.0, ge=0.0, le=5.0)


class ProviderUpdate(BaseModel):
    name: Optional[str] = Field(None, min_length=2, max_length=150)
    description: Optional[str] = None
    integration_mode: Optional[VerificationIntegrationMode] = None
    vendor_key: Optional[str] = Field(None, max_length=50)
    unit_cost_aud: Optional[float] = Field(None, ge=0.0)
    markup_pct: Optional[float] = Field(None, ge=0.0, le=5.0)
    is_active: Optional[bool] = None


class OrderCreate(BaseModel):
    provider_id: str
    entity_type: str = Field(..., pattern="^(customer|transaction)$")
    entity_id: str


class OrderComplete(BaseModel):
    accepted: bool = True
    result_summary: Optional[dict] = None
    evidence_url: Optional[str] = None
    screening_record_id: Optional[str] = None


def _provider_dict(p: VerificationProvider) -> dict:
    return {
        "id": p.id,
        "org_id": p.org_id,
        "name": p.name,
        "description": p.description,
        "check_type": p.check_type.value,
        "integration_mode": p.integration_mode.value,
        "vendor_key": p.vendor_key,
        "unit_cost_aud": p.unit_cost_aud,
        "markup_pct": p.markup_pct,
        "is_system": p.is_system,
        "is_active": p.is_active,
    }


def _order_dict(o: VerificationOrder) -> dict:
    return {
        "id": o.id,
        "provider_id": o.provider_id,
        "entity_type": o.entity_type,
        "entity_id": o.entity_id,
        "status": o.status.value,
        "evidence_url": o.evidence_url,
        "result_summary": o.result_summary,
        "screening_record_id": o.screening_record_id,
        "usage_record_id": o.usage_record_id,
        "requested_by": o.requested_by,
        "reviewed_by": o.reviewed_by,
        "created_at": o.created_at,
        "completed_at": o.completed_at,
    }


@router.get("/providers")
def list_providers(
    check_type: Optional[VerificationCheckType] = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_analyst_or_above),
):
    """List verification providers available to this org: system-seeded
    (org_id is null) plus this org's custom entries."""
    org_id = org_id_for(current_user)
    q = db.query(VerificationProvider).filter(
        VerificationProvider.is_active == True,
        or_(
            VerificationProvider.org_id == org_id, VerificationProvider.org_id.is_(None)
        ),
    )
    if check_type is not None:
        q = q.filter(VerificationProvider.check_type == check_type)
    providers = q.order_by(
        VerificationProvider.check_type, VerificationProvider.name
    ).all()
    return {
        "providers": [_provider_dict(p) for p in providers],
        "disclaimer": DISCLAIMER,
    }


@router.post("/providers", status_code=201)
def create_provider(
    payload: ProviderCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_compliance_or_above),
):
    """Add an org-custom verification provider (e.g. a negotiated vendor rate,
    or a manual-review check type not in the system catalogue)."""
    org_id = org_id_for(current_user)
    p = VerificationProvider(
        id=f"vprov_{uuid4().hex[:10]}",
        org_id=org_id,
        created_by=current_user.id,
        **payload.model_dump(),
    )
    db.add(p)
    db.commit()
    db.refresh(p)
    return _provider_dict(p)


@router.patch("/providers/{provider_id}")
def update_provider(
    provider_id: str,
    payload: ProviderUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_compliance_or_above),
):
    org_id = org_id_for(current_user)
    p = (
        db.query(VerificationProvider)
        .filter(
            VerificationProvider.id == provider_id,
            VerificationProvider.org_id == org_id,
        )
        .first()
    )
    if not p:
        raise HTTPException(
            404, "Provider not found, or is a system provider (read-only)."
        )
    for k, v in payload.model_dump(exclude_none=True).items():
        setattr(p, k, v)
    db.commit()
    db.refresh(p)
    return _provider_dict(p)


@router.get("/orders")
def list_orders(
    entity_type: Optional[str] = None,
    entity_id: Optional[str] = None,
    status: Optional[VerificationOrderStatus] = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_analyst_or_above),
):
    org_id = org_id_for(current_user)
    q = db.query(VerificationOrder).filter(VerificationOrder.org_id == org_id)
    if entity_type:
        q = q.filter(VerificationOrder.entity_type == entity_type)
    if entity_id:
        q = q.filter(VerificationOrder.entity_id == entity_id)
    if status:
        q = q.filter(VerificationOrder.status == status)
    orders = q.order_by(VerificationOrder.created_at.desc()).all()
    return {"orders": [_order_dict(o) for o in orders], "disclaimer": DISCLAIMER}


@router.post("/orders", status_code=201)
def create_order(
    payload: OrderCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_analyst_or_above),
):
    """Request a verification check against a customer or transaction.
    For `manual` providers, a compliance/MLRO reviewer later calls
    POST /orders/{id}/complete with evidence; for `api`/`hybrid` providers,
    the integration layer calls the same endpoint once a result is available."""
    org_id = org_id_for(current_user)
    provider = (
        db.query(VerificationProvider)
        .filter(
            VerificationProvider.id == payload.provider_id,
            VerificationProvider.is_active == True,
            or_(
                VerificationProvider.org_id == org_id,
                VerificationProvider.org_id.is_(None),
            ),
        )
        .first()
    )
    if not provider:
        raise HTTPException(404, "Provider not found or not available to this org.")

    order = VerificationOrder(
        id=f"vord_{uuid4().hex[:10]}",
        org_id=org_id,
        provider_id=provider.id,
        entity_type=payload.entity_type,
        entity_id=payload.entity_id,
        status=VerificationOrderStatus.pending,
        requested_by=current_user.id,
    )
    db.add(order)
    db.commit()
    db.refresh(order)
    return _order_dict(order)


@router.post("/orders/{order_id}/complete")
def complete_verification_order(
    order_id: str,
    payload: OrderComplete,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_compliance_or_above),
):
    """
    Record the result of a verification order. Manual/hybrid providers require
    a compliance/MLRO reviewer to call this with evidence_url; billable
    providers (unit_cost_aud > 0) generate a UsageRecord on acceptance.
    """
    org_id = org_id_for(current_user)
    order = (
        db.query(VerificationOrder)
        .filter(VerificationOrder.id == order_id, VerificationOrder.org_id == org_id)
        .first()
    )
    if not order:
        raise HTTPException(404, "Order not found.")
    if order.status in (
        VerificationOrderStatus.completed,
        VerificationOrderStatus.rejected,
    ):
        raise HTTPException(409, "Order has already been completed.")

    provider = (
        db.query(VerificationProvider)
        .filter(VerificationProvider.id == order.provider_id)
        .first()
    )
    if not provider:
        raise HTTPException(404, "Provider for this order no longer exists.")

    complete_order(
        db,
        order,
        provider,
        reviewed_by=current_user.id,
        result_summary=payload.result_summary,
        evidence_url=payload.evidence_url,
        screening_record_id=payload.screening_record_id,
        accepted=payload.accepted,
    )
    db.commit()
    db.refresh(order)
    return _order_dict(order)
