"""
White-label branding endpoints.

GET  /branding          — public, no auth needed (frontend loads before login)
GET  /branding/me       — auth'd, returns caller's tenant branding
PUT  /branding          — admin only, update branding for own tenant
DELETE /branding        — admin only, reset to defaults
GET  /branding/css      — returns CSS custom properties for embedding
"""

from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from fastapi.responses import PlainTextResponse
from sqlalchemy.orm import Session

from app.api.routes.auth import _current_user
from app.db.database import get_db
from app.models.user import User
from app.schemas.branding import BrandingConfig, BrandingResponse
from app.services import branding_service as svc

router = APIRouter(prefix="/branding", tags=["branding"])


@router.get("", response_model=BrandingResponse)
def get_branding_public(
    industry_id: Optional[str] = Query(None),
    db: Session = Depends(get_db),
):
    """Unauthenticated — allows the frontend to load branding before login."""
    return svc.get_branding(db, industry_id)


@router.get("/css", response_class=PlainTextResponse)
def get_branding_css(
    industry_id: Optional[str] = Query(None),
    db: Session = Depends(get_db),
):
    """Returns a CSS :root block with custom properties for embedding."""
    branding = svc.get_branding(db, industry_id)
    return svc.preview_css_vars(branding)


@router.get("/me", response_model=BrandingResponse)
def get_my_branding(
    db: Session = Depends(get_db),
    current_user: User = Depends(_current_user),
):
    return svc.get_branding(db, current_user.industry_id)


@router.put("", response_model=BrandingResponse)
def update_branding(
    data: BrandingConfig,
    db: Session = Depends(get_db),
    current_user: User = Depends(_current_user),
):
    if current_user.role != "admin":
        raise HTTPException(403, "Only admins can update branding")
    if not current_user.industry_id:
        raise HTTPException(400, "User has no industry_id — cannot update branding")
    try:
        return svc.update_branding(db, current_user.industry_id, data)
    except ValueError as e:
        raise HTTPException(404, str(e))


@router.delete("", status_code=204)
def reset_branding(
    db: Session = Depends(get_db),
    current_user: User = Depends(_current_user),
):
    if current_user.role != "admin":
        raise HTTPException(403, "Only admins can reset branding")
    if not current_user.industry_id:
        raise HTTPException(400, "User has no industry_id")
    try:
        svc.reset_branding(db, current_user.industry_id)
    except ValueError as e:
        raise HTTPException(404, str(e))
