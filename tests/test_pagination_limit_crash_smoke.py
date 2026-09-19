"""
Smoke test for a confirmed runtime crash: six GET list endpoints across
screening.py, aml_program.py, and governance/training.py build their query
with `.offset(page.offset).limit(page.limit)`, but app.api.deps.Pagination
has no `.limit` attribute (only `.page_size`, `.offset`, `.page`, and an
`.apply()` helper that every other paginated endpoint in the codebase uses
correctly). Calling any of these six endpoints raises AttributeError,
turning into a 500 for any real caller -- confirmed uncovered by any
existing test.
"""

from tests.conftest import _auth


def test_list_screening_records_does_not_500(client, admin_user):
    resp = client.get("/api/v1/screening", headers=_auth(admin_user))
    assert resp.status_code == 200


def test_list_screening_alerts_does_not_500(client, admin_user):
    resp = client.get("/api/v1/screening/alerts", headers=_auth(admin_user))
    assert resp.status_code == 200


def test_list_program_versions_does_not_500(client, admin_user):
    resp = client.get("/api/v1/aml-program/versions", headers=_auth(admin_user))
    assert resp.status_code == 200


def test_list_risk_assessments_does_not_500(client, admin_user):
    resp = client.get("/api/v1/aml-program/risk-assessments", headers=_auth(admin_user))
    assert resp.status_code == 200


def test_list_training_assignments_does_not_500(client, admin_user):
    resp = client.get(
        "/api/v1/governance/training/assignments", headers=_auth(admin_user)
    )
    assert resp.status_code == 200


def test_list_training_records_overdue_does_not_500(client, admin_user):
    resp = client.get("/api/v1/governance/training/records", headers=_auth(admin_user))
    assert resp.status_code == 200
