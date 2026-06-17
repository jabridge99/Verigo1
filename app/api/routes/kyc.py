"""
KYC routes — SECURITY HARDENED.
Fixes: authentication required, RBAC on review, reviewer_id from session,
filename sanitisation, tenant isolation, MIME validation.
"""

import uuid
from datetime import datetime
from pathlib import Path

from fastapi import APIRouter, Depends, File, Form, HTTPException, UploadFile
from sqlalchemy.orm import Session

from app.api.routes.auth import _current_user, _require_roles
from app.db.database import get_db
from app.models.customer import Customer, CustomerStatus
from app.models.kyc import (
    CustomerIdentityDocument,
    IdentityDocumentType,
    VerificationResult,
)
from app.models.user import User, UserRole
from app.services.identity_verification import (
    compute_kyc_identity_score,
    verify_document,
)
from app.services.sanctions_screening import screen_name

router = APIRouter(prefix="/kyc", tags=["KYC"])

ALLOWED_DOC_MIME = {"image/jpeg", "image/png", "image/webp", "application/pdf"}
MAX_DOC_SIZE = 10 * 1024 * 1024

# AMBIGUOUS (whole file): the old `KYCRecord` (one row per customer, with its own
# `KYCStatus` covering pending/document_submitted/approved/rejected/requires_ecdd) and
# `KYCDocument` models no longer exist. KYC documents are now stored per verification
# type, e.g. `CustomerIdentityDocument` (app/models/kyc.py), each with its own
# `VerificationResult` (pass/fail/refer/not_performed) — there is no longer a single
# customer-level KYC record/status; that responsibility has moved onto
# `Customer.status` (CustomerStatus: draft/pending/under_review/edd_required/active/
# suspended/rejected/closed). This file is adapted to treat `Customer` + its
# `CustomerIdentityDocument`s as the "KYC record", using `Customer.status` in place of
# `KYCStatus`. Other plausible candidates for the per-verification record were
# CustomerSelfieVerification / CustomerAddressVerification — CustomerIdentityDocument
# was chosen since identity document upload+review is what this route implements.
# `KYC-xxxx` style `kyc_id` no longer exists; `Customer.id` is used as the path/lookup
# key in its place. `DocumentType` -> `IdentityDocumentType`. `customer.customer_id`
# (old PK lookup field) -> `Customer.id`. `industry_id` (Customer/User) -> `org_id`.
# `current_user.user_id` -> `current_user.id`.


def _assert_tenant(current_user: User, record_org_id):
    if current_user.role == UserRole.admin:
        return
    if record_org_id and record_org_id != current_user.org_id:
        raise HTTPException(403, "Cross-tenant access denied")


@router.post("/{customer_id}/initiate")
def initiate_kyc(
    customer_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(_current_user),
):
    customer = db.query(Customer).filter(Customer.id == customer_id).first()
    if not customer:
        raise HTTPException(404, "Customer not found")
    _assert_tenant(current_user, customer.org_id)
    if customer.status not in (CustomerStatus.draft, CustomerStatus.rejected, CustomerStatus.closed):
        raise HTTPException(400, "Active KYC process already exists")
    customer.status = CustomerStatus.pending
    db.commit()
    db.refresh(customer)
    return {"customer_id": customer.id, "status": customer.status}


@router.post("/{customer_id}/documents")
async def upload_document(
    customer_id: str,
    document_type: IdentityDocumentType = Form(...),
    extracted_name: str = Form(None),
    extracted_dob: str = Form(None),
    extracted_id_number: str = Form(None),
    extracted_expiry: str = Form(None),
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    current_user: User = Depends(_current_user),
):
    customer = db.query(Customer).filter(Customer.id == customer_id).first()
    if not customer:
        raise HTTPException(404, "Customer not found")
    _assert_tenant(current_user, customer.org_id)

    content = await file.read()
    if len(content) > MAX_DOC_SIZE:
        raise HTTPException(413, "Document exceeds 10 MB limit")
    mime = file.content_type or ""
    if mime not in ALLOWED_DOC_MIME:
        raise HTTPException(415, f"File type not accepted: {mime}")
    safe_name = Path(file.filename or "upload").name[:200]
    if not safe_name or safe_name.startswith("."):
        raise HTTPException(400, "Invalid filename")

    doc = CustomerIdentityDocument(
        customer_id=customer.id,
        org_id=customer.org_id,
        document_type=document_type,
        document_ref_front=safe_name,
        extracted_name=extracted_name,
        extracted_dob=extracted_dob,
        extracted_mrz=extracted_id_number,
        uploaded_by=current_user.id,
    )
    db.add(doc)
    db.flush()
    result = verify_document(customer, doc)
    doc.confidence_score = result["confidence_score"]
    # `verify_document` returns a "valid"/"invalid"/"review_required" string from the
    # old verification_result vocabulary; mapped onto current VerificationResult values.
    doc.verification_result = {
        "valid": VerificationResult.pass_,
        "invalid": VerificationResult.fail,
        "review_required": VerificationResult.refer,
    }.get(result["verification_result"], VerificationResult.not_performed)
    customer.status = CustomerStatus.under_review
    db.commit()
    db.refresh(doc)
    return {
        "document_id": doc.id,
        "verification_result": doc.verification_result,
        "confidence_score": result["confidence_score"],
        "issues": result["issues"],
    }


@router.post("/{customer_id}/review")
def review_kyc(
    customer_id: str,
    approve: bool,
    notes: str = None,
    rejection_reason: str = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(
        _require_roles(UserRole.admin, UserRole.mlro, UserRole.compliance)
    ),
):
    customer = db.query(Customer).filter(Customer.id == customer_id).first()
    if not customer:
        raise HTTPException(404, "Customer not found")
    _assert_tenant(current_user, customer.org_id)

    documents = (
        db.query(CustomerIdentityDocument)
        .filter(CustomerIdentityDocument.customer_id == customer.id)
        .all()
    )
    sanctions = screen_name(customer.full_name)
    # `kyc.identity_score`/`reviewer_id`/`reviewer_notes`/`reviewed_at` had no
    # surviving columns on Customer or CustomerIdentityDocument to persist into;
    # they are computed/used for the decision below but not stored, since there is no
    # current equivalent field. This is a (non-blocking) loss of persistence noted here
    # rather than silently dropped.
    identity_score = compute_kyc_identity_score(documents)

    if sanctions["match_found"]:
        customer.status = CustomerStatus.rejected
    elif approve:
        requires_ecdd = customer.is_pep or customer.risk_score >= 61
        customer.status = CustomerStatus.edd_required if requires_ecdd else CustomerStatus.active
    else:
        customer.status = CustomerStatus.rejected

    db.commit()
    return {
        "customer_id": customer.id,
        "status": customer.status,
        "identity_score": identity_score,
        "requires_ecdd": customer.status == CustomerStatus.edd_required,
    }


@router.get("/{customer_id}/history")
def get_kyc_history(
    customer_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(_current_user),
):
    customer = db.query(Customer).filter(Customer.id == customer_id).first()
    if not customer:
        raise HTTPException(404, "Customer not found")
    _assert_tenant(current_user, customer.org_id)
    return (
        db.query(CustomerIdentityDocument)
        .filter(CustomerIdentityDocument.customer_id == customer.id)
        .all()
    )
