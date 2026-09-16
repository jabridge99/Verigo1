from datetime import date
from typing import List, Optional

from pydantic import BaseModel

from app.models.training_trigger import (
    IssuingBody,
    TriggerEventType,
    TriggerStatus,
    TriggerTargetType,
)


class CreateTriggerRuleRequest(BaseModel):
    name: str
    description: Optional[str] = None
    event_type: TriggerEventType
    condition_filter: dict = {}
    course_id: str
    target_type: TriggerTargetType
    target_roles: List[str] = []
    specific_user_ids: List[str] = []
    due_days: int = 14
    priority: str = "normal"
    notes_template: Optional[str] = None
    cooldown_days: int = 90
    override_system: bool = False
    regulatory_basis: Optional[str] = None


class UpdateTriggerRuleRequest(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    condition_filter: Optional[dict] = None
    target_type: Optional[TriggerTargetType] = None
    target_roles: Optional[List[str]] = None
    due_days: Optional[int] = None
    priority: Optional[str] = None
    cooldown_days: Optional[int] = None
    status: Optional[TriggerStatus] = None
    override_system: Optional[bool] = None


class ManualFireRequest(BaseModel):
    entity_type: str
    entity_id: str
    entity_snapshot: dict = {}
    handled_by_user_id: Optional[str] = None


class CreateRegulatoryUpdateRequest(BaseModel):
    event_ref: str
    title: str
    issuing_body: IssuingBody
    summary: str
    key_changes: List[str] = []
    full_text_url: Optional[str] = None
    effective_date: Optional[date] = None
    compliance_deadline: Optional[date] = None
    affected_industries: List[str] = []
    affected_roles: List[str] = []
    linked_course_id: Optional[str] = None
    auto_assign_training: bool = True
    is_urgent: bool = False
    tags: List[str] = []


class UpdateRegulatoryUpdateRequest(BaseModel):
    title: Optional[str] = None
    summary: Optional[str] = None
    key_changes: Optional[List[str]] = None
    affected_industries: Optional[List[str]] = None
    affected_roles: Optional[List[str]] = None
    linked_course_id: Optional[str] = None
    compliance_deadline: Optional[date] = None
    is_urgent: Optional[bool] = None
    tags: Optional[List[str]] = None


class ReviewAssessmentFlagRequest(BaseModel):
    requires_oversight: bool
    oversight_note: Optional[str] = None
    review_notes: Optional[str] = None
