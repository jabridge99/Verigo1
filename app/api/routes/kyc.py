"""
KYC routes — SECURITY HARDENED.
Fixes: authentication required, RBAC on review, reviewer_id from session,
filename sanitisation, tenant isolation, MIME validation.
"""

from datetime import datetime, timezone
from pathlib import Path

from fastapi import APIRouter, Depends, File, Form, HTTPException, Request, UploadFile
from sqlalchemy.orm import Session

from app.api.routes.auth import _current_user, _require_roles
from app.config import settings
from app.db.database import get_db
from app.integrations.base import ProviderRejectedError, ProviderUnavailableError
from app.integrations.identity import get_provider
from app.models.customer import Customer, CustomerOnboardingChecklist, CustomerStatus
from app.models.kyc import (
    CustomerIdentityDocument,
    IdentityDocumentType,
    VerificationProvider,
    VerificationResult,
)
from app.models.screening import ScreeningRecord, ScreeningStatus
from app.models.usage import UsageEventType, UsageRecordStatus
from app.models.user import User, UserRole
from app.services.identity_verification import (
    compute_kyc_identity_score,
    verify_document,
)
from app.services.usage_billing_service import (
    find_by_reference,
    mark_completed,
    mark_failed,
    record_usage,
)

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
    if customer.status not in (
        CustomerStatus.draft,
        CustomerStatus.rejected,
        CustomerStatus.closed,
    ):
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
    """
    Reviews and decides a customer's KYC outcome.

    This used to be a standalone activation path that bypassed the checklist/
    screening gates enforced by POST /customers/{id}/status, and used a hardcoded
    3-name sample watchlist instead of real ScreeningRecord data. It now applies
    the same gates: activation requires the onboarding checklist to be complete
    and requires there be no unresolved (potential/confirmed match, or
    requires-EDD) screening record for the customer.
    """
    customer = db.query(Customer).filter(Customer.id == customer_id).first()
    if not customer:
        raise HTTPException(404, "Customer not found")
    _assert_tenant(current_user, customer.org_id)

    documents = (
        db.query(CustomerIdentityDocument)
        .filter(CustomerIdentityDocument.customer_id == customer.id)
        .all()
    )
    # Informational only — does not gate the decision below; final approve/reject
    # is a human compliance decision, but it can never result in `active` unless
    # the checklist + screening gates below are satisfied.
    identity_score = compute_kyc_identity_score(documents)

    unresolved_screening = (
        db.query(ScreeningRecord)
        .filter(
            ScreeningRecord.customer_id == customer.id,
            ScreeningRecord.status.in_(
                (
                    ScreeningStatus.potential_match,
                    ScreeningStatus.confirmed_match,
                    ScreeningStatus.requires_edd,
                )
            ),
        )
        .first()
    )

    chk = (
        db.query(CustomerOnboardingChecklist)
        .filter(CustomerOnboardingChecklist.customer_id == customer.id)
        .first()
    )
    checklist_complete = bool(
        chk
        and chk.pep_screened
        and chk.sanctions_screened
        and chk.identity_document_verified
    )

    if unresolved_screening:
        customer.status = CustomerStatus.rejected
    elif approve:
        if not checklist_complete:
            raise HTTPException(
                422,
                "Cannot activate: PEP screening, sanctions screening, and "
                "identity verification must be complete",
            )
        requires_ecdd = customer.is_pep or customer.risk_score >= 61
        customer.status = (
            CustomerStatus.edd_required if requires_ecdd else CustomerStatus.active
        )
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


# ── Hosted verification (Sumsub) ─────────────────────────────────────────────
# Set IDENTITY_PROVIDER=sumsub to enable. The customer completes document
# upload + liveness directly in Sumsub's hosted widget using this token — we
# never see the raw document images. Results land via the /webhooks/sumsub
# callback below and are billed as metered usage at that point.


@router.post("/{customer_id}/sumsub/token")
async def create_sumsub_token(
    customer_id: str,
    kyb: bool = False,
    db: Session = Depends(get_db),
    current_user: User = Depends(_current_user),
):
    customer = db.query(Customer).filter(Customer.id == customer_id).first()
    if not customer:
        raise HTTPException(404, "Customer not found")
    _assert_tenant(current_user, customer.org_id)

    try:
        provider = get_provider()
    except (NotImplementedError, ProviderUnavailableError) as exc:
        raise HTTPException(503, str(exc))

    level_name = settings.sumsub_kyb_level_name if kyb else settings.sumsub_level_name
    try:
        token = await provider.generate_access_token(customer.id, level_name)
    except ProviderUnavailableError as exc:
        raise HTTPException(503, str(exc))
    except ProviderRejectedError as exc:
        raise HTTPException(502, str(exc))

    record_usage(
        db,
        org_id=customer.org_id,
        event_type=UsageEventType.business_verification
        if kyb
        else UsageEventType.identity_verification,
        provider=provider.name,
        customer_id=customer.id,
        provider_reference=customer.id,  # joined back to the webhook via externalUserId
        status=UsageRecordStatus.pending,
    )
    return {
        "token": token.token,
        "applicant_id": token.applicant_id,
        "expires_in_seconds": token.expires_in_seconds,
    }


@router.post("/webhooks/sumsub", include_in_schema=False)
async def sumsub_webhook(request: Request, db: Session = Depends(get_db)):
    """Unauthenticated — verified by HMAC signature on the raw body instead."""
    try:
        provider = get_provider()
    except (NotImplementedError, ProviderUnavailableError) as exc:
        raise HTTPException(503, str(exc))

    body = await request.body()
    signature = request.headers.get("x-payload-digest", "")
    if not provider.verify_webhook_signature(body, signature):
        raise HTTPException(401, "Invalid webhook signature")

    payload = await request.json()
    result = provider.parse_webhook_event(payload)

    usage = find_by_reference(db, provider.name, result.external_user_id or "")
    if usage and usage.status == UsageRecordStatus.pending:
        if result.review_result in ("pass", "fail"):
            mark_completed(db, usage)
        elif payload.get("type") == "applicantReset":
            mark_failed(db, usage)

    customer = (
        db.query(Customer).filter(Customer.id == result.external_user_id).first()
        if result.external_user_id
        else None
    )
    if customer and result.review_result:
        doc = CustomerIdentityDocument(
            customer_id=customer.id,
            org_id=customer.org_id,
            document_type=IdentityDocumentType.other,
            verification_result=(
                VerificationResult.pass_
                if result.review_result == "pass"
                else VerificationResult.fail
            ),
            verification_provider=VerificationProvider.sumsub,
            provider_reference=result.applicant_id,
            provider_raw_response=str(result.raw),
            verified_by="sumsub",
            verified_at=datetime.now(timezone.utc),
        )
        db.add(doc)
        if result.review_result == "pass" and customer.status == CustomerStatus.pending:
            customer.status = CustomerStatus.under_review
        db.commit()

    return {"status": "ok"}
