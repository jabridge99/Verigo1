"""
AML/CTF Governance — Training Management API.

Manages staff AML/CTF training obligations aligned with:
  - AUSTRAC AML/CTF Rules 2025 (Part B — staff training)
  - FATF Recommendation 18 (internal controls and training)
  - APRA CPS 230 (workforce capability)

Roles:
  GET (catalogue, own records, dashboard)  — analyst+
  Assign / Mark complete / Exempt          — compliance+
  Create/update courses                    — mlro+
  Seed standard courses                    — admin / mlro

Training record status is CALCULATED (not manually set):
  exempt      → is_exempt = True
  completed   → completion_date set AND (no expiry OR expiry >= today)
  expired     → completion_date set AND expiry_date < today
  overdue     → completion_date null AND due_date < today
  in_progress → completion_date null AND started_at set AND due_date >= today
  assigned    → completion_date null AND started_at null AND due_date >= today

DISCLAIMER: This module is a governance tooling aid only.
Training completion records do not constitute regulatory certification.
"""

from __future__ import annotations

from datetime import date, datetime, timedelta, timezone
from typing import List, Optional
from uuid import uuid4

from dateutil.relativedelta import relativedelta
from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session

from app.api.deps import (
    Pagination,
    org_id_for,
    require_analyst_or_above,
    require_compliance_or_above,
    require_mlro_or_above,
)
from app.db.database import get_db
from app.models.aml_solution import AMLSolution
from app.models.governance_training import (
    STANDARD_TRAINING_COURSES,
    AssignmentTrigger,
    GovernanceTrainingRecord,
    TrainingAssignment,
    TrainingCourse,
    TrainingStatus,
    TrainingType,
)
from app.models.user import User

router = APIRouter(prefix="/governance/training", tags=["Governance — Training"])

DISCLAIMER = (
    "Training records are a governance tooling aid. "
    "Completion does not constitute regulatory certification. "
    "AUSTRAC training obligations remain the responsibility of the reporting entity."
)


# ── Status calculator ─────────────────────────────────────────────────────────


def _compute_status(record: GovernanceTrainingRecord) -> TrainingStatus:
    today = date.today()
    if record.is_exempt:
        return TrainingStatus.exempt
    if record.completion_date:
        if record.expiry_date and record.expiry_date < today:
            return TrainingStatus.expired
        return TrainingStatus.completed
    if record.due_date < today:
        return TrainingStatus.overdue
    if record.started_at:
        return TrainingStatus.in_progress
    return TrainingStatus.assigned


def _sync_status(record: GovernanceTrainingRecord, db: Session):
    new_status = _compute_status(record)
    if record.status != new_status:
        record.status = new_status


def _get_solution(org_id: str, db: Session) -> AMLSolution:
    s = db.query(AMLSolution).filter(AMLSolution.org_id == org_id).first()
    if not s:
        raise HTTPException(404, "No AML Solution found — complete onboarding first.")
    return s


# ── Schemas ───────────────────────────────────────────────────────────────────


class CourseCreate(BaseModel):
    course_code: str = Field(..., max_length=30)
    name: str = Field(..., max_length=255)
    training_type: TrainingType
    description: Optional[str] = None
    learning_objectives: List[str] = []
    provider: Optional[str] = None
    delivery_method: Optional[str] = None
    duration_minutes: Optional[int] = Field(None, ge=1)
    external_url: Optional[str] = Field(None, max_length=512)
    has_assessment: bool = False
    pass_mark: Optional[float] = Field(None, ge=0, le=100)
    max_attempts: int = 3
    issues_certificate: bool = False
    expiry_months: Optional[int] = Field(None, ge=1)
    applicable_roles: List[str] = ["all"]
    is_mandatory: bool = False
    regulatory_references: List[str] = []


class CourseUpdate(BaseModel):
    name: Optional[str] = Field(None, max_length=255)
    description: Optional[str] = None
    learning_objectives: Optional[List[str]] = None
    provider: Optional[str] = None
    delivery_method: Optional[str] = None
    duration_minutes: Optional[int] = Field(None, ge=1)
    external_url: Optional[str] = None
    has_assessment: Optional[bool] = None
    pass_mark: Optional[float] = Field(None, ge=0, le=100)
    expiry_months: Optional[int] = None
    applicable_roles: Optional[List[str]] = None
    is_mandatory: Optional[bool] = None
    is_active: Optional[bool] = None


class AssignRequest(BaseModel):
    course_id: str
    user_ids: Optional[List[str]] = None
    roles: Optional[List[str]] = None
    trigger: AssignmentTrigger = AssignmentTrigger.manual
    due_date: date
    notes: Optional[str] = None

    def model_post_init(self, __context) -> None:
        if not self.user_ids and not self.roles:
            raise ValueError("Provide at least one of user_ids or roles.")


class RecordCreate(BaseModel):
    course_id: str
    user_id: str
    assigned_date: date
    due_date: date
    trigger: AssignmentTrigger = AssignmentTrigger.manual


class CompleteRequest(BaseModel):
    completion_date: date
    score: Optional[float] = Field(None, ge=0, le=100)
    certificate_number: Optional[str] = None
    certificate_document_id: Optional[str] = None
    notes: Optional[str] = None


class ExemptRequest(BaseModel):
    reason: str = Field(..., min_length=10)
    approved_by: Optional[str] = None


# ── Helpers ───────────────────────────────────────────────────────────────────


def _course_dict(c: TrainingCourse) -> dict:
    return {
        "id": c.id,
        "course_code": c.course_code,
        "name": c.name,
        "training_type": c.training_type.value,
        "description": c.description,
        "learning_objectives": c.learning_objectives or [],
        "provider": c.provider,
        "delivery_method": c.delivery_method,
        "duration_minutes": c.duration_minutes,
        "external_url": c.external_url,
        "has_assessment": c.has_assessment,
        "pass_mark": c.pass_mark,
        "max_attempts": c.max_attempts,
        "issues_certificate": c.issues_certificate,
        "expiry_months": c.expiry_months,
        "applicable_roles": c.applicable_roles or [],
        "is_mandatory": c.is_mandatory,
        "is_custom": c.is_custom,
        "is_active": c.is_active,
        "regulatory_references": c.regulatory_references or [],
        "created_at": c.created_at,
        "updated_at": c.updated_at,
    }


def _record_dict(r: GovernanceTrainingRecord) -> dict:
    _sync_status(r, None)
    return {
        "id": r.id,
        "org_id": r.org_id,
        "course_id": r.course_id,
        "user_id": r.user_id,
        "assignment_id": r.assignment_id,
        "assigned_by": r.assigned_by,
        "assigned_date": r.assigned_date,
        "due_date": r.due_date,
        "trigger": r.trigger.value if r.trigger else None,
        "started_at": r.started_at,
        "completion_date": r.completion_date,
        "expiry_date": r.expiry_date,
        "score": r.score,
        "pass_mark_applied": r.pass_mark_applied,
        "passed": r.passed,
        "attempt_number": r.attempt_number,
        "certificate_document_id": r.certificate_document_id,
        "certificate_number": r.certificate_number,
        "status": r.status.value,
        "is_exempt": r.is_exempt,
        "exemption_reason": r.exemption_reason,
        "exemption_approved_by": r.exemption_approved_by,
        "notes": r.notes,
        "created_at": r.created_at,
        "updated_at": r.updated_at,
    }


def _assignment_dict(a: TrainingAssignment) -> dict:
    return {
        "id": a.id,
        "course_id": a.course_id,
        "assigned_to_user_ids": a.assigned_to_user_ids or [],
        "assigned_to_roles": a.assigned_to_roles or [],
        "trigger": a.trigger.value,
        "assigned_date": a.assigned_date,
        "due_date": a.due_date,
        "total_assigned": a.total_assigned,
        "notes": a.notes,
        "is_active": a.is_active,
        "assigned_by": a.assigned_by,
        "created_at": a.created_at,
    }


def _get_course(course_id: str, org_id: str, db: Session) -> TrainingCourse:
    c = (
        db.query(TrainingCourse)
        .filter(
            TrainingCourse.id == course_id,
            TrainingCourse.org_id == org_id,
        )
        .first()
    )
    if not c:
        raise HTTPException(404, "Training course not found.")
    return c


def _get_record(record_id: str, org_id: str, db: Session) -> GovernanceTrainingRecord:
    r = (
        db.query(GovernanceTrainingRecord)
        .filter(
            GovernanceTrainingRecord.id == record_id,
            GovernanceTrainingRecord.org_id == org_id,
        )
        .first()
    )
    if not r:
        raise HTTPException(404, "Training record not found.")
    return r


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
        .limit(page.limit)
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


# ── Training Records ──────────────────────────────────────────────────────────


@router.get("/records")
def list_records(
    user_id: Optional[str] = Query(None),
    status: Optional[TrainingStatus] = Query(None),
    course_id: Optional[str] = Query(None),
    training_type: Optional[TrainingType] = Query(None),
    overdue_only: bool = Query(False),
    expiring_within_days: Optional[int] = Query(None, ge=1, le=365),
    db: Session = Depends(get_db),
    current_user: User = Depends(require_analyst_or_above),
    page: Pagination = Depends(),
):
    """List training records with filters. Analysts can view their own; compliance+ sees all."""
    org_id = org_id_for(current_user)

    q = db.query(GovernanceTrainingRecord).filter(
        GovernanceTrainingRecord.org_id == org_id
    )

    # Analysts can only see their own records
    if current_user.role.value == "analyst":
        q = q.filter(GovernanceTrainingRecord.user_id == current_user.id)
    elif user_id:
        q = q.filter(GovernanceTrainingRecord.user_id == user_id)

    if status:
        q = q.filter(GovernanceTrainingRecord.status == status)
    if course_id:
        q = q.filter(GovernanceTrainingRecord.course_id == course_id)
    if training_type:
        # Join to course to filter by type
        q = q.join(TrainingCourse).filter(TrainingCourse.training_type == training_type)
    if overdue_only:
        today = date.today()
        q = q.filter(
            GovernanceTrainingRecord.completion_date.is_(None),
            GovernanceTrainingRecord.due_date < today,
            GovernanceTrainingRecord.is_exempt == False,
        )
    if expiring_within_days:
        target = date.today() + timedelta(days=expiring_within_days)
        q = q.filter(
            GovernanceTrainingRecord.expiry_date.isnot(None),
            GovernanceTrainingRecord.expiry_date <= target,
            GovernanceTrainingRecord.expiry_date >= date.today(),
        )

    records = (
        q.order_by(GovernanceTrainingRecord.due_date)
        .offset(page.offset)
        .limit(page.limit)
        .all()
    )

    # Sync computed status before returning
    for r in records:
        _sync_status(r, db)
    db.commit()

    return {
        "records": [_record_dict(r) for r in records],
        "count": len(records),
    }


@router.post("/records", status_code=201)
def create_record(
    payload: RecordCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_compliance_or_above),
):
    """Manually create an individual training record (e.g. for external training)."""
    org_id = org_id_for(current_user)
    solution = _get_solution(org_id, db)
    course = _get_course(payload.course_id, org_id, db)

    record = GovernanceTrainingRecord(
        id=f"gtr_{uuid4().hex[:12]}",
        org_id=org_id,
        solution_id=solution.id,
        course_id=course.id,
        user_id=payload.user_id,
        assigned_by=current_user.id,
        assigned_date=payload.assigned_date,
        due_date=payload.due_date,
        trigger=payload.trigger,
        status=TrainingStatus.assigned,
    )
    db.add(record)
    db.commit()
    db.refresh(record)
    return _record_dict(record)


@router.get("/records/{record_id}")
def get_record(
    record_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_analyst_or_above),
):
    """Get a specific training record."""
    org_id = org_id_for(current_user)
    record = _get_record(record_id, org_id, db)
    # Analysts can only see their own
    if current_user.role.value == "analyst" and record.user_id != current_user.id:
        raise HTTPException(403, "You can only view your own training records.")
    _sync_status(record, db)
    db.commit()
    return _record_dict(record)


@router.post("/records/{record_id}/start")
def start_training(
    record_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_analyst_or_above),
):
    """Mark a training record as in-progress (the learner has started)."""
    org_id = org_id_for(current_user)
    record = _get_record(record_id, org_id, db)

    if record.is_exempt:
        raise HTTPException(409, "This training record is exempt.")
    if record.completion_date:
        raise HTTPException(409, "Training already completed.")

    record.started_at = datetime.now(timezone.utc)
    record.status = TrainingStatus.in_progress
    db.commit()
    db.refresh(record)
    return _record_dict(record)


@router.post("/records/{record_id}/complete")
def complete_training(
    record_id: str,
    payload: CompleteRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_compliance_or_above),
):
    """
    Mark a training record as completed.

    Calculates pass/fail from score vs pass_mark.
    Calculates expiry_date from completion_date + course.expiry_months.

    DISCLAIMER: Completion recording is a workflow action only.
    """
    org_id = org_id_for(current_user)
    record = _get_record(record_id, org_id, db)

    if record.is_exempt:
        raise HTTPException(409, "Training record is exempt.")
    if record.completion_date and record.status == TrainingStatus.completed:
        raise HTTPException(409, "Training already marked as completed.")

    course = (
        db.query(TrainingCourse).filter(TrainingCourse.id == record.course_id).first()
    )

    record.completion_date = payload.completion_date
    record.score = payload.score
    record.notes = payload.notes or record.notes
    record.certificate_number = payload.certificate_number
    record.certificate_document_id = payload.certificate_document_id

    if course:
        record.pass_mark_applied = course.pass_mark
        if payload.score is not None and course.pass_mark is not None:
            record.passed = payload.score >= course.pass_mark
        else:
            record.passed = True  # no assessment course

        if course.expiry_months:
            record.expiry_date = payload.completion_date + relativedelta(
                months=course.expiry_months
            )

    _sync_status(record, db)
    db.commit()
    db.refresh(record)
    return _record_dict(record)


@router.post("/records/{record_id}/exempt")
def grant_exemption(
    record_id: str,
    payload: ExemptRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_compliance_or_above),
):
    """
    Grant an exemption for a training record.

    Exemptions must have a documented reason (stored for audit).
    Typically used for: recently joined staff with equivalent prior training,
    temporary contractors, or staff on long-term leave.
    """
    org_id = org_id_for(current_user)
    record = _get_record(record_id, org_id, db)

    if record.completion_date:
        raise HTTPException(409, "Cannot exempt a completed training record.")

    record.is_exempt = True
    record.exemption_reason = payload.reason
    record.exemption_approved_by = payload.approved_by or current_user.id
    record.status = TrainingStatus.exempt
    db.commit()
    db.refresh(record)
    return _record_dict(record)


@router.post("/records/{record_id}/revoke-exemption")
def revoke_exemption(
    record_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_compliance_or_above),
):
    """Revoke a previously granted exemption."""
    org_id = org_id_for(current_user)
    record = _get_record(record_id, org_id, db)

    if not record.is_exempt:
        raise HTTPException(409, "Record is not exempt.")

    record.is_exempt = False
    record.exemption_reason = None
    record.exemption_approved_by = None
    _sync_status(record, db)
    db.commit()
    db.refresh(record)
    return _record_dict(record)


# ── Dashboard & Analytics ─────────────────────────────────────────────────────


@router.get("/dashboard")
def training_dashboard(
    db: Session = Depends(get_db),
    current_user: User = Depends(require_analyst_or_above),
):
    """
    Org-wide training compliance dashboard with traffic light indicators.

    Metrics:
      completion_pct   — % of non-exempt records completed
      overdue_count    — records past due with no completion
      expiring_30d     — completions expiring within 30 days
      health_score     — weighted composite 0–100 (higher = healthier)

    Traffic lights:
      green  — completion >= 90%, no overdue, no expiring
      amber  — completion 75–90% OR expiring within 30 days
      red    — completion < 75% OR any overdue critical records

    DISCLAIMER: Health scores are governance tooling metrics only.
    """
    org_id = org_id_for(current_user)
    today = date.today()

    # Sync all statuses first
    all_records = (
        db.query(GovernanceTrainingRecord)
        .filter(GovernanceTrainingRecord.org_id == org_id)
        .all()
    )
    for r in all_records:
        _sync_status(r, db)
    db.commit()

    total = len(all_records)
    exempt = sum(1 for r in all_records if r.status == TrainingStatus.exempt)
    non_exempt = total - exempt
    completed = sum(1 for r in all_records if r.status == TrainingStatus.completed)
    overdue = sum(1 for r in all_records if r.status == TrainingStatus.overdue)
    in_progress = sum(1 for r in all_records if r.status == TrainingStatus.in_progress)
    assigned = sum(1 for r in all_records if r.status == TrainingStatus.assigned)
    expired = sum(1 for r in all_records if r.status == TrainingStatus.expired)

    completion_pct = round(completed / non_exempt * 100, 1) if non_exempt > 0 else 100.0

    expiring_30d = sum(
        1
        for r in all_records
        if r.expiry_date
        and r.status == TrainingStatus.completed
        and today <= r.expiry_date <= today + timedelta(days=30)
    )

    # By course
    by_course: dict = {}
    courses = {
        c.id: c
        for c in db.query(TrainingCourse).filter(TrainingCourse.org_id == org_id).all()
    }
    for r in all_records:
        cid = r.course_id
        if cid not in by_course:
            c = courses.get(cid)
            by_course[cid] = {
                "course_id": cid,
                "course_name": c.name if c else cid,
                "total": 0,
                "completed": 0,
                "overdue": 0,
                "exempt": 0,
            }
        by_course[cid]["total"] += 1
        if r.status == TrainingStatus.completed:
            by_course[cid]["completed"] += 1
        elif r.status == TrainingStatus.overdue:
            by_course[cid]["overdue"] += 1
        elif r.status == TrainingStatus.exempt:
            by_course[cid]["exempt"] += 1

    # Traffic light
    def _light(bad, warn=False):
        if bad:
            return "red"
        if warn:
            return "amber"
        return "green"

    completion_light = _light(completion_pct < 75, completion_pct < 90)
    overdue_light = _light(overdue > 0)
    expiry_light = _light(False, expiring_30d > 0)

    overall = (
        "red"
        if "red" in [completion_light, overdue_light]
        else "amber"
        if "amber" in [completion_light, overdue_light, expiry_light]
        else "green"
    )

    # Health score (weighted)
    not_overdue_pct = (
        ((non_exempt - overdue) / non_exempt * 100) if non_exempt > 0 else 100.0
    )
    not_expiring_pct = (
        ((completed - expiring_30d) / completed * 100) if completed > 0 else 100.0
    )
    health_score = round(
        (completion_pct * 0.40) + (not_overdue_pct * 0.40) + (not_expiring_pct * 0.20),
        1,
    )

    return {
        "summary": {
            "total": total,
            "non_exempt": non_exempt,
            "completed": completed,
            "overdue": overdue,
            "in_progress": in_progress,
            "assigned_not_started": assigned,
            "expired": expired,
            "exempt": exempt,
            "expiring_within_30_days": expiring_30d,
        },
        "metrics": {
            "completion_pct": completion_pct,
            "overdue_count": overdue,
            "expiring_30d": expiring_30d,
            "health_score": health_score,
        },
        "traffic_lights": {
            "completion": completion_light,
            "overdue": overdue_light,
            "expiry": expiry_light,
            "overall": overall,
        },
        "by_course": list(by_course.values()),
        "disclaimer": DISCLAIMER,
    }


@router.get("/overdue")
def list_overdue(
    db: Session = Depends(get_db),
    current_user: User = Depends(require_compliance_or_above),
):
    """List all overdue training records for this org."""
    org_id = org_id_for(current_user)
    today = date.today()

    records = (
        db.query(GovernanceTrainingRecord)
        .filter(
            GovernanceTrainingRecord.org_id == org_id,
            GovernanceTrainingRecord.completion_date.is_(None),
            GovernanceTrainingRecord.due_date < today,
            GovernanceTrainingRecord.is_exempt == False,
        )
        .order_by(GovernanceTrainingRecord.due_date)
        .all()
    )

    for r in records:
        r.status = TrainingStatus.overdue
    db.commit()

    return {
        "overdue_count": len(records),
        "records": [_record_dict(r) for r in records],
        "disclaimer": DISCLAIMER,
    }


@router.get("/expiring")
def list_expiring(
    within_days: int = Query(30, ge=1, le=365),
    db: Session = Depends(get_db),
    current_user: User = Depends(require_compliance_or_above),
):
    """List training records expiring within N days (default 30)."""
    org_id = org_id_for(current_user)
    today = date.today()
    target = today + timedelta(days=within_days)

    records = (
        db.query(GovernanceTrainingRecord)
        .filter(
            GovernanceTrainingRecord.org_id == org_id,
            GovernanceTrainingRecord.expiry_date.isnot(None),
            GovernanceTrainingRecord.expiry_date >= today,
            GovernanceTrainingRecord.expiry_date <= target,
            GovernanceTrainingRecord.status == TrainingStatus.completed,
        )
        .order_by(GovernanceTrainingRecord.expiry_date)
        .all()
    )

    return {
        "expiring_count": len(records),
        "within_days": within_days,
        "records": [_record_dict(r) for r in records],
        "disclaimer": DISCLAIMER,
    }


@router.get("/compliance-report")
def training_compliance_report(
    db: Session = Depends(get_db),
    current_user: User = Depends(require_compliance_or_above),
):
    """
    Training compliance data for the AUSTRAC Annual Compliance Report.

    Returns aggregate stats per course type aligned to AUSTRAC reporting
    obligations. MLRO uses this to populate the annual report training section.

    DISCLAIMER: This summary is a governance tooling output only.
    """
    org_id = org_id_for(current_user)
    today = date.today()

    records = (
        db.query(GovernanceTrainingRecord)
        .filter(GovernanceTrainingRecord.org_id == org_id)
        .all()
    )

    for r in records:
        _sync_status(r, db)
    db.commit()

    courses = {
        c.id: c
        for c in db.query(TrainingCourse).filter(TrainingCourse.org_id == org_id).all()
    }

    by_type: dict = {}
    for r in records:
        c = courses.get(r.course_id)
        if not c:
            continue
        ttype = c.training_type.value
        if ttype not in by_type:
            by_type[ttype] = {
                "training_type": ttype,
                "total_assigned": 0,
                "completed": 0,
                "overdue": 0,
                "exempt": 0,
            }
        by_type[ttype]["total_assigned"] += 1
        if r.status == TrainingStatus.completed:
            by_type[ttype]["completed"] += 1
        elif r.status == TrainingStatus.overdue:
            by_type[ttype]["overdue"] += 1
        elif r.status == TrainingStatus.exempt:
            by_type[ttype]["exempt"] += 1

    for row in by_type.values():
        denom = row["total_assigned"] - row["exempt"]
        row["completion_pct"] = (
            round(row["completed"] / denom * 100, 1) if denom > 0 else 100.0
        )

    total = len(records)
    exempt = sum(1 for r in records if r.status == TrainingStatus.exempt)
    completed = sum(1 for r in records if r.status == TrainingStatus.completed)
    denom = total - exempt
    overall_pct = round(completed / denom * 100, 1) if denom > 0 else 100.0

    return {
        "report_date": today.isoformat(),
        "overall": {
            "total_assigned": total,
            "completed": completed,
            "exempt": exempt,
            "overdue": sum(1 for r in records if r.status == TrainingStatus.overdue),
            "completion_pct": overall_pct,
        },
        "by_training_type": list(by_type.values()),
        "mandatory_courses_100pct": all(
            row["completion_pct"] >= 100.0
            for row in by_type.values()
            if any(
                courses.get(r.course_id) and courses[r.course_id].is_mandatory
                for r in records
                if courses.get(r.course_id)
                and courses[r.course_id].training_type.value == row["training_type"]
            )
        ),
        "disclaimer": DISCLAIMER,
    }
