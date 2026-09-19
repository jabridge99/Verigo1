"""
Smoke test for the Governance Control Register & Testing Framework
(app/api/routes/governance/controls.py), surfaced by mypy once the
SQLAlchemy plugin was enabled -- this entire module had never been
exercised by a test before.

Three stacked bugs, all confirmed to crash every real call:

1. Every AuditLog(...) call in this file used entity_type/entity_id/detail
   kwargs, none of which exist on AuditLog (the real fields are event_type/
   object_type/object_id/new_value) -- create_control, update_control and
   finalise_test all raised TypeError on the very first audit-log write.

2. finalise_test() set test.finalised_by/test.finalised_at, neither of
   which is a mapped column on ControlTest (the real reviewer sign-off
   fields are reviewed_by/reviewed_at) -- silently discarded, never
   persisted, no error at the time because Python allows setting arbitrary
   attributes on an object.

3. ControlRemediationAction had no control_id column at all, though every
   route in the file (auto-create on finalise, list/create/update
   remediations) constructed or filtered by one -- the entire remediation
   subsystem raised on every call. Fixed by adding the column (plus
   created_by, which the routes also passed but the model lacked) and
   making test_id nullable, since a remediation raised directly against a
   control has no originating test.
"""

from app.models.aml_solution import AMLSolution
from app.models.governance_controls import ControlRemediationAction
from tests.conftest import _auth


def _make_solution(db, org_id: str) -> AMLSolution:
    sol = AMLSolution(org_id=org_id, created_by="test-setup")
    db.add(sol)
    db.commit()
    db.refresh(sol)
    return sol


def test_create_control_does_not_500(client, admin_user, db):
    _make_solution(db, admin_user.org_id)
    resp = client.post(
        "/api/v1/governance/controls",
        headers=_auth(admin_user),
        json={
            "name": "Sanctions screening on onboarding",
            "control_type": "detective",
            "risk_area": "sanctions_screening",
            "control_owner": admin_user.id,
            "frequency": "continuous",
            "control_method": "system_generated",
        },
    )
    assert resp.status_code == 201, resp.text


def test_finalise_test_persists_reviewer_and_creates_remediation(client, admin_user, db):
    _make_solution(db, admin_user.org_id)
    control = client.post(
        "/api/v1/governance/controls",
        headers=_auth(admin_user),
        json={
            "name": "Sanctions screening on onboarding",
            "control_type": "detective",
            "risk_area": "sanctions_screening",
            "control_owner": admin_user.id,
            "frequency": "continuous",
            "control_method": "system_generated",
        },
    ).json()

    test = client.post(
        f"/api/v1/governance/controls/{control['id']}/tests",
        headers=_auth(admin_user),
        json={
            "test_date": "2026-01-15",
            "sample_size": 10,
            "passed_samples": 4,
            "failed_samples": 6,
            "result": "fail",
        },
    ).json()

    finding = client.post(
        f"/api/v1/governance/controls/{control['id']}/tests/{test['id']}/findings",
        headers=_auth(admin_user),
        json={
            "title": "Screening bypassed for expedited onboarding",
            "description": "6 of 10 sampled customers were never screened.",
            "severity": "critical",
        },
    )
    assert finding.status_code == 201, finding.text

    resp = client.post(
        f"/api/v1/governance/controls/{control['id']}/tests/{test['id']}/finalise",
        headers=_auth(admin_user),
    )
    assert resp.status_code == 200, resp.text

    from app.models.governance_controls import ControlTest

    persisted = db.query(ControlTest).filter(ControlTest.id == test["id"]).first()
    assert persisted.reviewed_by == admin_user.id
    assert persisted.reviewed_at is not None

    auto_remediation = (
        db.query(ControlRemediationAction)
        .filter(ControlRemediationAction.test_id == test["id"])
        .first()
    )
    assert auto_remediation is not None
    assert auto_remediation.control_id == control["id"]


def test_create_list_and_complete_manual_remediation(client, admin_user, db):
    _make_solution(db, admin_user.org_id)
    control = client.post(
        "/api/v1/governance/controls",
        headers=_auth(admin_user),
        json={
            "name": "Dual sign-off on high-value transfers",
            "control_type": "preventive",
            "risk_area": "transaction_monitoring",
            "control_owner": admin_user.id,
            "frequency": "continuous",
            "control_method": "dual_control",
        },
    ).json()

    created = client.post(
        f"/api/v1/governance/controls/{control['id']}/remediations",
        headers=_auth(admin_user),
        json={
            "title": "Update dual sign-off procedure doc",
            "description": "Procedure doc references an old threshold.",
            "owner_id": admin_user.id,
            "due_date": "2026-03-01",
        },
    )
    assert created.status_code == 201, created.text
    body = created.json()
    assert body["control_id"] == control["id"]
    assert body["test_id"] is None

    listed = client.get(
        f"/api/v1/governance/controls/{control['id']}/remediations",
        headers=_auth(admin_user),
    )
    assert listed.status_code == 200
    assert any(r["id"] == body["id"] for r in listed.json())

    completed = client.patch(
        f"/api/v1/governance/controls/{control['id']}/remediations/{body['id']}",
        headers=_auth(admin_user),
        json={"status": "completed", "closure_notes": "Doc updated and re-issued."},
    )
    assert completed.status_code == 200, completed.text
    assert completed.json()["status"] == "completed"
