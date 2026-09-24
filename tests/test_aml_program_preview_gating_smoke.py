"""
GET /aml-program (and GET /aml-program/{program_id}) with
include_sections=true returned every section's full narrative text --
CDD procedures, transaction monitoring, sanctions/SMR/TTR procedures, the
whole usable program -- to any analyst+ user regardless of plan. The
sibling AML program system (AmlProgramRecord, organisations.py's
_program_response) already gates its own full-content response behind
billing_service.is_feature_enabled(plan, "full_aml_program"); this
endpoint had no equivalent check at all.

Fixed by redacting every section except a small preview set (overview,
scope) unless the org's plan has full_aml_program enabled -- same
mechanism the sibling system already uses, applied here for consistency.
"""

import uuid

from app.models.aml_solution import AMLProgram, AMLSolution, ProgramStatus
from app.models.billing import (
    BillingInterval,
    BillingPlan,
    Subscription,
    SubscriptionStatus,
)


def _make_program(db, org_id, created_by, status=ProgramStatus.active):
    sol = AMLSolution(org_id=org_id, created_by=created_by)
    db.add(sol)
    db.commit()
    db.refresh(sol)

    program = AMLProgram(
        org_id=org_id,
        solution_id=sol.id,
        version="1.0",
        status=status,
        created_by=created_by,
        overview="This program covers designated services under the AML/CTF Act.",
        scope="Applies to all individual and company customers.",
        cdd_individuals="Real CDD procedure text that must not leak on a free plan.",
        sanctions_procedures="Real sanctions screening procedure text.",
    )
    db.add(program)
    db.commit()
    db.refresh(program)
    return program


def _upgrade(db, org_id):
    db.add(
        Subscription(
            subscription_id=f"sub_{uuid.uuid4().hex[:10]}",
            industry_id=org_id,
            organisation_id=org_id,
            plan=BillingPlan.starter,
            interval=BillingInterval.monthly,
            status=SubscriptionStatus.active,
        )
    )
    db.commit()


def test_active_program_full_sections_hidden_on_free_trial(
    client, db, admin_user, admin_headers
):
    _make_program(db, admin_user.org_id, admin_user.id)

    resp = client.get(
        "/api/v1/aml-program?include_sections=true", headers=admin_headers
    )
    assert resp.status_code == 200, resp.text
    program = resp.json()["active_program"]

    assert program["is_preview"] is True
    assert program["sections"]["overview"] is not None
    assert program["sections"]["scope"] is not None
    assert program["sections"]["cdd_individuals"] is None
    assert program["sections"]["sanctions_procedures"] is None
    assert "cdd_individuals" in program["locked_sections"]
    assert "sanctions_procedures" in program["locked_sections"]


def test_active_program_full_sections_visible_on_paid_plan(
    client, db, admin_user, admin_headers
):
    _make_program(db, admin_user.org_id, admin_user.id)
    _upgrade(db, admin_user.org_id)

    resp = client.get(
        "/api/v1/aml-program?include_sections=true", headers=admin_headers
    )
    assert resp.status_code == 200, resp.text
    program = resp.json()["active_program"]

    assert program.get("is_preview") is not True
    assert program["sections"]["cdd_individuals"] == (
        "Real CDD procedure text that must not leak on a free plan."
    )
    assert program["sections"]["sanctions_procedures"] == (
        "Real sanctions screening procedure text."
    )


def test_active_program_without_include_sections_is_unaffected(
    client, db, admin_user, admin_headers
):
    """No regression for the default (no include_sections) response --
    plan gating only applies when the caller actually asks for sections."""
    _make_program(db, admin_user.org_id, admin_user.id)

    resp = client.get("/api/v1/aml-program", headers=admin_headers)
    assert resp.status_code == 200, resp.text
    program = resp.json()["active_program"]
    assert "sections" not in program
    assert "is_preview" not in program


def test_get_program_by_id_also_gates_sections(client, db, admin_user, admin_headers):
    program = _make_program(
        db, admin_user.org_id, admin_user.id, status=ProgramStatus.draft
    )

    resp = client.get(
        f"/api/v1/aml-program/{program.id}?include_sections=true",
        headers=admin_headers,
    )
    assert resp.status_code == 200, resp.text
    body = resp.json()["program"]
    assert body["is_preview"] is True
    assert body["sections"]["cdd_individuals"] is None

    _upgrade(db, admin_user.org_id)

    resp = client.get(
        f"/api/v1/aml-program/{program.id}?include_sections=true",
        headers=admin_headers,
    )
    assert resp.status_code == 200, resp.text
    body = resp.json()["program"]
    assert body.get("is_preview") is not True
    assert body["sections"]["cdd_individuals"] is not None
