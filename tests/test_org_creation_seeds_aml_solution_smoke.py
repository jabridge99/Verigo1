"""
Confirmed gap: seed_aml_solution() (app/templates/aml/factory.py) and
seed_risk_framework() (app/templates/risk/factory.py) -- which create the
AMLSolution, AMLProgram document, and RiskFramework (with its industry
seeded RiskCategories/RiskFactors) every org needs -- have existed since
early in this staged process but were never actually called from any real
code path (only referenced inside their own module docstrings). Every
organisation ever created through real registration or POST /organisations
got a bare Organisation row and nothing else: every AML program, risk
framework, and governance endpoint 404'd with "Complete onboarding and
industry selection first" forever, with no way to proceed (no "complete
onboarding" endpoint existed to trigger the seeding either).

Fixed by wiring both seed functions into org_service.py's attach_owner()
-- the one function already called from both real org-creation paths
(self-serve POST /auth/register and admin-facing POST /organisations) --
guarded on AMLSolution's unique org_id constraint so it's a safe no-op if
attach_owner() is ever called twice for the same org.
"""

from app.services.org_service import seed_permission_catalog_and_roles
from tests.conftest import _auth


def test_registration_seeds_a_working_aml_solution_and_risk_framework(client, db):
    seed_permission_catalog_and_roles(db)
    resp = client.post(
        "/api/v1/auth/register",
        json={
            "email": "solution_seed@test.com",
            "full_name": "Solution Seed Owner",
            "password": "SecurePass123!",
        },
    )
    assert resp.status_code == 201

    from app.models.user import User

    user = db.query(User).filter_by(email="solution_seed@test.com").first()
    headers = _auth(user)

    # The seeded program starts as a draft (not yet activated by the MLRO),
    # so GET /aml-program (the *active* program) correctly reports none yet --
    # /versions lists all programs regardless of status.
    program_resp = client.get("/api/v1/aml-program", headers=headers)
    assert program_resp.status_code == 200, program_resp.text
    assert program_resp.json()["active_program"] is None

    versions_resp = client.get("/api/v1/aml-program/versions", headers=headers)
    assert versions_resp.status_code == 200, versions_resp.text
    versions = versions_resp.json()["versions"]
    assert len(versions) == 1
    assert versions[0]["status"] == "draft"

    framework_resp = client.get("/api/v1/risk/framework", headers=headers)
    assert framework_resp.status_code == 200, framework_resp.text
    framework_body = framework_resp.json()
    assert len(framework_body["categories"]) > 0

    controls_resp = client.get("/api/v1/governance/controls", headers=headers)
    assert controls_resp.status_code == 200, controls_resp.text
