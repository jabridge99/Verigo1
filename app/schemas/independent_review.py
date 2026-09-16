from datetime import date, datetime
from typing import List, Optional

from pydantic import BaseModel

from app.models.independent_review import (
    ActionType,
    FindingCategory,
    FindingRisk,
    RecommendationPriority,
    ReviewRating,
    ReviewScope,
    ReviewType,
)


class ReviewCreate(BaseModel):
    review_ref: str
    review_type: ReviewType
    review_scope: ReviewScope
    title: str
    description: Optional[str] = None
    reviewer_name: Optional[str] = None
    reviewer_firm: Optional[str] = None
    reviewer_credentials: Optional[str] = None
    review_period_start: Optional[date] = None
    review_period_end: Optional[date] = None
    target_completion_date: Optional[date] = None
    areas_reviewed: Optional[List[str]] = None
    commissioned_by: Optional[str] = None
    commissioned_at: Optional[datetime] = None
    report_date: Optional[date] = None
    report_ref: Optional[str] = None
    management_response_due: Optional[date] = None


class ReviewUpdate(BaseModel):
    review_type: Optional[ReviewType] = None
    review_scope: Optional[ReviewScope] = None
    title: Optional[str] = None
    description: Optional[str] = None
    reviewer_name: Optional[str] = None
    reviewer_firm: Optional[str] = None
    reviewer_credentials: Optional[str] = None
    review_period_start: Optional[date] = None
    review_period_end: Optional[date] = None
    target_completion_date: Optional[date] = None
    areas_reviewed: Optional[List[str]] = None
    report_date: Optional[date] = None
    report_ref: Optional[str] = None
    executive_summary: Optional[str] = None
    overall_rating: Optional[ReviewRating] = None
    management_response_due: Optional[date] = None


class FindingCreate(BaseModel):
    finding_ref: str
    title: str
    description: str
    risk_rating: FindingRisk
    category: FindingCategory
    regulatory_reference: Optional[str] = None
    policy_reference: Optional[str] = None
    evidence_refs: Optional[List[str]] = None
    affected_areas: Optional[List[str]] = None
    sample_tested: Optional[int] = None
    sample_failed: Optional[int] = None
    response_due_date: Optional[date] = None


class FindingUpdate(BaseModel):
    title: Optional[str] = None
    description: Optional[str] = None
    risk_rating: Optional[FindingRisk] = None
    category: Optional[FindingCategory] = None
    regulatory_reference: Optional[str] = None
    policy_reference: Optional[str] = None
    evidence_refs: Optional[List[str]] = None
    affected_areas: Optional[List[str]] = None
    sample_tested: Optional[int] = None
    sample_failed: Optional[int] = None
    response_due_date: Optional[date] = None


class RecommendationCreate(BaseModel):
    recommendation_ref: str
    description: str
    priority: RecommendationPriority
    target_date: Optional[date] = None


class RecommendationUpdate(BaseModel):
    description: Optional[str] = None
    priority: Optional[RecommendationPriority] = None
    target_date: Optional[date] = None


class ActionCreate(BaseModel):
    action_ref: str
    title: str
    description: Optional[str] = None
    action_type: ActionType
    due_date: Optional[date] = None
    assigned_to: Optional[str] = None


class ActionUpdate(BaseModel):
    title: Optional[str] = None
    description: Optional[str] = None
    action_type: Optional[ActionType] = None
    due_date: Optional[date] = None
