"""
Governance Training — course catalogue: seeding standard/industry-pack
courses and org-custom course CRUD. Part of the governance/training route
package; see __init__.py for the combined router.
"""

from __future__ import annotations

from typing import Optional
from uuid import uuid4

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session

from app.api.deps import org_id_for, require_analyst_or_above, require_mlro_or_above
from app.api.routes.governance.training._shared import (
    _course_dict,
    _get_course,
    _get_solution,
)
from app.db.database import get_db
from app.models.governance_training import (
    INDUSTRY_TRAINING_PACKS,
    STANDARD_TRAINING_COURSES,
    TrainingCourse,
    TrainingType,
)
from app.models.user import User
from app.schemas.governance_training import CourseCreate, CourseUpdate

router = APIRouter()


# ── Course Catalogue ──────────────────────────────────────────────────────────


@router.post("/courses/seed", status_code=201)
def seed_standard_courses(
    db: Session = Depends(get_db),
    current_user: User = Depends(require_mlro_or_above),
):
    """
    Seed the standard AML/CTF training course catalogue for this org.

    Idempotent — only creates courses that don't already exist (by course_code).
    Standard courses are read-only (is_custom = False).

    Seeded courses align to AUSTRAC AML/CTF Rules 2025 and FATF R.18:
      TRN-IND-001 — AML/CTF Induction (all staff, annual)
      TRN-ANN-001 — Annual AML/CTF Refresher (all staff, annual)
      TRN-CDD-001 — CDD Training (analyst+)
      TRN-SMR-001 — SMR Training (analyst+)
      TRN-SANC-001 — Sanctions Training (analyst+)
      TRN-BRD-001 — Board AML/CTF Governance (admin)
      TRN-MLRO-001 — MLRO Certification (mlro, compliance)
    """
    org_id = org_id_for(current_user)
    solution = _get_solution(org_id, db)

    existing_codes = {
        c.course_code
        for c in db.query(TrainingCourse.course_code)
        .filter(TrainingCourse.org_id == org_id)
        .all()
    }

    seeded = 0
    for seed in STANDARD_TRAINING_COURSES:
        if seed["course_code"] in existing_codes:
            continue
        db.add(
            TrainingCourse(
                id=f"tc_{uuid4().hex[:12]}",
                org_id=org_id,
                solution_id=solution.id,
                is_custom=False,
                created_by=current_user.id,
                **seed,
            )
        )
        seeded += 1

    db.commit()
    return {
        "seeded": seeded,
        "already_existed": len(existing_codes),
        "message": f"{seeded} standard courses added."
        if seeded
        else "All standard courses already seeded.",
    }


@router.post("/courses/seed-industry-pack", status_code=201)
def seed_industry_pack(
    industry: Optional[str] = Query(
        None,
        description="IndustryType value, e.g. 'remittance'. Omit to seed all packs.",
    ),
    db: Session = Depends(get_db),
    current_user: User = Depends(require_mlro_or_above),
):
    """
    Seed industry-specific training pack course(s) for this org.

    Available packs: remittance, financial_services (covers FX & PSP),
    vasp (crypto), legal_professionals, accountants, real_estate, conveyancers.

    Idempotent — only creates courses that don't already exist (by course_code).
    Pass no `industry` to seed every pack at once.
    """
    org_id = org_id_for(current_user)
    solution = _get_solution(org_id, db)

    if industry is not None and industry not in INDUSTRY_TRAINING_PACKS:
        raise HTTPException(
            404,
            f"Unknown industry pack '{industry}'. Available: "
            f"{', '.join(INDUSTRY_TRAINING_PACKS.keys())}",
        )

    packs = (
        {industry: INDUSTRY_TRAINING_PACKS[industry]}
        if industry
        else INDUSTRY_TRAINING_PACKS
    )

    existing_codes = {
        c.course_code
        for c in db.query(TrainingCourse.course_code)
        .filter(TrainingCourse.org_id == org_id)
        .all()
    }

    seeded = 0
    for seeds in packs.values():
        for seed in seeds:
            if seed["course_code"] in existing_codes:
                continue
            db.add(
                TrainingCourse(
                    id=f"tc_{uuid4().hex[:12]}",
                    org_id=org_id,
                    solution_id=solution.id,
                    is_custom=False,
                    created_by=current_user.id,
                    **seed,
                )
            )
            seeded += 1

    db.commit()
    return {
        "seeded": seeded,
        "packs_seeded": list(packs.keys()),
        "message": f"{seeded} industry-pack course(s) added."
        if seeded
        else "All requested industry-pack courses already seeded.",
    }


@router.get("/courses")
def list_courses(
    training_type: Optional[TrainingType] = Query(None),
    is_mandatory: Optional[bool] = Query(None),
    is_active: Optional[bool] = Query(True),
    is_custom: Optional[bool] = Query(None),
    db: Session = Depends(get_db),
    current_user: User = Depends(require_analyst_or_above),
):
    """List all training courses in this org's catalogue."""
    org_id = org_id_for(current_user)
    q = db.query(TrainingCourse).filter(TrainingCourse.org_id == org_id)
    if training_type:
        q = q.filter(TrainingCourse.training_type == training_type)
    if is_mandatory is not None:
        q = q.filter(TrainingCourse.is_mandatory == is_mandatory)
    if is_active is not None:
        q = q.filter(TrainingCourse.is_active == is_active)
    if is_custom is not None:
        q = q.filter(TrainingCourse.is_custom == is_custom)
    courses = q.order_by(TrainingCourse.training_type, TrainingCourse.name).all()
    return {"courses": [_course_dict(c) for c in courses], "count": len(courses)}


@router.post("/courses", status_code=201)
def create_course(
    payload: CourseCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_mlro_or_above),
):
    """Create a custom training course for this org."""
    org_id = org_id_for(current_user)
    solution = _get_solution(org_id, db)

    existing = (
        db.query(TrainingCourse)
        .filter(
            TrainingCourse.org_id == org_id,
            TrainingCourse.course_code == payload.course_code,
        )
        .first()
    )
    if existing:
        raise HTTPException(409, f"Course code '{payload.course_code}' already exists.")

    course = TrainingCourse(
        id=f"tc_{uuid4().hex[:12]}",
        org_id=org_id,
        solution_id=solution.id,
        is_custom=True,
        created_by=current_user.id,
        **payload.model_dump(),
    )
    db.add(course)
    db.commit()
    db.refresh(course)
    return _course_dict(course)


@router.get("/courses/{course_id}")
def get_course(
    course_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_analyst_or_above),
):
    """Get a specific training course."""
    return _course_dict(_get_course(course_id, org_id_for(current_user), db))


@router.patch("/courses/{course_id}")
def update_course(
    course_id: str,
    payload: CourseUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_mlro_or_above),
):
    """Update a training course. Standard courses can only have is_active toggled."""
    org_id = org_id_for(current_user)
    course = _get_course(course_id, org_id, db)

    if not course.is_custom:
        # Standard courses: only allow deactivation
        if payload.is_active is not None:
            course.is_active = payload.is_active
            db.commit()
            db.refresh(course)
            return _course_dict(course)
        raise HTTPException(
            409, "Standard courses cannot be modified. Only is_active can be toggled."
        )

    for field, value in payload.model_dump(exclude_none=True).items():
        setattr(course, field, value)
    db.commit()
    db.refresh(course)
    return _course_dict(course)


@router.delete("/courses/{course_id}", status_code=204)
def delete_course(
    course_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_mlro_or_above),
):
    """Delete a custom course (soft-delete via is_active = False)."""
    org_id = org_id_for(current_user)
    course = _get_course(course_id, org_id, db)
    if not course.is_custom:
        raise HTTPException(
            409, "Standard courses cannot be deleted — set is_active = false instead."
        )
    course.is_active = False
    db.commit()
