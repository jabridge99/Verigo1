"""
Smoke test for a confirmed bug in web/components/Onboarding/DocumentUploadStep.tsx
(the "Step 2 - Document Upload" tab of the staff onboarding dashboard):
it POSTed `category=identity` to POST /documents, but "identity" has
never been a valid DocumentCategory value (app/models/document.py's real
values are kyc/aml/report/case/ecdd/contract/policy/correspondence/
trust_deed/asic_extract/company_document/sof_document/sow_document/
rfi_response/other) -- every document uploaded through that staff UI
step 422'd. Fixed to send "kyc" (the category whose own comment reads
"ID documents, proof of address" -- the exact thing this step uploads).

This test emulates exactly what the fixed frontend now sends, through
the real HTTP endpoint.
"""

import io

from tests.conftest import _auth


def test_document_upload_step_category_is_accepted(client, admin_user):
    resp = client.post(
        "/api/v1/documents",
        headers=_auth(admin_user),
        data={"category": "kyc", "entity_type": "customer", "entity_id": "cust_123"},
        files={"file": ("id.pdf", io.BytesIO(b"%PDF-1.4"), "application/pdf")},
    )
    assert resp.status_code == 201
    assert resp.json()["category"] == "kyc"


def test_old_category_value_would_have_been_rejected(client, admin_user):
    # Documents the bug: confirms "identity" is not (and never was) valid,
    # so a regression back to it would be caught here rather than
    # silently 422ing in production again.
    resp = client.post(
        "/api/v1/documents",
        headers=_auth(admin_user),
        data={
            "category": "identity",
            "entity_type": "customer",
            "entity_id": "cust_123",
        },
        files={"file": ("id.pdf", io.BytesIO(b"%PDF-1.4"), "application/pdf")},
    )
    assert resp.status_code == 422
