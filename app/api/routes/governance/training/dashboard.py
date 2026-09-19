"""
Governance Training — org-wide dashboard, overdue/expiring lists, and the
AUSTRAC Annual Compliance Report training section.
Part of the governance/training route package; see __init__.py for the
combined router.
"""

from __future__ import annotations

from datetime import date, timedelta

from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

from app.api.deps import (
    org_id_for,
    require_analyst_or_above,
    require_compliance_or_above,
)
from app.api.routes.governance.training._shared import (
    DISCLAIMER,
    _record_dict,
    _sync_status,
)
from app.db.database import get_db
from app.models.governance_training import (
    GovernanceTrainingRecord,
    TrainingCourse,
    TrainingStatus,
)
from app.models.user import User

router = APIRouter()


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
