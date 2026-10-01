"""
Smoke test for two confirmed bugs in app/api/routes/documents.py's
upload_new_version() (POST /documents/{doc_id}/new-version):

1. It called svc.create_document(..., previous_version_id=..., version=...),
   but app/services/document_service.py's create_document() didn't accept
   either kwarg -- every call raised TypeError: unexpected keyword argument.
2. Separately, the call itself was missing `await` even though
   create_document() is an async function and every other caller in this
   file awaits it -- would have returned a coroutine object instead of a
   Document, which FastAPI's response_model=DocumentResponse validation
   would reject.

Both meant the document-versioning feature has never worked.
"""

import io

from tests.conftest import _auth


def test_upload_new_version_does_not_500(client, admin_user):
    upload = client.post(
        "/api/v1/documents",
        headers=_auth(admin_user),
        files={"file": ("policy.pdf", io.BytesIO(b"%PDF-1.4 v1"), "application/pdf")},
    )
    assert upload.status_code == 201
    doc_id = upload.json()["doc_id"]

    resp = client.post(
        f"/api/v1/documents/{doc_id}/new-version",
        headers=_auth(admin_user),
        files={"file": ("policy.pdf", io.BytesIO(b"%PDF-1.4 v2"), "application/pdf")},
    )
    assert resp.status_code == 201
    assert resp.json()["doc_id"] != doc_id
