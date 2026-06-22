"""
Smoke test: GET /audit/export/csv silently truncated to 10,000 rows with no
indication to the caller, so a compliance officer pulling a regulator-facing
audit export could unknowingly hand over an incomplete file. Fixed by adding
an X-Export-Truncated response header so callers (and the UI) can detect and
warn about truncation.
"""

from app.models.user import UserRole
from tests.conftest import _auth, _make_user


def test_small_export_not_marked_truncated(client, db):
    admin = _make_user(db, UserRole.admin)
    resp = client.get("/api/v1/audit/export/csv", headers=_auth(admin))
    assert resp.status_code == 200
    assert resp.headers["X-Export-Truncated"] == "false"


def test_analyst_cannot_export_csv(client, db):
    analyst = _make_user(db, UserRole.analyst)
    resp = client.get("/api/v1/audit/export/csv", headers=_auth(analyst))
    assert resp.status_code == 403
