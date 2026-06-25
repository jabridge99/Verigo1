from datetime import date, datetime
from typing import Any, Dict, List, Optional

from pydantic import BaseModel, EmailStr, Field

from app.models.customer import (
    CDDLevel,
    CorporateDocumentType,
    CustomerStatus,
    CustomerType,
    NoteType,
    OnboardingChannel,
    PEPType,
    ReviewOutcome,
    RiskLevel,
    UBOType,
)
from app.models.kyc import (
    AddressDocumentType,
    IdentityDocumentType,
    LivenessCheckType,
    VerificationProvider,
    VerificationResult,
    VerificationSource,
)
from app.models.screening import (
    AlertSeverity,
    AlertStatus,
    CryptoNetwork,
    CryptoProvider,
    ScreeningProvider,
    ScreeningStatus,
    ScreeningType,
    WalletRiskCategory,
)

# ══════════════════════════════════════════════════════════════════════════════
# CUSTOMER SCHEMAS
# ══════════════════════════════════════════════════════════════════════════════


class CustomerCreate(BaseModel):
    customer_type: CustomerType = CustomerType.individual
    full_name: str = Field(..., min_length=2, max_length=255)
    date_of_birth: Optional[date] = None
    country_of_birth: Optional[str] = Field(None, max_length=2)
    nationality: Optional[str] = Field(None, max_length=2)
    dual_nationality: Optional[str] = Field(None, max_length=2)
    country_of_residence: Optional[str] = Field(None, max_length=2)
    occupation: Optional[str] = None
    employer_name: Optional[str] = None
    employer_address: Optional[str] = None
    tax_residency_country: Optional[str] = Field(None, max_length=2)
    tax_identification_number: Optional[str] = None
    fatca_applicable: bool = False
    crs_applicable: bool = False

    email: Optional[EmailStr] = None
    phone: Optional[str] = None

    address_line1: Optional[str] = None
    address_line2: Optional[str] = None
    city: Optional[str] = None
    state: Optional[str] = None
    postcode: Optional[str] = None
    country: str = "AU"
    mail_same_as_residential: bool = True
    mail_address_line1: Optional[str] = None
    mail_city: Optional[str] = None
    mail_state: Optional[str] = None
    mail_postcode: Optional[str] = None
    mail_country: Optional[str] = None

    source_of_funds: Optional[str] = None
    source_of_wealth: Optional[str] = None

    onboarding_channel: OnboardingChannel = OnboardingChannel.online
    introduced_by: Optional[str] = None
    relationship_manager: Optional[str] = None

    is_reporting_group_member: bool = False


class CustomerUpdate(BaseModel):
    full_name: Optional[str] = None
    occupation: Optional[str] = None
    employer_name: Optional[str] = None
    employer_address: Optional[str] = None
    tax_residency_country: Optional[str] = None
    tax_identification_number: Optional[str] = None
    email: Optional[EmailStr] = None
    phone: Optional[str] = None
    address_line1: Optional[str] = None
    address_line2: Optional[str] = None
    city: Optional[str] = None
    state: Optional[str] = None
    postcode: Optional[str] = None
    country: Optional[str] = None
    mail_same_as_residential: Optional[bool] = None
    mail_address_line1: Optional[str] = None
    mail_city: Optional[str] = None
    mail_state: Optional[str] = None
    mail_postcode: Optional[str] = None
    source_of_funds: Optional[str] = None
    source_of_wealth: Optional[str] = None
    relationship_manager: Optional[str] = None
    next_review_date: Optional[date] = None


class CustomerStatusUpdate(BaseModel):
    status: CustomerStatus
    reason: Optional[str] = None


class CustomerResponse(BaseModel):
    id: str
    customer_ref: str
    org_id: str
    customer_type: CustomerType
    status: CustomerStatus
    cdd_level: CDDLevel
    full_name: str
    date_of_birth: Optional[date]
    country_of_birth: Optional[str]
    nationality: Optional[str]
    country_of_residence: Optional[str]
    occupation: Optional[str]
    employer_name: Optional[str]
    tax_residency_country: Optional[str]
    fatca_applicable: bool
    crs_applicable: bool
    email: Optional[str]
    phone: Optional[str]
    address_line1: Optional[str]
    city: Optional[str]
    state: Optional[str]
    postcode: Optional[str]
    country: Optional[str]
    risk_level: RiskLevel
    risk_score: float
    is_pep: bool
    pep_type: Optional[PEPType]
    is_sanctions_match: bool
    is_adverse_media: bool
    source_of_funds: Optional[str]
    source_of_wealth: Optional[str]
    onboarding_channel: Optional[OnboardingChannel]
    relationship_manager: Optional[str]
    last_reviewed_date: Optional[date]
    next_review_date: Optional[date]
    onboarded_by: Optional[str]
    created_at: Optional[datetime]
    updated_at: Optional[datetime]

    model_config = {"from_attributes": True}


# ══════════════════════════════════════════════════════════════════════════════
# PREVIOUS NAME
# ══════════════════════════════════════════════════════════════════════════════


class PreviousNameCreate(BaseModel):
    full_name: str
    name_type: Optional[str] = None  # birth_name | maiden_name | alias | previous_name
    used_from: Optional[date] = None
    used_to: Optional[date] = None
    reason: Optional[str] = None


class PreviousNameResponse(BaseModel):
    id: str
    full_name: str
    name_type: Optional[str]
    used_from: Optional[date]
    used_to: Optional[date]
    reason: Optional[str]
    created_at: Optional[datetime]

    model_config = {"from_attributes": True}


# ══════════════════════════════════════════════════════════════════════════════
# BUSINESS DETAIL (KYB)
# ══════════════════════════════════════════════════════════════════════════════


class BusinessDetailCreate(BaseModel):
    legal_name: str
    trading_name: Optional[str] = None
    abn: Optional[str] = Field(None, max_length=11)
    acn: Optional[str] = Field(None, max_length=9)
    registration_number: Optional[str] = None
    business_type: Optional[str] = None
    industry_sector: Optional[str] = None
    country_of_incorporation: str = "AU"
    date_of_incorporation: Optional[date] = None
    reg_address_line1: Optional[str] = None
    reg_city: Optional[str] = None
    reg_state: Optional[str] = None
    reg_postcode: Optional[str] = None
    trust_type: Optional[str] = None
    trust_deed_date: Optional[date] = None
    trustee_name: Optional[str] = None
    annual_turnover_aud: Optional[float] = None
    number_of_employees: Optional[str] = None
    website: Optional[str] = None
    primary_contact_name: Optional[str] = None
    primary_contact_email: Optional[EmailStr] = None
    primary_contact_phone: Optional[str] = None


class BusinessDetailResponse(BaseModel):
    id: str
    legal_name: str
    trading_name: Optional[str]
    abn: Optional[str]
    acn: Optional[str]
    business_type: Optional[str]
    industry_sector: Optional[str]
    country_of_incorporation: Optional[str]
    date_of_incorporation: Optional[date]
    asic_status: Optional[str]
    asic_verified_at: Optional[datetime]
    abn_status: Optional[str]
    gst_registered: Optional[bool]
    abn_verified_at: Optional[datetime]
    trust_type: Optional[str]
    trustee_name: Optional[str]
    annual_turnover_aud: Optional[float]
    website: Optional[str]
    created_at: Optional[datetime]

    model_config = {"from_attributes": True}


# ══════════════════════════════════════════════════════════════════════════════
# BENEFICIAL OWNER
# ══════════════════════════════════════════════════════════════════════════════


class BeneficialOwnerCreate(BaseModel):
    ubo_type: UBOType
    role_title: Optional[str] = None
    full_name: str
    date_of_birth: Optional[date] = None
    nationality: Optional[str] = Field(None, max_length=2)
    country_of_residence: Optional[str] = Field(None, max_length=2)
    country_of_birth: Optional[str] = Field(None, max_length=2)
    tax_residency_country: Optional[str] = Field(None, max_length=2)
    tax_identification_number: Optional[str] = None
    address_line1: Optional[str] = None
    city: Optional[str] = None
    state: Optional[str] = None
    postcode: Optional[str] = None
    country: Optional[str] = "AU"
    id_type: Optional[str] = None
    id_number: Optional[str] = None
    id_issuing_country: Optional[str] = None
    id_expiry: Optional[date] = None
    ownership_percentage: Optional[float] = Field(None, ge=0, le=100)
    control_percentage: Optional[float] = Field(None, ge=0, le=100)
    intermediate_entity: Optional[str] = None
    source_of_wealth: Optional[str] = None


class BeneficialOwnerUpdate(BaseModel):
    ownership_percentage: Optional[float] = None
    control_percentage: Optional[float] = None
    role_title: Optional[str] = None
    source_of_wealth: Optional[str] = None
    verified: Optional[bool] = None
    verification_notes: Optional[str] = None


class BeneficialOwnerResponse(BaseModel):
    id: str
    customer_id: str
    ubo_type: UBOType
    role_title: Optional[str]
    full_name: str
    date_of_birth: Optional[date]
    nationality: Optional[str]
    country_of_residence: Optional[str]
    ownership_percentage: Optional[float]
    control_percentage: Optional[float]
    intermediate_entity: Optional[str]
    is_pep: bool
    pep_type: Optional[PEPType]
    verified: bool
    verified_at: Optional[datetime]
    created_at: Optional[datetime]

    model_config = {"from_attributes": True}


# ══════════════════════════════════════════════════════════════════════════════
# CORPORATE DOCUMENTS
# ══════════════════════════════════════════════════════════════════════════════


class CorporateDocumentCreate(BaseModel):
    document_type: CorporateDocumentType
    document_ref: str  # storage key
    file_name: Optional[str] = None
    description: Optional[str] = None
    issue_date: Optional[date] = None
    expiry_date: Optional[date] = None
    issuing_authority: Optional[str] = None


class CorporateDocumentResponse(BaseModel):
    id: str
    document_type: CorporateDocumentType
    document_ref: str
    file_name: Optional[str]
    description: Optional[str]
    issue_date: Optional[date]
    expiry_date: Optional[date]
    verified: bool
    verified_at: Optional[datetime]
    created_at: Optional[datetime]

    model_config = {"from_attributes": True}


# ══════════════════════════════════════════════════════════════════════════════
# KYC VERIFICATION
# ══════════════════════════════════════════════════════════════════════════════


class IdentityDocumentCreate(BaseModel):
    document_type: IdentityDocumentType
    document_number: Optional[str] = None
    issuing_country: Optional[str] = Field(None, max_length=2)
    issuing_state: Optional[str] = None
    issue_date: Optional[date] = None
    expiry_date: Optional[date] = None
    document_ref_front: Optional[str] = None
    document_ref_back: Optional[str] = None
    is_primary: bool = True
    verification_source: VerificationSource = VerificationSource.self_uploaded


class IdentityDocumentVerifyUpdate(BaseModel):
    verification_result: VerificationResult
    confidence_score: Optional[float] = None
    verification_notes: Optional[str] = None
    extracted_name: Optional[str] = None
    extracted_dob: Optional[date] = None
    provider: VerificationProvider = VerificationProvider.internal
    provider_reference: Optional[str] = None


class IdentityDocumentResponse(BaseModel):
    id: str
    document_type: IdentityDocumentType
    document_number: Optional[str]
    issuing_country: Optional[str]
    expiry_date: Optional[date]
    verification_result: Optional[VerificationResult]
    verification_source: Optional[VerificationSource]
    confidence_score: Optional[float]
    is_primary: bool
    is_current: bool
    verified_at: Optional[datetime]
    created_at: Optional[datetime]

    model_config = {"from_attributes": True}


class SelfieVerificationCreate(BaseModel):
    selfie_ref: str
    liveness_check_type: Optional[LivenessCheckType] = None
    identity_document_id: Optional[str] = None
    provider: VerificationProvider = VerificationProvider.internal
    provider_reference: Optional[str] = None
    liveness_result: Optional[VerificationResult] = None
    liveness_score: Optional[float] = None
    face_match_result: Optional[VerificationResult] = None
    face_match_score: Optional[float] = None


class SelfieVerificationResponse(BaseModel):
    id: str
    liveness_result: Optional[VerificationResult]
    liveness_score: Optional[float]
    face_match_result: Optional[VerificationResult]
    face_match_score: Optional[float]
    verification_result: Optional[VerificationResult]
    provider: Optional[VerificationProvider]
    verified_at: Optional[datetime]
    created_at: Optional[datetime]

    model_config = {"from_attributes": True}


class AddressVerificationCreate(BaseModel):
    document_type: AddressDocumentType
    document_ref: str
    document_date: Optional[date] = None
    issuer: Optional[str] = None
    extracted_address_line1: Optional[str] = None
    extracted_city: Optional[str] = None
    extracted_postcode: Optional[str] = None


class AddressVerificationResponse(BaseModel):
    id: str
    document_type: AddressDocumentType
    document_date: Optional[date]
    issuer: Optional[str]
    address_match_result: Optional[VerificationResult]
    verification_result: Optional[VerificationResult]
    verified_at: Optional[datetime]
    created_at: Optional[datetime]

    model_config = {"from_attributes": True}


class PhoneVerificationCreate(BaseModel):
    phone_number: str


class PhoneVerifyOTPRequest(BaseModel):
    otp_code: str


class PhoneVerificationResponse(BaseModel):
    id: str
    phone_number: str
    country_code: Optional[str]
    carrier_name: Optional[str]
    carrier_type: Optional[str]
    otp_verified: bool
    verification_result: Optional[VerificationResult]
    verified_at: Optional[datetime]
    created_at: Optional[datetime]

    model_config = {"from_attributes": True}


class EmailVerificationCreate(BaseModel):
    email_address: EmailStr


class EmailVerificationResponse(BaseModel):
    id: str
    email_address: str
    is_disposable: bool
    is_free_provider: bool
    token_verified: bool
    verification_result: Optional[VerificationResult]
    verified_at: Optional[datetime]
    created_at: Optional[datetime]

    model_config = {"from_attributes": True}


# ══════════════════════════════════════════════════════════════════════════════
# SCREENING
# ══════════════════════════════════════════════════════════════════════════════


class ScreeningTriggerRequest(BaseModel):
    screening_types: List[ScreeningType] = Field(
        ..., description="Types of screening to run"
    )
    entity_type: Optional[str] = "customer"
    entity_id: Optional[str] = None  # defaults to customer_id if not provided
    provider: ScreeningProvider = ScreeningProvider.internal
    force_rescan: bool = False


class ScreeningReviewUpdate(BaseModel):
    status: ScreeningStatus
    reviewer_notes: Optional[str] = None
    is_false_positive: bool = False


class ScreeningRecordResponse(BaseModel):
    id: str
    screening_type: ScreeningType
    entity_type: str
    entity_name: Optional[str]
    provider: ScreeningProvider
    status: ScreeningStatus
    match_count: Optional[float]
    match_score: Optional[float]
    pep_category: Optional[str]
    pep_position: Optional[str]
    reviewed_by: Optional[str]
    reviewed_at: Optional[datetime]
    screened_at: Optional[datetime]

    model_config = {"from_attributes": True}


class WalletScreeningCreate(BaseModel):
    wallet_address: str
    network: CryptoNetwork
    wallet_label: Optional[str] = None
    provider: CryptoProvider = CryptoProvider.internal


class WalletScreeningResponse(BaseModel):
    id: str
    wallet_address: str
    network: CryptoNetwork
    provider: CryptoProvider
    risk_score: Optional[float]
    risk_category: Optional[WalletRiskCategory]
    sanctioned_exposure_pct: Optional[float]
    darknet_exposure_pct: Optional[float]
    mixer_exposure_pct: Optional[float]
    status: ScreeningStatus
    screened_at: Optional[datetime]

    model_config = {"from_attributes": True}


class AlertUpdateRequest(BaseModel):
    status: AlertStatus
    resolution_notes: Optional[str] = None
    escalated_to: Optional[str] = None


class AlertResponse(BaseModel):
    id: str
    screening_record_id: str
    severity: AlertSeverity
    status: AlertStatus
    alert_type: Optional[str]
    summary: str
    assigned_to: Optional[str]
    resolved_by: Optional[str]
    resolved_at: Optional[datetime]
    created_at: Optional[datetime]

    model_config = {"from_attributes": True}


# ══════════════════════════════════════════════════════════════════════════════
# REVIEW & NOTES
# ══════════════════════════════════════════════════════════════════════════════


class CustomerReviewCreate(BaseModel):
    review_type: str = "periodic"
    trigger_reason: Optional[str] = None
    review_date: date
    next_review_date: Optional[date] = None
    outcome: Optional[ReviewOutcome] = None
    outcome_notes: Optional[str] = None
    risk_score_before: Optional[float] = Field(None, ge=0, le=100)
    risk_score_after: Optional[float] = Field(None, ge=0, le=100)
    cdd_level_before: Optional[CDDLevel] = None
    cdd_level_after: Optional[CDDLevel] = None


class CustomerReviewResponse(BaseModel):
    id: str
    review_type: str
    trigger_reason: Optional[str]
    review_date: date
    next_review_date: Optional[date]
    reviewed_by: str
    outcome: Optional[ReviewOutcome]
    outcome_notes: Optional[str]
    risk_score_before: Optional[float]
    risk_score_after: Optional[float]
    created_at: Optional[datetime]

    model_config = {"from_attributes": True}


class CustomerNoteCreate(BaseModel):
    note_type: NoteType = NoteType.general
    content: str = Field(..., min_length=1)
    is_confidential: bool = False


class CustomerNoteResponse(BaseModel):
    id: str
    note_type: NoteType
    content: str
    is_confidential: bool
    created_by: str
    created_at: Optional[datetime]

    model_config = {"from_attributes": True}


# ══════════════════════════════════════════════════════════════════════════════
# ONBOARDING CHECKLIST
# ══════════════════════════════════════════════════════════════════════════════


class OnboardingChecklistResponse(BaseModel):
    id: str
    customer_id: str
    identity_document_verified: bool
    selfie_verified: bool
    address_verified: bool
    phone_verified: bool
    email_verified: bool
    pep_screened: bool
    sanctions_screened: bool
    adverse_media_screened: bool
    abn_verified: bool
    asic_verified: bool
    corporate_docs_collected: bool
    ubo_identified: bool
    ubo_verified: bool
    ubo_screened: bool
    edd_source_of_funds_verified: bool
    edd_source_of_wealth_verified: bool
    edd_senior_approval_obtained: bool
    is_complete: bool
    completed_at: Optional[datetime]

    model_config = {"from_attributes": True}


# ══════════════════════════════════════════════════════════════════════════════
# RISK SCORE HISTORY
# ══════════════════════════════════════════════════════════════════════════════


class RiskScoreHistoryResponse(BaseModel):
    id: str
    risk_score: float
    risk_level: RiskLevel
    cdd_level: CDDLevel
    scoring_factors: Optional[Dict[str, Any]]
    trigger: Optional[str]
    triggered_by: Optional[str]
    notes: Optional[str]
    scored_at: Optional[datetime]

    model_config = {"from_attributes": True}
