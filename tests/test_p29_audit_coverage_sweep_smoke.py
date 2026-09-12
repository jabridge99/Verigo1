"""
P29: a file-by-file sweep (grep -c "log_action(" app/api/routes/*.py) found
~35 route files with zero audit-trail coverage. Stage 11 fixed the two
highest-value gaps (kyc.py, transactions.py); this pass works through the
rest of the list the parking lot itself named as AML/CTF-relevant:
retention.py, screening.py, independent_review.py, board_reporting.py,
monitoring.py, compliance_calendar.py, and onboarding.py's wizard-driven
steps.

retention.py turned out not to have any destructive/irreversible action at
all -- generate_purge_report() is explicitly dry-run-only, so the original
parking-lot framing ("destructive/irreversible") overstated it; its real
mutating surface is just policy upserts and legal-hold create/release.

onboarding.py already had its own session-scoped audit trail
(OnboardingAuditLog, GET /onboarding/sessions/{id}/audit) -- but that table
is a separate silo never merged into the central GET /audit/ endpoint, and
even within its own silo only 2 of ~7 lifecycle events were logged. This
pass adds central audit_service.log_action() calls (entity_type
"onboarding_session") alongside the existing silo, so onboarding actions
are now visible from the one place a compliance officer actually looks.

Each test below exercises one file's fix and confirms the action reaches
GET /audit/?entity_type=...&entity_id=....
"""

import uuid
from datetime import date, timedelta


def _audit_actions(client, headers, entity_type: str, entity_id: str) -> set:
    resp = client.get(
        f"/api/v1/audit/?entity_type={entity_type}&entity_id={entity_id}",
        headers=headers,
    )
    assert resp.status_code == 200, resp.text
    return {e["action"] for e in resp.json()}


# ── retention.py ─────────────────────────────────────────────────────────────


def test_retention_policy_and_legal_hold_are_audited(
    client, db, mlro_user, mlro_headers
):
    resp = client.put(
        "/api/v1/retention/policies",
        json={"entity_scope": "customer", "retention_years": 7},
        headers=mlro_headers,
    )
    assert resp.status_code == 200, resp.text
    policy_id = resp.json()["policy_id"]
    actions = _audit_actions(client, mlro_headers, "retention", policy_id)
    assert "retention_policy_set" in actions

    resp = client.post(
        "/api/v1/retention/holds",
        json={
            "entity_scope": "customer",
            "entity_id": f"cust_{uuid.uuid4().hex[:8]}",
            "reason": "Pending litigation.",
        },
        headers=mlro_headers,
    )
    assert resp.status_code == 201, resp.text
    hold_id = resp.json()["hold_id"]
    actions = _audit_actions(client, mlro_headers, "retention", hold_id)
    assert "legal_hold_placed" in actions

    resp = client.post(
        f"/api/v1/retention/holds/{hold_id}/release", headers=mlro_headers
    )
    assert resp.status_code == 200, resp.text
    actions = _audit_actions(client, mlro_headers, "retention", hold_id)
    assert "legal_hold_released" in actions


# ── screening.py ─────────────────────────────────────────────────────────────


def _create_customer(client, headers, tag: str) -> str:
    resp = client.post(
        "/api/v1/customers/",
        json={
            "full_name": f"P29 Customer {tag}",
            "email": f"p29-{tag}-{uuid.uuid4().hex[:6]}@example.com",
            "phone": "+61400000095",
            "date_of_birth": "1990-01-01",
            "nationality": "AU",
            "country_of_residence": "AU",
            "id_number": f"PP{uuid.uuid4().hex[:8]}",
            "id_type": "passport",
            "address": "1 P29 Test St, Sydney NSW 2000",
            "industry": "banking",
        },
        headers=headers,
    )
    assert resp.status_code == 201, resp.text
    return resp.json()["id"]


def test_screening_run_is_audited(client, compliance_headers):
    cid = _create_customer(client, compliance_headers, "screen")
    resp = client.post(
        "/api/v1/screening/run",
        json={"customer_id": cid, "screening_types": ["sanctions"]},
        headers=compliance_headers,
    )
    assert resp.status_code == 201, resp.text
    record_id = resp.json()["records"][0]["id"]
    actions = _audit_actions(client, compliance_headers, "screening_record", record_id)
    assert "screening_run" in actions


def test_identity_score_decision_is_audited(client, compliance_headers):
    cid = _create_customer(client, compliance_headers, "idscore")
    resp = client.post(
        f"/api/v1/screening/customers/{cid}/identity-score/decide",
        headers=compliance_headers,
    )
    assert resp.status_code == 200, resp.text
    actions = _audit_actions(client, compliance_headers, "customer", cid)
    assert "identity_score_decided" in actions


# ── independent_review.py ─────────────────────────────────────────────────────


def test_independent_review_lifecycle_is_audited(
    client, db, compliance_user, compliance_headers
):
    resp = client.post(
        "/api/v1/independent-reviews",
        json={
            "review_ref": f"IR-{uuid.uuid4().hex[:8]}",
            "review_type": "internal",
            "review_scope": "aml_program",
            "title": "P29 regression review",
        },
        headers=compliance_headers,
    )
    assert resp.status_code == 201, resp.text
    review_id = resp.json()["id"]
    actions = _audit_actions(
        client, compliance_headers, "independent_review", review_id
    )
    assert "review_created" in actions

    resp = client.post(
        f"/api/v1/independent-reviews/{review_id}/transition",
        params={"to_status": "in_progress"},
        headers=compliance_headers,
    )
    assert resp.status_code == 200, resp.text
    actions = _audit_actions(
        client, compliance_headers, "independent_review", review_id
    )
    assert "review_transitioned" in actions

    resp = client.post(
        f"/api/v1/independent-reviews/{review_id}/findings",
        json={
            "finding_ref": f"F-{uuid.uuid4().hex[:8]}",
            "title": "Missing SOF evidence",
            "description": "Sample of files lacked source-of-funds evidence.",
            "risk_rating": "high",
            "category": "cdd",
        },
        headers=compliance_headers,
    )
    assert resp.status_code == 201, resp.text
    finding_id = resp.json()["id"]
    actions = _audit_actions(client, compliance_headers, "review_finding", finding_id)
    assert "finding_created" in actions


# ── board_reporting.py ────────────────────────────────────────────────────────


def test_board_report_creation_is_audited(client, compliance_headers):
    resp = client.post(
        "/api/v1/board-reports",
        json={
            "report_ref": f"BR-{uuid.uuid4().hex[:8]}",
            "report_type": "board_aml",
            "period": "q1",
            "period_start": str(date.today() - timedelta(days=90)),
            "period_end": str(date.today()),
        },
        headers=compliance_headers,
    )
    assert resp.status_code == 201, resp.text
    report_id = resp.json()["id"]
    actions = _audit_actions(client, compliance_headers, "board_report", report_id)
    assert "board_report_created" in actions


# ── monitoring.py ────────────────────────────────────────────────────────────


def test_monitoring_rule_lifecycle_is_audited(client, admin_user, admin_headers):
    resp = client.post(
        "/api/v1/monitoring/rules",
        json={
            "name": "P29 regression rule",
            "category": "structuring",
            "condition_groups": [],
        },
        headers=admin_headers,
    )
    assert resp.status_code == 201, resp.text
    rule_id = resp.json()["id"]
    actions = _audit_actions(client, admin_headers, "monitoring_rule", rule_id)
    assert "monitoring_rule_created" in actions

    resp = client.delete(f"/api/v1/monitoring/rules/{rule_id}", headers=admin_headers)
    assert resp.status_code == 204, resp.text
    actions = _audit_actions(client, admin_headers, "monitoring_rule", rule_id)
    assert "monitoring_rule_deleted" in actions


# ── compliance_calendar.py ────────────────────────────────────────────────────


def test_calendar_item_lifecycle_is_audited(client, compliance_headers):
    resp = client.post(
        "/api/v1/compliance-calendar",
        json={
            "item_type": "policy_review",
            "title": "Annual AML/CTF policy review",
            "due_date": str(date.today() + timedelta(days=30)),
        },
        headers=compliance_headers,
    )
    assert resp.status_code == 201, resp.text
    item_id = resp.json()["id"]
    actions = _audit_actions(client, compliance_headers, "calendar_item", item_id)
    assert "calendar_item_created" in actions

    resp = client.post(
        f"/api/v1/compliance-calendar/{item_id}/complete",
        json={"completion_notes": "Reviewed and re-approved."},
        headers=compliance_headers,
    )
    assert resp.status_code == 200, resp.text
    actions = _audit_actions(client, compliance_headers, "calendar_item", item_id)
    assert "calendar_item_completed" in actions


# ── onboarding.py ─────────────────────────────────────────────────────────────


def test_onboarding_session_lifecycle_is_audited(client, compliance_headers):
    resp = client.post(
        "/api/v1/onboarding/sessions",
        json={
            "applicant_name": "P29 Applicant",
            "applicant_email": f"p29-applicant-{uuid.uuid4().hex[:6]}@example.com",
        },
        headers=compliance_headers,
    )
    assert resp.status_code == 201, resp.text
    session_id = resp.json()["session_id"]
    actions = _audit_actions(
        client, compliance_headers, "onboarding_session", session_id
    )
    assert "onboarding_session_created" in actions

    resp = client.post(
        f"/api/v1/onboarding/sessions/{session_id}/cancel", headers=compliance_headers
    )
    assert resp.status_code == 200, resp.text
    actions = _audit_actions(
        client, compliance_headers, "onboarding_session", session_id
    )
    assert "onboarding_session_cancelled" in actions
