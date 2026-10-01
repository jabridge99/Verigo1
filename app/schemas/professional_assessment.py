from typing import Optional

from pydantic import BaseModel, Field

from app.models.professional_assessment import (
    AssessmentRiskRating,
    ProfessionalServiceType,
    ReviewOutcome,
    SOFSourceType,
    SOWSourceType,
    TransactionPurposeType,
)


class AssessmentCreate(BaseModel):
    customer_id: str
    professional_service_type: ProfessionalServiceType
    transaction_id: Optional[str] = None
    case_id: Optional[str] = None
    matter_description: Optional[str] = Field(None, max_length=2000)
    assigned_to: Optional[str] = None


class AssessmentUpdate(BaseModel):
    matter_description: Optional[str] = Field(None, max_length=2000)
    assigned_to: Optional[str] = None
    overall_risk_rating: Optional[AssessmentRiskRating] = None
    risk_summary: Optional[str] = None
    smr_consideration_noted: Optional[bool] = None


class SOFUpsert(BaseModel):
    primary_source_type: SOFSourceType
    additional_source_types: list[str] = Field(default_factory=list)
    source_description: Optional[str] = None
    evidence_uploaded: bool = False
    evidence_reviewed: bool = False
    evidence_sufficient: bool = False
    additional_info_required: bool = False
    evidence_refs: list[str] = Field(default_factory=list)
    evidence_types: list[str] = Field(default_factory=list)
    review_outcome: ReviewOutcome = ReviewOutcome.not_reviewed
    review_notes: Optional[str] = None


class SOWUpsert(BaseModel):
    primary_source_type: SOWSourceType
    additional_source_types: list[str] = Field(default_factory=list)
    wealth_narrative: Optional[str] = None
    wealth_explanation_provided: bool = False
    evidence_reviewed: bool = False
    wealth_profile_consistent: bool = False
    additional_review_required: bool = False
    evidence_refs: list[str] = Field(default_factory=list)
    review_notes: Optional[str] = None
    risk_assessment: Optional[str] = None
    review_outcome: ReviewOutcome = ReviewOutcome.not_reviewed


class PurposeUpsert(BaseModel):
    purpose_type: TransactionPurposeType
    purpose_description: Optional[str] = None
    purpose_documented: bool = False
    purpose_verified: bool = False
    supporting_evidence_reviewed: bool = False
    purpose_consistent_with_profile: bool = False
    evidence_refs: list[str] = Field(default_factory=list)
    review_notes: Optional[str] = None
    review_outcome: ReviewOutcome = ReviewOutcome.not_reviewed


class TaxRiskUpsert(BaseModel):
    indicator_unexplained_cash: bool = False
    indicator_complex_ownership: bool = False
    indicator_offshore_no_purpose: bool = False
    indicator_income_inconsistency: bool = False
    indicator_related_party_movements: bool = False
    indicator_unusual_trust: bool = False
    indicator_unexplained_wealth: bool = False
    indicator_artificial_structuring: bool = False
    indicator_lack_documentation: bool = False
    indicator_reluctance_records: bool = False
    custom_indicators: list[dict] = Field(default_factory=list)
    supporting_evidence: Optional[str] = None
    reviewer_notes: Optional[str] = None
    risk_rating: AssessmentRiskRating = AssessmentRiskRating.not_rated


class InvestmentUpsert(BaseModel):
    investment_type: Optional[str] = Field(None, max_length=200)
    investment_purpose: Optional[str] = None
    purpose_documented: bool = False
    counterparty_identified: bool = False
    documentation_reviewed: bool = False
    funds_destination_verified: bool = False
    commercial_rationale_understood: bool = False
    regulatory_registration_verified: bool = False
    beneficial_ownership_verified: bool = False
    high_risk_jurisdiction_involved: bool = False
    supporting_documentation: list[str] = Field(default_factory=list)
    review_outcome: Optional[str] = None
    review_outcome_status: ReviewOutcome = ReviewOutcome.not_reviewed
    review_notes: Optional[str] = None


class ChecklistItemUpdate(BaseModel):
    key: str
    checked: bool
    notes: Optional[str] = None


class ChecklistSubmit(BaseModel):
    items: list[ChecklistItemUpdate]


class ChecklistTemplateUpsert(BaseModel):
    items: list[dict] = Field(
        ...,
        description="List of {key, label, is_required} dicts",
        min_length=1,
        max_length=20,
    )


class EscalateRequest(BaseModel):
    escalated_to: str
    escalation_reason: str = Field(..., min_length=10)
