"""
Regression test for app/services/notification_scheduler.py's
check_independent_review_due(): it queried
IndependentReview.target_completion, a column that never existed on the
model, and there was no field anywhere (model, API create/update schema)
for setting a review's target completion date in the first place.
Confirmed via mypy once the SQLAlchemy plugin was enabled. The function's
own try/except silently caught this on every scheduled run and logged it,
so this notification has never fired -- MLRO/compliance were never
warned an independent review was coming due.

Added IndependentReview.target_completion_date (+ migration
d2e3f4a5b6c7), wired it into ReviewCreate/ReviewUpdate and the review
response dict, and fixed the scheduler check to use the real column name.
"""

from datetime import date, timedelta

from app.models.independent_review import IndependentReview
from app.services.notification_scheduler import check_independent_review_due
from tests.conftest import _auth


def test_create_review_persists_target_completion_date(client, compliance_user):
    resp = client.post(
        "/api/v1/independent-reviews",
        headers=_auth(compliance_user),
        json={
            "review_ref": "IR-2026-001",
            "review_type": "internal",
            "review_scope": "aml_program",
            "title": "FY2026 Annual Independent Review",
            "target_completion_date": str(date.today() + timedelta(days=7)),
        },
    )
    assert resp.status_code == 201, resp.text
    assert resp.json()["target_completion_date"] == str(
        date.today() + timedelta(days=7)
    )


def test_check_independent_review_due_does_not_swallow_a_due_review(db, compliance_user):
    review = IndependentReview(
        org_id=compliance_user.org_id,
        created_by=compliance_user.id,
        review_ref="IR-2026-002",
        review_type="internal",
        review_scope="aml_program",
        title="FY2026 Annual Independent Review",
        target_completion_date=date.today() + timedelta(days=7),
    )
    db.add(review)
    db.commit()

    notified = check_independent_review_due(db)
    assert notified == 1
