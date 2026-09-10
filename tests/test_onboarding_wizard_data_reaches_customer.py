"""
Regression test for a confirmed data-loss bug in the real applicant
self-serve onboarding portal (web/app/onboarding/[token]/page.tsx ->
CustomerPortal.tsx -> POST /onboarding/portal/{token}/submit ->
submit_onboarding()).

create_session() (app/services/onboarding_service.py) -- called by every
real session-creation path, both the manual POST /onboarding/sessions
endpoint and the CSV/Excel bulk import -- creates a draft Customer record
immediately and sets session.customer_id right away, so an ops-entered
applicant has somewhere to attach documents before ever touching the
self-serve portal.

submit_onboarding() (the function that runs when an applicant finishes
the 5-step wizard and clicks "Submit Application") used
`if session.customer_id: return {"status": "already_completed", ...}`
as its very first line. Since customer_id is always already set from
session creation, this fired immediately on every real applicant's
submission -- the applicant sees "Application Submitted", but their
DOB, nationality, address, occupation, source of funds, PEP declaration,
and sanctions screening were silently never saved anywhere. Confirmed
live: created a session exactly as the real endpoint does, walked it
through all 5 wizard steps with real data, submitted, and the resulting
Customer record's date_of_birth/occupation were still None.

Fixed by tracking idempotency via session.status instead (only
SessionStatus.documents_submitted or later counts as "already
submitted" -- a freshly created session starts at `invited`), and by
updating the existing draft Customer in place rather than assuming one
still needs to be created.
"""

import pytest

from app.models.customer import Customer
from app.models.organisation import IndustryType, Organisation
from app.services.onboarding_service import (
    advance_step,
    create_session,
    submit_onboarding,
)


@pytest.mark.asyncio
async def test_applicant_wizard_data_reaches_customer_record(db):
    org = Organisation(
        name="Wizard Data Test Org",
        industry_id="digital-currency-exchange",
        industry_type=IndustryType.vasp,
    )
    db.add(org)
    db.commit()

    # Exactly what POST /onboarding/sessions and the CSV/Excel bulk import
    # both call for every real session.
    session = create_session(
        db,
        industry_id=org.industry_id,
        organisation_id=org.id,
        applicant_name="Jane Applicant",
        applicant_email="jane@example.com",
        source="manual",
        created_by="usr_staff",
    )
    db.commit()
    assert session.customer_id is not None, (
        "sanity check: this is the pre-existing behaviour"
    )

    # Simulate the applicant completing the real portal wizard, exactly as
    # CustomerPortal.tsx's handleNext() does via POST /portal/{token}/step.
    advance_step(
        db,
        session,
        1,
        {"id_type": "passport", "date_of_birth": "1990-05-15", "nationality": "AU"},
    )
    advance_step(db, session, 2, {"address": "1 Test St", "country_of_residence": "AU"})
    advance_step(
        db, session, 3, {"occupation": "Engineer", "source_of_funds": "employment"}
    )
    advance_step(db, session, 4, {"is_pep": False, "terms_accepted": True})
    db.commit()

    # The "Submit Application" button -> POST /portal/{token}/submit.
    result = await submit_onboarding(db, session)

    customer = db.query(Customer).filter(Customer.id == session.customer_id).first()
    assert customer.date_of_birth is not None
    assert customer.occupation == "Engineer"
    assert customer.source_of_funds == "employment"
    assert result["customer_id"] == customer.id


@pytest.mark.asyncio
async def test_second_submit_is_idempotent_and_does_not_wipe_data(db):
    org = Organisation(
        name="Wizard Idempotent Test Org",
        industry_id="digital-currency-exchange",
        industry_type=IndustryType.vasp,
    )
    db.add(org)
    db.commit()

    session = create_session(
        db,
        industry_id=org.industry_id,
        organisation_id=org.id,
        applicant_name="Jane Applicant",
        applicant_email="jane2@example.com",
        source="manual",
        created_by="usr_staff",
    )
    db.commit()
    advance_step(db, session, 1, {"date_of_birth": "1990-05-15"})
    db.commit()

    first = await submit_onboarding(db, session)
    second = await submit_onboarding(db, session)

    assert second["customer_id"] == first["customer_id"]
    customer = db.query(Customer).filter(Customer.id == session.customer_id).first()
    assert customer.date_of_birth is not None
