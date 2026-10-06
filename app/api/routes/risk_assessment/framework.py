"""
Risk Assessment — Framework and Risk Factor configuration endpoints.
Part of the risk_assessment route package; see __init__.py for the combined
router. DISCLAIMER, _get_framework, and _log live in _shared.py.
"""

from typing import Optional

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.api.deps import (
    get_current_user,
    org_id_for,
    require_compliance_or_above,
    require_mlro_or_above,
)
from app.api.routes.risk_assessment._shared import DISCLAIMER, _get_framework, _log
from app.db.database import get_db
from app.models.risk_engine import RiskCategory, RiskCategoryType, RiskFactor
from app.models.user import User

router = APIRouter()


# ── Framework ─────────────────────────────────────────────────────────────────


@router.get("/framework")
def get_framework(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    fw = _get_framework(org_id_for(current_user), db)
    categories = (
        db.query(RiskCategory)
        .filter(
            RiskCategory.framework_id == fw.id,
            RiskCategory.is_active == True,
        )
        .order_by(RiskCategory.sort_order)
        .all()
    )

    return {
        "id": fw.id,
        "name": fw.name,
        "industry": fw.industry,
        "category_weights": fw.category_weights,
        "governance_disclaimer": DISCLAIMER,
        "categories": [
            {
                "id": c.id,
                "type": c.category_type.value,
                "name": c.name,
                "description": c.description,
                "weight": fw.category_weights.get(c.category_type.value, c.weight),
                "factor_count": db.query(RiskFactor)
                .filter(
                    RiskFactor.category_id == c.id,
                    RiskFactor.is_active == True,
                )
                .count(),
            }
            for c in categories
        ],
        "created_at": fw.created_at,
    }


@router.patch("/framework/weights")
def update_category_weights(
    weights: dict,
    current_user: User = Depends(require_mlro_or_above),
    db: Session = Depends(get_db),
):
    """Update category weights. Values must be > 0; platform will normalise to sum = 1."""
    fw = _get_framework(org_id_for(current_user), db)
    valid_types = {t.value for t in RiskCategoryType}
    for k in weights:
        if k not in valid_types:
            raise HTTPException(422, f"Unknown category type: '{k}'")
        if weights[k] < 0:
            raise HTTPException(422, f"Weight for '{k}' must be >= 0")

    total = sum(weights.values())
    if total == 0:
        raise HTTPException(422, "At least one weight must be > 0")

    # Normalise
    fw.category_weights = {k: round(v / total, 4) for k, v in weights.items()}
    db.commit()
    _log(db, current_user, "risk_framework", fw.id, "risk_category_weights_updated")
    return {"category_weights": fw.category_weights}


# ── Risk Factors ──────────────────────────────────────────────────────────────


@router.get("/framework/categories/{category_id}/factors")
def list_factors(
    category_id: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    oid = org_id_for(current_user)
    fw = _get_framework(oid, db)
    cat = (
        db.query(RiskCategory)
        .filter(
            RiskCategory.id == category_id,
            RiskCategory.framework_id == fw.id,
        )
        .first()
    )
    if not cat:
        raise HTTPException(404, "Category not found")

    factors = (
        db.query(RiskFactor)
        .filter(
            RiskFactor.category_id == category_id,
            RiskFactor.is_active == True,
        )
        .order_by(RiskFactor.sort_order)
        .all()
    )

    return [
        {
            "id": f.id,
            "factor_ref": f.factor_ref,
            "name": f.name,
            "description": f.description,
            "rationale": f.rationale,
            "is_mandatory": f.is_mandatory,
            "suggested_likelihood": f.suggested_likelihood,
            "suggested_consequence": f.suggested_consequence,
            "suggested_control_effectiveness": f.suggested_control_effectiveness,
            "mitigation_examples": f.mitigation_examples,
            "regulatory_references": f.regulatory_references,
        }
        for f in factors
    ]


@router.post("/framework/categories/{category_id}/factors")
def add_custom_factor(
    category_id: str,
    name: str,
    description: Optional[str] = None,
    rationale: Optional[str] = None,
    current_user: User = Depends(require_compliance_or_above),
    db: Session = Depends(get_db),
):
    oid = org_id_for(current_user)
    fw = _get_framework(oid, db)
    cat = (
        db.query(RiskCategory)
        .filter(
            RiskCategory.id == category_id,
            RiskCategory.framework_id == fw.id,
        )
        .first()
    )
    if not cat:
        raise HTTPException(404, "Category not found")

    count = db.query(RiskFactor).filter(RiskFactor.category_id == category_id).count()
    factor = RiskFactor(
        category_id=category_id,
        org_id=oid,
        factor_ref=f"{cat.category_type.value[:2].upper()}-C{str(count + 1).zfill(3)}",
        name=name,
        description=description,
        rationale=rationale,
        created_by=current_user.id,
    )
    db.add(factor)
    db.commit()
    # _log() below issues its own db.commit(), which (default
    # expire_on_commit=True) expires every attribute on `factor` again.
    # Returning an ORM object with no response_model serialises via a
    # vars()-based fallback that doesn't trigger SQLAlchemy's normal
    # lazy-reload-on-access, so it silently produced `{}` unless refresh()
    # is the very last DB call before return -- see risk_assessment.py's
    # create_mitigation_library_item() history for the same bug.
    _log(db, current_user, "risk_factor", factor.id, "risk_factor_added", notes=name)
    db.refresh(factor)
    return factor
