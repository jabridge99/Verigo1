"""
Governance Training — bulk course-to-user(s)/role(s) assignment.
Part of the governance/training route package; see __init__.py for the
combined router.
"""

from __future__ import annotations

from datetime import date
from typing import Optional
from uuid import uuid4

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session

from app.api.deps import Pagination, org_id_for, require_compliance_or_above
from app.api.routes.governance.training._shared import (
    DISCLAIMER,
    _assignment_dict,
    _get_course,
    _get_solution,
    _record_dict,
)
from app.db.database import get_db
from app.models.governance_training import (
    AssignmentTrigger,
    GovernanceTrainingRecord,
    TrainingAssignment,
    TrainingStatus,
)
from app.models.user import User
from app.schemas.governance_training import AssignRequest

router = APIRouter()


# ── Assignments (bulk) ────────────────────────────────────────────────────────


@router.post("/assignments", status_code=201)
def create_assignment(
    payload: AssignRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_compliance_or_above),
):
    """
    Bulk-assign a training course to users and/or roles.

    Creates one GovernanceTrainingRecord per user_id supplied.
    Role-based assignment (roles=[]) is recorded on the assignment for reference —
    HR/admin must supply explicit user_ids since user directory is external.

    Returns the assignment record and count of individual records created.
    """
    org_id = org_id_for(current_user)
    solution = _get_solution(org_id, db)
    course = _get_course(payload.course_id, org_id, db)

    if not course.is_active:
        raise HTTPException(409, "Cannot assign an inactive course.")

    assignment = TrainingAssignment(
        id=f"ta_{uuid4().hex[:12]}",
        org_id=org_id,
        solution_id=solution.id,
        course_id=course.id,
        assigned_to_user_ids=payload.user_ids or [],
        assigned_to_roles=payload.roles or [],
        trigger=payload.trigger,
        assigned_date=date.today(),
        due_date=payload.due_date,
        notes=payload.notes,
        assigned_by=current_user.id,
    )
    db.add(assignment)
    db.flush()

    records_created = 0
    for user_id in payload.user_ids or []:
        # Skip if already assigned and not yet completed/expired
        existing = (
            db.query(GovernanceTrainingRecord)
            .filter(
                GovernanceTrainingRecord.org_id == org_id,
                GovernanceTrainingRecord.course_id == course.id,
                GovernanceTrainingRecord.user_id == user_id,
                GovernanceTrainingRecord.status.in_(
                    [
                        TrainingStatus.assigned,
                        TrainingStatus.in_progress,
                        TrainingStatus.completed,
                    ]
                ),
            )
            .first()
        )
        if existing:
            continue

        record = GovernanceTrainingRecord(
            id=f"gtr_{uuid4().hex[:12]}",
            org_id=org_id,
            solution_id=solution.id,
            course_id=course.id,
            user_id=user_id,
            assignment_id=assignment.id,
            assigned_by=current_user.id,
            assigned_date=date.today(),
            due_date=payload.due_date,
            trigger=payload.trigger,
            status=TrainingStatus.assigned,
        )
        db.add(record)
        records_created += 1

    assignment.total_assigned = records_created
    db.commit()
    db.refresh(assignment)

    return {
        "assignment": _assignment_dict(assignment),
        "records_created": records_created,
        "disclaimer": DISCLAIMER,
    }


@router.get("/assignments")
def list_assignments(
    course_id: Optional[str] = Query(None),
    trigger: Optional[AssignmentTrigger] = Query(None),
    db: Session = Depends(get_db),
    current_user: User = Depends(require_compliance_or_above),
    page: Pagination = Depends(),
):
    """List all training assignments for this org."""
    org_id = org_id_for(current_user)
    q = db.query(TrainingAssignment).filter(TrainingAssignment.org_id == org_id)
    if course_id:
        q = q.filter(TrainingAssignment.course_id == course_id)
    if trigger:
        q = q.filter(TrainingAssignment.trigger == trigger)
    assignments = (
        q.order_by(TrainingAssignment.created_at.desc())
        .offset(page.offset)
        .limit(page.page_size)
        .all()
    )
    return {
        "assignments": [_assignment_dict(a) for a in assignments],
        "count": len(assignments),
    }


@router.get("/assignments/{assignment_id}")
def get_assignment(
    assignment_id: str,
    include_records: bool = Query(False),
    db: Session = Depends(get_db),
    current_user: User = Depends(require_compliance_or_above),
):
    """Get a specific assignment, optionally with all individual training records."""
    org_id = org_id_for(current_user)
    a = (
        db.query(TrainingAssignment)
        .filter(
            TrainingAssignment.id == assignment_id,
            TrainingAssignment.org_id == org_id,
        )
        .first()
    )
    if not a:
        raise HTTPException(404, "Assignment not found.")
    d = _assignment_dict(a)
    if include_records:
        d["records"] = [_record_dict(r) for r in a.records]
    return d
