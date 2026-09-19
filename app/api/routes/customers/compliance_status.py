"""
Customers — onboarding checklist, risk score history/rescoring, and the
pre-approval question checklist. Part of the customers route package; see
__init__.py for the combined router.
"""

from datetime import datetime, timezone
from typing import Any, List, Optional
from uuid import uuid4

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session

from app.api.deps import (
    org_id_for,
    require_analyst_or_above,
    require_compliance_or_above,
)
from app.db.database import get_db
from app.models.customer import (
    CustomerOnboardingChecklist,
    CustomerRiskScoreHistory,
    RiskLevel,
)
from app.models.risk_matrix import (
    CustomerQuestionResponse,
    OrgApprovalQuestion,
    OrgMonitoringConfig,
    QuestionContext,
)
from app.models.user import User
from app.schemas.customer import OnboardingChecklistResponse, RiskScoreHistoryResponse
from app.schemas.risk_matrix import CustomerAnswerQuestionsRequest
from app.services import audit_service
from app.services.customer_risk_engine import (
    assess_customer_risk,
    get_org_risk_weights,
    risk_level_from_score,
)
from app.services.risk_matrix_service import compute_question_score

from ._shared import _get_customer, _record_risk_history

router = APIRouter()


# ── Onboarding Checklist ───────────────────────────────────────────────────────


@router.get(
    "/{customer_id}/onboarding-checklist", response_model=OnboardingChecklistResponse
)
def get_onboarding_checklist(
    customer_id: str,
    current_user: User = Depends(require_analyst_or_above),
    db: Session = Depends(get_db),
):
    _get_customer(customer_id, org_id_for(current_user), db)
    chk = (
        db.query(CustomerOnboardingChecklist)
        .filter(CustomerOnboardingChecklist.customer_id == customer_id)
        .first()
    )
    if not chk:
        raise HTTPException(404, "Onboarding checklist not found")
    return chk


# ── Risk Score History ─────────────────────────────────────────────────────────


@router.get(
    "/{customer_id}/risk-history", response_model=List[RiskScoreHistoryResponse]
)
def get_risk_score_history(
    customer_id: str,
    current_user: User = Depends(require_analyst_or_above),
    db: Session = Depends(get_db),
):
    _get_customer(customer_id, org_id_for(current_user), db)
    return (
        db.query(CustomerRiskScoreHistory)
        .filter(CustomerRiskScoreHistory.customer_id == customer_id)
        .order_by(CustomerRiskScoreHistory.scored_at.desc())
        .all()
    )


@router.post("/{customer_id}/rescore")
def rescore_customer(
    customer_id: str,
    likelihood: Optional[int] = Query(
        None, ge=1, le=5, description="Optional: record inherent/residual breakdown"
    ),
    consequence: Optional[int] = Query(None, ge=1, le=5),
    control_effectiveness: Optional[int] = Query(None, ge=1, le=5),
    current_user: User = Depends(require_compliance_or_above),
    db: Session = Depends(get_db),
):
    """Re-run risk scoring via the full 5-dimension customer risk engine."""
    customer = _get_customer(customer_id, org_id_for(current_user), db)
    before: dict[str, Any] = {
        "risk_score": customer.risk_score,
        "risk_level": customer.risk_level,
    }

    result = assess_customer_risk(
        customer,
        is_pep=customer.is_pep,
        is_sanctions_match=customer.is_sanctions_match,
        weights=get_org_risk_weights(db, org_id_for(current_user)),
    )
    score = result.overall_score
    factors = {
        "customer": result.customer_risk.score,
        "product": result.product_risk.score,
        "geographic": result.geographic_risk.score,
        "channel": result.channel_risk.score,
        "transaction": result.transaction_risk.score,
    }
    base_level = risk_level_from_score(score)

    # Checklist completion may nudge the score down by a small, capped amount
    # (never enough to flip an above-low rating to Low on its own — that
    # decision stays with the compliance reviewer, not the checklist).
    responses = (
        db.query(CustomerQuestionResponse)
        .filter(CustomerQuestionResponse.customer_id == customer_id)
        .all()
    )
    question_score = compute_question_score(responses) if responses else None
    if question_score is not None:
        config = (
            db.query(OrgMonitoringConfig)
            .filter(OrgMonitoringConfig.org_id == customer.org_id)
            .first()
        )
        q_weight = getattr(config, "custom_question_weight", 0.20) if config else 0.20
        q_weight = max(0.0, min(q_weight, 0.40))
        max_reduction = 10.0  # hard cap regardless of weight
        reduction = min(
            max_reduction, (question_score / 100.0) * max_reduction * q_weight / 0.40
        )
        score = max(0.0, score - reduction)

    level = risk_level_from_score(score)
    if base_level != RiskLevel.low and level == RiskLevel.low:
        # Checklist alone must never produce a Low Risk outcome.
        level = RiskLevel.medium

    customer.risk_score = score
    customer.risk_level = level

    _record_risk_history(
        customer,
        "manual_rescore",
        current_user.id,
        db,
        scoring_factors=factors,
        likelihood=likelihood,
        consequence=consequence,
        control_effectiveness=control_effectiveness,
    )
    audit_service.log_action(
        db,
        action="risk_matrix_changed",
        entity_type="customer",
        entity_id=customer.id,
        actor=current_user.email,
        actor_role=current_user.role.value if current_user.role else None,
        organisation_id=customer.org_id,
        before_state={
            "risk_score": before["risk_score"],
            "risk_level": before["risk_level"].value if before["risk_level"] else None,
        },
        after_state={"risk_score": score, "risk_level": level.value},
    )
    db.commit()

    return {"customer_id": customer_id, "risk_score": score, "risk_level": level.value}


# ── Pre-Approval Question Checklist (customer onboarding/EDD context) ──────────


@router.get("/{customer_id}/approval-checklist")
def get_customer_approval_checklist(
    customer_id: str,
    current_user: User = Depends(require_compliance_or_above),
    db: Session = Depends(get_db),
):
    """
    Return the org's customer/onboarding pre-approval checklist questions and
    any existing answers for this customer, plus the computed question score.

    Mirrors the transaction checklist at /transactions/{id}/approval-checklist,
    scoped to context=customer questions (see app.models.risk_matrix.QuestionContext).

    DISCLAIMER: Checklist results support the compliance workflow only.
    All regulatory decisions remain with the reporting entity.
    """
    org_id = org_id_for(current_user)
    customer = _get_customer(customer_id, org_id, db)

    questions = (
        db.query(OrgApprovalQuestion)
        .filter(
            OrgApprovalQuestion.org_id == org_id,
            OrgApprovalQuestion.is_active == True,
            OrgApprovalQuestion.context == QuestionContext.customer,
        )
        .order_by(OrgApprovalQuestion.question_order)
        .all()
    )

    responses = (
        db.query(CustomerQuestionResponse)
        .filter(
            CustomerQuestionResponse.customer_id == customer_id,
            CustomerQuestionResponse.org_id == org_id,
        )
        .all()
    )
    response_map = {r.question_id: r for r in responses}

    question_score = compute_question_score(responses) if responses else None

    items = []
    for q in questions:
        r = response_map.get(q.id)
        items.append(
            {
                "question_id": q.id,
                "question_order": q.question_order,
                "question_text": q.question_text,
                "help_text": q.help_text,
                "industry_context": q.industry_context,
                "is_required": q.is_required,
                "compliant_answer": q.compliant_answer.value
                if q.compliant_answer
                else "yes",
                "answer": r.answer.value if r else None,
                "notes": r.notes if r else None,
                "answered_by": r.answered_by if r else None,
                "answered_at": r.answered_at if r else None,
            }
        )

    return {
        "customer_id": customer_id,
        "questions_configured": len(questions),
        "questions_answered": len([i for i in items if i["answer"] is not None]),
        "checklist_complete": len(questions) > 0
        and all(i["answer"] is not None for i in items if i["is_required"]),
        "question_score": question_score,
        "questions": items,
        "disclaimer": (
            "Checklist results support the compliance workflow only. "
            "All regulatory decisions remain with the reporting entity."
        ),
    }


@router.post("/{customer_id}/answer-questions", status_code=200)
def answer_customer_approval_questions(
    customer_id: str,
    payload: CustomerAnswerQuestionsRequest,
    current_user: User = Depends(require_compliance_or_above),
    db: Session = Depends(get_db),
):
    """
    Submit or update answers to the customer pre-approval checklist questions.

    Each answer is upserted (existing answer updated if already submitted).
    Answers feed into a question_score; call POST /{customer_id}/rescore to
    apply the bounded, capped checklist adjustment to the customer's risk
    score (the checklist can never, by itself, produce a Low Risk outcome).

    DISCLAIMER: Answers are compliance workflow records only.
    """
    org_id = org_id_for(current_user)
    customer = _get_customer(customer_id, org_id, db)

    question_ids = [a.question_id for a in payload.answers]
    valid_questions = (
        db.query(OrgApprovalQuestion)
        .filter(
            OrgApprovalQuestion.id.in_(question_ids),
            OrgApprovalQuestion.org_id == org_id,
            OrgApprovalQuestion.is_active == True,
            OrgApprovalQuestion.context == QuestionContext.customer,
        )
        .all()
    )
    valid_ids = {q.id for q in valid_questions}
    invalid = [qid for qid in question_ids if qid not in valid_ids]
    if invalid:
        raise HTTPException(
            400, f"Unknown or inactive customer question IDs: {invalid}"
        )

    now = datetime.now(timezone.utc)
    saved = []
    for item in payload.answers:
        existing = (
            db.query(CustomerQuestionResponse)
            .filter(
                CustomerQuestionResponse.customer_id == customer_id,
                CustomerQuestionResponse.question_id == item.question_id,
            )
            .first()
        )
        if existing:
            existing.answer = item.answer
            existing.notes = item.notes
            existing.answered_by = current_user.id
            existing.answered_at = now
            saved.append(existing)
        else:
            r = CustomerQuestionResponse(
                id=f"cqr_{uuid4().hex[:10]}",
                customer_id=customer_id,
                question_id=item.question_id,
                org_id=org_id,
                answer=item.answer,
                notes=item.notes,
                answered_by=current_user.id,
                answered_at=now,
            )
            db.add(r)
            saved.append(r)

    db.flush()

    all_responses = (
        db.query(CustomerQuestionResponse)
        .filter(
            CustomerQuestionResponse.customer_id == customer_id,
            CustomerQuestionResponse.org_id == org_id,
        )
        .all()
    )
    question_score = compute_question_score(all_responses)

    db.commit()

    return {
        "customer_id": customer_id,
        "answers_submitted": len(saved),
        "question_score": question_score,
        "disclaimer": (
            "Answers are compliance workflow records only. "
            "All regulatory decisions remain with the reporting entity."
        ),
    }
