"""
Independent Review API routes — AML/CTF Program independent review management.

Lifecycle enforced:
  Review:         planned → in_progress → findings_issued → response_due → completed → archived
  Finding:        open → response_submitted → in_remediation → closed (or overdue / accepted_risk)
  Recommendation: open → accepted/rejected → in_progress → completed/overdue
  Action:         planned → in_progress → completed → verified (or overdue/cancelled)

DISCLAIMER: This module provides workflow tooling only.
All compliance decisions remain with the reporting entity.
"""

import logging
from datetime import date, datetime, timezone
from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app.api.deps import get_current_user, get_db, require_roles
from app.models.independent_review import (
    ActionStatus,
    ActionType,
    FindingCategory,
    FindingRisk,
    FindingStatus,
    IndependentReview,
    RecommendationPriority,
    RecommendationStatus,
    ReviewAction,
    ReviewFinding,
    ReviewRating,
    ReviewRecommendation,
    ReviewScope,
    ReviewStatus,
    ReviewType,
)
from app.models.user import UserRole

log = logging.getLogger("tvg.independent_review")

router = APIRouter(prefix="/independent-reviews", tags=["Independent Review"])

# ── REVIEW LIFECYCLE ──────────────────────────────────────────────────────────

REVIEW_TRANSITIONS = {
    ReviewStatus.planned: [ReviewStatus.in_progress],
    ReviewStatus.in_progress: [ReviewStatus.findings_issued],
    ReviewStatus.findings_issued: [ReviewStatus.response_due],
    ReviewStatus.response_due: [ReviewStatus.completed],
    ReviewStatus.completed: [ReviewStatus.archived],
    ReviewStatus.archived: [],
}

# ── Pydantic schemas ──────────────────────────────────────────────────────────


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


# ── Helper ────────────────────────────────────────────────────────────────────


def _get_review(db: Session, org_id: str, review_id: str) -> IndependentReview:
    r = db.query(IndependentReview).filter_by(id=review_id, org_id=org_id).first()
    if not r:
        raise HTTPException(404, "Review not found")
    return r


def _get_finding(db: Session, org_id: str, finding_id: str) -> ReviewFinding:
    f = db.query(ReviewFinding).filter_by(id=finding_id, org_id=org_id).first()
    if not f:
        raise HTTPException(404, "Finding not found")
    return f


def _get_recommendation(db: Session, org_id: str, rec_id: str) -> ReviewRecommendation:
    r = db.query(ReviewRecommendation).filter_by(id=rec_id, org_id=org_id).first()
    if not r:
        raise HTTPException(404, "Recommendation not found")
    return r


def _get_action(db: Session, org_id: str, action_id: str) -> ReviewAction:
    a = db.query(ReviewAction).filter_by(id=action_id, org_id=org_id).first()
    if not a:
        raise HTTPException(404, "Action not found")
    return a


def _recount_findings(db: Session, review: IndependentReview):
    """Recompute finding_count_* from current DB state."""
    from sqlalchemy import func as sqlfunc

    rows = (
        db.query(ReviewFinding.risk_rating, sqlfunc.count())
        .filter_by(review_id=review.id)
        .group_by(ReviewFinding.risk_rating)
        .all()
    )
    counts = {r: c for r, c in rows}
    review.finding_count_critical = counts.get("critical", 0)
    review.finding_count_high = counts.get("high", 0)
    review.finding_count_medium = counts.get("medium", 0)
    review.finding_count_low = counts.get("low", 0)


def _review_dict(r: IndependentReview) -> dict:
    return {
        "id": r.id,
        "review_ref": r.review_ref,
        "org_id": r.org_id,
        "review_type": r.review_type,
        "review_scope": r.review_scope,
        "status": r.status,
        "overall_rating": r.overall_rating,
        "reviewer_name": r.reviewer_name,
        "reviewer_firm": r.reviewer_firm,
        "reviewer_credentials": r.reviewer_credentials,
        "title": r.title,
        "description": r.description,
        "review_period_start": str(r.review_period_start)
        if r.review_period_start
        else None,
        "review_period_end": str(r.review_period_end) if r.review_period_end else None,
        "areas_reviewed": r.areas_reviewed,
        "commissioned_by": r.commissioned_by,
        "commissioned_at": r.commissioned_at.isoformat() if r.commissioned_at else None,
        "report_date": str(r.report_date) if r.report_date else None,
        "report_ref": r.report_ref,
        "executive_summary": r.executive_summary,
        "finding_count_critical": r.finding_count_critical,
        "finding_count_high": r.finding_count_high,
        "finding_count_medium": r.finding_count_medium,
        "finding_count_low": r.finding_count_low,
        "management_response_due": str(r.management_response_due)
        if r.management_response_due
        else None,
        "management_response_at": r.management_response_at.isoformat()
        if r.management_response_at
        else None,
        "board_acknowledged": r.board_acknowledged,
        "board_acknowledged_by": r.board_acknowledged_by,
        "board_acknowledged_at": r.board_acknowledged_at.isoformat()
        if r.board_acknowledged_at
        else None,
        "completed_at": r.completed_at.isoformat() if r.completed_at else None,
        "completed_by": r.completed_by,
        "closure_notes": r.closure_notes,
        "created_by": r.created_by,
        "created_at": r.created_at.isoformat() if r.created_at else None,
        "updated_at": r.updated_at.isoformat() if r.updated_at else None,
    }


def _finding_dict(f: ReviewFinding) -> dict:
    return {
        "id": f.id,
        "finding_ref": f.finding_ref,
        "review_id": f.review_id,
        "org_id": f.org_id,
        "finding_number": f.finding_number,
        "title": f.title,
        "description": f.description,
        "risk_rating": f.risk_rating,
        "category": f.category,
        "status": f.status,
        "regulatory_reference": f.regulatory_reference,
        "policy_reference": f.policy_reference,
        "evidence_refs": f.evidence_refs,
        "affected_areas": f.affected_areas,
        "sample_tested": f.sample_tested,
        "sample_failed": f.sample_failed,
        "management_response": f.management_response,
        "response_due_date": str(f.response_due_date) if f.response_due_date else None,
        "response_submitted_at": f.response_submitted_at.isoformat()
        if f.response_submitted_at
        else None,
        "response_submitted_by": f.response_submitted_by,
        "closed_at": f.closed_at.isoformat() if f.closed_at else None,
        "closed_by": f.closed_by,
        "closure_evidence": f.closure_evidence,
        "created_by": f.created_by,
        "created_at": f.created_at.isoformat() if f.created_at else None,
        "updated_at": f.updated_at.isoformat() if f.updated_at else None,
    }


def _rec_dict(r: ReviewRecommendation) -> dict:
    return {
        "id": r.id,
        "recommendation_ref": r.recommendation_ref,
        "finding_id": r.finding_id,
        "review_id": r.review_id,
        "org_id": r.org_id,
        "description": r.description,
        "priority": r.priority,
        "status": r.status,
        "target_date": str(r.target_date) if r.target_date else None,
        "accepted_by": r.accepted_by,
        "accepted_at": r.accepted_at.isoformat() if r.accepted_at else None,
        "rejection_reason": r.rejection_reason,
        "created_by": r.created_by,
        "created_at": r.created_at.isoformat() if r.created_at else None,
        "updated_at": r.updated_at.isoformat() if r.updated_at else None,
    }


def _action_dict(a: ReviewAction) -> dict:
    return {
        "id": a.id,
        "action_ref": a.action_ref,
        "recommendation_id": a.recommendation_id,
        "finding_id": a.finding_id,
        "review_id": a.review_id,
        "org_id": a.org_id,
        "title": a.title,
        "description": a.description,
        "action_type": a.action_type,
        "status": a.status,
        "assigned_to": a.assigned_to,
        "assigned_by": a.assigned_by,
        "assigned_at": a.assigned_at.isoformat() if a.assigned_at else None,
        "due_date": str(a.due_date) if a.due_date else None,
        "is_overdue": a.is_overdue,
        "completion_evidence": a.completion_evidence,
        "supporting_doc_ids": a.supporting_doc_ids,
        "completed_by": a.completed_by,
        "completed_at": a.completed_at.isoformat() if a.completed_at else None,
        "verified_by": a.verified_by,
        "verified_at": a.verified_at.isoformat() if a.verified_at else None,
        "verified_notes": a.verified_notes,
        "cancelled_by": a.cancelled_by,
        "cancelled_at": a.cancelled_at.isoformat() if a.cancelled_at else None,
        "cancellation_reason": a.cancellation_reason,
        "created_by": a.created_by,
        "created_at": a.created_at.isoformat() if a.created_at else None,
        "updated_at": a.updated_at.isoformat() if a.updated_at else None,
    }


# ── REVIEW CRUD ───────────────────────────────────────────────────────────────


@router.post("", status_code=201)
def create_review(
    body: ReviewCreate,
    db: Session = Depends(get_db),
    current_user=Depends(require_roles(UserRole.compliance)),
):
    if (
        db.query(IndependentReview)
        .filter_by(org_id=current_user.org_id, review_ref=body.review_ref)
        .first()
    ):
        raise HTTPException(409, f"Review ref '{body.review_ref}' already exists")

    review = IndependentReview(
        org_id=current_user.org_id,
        created_by=current_user.id,
        review_ref=body.review_ref,
        review_type=body.review_type,
        review_scope=body.review_scope,
        title=body.title,
        description=body.description,
        reviewer_name=body.reviewer_name,
        reviewer_firm=body.reviewer_firm,
        reviewer_credentials=body.reviewer_credentials,
        review_period_start=body.review_period_start,
        review_period_end=body.review_period_end,
        areas_reviewed=body.areas_reviewed or [],
        commissioned_by=body.commissioned_by,
        commissioned_at=body.commissioned_at,
        report_date=body.report_date,
        report_ref=body.report_ref,
        management_response_due=body.management_response_due,
    )
    db.add(review)
    db.commit()
    db.refresh(review)
    log.info("review.created org=%s ref=%s", current_user.org_id, review.review_ref)
    return _review_dict(review)


@router.get("")
def list_reviews(
    status: Optional[ReviewStatus] = None,
    review_type: Optional[ReviewType] = None,
    review_scope: Optional[ReviewScope] = None,
    skip: int = 0,
    limit: int = Query(50, le=200),
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
):
    q = db.query(IndependentReview).filter_by(org_id=current_user.org_id)
    if status:
        q = q.filter(IndependentReview.status == status)
    if review_type:
        q = q.filter(IndependentReview.review_type == review_type)
    if review_scope:
        q = q.filter(IndependentReview.review_scope == review_scope)
    total = q.count()
    items = (
        q.order_by(IndependentReview.created_at.desc()).offset(skip).limit(limit).all()
    )
    return {"total": total, "items": [_review_dict(r) for r in items]}


@router.get("/enums")
def review_enums():
    return {
        "review_type": [e.value for e in ReviewType],
        "review_scope": [e.value for e in ReviewScope],
        "review_status": [e.value for e in ReviewStatus],
        "review_rating": [e.value for e in ReviewRating],
        "finding_risk": [e.value for e in FindingRisk],
        "finding_category": [e.value for e in FindingCategory],
        "finding_status": [e.value for e in FindingStatus],
        "recommendation_priority": [e.value for e in RecommendationPriority],
        "recommendation_status": [e.value for e in RecommendationStatus],
        "action_type": [e.value for e in ActionType],
        "action_status": [e.value for e in ActionStatus],
    }


@router.get("/{review_id}")
def get_review(
    review_id: str,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
):
    return _review_dict(_get_review(db, current_user.org_id, review_id))


@router.patch("/{review_id}")
def update_review(
    review_id: str,
    body: ReviewUpdate,
    db: Session = Depends(get_db),
    current_user=Depends(require_roles(UserRole.compliance)),
):
    review = _get_review(db, current_user.org_id, review_id)
    if review.status == ReviewStatus.archived:
        raise HTTPException(409, "Archived reviews cannot be modified")
    for field, value in body.model_dump(exclude_none=True).items():
        setattr(review, field, value)
    db.commit()
    db.refresh(review)
    return _review_dict(review)


@router.post("/{review_id}/transition")
def transition_review(
    review_id: str,
    to_status: ReviewStatus,
    notes: Optional[str] = None,
    db: Session = Depends(get_db),
    current_user=Depends(require_roles(UserRole.compliance)),
):
    review = _get_review(db, current_user.org_id, review_id)
    allowed = REVIEW_TRANSITIONS.get(review.status, [])
    if to_status not in allowed:
        raise HTTPException(
            422,
            f"Cannot transition from '{review.status}' to '{to_status}'. "
            f"Allowed: {[s.value for s in allowed]}",
        )
    review.status = to_status
    if to_status == ReviewStatus.completed:
        review.completed_at = datetime.now(timezone.utc)
        review.completed_by = current_user.id
        if notes:
            review.closure_notes = notes
    elif to_status == ReviewStatus.response_due:
        review.management_response_at = datetime.now(timezone.utc)
    db.commit()
    db.refresh(review)
    log.info(
        "review.transition org=%s ref=%s to=%s",
        current_user.org_id,
        review.review_ref,
        to_status,
    )
    return _review_dict(review)


@router.post("/{review_id}/board-acknowledge")
def board_acknowledge(
    review_id: str,
    db: Session = Depends(get_db),
    current_user=Depends(require_roles(UserRole.mlro)),
):
    review = _get_review(db, current_user.org_id, review_id)
    review.board_acknowledged = True
    review.board_acknowledged_by = current_user.id
    review.board_acknowledged_at = datetime.now(timezone.utc)
    db.commit()
    db.refresh(review)
    return _review_dict(review)


# ── FINDINGS ──────────────────────────────────────────────────────────────────


@router.post("/{review_id}/findings", status_code=201)
def create_finding(
    review_id: str,
    body: FindingCreate,
    db: Session = Depends(get_db),
    current_user=Depends(require_roles(UserRole.compliance)),
):
    review = _get_review(db, current_user.org_id, review_id)
    if review.status == ReviewStatus.archived:
        raise HTTPException(409, "Cannot add findings to an archived review")

    if (
        db.query(ReviewFinding)
        .filter_by(org_id=current_user.org_id, finding_ref=body.finding_ref)
        .first()
    ):
        raise HTTPException(409, f"Finding ref '{body.finding_ref}' already exists")

    # Sequential finding_number within this review
    last = (
        db.query(ReviewFinding)
        .filter_by(review_id=review_id)
        .order_by(ReviewFinding.finding_number.desc())
        .first()
    )
    finding_number = (last.finding_number + 1) if last else 1

    finding = ReviewFinding(
        finding_ref=body.finding_ref,
        review_id=review_id,
        org_id=current_user.org_id,
        finding_number=finding_number,
        title=body.title,
        description=body.description,
        risk_rating=body.risk_rating,
        category=body.category,
        regulatory_reference=body.regulatory_reference,
        policy_reference=body.policy_reference,
        evidence_refs=body.evidence_refs or [],
        affected_areas=body.affected_areas or [],
        sample_tested=body.sample_tested,
        sample_failed=body.sample_failed,
        response_due_date=body.response_due_date,
        created_by=current_user.id,
    )
    db.add(finding)
    db.flush()
    _recount_findings(db, review)
    db.commit()
    db.refresh(finding)
    log.info(
        "finding.created org=%s ref=%s risk=%s",
        current_user.org_id,
        finding.finding_ref,
        finding.risk_rating,
    )
    return _finding_dict(finding)


@router.get("/{review_id}/findings")
def list_findings(
    review_id: str,
    status: Optional[FindingStatus] = None,
    risk_rating: Optional[FindingRisk] = None,
    category: Optional[FindingCategory] = None,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
):
    _get_review(db, current_user.org_id, review_id)
    q = db.query(ReviewFinding).filter_by(
        review_id=review_id, org_id=current_user.org_id
    )
    if status:
        q = q.filter(ReviewFinding.status == status)
    if risk_rating:
        q = q.filter(ReviewFinding.risk_rating == risk_rating)
    if category:
        q = q.filter(ReviewFinding.category == category)
    items = q.order_by(ReviewFinding.finding_number).all()
    return {"total": len(items), "items": [_finding_dict(f) for f in items]}


@router.get("/{review_id}/findings/{finding_id}")
def get_finding(
    review_id: str,
    finding_id: str,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
):
    _get_review(db, current_user.org_id, review_id)
    return _finding_dict(_get_finding(db, current_user.org_id, finding_id))


@router.patch("/{review_id}/findings/{finding_id}")
def update_finding(
    review_id: str,
    finding_id: str,
    body: FindingUpdate,
    db: Session = Depends(get_db),
    current_user=Depends(require_roles(UserRole.compliance)),
):
    review = _get_review(db, current_user.org_id, review_id)
    finding = _get_finding(db, current_user.org_id, finding_id)
    if finding.status in (FindingStatus.closed, FindingStatus.accepted_risk):
        raise HTTPException(409, "Closed findings cannot be modified")
    old_risk = finding.risk_rating
    for field, value in body.model_dump(exclude_none=True).items():
        setattr(finding, field, value)
    db.flush()
    if body.risk_rating and body.risk_rating != old_risk:
        _recount_findings(db, review)
    db.commit()
    db.refresh(finding)
    return _finding_dict(finding)


@router.post("/{review_id}/findings/{finding_id}/submit-response")
def submit_finding_response(
    review_id: str,
    finding_id: str,
    management_response: str,
    db: Session = Depends(get_db),
    current_user=Depends(require_roles(UserRole.compliance)),
):
    _get_review(db, current_user.org_id, review_id)
    finding = _get_finding(db, current_user.org_id, finding_id)
    if finding.status not in (FindingStatus.open, FindingStatus.overdue):
        raise HTTPException(
            422, f"Cannot submit response for finding in status '{finding.status}'"
        )
    finding.management_response = management_response
    finding.response_submitted_at = datetime.now(timezone.utc)
    finding.response_submitted_by = current_user.id
    finding.status = FindingStatus.response_submitted
    db.commit()
    db.refresh(finding)
    return _finding_dict(finding)


@router.post("/{review_id}/findings/{finding_id}/start-remediation")
def start_finding_remediation(
    review_id: str,
    finding_id: str,
    db: Session = Depends(get_db),
    current_user=Depends(require_roles(UserRole.compliance)),
):
    _get_review(db, current_user.org_id, review_id)
    finding = _get_finding(db, current_user.org_id, finding_id)
    if finding.status != FindingStatus.response_submitted:
        raise HTTPException(
            422,
            f"Finding must be in 'response_submitted' status, not '{finding.status}'",
        )
    finding.status = FindingStatus.in_remediation
    db.commit()
    db.refresh(finding)
    return _finding_dict(finding)


@router.post("/{review_id}/findings/{finding_id}/close")
def close_finding(
    review_id: str,
    finding_id: str,
    closure_evidence: str,
    db: Session = Depends(get_db),
    current_user=Depends(require_roles(UserRole.compliance)),
):
    _get_review(db, current_user.org_id, review_id)
    finding = _get_finding(db, current_user.org_id, finding_id)
    if finding.status not in (
        FindingStatus.in_remediation,
        FindingStatus.response_submitted,
    ):
        raise HTTPException(422, f"Cannot close finding from status '{finding.status}'")
    finding.status = FindingStatus.closed
    finding.closed_at = datetime.now(timezone.utc)
    finding.closed_by = current_user.id
    finding.closure_evidence = closure_evidence
    db.commit()
    db.refresh(finding)
    log.info("finding.closed org=%s ref=%s", current_user.org_id, finding.finding_ref)
    return _finding_dict(finding)


@router.post("/{review_id}/findings/{finding_id}/accept-risk")
def accept_finding_risk(
    review_id: str,
    finding_id: str,
    rationale: str,
    db: Session = Depends(get_db),
    current_user=Depends(require_roles(UserRole.mlro)),
):
    """MLRO formally accepts residual risk rather than remediating the finding."""
    _get_review(db, current_user.org_id, review_id)
    finding = _get_finding(db, current_user.org_id, finding_id)
    if finding.status in (FindingStatus.closed, FindingStatus.accepted_risk):
        raise HTTPException(409, "Finding already closed")
    finding.status = FindingStatus.accepted_risk
    finding.closed_at = datetime.now(timezone.utc)
    finding.closed_by = current_user.id
    finding.closure_evidence = f"[RISK ACCEPTED] {rationale}"
    db.commit()
    db.refresh(finding)
    return _finding_dict(finding)


# ── RECOMMENDATIONS ───────────────────────────────────────────────────────────


@router.post("/{review_id}/findings/{finding_id}/recommendations", status_code=201)
def create_recommendation(
    review_id: str,
    finding_id: str,
    body: RecommendationCreate,
    db: Session = Depends(get_db),
    current_user=Depends(require_roles(UserRole.compliance)),
):
    _get_review(db, current_user.org_id, review_id)
    finding = _get_finding(db, current_user.org_id, finding_id)
    if finding.status in (FindingStatus.closed, FindingStatus.accepted_risk):
        raise HTTPException(409, "Cannot add recommendations to a closed finding")

    if (
        db.query(ReviewRecommendation)
        .filter_by(
            org_id=current_user.org_id, recommendation_ref=body.recommendation_ref
        )
        .first()
    ):
        raise HTTPException(
            409, f"Recommendation ref '{body.recommendation_ref}' already exists"
        )

    rec = ReviewRecommendation(
        recommendation_ref=body.recommendation_ref,
        finding_id=finding_id,
        review_id=review_id,
        org_id=current_user.org_id,
        description=body.description,
        priority=body.priority,
        target_date=body.target_date,
        created_by=current_user.id,
    )
    db.add(rec)
    db.commit()
    db.refresh(rec)
    log.info(
        "recommendation.created org=%s ref=%s",
        current_user.org_id,
        rec.recommendation_ref,
    )
    return _rec_dict(rec)


@router.get("/{review_id}/findings/{finding_id}/recommendations")
def list_recommendations(
    review_id: str,
    finding_id: str,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
):
    _get_review(db, current_user.org_id, review_id)
    _get_finding(db, current_user.org_id, finding_id)
    items = (
        db.query(ReviewRecommendation)
        .filter_by(finding_id=finding_id, org_id=current_user.org_id)
        .all()
    )
    return {"total": len(items), "items": [_rec_dict(r) for r in items]}


@router.patch("/{review_id}/findings/{finding_id}/recommendations/{rec_id}")
def update_recommendation(
    review_id: str,
    finding_id: str,
    rec_id: str,
    body: RecommendationUpdate,
    db: Session = Depends(get_db),
    current_user=Depends(require_roles(UserRole.compliance)),
):
    _get_review(db, current_user.org_id, review_id)
    _get_finding(db, current_user.org_id, finding_id)
    rec = _get_recommendation(db, current_user.org_id, rec_id)
    if rec.status == RecommendationStatus.completed:
        raise HTTPException(409, "Completed recommendations cannot be modified")
    for field, value in body.model_dump(exclude_none=True).items():
        setattr(rec, field, value)
    db.commit()
    db.refresh(rec)
    return _rec_dict(rec)


@router.post("/{review_id}/findings/{finding_id}/recommendations/{rec_id}/accept")
def accept_recommendation(
    review_id: str,
    finding_id: str,
    rec_id: str,
    db: Session = Depends(get_db),
    current_user=Depends(require_roles(UserRole.compliance)),
):
    _get_review(db, current_user.org_id, review_id)
    _get_finding(db, current_user.org_id, finding_id)
    rec = _get_recommendation(db, current_user.org_id, rec_id)
    if rec.status != RecommendationStatus.open:
        raise HTTPException(
            422, f"Recommendation must be 'open' to accept, not '{rec.status}'"
        )
    rec.status = RecommendationStatus.accepted
    rec.accepted_by = current_user.id
    rec.accepted_at = datetime.now(timezone.utc)
    db.commit()
    db.refresh(rec)
    return _rec_dict(rec)


@router.post("/{review_id}/findings/{finding_id}/recommendations/{rec_id}/reject")
def reject_recommendation(
    review_id: str,
    finding_id: str,
    rec_id: str,
    rejection_reason: str,
    db: Session = Depends(get_db),
    current_user=Depends(require_roles(UserRole.mlro)),
):
    """MLRO rejects / disputes a recommendation (entity accepts residual risk)."""
    _get_review(db, current_user.org_id, review_id)
    _get_finding(db, current_user.org_id, finding_id)
    rec = _get_recommendation(db, current_user.org_id, rec_id)
    if rec.status not in (RecommendationStatus.open, RecommendationStatus.accepted):
        raise HTTPException(
            422, f"Cannot reject recommendation in status '{rec.status}'"
        )
    rec.status = RecommendationStatus.rejected
    rec.accepted_by = current_user.id
    rec.accepted_at = datetime.now(timezone.utc)
    rec.rejection_reason = rejection_reason
    db.commit()
    db.refresh(rec)
    return _rec_dict(rec)


@router.post("/{review_id}/findings/{finding_id}/recommendations/{rec_id}/complete")
def complete_recommendation(
    review_id: str,
    finding_id: str,
    rec_id: str,
    db: Session = Depends(get_db),
    current_user=Depends(require_roles(UserRole.compliance)),
):
    _get_review(db, current_user.org_id, review_id)
    _get_finding(db, current_user.org_id, finding_id)
    rec = _get_recommendation(db, current_user.org_id, rec_id)
    if rec.status not in (
        RecommendationStatus.accepted,
        RecommendationStatus.in_progress,
    ):
        raise HTTPException(
            422, f"Cannot complete recommendation in status '{rec.status}'"
        )
    rec.status = RecommendationStatus.completed
    db.commit()
    db.refresh(rec)
    return _rec_dict(rec)


# ── ACTIONS ───────────────────────────────────────────────────────────────────


@router.post(
    "/{review_id}/findings/{finding_id}/recommendations/{rec_id}/actions",
    status_code=201,
)
def create_action(
    review_id: str,
    finding_id: str,
    rec_id: str,
    body: ActionCreate,
    db: Session = Depends(get_db),
    current_user=Depends(require_roles(UserRole.compliance)),
):
    _get_review(db, current_user.org_id, review_id)
    _get_finding(db, current_user.org_id, finding_id)
    rec = _get_recommendation(db, current_user.org_id, rec_id)
    if rec.status == RecommendationStatus.rejected:
        raise HTTPException(409, "Cannot create actions for a rejected recommendation")

    if (
        db.query(ReviewAction)
        .filter_by(org_id=current_user.org_id, action_ref=body.action_ref)
        .first()
    ):
        raise HTTPException(409, f"Action ref '{body.action_ref}' already exists")

    action = ReviewAction(
        action_ref=body.action_ref,
        recommendation_id=rec_id,
        finding_id=finding_id,
        review_id=review_id,
        org_id=current_user.org_id,
        title=body.title,
        description=body.description,
        action_type=body.action_type,
        due_date=body.due_date,
        assigned_to=body.assigned_to,
        assigned_by=current_user.id if body.assigned_to else None,
        assigned_at=datetime.now(timezone.utc) if body.assigned_to else None,
        created_by=current_user.id,
    )
    db.add(action)
    # If recommendation was accepted, move it to in_progress
    if rec.status == RecommendationStatus.accepted:
        rec.status = RecommendationStatus.in_progress
    db.commit()
    db.refresh(action)
    log.info("action.created org=%s ref=%s", current_user.org_id, action.action_ref)
    return _action_dict(action)


@router.get("/{review_id}/findings/{finding_id}/recommendations/{rec_id}/actions")
def list_actions(
    review_id: str,
    finding_id: str,
    rec_id: str,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
):
    _get_review(db, current_user.org_id, review_id)
    items = (
        db.query(ReviewAction)
        .filter_by(recommendation_id=rec_id, org_id=current_user.org_id)
        .all()
    )
    return {"total": len(items), "items": [_action_dict(a) for a in items]}


@router.patch(
    "/{review_id}/findings/{finding_id}/recommendations/{rec_id}/actions/{action_id}"
)
def update_action(
    review_id: str,
    finding_id: str,
    rec_id: str,
    action_id: str,
    body: ActionUpdate,
    db: Session = Depends(get_db),
    current_user=Depends(require_roles(UserRole.compliance)),
):
    _get_review(db, current_user.org_id, review_id)
    action = _get_action(db, current_user.org_id, action_id)
    if action.status in (ActionStatus.verified, ActionStatus.cancelled):
        raise HTTPException(
            409, f"Actions in '{action.status}' status cannot be modified"
        )
    for field, value in body.model_dump(exclude_none=True).items():
        setattr(action, field, value)
    db.commit()
    db.refresh(action)
    return _action_dict(action)


@router.post(
    "/{review_id}/findings/{finding_id}/recommendations/{rec_id}/actions/{action_id}/start"
)
def start_action(
    review_id: str,
    finding_id: str,
    rec_id: str,
    action_id: str,
    db: Session = Depends(get_db),
    current_user=Depends(require_roles(UserRole.compliance)),
):
    _get_review(db, current_user.org_id, review_id)
    action = _get_action(db, current_user.org_id, action_id)
    if action.status != ActionStatus.planned:
        raise HTTPException(
            422, f"Action must be 'planned' to start, not '{action.status}'"
        )
    action.status = ActionStatus.in_progress
    db.commit()
    db.refresh(action)
    return _action_dict(action)


@router.post(
    "/{review_id}/findings/{finding_id}/recommendations/{rec_id}/actions/{action_id}/complete"
)
def complete_action(
    review_id: str,
    finding_id: str,
    rec_id: str,
    action_id: str,
    completion_evidence: str,
    db: Session = Depends(get_db),
    current_user=Depends(require_roles(UserRole.compliance)),
):
    _get_review(db, current_user.org_id, review_id)
    action = _get_action(db, current_user.org_id, action_id)
    if action.status not in (
        ActionStatus.in_progress,
        ActionStatus.planned,
        ActionStatus.overdue,
    ):
        raise HTTPException(422, f"Cannot complete action in status '{action.status}'")
    if not completion_evidence:
        raise HTTPException(422, "completion_evidence is required")
    action.status = ActionStatus.completed
    action.completion_evidence = completion_evidence
    action.completed_by = current_user.id
    action.completed_at = datetime.now(timezone.utc)
    db.commit()
    db.refresh(action)
    log.info("action.completed org=%s ref=%s", current_user.org_id, action.action_ref)
    return _action_dict(action)


@router.post(
    "/{review_id}/findings/{finding_id}/recommendations/{rec_id}/actions/{action_id}/verify"
)
def verify_action(
    review_id: str,
    finding_id: str,
    rec_id: str,
    action_id: str,
    verified_notes: Optional[str] = None,
    db: Session = Depends(get_db),
    current_user=Depends(require_roles(UserRole.compliance)),
):
    """Compliance officer sign-off that the action is genuinely complete."""
    _get_review(db, current_user.org_id, review_id)
    action = _get_action(db, current_user.org_id, action_id)
    if action.status != ActionStatus.completed:
        raise HTTPException(422, "Action must be 'completed' before it can be verified")
    if action.completed_by == current_user.id:
        raise HTTPException(
            422,
            "The verifier cannot be the same person who completed the action (four-eyes principle)",
        )
    action.status = ActionStatus.verified
    action.verified_by = current_user.id
    action.verified_at = datetime.now(timezone.utc)
    action.verified_notes = verified_notes
    db.commit()
    db.refresh(action)
    log.info(
        "action.verified org=%s ref=%s by=%s",
        current_user.org_id,
        action.action_ref,
        current_user.id,
    )
    return _action_dict(action)


@router.post(
    "/{review_id}/findings/{finding_id}/recommendations/{rec_id}/actions/{action_id}/cancel"
)
def cancel_action(
    review_id: str,
    finding_id: str,
    rec_id: str,
    action_id: str,
    cancellation_reason: str,
    db: Session = Depends(get_db),
    current_user=Depends(require_roles(UserRole.mlro)),
):
    _get_review(db, current_user.org_id, review_id)
    action = _get_action(db, current_user.org_id, action_id)
    if action.status in (ActionStatus.verified, ActionStatus.cancelled):
        raise HTTPException(409, f"Action already in '{action.status}' status")
    action.status = ActionStatus.cancelled
    action.cancelled_by = current_user.id
    action.cancelled_at = datetime.now(timezone.utc)
    action.cancellation_reason = cancellation_reason
    db.commit()
    db.refresh(action)
    return _action_dict(action)


# ── DASHBOARD / SUMMARY ───────────────────────────────────────────────────────


@router.get("/{review_id}/dashboard")
def review_dashboard(
    review_id: str,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
):
    """Summary view: finding counts, open recommendations, overdue actions."""
    review = _get_review(db, current_user.org_id, review_id)

    findings = db.query(ReviewFinding).filter_by(review_id=review_id).all()
    recommendations = (
        db.query(ReviewRecommendation).filter_by(review_id=review_id).all()
    )
    actions = db.query(ReviewAction).filter_by(review_id=review_id).all()

    today = date.today()

    def _overdue_action(a: ReviewAction) -> bool:
        return (
            a.due_date
            and a.due_date < today
            and a.status
            not in (
                ActionStatus.completed,
                ActionStatus.verified,
                ActionStatus.cancelled,
            )
        )

    return {
        "review": {
            "id": review.id,
            "review_ref": review.review_ref,
            "status": review.status,
            "overall_rating": review.overall_rating,
            "board_acknowledged": review.board_acknowledged,
        },
        "findings": {
            "total": len(findings),
            "by_risk": {
                "critical": sum(1 for f in findings if f.risk_rating == "critical"),
                "high": sum(1 for f in findings if f.risk_rating == "high"),
                "medium": sum(1 for f in findings if f.risk_rating == "medium"),
                "low": sum(1 for f in findings if f.risk_rating == "low"),
            },
            "by_status": {
                "open": sum(1 for f in findings if f.status == FindingStatus.open),
                "response_submitted": sum(
                    1 for f in findings if f.status == FindingStatus.response_submitted
                ),
                "in_remediation": sum(
                    1 for f in findings if f.status == FindingStatus.in_remediation
                ),
                "closed": sum(1 for f in findings if f.status == FindingStatus.closed),
                "overdue": sum(
                    1 for f in findings if f.status == FindingStatus.overdue
                ),
                "accepted_risk": sum(
                    1 for f in findings if f.status == FindingStatus.accepted_risk
                ),
            },
            "overdue": [
                _finding_dict(f)
                for f in findings
                if f.status == FindingStatus.overdue
                or (
                    f.response_due_date
                    and f.response_due_date < today
                    and f.status
                    not in (FindingStatus.closed, FindingStatus.accepted_risk)
                )
            ],
        },
        "recommendations": {
            "total": len(recommendations),
            "open": sum(
                1 for r in recommendations if r.status == RecommendationStatus.open
            ),
            "accepted": sum(
                1 for r in recommendations if r.status == RecommendationStatus.accepted
            ),
            "in_progress": sum(
                1
                for r in recommendations
                if r.status == RecommendationStatus.in_progress
            ),
            "completed": sum(
                1 for r in recommendations if r.status == RecommendationStatus.completed
            ),
            "rejected": sum(
                1 for r in recommendations if r.status == RecommendationStatus.rejected
            ),
            "overdue": [
                _rec_dict(r)
                for r in recommendations
                if r.target_date
                and r.target_date < today
                and r.status
                not in (RecommendationStatus.completed, RecommendationStatus.rejected)
            ],
        },
        "actions": {
            "total": len(actions),
            "planned": sum(1 for a in actions if a.status == ActionStatus.planned),
            "in_progress": sum(
                1 for a in actions if a.status == ActionStatus.in_progress
            ),
            "completed": sum(1 for a in actions if a.status == ActionStatus.completed),
            "verified": sum(1 for a in actions if a.status == ActionStatus.verified),
            "overdue": [_action_dict(a) for a in actions if _overdue_action(a)],
        },
        "disclaimer": (
            "This module provides workflow tooling only. "
            "All compliance decisions remain with the reporting entity."
        ),
    }


@router.get("/org-dashboard")
def org_dashboard(
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
):
    """Cross-review dashboard: all open findings and overdue actions for this org."""
    today = date.today()
    open_findings = (
        db.query(ReviewFinding)
        .filter(
            ReviewFinding.org_id == current_user.org_id,
            ReviewFinding.status.notin_(
                [FindingStatus.closed, FindingStatus.accepted_risk]
            ),
        )
        .order_by(ReviewFinding.risk_rating.desc())
        .all()
    )
    overdue_actions = (
        db.query(ReviewAction)
        .filter(
            ReviewAction.org_id == current_user.org_id,
            ReviewAction.due_date < today,
            ReviewAction.status.notin_(
                [ActionStatus.completed, ActionStatus.verified, ActionStatus.cancelled]
            ),
        )
        .all()
    )
    pending_verification = (
        db.query(ReviewAction)
        .filter_by(org_id=current_user.org_id, status=ActionStatus.completed)
        .all()
    )
    return {
        "open_findings": len(open_findings),
        "open_findings_by_risk": {
            "critical": sum(1 for f in open_findings if f.risk_rating == "critical"),
            "high": sum(1 for f in open_findings if f.risk_rating == "high"),
            "medium": sum(1 for f in open_findings if f.risk_rating == "medium"),
            "low": sum(1 for f in open_findings if f.risk_rating == "low"),
        },
        "overdue_actions": len(overdue_actions),
        "pending_verification": len(pending_verification),
        "overdue_action_list": [_action_dict(a) for a in overdue_actions[:20]],
        "disclaimer": (
            "This module provides workflow tooling only. "
            "All compliance decisions remain with the reporting entity."
        ),
    }
