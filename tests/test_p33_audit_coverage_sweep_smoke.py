"""
P33: re-triaging the ~28 route files P29 didn't name (grep -c "log_action("
app/api/routes/*.py) found the "commercial/infrastructure, out of scope"
bucketing wasn't complete -- risk_assessment.py, aml_program.py,
professional_assessment.py, rule_builder.py, examination_packs.py, and
customer_workflow.py are all AML/CTF-relevant, despite not being in P29's
original list. Re-triage also found two more the original pass missed
entirely: recommendations.py (act/dismiss on a system-generated regulatory
recommendation -- its own docstring already claimed "Dismissal is
auditable") and risk_matrix_config.py (compliance officers customising the
org's risk-factor weights and profile thresholds).

Several of these files already had SOME record-keeping -- OrgRiskMatrixVersion
snapshots, RiskScoreHistory, CustomerWorkflowEvent, and a few direct
AuditLog(...) writes (create_rule/update_rule/delete_rule in rule_builder.py;
create_assessment/submit_assessment/approve_assessment in risk_assessment.py;
run_risk_assessment/approve_edd/final_decision in customer_workflow.py) --
but none of that reached the central audit trail (GET /audit/) except the
direct AuditLog writes, which app/api/routes/audit.py already merges
(confirmed by test_audit_dual_table_smoke.py). This adds
audit_service.log_action() calls -- centralised in the shared _transition()/
_record_version() helper where one exists, so one change covers every
action that flows through it -- for everything that had no central
coverage at all.

Each test below exercises one file's fix and confirms the action reaches
GET /audit/?entity_type=...&entity_id=....
"""

import uuid
from datetime import date, timedelta

from app.models.regulatory_recommendation import (
    RecommendationType,
    RegulatoryRecommendation,
)
from app.models.user import UserRole
from app.services.org_service import seed_permission_catalog_and_roles
from tests.conftest import _auth
from tests.test_reports import _create_customer


def _audit_actions(client, headers, entity_type: str, entity_id: str) -> set:
    resp = client.get(
        f"/api/v1/audit/?entity_type={entity_type}&entity_id={entity_id}",
        headers=headers,
    )
    assert resp.status_code == 200, resp.text
    return {e["action"] for e in resp.json()}


def _register_and_promote(client, db, email: str, role: UserRole) -> dict:
    """Real registration (not the bare _make_user fixture) -- needed for
    files that depend on AMLSolution/RiskFramework, which only real
    registration seeds."""
    seed_permission_catalog_and_roles(db)
    resp = client.post(
        "/api/v1/auth/register",
        json={
            "email": email,
            "full_name": "P33 Test User",
            "password": "SecurePass123!",
        },
    )
    assert resp.status_code == 201, resp.text
    from app.models.user import User

    user = db.query(User).filter_by(email=email).first()
    user.role = role
    db.commit()
    db.refresh(user)
    return _auth(user)


# ── examination_packs.py ───────────────────────────────────────────────────


def test_examination_pack_generation_is_audited(client, compliance_headers):
    resp = client.post(
        "/api/v1/examination-packs/",
        json={
            "period_start": str(date.today() - timedelta(days=90)),
            "period_end": str(date.today()),
        },
        headers=compliance_headers,
    )
    assert resp.status_code == 200, resp.text
    pack_id = resp.json()["id"]
    actions = _audit_actions(client, compliance_headers, "examination_pack", pack_id)
    assert "examination_pack_generated" in actions


# ── recommendations.py ──────────────────────────────────────────────────────


def test_recommendation_dismissal_is_audited(
    client, db, compliance_user, compliance_headers
):
    rec = RegulatoryRecommendation(
        id=f"rr_{uuid.uuid4().hex[:12]}",
        org_id=compliance_user.org_id,
        recommendation_type=RecommendationType.consider_smr,
        title="Consider SMR lodgement",
        recommendation_text="Review transaction pattern for suspicious activity.",
    )
    db.add(rec)
    db.commit()

    resp = client.post(
        f"/api/v1/recommendations/{rec.id}/dismiss",
        json={
            "dismissed_reason": "Reviewed -- activity is consistent with known business."
        },
        headers=compliance_headers,
    )
    assert resp.status_code == 200, resp.text
    actions = _audit_actions(
        client, compliance_headers, "regulatory_recommendation", rec.id
    )
    assert "recommendation_dismissed" in actions


# ── risk_matrix_config.py ───────────────────────────────────────────────────


def test_risk_matrix_factor_addition_is_audited(
    client, compliance_user, compliance_headers
):
    resp = client.post(
        "/api/v1/risk-matrix/factors?reason=P33 audit coverage regression test",
        json={
            "category": "customer",
            "factor_key": f"custom_factor_{uuid.uuid4().hex[:6]}",
            "label": "Custom P33 Test Factor",
            "weight": 0.1,
        },
        headers=compliance_headers,
    )
    assert resp.status_code == 201, resp.text
    actions = _audit_actions(
        client, compliance_headers, "risk_matrix_config", compliance_user.org_id
    )
    assert "risk_matrix_factor_added" in actions


# ── rule_builder.py ──────────────────────────────────────────────────────────


def test_decision_support_panel_generation_is_audited(client, compliance_headers):
    customer_id = _create_customer(client, compliance_headers)
    resp = client.post(
        f"/api/v1/rule-builder/decision-support?customer_id={customer_id}",
        headers=compliance_headers,
    )
    assert resp.status_code == 201, resp.text
    panel_id = resp.json()["id"]
    actions = _audit_actions(
        client, compliance_headers, "decision_support_panel", panel_id
    )
    assert "decision_panel_generated" in actions


# ── aml_program.py ───────────────────────────────────────────────────────────


def test_aml_program_creation_is_audited(client, db):
    headers = _register_and_promote(
        client, db, f"p33-aml-{uuid.uuid4().hex[:6]}@test.com", UserRole.compliance
    )
    resp = client.post(
        "/api/v1/aml-program",
        json={
            "version": "2.0",
            "risk_appetite": "medium",
            "overview": "Test program overview.",
            "scope": "Test scope.",
        },
        headers=headers,
    )
    assert resp.status_code == 201, resp.text
    program_id = resp.json()["program"]["id"]
    actions = _audit_actions(client, headers, "aml_program", program_id)
    assert "aml_program_created" in actions


# ── professional_assessment.py ──────────────────────────────────────────────


def test_professional_assessment_creation_is_audited(client, compliance_headers):
    customer_id = _create_customer(client, compliance_headers)
    resp = client.post(
        "/api/v1/professional-assessments",
        json={
            "customer_id": customer_id,
            "professional_service_type": "accountant",
            "matter_description": "Annual tax return preparation.",
        },
        headers=compliance_headers,
    )
    assert resp.status_code == 201, resp.text
    assessment_id = resp.json()["id"]
    actions = _audit_actions(
        client, compliance_headers, "professional_assessment", assessment_id
    )
    assert "professional_assessment_created" in actions


# ── risk_assessment.py ───────────────────────────────────────────────────────


def test_mitigation_library_item_creation_is_audited(
    client, db, mlro_user, mlro_headers
):
    name = f"P33 Test Mitigation {uuid.uuid4().hex[:6]}"
    resp = client.post(
        f"/api/v1/risk/mitigation-library?name={name}&category=other&control_weighting=0.2",
        headers=mlro_headers,
    )
    assert resp.status_code == 200, resp.text

    from app.models.mitigation_library import MitigationLibraryItem

    item = db.query(MitigationLibraryItem).filter_by(name=name).one()
    actions = _audit_actions(client, mlro_headers, "mitigation_library_item", item.id)
    assert "mitigation_library_item_created" in actions


# ── customer_workflow.py ─────────────────────────────────────────────────────


def test_customer_workflow_transition_is_audited(client, compliance_headers):
    customer_id = _create_customer(client, compliance_headers)
    resp = client.post(
        f"/api/v1/customers/{customer_id}/workflow/start",
        headers=compliance_headers,
    )
    assert resp.status_code == 200, resp.text
    workflow_id = resp.json()["id"]
    actions = _audit_actions(
        client, compliance_headers, "customer_workflow", workflow_id
    )
    assert "customer_workflow_start_collection" in actions

    resp = client.patch(
        f"/api/v1/customers/{customer_id}/workflow/assign",
        json={"assigned_analyst": "analyst_1"},
        headers=compliance_headers,
    )
    assert resp.status_code == 200, resp.text
    actions = _audit_actions(
        client, compliance_headers, "customer_workflow", workflow_id
    )
    assert "customer_workflow_assigned" in actions
