"""
Stage 7 (AML/CTF Program Module), requirement 1: "Select industry."

Confirmed gap: every organisation is created as IndustryType.other (nothing
upstream of registration or POST /organisations knows the real industry),
so the AML Solution seeded at signup (Stage 6 fix) always uses the generic
"other" Compliance Pack -- even for a business that's clearly, say, a
remittance provider. There was also no reachable endpoint anywhere that
could change it afterwards.

Fixed by adding POST /organisations/{org_id}/select-industry, which sets
Organisation.industry_type and re-seeds the AML Solution (Program + Risk
Framework) from the correct industry template -- but only while nothing's
been customised yet (program still draft v1.0, no risk assessment started),
since a silent wipe-and-reseed would be unsafe once real work exists.
"""

from app.models.aml_solution import AMLSolution
from app.models.organisation import Organisation
from app.models.risk_engine import RiskFramework
from app.services.org_service import seed_permission_catalog_and_roles
from tests.conftest import _auth


def _register(client, db, email: str) -> tuple[dict, dict]:
    seed_permission_catalog_and_roles(db)
    resp = client.post(
        "/api/v1/auth/register",
        json={
            "email": email,
            "full_name": "Select Industry Owner",
            "password": "SecurePass123!",
        },
    )
    assert resp.status_code == 201, resp.text
    body = resp.json()
    from app.models.user import User

    user = db.query(User).filter_by(email=email).first()
    headers = _auth(user)
    return body, headers


def test_new_org_defaults_to_other_and_can_select_a_real_industry(client, db):
    body, headers = _register(client, db, "select_industry@test.com")
    org_id = body["org_id"]

    org_resp = client.get(f"/api/v1/organisations/{org_id}", headers=headers)
    assert org_resp.status_code == 200, org_resp.text
    assert org_resp.json()["industry_type"] == "other"

    solution = db.query(AMLSolution).filter_by(org_id=org_id).first()
    assert solution.template_industry == "other"
    framework = db.query(RiskFramework).filter_by(org_id=org_id).first()
    assert framework.industry == "other"

    selected = client.post(
        f"/api/v1/organisations/{org_id}/select-industry",
        json={"industry_type": "remittance"},
        headers=headers,
    )
    assert selected.status_code == 200, selected.text
    assert selected.json()["industry_type"] == "remittance"

    db.expire_all()
    org = db.query(Organisation).filter_by(id=org_id).first()
    assert org.industry_type.value == "remittance"

    # Re-seeded from the remittance template, not the generic "other" one.
    solution = db.query(AMLSolution).filter_by(org_id=org_id).first()
    assert solution.template_industry == "remittance"
    framework = db.query(RiskFramework).filter_by(org_id=org_id).first()
    assert framework.industry == "remittance"

    program_resp = client.get("/api/v1/aml-program/versions", headers=headers)
    assert program_resp.status_code == 200, program_resp.text
    versions = program_resp.json()["versions"]
    assert len(versions) == 1  # old draft replaced, not accumulated
    assert versions[0]["status"] == "draft"


def test_selecting_the_same_industry_again_is_a_no_op(client, db):
    body, headers = _register(client, db, "select_industry_noop@test.com")
    org_id = body["org_id"]

    resp = client.post(
        f"/api/v1/organisations/{org_id}/select-industry",
        json={"industry_type": "other"},
        headers=headers,
    )
    assert resp.status_code == 200, resp.text
    assert resp.json()["industry_type"] == "other"


def test_industry_locked_once_program_is_activated(client, admin_user, db):
    from app.models.organisation import MembershipStatus, OrganisationUser
    from app.services.org_service import (
        _seed_aml_solution_and_risk_framework,
        get_system_role,
        seed_permission_catalog_and_roles,
    )

    seed_permission_catalog_and_roles(db)
    org = db.query(Organisation).filter_by(id=admin_user.org_id).first()
    _seed_aml_solution_and_risk_framework(db, org, admin_user)
    # admin_user (fixture) has no org membership by default -- give it one
    # so it passes select-industry's/update's "org:manage" permission check,
    # matching what a real registered owner actually has.
    owner_role = get_system_role(db, "owner")
    db.add(
        OrganisationUser(
            organisation_id=org.id,
            user_id=admin_user.id,
            role_id=owner_role.id,
            status=MembershipStatus.active,
        )
    )
    db.commit()

    headers = _auth(admin_user)

    versions_resp = client.get("/api/v1/aml-program/versions", headers=headers)
    program_id = versions_resp.json()["versions"][0]["id"]

    activated = client.post(
        f"/api/v1/aml-program/{program_id}/activate", headers=headers
    )
    assert activated.status_code == 200, activated.text

    locked = client.post(
        f"/api/v1/organisations/{org.id}/select-industry",
        json={"industry_type": "vasp"},
        headers=headers,
    )
    assert locked.status_code == 409, locked.text
