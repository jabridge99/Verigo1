"""
Stage 7 (AML/CTF Program Module), requirement "set review dates."

Not a gap -- this already works end to end once an org actually has a
seeded AML Solution (the Stage 6 fix): the industry template seeds
review_due_date one year out (app/templates/aml/factory.py), and
POST /aml-program/{id}/record-review (app/api/routes/aml_program.py) lets
an MLRO+ record a review and set the next one. Verified live rather than
just read from the code, matching this session's practice for any Stage
deliverable claim.
"""

from datetime import date

from app.models.organisation import MembershipStatus, Organisation, OrganisationUser
from app.services.org_service import (
    _seed_aml_solution_and_risk_framework,
    get_system_role,
    seed_permission_catalog_and_roles,
)
from tests.conftest import _auth


def test_program_has_a_review_due_date_and_can_record_a_review(client, admin_user, db):
    seed_permission_catalog_and_roles(db)
    org = db.query(Organisation).filter_by(id=admin_user.org_id).first()
    _seed_aml_solution_and_risk_framework(db, org, admin_user)
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

    versions = client.get("/api/v1/aml-program/versions", headers=headers).json()
    program_id = versions["versions"][0]["id"]
    assert versions["versions"][0]["review_due_date"] is not None

    activated = client.post(
        f"/api/v1/aml-program/{program_id}/activate", headers=headers
    )
    assert activated.status_code == 200, activated.text

    next_due = date.today().replace(year=date.today().year + 1)
    reviewed = client.post(
        f"/api/v1/aml-program/{program_id}/record-review",
        headers=headers,
        json={
            "review_notes": "Annual review completed, no material changes required.",
            "next_review_date": str(next_due),
            "changes_required": False,
        },
    )
    assert reviewed.status_code == 200, reviewed.text

    current = client.get("/api/v1/aml-program", headers=headers)
    assert current.status_code == 200, current.text
    active_program = current.json()["active_program"]
    assert active_program["review_due_date"] == str(next_due)
    assert active_program["reviewed_by"] == admin_user.id
    assert active_program["last_reviewed_at"] is not None
