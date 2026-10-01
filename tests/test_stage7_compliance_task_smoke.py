"""
Stage 7 (AML/CTF Program Module), requirements "assign compliance tasks"
and "track outstanding actions" (the general case, i.e. not specifically
control-remediation actions -- see governance_controls.ControlRemediationAction
for that narrower one, already covered by the earlier governance-module work).

The Task model (app/models/task.py) already supports this without any new
model: case_id/customer_id are optional, so an org-level compliance task
(e.g. "complete the Q1 sanctions policy review") can be created, assigned,
and tracked through to completion with no case or customer attached. This
test proves that live -- create, filter/list as an outstanding action,
assign, complete -- and adds a dedicated TaskType.compliance_task value
so these are distinguishable from case-investigation tasks in reports.
"""

from app.services.org_service import seed_permission_catalog_and_roles
from tests.conftest import _auth


def test_org_level_compliance_task_full_lifecycle(client, admin_user, analyst_user, db):
    seed_permission_catalog_and_roles(db)
    headers = _auth(admin_user)

    created = client.post(
        "/api/v1/tasks",
        json={
            "task_type": "compliance_task",
            "title": "Complete Q1 2026 sanctions policy review",
            "description": "Annual review required under the AML/CTF Program.",
            "priority": "high",
            "due_date": "2026-03-31",
        },
        headers=headers,
    )
    assert created.status_code == 201, created.text
    task = created.json()
    assert task["case_id"] is None
    assert task["customer_id"] is None
    assert task["status"] == "open"
    task_id = task["id"]

    # Shows up as an outstanding action when filtering by type -- this is
    # the "track outstanding actions" requirement for a real user, not
    # just a raw DB row nobody can see.
    listed = client.get(
        "/api/v1/tasks", params={"task_type": "compliance_task"}, headers=headers
    )
    assert listed.status_code == 200, listed.text
    assert any(t["id"] == task_id for t in listed.json())

    assigned = client.post(
        f"/api/v1/tasks/{task_id}/assign",
        json={"assign_to": analyst_user.id},
        headers=headers,
    )
    assert assigned.status_code == 200, assigned.text

    completed = client.post(
        f"/api/v1/tasks/{task_id}/complete",
        json={"notes": "Policy reviewed and re-approved, no changes required."},
        headers=headers,
    )
    assert completed.status_code == 200, completed.text
    assert completed.json()["status"] == "completed"

    # No longer an outstanding (open) action once completed.
    open_only = client.get(
        "/api/v1/tasks",
        params={"task_type": "compliance_task", "status": "open"},
        headers=headers,
    )
    assert open_only.status_code == 200, open_only.text
    assert not any(t["id"] == task_id for t in open_only.json())
