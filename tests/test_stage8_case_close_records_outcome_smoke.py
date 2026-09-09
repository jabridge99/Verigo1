"""
Stage 8 (Transaction & Monitoring Engine): case management gap found while
fixing the MLRO dashboard frontend (web/app/mlro/page.tsx).

Backend had zero test coverage for the Case CRUD/status/close API
(app/api/routes/cases.py) despite it being live and reachable. That gap let
a real frontend bug ship unnoticed: the MLRO dashboard's "Close Case" button
called POST /cases/{id}/status (transition_status, compliance+) instead of
POST /cases/{id}/close (close_case, mlro+) -- the only endpoint that
actually records outcome/outcome_notes/closure_reason/closed_by/closed_at.
Every case a real MLRO "closed" through the dashboard silently lost its
outcome data; the case just sat at status=closed_no_action with every
other close-specific field still null. Fixed the frontend to call the real
endpoint with a proper outcome/closure_reason form; this test covers the
backend contract that fix depends on, and the transition/permission rules
around it, so a future regression here has a test to catch it rather than
relying on someone reading the frontend code again.
"""

import uuid

from app.models.case import Case, CaseStatus
from app.models.organisation import IndustryType, Organisation
from app.models.user import User, UserRole, UserStatus
from app.services.auth_service import hash_password
from tests.conftest import _auth


def _make_org(db) -> Organisation:
    org = Organisation(
        name=f"Test Org {uuid.uuid4().hex[:6]}", industry_type=IndustryType.remittance
    )
    db.add(org)
    db.commit()
    db.refresh(org)
    return org


def _make_user(db, org_id: str, role: UserRole) -> User:
    user = User(
        email=f"{role.value}-{uuid.uuid4().hex[:6]}@test.com",
        full_name=f"Test {role.value.title()}",
        hashed_password=hash_password("TestPassword123!"),
        role=role,
        status=UserStatus.active,
        org_id=org_id,
        industry_id=org_id,
        primary_organisation_id=org_id,
    )
    db.add(user)
    db.commit()
    db.refresh(user)
    return user


def test_close_case_records_outcome_and_closure_reason(client, db):
    org = _make_org(db)
    compliance = _make_user(db, org.id, UserRole.compliance)
    mlro = _make_user(db, org.id, UserRole.mlro)

    created = client.post(
        "/api/v1/cases",
        json={"title": "Structuring pattern — test customer", "severity": "high"},
        headers=_auth(compliance),
    )
    assert created.status_code == 201, created.text
    case_id = created.json()["id"]
    assert created.json()["status"] == "open"

    # Walk it through to "decision" via the real transition endpoint.
    for new_status in ["under_investigation", "decision"]:
        resp = client.post(
            f"/api/v1/cases/{case_id}/status",
            json={"new_status": new_status},
            headers=_auth(compliance),
        )
        assert resp.status_code == 200, resp.text
        assert resp.json()["status"] == new_status

    closed = client.post(
        f"/api/v1/cases/{case_id}/close",
        json={
            "status": "closed_smr_filed",
            "outcome": "smr_filed",
            "outcome_notes": "Filed with AUSTRAC reference SMR-TEST-001.",
            "closure_reason": "Structuring pattern confirmed after investigation.",
        },
        headers=_auth(mlro),
    )
    assert closed.status_code == 200, closed.text
    body = closed.json()
    assert body["status"] == "closed_smr_filed"
    assert body["outcome"] == "smr_filed"
    assert body["outcome_notes"] == "Filed with AUSTRAC reference SMR-TEST-001."
    assert (
        body["closure_reason"] == "Structuring pattern confirmed after investigation."
    )
    assert body["closed_by"] == mlro.id
    assert body["closed_at"] is not None

    case = db.query(Case).filter(Case.id == case_id).first()
    assert case.status == CaseStatus.closed_smr_filed
    assert case.outcome_notes == "Filed with AUSTRAC reference SMR-TEST-001."


def test_close_case_requires_mlro_not_just_compliance(client, db):
    org = _make_org(db)
    compliance = _make_user(db, org.id, UserRole.compliance)

    created = client.post(
        "/api/v1/cases",
        json={"title": "Compliance-only close attempt", "severity": "low"},
        headers=_auth(compliance),
    )
    assert created.status_code == 201, created.text
    case_id = created.json()["id"]

    resp = client.post(
        f"/api/v1/cases/{case_id}/status",
        json={"new_status": "under_investigation"},
        headers=_auth(compliance),
    )
    assert resp.status_code == 200, resp.text

    # transition_status can't reach a closed_* status directly from
    # under_investigation except closed_no_action -- and compliance role
    # (not mlro+) is exactly what the real /close endpoint should reject.
    close_attempt = client.post(
        f"/api/v1/cases/{case_id}/close",
        json={
            "status": "closed_no_action",
            "outcome": "no_suspicious_activity",
            "closure_reason": "Nothing found.",
        },
        headers=_auth(compliance),
    )
    assert close_attempt.status_code == 403, close_attempt.text


def test_status_endpoint_cannot_reopen_or_bypass_close_a_closed_case(client, db):
    org = _make_org(db)
    compliance = _make_user(db, org.id, UserRole.compliance)
    mlro = _make_user(db, org.id, UserRole.mlro)

    created = client.post(
        "/api/v1/cases",
        json={"title": "Already-closed case", "severity": "low"},
        headers=_auth(compliance),
    )
    case_id = created.json()["id"]

    client.post(
        f"/api/v1/cases/{case_id}/status",
        json={"new_status": "under_investigation"},
        headers=_auth(compliance),
    )
    client.post(
        f"/api/v1/cases/{case_id}/status",
        json={"new_status": "decision"},
        headers=_auth(compliance),
    )
    close_resp = client.post(
        f"/api/v1/cases/{case_id}/close",
        json={
            "status": "closed_no_action",
            "outcome": "no_suspicious_activity",
            "closure_reason": "No adverse findings.",
        },
        headers=_auth(mlro),
    )
    assert close_resp.status_code == 200, close_resp.text

    reopen_attempt = client.post(
        f"/api/v1/cases/{case_id}/status",
        json={"new_status": "under_investigation"},
        headers=_auth(compliance),
    )
    assert reopen_attempt.status_code == 409, reopen_attempt.text
