"""
Schemas for app/api/routes/governance/training.py. Named after
app.models.governance_training, the model module these validate against.
Not merged into app/schemas/governance.py, which already holds unrelated
(unused) Training*/BulkAssignRequest classes from an earlier, never-wired-up
iteration — see PARKING_LOT.md for that finding.
"""

from datetime import date
from typing import List, Optional

from pydantic import BaseModel, Field

from app.models.governance_training import AssignmentTrigger, TrainingType


class CourseCreate(BaseModel):
    course_code: str = Field(..., max_length=30)
    name: str = Field(..., max_length=255)
    training_type: TrainingType
    description: Optional[str] = None
    learning_objectives: List[str] = []
    provider: Optional[str] = None
    delivery_method: Optional[str] = None
    duration_minutes: Optional[int] = Field(None, ge=1)
    external_url: Optional[str] = Field(None, max_length=512)
    has_assessment: bool = False
    pass_mark: Optional[float] = Field(None, ge=0, le=100)
    max_attempts: int = 3
    issues_certificate: bool = False
    expiry_months: Optional[int] = Field(None, ge=1)
    applicable_roles: List[str] = ["all"]
    is_mandatory: bool = False
    regulatory_references: List[str] = []
    applicable_industries: List[str] = ["all"]
    linked_control_ids: List[str] = []
    linked_risk_factor_categories: List[str] = []


class CourseUpdate(BaseModel):
    name: Optional[str] = Field(None, max_length=255)
    description: Optional[str] = None
    learning_objectives: Optional[List[str]] = None
    provider: Optional[str] = None
    delivery_method: Optional[str] = None
    duration_minutes: Optional[int] = Field(None, ge=1)
    external_url: Optional[str] = None
    has_assessment: Optional[bool] = None
    pass_mark: Optional[float] = Field(None, ge=0, le=100)
    expiry_months: Optional[int] = None
    applicable_roles: Optional[List[str]] = None
    is_mandatory: Optional[bool] = None
    is_active: Optional[bool] = None
    applicable_industries: Optional[List[str]] = None
    linked_control_ids: Optional[List[str]] = None
    linked_risk_factor_categories: Optional[List[str]] = None


class AssignRequest(BaseModel):
    course_id: str
    user_ids: Optional[List[str]] = None
    roles: Optional[List[str]] = None
    trigger: AssignmentTrigger = AssignmentTrigger.manual
    due_date: date
    notes: Optional[str] = None

    def model_post_init(self, __context) -> None:
        if not self.user_ids and not self.roles:
            raise ValueError("Provide at least one of user_ids or roles.")


class RecordCreate(BaseModel):
    course_id: str
    user_id: str
    assigned_date: date
    due_date: date
    trigger: AssignmentTrigger = AssignmentTrigger.manual


class CompleteRequest(BaseModel):
    completion_date: date
    score: Optional[float] = Field(None, ge=0, le=100)
    certificate_number: Optional[str] = None
    certificate_document_id: Optional[str] = None
    notes: Optional[str] = None


class ExemptRequest(BaseModel):
    reason: str = Field(..., min_length=10)
    approved_by: Optional[str] = None
