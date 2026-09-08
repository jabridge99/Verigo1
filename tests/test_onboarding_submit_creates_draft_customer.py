import uuid

from app.models.customer import Customer
from app.models.onboarding import CustomerType as OBCustomerType
from app.models.onboarding import OnboardingSession, SessionStatus
from app.models.organisation import IndustryType, Organisation
from app.models.screening import ScreeningRecord
from app.services.onboarding_service import submit_onboarding


def _make_session(db, org):
    return OnboardingSession(
        session_id=f"OBS-{uuid.uuid4().hex[:8].upper()}",
        industry_id="digital-currency-exchange",
        organisation_id=org.id,
        customer_type=OBCustomerType.individual,
        applicant_name="Jane Smith",
        applicant_email="jane@example.com",
        invite_token=uuid.uuid4().hex,
        status=SessionStatus.in_progress,
        collected_data={"date_of_birth": "1990-01-01", "nationality": "AU", "country_of_residence": "AU"},
    )


def _get_org(db):
    org = db.query(Organisation).first()
    if not org:
        org = Organisation(
            id="org1",
            name="Test Org",
            industry_id="digital-currency-exchange",
            industry_type=IndustryType.vasp,
        )
        db.add(org)
        db.commit()
    return org


def test_submit_onboarding_creates_draft_customer(db):
    org = _get_org(db)
    sess = _make_session(db, org)
    db.add(sess)
    db.commit()

    result = submit_onboarding(db, sess)

    assert sess.status == SessionStatus.documents_submitted
    assert result["status"] == SessionStatus.documents_submitted

    c = db.query(Customer).filter(Customer.id == sess.customer_id).first()
    assert c is not None
    assert c.status.value == "draft"

    sr = db.query(ScreeningRecord).filter(ScreeningRecord.customer_id == c.id).first()
    assert sr is not None


def test_submit_onboarding_is_idempotent(db):
    org = _get_org(db)
    sess = _make_session(db, org)
    db.add(sess)
    db.commit()

    first = submit_onboarding(db, sess)
    second = submit_onboarding(db, sess)

    assert second["status"] == "already_completed"
    assert second["customer_id"] == first["customer_id"]
