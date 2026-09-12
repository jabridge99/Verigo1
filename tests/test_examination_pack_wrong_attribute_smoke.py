"""
Regression tests for wrong-attribute-name bugs in
app/services/examination_pack_service.py, surfaced by mypy once the
SQLAlchemy plugin was enabled. All four were silently swallowed at
runtime (either via a defensive getattr(..., None)/hasattr() guard, or
because AttributeError never fires on a class-level Python attribute
that happens to share a name) -- so an AUSTRAC examination pack has
always shipped these sections empty/wrong, with no error to notice:

- AMLProgram.name doesn't exist -- programs section always used a
  nonexistent field (would have raised outright were it not for the
  fact this one WAS a real crash risk; fixed to a label built from the
  real `version` field).
- RiskAssessment.assessed_at doesn't exist (real field:
  assessment_date) -- guarded by getattr(..., None), so every risk
  assessment's date always rendered as null.
- Policy.lifecycle_status doesn't exist (real field: status) -- used in
  both the per-status breakdown (_count_by) and each policy's rendered
  status, so both were always empty/wrong.
"""

from datetime import date, timedelta

from app.models.aml_solution import AMLProgram, AMLSolution, RiskAssessment
from app.models.governance import Policy, PolicyLifecycleStatus, PolicyType
from app.services.examination_pack_service import (
    _section_aml_program,
    _section_policy_register,
)


def test_aml_program_section_reports_real_fields(db, admin_user):
    org_id = admin_user.org_id
    sol = AMLSolution(org_id=org_id, created_by=admin_user.id)
    db.add(sol)
    db.commit()
    db.refresh(sol)

    db.add(
        AMLProgram(
            org_id=org_id, solution_id=sol.id, version="2.1", created_by=admin_user.id
        )
    )
    db.add(
        RiskAssessment(
            org_id=org_id,
            solution_id=sol.id,
            title="FY2026 Annual Risk Assessment",
            assessment_date=date.today(),
        )
    )
    db.commit()

    start = date.today() - timedelta(days=30)
    end = date.today() + timedelta(days=1)
    section = _section_aml_program(db, org_id, start, end)

    assert section["programs"][0]["name"] == "AML/CTF Program v2.1"
    assert section["risk_assessments"][0]["assessed_at"] is not None


def test_policy_register_section_reports_real_status(db, admin_user):
    org_id = admin_user.org_id
    sol = AMLSolution(org_id=org_id, created_by=admin_user.id)
    db.add(sol)
    db.commit()
    db.refresh(sol)

    db.add(
        Policy(
            org_id=org_id,
            solution_id=sol.id,
            policy_number="GOV-001",
            title="CDD Policy",
            policy_type=PolicyType.cdd_policy,
            status=PolicyLifecycleStatus.published,
            review_due_date=date.today() + timedelta(days=365),
            document_owner=admin_user.id,
            version_major=1,
            version_minor=0,
            created_by=admin_user.id,
        )
    )
    db.commit()

    start = date.today() - timedelta(days=30)
    end = date.today() + timedelta(days=1)
    section = _section_policy_register(db, org_id, start, end)

    assert section["policies_by_status"] == {"published": 1}
    assert section["policies"][0]["status"] == "published"
