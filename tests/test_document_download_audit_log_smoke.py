"""
Smoke test: GET /documents/{doc_id}/download served KYC/AML evidence with no
audit trail of who accessed it — a compliance gap for documents containing
identity verification material. Fixed by writing a LegacyAuditLog
"document.download" entry on every successful download.
"""

from app.models.audit import LegacyAuditLog
from app.models.user import UserRole
from tests.conftest import _auth, _make_user


def _upload(client, headers, filename="evidence.pdf"):
    return client.post(
        "/api/v1/documents",
        files={"file": (filename, b"%PDF-1.4 test", "application/pdf")},
        data={"category": "other"},
        headers=headers,
    )


def test_download_writes_audit_log_entry(client, db):
    user = _make_user(db, UserRole.analyst, industry_id="IND-DL-AUDIT")
    res = _upload(client, _auth(user))
    assert res.status_code == 201, res.text
    doc_id = res.json()["doc_id"]

    resp = client.get(f"/api/v1/documents/{doc_id}/download", headers=_auth(user))
    assert resp.status_code == 200

    entries = (
        db.query(LegacyAuditLog)
        .filter(
            LegacyAuditLog.action == "document.download",
            LegacyAuditLog.entity_id == doc_id,
        )
        .all()
    )
    assert len(entries) == 1
    assert entries[0].actor == user.id
