"""
Customer & KYC/KYB API — bank-grade onboarding for individuals and businesses.

Architecture:
  - Single Customer master record (individual / sole_trader / company / trust / partnership)
  - Separate child tables for each verification type (identity doc, selfie, address, phone, email)
  - Unified ScreeningRecord table; pluggable provider via screening_type + provider fields
  - Onboarding checklist tracks completion of each CDD step
  - Immutable risk score history; risk fields never user-settable

AUSTRAC requirements:
  - CDD Level (standard / simplified / enhanced) set by engine or compliance
  - Mandatory PEP/sanctions screening before status → active
  - EDD approval gate (senior_managing_official sign-off)
  - Ongoing monitoring: next_review_date enforced by review records
"""

import logging
from datetime import date, datetime, timezone
from typing import List, Optional
from uuid import uuid4

from fastapi import APIRouter, Depends, File, HTTPException, Query, UploadFile
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app.api.deps import (
    Pagination,
    get_current_user,
    org_id_for,
    require_analyst_or_above,
    require_compliance_or_above,
    require_mlro_or_above,
)
from app.db.database import get_db
from app.models.audit_log import AuditEventType, AuditLog
from app.models.case import Case
from app.models.customer import (
    BeneficialOwner,
    BusinessDetail,
    CDDLevel,
    CorporateDocument,
    Customer,
    CustomerNote,
    CustomerOnboardingChecklist,
    CustomerPreviousName,
    CustomerReview,
    CustomerRiskScoreHistory,
    CustomerStatus,
    RiskLevel,
)
from app.models.document import Document
from app.models.kyc import (
    CustomerAddressVerification,
    CustomerEmailVerification,
    CustomerIdentityDocument,
    CustomerPhoneVerification,
    CustomerSelfieVerification,
    VerificationResult,
)
from app.models.marketplace import VerificationOrder
from app.models.risk_matrix import (
    CustomerQuestionResponse,
    OrgApprovalQuestion,
    OrgMonitoringConfig,
    QuestionAnswer,
    QuestionContext,
)
from app.models.screening import (
    CryptoWalletScreening,
    ScreeningAlert,
    ScreeningRecord,
    ScreeningStatus,
    ScreeningType,
)
from app.models.transaction import Transaction
from app.models.user import User
from app.schemas.customer import (
    AddressVerificationCreate,
    AddressVerificationResponse,
    AlertResponse,
    AlertUpdateRequest,
    BeneficialOwnerCreate,
    BeneficialOwnerResponse,
    BeneficialOwnerUpdate,
    BusinessDetailCreate,
    BusinessDetailResponse,
    CorporateDocumentCreate,
    CorporateDocumentResponse,
    CustomerCreate,
    CustomerNoteCreate,
    CustomerNoteResponse,
    CustomerResponse,
    CustomerReviewCreate,
    CustomerReviewResponse,
    CustomerStatusUpdate,
    CustomerUpdate,
    EmailVerificationCreate,
    EmailVerificationResponse,
    IdentityDocumentCreate,
    IdentityDocumentResponse,
    IdentityDocumentVerifyUpdate,
    OnboardingChecklistResponse,
    PhoneVerificationCreate,
    PhoneVerificationResponse,
    PreviousNameCreate,
    PreviousNameResponse,
    RiskScoreHistoryResponse,
    ScreeningRecordResponse,
    ScreeningReviewUpdate,
    ScreeningTriggerRequest,
    SelfieVerificationCreate,
    SelfieVerificationResponse,
    WalletScreeningCreate,
    WalletScreeningResponse,
)
from app.services import audit_service
from app.services.risk_engine import inherent_risk, residual_risk
from app.services.risk_matrix_service import (
    compute_final_approval_score,
    compute_question_score,
)

log = logging.getLogger("verigo.api.customers")
router = APIRouter(prefix="/customers", tags=["Customers"])

DISCLAIMER = (
    "All CDD/EDD assessments, risk ratings, and compliance decisions "
    "remain the responsibility of the reporting entity."
)

# Maps a screening type to the checklist flag it satisfies once the result is clear.
_SCREENING_CHECKLIST_FLAG = {
    ScreeningType.pep: "pep_screened",
    ScreeningType.sanctions: "sanctions_screened",
    ScreeningType.adverse_media: "adverse_media_screened",
    ScreeningType.ubo_pep: "ubo_screened",
    ScreeningType.ubo_sanctions: "ubo_screened",
}

# ScreeningRecord statuses that represent an unresolved hit — must block activation.
_SCREENING_BLOCKING_STATUSES = {
    ScreeningStatus.potential_match,
    ScreeningStatus.confirmed_match,
    ScreeningStatus.requires_edd,
}


# ── Helpers ───────────────────────────────────────────────────────────────────


def _get_customer(customer_id: str, org_id: str, db: Session) -> Customer:
    c = (
        db.query(Customer)
        .filter(
            Customer.id == customer_id,
            Customer.org_id == org_id,
        )
        .first()
    )
    if not c:
        raise HTTPException(404, "Customer not found")
    return c


def _next_customer_ref(org_id: str, db: Session) -> str:
    year = date.today().year
    count = db.query(Customer).filter(Customer.org_id == org_id).count()
    return f"KYC-{year}-{str(count + 1).zfill(5)}"


def _create_checklist(customer: Customer, db: Session) -> CustomerOnboardingChecklist:
    chk = CustomerOnboardingChecklist(
        customer_id=customer.id,
        org_id=customer.org_id,
    )
    db.add(chk)
    return chk


def _update_checklist_flag(
    customer: Customer, flag: str, value: bool, db: Session
) -> None:
    chk = (
        db.query(CustomerOnboardingChecklist)
        .filter(CustomerOnboardingChecklist.customer_id == customer.id)
        .first()
    )
    if chk:
        setattr(chk, flag, value)
        _check_checklist_complete(chk, customer, db)


def _check_checklist_complete(
    chk: CustomerOnboardingChecklist, customer: Customer, db: Session
) -> None:
    required = ["identity_document_verified", "pep_screened", "sanctions_screened"]
    if customer.customer_type.value in (
        "company",
        "trust",
        "partnership",
        "association",
    ):
        required += ["ubo_identified", "ubo_screened"]
    is_complete = all(getattr(chk, f) for f in required)
    if is_complete and not chk.is_complete:
        chk.is_complete = True
        chk.completed_at = datetime.now(timezone.utc)
    elif not is_complete and chk.is_complete:
        # A previously-clear flag (e.g. screening) was reset — re-block activation.
        chk.is_complete = False
        chk.completed_at = None


def _record_risk_history(
    customer: Customer,
    trigger: str,
    actor_id: str,
    db: Session,
    notes: Optional[str] = None,
    scoring_factors: Optional[dict] = None,
    likelihood: Optional[int] = None,
    consequence: Optional[int] = None,
    control_effectiveness: Optional[int] = None,
) -> None:
    inherent_score = residual_score = None
    if likelihood and consequence:
        inherent_score = inherent_risk(likelihood, consequence)
        if control_effectiveness:
            residual_score = residual_risk(inherent_score, control_effectiveness)

    db.add(
        CustomerRiskScoreHistory(
            customer_id=customer.id,
            org_id=customer.org_id,
            risk_score=customer.risk_score,
            risk_level=customer.risk_level,
            cdd_level=customer.cdd_level,
            scoring_factors=scoring_factors,
            inherent_score=inherent_score,
            residual_score=residual_score,
            control_effectiveness_score=control_effectiveness,
            trigger=trigger,
            triggered_by=actor_id,
            notes=notes,
        )
    )


def _customer_checklist_summary(customer_id: str, org_id: str, db: Session) -> dict:
    questions = (
        db.query(OrgApprovalQuestion)
        .filter(
            OrgApprovalQuestion.org_id == org_id,
            OrgApprovalQuestion.is_active == True,
            OrgApprovalQuestion.context == QuestionContext.customer,
        )
        .all()
    )
    responses = (
        db.query(CustomerQuestionResponse)
        .filter(CustomerQuestionResponse.customer_id == customer_id)
        .all()
    )
    response_map = {r.question_id: r for r in responses}
    answered_required = [
        q for q in questions if q.is_required and response_map.get(q.id) is not None
    ]
    required = [q for q in questions if q.is_required]
    return {
        "questions_configured": len(questions),
        "questions_answered": len(responses),
        "complete": len(questions) > 0 and len(answered_required) == len(required),
        "question_score": compute_question_score(responses) if responses else None,
    }


# ── Customer CRUD ─────────────────────────────────────────────────────────────


@router.post("", response_model=CustomerResponse, status_code=201)
def create_customer(
    payload: CustomerCreate,
    current_user: User = Depends(require_analyst_or_above),
    db: Session = Depends(get_db),
):
    oid = org_id_for(current_user)

    customer = Customer(
        org_id=oid,
        customer_ref=_next_customer_ref(oid, db),
        customer_type=payload.customer_type,
        full_name=payload.full_name,
        date_of_birth=payload.date_of_birth,
        country_of_birth=payload.country_of_birth,
        nationality=payload.nationality,
        dual_nationality=payload.dual_nationality,
        country_of_residence=payload.country_of_residence,
        occupation=payload.occupation,
        employer_name=payload.employer_name,
        employer_address=payload.employer_address,
        tax_residency_country=payload.tax_residency_country,
        tax_identification_number=payload.tax_identification_number,
        fatca_applicable=payload.fatca_applicable,
        crs_applicable=payload.crs_applicable,
        email=str(payload.email) if payload.email else None,
        phone=payload.phone,
        address_line1=payload.address_line1,
        address_line2=payload.address_line2,
        city=payload.city,
        state=payload.state,
        postcode=payload.postcode,
        country=payload.country,
        mail_same_as_residential=payload.mail_same_as_residential,
        mail_address_line1=payload.mail_address_line1,
        mail_city=payload.mail_city,
        mail_state=payload.mail_state,
        mail_postcode=payload.mail_postcode,
        source_of_funds=payload.source_of_funds,
        source_of_wealth=payload.source_of_wealth,
        onboarding_channel=payload.onboarding_channel,
        introduced_by=payload.introduced_by,
        relationship_manager=payload.relationship_manager,
        is_reporting_group_member=payload.is_reporting_group_member,
        onboarded_by=current_user.id,
        status=CustomerStatus.draft,
        cdd_level=CDDLevel.standard,
        risk_level=RiskLevel.low,
        risk_score=0.0,
    )
    db.add(customer)
    db.flush()
    _create_checklist(customer, db)
    _record_risk_history(customer, "onboarding", current_user.id, db)

    db.add(
        AuditLog(
            org_id=oid,
            actor_id=current_user.id,
            event_type=AuditEventType.customer_created,
            action="customer.create",
            object_type="Customer",
            object_id=customer.id,
            new_value={
                "customer_ref": customer.customer_ref,
                "type": payload.customer_type.value,
            },
        )
    )
    db.commit()
    db.refresh(customer)

    from app.models.automation_rule import RuleEventType
    from app.services.automation_engine import (
        customer_context,
        evaluate_automation_rules,
    )

    evaluate_automation_rules(
        db,
        RuleEventType.customer_created,
        oid,
        "customer",
        customer.id,
        customer_context(customer),
        triggered_by=current_user.id,
    )

    log.info("Customer created: %s org=%s", customer.customer_ref, oid)
    return customer


@router.get("", response_model=List[CustomerResponse])
def list_customers(
    status: Optional[CustomerStatus] = Query(None),
    search: Optional[str] = Query(
        None,
        description="Match against name or customer reference — bypasses the default draft/edd_required exclusion so pickers (e.g. ECDD) can find any applicant",
    ),
    risk_level: Optional[RiskLevel] = Query(None),
    customer_type: Optional[str] = Query(None),
    cdd_level: Optional[CDDLevel] = Query(None),
    is_pep: Optional[bool] = Query(None),
    due_for_review: bool = Query(False, description="next_review_date within 30 days"),
    pagination: Pagination = Depends(),
    current_user: User = Depends(require_analyst_or_above),
    db: Session = Depends(get_db),
):
    oid = org_id_for(current_user)
    q = db.query(Customer).filter(Customer.org_id == oid)
    if status:
        q = q.filter(Customer.status == status)
    elif not search:
        # Customers list = applicants who have passed KYC. Draft (not yet
        # screened) and edd_required (under enhanced review) stay out of the
        # default view until a reviewer clears them; pass an explicit
        # ?status= to see them.
        q = q.filter(
            Customer.status.notin_([CustomerStatus.draft, CustomerStatus.edd_required])
        )
    if search:
        like = f"%{search.strip()}%"
        q = q.filter(
            (Customer.full_name.ilike(like)) | (Customer.customer_ref.ilike(like))
        )
    if risk_level:
        q = q.filter(Customer.risk_level == risk_level)
    if customer_type:
        q = q.filter(Customer.customer_type == customer_type)
    if cdd_level:
        q = q.filter(Customer.cdd_level == cdd_level)
    if is_pep is not None:
        q = q.filter(Customer.is_pep == is_pep)
    if due_for_review:
        from datetime import timedelta

        cutoff = date.today() + timedelta(days=30)
        q = q.filter(
            Customer.next_review_date <= cutoff,
            Customer.status == CustomerStatus.active,
        )
    return pagination.apply(q.order_by(Customer.created_at.desc())).all()


@router.get("/{customer_id}", response_model=CustomerResponse)
def get_customer(
    customer_id: str,
    current_user: User = Depends(require_analyst_or_above),
    db: Session = Depends(get_db),
):
    return _get_customer(customer_id, org_id_for(current_user), db)


@router.patch("/{customer_id}", response_model=CustomerResponse)
def update_customer(
    customer_id: str,
    payload: CustomerUpdate,
    current_user: User = Depends(require_analyst_or_above),
    db: Session = Depends(get_db),
):
    customer = _get_customer(customer_id, org_id_for(current_user), db)

    if customer.status in (CustomerStatus.rejected, CustomerStatus.closed):
        raise HTTPException(422, f"Cannot edit a {customer.status.value} customer")

    for field, value in payload.model_dump(exclude_none=True).items():
        setattr(customer, field, value)

    db.add(
        AuditLog(
            org_id=customer.org_id,
            actor_id=current_user.id,
            event_type=AuditEventType.customer_updated,
            action="customer.update",
            object_type="Customer",
            object_id=customer.id,
            new_value={"fields": list(payload.model_dump(exclude_none=True).keys())},
        )
    )
    db.commit()
    db.refresh(customer)
    return customer


@router.post("/{customer_id}/status", response_model=CustomerResponse)
def update_customer_status(
    customer_id: str,
    payload: CustomerStatusUpdate,
    current_user: User = Depends(require_compliance_or_above),
    db: Session = Depends(get_db),
):
    customer = _get_customer(customer_id, org_id_for(current_user), db)

    # Enforce screening gate before activating. Fails closed: a missing checklist
    # row is treated as incomplete, not as "nothing to check" (a prior bug here let
    # activation through unconditionally if no checklist row existed for the
    # customer).
    if payload.status == CustomerStatus.active:
        chk = (
            db.query(CustomerOnboardingChecklist)
            .filter(CustomerOnboardingChecklist.customer_id == customer_id)
            .first()
        )
        if not chk or not (
            chk.pep_screened
            and chk.sanctions_screened
            and chk.identity_document_verified
        ):
            raise HTTPException(
                422,
                "Cannot activate: PEP screening, sanctions screening, and identity verification must be complete",
            )

        # Defense in depth: block activation if any screening record is sitting in
        # an unresolved hit state, independent of the checklist flags above.
        unresolved = (
            db.query(ScreeningRecord)
            .filter(
                ScreeningRecord.customer_id == customer_id,
                ScreeningRecord.status.in_(_SCREENING_BLOCKING_STATUSES),
            )
            .first()
        )
        if unresolved:
            raise HTTPException(
                422,
                "Cannot activate: customer has an unresolved screening match",
            )

    # EDD gate: enhanced CDD requires senior approval. Same fail-closed rule.
    if (
        customer.cdd_level == CDDLevel.enhanced
        and payload.status == CustomerStatus.active
    ):
        chk = (
            db.query(CustomerOnboardingChecklist)
            .filter(CustomerOnboardingChecklist.customer_id == customer_id)
            .first()
        )
        if not chk or not chk.edd_senior_approval_obtained:
            raise HTTPException(
                422, "EDD customers require senior approval before activation"
            )

    old_status = customer.status
    customer.status = payload.status

    db.add(
        AuditLog(
            org_id=customer.org_id,
            actor_id=current_user.id,
            event_type=AuditEventType.customer_status_changed,
            action="customer.status_change",
            object_type="Customer",
            object_id=customer.id,
            old_value={"status": old_status.value},
            new_value={"status": payload.status.value, "reason": payload.reason},
        )
    )
    db.commit()
    db.refresh(customer)
    return customer


# ── Previous Names ─────────────────────────────────────────────────────────────


@router.post(
    "/{customer_id}/previous-names",
    response_model=PreviousNameResponse,
    status_code=201,
)
def add_previous_name(
    customer_id: str,
    payload: PreviousNameCreate,
    current_user: User = Depends(require_analyst_or_above),
    db: Session = Depends(get_db),
):
    customer = _get_customer(customer_id, org_id_for(current_user), db)
    record = CustomerPreviousName(
        customer_id=customer.id,
        org_id=customer.org_id,
        full_name=payload.full_name,
        name_type=payload.name_type,
        used_from=payload.used_from,
        used_to=payload.used_to,
        reason=payload.reason,
        created_by=current_user.id,
    )
    db.add(record)
    db.commit()
    db.refresh(record)
    return record


@router.get("/{customer_id}/previous-names", response_model=List[PreviousNameResponse])
def list_previous_names(
    customer_id: str,
    current_user: User = Depends(require_analyst_or_above),
    db: Session = Depends(get_db),
):
    _get_customer(customer_id, org_id_for(current_user), db)
    return (
        db.query(CustomerPreviousName)
        .filter(CustomerPreviousName.customer_id == customer_id)
        .order_by(CustomerPreviousName.created_at.desc())
        .all()
    )


# ── Business Detail (KYB) ──────────────────────────────────────────────────────


@router.post(
    "/{customer_id}/business-detail",
    response_model=BusinessDetailResponse,
    status_code=201,
)
def create_business_detail(
    customer_id: str,
    payload: BusinessDetailCreate,
    current_user: User = Depends(require_analyst_or_above),
    db: Session = Depends(get_db),
):
    customer = _get_customer(customer_id, org_id_for(current_user), db)
    if customer.business_detail_id:
        raise HTTPException(409, "Business detail already exists — use PATCH")

    detail = BusinessDetail(
        org_id=customer.org_id,
        customer_id=customer.id,
        **payload.model_dump(exclude_none=True),
    )
    db.add(detail)
    db.flush()
    customer.business_detail_id = detail.id
    db.commit()
    db.refresh(detail)
    return detail


@router.get("/{customer_id}/business-detail", response_model=BusinessDetailResponse)
def get_business_detail(
    customer_id: str,
    current_user: User = Depends(require_analyst_or_above),
    db: Session = Depends(get_db),
):
    customer = _get_customer(customer_id, org_id_for(current_user), db)
    if not customer.business_detail_id:
        raise HTTPException(404, "No business detail on record")
    return customer.business_detail


# ── Beneficial Owners ──────────────────────────────────────────────────────────


@router.post(
    "/{customer_id}/beneficial-owners",
    response_model=BeneficialOwnerResponse,
    status_code=201,
)
def add_beneficial_owner(
    customer_id: str,
    payload: BeneficialOwnerCreate,
    current_user: User = Depends(require_analyst_or_above),
    db: Session = Depends(get_db),
):
    customer = _get_customer(customer_id, org_id_for(current_user), db)
    ubo = BeneficialOwner(
        customer_id=customer.id,
        org_id=customer.org_id,
        created_by=current_user.id,
        **payload.model_dump(exclude_none=True),
    )
    db.add(ubo)
    _update_checklist_flag(customer, "ubo_identified", True, db)
    db.commit()
    db.refresh(ubo)
    return ubo


@router.get(
    "/{customer_id}/beneficial-owners", response_model=List[BeneficialOwnerResponse]
)
def list_beneficial_owners(
    customer_id: str,
    current_user: User = Depends(require_analyst_or_above),
    db: Session = Depends(get_db),
):
    _get_customer(customer_id, org_id_for(current_user), db)
    return (
        db.query(BeneficialOwner)
        .filter(BeneficialOwner.customer_id == customer_id)
        .order_by(BeneficialOwner.created_at)
        .all()
    )


@router.patch(
    "/{customer_id}/beneficial-owners/{ubo_id}", response_model=BeneficialOwnerResponse
)
def update_beneficial_owner(
    customer_id: str,
    ubo_id: str,
    payload: BeneficialOwnerUpdate,
    current_user: User = Depends(require_analyst_or_above),
    db: Session = Depends(get_db),
):
    _get_customer(customer_id, org_id_for(current_user), db)
    ubo = (
        db.query(BeneficialOwner)
        .filter(
            BeneficialOwner.id == ubo_id, BeneficialOwner.customer_id == customer_id
        )
        .first()
    )
    if not ubo:
        raise HTTPException(404, "Beneficial owner not found")
    for field, value in payload.model_dump(exclude_none=True).items():
        setattr(ubo, field, value)
    if payload.verified:
        ubo.verified_by = current_user.id
        ubo.verified_at = datetime.now(timezone.utc)
        customer = _get_customer(customer_id, org_id_for(current_user), db)
        _update_checklist_flag(customer, "ubo_verified", True, db)
    db.commit()
    db.refresh(ubo)
    return ubo


# ── Corporate Documents ────────────────────────────────────────────────────────


@router.post(
    "/{customer_id}/corporate-documents",
    response_model=CorporateDocumentResponse,
    status_code=201,
)
def add_corporate_document(
    customer_id: str,
    payload: CorporateDocumentCreate,
    current_user: User = Depends(require_analyst_or_above),
    db: Session = Depends(get_db),
):
    customer = _get_customer(customer_id, org_id_for(current_user), db)
    doc = CorporateDocument(
        customer_id=customer.id,
        org_id=customer.org_id,
        uploaded_by=current_user.id,
        **payload.model_dump(exclude_none=True),
    )
    db.add(doc)
    db.commit()
    db.refresh(doc)
    return doc


@router.get(
    "/{customer_id}/corporate-documents", response_model=List[CorporateDocumentResponse]
)
def list_corporate_documents(
    customer_id: str,
    current_user: User = Depends(require_analyst_or_above),
    db: Session = Depends(get_db),
):
    _get_customer(customer_id, org_id_for(current_user), db)
    return (
        db.query(CorporateDocument)
        .filter(CorporateDocument.customer_id == customer_id)
        .order_by(CorporateDocument.created_at.desc())
        .all()
    )


# ── Identity Documents ─────────────────────────────────────────────────────────


@router.post(
    "/{customer_id}/identity-documents",
    response_model=IdentityDocumentResponse,
    status_code=201,
)
def add_identity_document(
    customer_id: str,
    payload: IdentityDocumentCreate,
    current_user: User = Depends(require_analyst_or_above),
    db: Session = Depends(get_db),
):
    customer = _get_customer(customer_id, org_id_for(current_user), db)
    doc = CustomerIdentityDocument(
        customer_id=customer.id,
        org_id=customer.org_id,
        uploaded_by=current_user.id,
        **payload.model_dump(exclude_none=True),
    )
    db.add(doc)
    db.commit()
    db.refresh(doc)
    return doc


@router.patch(
    "/{customer_id}/identity-documents/{doc_id}/verify",
    response_model=IdentityDocumentResponse,
)
def verify_identity_document(
    customer_id: str,
    doc_id: str,
    payload: IdentityDocumentVerifyUpdate,
    current_user: User = Depends(require_analyst_or_above),
    db: Session = Depends(get_db),
):
    customer = _get_customer(customer_id, org_id_for(current_user), db)
    doc = (
        db.query(CustomerIdentityDocument)
        .filter(
            CustomerIdentityDocument.id == doc_id,
            CustomerIdentityDocument.customer_id == customer_id,
        )
        .first()
    )
    if not doc:
        raise HTTPException(404, "Identity document not found")

    for field, value in payload.model_dump(exclude_none=True).items():
        setattr(doc, field, value)
    doc.verified_by = current_user.id
    doc.verified_at = datetime.now(timezone.utc)

    if payload.verification_result == VerificationResult.pass_:
        _update_checklist_flag(customer, "identity_document_verified", True, db)

    db.commit()
    db.refresh(doc)
    return doc


@router.get(
    "/{customer_id}/identity-documents", response_model=List[IdentityDocumentResponse]
)
def list_identity_documents(
    customer_id: str,
    current_user: User = Depends(require_analyst_or_above),
    db: Session = Depends(get_db),
):
    _get_customer(customer_id, org_id_for(current_user), db)
    return (
        db.query(CustomerIdentityDocument)
        .filter(CustomerIdentityDocument.customer_id == customer_id)
        .order_by(CustomerIdentityDocument.created_at.desc())
        .all()
    )


# ── Selfie Verification ────────────────────────────────────────────────────────


@router.post(
    "/{customer_id}/selfie-verification",
    response_model=SelfieVerificationResponse,
    status_code=201,
)
def add_selfie_verification(
    customer_id: str,
    payload: SelfieVerificationCreate,
    current_user: User = Depends(require_analyst_or_above),
    db: Session = Depends(get_db),
):
    customer = _get_customer(customer_id, org_id_for(current_user), db)
    overall = (
        VerificationResult.pass_
        if (
            payload.liveness_result == VerificationResult.pass_
            and payload.face_match_result == VerificationResult.pass_
        )
        else VerificationResult.refer
    )

    rec = CustomerSelfieVerification(
        customer_id=customer.id,
        org_id=customer.org_id,
        verification_result=overall,
        verified_at=datetime.now(timezone.utc),
        **payload.model_dump(exclude_none=True),
    )
    db.add(rec)
    if overall == VerificationResult.pass_:
        _update_checklist_flag(customer, "selfie_verified", True, db)
    db.commit()
    db.refresh(rec)
    return rec


@router.get(
    "/{customer_id}/selfie-verifications",
    response_model=List[SelfieVerificationResponse],
)
def list_selfie_verifications(
    customer_id: str,
    current_user: User = Depends(require_analyst_or_above),
    db: Session = Depends(get_db),
):
    _get_customer(customer_id, org_id_for(current_user), db)
    return (
        db.query(CustomerSelfieVerification)
        .filter(CustomerSelfieVerification.customer_id == customer_id)
        .order_by(CustomerSelfieVerification.created_at.desc())
        .all()
    )


# ── Address Verification ───────────────────────────────────────────────────────


@router.post(
    "/{customer_id}/address-verification",
    response_model=AddressVerificationResponse,
    status_code=201,
)
def add_address_verification(
    customer_id: str,
    payload: AddressVerificationCreate,
    current_user: User = Depends(require_analyst_or_above),
    db: Session = Depends(get_db),
):
    customer = _get_customer(customer_id, org_id_for(current_user), db)
    rec = CustomerAddressVerification(
        customer_id=customer.id,
        org_id=customer.org_id,
        uploaded_by=current_user.id,
        **payload.model_dump(exclude_none=True),
    )
    db.add(rec)
    db.commit()
    db.refresh(rec)
    return rec


# ── Phone Verification ─────────────────────────────────────────────────────────


@router.post(
    "/{customer_id}/phone-verification",
    response_model=PhoneVerificationResponse,
    status_code=201,
)
def create_phone_verification(
    customer_id: str,
    payload: PhoneVerificationCreate,
    current_user: User = Depends(require_analyst_or_above),
    db: Session = Depends(get_db),
):
    customer = _get_customer(customer_id, org_id_for(current_user), db)
    rec = CustomerPhoneVerification(
        customer_id=customer.id,
        org_id=customer.org_id,
        phone_number=payload.phone_number,
        otp_sent=True,
        otp_sent_at=datetime.now(timezone.utc),
    )
    db.add(rec)
    db.commit()
    db.refresh(rec)
    return rec


@router.post(
    "/{customer_id}/phone-verification/{verification_id}/confirm",
    response_model=PhoneVerificationResponse,
)
def confirm_phone_otp(
    customer_id: str,
    verification_id: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Mark OTP as verified (OTP logic handled by frontend/SMS provider)."""
    customer = _get_customer(customer_id, org_id_for(current_user), db)
    rec = (
        db.query(CustomerPhoneVerification)
        .filter(
            CustomerPhoneVerification.id == verification_id,
            CustomerPhoneVerification.customer_id == customer_id,
        )
        .first()
    )
    if not rec:
        raise HTTPException(404, "Phone verification record not found")
    rec.otp_verified = True
    rec.otp_verified_at = datetime.now(timezone.utc)
    rec.verification_result = VerificationResult.pass_
    rec.verified_at = datetime.now(timezone.utc)
    _update_checklist_flag(customer, "phone_verified", True, db)
    db.commit()
    db.refresh(rec)
    return rec


# ── Email Verification ─────────────────────────────────────────────────────────


@router.post(
    "/{customer_id}/email-verification",
    response_model=EmailVerificationResponse,
    status_code=201,
)
def create_email_verification(
    customer_id: str,
    payload: EmailVerificationCreate,
    current_user: User = Depends(require_analyst_or_above),
    db: Session = Depends(get_db),
):
    customer = _get_customer(customer_id, org_id_for(current_user), db)
    from app.models.kyc import CustomerEmailVerification as EV

    rec = EV(
        customer_id=customer.id,
        org_id=customer.org_id,
        email_address=str(payload.email_address),
        domain=str(payload.email_address).split("@")[-1],
        token_sent=True,
        token_sent_at=datetime.now(timezone.utc),
    )
    db.add(rec)
    db.commit()
    db.refresh(rec)
    return rec


@router.post(
    "/{customer_id}/email-verification/{verification_id}/confirm",
    response_model=EmailVerificationResponse,
)
def confirm_email_token(
    customer_id: str,
    verification_id: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    customer = _get_customer(customer_id, org_id_for(current_user), db)
    rec = (
        db.query(CustomerEmailVerification)
        .filter(
            CustomerEmailVerification.id == verification_id,
            CustomerEmailVerification.customer_id == customer_id,
        )
        .first()
    )
    if not rec:
        raise HTTPException(404, "Email verification record not found")
    rec.token_verified = True
    rec.token_verified_at = datetime.now(timezone.utc)
    rec.verification_result = VerificationResult.pass_
    rec.verified_at = datetime.now(timezone.utc)
    _update_checklist_flag(customer, "email_verified", True, db)
    db.commit()
    db.refresh(rec)
    return rec


# ── Screening ──────────────────────────────────────────────────────────────────


@router.post(
    "/{customer_id}/screen",
    response_model=List[ScreeningRecordResponse],
    status_code=201,
)
def trigger_screening(
    customer_id: str,
    payload: ScreeningTriggerRequest,
    current_user: User = Depends(require_analyst_or_above),
    db: Session = Depends(get_db),
):
    """
    Trigger one or more screening types against a customer or UBO.
    Results are stored immediately as 'pending'; background job updates them.
    """
    customer = _get_customer(customer_id, org_id_for(current_user), db)
    entity_id = payload.entity_id or customer.id
    entity_name = customer.full_name

    results = []
    for stype in payload.screening_types:
        rec = ScreeningRecord(
            org_id=customer.org_id,
            customer_id=customer.id,
            screening_type=stype,
            entity_type=payload.entity_type or "customer",
            entity_id=entity_id,
            entity_name=entity_name,
            provider=payload.provider,
            status=ScreeningStatus.pending,
            triggered_by=current_user.id,
        )
        db.add(rec)
        results.append(rec)

    db.flush()

    # NOTE: checklist "screened" flags are intentionally NOT set here. Triggering
    # a screening only means a check was *requested* (status=pending) — it is not
    # evidence the customer is clear. Flags are only flipped to True once a result
    # comes back clear, in review_screening_result below. Setting them here let
    # customers pass the activation gate in update_customer_status while their
    # sanctions/PEP screening was still pending or had come back a confirmed match.

    db.add(
        AuditLog(
            org_id=customer.org_id,
            actor_id=current_user.id,
            event_type=AuditEventType.screening_completed,
            action="customer.screening.triggered",
            object_type="Customer",
            object_id=customer.id,
            new_value={
                "types": [t.value for t in payload.screening_types],
                "provider": payload.provider.value,
            },
        )
    )
    db.commit()
    for r in results:
        db.refresh(r)
    return results


@router.get("/{customer_id}/screening", response_model=List[ScreeningRecordResponse])
def list_screening_records(
    customer_id: str,
    screening_type: Optional[ScreeningType] = Query(None),
    current_user: User = Depends(require_analyst_or_above),
    db: Session = Depends(get_db),
):
    _get_customer(customer_id, org_id_for(current_user), db)
    q = db.query(ScreeningRecord).filter(ScreeningRecord.customer_id == customer_id)
    if screening_type:
        q = q.filter(ScreeningRecord.screening_type == screening_type)
    return q.order_by(ScreeningRecord.screened_at.desc()).all()


@router.patch(
    "/{customer_id}/screening/{record_id}/review",
    response_model=ScreeningRecordResponse,
)
def review_screening_result(
    customer_id: str,
    record_id: str,
    payload: ScreeningReviewUpdate,
    current_user: User = Depends(require_compliance_or_above),
    db: Session = Depends(get_db),
):
    _get_customer(customer_id, org_id_for(current_user), db)
    rec = (
        db.query(ScreeningRecord)
        .filter(
            ScreeningRecord.id == record_id,
            ScreeningRecord.customer_id == customer_id,
        )
        .first()
    )
    if not rec:
        raise HTTPException(404, "Screening record not found")
    rec.status = payload.status
    rec.reviewer_notes = payload.reviewer_notes
    rec.is_false_positive = payload.is_false_positive
    rec.reviewed_by = current_user.id
    rec.reviewed_at = datetime.now(timezone.utc)

    flag = _SCREENING_CHECKLIST_FLAG.get(rec.screening_type)
    if flag:
        customer = db.query(Customer).filter(Customer.id == customer_id).first()
        is_clear = payload.status in (
            ScreeningStatus.clear,
            ScreeningStatus.false_positive,
        )
        # Flips the flag back True on a cleared/false-positive result, and back to
        # False (re-blocking activation) if a result that was previously clear is
        # later reclassified as a match.
        _update_checklist_flag(customer, flag, is_clear, db)

    db.commit()
    db.refresh(rec)
    return rec


# ── Crypto Wallet Screening ────────────────────────────────────────────────────


@router.post(
    "/{customer_id}/wallet-screening",
    response_model=WalletScreeningResponse,
    status_code=201,
)
def screen_crypto_wallet(
    customer_id: str,
    payload: WalletScreeningCreate,
    current_user: User = Depends(require_analyst_or_above),
    db: Session = Depends(get_db),
):
    customer = _get_customer(customer_id, org_id_for(current_user), db)
    rec = CryptoWalletScreening(
        org_id=customer.org_id,
        customer_id=customer.id,
        wallet_address=payload.wallet_address,
        network=payload.network,
        wallet_label=payload.wallet_label,
        provider=payload.provider,
        status=ScreeningStatus.pending,
        triggered_by=current_user.id,
    )
    db.add(rec)
    db.commit()
    db.refresh(rec)
    return rec


@router.get(
    "/{customer_id}/wallet-screenings", response_model=List[WalletScreeningResponse]
)
def list_wallet_screenings(
    customer_id: str,
    current_user: User = Depends(require_analyst_or_above),
    db: Session = Depends(get_db),
):
    _get_customer(customer_id, org_id_for(current_user), db)
    return (
        db.query(CryptoWalletScreening)
        .filter(CryptoWalletScreening.customer_id == customer_id)
        .order_by(CryptoWalletScreening.screened_at.desc())
        .all()
    )


# ── Screening Alerts ───────────────────────────────────────────────────────────


@router.get("/{customer_id}/alerts", response_model=List[AlertResponse])
def list_customer_alerts(
    customer_id: str,
    current_user: User = Depends(require_analyst_or_above),
    db: Session = Depends(get_db),
):
    _get_customer(customer_id, org_id_for(current_user), db)
    return (
        db.query(ScreeningAlert)
        .filter(ScreeningAlert.customer_id == customer_id)
        .order_by(ScreeningAlert.created_at.desc())
        .all()
    )


@router.patch("/{customer_id}/alerts/{alert_id}", response_model=AlertResponse)
def resolve_alert(
    customer_id: str,
    alert_id: str,
    payload: AlertUpdateRequest,
    current_user: User = Depends(require_compliance_or_above),
    db: Session = Depends(get_db),
):
    _get_customer(customer_id, org_id_for(current_user), db)
    alert = (
        db.query(ScreeningAlert)
        .filter(
            ScreeningAlert.id == alert_id,
            ScreeningAlert.customer_id == customer_id,
        )
        .first()
    )
    if not alert:
        raise HTTPException(404, "Alert not found")
    alert.status = payload.status
    alert.resolution_notes = payload.resolution_notes
    alert.resolved_by = current_user.id
    alert.resolved_at = datetime.now(timezone.utc)
    if payload.escalated_to:
        alert.escalated_to = payload.escalated_to
        alert.escalated_at = datetime.now(timezone.utc)
    db.commit()
    db.refresh(alert)
    return alert


# ── Onboarding Checklist ───────────────────────────────────────────────────────


@router.get(
    "/{customer_id}/onboarding-checklist", response_model=OnboardingChecklistResponse
)
def get_onboarding_checklist(
    customer_id: str,
    current_user: User = Depends(require_analyst_or_above),
    db: Session = Depends(get_db),
):
    _get_customer(customer_id, org_id_for(current_user), db)
    chk = (
        db.query(CustomerOnboardingChecklist)
        .filter(CustomerOnboardingChecklist.customer_id == customer_id)
        .first()
    )
    if not chk:
        raise HTTPException(404, "Onboarding checklist not found")
    return chk


# ── Risk Score History ─────────────────────────────────────────────────────────


@router.get(
    "/{customer_id}/risk-history", response_model=List[RiskScoreHistoryResponse]
)
def get_risk_score_history(
    customer_id: str,
    current_user: User = Depends(require_analyst_or_above),
    db: Session = Depends(get_db),
):
    _get_customer(customer_id, org_id_for(current_user), db)
    return (
        db.query(CustomerRiskScoreHistory)
        .filter(CustomerRiskScoreHistory.customer_id == customer_id)
        .order_by(CustomerRiskScoreHistory.scored_at.desc())
        .all()
    )


@router.post("/{customer_id}/rescore")
def rescore_customer(
    customer_id: str,
    likelihood: Optional[int] = Query(
        None, ge=1, le=5, description="Optional: record inherent/residual breakdown"
    ),
    consequence: Optional[int] = Query(None, ge=1, le=5),
    control_effectiveness: Optional[int] = Query(None, ge=1, le=5),
    current_user: User = Depends(require_compliance_or_above),
    db: Session = Depends(get_db),
):
    """Re-run risk scoring. Risk fields are set by engine only."""
    customer = _get_customer(customer_id, org_id_for(current_user), db)
    before = {"risk_score": customer.risk_score, "risk_level": customer.risk_level}

    # Basic built-in scoring logic (replace with full engine call when ready)
    score = 0.0
    factors = {}

    if customer.is_pep:
        score += 40.0
        factors["pep"] = 40.0
    if customer.is_sanctions_match:
        score = 100.0
        factors["sanctions"] = 100.0
    if customer.nationality in ("IR", "KP", "RU", "BY", "SY", "CU"):
        score += 20.0
        factors["high_risk_country"] = 20.0
    if customer.cdd_level == CDDLevel.enhanced:
        score += 10.0
        factors["edd_flag"] = 10.0

    score = min(score, 100.0)

    def _level_for(s: float) -> RiskLevel:
        if s >= 75:
            return RiskLevel.critical
        elif s >= 50:
            return RiskLevel.high
        elif s >= 25:
            return RiskLevel.medium
        return RiskLevel.low

    base_level = _level_for(score)

    # Checklist completion may nudge the score down by a small, capped amount
    # (never enough to flip an above-low rating to Low on its own — that
    # decision stays with the compliance reviewer, not the checklist).
    responses = (
        db.query(CustomerQuestionResponse)
        .filter(CustomerQuestionResponse.customer_id == customer_id)
        .all()
    )
    question_score = compute_question_score(responses) if responses else None
    score = score
    if question_score is not None:
        config = (
            db.query(OrgMonitoringConfig)
            .filter(OrgMonitoringConfig.org_id == customer.org_id)
            .first()
        )
        q_weight = getattr(config, "custom_question_weight", 0.20) if config else 0.20
        q_weight = max(0.0, min(q_weight, 0.40))
        max_reduction = 10.0  # hard cap regardless of weight
        reduction = min(
            max_reduction, (question_score / 100.0) * max_reduction * q_weight / 0.40
        )
        score = max(0.0, score - reduction)

    level = _level_for(score)
    if base_level != RiskLevel.low and level == RiskLevel.low:
        # Checklist alone must never produce a Low Risk outcome.
        level = RiskLevel.medium

    customer.risk_score = score
    customer.risk_level = level

    _record_risk_history(
        customer,
        "manual_rescore",
        current_user.id,
        db,
        scoring_factors=factors,
        likelihood=likelihood,
        consequence=consequence,
        control_effectiveness=control_effectiveness,
    )
    audit_service.log_action(
        db,
        action="risk_matrix_changed",
        entity_type="customer",
        entity_id=customer.id,
        actor=current_user.email,
        actor_role=current_user.role.value if current_user.role else None,
        organisation_id=customer.org_id,
        before_state={
            "risk_score": before["risk_score"],
            "risk_level": before["risk_level"].value if before["risk_level"] else None,
        },
        after_state={"risk_score": score, "risk_level": level.value},
    )
    db.commit()

    return {"customer_id": customer_id, "risk_score": score, "risk_level": level.value}


# ── Pre-Approval Question Checklist (customer onboarding/EDD context) ──────────


class CustomerQuestionAnswerItem(BaseModel):
    question_id: str
    answer: QuestionAnswer
    notes: Optional[str] = None


class CustomerAnswerQuestionsRequest(BaseModel):
    answers: List[CustomerQuestionAnswerItem]


@router.get("/{customer_id}/approval-checklist")
def get_customer_approval_checklist(
    customer_id: str,
    current_user: User = Depends(require_compliance_or_above),
    db: Session = Depends(get_db),
):
    """
    Return the org's customer/onboarding pre-approval checklist questions and
    any existing answers for this customer, plus the computed question score.

    Mirrors the transaction checklist at /transactions/{id}/approval-checklist,
    scoped to context=customer questions (see app.models.risk_matrix.QuestionContext).

    DISCLAIMER: Checklist results support the compliance workflow only.
    All regulatory decisions remain with the reporting entity.
    """
    org_id = org_id_for(current_user)
    customer = _get_customer(customer_id, org_id, db)

    questions = (
        db.query(OrgApprovalQuestion)
        .filter(
            OrgApprovalQuestion.org_id == org_id,
            OrgApprovalQuestion.is_active == True,
            OrgApprovalQuestion.context == QuestionContext.customer,
        )
        .order_by(OrgApprovalQuestion.question_order)
        .all()
    )

    responses = (
        db.query(CustomerQuestionResponse)
        .filter(
            CustomerQuestionResponse.customer_id == customer_id,
            CustomerQuestionResponse.org_id == org_id,
        )
        .all()
    )
    response_map = {r.question_id: r for r in responses}

    question_score = compute_question_score(responses) if responses else None

    items = []
    for q in questions:
        r = response_map.get(q.id)
        items.append(
            {
                "question_id": q.id,
                "question_order": q.question_order,
                "question_text": q.question_text,
                "help_text": q.help_text,
                "industry_context": q.industry_context,
                "is_required": q.is_required,
                "compliant_answer": q.compliant_answer.value
                if q.compliant_answer
                else "yes",
                "answer": r.answer.value if r else None,
                "notes": r.notes if r else None,
                "answered_by": r.answered_by if r else None,
                "answered_at": r.answered_at if r else None,
            }
        )

    return {
        "customer_id": customer_id,
        "questions_configured": len(questions),
        "questions_answered": len([i for i in items if i["answer"] is not None]),
        "checklist_complete": len(questions) > 0
        and all(i["answer"] is not None for i in items if i["is_required"]),
        "question_score": question_score,
        "questions": items,
        "disclaimer": (
            "Checklist results support the compliance workflow only. "
            "All regulatory decisions remain with the reporting entity."
        ),
    }


@router.post("/{customer_id}/answer-questions", status_code=200)
def answer_customer_approval_questions(
    customer_id: str,
    payload: CustomerAnswerQuestionsRequest,
    current_user: User = Depends(require_compliance_or_above),
    db: Session = Depends(get_db),
):
    """
    Submit or update answers to the customer pre-approval checklist questions.

    Each answer is upserted (existing answer updated if already submitted).
    Answers feed into a question_score; call POST /{customer_id}/rescore to
    apply the bounded, capped checklist adjustment to the customer's risk
    score (the checklist can never, by itself, produce a Low Risk outcome).

    DISCLAIMER: Answers are compliance workflow records only.
    """
    org_id = org_id_for(current_user)
    customer = _get_customer(customer_id, org_id, db)

    question_ids = [a.question_id for a in payload.answers]
    valid_questions = (
        db.query(OrgApprovalQuestion)
        .filter(
            OrgApprovalQuestion.id.in_(question_ids),
            OrgApprovalQuestion.org_id == org_id,
            OrgApprovalQuestion.is_active == True,
            OrgApprovalQuestion.context == QuestionContext.customer,
        )
        .all()
    )
    valid_ids = {q.id for q in valid_questions}
    invalid = [qid for qid in question_ids if qid not in valid_ids]
    if invalid:
        raise HTTPException(
            400, f"Unknown or inactive customer question IDs: {invalid}"
        )

    now = datetime.now(timezone.utc)
    saved = []
    for item in payload.answers:
        existing = (
            db.query(CustomerQuestionResponse)
            .filter(
                CustomerQuestionResponse.customer_id == customer_id,
                CustomerQuestionResponse.question_id == item.question_id,
            )
            .first()
        )
        if existing:
            existing.answer = item.answer
            existing.notes = item.notes
            existing.answered_by = current_user.id
            existing.answered_at = now
            saved.append(existing)
        else:
            r = CustomerQuestionResponse(
                id=f"cqr_{uuid4().hex[:10]}",
                customer_id=customer_id,
                question_id=item.question_id,
                org_id=org_id,
                answer=item.answer,
                notes=item.notes,
                answered_by=current_user.id,
                answered_at=now,
            )
            db.add(r)
            saved.append(r)

    db.flush()

    all_responses = (
        db.query(CustomerQuestionResponse)
        .filter(
            CustomerQuestionResponse.customer_id == customer_id,
            CustomerQuestionResponse.org_id == org_id,
        )
        .all()
    )
    question_score = compute_question_score(all_responses)

    db.commit()

    return {
        "customer_id": customer_id,
        "answers_submitted": len(saved),
        "question_score": question_score,
        "disclaimer": (
            "Answers are compliance workflow records only. "
            "All regulatory decisions remain with the reporting entity."
        ),
    }


# ── Periodic Reviews ───────────────────────────────────────────────────────────


@router.post(
    "/{customer_id}/reviews", response_model=CustomerReviewResponse, status_code=201
)
def create_review(
    customer_id: str,
    payload: CustomerReviewCreate,
    current_user: User = Depends(require_compliance_or_above),
    db: Session = Depends(get_db),
):
    customer = _get_customer(customer_id, org_id_for(current_user), db)
    review = CustomerReview(
        customer_id=customer.id,
        org_id=customer.org_id,
        reviewed_by=current_user.id,
        **payload.model_dump(exclude_none=True),
    )
    db.add(review)
    if payload.next_review_date:
        customer.next_review_date = payload.next_review_date
        customer.last_reviewed_date = payload.review_date
        customer.last_reviewed_by = current_user.id
    if payload.cdd_level_after:
        customer.cdd_level = payload.cdd_level_after
    if payload.risk_score_after is not None:
        customer.risk_score = payload.risk_score_after
    if payload.risk_score_after is not None or payload.cdd_level_after:
        _record_risk_history(
            customer,
            "periodic_review",
            current_user.id,
            db,
            notes=payload.outcome_notes,
        )
    db.commit()
    db.refresh(review)
    return review


@router.get("/{customer_id}/reviews", response_model=List[CustomerReviewResponse])
def list_reviews(
    customer_id: str,
    current_user: User = Depends(require_compliance_or_above),
    db: Session = Depends(get_db),
):
    _get_customer(customer_id, org_id_for(current_user), db)
    return (
        db.query(CustomerReview)
        .filter(CustomerReview.customer_id == customer_id)
        .order_by(CustomerReview.review_date.desc())
        .all()
    )


# ── Compliance Notes ───────────────────────────────────────────────────────────


@router.post(
    "/{customer_id}/notes", response_model=CustomerNoteResponse, status_code=201
)
def add_note(
    customer_id: str,
    payload: CustomerNoteCreate,
    current_user: User = Depends(require_analyst_or_above),
    db: Session = Depends(get_db),
):
    customer = _get_customer(customer_id, org_id_for(current_user), db)
    note = CustomerNote(
        customer_id=customer.id,
        org_id=customer.org_id,
        note_type=payload.note_type,
        content=payload.content,
        is_confidential=payload.is_confidential,
        created_by=current_user.id,
    )
    db.add(note)
    db.commit()
    db.refresh(note)
    return note


@router.get("/{customer_id}/notes", response_model=List[CustomerNoteResponse])
def list_notes(
    customer_id: str,
    current_user: User = Depends(require_analyst_or_above),
    db: Session = Depends(get_db),
):
    customer = _get_customer(customer_id, org_id_for(current_user), db)
    q = db.query(CustomerNote).filter(CustomerNote.customer_id == customer_id)
    # Non-MLRO users cannot see confidential notes
    if current_user.role.value not in ("admin", "mlro"):
        q = q.filter(CustomerNote.is_confidential == False)
    return q.order_by(CustomerNote.created_at.desc()).all()


# ── Customer Workspace (aggregated, read-only) ─────────────────────────────────
# A single call that assembles everything an officer needs for one customer —
# avoids forcing the UI to fan out across a dozen endpoints to render one screen.
# All data here already exists via the per-resource endpoints above; this is a
# read-only join, not a new source of truth.


@router.get("/{customer_id}/workspace")
def get_customer_workspace(
    customer_id: str,
    current_user: User = Depends(require_analyst_or_above),
    db: Session = Depends(get_db),
):
    customer = _get_customer(customer_id, org_id_for(current_user), db)
    can_see_confidential = current_user.role.value in ("admin", "mlro")

    business_detail = customer.business_detail if customer.business_detail_id else None

    beneficial_owners = (
        db.query(BeneficialOwner)
        .filter(BeneficialOwner.customer_id == customer_id)
        .order_by(BeneficialOwner.created_at)
        .all()
    )

    documents = (
        db.query(Document)
        .filter(Document.entity_type == "customer", Document.entity_id == customer_id)
        .order_by(Document.created_at.desc())
        .all()
    )
    corporate_documents = (
        db.query(CorporateDocument)
        .filter(CorporateDocument.customer_id == customer_id)
        .order_by(CorporateDocument.created_at.desc())
        .all()
    )

    screenings = (
        db.query(ScreeningRecord)
        .filter(ScreeningRecord.customer_id == customer_id)
        .order_by(ScreeningRecord.screened_at.desc())
        .all()
    )
    latest_screening_by_type = {}
    for s in screenings:
        if s.screening_type not in latest_screening_by_type:
            latest_screening_by_type[s.screening_type.value] = s
    open_alerts = (
        db.query(ScreeningAlert)
        .filter(
            ScreeningAlert.customer_id == customer_id,
            ScreeningAlert.status.notin_(["dismissed", "closed"]),
        )
        .order_by(ScreeningAlert.created_at.desc())
        .all()
    )

    checklist = (
        db.query(CustomerOnboardingChecklist)
        .filter(CustomerOnboardingChecklist.customer_id == customer_id)
        .first()
    )

    risk_history = (
        db.query(CustomerRiskScoreHistory)
        .filter(CustomerRiskScoreHistory.customer_id == customer_id)
        .order_by(CustomerRiskScoreHistory.scored_at.desc())
        .limit(10)
        .all()
    )

    reviews = (
        db.query(CustomerReview)
        .filter(CustomerReview.customer_id == customer_id)
        .order_by(CustomerReview.review_date.desc())
        .all()
    )

    notes_q = db.query(CustomerNote).filter(CustomerNote.customer_id == customer_id)
    if not can_see_confidential:
        notes_q = notes_q.filter(CustomerNote.is_confidential == False)
    notes = notes_q.order_by(CustomerNote.created_at.desc()).all()

    cases = (
        db.query(Case)
        .filter(Case.customer_id == customer_id)
        .order_by(Case.created_at.desc())
        .all()
    )

    transactions = (
        db.query(Transaction)
        .filter(Transaction.customer_id == customer_id)
        .order_by(Transaction.created_at.desc())
        .limit(25)
        .all()
    )
    txn_count = (
        db.query(Transaction).filter(Transaction.customer_id == customer_id).count()
    )
    txn_volume = sum(t.amount_aud or t.amount or 0.0 for t in transactions)

    return {
        "customer": customer,
        "business_detail": business_detail,
        "beneficial_owners": beneficial_owners,
        "documents": documents,
        "corporate_documents": corporate_documents,
        "screening": {
            "records": screenings,
            "latest_by_type": {
                k: {
                    "status": v.status.value,
                    "screened_at": v.screened_at,
                    "provider": v.provider.value if v.provider else None,
                }
                for k, v in latest_screening_by_type.items()
            },
            "open_alerts": open_alerts,
        },
        "onboarding_checklist": checklist,
        "risk": {
            "risk_score": customer.risk_score,
            "risk_level": customer.risk_level.value if customer.risk_level else None,
            "inherent_score": risk_history[0].inherent_score if risk_history else None,
            "residual_score": risk_history[0].residual_score if risk_history else None,
            "control_effectiveness_score": (
                risk_history[0].control_effectiveness_score if risk_history else None
            ),
            "trend": [
                {
                    "scored_at": h.scored_at,
                    "risk_score": h.risk_score,
                    "risk_level": h.risk_level.value if h.risk_level else None,
                }
                for h in reversed(risk_history)
            ],
            "history": risk_history,
        },
        "verification": {
            "orders": [
                {
                    "id": o.id,
                    "provider_id": o.provider_id,
                    "status": o.status.value,
                    "evidence_url": o.evidence_url,
                    "reviewed_by": o.reviewed_by,
                    "created_at": o.created_at,
                    "completed_at": o.completed_at,
                }
                for o in db.query(VerificationOrder)
                .filter(
                    VerificationOrder.entity_type == "customer",
                    VerificationOrder.entity_id == customer_id,
                )
                .order_by(VerificationOrder.created_at.desc())
                .all()
            ],
        },
        "checklist_completion": _customer_checklist_summary(
            customer_id, customer.org_id, db
        ),
        "sof_sow": {
            "source_of_funds": customer.source_of_funds,
            "source_of_funds_verified": customer.source_of_funds_verified,
            "source_of_wealth": customer.source_of_wealth,
            "source_of_wealth_verified": customer.source_of_wealth_verified,
        },
        "cdd": {
            "cdd_level": customer.cdd_level.value if customer.cdd_level else None,
            "last_reviewed_date": customer.last_reviewed_date,
            "last_reviewed_by": customer.last_reviewed_by,
            "next_review_date": customer.next_review_date,
        },
        "reviews": reviews,
        "notes": notes,
        "cases": {
            "open": [
                c
                for c in cases
                if c.status.value
                not in ("closed_no_action", "closed_smr_filed", "closed_no_smr")
            ],
            "closed": [
                c
                for c in cases
                if c.status.value
                in ("closed_no_action", "closed_smr_filed", "closed_no_smr")
            ],
            "escalated": [c for c in cases if c.escalated_to],
            "smr_linked": [c for c in cases if c.smr_lodged or c.is_smr_candidate],
        },
        "transactions": {
            "recent": transactions,
            "total_count": txn_count,
            "recent_volume_aud": txn_volume,
        },
        "assigned_officer": customer.relationship_manager,
        "disclaimer": DISCLAIMER,
    }


# ── Customer Timeline (synthesized, read-only) ─────────────────────────────────
# Chronological feed assembled from existing audit/case/transaction/review/
# screening records — there is no separate "timeline" table to keep in sync.


@router.get("/{customer_id}/timeline")
def get_customer_timeline(
    customer_id: str,
    limit: int = Query(200, le=500),
    current_user: User = Depends(require_analyst_or_above),
    db: Session = Depends(get_db),
):
    customer = _get_customer(customer_id, org_id_for(current_user), db)
    events: List[dict] = []

    events.append(
        {
            "type": "customer_created",
            "label": "Customer created",
            "at": customer.created_at,
            "actor": customer.onboarded_by,
        }
    )

    audit_rows = (
        db.query(AuditLog)
        .filter(
            AuditLog.org_id == customer.org_id,
            AuditLog.object_type == "Customer",
            AuditLog.object_id == customer_id,
        )
        .order_by(AuditLog.created_at.desc())
        .limit(limit)
        .all()
    )
    for a in audit_rows:
        events.append(
            {
                "type": a.event_type.value,
                "label": a.action,
                "at": a.created_at,
                "actor": a.actor_id,
                "detail": a.new_value,
            }
        )

    for r in db.query(CustomerReview).filter(CustomerReview.customer_id == customer_id):
        events.append(
            {
                "type": "review",
                "label": f"{r.review_type or 'Periodic'} review completed",
                "at": r.review_date,
                "actor": r.reviewed_by,
            }
        )

    for c in db.query(Case).filter(Case.customer_id == customer_id):
        events.append(
            {
                "type": "case",
                "label": f"Case {c.case_ref} ({c.case_type.value}) — {c.status.value}",
                "at": c.created_at,
                "actor": c.created_by,
            }
        )

    for s in (
        db.query(ScreeningRecord)
        .filter(ScreeningRecord.customer_id == customer_id)
        .order_by(ScreeningRecord.screened_at.desc())
        .limit(50)
    ):
        events.append(
            {
                "type": "screening",
                "label": f"{s.screening_type.value} screening — {s.status.value}",
                "at": s.screened_at,
                "actor": s.triggered_by,
            }
        )

    txn_count = (
        db.query(Transaction).filter(Transaction.customer_id == customer_id).count()
    )
    for t in (
        db.query(Transaction)
        .filter(Transaction.customer_id == customer_id)
        .order_by(Transaction.created_at.desc())
        .limit(50)
    ):
        events.append(
            {
                "type": "transaction",
                "label": f"Transaction {t.direction.value} {t.amount} — risk {t.risk_score}",
                "at": t.created_at,
            }
        )

    events = [e for e in events if e["at"] is not None]
    events.sort(key=lambda e: e["at"], reverse=True)
    return {
        "customer_id": customer_id,
        "total_events": len(events),
        "transaction_count": txn_count,
        "events": events[:limit],
    }


# ── MLRO Unified Override ───────────────────────────────────────────────────────
# A single, audited entry point for the manual overrides an MLRO needs to make.
# Writes to existing Customer fields only — every change is reasoned and logged
# to the canonical AuditLog, never silent.


class CustomerOverrideRequest(BaseModel):
    reason: str
    risk_score: Optional[float] = None
    risk_level: Optional[RiskLevel] = None
    cdd_level: Optional[CDDLevel] = None
    status: Optional[CustomerStatus] = None
    relationship_manager: Optional[str] = None
    next_review_date: Optional[date] = None
    # Free-form classification/monitoring overrides without dedicated columns —
    # stored in the existing custom_fields JSON rather than adding new schema.
    classification: Optional[str] = None
    monitoring_level: Optional[str] = None


@router.post("/{customer_id}/override", response_model=CustomerResponse)
def override_customer(
    customer_id: str,
    payload: CustomerOverrideRequest,
    current_user: User = Depends(require_mlro_or_above),
    db: Session = Depends(get_db),
):
    customer = _get_customer(customer_id, org_id_for(current_user), db)

    changes = payload.model_dump(
        exclude={"reason", "classification", "monitoring_level"}, exclude_none=True
    )
    custom_field_changes = payload.model_dump(
        include={"classification", "monitoring_level"}, exclude_none=True
    )
    if not changes and not custom_field_changes:
        raise HTTPException(422, "No fields supplied to override")

    before = {f: getattr(customer, f) for f in changes}
    risk_changed = "risk_score" in changes or "risk_level" in changes
    cdd_changed = "cdd_level" in changes

    for field, value in changes.items():
        setattr(customer, field, value)

    if custom_field_changes:
        before_custom = dict(customer.custom_fields or {})
        customer.custom_fields = {**before_custom, **custom_field_changes}
        before["custom_fields"] = before_custom

    if risk_changed or cdd_changed:
        _record_risk_history(
            customer, "mlro_override", current_user.id, db, notes=payload.reason
        )

    def _serialise(v):
        return (
            v.value
            if hasattr(v, "value")
            else (v.isoformat() if hasattr(v, "isoformat") else v)
        )

    db.add(
        AuditLog(
            org_id=customer.org_id,
            actor_id=current_user.id,
            event_type=AuditEventType.customer_updated,
            action="customer.mlro_override",
            object_type="Customer",
            object_id=customer.id,
            old_value={k: _serialise(v) for k, v in before.items()},
            new_value={
                **{k: _serialise(v) for k, v in changes.items()},
                **custom_field_changes,
                "reason": payload.reason,
            },
        )
    )
    db.commit()
    db.refresh(customer)
    return customer


# ── Bulk Import ───────────────────────────────────────────────────────────────


@router.get("/import/template")
def download_import_template(
    current_user: User = Depends(require_analyst_or_above),
):
    """
    Download the customer bulk import CSV template.

    The template contains:
      - Row 1: Column headers (canonical field names)
      - Row 2: Field descriptions (prefixed with # — skipped on import)
      - Row 3: Individual customer example
      - Row 4: Business customer example

    All # prefixed rows are ignored during import.
    Column headers are alias-tolerant — common variations accepted.

    After filling in the template, upload via:
      POST /api/v1/customers/import/upload

    DISCLAIMER: Imported customers are created in DRAFT status.
    CDD must be completed before the customer can be activated.
    """
    from fastapi.responses import Response

    from app.services.bulk_import import generate_csv_template

    content = generate_csv_template()
    return Response(
        content=content,
        media_type="text/csv",
        headers={
            "Content-Disposition": 'attachment; filename="verigo_customer_import_template.csv"'
        },
    )


@router.get("/import/field-guide")
def import_field_guide(
    current_user: User = Depends(require_analyst_or_above),
):
    """
    Returns the full field guide for the customer import template.
    Includes accepted aliases, examples, and field descriptions.
    """
    from app.services.bulk_import import get_template_field_guide

    return {
        "total_fields": len(get_template_field_guide()),
        "fields": get_template_field_guide(),
        "notes": [
            "Rows prefixed with # in any column are treated as comments and skipped",
            "customer_type defaults to 'individual' if blank",
            "country and country_of_residence default to 'AU' if blank",
            "All imported customers are created in DRAFT status — CDD must be completed",
            "Duplicate emails within the same organisation are skipped with a warning",
            "Column headers are alias-tolerant — see 'accepted_aliases' for each field",
        ],
    }


@router.post("/import/upload")
async def bulk_import_customers(
    file: UploadFile = File(
        ..., description="CSV or Excel (.xlsx) customer import file"
    ),
    current_user: User = Depends(require_compliance_or_above),
    db: Session = Depends(get_db),
):
    """
    Bulk import customers from a CSV or Excel (.xlsx) file.

    Accepted formats:
      - text/csv — UTF-8 or Latin-1 encoded
      - application/vnd.openxmlformats-officedocument.spreadsheetml.sheet (.xlsx)
      - application/octet-stream (auto-detected by extension)

    Processing:
      1. Parse file → validate each row
      2. Skip rows with validation errors (reported in 'errors')
      3. Skip duplicate emails within this organisation (reported in 'skipped')
      4. Create Customer records in DRAFT status
      5. Return import summary with created IDs

    All created customers:
      - Status: draft (CDD not yet completed)
      - Requires CDD/KYC completion before activation
      - Triggers no automatic screening (screening must be initiated manually)

    DISCLAIMER: Bulk import creates customer records only.
    CDD, KYC verification, and sanctions screening must be completed
    before onboarding is finalised. All compliance decisions remain
    with the reporting entity.
    """
    from app.models.customer import CustomerType, OnboardingChannel, RiskLevel
    from app.services.bulk_import import parse_csv, parse_excel

    if file is None:
        raise HTTPException(
            422,
            "No file uploaded. Provide a CSV or Excel file as multipart form-data field 'file'.",
        )

    filename = file.filename or ""
    content = await file.read()

    if not content:
        raise HTTPException(422, "Uploaded file is empty")

    # Parse by file type
    ext = filename.lower().rsplit(".", 1)[-1] if "." in filename else ""
    content_type = file.content_type or ""

    if ext in ("xlsx", "xls") or "spreadsheet" in content_type:
        try:
            rows, warnings, errors = parse_excel(content)
        except ImportError:
            raise HTTPException(
                500, "Excel support requires openpyxl — contact your administrator"
            )
    elif ext == "csv" or "csv" in content_type or "text" in content_type:
        rows, warnings, errors = parse_csv(content)
    else:
        # Try CSV as fallback
        rows, warnings, errors = parse_csv(content)

    if not rows and errors:
        return {
            "status": "failed",
            "message": "No valid rows found in file",
            "errors": errors,
            "warnings": warnings,
            "created": 0,
            "skipped": 0,
        }

    org_id = org_id_for(current_user)
    created = []
    skipped = []

    for i, row in enumerate(rows):
        full_name = row.get("full_name", "").strip()
        email = row.get("email", "").strip().lower() or None

        if not full_name:
            errors.append(f"Row {i + 2}: full_name is required")
            continue

        # Duplicate email check within org
        if email:
            existing = db.query(Customer).filter_by(org_id=org_id, email=email).first()
            if existing:
                skipped.append(
                    {
                        "full_name": full_name,
                        "email": email,
                        "reason": f"Email already exists (customer: {existing.customer_ref})",
                    }
                )
                continue

        # Resolve enums safely
        raw_type = row.get("customer_type", "individual").lower().strip()
        try:
            ctype = CustomerType(raw_type)
        except ValueError:
            ctype = CustomerType.individual

        raw_channel = row.get("onboarding_channel", "online").lower().strip()
        try:
            channel = OnboardingChannel(raw_channel)
        except ValueError:
            channel = OnboardingChannel.online

        raw_risk = row.get("risk_level", "low").lower().strip()
        try:
            risk = RiskLevel(raw_risk)
        except ValueError:
            risk = RiskLevel.low

        # Date of birth
        dob = None
        dob_str = row.get("date_of_birth", "").strip()
        if dob_str:
            try:
                from datetime import date as _date

                parts = dob_str.split("-")
                dob = _date(int(parts[0]), int(parts[1]), int(parts[2]))
            except Exception:
                warnings.append(
                    f"Row {i + 2}: date_of_birth '{dob_str}' could not be parsed — skipped"
                )

        customer_ref = _next_customer_ref(org_id, db)

        customer = Customer(
            customer_ref=customer_ref,
            org_id=org_id,
            customer_type=ctype,
            status=CustomerStatus.draft,
            full_name=full_name,
            email=email,
            phone=row.get("phone") or None,
            date_of_birth=dob,
            nationality=row.get("nationality", "").upper() or None,
            country_of_birth=row.get("country_of_birth", "").upper() or None,
            country_of_residence=row.get("country_of_residence", "AU").upper() or "AU",
            occupation=row.get("occupation") or None,
            employer_name=row.get("employer_name") or None,
            tax_identification_number=row.get("tax_identification_number") or None,
            tax_residency_country=row.get("tax_residency_country", "AU").upper()
            or "AU",
            address_line1=row.get("address_line1") or None,
            address_line2=row.get("address_line2") or None,
            city=row.get("city") or None,
            state=row.get("state") or None,
            postcode=row.get("postcode") or None,
            country=row.get("country", "AU").upper() or "AU",
            source_of_funds=row.get("source_of_funds") or None,
            source_of_wealth=row.get("source_of_wealth") or None,
            onboarding_channel=channel,
            risk_level=risk,
            onboarded_by=current_user.id,
        )
        db.add(customer)
        db.flush()

        # Create onboarding checklist
        _create_checklist(customer, db)

        created.append(
            {
                "customer_ref": customer_ref,
                "full_name": full_name,
                "email": email,
                "customer_type": ctype.value,
                "status": "draft",
            }
        )

    db.commit()

    log.info(
        "bulk_import.complete org=%s created=%d skipped=%d errors=%d by=%s",
        org_id,
        len(created),
        len(skipped),
        len(errors),
        current_user.id,
    )

    return {
        "status": "complete",
        "file": filename,
        "rows_parsed": len(rows),
        "created": len(created),
        "skipped": len(skipped),
        "error_count": len(errors),
        "created_customers": created,
        "skipped_rows": skipped,
        "errors": errors,
        "warnings": warnings,
        "next_steps": [
            "Review each imported customer record",
            "Complete CDD: upload identity documents and verify",
            "Run sanctions and PEP screening",
            "Update customer status to 'active' once CDD is complete",
        ],
        "disclaimer": (
            "All imported customers are in DRAFT status. "
            "CDD verification and sanctions screening must be completed "
            "before customers can be activated. "
            "All compliance decisions remain with the reporting entity."
        ),
    }
