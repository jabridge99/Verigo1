"""
Phase F — document storage routed through the StorageProvider abstraction
(local/S3/Azure/GCS) instead of hardcoded filesystem paths.
"""

from app.models.user import UserRole
from tests.conftest import _make_user, _auth


def _upload(client, headers, content=b"%PDF-1.4 test", filename="test.pdf", mime="application/pdf"):
    return client.post(
        "/api/v1/documents",
        files={"file": (filename, content, mime)},
        data={"category": "other"},
        headers=headers,
    )


def test_upload_download_roundtrip_via_storage_provider(client, db):
    user = _make_user(db, UserRole.analyst, industry_id="IND-DOC-001")
    headers = _auth(user)

    res = _upload(client, headers)
    assert res.status_code == 201, res.text
    doc = res.json()
    assert doc["filename"] == "test.pdf"

    res = client.get(f"/api/v1/documents/{doc['doc_id']}/download", headers=headers)
    assert res.status_code == 200
    assert res.content == b"%PDF-1.4 test"
    assert res.headers["content-disposition"].startswith("attachment;")


def test_delete_removes_underlying_object(client, db):
    admin = _make_user(db, UserRole.admin, industry_id=None)
    headers = _auth(admin)
    user = _make_user(db, UserRole.analyst, industry_id="IND-DOC-002")
    user_headers = _auth(user)

    res = _upload(client, user_headers)
    doc_id = res.json()["doc_id"]

    res = client.delete(f"/api/v1/documents/{doc_id}", headers=headers)
    assert res.status_code == 204

    res = client.get(f"/api/v1/documents/{doc_id}", headers=user_headers)
    assert res.status_code == 404


def test_other_tenant_cannot_download_document(client, db):
    user_a = _make_user(db, UserRole.analyst, industry_id="IND-DOC-003")
    user_b = _make_user(db, UserRole.analyst, industry_id="IND-DOC-004")
    res = _upload(client, _auth(user_a))
    doc_id = res.json()["doc_id"]

    res = client.get(f"/api/v1/documents/{doc_id}/download", headers=_auth(user_b))
    assert res.status_code == 403
