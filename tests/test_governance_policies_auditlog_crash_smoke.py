"""
Smoke test for app/api/routes/governance/policies.py's update_policy() and
policy_workflow_action() -- both used AuditLog(entity_type=..., entity_id=...,
detail=...), the same wrong kwargs (the real fields are event_type/
object_type/object_id/new_value) found and fixed across
governance/controls.py. Every policy update and every workflow transition
(submit for review, publish, etc.) raised TypeError on its audit-log write.
"""

from app.models.aml_solution import AMLSolution
from tests.conftest import _auth


def _make_solution(db, org_id: str) -> AMLSolution:
    sol = AMLSolution(org_id=org_id, created_by="test-setup")
    db.add(sol)
    db.commit()
    db.refresh(sol)
    return sol


def _make_policy(client, admin_user) -> dict:
    resp = client.post(
        "/api/v1/governance/policies",
        headers=_auth(admin_user),
        json={
            "title": "Customer Due Diligence Policy",
            "policy_type": "cdd_policy",
            "review_due_date": "2027-01-01",
            "document_owner": admin_user.id,
        },
    )
    assert resp.status_code == 201, resp.text
    return resp.json()


def test_update_policy_does_not_500(client, admin_user, db):
    _make_solution(db, admin_user.org_id)
    policy = _make_policy(client, admin_user)

    resp = client.patch(
        f"/api/v1/governance/policies/{policy['id']}",
        headers=_auth(admin_user),
        json={"summary": "Updated summary text."},
    )
    assert resp.status_code == 200, resp.text
    assert resp.json()["summary"] == "Updated summary text."


def test_publish_workflow_does_not_500(client, admin_user, db):
    _make_solution(db, admin_user.org_id)
    policy = _make_policy(client, admin_user)

    for action in (
        "submit_for_review",
        "submit_for_compliance",
        "submit_for_approval",
        "publish",
    ):
        resp = client.post(
            f"/api/v1/governance/policies/{policy['id']}/workflow",
            headers=_auth(admin_user),
            json={"action": action},
        )
        assert resp.status_code == 200, f"{action}: {resp.text}"

    assert resp.json()["status"] == "published"
