"""
Risk Matrix Administration API — Phase 2.

Allows compliance officers to customise the organisation's risk matrix:
  - Add / reweight / deactivate risk factors per category
  - Adjust risk profile thresholds (score ranges, review frequency, EDD)
  - Restore industry defaults (full or per-section)
  - View full version history with audit trail

Every change creates an immutable OrgRiskMatrixVersion snapshot.

DISCLAIMER: Risk matrix configuration is a compliance workflow tool.
Risk ratings and scoring decisions remain the responsibility of the reporting entity.
"""
from datetime import datetime, timezone
from typing import Optional
from uuid import uuid4

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session

from app.api.deps import org_id_for, require_analyst_or_above, require_compliance_or_above
from app.db.database import get_db
from app.models.risk_matrix_config import (
    DEFAULT_RISK_PROFILES,
    SYSTEM_RISK_FACTORS,
    OrgRiskFactor,
    OrgRiskMatrixVersion,
    OrgRiskProfile,
    RiskFactorCategory,
    RiskLevel,
)
from app.models.user import User

router = APIRouter(prefix="/risk-matrix", tags=["Risk Matrix Configuration"])

DISCLAIMER = (
    "Risk matrix configuration is a compliance workflow tool. "
    "Risk ratings and scoring decisions remain the responsibility of the reporting entity."
)


# ── Schemas ───────────────────────────────────────────────────────────────────

class RiskFactorCreate(BaseModel):
    category:       RiskFactorCategory
    factor_key:     str = Field(..., min_length=3, max_length=100)
    label:          str = Field(..., min_length=3, max_length=255)
    description:    Optional[str] = None
    weight:         float = Field(..., ge=0.0, le=1.0)
    display_order:  int = Field(default=0, ge=0)


class RiskFactorUpdate(BaseModel):
    label:          Optional[str] = Field(None, max_length=255)
    description:    Optional[str] = None
    weight:         Optional[float] = Field(None, ge=0.0, le=1.0)
    is_active:      Optional[bool] = None
    display_order:  Optional[int] = None


class RiskProfileUpdate(BaseModel):
    score_min:                  Optional[float] = Field(None, ge=0.0, le=100.0)
    score_max:                  Optional[float] = Field(None, ge=0.0, le=100.0)
    review_frequency_months:    Optional[int] = Field(None, ge=1, le=120)
    edd_required:               Optional[bool] = None
    enhanced_monitoring:        Optional[bool] = None
    senior_approval_required:   Optional[bool] = None
    description:                Optional[str] = None


class WeightRebalanceRequest(BaseModel):
    category:   RiskFactorCategory
    weights:    dict[str, float]    # {factor_key: weight}
    reason:     str = Field(..., min_length=10)


# ── Helpers ───────────────────────────────────────────────────────────────────

def _factor_dict(f: OrgRiskFactor) -> dict:
    return {
        "id": f.id,
        "category": f.category.value,
        "factor_key": f.factor_key,
        "label": f.label,
        "description": f.description,
        "weight": f.weight,
        "is_active": f.is_active,
        "is_system": f.is_system,
        "display_order": f.display_order,
        "updated_by": f.updated_by,
        "updated_at": f.updated_at,
    }


def _profile_dict(p: OrgRiskProfile) -> dict:
    return {
        "id": p.id,
        "risk_level": p.risk_level.value,
        "score_min": p.score_min,
        "score_max": p.score_max,
        "review_frequency_months": p.review_frequency_months,
        "edd_required": p.edd_required,
        "enhanced_monitoring": p.enhanced_monitoring,
        "senior_approval_required": p.senior_approval_required,
        "description": p.description,
        "updated_at": p.updated_at,
    }


def _snapshot_factors(org_id: str, db: Session) -> list[dict]:
    factors = db.query(OrgRiskFactor).filter(OrgRiskFactor.org_id == org_id).all()
    return [_factor_dict(f) for f in factors]


def _snapshot_profiles(org_id: str, db: Session) -> list[dict]:
    profiles = db.query(OrgRiskProfile).filter(OrgRiskProfile.org_id == org_id).all()
    return [_profile_dict(p) for p in profiles]


def _next_version(org_id: str, db: Session) -> int:
    latest = (
        db.query(OrgRiskMatrixVersion)
        .filter(OrgRiskMatrixVersion.org_id == org_id)
        .order_by(OrgRiskMatrixVersion.version_number.desc())
        .first()
    )
    return (latest.version_number + 1) if latest else 1


def _record_version(
    org_id: str,
    user_id: str,
    change_type: str,
    change_summary: str,
    db: Session,
    reason: str = "",
    previous_value=None,
    new_value=None,
):
    db.add(OrgRiskMatrixVersion(
        id=f"rmv_{uuid4().hex[:12]}",
        org_id=org_id,
        version_number=_next_version(org_id, db),
        change_type=change_type,
        change_summary=change_summary,
        factors_snapshot=_snapshot_factors(org_id, db),
        profiles_snapshot=_snapshot_profiles(org_id, db),
        changed_by=user_id,
        change_reason=reason or change_summary,
        previous_value=previous_value,
        new_value=new_value,
    ))


def _ensure_defaults(org_id: str, user_id: str, db: Session):
    """Seed system factors + risk profiles if this org has no risk matrix yet."""
    existing = db.query(OrgRiskFactor).filter(OrgRiskFactor.org_id == org_id).count()
    if existing > 0:
        return

    for category, factors in SYSTEM_RISK_FACTORS.items():
        for i, f in enumerate(factors):
            db.add(OrgRiskFactor(
                id=f"orf_{uuid4().hex[:10]}",
                org_id=org_id,
                category=category,
                factor_key=f["key"],
                label=f["label"],
                description=f["description"],
                weight=f["weight"],
                is_system=True,
                is_active=True,
                display_order=i,
                created_by=user_id,
            ))

    for prof in DEFAULT_RISK_PROFILES:
        db.add(OrgRiskProfile(
            id=f"orp_{uuid4().hex[:10]}",
            org_id=org_id,
            risk_level=prof["risk_level"],
            score_min=prof["score_min"],
            score_max=prof["score_max"],
            review_frequency_months=prof["review_frequency_months"],
            edd_required=prof["edd_required"],
            enhanced_monitoring=prof["enhanced_monitoring"],
            description=prof["description"],
            updated_by=user_id,
        ))

    db.flush()
    _record_version(org_id, user_id, "seeded_defaults",
                    "System defaults seeded at first access", db)


# ── Risk Factor Endpoints ─────────────────────────────────────────────────────

@router.get("/factors")
def list_risk_factors(
    category: Optional[RiskFactorCategory] = Query(None),
    active_only: bool = Query(True),
    db: Session = Depends(get_db),
    current_user: User = Depends(require_analyst_or_above),
):
    """
    List all risk factors for this org, optionally filtered by category.
    System factors are shown with is_system=True.
    """
    org_id = org_id_for(current_user)
    _ensure_defaults(org_id, current_user.id, db)
    db.commit()

    q = db.query(OrgRiskFactor).filter(OrgRiskFactor.org_id == org_id)
    if category:
        q = q.filter(OrgRiskFactor.category == category)
    if active_only:
        q = q.filter(OrgRiskFactor.is_active == True)
    q = q.order_by(OrgRiskFactor.category, OrgRiskFactor.display_order)

    by_category: dict[str, list] = {}
    for f in q.all():
        cat = f.category.value
        by_category.setdefault(cat, []).append(_factor_dict(f))

    # Category weight totals (for validation UI)
    weight_totals = {cat: round(sum(f["weight"] for f in items), 4)
                     for cat, items in by_category.items()}

    return {
        "by_category": by_category,
        "weight_totals": weight_totals,
        "disclaimer": DISCLAIMER,
    }


@router.post("/factors", status_code=201)
def add_risk_factor(
    payload: RiskFactorCreate,
    reason: str = Query(..., min_length=10),
    db: Session = Depends(get_db),
    current_user: User = Depends(require_compliance_or_above),
):
    """
    Add a custom risk factor to a category.
    Maximum 20 factors per category. factor_key must be unique within org.
    """
    org_id = org_id_for(current_user)
    _ensure_defaults(org_id, current_user.id, db)

    existing_key = db.query(OrgRiskFactor).filter(
        OrgRiskFactor.org_id == org_id,
        OrgRiskFactor.factor_key == payload.factor_key,
    ).first()
    if existing_key:
        raise HTTPException(409, f"Factor key '{payload.factor_key}' already exists.")

    count = db.query(OrgRiskFactor).filter(
        OrgRiskFactor.org_id == org_id,
        OrgRiskFactor.category == payload.category,
    ).count()
    if count >= 20:
        raise HTTPException(409, "Maximum of 20 factors per category.")

    f = OrgRiskFactor(
        id=f"orf_{uuid4().hex[:10]}",
        org_id=org_id,
        category=payload.category,
        factor_key=payload.factor_key,
        label=payload.label,
        description=payload.description,
        weight=payload.weight,
        display_order=payload.display_order,
        is_system=False,
        is_active=True,
        created_by=current_user.id,
        updated_by=current_user.id,
    )
    db.add(f)
    db.flush()
    _record_version(org_id, current_user.id, "factor_added",
                    f"Added factor '{payload.label}' to {payload.category.value}", db,
                    reason=reason, new_value=_factor_dict(f))
    db.commit()
    db.refresh(f)
    return _factor_dict(f)


@router.patch("/factors/{factor_id}")
def update_risk_factor(
    factor_id: str,
    payload: RiskFactorUpdate,
    reason: str = Query(..., min_length=10),
    db: Session = Depends(get_db),
    current_user: User = Depends(require_compliance_or_above),
):
    """
    Update a risk factor's label, description, weight, or active status.
    System factors (is_system=True) can have their weight changed but cannot be deleted.
    """
    org_id = org_id_for(current_user)
    f = db.query(OrgRiskFactor).filter(
        OrgRiskFactor.id == factor_id,
        OrgRiskFactor.org_id == org_id,
    ).first()
    if not f:
        raise HTTPException(404, "Risk factor not found.")

    prev = _factor_dict(f)
    for k, v in payload.model_dump(exclude_none=True).items():
        setattr(f, k, v)
    f.updated_by = current_user.id

    db.flush()
    _record_version(org_id, current_user.id, "factor_updated",
                    f"Updated factor '{f.label}'", db,
                    reason=reason, previous_value=prev, new_value=_factor_dict(f))
    db.commit()
    db.refresh(f)
    return _factor_dict(f)


@router.delete("/factors/{factor_id}", status_code=204)
def delete_risk_factor(
    factor_id: str,
    reason: str = Query(..., min_length=10),
    db: Session = Depends(get_db),
    current_user: User = Depends(require_compliance_or_above),
):
    """
    Permanently delete a custom risk factor.
    System factors (is_system=True) cannot be deleted — deactivate instead.
    """
    org_id = org_id_for(current_user)
    f = db.query(OrgRiskFactor).filter(
        OrgRiskFactor.id == factor_id,
        OrgRiskFactor.org_id == org_id,
    ).first()
    if not f:
        raise HTTPException(404, "Risk factor not found.")
    if f.is_system:
        raise HTTPException(409, "System risk factors cannot be deleted. Set is_active=False to disable.")

    prev = _factor_dict(f)
    _record_version(org_id, current_user.id, "factor_deleted",
                    f"Deleted custom factor '{f.label}'", db,
                    reason=reason, previous_value=prev)
    db.delete(f)
    db.commit()


@router.post("/factors/rebalance")
def rebalance_weights(
    payload: WeightRebalanceRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_compliance_or_above),
):
    """
    Rebalance weights for all factors within a category in one operation.
    Weights must sum to 1.0 ± 0.01.
    """
    org_id = org_id_for(current_user)

    total = sum(payload.weights.values())
    if abs(total - 1.0) > 0.01:
        raise HTTPException(422, f"Weights must sum to 1.0 (got {total:.4f}).")

    factors = db.query(OrgRiskFactor).filter(
        OrgRiskFactor.org_id == org_id,
        OrgRiskFactor.category == payload.category,
        OrgRiskFactor.is_active == True,
    ).all()

    prev = {f.factor_key: f.weight for f in factors}
    updated = []
    for f in factors:
        if f.factor_key in payload.weights:
            f.weight = payload.weights[f.factor_key]
            f.updated_by = current_user.id
            updated.append(f.factor_key)

    db.flush()
    _record_version(org_id, current_user.id, "weights_rebalanced",
                    f"Rebalanced {len(updated)} weights in {payload.category.value}", db,
                    reason=payload.reason, previous_value=prev, new_value=payload.weights)
    db.commit()
    return {"category": payload.category.value, "updated": updated, "new_weights": payload.weights}


# ── Risk Profile Endpoints ────────────────────────────────────────────────────

@router.get("/profiles")
def list_risk_profiles(
    db: Session = Depends(get_db),
    current_user: User = Depends(require_analyst_or_above),
):
    """
    Return the org's risk profile thresholds (score ranges per risk level).
    """
    org_id = org_id_for(current_user)
    _ensure_defaults(org_id, current_user.id, db)
    db.commit()

    profiles = (
        db.query(OrgRiskProfile)
        .filter(OrgRiskProfile.org_id == org_id)
        .order_by(OrgRiskProfile.score_min)
        .all()
    )
    return {
        "profiles": [_profile_dict(p) for p in profiles],
        "disclaimer": DISCLAIMER,
    }


@router.patch("/profiles/{risk_level}")
def update_risk_profile(
    risk_level: RiskLevel,
    payload: RiskProfileUpdate,
    reason: str = Query(..., min_length=10),
    db: Session = Depends(get_db),
    current_user: User = Depends(require_compliance_or_above),
):
    """
    Update a risk profile threshold for a specific risk level.
    Ensure score ranges don't overlap after update.

    DISCLAIMER: Risk threshold changes affect all future risk assessments.
    """
    org_id = org_id_for(current_user)
    profile = db.query(OrgRiskProfile).filter(
        OrgRiskProfile.org_id == org_id,
        OrgRiskProfile.risk_level == risk_level,
    ).first()
    if not profile:
        raise HTTPException(404, "Risk profile not found. Ensure defaults are loaded first.")

    prev = _profile_dict(profile)

    if payload.score_min is not None and payload.score_max is not None:
        if payload.score_min >= payload.score_max:
            raise HTTPException(422, "score_min must be less than score_max.")

    for k, v in payload.model_dump(exclude_none=True).items():
        setattr(profile, k, v)
    profile.updated_by = current_user.id

    db.flush()
    _record_version(org_id, current_user.id, "profile_updated",
                    f"Updated {risk_level.value} risk profile thresholds", db,
                    reason=reason, previous_value=prev, new_value=_profile_dict(profile))
    db.commit()
    db.refresh(profile)
    return _profile_dict(profile)


# ── Restore Defaults ──────────────────────────────────────────────────────────

@router.post("/restore-defaults")
def restore_defaults(
    category: Optional[RiskFactorCategory] = Query(None, description="Restore only this category; omit for full restore"),
    section: Optional[str] = Query(None, description="profiles | factors | all"),
    reason: str = Query(..., min_length=10),
    db: Session = Depends(get_db),
    current_user: User = Depends(require_compliance_or_above),
):
    """
    Restore risk matrix to VeriGo industry defaults.

    Options:
      category=customer   — restore only customer risk factors
      section=profiles    — restore only risk profile thresholds
      section=factors     — restore all factors (or just one category)
      section=all         — full restore (factors + profiles)

    All custom factors are DELETED. System factors are reset to default weights.
    This action is logged in the version history and cannot be undone.

    DISCLAIMER: Restoring defaults will override all previous customisations.
    """
    org_id = org_id_for(current_user)
    restored = []

    restore_section = section or "all"
    if restore_section in ("factors", "all"):
        # Delete non-system factors (system factors are reset)
        q = db.query(OrgRiskFactor).filter(OrgRiskFactor.org_id == org_id)
        if category:
            q = q.filter(OrgRiskFactor.category == category)

        # Delete custom
        custom = q.filter(OrgRiskFactor.is_system == False).all()
        for f in custom:
            db.delete(f)

        # Reset system factor weights
        cats_to_restore = [category.value] if category else list(SYSTEM_RISK_FACTORS.keys())
        for cat in cats_to_restore:
            for default_f in SYSTEM_RISK_FACTORS.get(cat, []):
                existing = db.query(OrgRiskFactor).filter(
                    OrgRiskFactor.org_id == org_id,
                    OrgRiskFactor.factor_key == default_f["key"],
                ).first()
                if existing:
                    existing.weight = default_f["weight"]
                    existing.label = default_f["label"]
                    existing.is_active = True
                    existing.updated_by = current_user.id
                else:
                    db.add(OrgRiskFactor(
                        id=f"orf_{uuid4().hex[:10]}",
                        org_id=org_id,
                        category=cat,
                        factor_key=default_f["key"],
                        label=default_f["label"],
                        description=default_f["description"],
                        weight=default_f["weight"],
                        is_system=True,
                        is_active=True,
                        created_by=current_user.id,
                        updated_by=current_user.id,
                    ))
        restored.append("factors")

    if restore_section in ("profiles", "all"):
        for default_p in DEFAULT_RISK_PROFILES:
            existing = db.query(OrgRiskProfile).filter(
                OrgRiskProfile.org_id == org_id,
                OrgRiskProfile.risk_level == default_p["risk_level"],
            ).first()
            if existing:
                existing.score_min = default_p["score_min"]
                existing.score_max = default_p["score_max"]
                existing.review_frequency_months = default_p["review_frequency_months"]
                existing.edd_required = default_p["edd_required"]
                existing.enhanced_monitoring = default_p["enhanced_monitoring"]
                existing.description = default_p["description"]
                existing.updated_by = current_user.id
        restored.append("profiles")

    db.flush()
    _record_version(org_id, current_user.id, "restored_defaults",
                    f"Restored defaults: {', '.join(restored)}"
                    + (f" (category: {category.value})" if category else ""),
                    db, reason=reason)
    db.commit()
    return {
        "restored": restored,
        "category": category.value if category else "all",
        "disclaimer": DISCLAIMER,
    }


# ── Version History ───────────────────────────────────────────────────────────

@router.get("/versions")
def list_versions(
    limit: int = Query(default=20, ge=1, le=100),
    db: Session = Depends(get_db),
    current_user: User = Depends(require_compliance_or_above),
):
    """
    Return the version history of this org's risk matrix configuration.
    Each version is an immutable snapshot of factors and profiles at time of change.
    """
    org_id = org_id_for(current_user)
    versions = (
        db.query(OrgRiskMatrixVersion)
        .filter(OrgRiskMatrixVersion.org_id == org_id)
        .order_by(OrgRiskMatrixVersion.version_number.desc())
        .limit(limit)
        .all()
    )
    return [
        {
            "id": v.id,
            "version_number": v.version_number,
            "change_type": v.change_type,
            "change_summary": v.change_summary,
            "changed_by": v.changed_by,
            "change_reason": v.change_reason,
            "previous_value": v.previous_value,
            "new_value": v.new_value,
            "created_at": v.created_at,
        }
        for v in versions
    ]


@router.get("/versions/{version_id}")
def get_version_snapshot(
    version_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_compliance_or_above),
):
    """Return the full factors and profiles snapshot for a specific version."""
    org_id = org_id_for(current_user)
    v = db.query(OrgRiskMatrixVersion).filter(
        OrgRiskMatrixVersion.id == version_id,
        OrgRiskMatrixVersion.org_id == org_id,
    ).first()
    if not v:
        raise HTTPException(404, "Version not found.")
    return {
        "id": v.id,
        "version_number": v.version_number,
        "change_type": v.change_type,
        "change_summary": v.change_summary,
        "changed_by": v.changed_by,
        "change_reason": v.change_reason,
        "factors_snapshot": v.factors_snapshot,
        "profiles_snapshot": v.profiles_snapshot,
        "created_at": v.created_at,
    }
