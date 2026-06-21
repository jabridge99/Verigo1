from typing import Optional

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.api.routes.auth import _current_user
from app.db.database import get_db
from app.models.user import User
from app.schemas.tenant import TenantCreate, TenantResponse, TenantSummary, TenantUpdate
from app.services.tenant_service import (
    CustomPackageRequiredError,
    activate_tenant,
    create_tenant,
    get_tenant,
    get_tenant_by_industry,
    list_tenants,
    suspend_tenant,
    tenant_stats,
    update_tenant,
)

router = APIRouter(prefix="/tenants", tags=["Industry Tenants"])


def _require_super_admin(current_user: User = Depends(_current_user)) -> User:
    """
    Tenants are platform-wide industry records, not scoped to any single
    organisation — managing them (create/suspend/activate/list-all/stats)
    is a platform-operator action, gated the same way as the cross-org
    views in organisations.py: User.is_super_admin, not a per-org role.
    """
    if not current_user.is_super_admin:
        raise HTTPException(403, "Super admin privileges required")
    return current_user


@router.post("/", response_model=TenantResponse, status_code=201)
def create(
    payload: TenantCreate,
    db: Session = Depends(get_db),
    _admin: User = Depends(_require_super_admin),
):
    existing = get_tenant_by_industry(db, payload.industry_id)
    if existing:
        raise HTTPException(
            409, f"Tenant for industry '{payload.industry_id}' already exists"
        )
    try:
        return create_tenant(db, payload)
    except CustomPackageRequiredError as exc:
        raise HTTPException(422, str(exc))


@router.get("/", response_model=list[TenantSummary])
def list_all(
    status: Optional[str] = None,
    skip: int = 0,
    limit: int = 100,
    db: Session = Depends(get_db),
    _admin: User = Depends(_require_super_admin),
):
    return list_tenants(db, status=status, skip=skip, limit=limit)


@router.get("/stats")
def stats(
    db: Session = Depends(get_db), _admin: User = Depends(_require_super_admin)
):
    return tenant_stats(db)


@router.get("/{tenant_id}", response_model=TenantResponse)
def get_one(
    tenant_id: str,
    db: Session = Depends(get_db),
    _admin: User = Depends(_require_super_admin),
):
    t = get_tenant(db, tenant_id)
    if not t:
        raise HTTPException(404, "Tenant not found")
    return t


@router.patch("/{tenant_id}", response_model=TenantResponse)
def update_one(
    tenant_id: str,
    payload: TenantUpdate,
    db: Session = Depends(get_db),
    _admin: User = Depends(_require_super_admin),
):
    t = update_tenant(db, tenant_id, payload)
    if not t:
        raise HTTPException(404, "Tenant not found")
    return t


@router.post("/{tenant_id}/suspend", response_model=TenantResponse)
def suspend(
    tenant_id: str,
    db: Session = Depends(get_db),
    _admin: User = Depends(_require_super_admin),
):
    t = suspend_tenant(db, tenant_id)
    if not t:
        raise HTTPException(404, "Tenant not found")
    return t


@router.post("/{tenant_id}/activate", response_model=TenantResponse)
def activate(
    tenant_id: str,
    db: Session = Depends(get_db),
    _admin: User = Depends(_require_super_admin),
):
    t = activate_tenant(db, tenant_id)
    if not t:
        raise HTTPException(404, "Tenant not found")
    return t


@router.get("/by-industry/{industry_id}", response_model=TenantResponse)
def get_by_industry(
    industry_id: str,
    db: Session = Depends(get_db),
    _admin: User = Depends(_require_super_admin),
):
    t = get_tenant_by_industry(db, industry_id)
    if not t:
        raise HTTPException(404, "No tenant found for this industry")
    return t
