"""Pydantic schemas for Case Management."""
from datetime import date, datetime
from typing import Optional

from pydantic import BaseModel, Field

from app.models.case import (
    CaseOutcome,
    CaseSeverity,
    CaseStatus,
    CaseType,
    EvidenceType,
    NoteType,
)


# ── Case ──────────────────────────────────────────────────────────────────────

class CaseCreate(BaseModel):
    customer_id: Optional[str] = None
    case_type: CaseType = CaseType.internal_investigation
    severity: CaseSeverity = CaseSeverity.medium
    title: str = Field(..., max_length=500)
    description: Optional[str] = None
    due_date: Optional[date] = None
    is_smr_candidate: bool = False
    linked_customer_ids: list[str] = []
    related_case_ids: list[str] = []
    alert_ids: list[str] = []       # alerts to link on creation


class CaseUpdate(BaseModel):
    severity: Optional[CaseSeverity] = None
    title: Optional[str] = Field(None, max_length=500)
    description: Optional[str] = None
    due_date: Optional[date] = None
    is_smr_candidate: Optional[bool] = None
    tipping_off_risk: Optional[bool] = None
    linked_customer_ids: Optional[list[str]] = None
    related_case_ids: Optional[list[str]] = None


class CaseStatusTransitionRequest(BaseModel):
    new_status: CaseStatus
    reason: Optional[str] = None


class CaseAssignRequest(BaseModel):
    assign_to: str
    assign_by: str


class CaseEscalateRequest(BaseModel):
    escalate_to: str = Field(..., description="MLRO user ID")
    escalation_reason: str


class CaseCloseRequest(BaseModel):
    status: CaseStatus = Field(..., description="Must be a closed_* status")
    outcome: CaseOutcome
    outcome_notes: Optional[str] = None
    closure_reason: str


class CaseOut(BaseModel):
    id: str
    case_ref: str
    org_id: str
    customer_id: Optional[str] = None
    case_type: CaseType
    severity: CaseSeverity
    status: CaseStatus
    title: str
    description: Optional[str] = None
    assigned_to: Optional[str] = None
    assigned_at: Optional[datetime] = None
    escalated_to: Optional[str] = None
    escalated_at: Optional[datetime] = None
    escalation_reason: Optional[str] = None
    due_date: Optional[date] = None
    is_overdue: bool
    is_smr_candidate: bool
    smr_considered: bool
    smr_considered_by: Optional[str] = None
    smr_considered_at: Optional[datetime] = None
    smr_lodged: bool
    smr_lodged_at: Optional[datetime] = None
    smr_lodged_by: Optional[str] = None
    smr_reference: Optional[str] = None
    tipping_off_risk: bool
    linked_customer_ids: list[str]
    related_case_ids: list[str]
    outcome: Optional[CaseOutcome] = None
    outcome_notes: Optional[str] = None
    closed_by: Optional[str] = None
    closed_at: Optional[datetime] = None
    closure_reason: Optional[str] = None
    created_by: str
    created_at: datetime
    updated_at: Optional[datetime] = None

    class Config:
        from_attributes = True


class CaseListOut(BaseModel):
    id: str
    case_ref: str
    customer_id: Optional[str] = None
    case_type: CaseType
    severity: CaseSeverity
    status: CaseStatus
    title: str
    is_smr_candidate: bool
    is_overdue: bool
    assigned_to: Optional[str] = None
    due_date: Optional[date] = None
    created_at: datetime

    class Config:
        from_attributes = True


# ── Case Note ─────────────────────────────────────────────────────────────────

class CaseNoteCreate(BaseModel):
    note_type: NoteType = NoteType.investigation_note
    content: str
    is_confidential: bool = False
    is_legal_privilege: bool = False


class CaseNoteOut(BaseModel):
    id: str
    case_id: str
    org_id: str
    note_type: NoteType
    content: str
    is_confidential: bool
    is_legal_privilege: bool
    author_id: str
    created_at: datetime

    class Config:
        from_attributes = True


# ── Case Evidence ─────────────────────────────────────────────────────────────

class CaseEvidenceCreate(BaseModel):
    evidence_type: EvidenceType
    document_ref: str = Field(..., max_length=500)
    file_name: Optional[str] = Field(None, max_length=500)
    description: Optional[str] = Field(None, max_length=1000)
    source: Optional[str] = Field(None, max_length=255)
    received_date: Optional[date] = None


class CaseEvidenceOut(BaseModel):
    id: str
    case_id: str
    evidence_type: EvidenceType
    document_ref: str
    file_name: Optional[str] = None
    description: Optional[str] = None
    source: Optional[str] = None
    received_date: Optional[date] = None
    is_verified: bool
    verified_by: Optional[str] = None
    verified_at: Optional[datetime] = None
    uploaded_by: str
    created_at: datetime

    class Config:
        from_attributes = True


# ── SMR Workflow ──────────────────────────────────────────────────────────────

class SMRConsiderRequest(BaseModel):
    smr_notes: str = Field(..., description="MLRO reasoning (confidential)")
    proceed_to_lodge: bool = False      # if True, also sets smr_lodged


class SMRLodgeRequest(BaseModel):
    smr_reference: str = Field(..., max_length=100,
                                description="AUSTRAC SMR confirmation reference")
    smr_notes: Optional[str] = None


# ── Link Alert to Case ─────────────────────────────────────────────────────────

class LinkAlertRequest(BaseModel):
    alert_id: str
    transaction_id: Optional[str] = None
    notes: Optional[str] = None
