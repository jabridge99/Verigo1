"""
Stage 7 (AML/CTF Program Module), requirement "record evidence."

Confirmed gap: ControlEvidenceItem (app/models/governance_controls.py) --
"ongoing operational evidence" attached to a control, e.g. monthly system
reports, dual-sign-off logs, alert reports, distinct from per-test
evidence document IDs on ControlTest -- existed as a fully-defined model
(and even had a `control.evidence` relationship wired up) but had zero
routes anywhere. There was no way for a real user to ever record evidence
against a control. Added GET/POST /governance/controls/{control_id}/evidence.
"""

from app.models.aml_solution import AMLSolution
from tests.conftest import _auth


def _make_solution(db, org_id: str) -> AMLSolution:
    sol = AMLSolution(org_id=org_id, created_by="test-setup")
    db.add(sol)
    db.commit()
    db.refresh(sol)
    return sol


def test_record_and_list_control_evidence(client, admin_user, db):
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

    empty = client.get(
        f"/api/v1/governance/controls/{control['id']}/evidence",
        headers=_auth(admin_user),
    )
    assert empty.status_code == 200, empty.text
    assert empty.json() == []

    created = client.post(
        f"/api/v1/governance/controls/{control['id']}/evidence",
        headers=_auth(admin_user),
        json={
            "title": "January sanctions screening system report",
            "description": "Monthly automated screening coverage report.",
            "evidence_date": "2026-01-31",
            "evidence_type": "system_report",
        },
    )
    assert created.status_code == 201, created.text
    body = created.json()
    assert body["control_id"] == control["id"]
    assert body["uploaded_by"] == admin_user.id

    listed = client.get(
        f"/api/v1/governance/controls/{control['id']}/evidence",
        headers=_auth(admin_user),
    )
    assert listed.status_code == 200, listed.text
    assert len(listed.json()) == 1
    assert listed.json()[0]["id"] == body["id"]
