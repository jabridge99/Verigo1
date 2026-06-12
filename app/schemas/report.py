from datetime import datetime
from typing import Optional

from pydantic import BaseModel

from app.models.report import ReportPriority, ReportType


class ReportCreate(BaseModel):
    customer_id: int
    industry_id: Optional[str] = None
    report_type: ReportType
    title: str
    summary: str
    findings: Optional[str] = None
    narrative: Optional[str] = None
    total_amount_flagged: float = 0.0
    transaction_count: int = 0
    transaction_ids: Optional[list] = None
    alert_ids: Optional[list] = None
    prepared_by: Optional[str] = None
    reporting_entity: Optional[str] = None
    reporting_entity_abn: Optional[str] = None


class ReportUpdate(BaseModel):
    narrative: Optional[str] = None
    findings: Optional[str] = None
    summary: Optional[str] = None
    priority: Optional[ReportPriority] = None
    prepared_by: Optional[str] = None
    reviewed_by: Optional[str] = None
    reporting_entity: Optional[str] = None
    reporting_entity_abn: Optional[str] = None


class ReportSubmit(BaseModel):
    submitted_to: str = "AUSTRAC"
    submission_reference: Optional[str] = None
    approved_by: str


class ReportResponse(BaseModel):
    id: int
    report_id: str
    industry_id: Optional[str]
    customer_id: int
    report_type: str
    status: str
    priority: Optional[str]
    title: str
    summary: str
    findings: Optional[str]
    narrative: Optional[str]
    risk_level: Optional[str]
    total_amount_flagged: float
    transaction_count: int
    transaction_ids: Optional[list]
    alert_ids: Optional[list]
    austrac_report_type: Optional[str]
    reporting_entity: Optional[str]
    due_date: Optional[datetime]
    days_remaining: Optional[int]
    prepared_by: Optional[str]
    reviewed_by: Optional[str]
    approved_by: Optional[str]
    mlro_sign_off: Optional[bool]
    submitted_to: Optional[str]
    submission_reference: Optional[str]
    created_at: Optional[datetime]
    submitted_at: Optional[datetime]
    acknowledged_at: Optional[datetime]

    class Config:
        from_attributes = True


class ReportingSummary(BaseModel):
    total: int
    by_type: dict
    by_status: dict
    overdue: int
    due_soon: int
    submitted: int
    draft: int
    under_review: int


class ECDDCreate(BaseModel):
    customer_id: int
    industry_id: Optional[str] = None
    trigger_reason: str
    pep_status: int = 0
    adverse_media_found: int = 0
    adverse_media_details: Optional[str] = None
    beneficial_owner_verified: int = 0
    beneficial_owner_details: Optional[str] = None
    source_of_wealth_verified: int = 0
    source_of_wealth_details: Optional[str] = None
    analyst_notes: Optional[str] = None


class ECDDResponse(BaseModel):
    id: int
    ecdd_id: str
    customer_id: int
    trigger_reason: str
    pep_status: int
    adverse_media_found: int
    beneficial_owner_verified: int
    source_of_wealth_verified: int
    enhanced_risk_score: float
    recommendation: Optional[str]
    analyst_notes: Optional[str]
    status: str
    created_at: Optional[datetime]

    class Config:
        from_attributes = True
