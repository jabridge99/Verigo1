"""
Smoke test for a confirmed identity bug in POST /auth/register: the
frontend never sends `organisation_name` (confirmed by grep -- no
reference to it anywhere under web/), so the branch that created an
OrganisationUser membership and set User.primary_organisation_id/
industry_id never ran for a real signup. Verified directly against a
real registration through the actual API: the resulting user had
org_id set but industry_id and primary_organisation_id permanently
NULL.

That silent NULL broke every feature keyed off primary_organisation_id
(documents, billing, storage, connectors, IFTI, analytics) for that
user, and broke onboarding-session creation outright: create_session()
(app/services/onboarding_service.py) stamps a new Customer's org_id
from organisation_id == user.primary_organisation_id, which is NULL,
hitting Customer.org_id's NOT NULL constraint.

Fixed by always attaching the newly-registered user to the org just
created for them (app/services/org_service.py's new attach_owner()),
rather than only when organisation_name happened to be supplied.
"""

from app.services.org_service import seed_permission_catalog_and_roles


def test_register_sets_consistent_org_identity(client, db):
    seed_permission_catalog_and_roles(db)
    resp = client.post(
        "/api/v1/auth/register",
        json={
            "email": "consistent_org@test.com",
            "full_name": "Consistent Org",
            "password": "SecurePass123!",
        },
    )
    assert resp.status_code == 201

    from app.models.user import User

    user = db.query(User).filter_by(email="consistent_org@test.com").first()
    assert user.org_id is not None
    assert user.industry_id == user.org_id
    assert user.primary_organisation_id == user.org_id


def test_register_creates_owner_membership(client, db):
    seed_permission_catalog_and_roles(db)
    resp = client.post(
        "/api/v1/auth/register",
        json={
            "email": "owner_membership@test.com",
            "full_name": "Owner Membership",
            "password": "SecurePass123!",
        },
    )
    assert resp.status_code == 201

    from app.models.organisation import OrganisationUser
    from app.models.user import User

    user = db.query(User).filter_by(email="owner_membership@test.com").first()
    membership = (
        db.query(OrganisationUser)
        .filter_by(user_id=user.id, organisation_id=user.org_id)
        .first()
    )
    assert membership is not None


def test_registered_user_can_create_onboarding_session(client, db):
    seed_permission_catalog_and_roles(db)
    register_resp = client.post(
        "/api/v1/auth/register",
        json={
            "email": "onboarding_after_register@test.com",
            "full_name": "Onboarding After Register",
            "password": "SecurePass123!",
        },
    )
    assert register_resp.status_code == 201
    token = register_resp.json()["access_token"]

    resp = client.post(
        "/api/v1/onboarding/sessions",
        headers={"Authorization": f"Bearer {token}"},
        json={
            "applicant_name": "Jane Doe",
            "applicant_email": "jane@example.com",
            "customer_type": "individual",
        },
    )
    assert resp.status_code == 201
