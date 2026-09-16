"""
Shared helpers for the governance/training route package (courses.py,
assignments.py, records.py, dashboard.py) — split out of what was a single
1278-line app/api/routes/governance/training.py.
"""

from datetime import date

from fastapi import HTTPException
from sqlalchemy.orm import Session

from app.models.aml_solution import AMLSolution
from app.models.governance_training import (
    GovernanceTrainingRecord,
    TrainingAssignment,
    TrainingCourse,
    TrainingStatus,
)

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
        "applicable_industries": c.applicable_industries or ["all"],
        "linked_control_ids": c.linked_control_ids or [],
        "linked_risk_factor_categories": c.linked_risk_factor_categories or [],
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
