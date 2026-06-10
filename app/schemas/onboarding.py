from pydantic import BaseModel, EmailStr
from typing import Optional, Any
from datetime import datetime
from app.models.onboarding import SessionStatus, CustomerType, ImportSource


class SessionCreate(BaseModel):
    industry_id: str
    applicant_name: str
    applicant_email: EmailStr
    applicant_phone: Optional[str] = None
    applicant_company: Optional[str] = None
    customer_type: CustomerType = CustomerType.individual
    created_by: Optional[str] = None


class SessionSummary(BaseModel):
    id: int
    session_id: str
    industry_id: str
    applicant_name: str
    applicant_email: str
    applicant_phone: Optional[str]
    customer_type: str
    status: str
    current_step: int
    total_steps: int
    completion_pct: float
    documents_uploaded: int
    reminders_sent: int
    sanctions_match: Optional[bool]
    risk_level: Optional[str]
    risk_score: Optional[float]
    customer_id: Optional[str]
    kyc_id: Optional[str]
    source: str
    invite_sent_at: Optional[datetime]
    invite_opened_at: Optional[datetime]
    completed_at: Optional[datetime]
    created_at: Optional[datetime]

    class Config:
        from_attributes = True


class SessionDetail(SessionSummary):
    invite_token: str
    invite_expires_at: Optional[datetime]
    collected_data: Optional[dict]
    batch_id: Optional[str]
    created_by: Optional[str]

    class Config:
        from_attributes = True


class AuditLogEntry(BaseModel):
    id: int
    event_type: str
    event_data: Optional[dict]
    actor: Optional[str]
    ip_address: Optional[str]
    created_at: Optional[datetime]

    class Config:
        from_attributes = True


class PortalTokenResponse(BaseModel):
    session_id: str
    industry_id: str
    applicant_name: str
    applicant_email: str
    applicant_company: Optional[str]
    customer_type: str
    status: str
    current_step: int
    total_steps: int
    completion_pct: float
    collected_data: Optional[dict]
    invite_expires_at: Optional[datetime]
    steps: list[dict]


class StepSubmit(BaseModel):
    step: int
    data: dict[str, Any]


class BatchSummary(BaseModel):
    batch_id: str
    industry_id: str
    source: str
    file_name: Optional[str]
    total_rows: int
    success_rows: int
    error_rows: int
    errors: Optional[list]
    created_at: Optional[datetime]

    class Config:
        from_attributes = True


class PipelineStats(BaseModel):
    total: int
    invited: int
    opened: int
    in_progress: int
    completed: int
    rejected: int
    expired: int
    avg_completion_pct: float
    sanctions_matches: int
