"""
Schemas for app/api/routes/aml_program.py (prefix /aml-program), which
operates on app.models.aml_solution (AMLProgram, AMLSolution, RiskAssessment)
- a distinct model domain from app.models.aml_program, which
app/schemas/aml_program.py itself backs (used by organisations.py's
/organisations/{org_id}/aml-program endpoints and verify.py). Named after
the model module these schemas actually validate against, not the route's
prefix, to avoid conflating the two.
"""

from datetime import date
from typing import Optional

from pydantic import BaseModel, Field

from app.models.aml_solution import RiskAppetite


class ProgramCreate(BaseModel):
    version: str = Field(..., min_length=1, max_length=20, description="e.g. 1.0, 2.1")
    risk_appetite: RiskAppetite = RiskAppetite.medium
    overview: Optional[str] = None
    scope: Optional[str] = None
    designated_services: Optional[str] = None
    compliance_officer_name: Optional[str] = None
    compliance_officer_role: Optional[str] = None
    effective_date: Optional[date] = None
    review_due_date: Optional[date] = None
    is_legacy_part_ab: bool = False


class ProgramUpdate(BaseModel):
    risk_appetite: Optional[RiskAppetite] = None
    overview: Optional[str] = None
    scope: Optional[str] = None
    designated_services: Optional[str] = None
    compliance_officer_name: Optional[str] = None
    compliance_officer_role: Optional[str] = None
    # Section fields — free-text narrative
    ewra_summary: Optional[str] = None
    risk_factors_customer: Optional[str] = None
    risk_factors_product: Optional[str] = None
    risk_factors_channel: Optional[str] = None
    risk_factors_geography: Optional[str] = None
    risk_factors_proliferation: Optional[str] = None
    cdd_individuals: Optional[str] = None
    cdd_companies: Optional[str] = None
    cdd_trusts: Optional[str] = None
    cdd_simplified_procedures: Optional[str] = None
    cdd_enhanced_procedures: Optional[str] = None
    ongoing_cdd: Optional[str] = None
    transaction_monitoring: Optional[str] = None
    beneficial_ownership_procedures: Optional[str] = None
    pep_procedures: Optional[str] = None
    sanctions_procedures: Optional[str] = None
    travel_rule_procedures: Optional[str] = None
    smr_procedures: Optional[str] = None
    ttr_procedures: Optional[str] = None
    ifti_procedures: Optional[str] = None
    annual_compliance_report: Optional[str] = None
    employee_due_diligence: Optional[str] = None
    training_program_summary: Optional[str] = None
    record_keeping: Optional[str] = None
    independent_review: Optional[str] = None
    effective_date: Optional[date] = None
    review_due_date: Optional[date] = None


class ProgramReview(BaseModel):
    review_notes: str = Field(..., min_length=20)
    next_review_date: Optional[date] = None
    changes_required: bool = False


class RiskAssessmentCreate(BaseModel):
    title: str = Field(..., min_length=5, max_length=255)
    assessment_date: date
    customer_risk_rating: Optional[str] = None
    product_risk_rating: Optional[str] = None
    channel_risk_rating: Optional[str] = None
    geography_risk_rating: Optional[str] = None
    inherent_risk_score: Optional[float] = Field(None, ge=0, le=25)
    control_effectiveness_score: Optional[float] = Field(None, ge=0, le=5)
    residual_risk_score: Optional[float] = Field(None, ge=0, le=25)
    findings: Optional[str] = None
    recommendations: Optional[str] = None
    action_items: Optional[str] = None
    next_review_date: Optional[date] = None


class RiskAssessmentUpdate(BaseModel):
    customer_risk_rating: Optional[str] = None
    product_risk_rating: Optional[str] = None
    channel_risk_rating: Optional[str] = None
    geography_risk_rating: Optional[str] = None
    inherent_risk_score: Optional[float] = Field(None, ge=0, le=25)
    control_effectiveness_score: Optional[float] = Field(None, ge=0, le=5)
    residual_risk_score: Optional[float] = Field(None, ge=0, le=25)
    findings: Optional[str] = None
    recommendations: Optional[str] = None
    action_items: Optional[str] = None
    next_review_date: Optional[date] = None


class AustracDetails(BaseModel):
    austrac_enrolment_date: Optional[date] = None
    austrac_registration_date: Optional[date] = None
    austrac_registration_expiry: Optional[date] = None
    designated_business_group: Optional[str] = None
