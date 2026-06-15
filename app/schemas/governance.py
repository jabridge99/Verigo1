from datetime import date, datetime
from typing import Any, Dict, List, Optional

from pydantic import BaseModel, Field

from app.models.governance import (
    AttestationType, PolicyCategory, PolicyLifecycleStatus, PolicyType,
)
from app.models.governance_controls import (
    ControlEffectiveness, ControlFrequency, ControlMethod,
    ControlRiskArea, ControlStatus, ControlType,
    FindingSeverity, RemediationStatus, TestResult,
)
from app.models.governance_training import AssignmentTrigger, TrainingStatus, TrainingType


# ══════════════════════════════════════════════════════════════════════════════
# POLICY SCHEMAS
# ══════════════════════════════════════════════════════════════════════════════

class PolicyCreate(BaseModel):
    title: str = Field(..., min_length=3, max_length=255)
    policy_type: PolicyType
    policy_category: PolicyCategory = PolicyCategory.operational
    business_unit: Optional[str] = None
    content: Optional[str] = None
    summary: Optional[str] = None
    scope: Optional[str] = None
    review_due_date: date
    effective_date: Optional[date] = None
    document_owner: str            # user_id
    compliance_reviewer: Optional[str] = None
    approver: Optional[str] = None
    regulatory_references: List[str] = []
    requires_attestation: bool = False
    attestation_due_days: int = 14
    annual_attestation: bool = False
    attachments: List[str] = []


class PolicyUpdate(BaseModel):
    title: Optional[str] = None
    content: Optional[str] = None
    summary: Optional[str] = None
    scope: Optional[str] = None
    review_due_date: Optional[date] = None
    effective_date: Optional[date] = None
    document_owner: Optional[str] = None
    compliance_reviewer: Optional[str] = None
    approver: Optional[str] = None
    business_unit: Optional[str] = None
    regulatory_references: Optional[List[str]] = None
    requires_attestation: Optional[bool] = None
    annual_attestation: Optional[bool] = None
    attachments: Optional[List[str]] = None


class PolicyWorkflowAction(BaseModel):
    action: str   # submit_for_review | approve | publish | request_changes | archive
    comments: Optional[str] = None
    change_type: Optional[str] = None   # major | minor | administrative (on publish)
    change_summary: Optional[str] = None


class PolicyResponse(BaseModel):
    id: str
    org_id: str
    policy_number: str
    title: str
    policy_type: PolicyType
    policy_category: PolicyCategory
    version_major: int
    version_minor: int
    status: PolicyLifecycleStatus
    effective_date: Optional[date]
    review_due_date: date
    approval_date: Optional[date]
    document_owner: Optional[str]
    compliance_reviewer: Optional[str]
    approver: Optional[str]
    business_unit: Optional[str]
    content: Optional[str]
    summary: Optional[str]
    requires_attestation: bool
    annual_attestation: bool
    regulatory_references: Optional[List[str]]
    superseded_by_id: Optional[str]
    created_by: str
    created_at: Optional[datetime]
    updated_at: Optional[datetime]

    model_config = {"from_attributes": True}


class PolicyVersionResponse(BaseModel):
    id: str
    policy_id: str
    version_label: Optional[str]
    version_major: int
    version_minor: int
    title: str
    content: Optional[str]
    change_type: Optional[str]
    change_summary: Optional[str]
    approved_by: Optional[str]
    approved_at: Optional[datetime]
    effective_date: Optional[date]
    created_by: str
    created_at: datetime

    model_config = {"from_attributes": True}


class AttestationCreate(BaseModel):
    attestation_type: AttestationType = AttestationType.read_and_understood
    comments: Optional[str] = None


class AttestationResponse(BaseModel):
    id: str
    policy_id: str
    user_id: str
    attestation_type: AttestationType
    policy_version: Optional[str]
    attested_at: datetime
    due_date: Optional[date]
    is_overdue: bool

    model_config = {"from_attributes": True}


# ══════════════════════════════════════════════════════════════════════════════
# CONTROL SCHEMAS
# ══════════════════════════════════════════════════════════════════════════════

class ControlCreate(BaseModel):
    name: str = Field(..., min_length=3, max_length=255)
    description: Optional[str] = None
    objective: Optional[str] = None
    control_type: ControlType
    control_type_secondary: Optional[ControlType] = None
    risk_area: ControlRiskArea
    risk_area_custom: Optional[str] = None
    linked_policy_id: Optional[str] = None
    control_owner: str          # user_id
    business_unit: Optional[str] = None
    reviewer_id: Optional[str] = None
    frequency: ControlFrequency
    control_method: ControlMethod
    is_key_control: bool = False
    evidence_required: List[str] = []
    regulatory_references: List[str] = []
    test_frequency: Optional[ControlFrequency] = None
    next_test_date: Optional[date] = None


class ControlUpdate(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    objective: Optional[str] = None
    control_type: Optional[ControlType] = None
    risk_area: Optional[ControlRiskArea] = None
    control_owner: Optional[str] = None
    business_unit: Optional[str] = None
    reviewer_id: Optional[str] = None
    frequency: Optional[ControlFrequency] = None
    control_method: Optional[ControlMethod] = None
    is_key_control: Optional[bool] = None
    evidence_required: Optional[List[str]] = None
    next_test_date: Optional[date] = None
    status: Optional[ControlStatus] = None


class ControlResponse(BaseModel):
    id: str
    org_id: str
    control_ref: str
    name: str
    description: Optional[str]
    objective: Optional[str]
    control_type: ControlType
    risk_area: ControlRiskArea
    risk_area_custom: Optional[str]
    control_owner: str
    business_unit: Optional[str]
    frequency: ControlFrequency
    control_method: ControlMethod
    is_key_control: bool
    evidence_required: Optional[List[str]]
    status: ControlStatus
    effectiveness: ControlEffectiveness
    last_tested_date: Optional[date]
    next_test_date: Optional[date]
    linked_policy_id: Optional[str]
    created_at: Optional[datetime]

    model_config = {"from_attributes": True}


class ControlTestCreate(BaseModel):
    test_date: date
    test_period_start: Optional[date] = None
    test_period_end: Optional[date] = None
    test_method: Optional[ControlMethod] = None
    population_size: Optional[int] = None
    sample_size: int = Field(..., ge=1)
    passed_samples: int = Field(..., ge=0)
    failed_samples: int = Field(..., ge=0)
    exceptions_noted: int = 0
    sampling_method: Optional[str] = None
    result: TestResult
    test_approach: Optional[str] = None
    findings_summary: Optional[str] = None
    evidence_document_ids: List[str] = []
    retest_required: bool = False
    retest_date: Optional[date] = None


class ControlTestResponse(BaseModel):
    id: str
    control_id: str
    org_id: str
    test_date: date
    tester_id: str
    sample_size: int
    passed_samples: Optional[int]
    failed_samples: Optional[int]
    result: TestResult
    calculated_effectiveness: Optional[ControlEffectiveness]
    effectiveness_score: Optional[float]
    findings_summary: Optional[str]
    action_required: bool
    retest_required: bool
    retest_date: Optional[date]
    is_finalised: bool
    created_at: Optional[datetime]

    model_config = {"from_attributes": True}


class FindingCreate(BaseModel):
    title: str
    description: str
    severity: FindingSeverity
    root_cause: Optional[str] = None
    root_cause_category: Optional[str] = None
    potential_impact: Optional[str] = None
    regulatory_breach: bool = False
    affected_sample_count: int = 0
    affected_sample_refs: List[str] = []


class RemediationCreate(BaseModel):
    title: str
    description: str
    owner_id: str
    due_date: date
    finding_severity: Optional[FindingSeverity] = None


class RemediationUpdate(BaseModel):
    status: Optional[RemediationStatus] = None
    completed_date: Optional[date] = None
    closure_notes: Optional[str] = None
    closure_evidence: Optional[List[str]] = None
    risk_acceptance_note: Optional[str] = None


class RemediationResponse(BaseModel):
    id: str
    test_id: str
    title: str
    description: str
    finding_severity: Optional[FindingSeverity]
    owner_id: str
    due_date: date
    completed_date: Optional[date]
    status: RemediationStatus
    closure_notes: Optional[str]
    created_at: Optional[datetime]

    model_config = {"from_attributes": True}


# ══════════════════════════════════════════════════════════════════════════════
# TRAINING SCHEMAS
# ══════════════════════════════════════════════════════════════════════════════

class TrainingCourseCreate(BaseModel):
    name: str
    training_type: TrainingType
    description: Optional[str] = None
    provider: Optional[str] = None
    delivery_method: Optional[str] = None
    duration_minutes: Optional[int] = None
    has_assessment: bool = False
    pass_mark: Optional[float] = None
    expiry_months: Optional[int] = None
    is_mandatory: bool = False
    applicable_roles: List[str] = ["all"]


class TrainingRecordCreate(BaseModel):
    course_id: str
    user_id: str
    due_date: date
    trigger: AssignmentTrigger = AssignmentTrigger.manual


class TrainingRecordUpdate(BaseModel):
    completion_date: Optional[date] = None
    score: Optional[float] = None
    passed: Optional[bool] = None
    certificate_document_id: Optional[str] = None
    is_exempt: Optional[bool] = None
    exemption_reason: Optional[str] = None


class TrainingRecordResponse(BaseModel):
    id: str
    org_id: str
    user_id: str
    course_id: str
    assigned_date: date
    due_date: date
    completion_date: Optional[date]
    expiry_date: Optional[date]
    score: Optional[float]
    passed: Optional[bool]
    status: TrainingStatus
    is_exempt: bool
    trigger: Optional[AssignmentTrigger]
    created_at: Optional[datetime]

    model_config = {"from_attributes": True}


class BulkAssignRequest(BaseModel):
    course_id: str
    due_date: date
    trigger: AssignmentTrigger
    user_ids: Optional[List[str]] = None     # specific users
    roles: Optional[List[str]] = None        # assign by role
    business_units: Optional[List[str]] = None
    notes: Optional[str] = None


# ══════════════════════════════════════════════════════════════════════════════
# DASHBOARD SCHEMAS
# ══════════════════════════════════════════════════════════════════════════════

class GovernanceDashboardResponse(BaseModel):
    as_of_date: date
    overall_governance_score: float
    overall_rag: str
    policy_health_score: float
    policy_rag: str
    control_health_score: float
    control_rag: str
    training_health_score: float
    training_rag: str
    # Policy KPIs
    policies_total: int
    policies_published: int
    policies_due_for_review: int
    policies_overdue_review: int
    outstanding_attestations: int
    # Control KPIs
    controls_total: int
    controls_effective_pct: float
    controls_not_tested: int
    controls_tested_this_quarter: int
    control_failures: int
    open_remediation_actions: int
    critical_remediations: int
    overdue_remediations: int
    # Training KPIs
    training_completion_pct: float
    training_overdue_pct: float
    training_expiry_risk_pct: float
    staff_overdue_count: int
    certificates_expiring_30d: int
