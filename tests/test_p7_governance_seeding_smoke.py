"""
P7/P11: seed_aml_solution() (app/templates/aml/factory.py) used to create
rows in the legacy, UI-disconnected Control/AMLPolicy models
(app.models.aml_solution) while the actively-developed governance module a
real compliance officer uses -- GET/POST /governance/controls,
/governance/policies; app.models.governance_controls.GovernanceControl,
app.models.governance.Policy -- read from a separate, unrelated table set.
Freshly seeded starter controls/policies were invisible to the real UI.

Fixed by retargeting seed_aml_solution() (and org_service.py's
select_industry() wipe-and-reseed path) at GovernanceControl/Policy
directly, mapping each template's free-text policy_type/risk_area onto the
closed PolicyType/ControlRiskArea enums (falling back to PolicyType.other /
ControlRiskArea.custom+risk_area_custom for values with no precise
equivalent -- never force-mapped). Added PolicyType.independent_review_policy
for the one BASE_POLICIES entry ("Independent Review Policy") that had no
enum equivalent at all.
"""

from app.models.governance import Policy, PolicyType
from app.models.governance_controls import ControlRiskArea, GovernanceControl
from app.services.org_service import seed_permission_catalog_and_roles
from tests.conftest import _auth


def _register(client, db, email: str) -> tuple[dict, dict]:
    seed_permission_catalog_and_roles(db)
    resp = client.post(
        "/api/v1/auth/register",
        json={
            "email": email,
            "full_name": "Governance Seed Owner",
            "password": "SecurePass123!",
        },
    )
    assert resp.status_code == 201, resp.text
    body = resp.json()
    from app.models.user import User

    user = db.query(User).filter_by(email=email).first()
    headers = _auth(user)
    return body, headers


def test_registration_seeds_controls_and_policies_visible_via_governance_api(
    client, db
):
    body, headers = _register(client, db, "p7_governance_seed@test.com")
    org_id = body["org_id"]

    controls_resp = client.get("/api/v1/governance/controls", headers=headers)
    assert controls_resp.status_code == 200, controls_resp.text
    controls = controls_resp.json()
    assert len(controls) == 9  # BASE_CONTROLS ("other" industry template)
    assert all(c["control_owner"] for c in controls)
    assert all(c["control_method"] for c in controls)

    policies_resp = client.get("/api/v1/governance/policies", headers=headers)
    assert policies_resp.status_code == 200, policies_resp.text
    policies = policies_resp.json()
    assert len(policies) == 9  # BASE_POLICIES
    assert all(p["document_owner"] for p in policies)

    # No orphaned legacy rows -- seeding no longer writes to Control/AMLPolicy.
    from app.models.aml_solution import AMLPolicy, AMLSolution, Control

    solution = db.query(AMLSolution).filter_by(org_id=org_id).first()
    assert db.query(Control).filter_by(solution_id=solution.id).count() == 0
    assert db.query(AMLPolicy).filter_by(solution_id=solution.id).count() == 0


def test_independent_review_policy_seeded_with_new_enum_value(client, db):
    body, headers = _register(client, db, "p7_ir_policy@test.com")
    org_id = body["org_id"]

    ir_policy = (
        db.query(Policy)
        .filter_by(org_id=org_id, policy_type=PolicyType.independent_review_policy)
        .first()
    )
    assert ir_policy is not None
    assert ir_policy.title == "Independent Review Policy"
    assert ir_policy.policy_number.startswith("AML-IR-")


def test_ambiguous_risk_area_falls_back_to_custom_not_forced_mapping(client, db):
    # remittance's extra_controls include "agent_oversight" -- no precise
    # ControlRiskArea equivalent exists, so it must land on `custom` with the
    # original label preserved in risk_area_custom rather than a guessed
    # category.
    body, headers = _register(client, db, "p7_remittance_seed@test.com")
    org_id = body["org_id"]

    selected = client.post(
        f"/api/v1/organisations/{org_id}/select-industry",
        json={"industry_type": "remittance"},
        headers=headers,
    )
    assert selected.status_code == 200, selected.text

    db.expire_all()
    custom_controls = (
        db.query(GovernanceControl)
        .filter_by(org_id=org_id, risk_area=ControlRiskArea.custom)
        .all()
    )
    assert any(c.risk_area_custom == "agent_oversight" for c in custom_controls)


def test_reseed_on_industry_change_does_not_duplicate_governance_rows(client, db):
    body, headers = _register(client, db, "p7_reseed@test.com")
    org_id = body["org_id"]

    selected = client.post(
        f"/api/v1/organisations/{org_id}/select-industry",
        json={"industry_type": "banking"},
        headers=headers,
    )
    assert selected.status_code == 200, selected.text

    db.expire_all()
    from app.models.aml_solution import AMLSolution

    solution = db.query(AMLSolution).filter_by(org_id=org_id).first()
    controls = db.query(GovernanceControl).filter_by(solution_id=solution.id).all()
    policies = db.query(Policy).filter_by(solution_id=solution.id).all()
    # 9 base + banking's 4 extra controls / 3 extra policies, exactly once.
    assert len(controls) == 13
    assert len(policies) == 12
    assert len({c.control_ref for c in controls}) == len(controls)
    assert len({p.policy_number for p in policies}) == len(policies)
