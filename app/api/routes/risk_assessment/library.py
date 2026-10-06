"""
Risk Assessment — read-only risk-factor library and the org-custom
mitigation catalogue. Neither touches RiskAssessmentRun, unlike the rest of
the risk_assessment package — genuinely standalone reference data.
Part of the risk_assessment route package; see __init__.py for the combined
router.
"""

from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session

from app.api.deps import get_current_user, org_id_for, require_mlro_or_above
from app.api.routes.risk_assessment._shared import _log
from app.db.database import get_db
from app.models.mitigation_library import MitigationCategory, MitigationLibraryItem
from app.models.user import User

router = APIRouter()


# ── Library (read-only templates) ─────────────────────────────────────────────


@router.get("/library")
def list_library_factors(
    industry: Optional[str] = Query(None),
    category_type: Optional[str] = Query(None),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    from app.models.risk_engine import RiskLibraryFactor

    q = db.query(RiskLibraryFactor)
    if industry:
        q = q.filter(RiskLibraryFactor.industry.in_([industry, "all"]))
    if category_type:
        q = q.filter(RiskLibraryFactor.category_type == category_type)
    return q.order_by(
        RiskLibraryFactor.category_type, RiskLibraryFactor.sort_order
    ).all()


# ── Mitigation Library (reusable catalogue) ────────────────────────────────────


@router.get("/mitigation-library")
def list_mitigation_library(
    category: Optional[MitigationCategory] = Query(None),
    industry: Optional[str] = Query(None),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """System-seeded items (org_id null) plus this org's custom additions."""
    org_id = org_id_for(current_user)
    q = db.query(MitigationLibraryItem).filter(
        (MitigationLibraryItem.org_id.is_(None))
        | (MitigationLibraryItem.org_id == org_id),
        MitigationLibraryItem.is_active.is_(True),
    )
    if category:
        q = q.filter(MitigationLibraryItem.category == category)
    items = q.order_by(MitigationLibraryItem.name).all()
    if industry:
        items = [
            i
            for i in items
            if not i.applicable_industries or industry in i.applicable_industries
        ]
    return items


@router.post("/mitigation-library")
def create_mitigation_library_item(
    name: str = Query(...),
    description: Optional[str] = Query(None),
    category: MitigationCategory = Query(MitigationCategory.other),
    control_weighting: float = Query(0.1, ge=0.0, le=1.0),
    applicable_industries: Optional[List[str]] = Query(None),
    risk_categories: Optional[List[str]] = Query(None),
    current_user: User = Depends(require_mlro_or_above),
    db: Session = Depends(get_db),
):
    """Director/MLRO/Compliance only — org-scoped custom mitigation catalogue entry."""
    item = MitigationLibraryItem(
        org_id=org_id_for(current_user),
        name=name,
        description=description,
        category=category,
        control_weighting=control_weighting,
        applicable_industries=applicable_industries or [],
        risk_categories=risk_categories or [],
        created_by=current_user.id,
    )
    db.add(item)
    db.commit()
    # refresh() must be the last DB call before return -- see
    # framework.py's add_custom_factor() comment for why.
    _log(
        db,
        current_user,
        "mitigation_library_item",
        item.id,
        "mitigation_library_item_created",
        notes=name,
    )
    db.refresh(item)
    return item


@router.patch("/mitigation-library/{item_id}")
def update_mitigation_library_item(
    item_id: str,
    name: Optional[str] = Query(None),
    description: Optional[str] = Query(None),
    control_weighting: Optional[float] = Query(None, ge=0.0, le=1.0),
    is_active: Optional[bool] = Query(None),
    current_user: User = Depends(require_mlro_or_above),
    db: Session = Depends(get_db),
):
    item = (
        db.query(MitigationLibraryItem)
        .filter(
            MitigationLibraryItem.id == item_id,
            MitigationLibraryItem.org_id == org_id_for(current_user),
        )
        .first()
    )
    if not item:
        raise HTTPException(
            404, "Mitigation library item not found (system-seeded items are read-only)"
        )
    if name is not None:
        item.name = name
    if description is not None:
        item.description = description
    if control_weighting is not None:
        item.control_weighting = control_weighting
    if is_active is not None:
        item.is_active = is_active
    db.commit()
    # refresh() must be the last DB call before return -- see
    # framework.py's add_custom_factor() comment for why.
    _log(
        db,
        current_user,
        "mitigation_library_item",
        item.id,
        "mitigation_library_item_updated",
    )
    db.refresh(item)
    return item
