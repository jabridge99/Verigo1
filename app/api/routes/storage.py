"""
Storage configuration endpoints.

GET    /storage/config                       — current user's tenant storage config
PUT    /storage/config                       — bring-your-own-storage (Enterprise/VVIP only)
DELETE /storage/config                       — revert tenant to the platform default
GET    /storage/admin/{industry_id}           — admin: view any tenant's storage config
PUT    /storage/admin/{industry_id}           — admin: assign storage for any tenant
DELETE /storage/admin/{industry_id}           — admin: revert a tenant to the platform default
"""

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.api.routes.auth import _current_user, _require_roles
from app.db.database import get_db
from app.models.billing import BillingPlan
from app.models.user import User, UserRole
from app.schemas.storage import StorageConfigInput, StorageConfigResponse
from app.services import billing_service
from app.services import storage_config_service as svc

router = APIRouter(prefix="/storage", tags=["storage"])

_ADMIN = _require_roles(UserRole.admin)

# "Custom plan" = bring-your-own-storage is gated to these tiers.
_CUSTOM_STORAGE_PLANS = {BillingPlan.enterprise, BillingPlan.vvip}


def _require_custom_storage_plan(db: Session, current_user: User) -> None:
    if not current_user.industry_id:
        raise HTTPException(400, "User has no industry_id")
    sub = billing_service.get_subscription(
        db,
        current_user.industry_id,
        getattr(current_user, "primary_organisation_id", None),
    )
    if not sub or sub.plan not in _CUSTOM_STORAGE_PLANS:
        raise HTTPException(
            403,
            "Bring-your-own storage is available on the Enterprise and VVIP plans only.",
        )


# ── Self-service (tenant's own storage) ─────────────────────────────────────────


@router.get("/config", response_model=StorageConfigResponse)
def my_storage_config(
    db: Session = Depends(get_db),
    current_user: User = Depends(_current_user),
):
    if not current_user.industry_id:
        raise HTTPException(400, "User has no industry_id")
    return StorageConfigResponse.from_config(
        svc.get_config(db, current_user.industry_id)
    )


@router.put("/config", response_model=StorageConfigResponse)
async def set_my_storage_config(
    data: StorageConfigInput,
    db: Session = Depends(get_db),
    current_user: User = Depends(_current_user),
):
    _require_custom_storage_plan(db, current_user)
    try:
        cfg = await svc.set_config(db, current_user.industry_id, data)
    except ValueError as e:
        raise HTTPException(400, str(e))
    return StorageConfigResponse.from_config(cfg)


@router.delete("/config", response_model=StorageConfigResponse)
def clear_my_storage_config(
    db: Session = Depends(get_db),
    current_user: User = Depends(_current_user),
):
    if not current_user.industry_id:
        raise HTTPException(400, "User has no industry_id")
    svc.clear_config(db, current_user.industry_id)
    return StorageConfigResponse.from_config({})


# ── Admin (assign storage per tenant, any plan) ─────────────────────────────────


@router.get("/admin/{industry_id}", response_model=StorageConfigResponse)
def admin_get_storage_config(
    industry_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(_ADMIN),
):
    return StorageConfigResponse.from_config(svc.get_config(db, industry_id))


@router.put("/admin/{industry_id}", response_model=StorageConfigResponse)
async def admin_set_storage_config(
    industry_id: str,
    data: StorageConfigInput,
    db: Session = Depends(get_db),
    current_user: User = Depends(_ADMIN),
):
    try:
        cfg = await svc.set_config(db, industry_id, data)
    except ValueError as e:
        raise HTTPException(400, str(e))
    return StorageConfigResponse.from_config(cfg)


@router.delete("/admin/{industry_id}", response_model=StorageConfigResponse)
def admin_clear_storage_config(
    industry_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(_ADMIN),
):
    if not svc.clear_config(db, industry_id):
        raise HTTPException(404, "Tenant not found")
    return StorageConfigResponse.from_config({})
