"""
Smoke test for a missing endpoint: web/app/onboarding/page.tsx's "Cancel
Request" button calls POST /onboarding/sessions/{session_id}/cancel, but
app/api/routes/onboarding.py never defined that route -- a 404 on every
click, for every staff user, since the feature was added. Fixed by adding
the route plus a small cancel_session() service function.
"""

from tests.conftest import _auth


def test_cancel_session_endpoint_exists_and_sets_abandoned(client, admin_user):
    create_resp = client.post(
        "/api/v1/onboarding/sessions",
        headers=_auth(admin_user),
        json={
            "applicant_name": "Jane Doe",
            "applicant_email": "jane@example.com",
            "customer_type": "individual",
        },
    )
    assert create_resp.status_code == 201
    session_id = create_resp.json()["session_id"]

    resp = client.post(
        f"/api/v1/onboarding/sessions/{session_id}/cancel", headers=_auth(admin_user)
    )
    assert resp.status_code == 200
    assert resp.json()["status"] == "abandoned"


def test_cannot_cancel_a_completed_session(client, admin_user, db):
    from app.models.onboarding import OnboardingSession, SessionStatus

    create_resp = client.post(
        "/api/v1/onboarding/sessions",
        headers=_auth(admin_user),
        json={
            "applicant_name": "Jane Doe",
            "applicant_email": "jane2@example.com",
            "customer_type": "individual",
        },
    )
    session_id = create_resp.json()["session_id"]
    session = db.query(OnboardingSession).filter_by(session_id=session_id).first()
    session.status = SessionStatus.completed
    db.commit()

    resp = client.post(
        f"/api/v1/onboarding/sessions/{session_id}/cancel", headers=_auth(admin_user)
    )
    assert resp.status_code == 409
