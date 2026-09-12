"""
Stage 6 (Risk Assessment Engine) live trace: walks a customer through the
real workflow end to end -- start -> submit for verification -> verification
result -> trigger screening -> screening complete -> run the 5-dimension
risk engine -- exactly as a compliance officer would via the API, to prove
the engine that already exists (app/services/customer_risk_engine.py)
actually produces a score, a rating, and machine-readable reasons, and
correctly routes low-risk customers to CDD and high-risk (PEP + FATF
blacklist country) customers to EDD.
"""

from datetime import date

from app.models.customer import Customer, CustomerStatus, CustomerType
from tests.conftest import _auth


def _make_customer(db, org_id: str, suffix: str, **overrides) -> Customer:
    defaults = dict(
        customer_ref=f"CUST-{suffix}",
        org_id=org_id,
        full_name="Risk Trace Customer",
        date_of_birth=date(1985, 1, 1),
        customer_type=CustomerType.individual,
        status=CustomerStatus.draft,
        nationality="AU",
        country_of_residence="AU",
    )
    defaults.update(overrides)
    customer = Customer(**defaults)
    db.add(customer)
    db.commit()
    db.refresh(customer)
    return customer


def _walk_to_risk_assessment(client, customer_id: str, headers: dict):
    assert (
        client.post(
            f"/api/v1/customers/{customer_id}/workflow/start", headers=headers
        ).status_code
        == 200
    )
    assert (
        client.post(
            f"/api/v1/customers/{customer_id}/workflow/submit-verification",
            json={"action": "submit_for_verification"},
            headers=headers,
        ).status_code
        == 200
    )
    assert (
        client.post(
            f"/api/v1/customers/{customer_id}/workflow/verification-result",
            params={"passed": True},
            headers=headers,
        ).status_code
        == 200
    )
    assert (
        client.post(
            f"/api/v1/customers/{customer_id}/workflow/trigger-screening",
            headers=headers,
        ).status_code
        == 200
    )
    resp = client.post(
        f"/api/v1/customers/{customer_id}/workflow/screening-complete",
        headers=headers,
    )
    assert resp.status_code == 200, resp.text


def test_low_risk_customer_routes_to_cdd_with_a_low_score(client, admin_user, db):
    customer = _make_customer(db, admin_user.org_id, "LOW001")
    headers = _auth(admin_user)
    _walk_to_risk_assessment(client, customer.id, headers)

    resp = client.post(
        f"/api/v1/customers/{customer.id}/workflow/assess-risk",
        json={"channel": "branch"},
        headers=headers,
    )
    assert resp.status_code == 200, resp.text
    body = resp.json()

    assert body["gateway_decision"] == "cdd"
    assert body["edd_triggers"] == []
    assert body["overall_level"] in ("low", "medium")
    assert body["workflow_state_after"] == "cdd_review"
    # "Reasons" -- each dimension carries its own factor breakdown so a
    # reviewer can see *why* the score landed where it did.
    assert isinstance(body["customer_risk"]["factors"], dict)
    assert isinstance(body["geographic_risk"]["factors"], dict)
    # The engine is a tool, not the compliance decision-maker -- same
    # governance boundary the org-level EWRA engine already carries.
    assert "configurable scoring tool" in body["disclaimer"]


def test_pep_in_blacklist_country_routes_to_edd_with_reasons(client, admin_user, db):
    customer = _make_customer(
        db,
        admin_user.org_id,
        "HIGH001",
        nationality="KP",  # FATF blacklist
        country_of_residence="KP",
        is_pep=True,
    )
    headers = _auth(admin_user)
    _walk_to_risk_assessment(client, customer.id, headers)

    resp = client.post(
        f"/api/v1/customers/{customer.id}/workflow/assess-risk",
        json={"channel": "online", "involves_crypto": True},
        headers=headers,
    )
    assert resp.status_code == 200, resp.text
    body = resp.json()

    assert body["gateway_decision"] == "edd"
    assert body["overall_level"] in ("high", "critical")
    assert "pep_match" in body["edd_triggers"]
    assert "high_risk_country" in body["edd_triggers"]
    assert "crypto_exposure" in body["edd_triggers"]
    assert body["workflow_state_after"] == "edd_required"

    # Confirm the reasons persisted to the customer's risk profile, not just
    # the transient response -- a reviewer coming back later must see them.
    profile_resp = client.get(
        f"/api/v1/customers/{customer.id}/workflow/risk-profile", headers=headers
    )
    assert profile_resp.status_code == 200, profile_resp.text
    profile = profile_resp.json()
    assert profile["gateway_decision"] == "edd"
    assert "pep_match" in profile["edd_triggers"]
    assert "configurable scoring tool" in profile["disclaimer"]


def test_ewra_enterprise_wide_risk_assessment_live_trace(client, admin_user, db):
    """
    The *other* risk engine in this codebase: the org-level Enterprise-Wide
    Risk Assessment (EWRA) -- app/api/routes/risk_assessment.py,
    RiskFramework/RiskCategory/RiskFactor/RiskAssessmentRun -- used to
    produce the AML/CTF Program's annual (or trigger-based) risk assessment,
    as distinct from per-customer onboarding risk scoring. Seeds a real
    RiskFramework via the same factory function attach_owner() now calls
    for every real org (see test_org_creation_seeds_aml_solution_smoke.py;
    admin_user's org bypasses attach_owner() entirely, being built directly
    for test speed) and walks a full assessment: create -> score one factor
    -> submit -> approve.
    """
    from app.models.organisation import Organisation
    from app.templates.aml.factory import seed_aml_solution
    from app.templates.risk.factory import seed_risk_framework

    org = db.query(Organisation).filter_by(id=admin_user.org_id).first()
    solution = seed_aml_solution(db, org, admin_user.id)
    db.flush()
    seed_risk_framework(db, org, solution.id, admin_user.id)
    db.commit()

    headers = _auth(admin_user)

    fw_resp = client.get("/api/v1/risk/framework", headers=headers)
    assert fw_resp.status_code == 200, fw_resp.text
    categories = fw_resp.json()["categories"]
    assert len(categories) > 0

    created = client.post(
        "/api/v1/risk/assessments",
        params={
            "title": "FY2026 Annual Risk Assessment",
            "assessment_date": str(date.today()),
            "trigger": "annual",
        },
        headers=headers,
    )
    assert created.status_code == 201, created.text
    run_id = created.json()["id"]

    factors_resp = client.get(
        f"/api/v1/risk/assessments/{run_id}/factors", headers=headers
    )
    assert factors_resp.status_code == 200, factors_resp.text
    factor_scores = factors_resp.json()
    assert len(factor_scores) > 0
    first_score_id = factor_scores[0]["factor_score_id"]

    scored = client.patch(
        f"/api/v1/risk/assessments/{run_id}/factors/{first_score_id}",
        params={"likelihood": 4, "consequence": 4, "control_effectiveness": 2},
        headers=headers,
    )
    assert scored.status_code == 200, scored.text
    # inherent = L x C = 16; residual = inherent x CEF(2)=0.40 -> 6.4, "medium"
    assert scored.json()["inherent_risk_score"] == 16
    assert scored.json()["inherent_rating"] in ("high", "critical")

    submitted = client.post(
        f"/api/v1/risk/assessments/{run_id}/submit", headers=headers
    )
    assert submitted.status_code == 200, submitted.text
    assert submitted.json()["overall_residual_rating"] is not None

    approved = client.post(
        f"/api/v1/risk/assessments/{run_id}/approve",
        params={"disclaimer_acknowledged": True},
        headers=headers,
    )
    assert approved.status_code == 200, approved.text
    assert approved.json()["status"] == "approved"
