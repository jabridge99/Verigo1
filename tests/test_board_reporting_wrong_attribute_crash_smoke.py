"""
Smoke tests for three confirmed crashes in
app/services/board_reporting_service.py, all wrong-attribute-name bugs
surfaced by mypy once the SQLAlchemy plugin was enabled:

1. _smr_section(): SMRReport.smr_lodged doesn't exist (lodgement is
   tracked by `status` reaching submitted/acknowledged, not a boolean
   field) -- every board AML report crashed once at least one SMRReport
   existed for the org.
2. _training_section(): TrainingAssignment.status doesn't exist --
   completion status is tracked per-record (GovernanceTrainingRecord),
   not on the bulk assignment batch. Rewrote the completion/overdue
   counts to use records, matching how the rest of the function already
   worked.
3. _controls_section(): ControlTest.tested_at doesn't exist (the real
   column is test_date, a Date not a DateTime) -- the query itself
   raised before ever reaching the database.
"""

from datetime import date, timedelta

from app.models.aml_solution import AMLSolution
from app.models.governance_controls import (
    ControlEffectiveness,
    ControlMethod,
    ControlRiskArea,
    ControlType,
    GovernanceControl,
)
from app.models.governance_training import (
    GovernanceTrainingRecord,
    TrainingCourse,
    TrainingStatus,
    TrainingType,
)
from app.models.report import SMRReport
from app.services.board_reporting_service import generate_board_aml_snapshot


def test_board_aml_snapshot_does_not_crash_with_seeded_data(db, admin_user):
    org_id = admin_user.org_id

    sol = AMLSolution(org_id=org_id, created_by=admin_user.id)
    db.add(sol)
    db.commit()
    db.refresh(sol)

    db.add(
        SMRReport(
            org_id=org_id,
            status="submitted",
            matter_date=date.today() - timedelta(days=5),
            suspicion_grounds="Structuring pattern observed across 6 deposits.",
        )
    )

    course = TrainingCourse(
        org_id=org_id,
        course_code="AML-101",
        name="Annual AML/CTF Awareness",
        training_type=TrainingType.annual_aml_refresher,
    )
    db.add(course)
    db.commit()
    db.refresh(course)

    db.add(
        GovernanceTrainingRecord(
            org_id=org_id,
            solution_id=sol.id,
            course_id=course.id,
            user_id=admin_user.id,
            assigned_date=date.today() - timedelta(days=30),
            due_date=date.today() - timedelta(days=1),
            status=TrainingStatus.assigned,
        )
    )

    control = GovernanceControl(
        org_id=org_id,
        solution_id=sol.id,
        control_ref="CTL-CDD-001",
        name="Sanctions screening",
        control_type=ControlType.detective,
        risk_area=ControlRiskArea.sanctions_screening,
        control_owner=admin_user.id,
        control_method=ControlMethod.system_generated,
        effectiveness=ControlEffectiveness.not_tested,
        created_by=admin_user.id,
    )
    db.add(control)
    db.commit()

    period_start = date.today() - timedelta(days=90)
    period_end = date.today()

    snap = generate_board_aml_snapshot(db, org_id, period_start, period_end)

    assert snap["smr"]["total_lodged_all_time"] == 1
    assert snap["training"]["total_assigned"] == 1
    assert snap["training"]["overdue_assignments"] == 1
    assert "controls" in snap
