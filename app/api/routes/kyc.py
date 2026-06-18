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
from app.models.kyc import DocumentType, KYCDocument, KYCRecord, KYCStatus
from app.models.user import User, UserRole
from app.services.identity_verification import (
    compute_kyc_identity_score,
    verify_document,
)
from app.services.sanctions_screening import screen_name
from app.services.tenant_scope import assert_tenant

router = APIRouter(prefix="/kyc", tags=["KYC"])

ALLOWED_DOC_MIME = {"image/jpeg", "image/png", "image/webp", "application/pdf"}
MAX_DOC_SIZE = 10 * 1024 * 1024


def _assert_tenant(current_user: User, customer: Customer):
    assert_tenant(current_user, customer.organisation_id, customer.industry_id)


@router.post("/{customer_id}/initiate")
def initiate_kyc(
    customer_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(_current_user),
):
    customer = db.query(Customer).filter(Customer.customer_id == customer_id).first()
    if not customer:
        raise HTTPException(404, "Customer not found")
    _assert_tenant(current_user, customer)
    existing = (
        db.query(KYCRecord)
        .filter(
            KYCRecord.customer_id == customer.id,
            KYCRecord.status.notin_([KYCStatus.rejected]),
        )
        .first()
    )
    if existing:
        raise HTTPException(400, "Active KYC record already exists")
    kyc = KYCRecord(
        kyc_id=f"KYC-{uuid.uuid4().hex[:10].upper()}",
        customer_id=customer.id,
        status=KYCStatus.pending,
    )
    customer.status = CustomerStatus.kyc_in_progress
    db.add(kyc)
    db.commit()
    db.refresh(kyc)
    return {"kyc_id": kyc.kyc_id, "status": kyc.status}


@router.post("/{kyc_id}/documents")
async def upload_document(
    kyc_id: str,
    document_type: DocumentType = Form(...),
    extracted_name: str = Form(None),
    extracted_dob: str = Form(None),
    extracted_id_number: str = Form(None),
    extracted_expiry: str = Form(None),
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    current_user: User = Depends(_current_user),
):
    kyc = db.query(KYCRecord).filter(KYCRecord.kyc_id == kyc_id).first()
    if not kyc:
        raise HTTPException(404, "KYC record not found")

    content = await file.read()
    if len(content) > MAX_DOC_SIZE:
        raise HTTPException(413, "Document exceeds 10 MB limit")
    mime = file.content_type or ""
    if mime not in ALLOWED_DOC_MIME:
        raise HTTPException(415, f"File type not accepted: {mime}")
    safe_name = Path(file.filename or "upload").name[:200]
    if not safe_name or safe_name.startswith("."):
        raise HTTPException(400, "Invalid filename")

    customer = db.query(Customer).filter(Customer.id == kyc.customer_id).first()
    if customer:
        _assert_tenant(current_user, customer)

    doc = KYCDocument(
        kyc_record_id=kyc.id,
        document_type=document_type,
        file_name=safe_name,
        extracted_name=extracted_name,
        extracted_dob=extracted_dob,
        extracted_id_number=extracted_id_number,
        extracted_expiry=extracted_expiry,
    )
    db.add(doc)
    db.flush()
    result = verify_document(customer, doc)
    doc.confidence_score = result["confidence_score"]
    doc.verification_result = result["verification_result"]
    kyc.status = KYCStatus.document_submitted
    db.commit()
    db.refresh(doc)
    return {
        "document_id": doc.id,
        "verification_result": result["verification_result"],
        "confidence_score": result["confidence_score"],
        "issues": result["issues"],
    }


@router.post("/{kyc_id}/review")
def review_kyc(
    kyc_id: str,
    approve: bool,
    notes: str = None,
    rejection_reason: str = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(
        _require_roles(UserRole.admin, UserRole.mlro, UserRole.compliance)
    ),
):
    kyc = db.query(KYCRecord).filter(KYCRecord.kyc_id == kyc_id).first()
    if not kyc:
        raise HTTPException(404, "KYC record not found")
    customer = db.query(Customer).filter(Customer.id == kyc.customer_id).first()
    if customer:
        _assert_tenant(current_user, customer)

    documents = db.query(KYCDocument).filter(KYCDocument.kyc_record_id == kyc.id).all()
    sanctions = screen_name(customer.full_name)
    kyc.sanctions_checked = 1
    kyc.sanctions_match = 1 if sanctions["match_found"] else 0
    kyc.identity_score = compute_kyc_identity_score(documents)
    kyc.reviewer_id = current_user.user_id  # CRITICAL: from session, not request
    kyc.reviewer_notes = notes
    kyc.reviewed_at = datetime.utcnow()

    if sanctions["match_found"]:
        kyc.status = KYCStatus.rejected
        kyc.rejection_reason = "Sanctions match detected"
        customer.status = CustomerStatus.kyc_rejected
    elif approve:
        requires_ecdd = customer.is_pep or customer.risk_score >= 61
        kyc.status = KYCStatus.requires_ecdd if requires_ecdd else KYCStatus.approved
        customer.status = (
            CustomerStatus.kyc_approved
            if not requires_ecdd
            else CustomerStatus.kyc_in_progress
        )
    else:
        kyc.status = KYCStatus.rejected
        kyc.rejection_reason = rejection_reason or "Manual rejection"
        customer.status = CustomerStatus.kyc_rejected

    db.commit()
    return {
        "kyc_id": kyc.kyc_id,
        "status": kyc.status,
        "requires_ecdd": kyc.status == KYCStatus.requires_ecdd,
    }


@router.get("/{customer_id}/history")
def get_kyc_history(
    customer_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(_current_user),
):
    customer = db.query(Customer).filter(Customer.customer_id == customer_id).first()
    if not customer:
        raise HTTPException(404, "Customer not found")
    _assert_tenant(current_user, customer)
    return db.query(KYCRecord).filter(KYCRecord.customer_id == customer.id).all()
