from datetime import date, datetime
from typing import Optional

from pydantic import BaseModel

from app.models.aml_solution import (
    ProgramStatus,
    RiskAppetite,
    ServiceStatus,
    ServiceType,
    SolutionStatus,
)

# ── AML Solution ──────────────────────────────────────────────────────────────


class AMLSolutionResponse(BaseModel):
    id: str
    org_id: str
    status: SolutionStatus
    template_industry: Optional[str]
    activated_at: Optional[datetime]
    created_by: str
    created_at: Optional[datetime]

    model_config = {"from_attributes": True}


# ── AML Program ───────────────────────────────────────────────────────────────


class AMLProgramResponse(BaseModel):
    id: str
    solution_id: str
    org_id: str
    version: str
    status: ProgramStatus
    risk_appetite: Optional[RiskAppetite]
    is_legacy_part_ab: bool
    overview: Optional[str]
    scope: Optional[str]
    designated_services: Optional[str]
    ewra_summary: Optional[str]
    cdd_individuals: Optional[str]
    cdd_companies: Optional[str]
    ongoing_cdd: Optional[str]
    transaction_monitoring: Optional[str]
    pep_procedures: Optional[str]
    sanctions_procedures: Optional[str]
    smr_procedures: Optional[str]
    ttr_procedures: Optional[str]
    ifti_procedures: Optional[str]
    travel_rule_procedures: Optional[str]
    training_program_summary: Optional[str]
    record_keeping: Optional[str]
    independent_review: Optional[str]
    effective_date: Optional[date]
    review_due_date: Optional[date]
    approved_by: Optional[str]
    approved_at: Optional[datetime]
    created_at: Optional[datetime]
    updated_at: Optional[datetime]

    model_config = {"from_attributes": True}


class AMLProgramUpdate(BaseModel):
    """All fields optional — PATCH semantics."""

    overview: Optional[str] = None
    scope: Optional[str] = None
    designated_services: Optional[str] = None
    ewra_summary: Optional[str] = None
    risk_factors_customer: Optional[str] = None
    risk_factors_product: Optional[str] = None
    risk_factors_channel: Optional[str] = None
    risk_factors_geography: Optional[str] = None
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
    risk_appetite: Optional[RiskAppetite] = None


class AMLProgramApproveRequest(BaseModel):
    comments: Optional[str] = None


# ── AML Service ───────────────────────────────────────────────────────────────


class AMLServiceResponse(BaseModel):
    id: str
    solution_id: str
    org_id: str
    service_type: ServiceType
    status: ServiceStatus
    title: str
    description: Optional[str]
    deadline: Optional[date]
    target_date: Optional[date]
    invoiced: bool
    quoted_amount_aud: Optional[float]

    model_config = {"from_attributes": True}


class AMLServiceRequestUpdate(BaseModel):
    status: Optional[ServiceStatus] = None
    quoted_amount_aud: Optional[float] = None
    invoiced: Optional[bool] = None
    invoice_reference: Optional[str] = None
    notes: Optional[str] = None
