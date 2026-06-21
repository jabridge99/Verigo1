"""
Smoke test for Critical #5: app/services/identity_verification.verify_document
referenced CustomerIdentityDocument.extracted_id_number / extracted_expiry
(neither of which exist on the model — it has extracted_mrz / expiry_date
instead) and Customer.id_number (which does not exist on Customer at all),
so every document upload raised AttributeError. Also covers the related bug
where extracted_dob/extracted_expiry form strings were never parsed into
date objects before being stored on Date columns.
"""

import io

from app.models.customer import Customer, CustomerStatus, CustomerType


def _make_customer(db, org_id: str) -> Customer:
    c = Customer(
        org_id=org_id,
        customer_ref="KYC-DOC-SMOKE-1",
        customer_type=CustomerType.individual,
        full_name="Jane Doe",
        status=CustomerStatus.under_review,
        risk_score=10.0,
    )
    db.add(c)
    db.commit()
    db.refresh(c)
    return c


def test_upload_document_does_not_crash_and_scores_correctly(client, db, compliance_headers, compliance_user):
    customer = _make_customer(db, compliance_user.org_id)

    resp = client.post(
        f"/api/v1/kyc/{customer.id}/documents",
        data={
            "document_type": "passport",
            "extracted_name": "Jane Doe",
            "extracted_dob": "1990-01-01",
            "extracted_id_number": "ABC123",
            "extracted_expiry": "2099-01-01",
        },
        files={"file": ("passport.png", io.BytesIO(b"fake-bytes"), "image/png")},
        headers=compliance_headers,
    )
    assert resp.status_code == 200, resp.text
    body = resp.json()
    assert body["verification_result"] == "pass"
    assert body["confidence_score"] == 100.0
    assert body["issues"] == []


def test_upload_document_with_expired_doc_flags_issue(client, db, compliance_headers, compliance_user):
    customer = _make_customer(db, compliance_user.org_id)

    resp = client.post(
        f"/api/v1/kyc/{customer.id}/documents",
        data={
            "document_type": "passport",
            "extracted_expiry": "2000-01-01",
        },
        files={"file": ("passport.png", io.BytesIO(b"fake-bytes"), "image/png")},
        headers=compliance_headers,
    )
    assert resp.status_code == 200, resp.text
    body = resp.json()
    assert "Document is expired" in body["issues"]
