"""
Org Monitoring Configuration and Pre-Approval Question Management.

Endpoints:
  GET  /org/monitoring-config          — get current weight settings
  PATCH /org/monitoring-config         — update weights (compliance+)
  GET  /org/approval-questions         — list active questions
  POST /org/approval-questions         — create question (max 5, compliance+)
  PATCH /org/approval-questions/{id}   — update question text/order (compliance+)
  DELETE /org/approval-questions/{id}  — deactivate question (compliance+)

DISCLAIMER: Configuration supports the compliance workflow only.
All regulatory decisions remain with the reporting entity.
"""

from typing import Optional
from uuid import uuid4

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session

from app.api.deps import org_id_for, require_compliance_or_above
from app.db.database import get_db
from app.models.risk_matrix import OrgApprovalQuestion, OrgMonitoringConfig, QuestionContext
from app.models.user import User

router = APIRouter(prefix="/org", tags=["Org Config"])

DISCLAIMER = (
    "Monitoring configuration supports the compliance workflow only. "
    "All regulatory decisions remain with the reporting entity."
)

MAX_APPROVAL_QUESTIONS = 5
MIN_APPROVAL_QUESTIONS = 3


# ── Schemas ───────────────────────────────────────────────────────────────────


class MonitoringConfigUpdate(BaseModel):
    # Alert score weights — must sum to 1.0 if all provided
    behaviour_weight: Optional[float] = Field(None, ge=0.0, le=1.0)
    rule_weight: Optional[float] = Field(None, ge=0.0, le=1.0)
    customer_risk_weight: Optional[float] = Field(None, ge=0.0, le=1.0)
    risk_matrix_weight: Optional[float] = Field(None, ge=0.0, le=1.0)

    # Custom question weight (0% – 40% of final approval score)
    custom_question_weight: Optional[float] = Field(None, ge=0.0, le=0.40)

    # Risk matrix dimension weights — must sum to 1.0 if all provided
    matrix_customer_weight: Optional[float] = Field(None, ge=0.0, le=1.0)
    matrix_geographic_weight: Optional[float] = Field(None, ge=0.0, le=1.0)
    matrix_product_weight: Optional[float] = Field(None, ge=0.0, le=1.0)
    matrix_transaction_weight: Optional[float] = Field(None, ge=0.0, le=1.0)


class ApprovalQuestionCreate(BaseModel):
    question_text: str = Field(..., min_length=10, max_length=500)
    question_order: int = Field(default=1, ge=1, le=5)
    is_required: bool = True
    industry_context: Optional[str] = Field(None, max_length=200)
    help_text: Optional[str] = Field(None, max_length=500)
    context: QuestionContext = QuestionContext.transaction


class ApprovalQuestionUpdate(BaseModel):
    question_text: Optional[str] = Field(None, min_length=10, max_length=500)
    question_order: Optional[int] = Field(None, ge=1, le=5)
    is_required: Optional[bool] = None
    industry_context: Optional[str] = Field(None, max_length=200)
    help_text: Optional[str] = Field(None, max_length=500)


# ── Helpers ───────────────────────────────────────────────────────────────────


def _get_or_create_config(org_id: str, db: Session) -> OrgMonitoringConfig:
    config = (
        db.query(OrgMonitoringConfig)
        .filter(OrgMonitoringConfig.org_id == org_id)
        .first()
    )
    if not config:
        config = OrgMonitoringConfig(
            id=f"omc_{uuid4().hex[:10]}",
            org_id=org_id,
        )
        db.add(config)
        db.commit()
        db.refresh(config)
    return config


def _config_dict(c: OrgMonitoringConfig) -> dict:
    return {
        "org_id": c.org_id,
        "alert_score_weights": {
            "behaviour": c.behaviour_weight,
            "rule": c.rule_weight,
            "customer_risk": c.customer_risk_weight,
            "risk_matrix": c.risk_matrix_weight,
            "total": round(
                (c.behaviour_weight or 0)
                + (c.rule_weight or 0)
                + (c.customer_risk_weight or 0)
                + (c.risk_matrix_weight or 0),
                4,
            ),
        },
        "custom_question_weight": c.custom_question_weight,
        "risk_matrix_dimension_weights": {
            "customer": c.matrix_customer_weight,
            "geographic": c.matrix_geographic_weight,
            "product": c.matrix_product_weight,
            "transaction": c.matrix_transaction_weight,
            "total": round(
                (c.matrix_customer_weight or 0)
                + (c.matrix_geographic_weight or 0)
                + (c.matrix_product_weight or 0)
                + (c.matrix_transaction_weight or 0),
                4,
            ),
        },
        "updated_at": c.updated_at,
        "disclaimer": DISCLAIMER,
    }


def _question_dict(q: OrgApprovalQuestion) -> dict:
    return {
        "id": q.id,
        "question_text": q.question_text,
        "question_order": q.question_order,
        "is_required": q.is_required,
        "is_active": q.is_active,
        "industry_context": q.industry_context,
        "help_text": q.help_text,
        "context": q.context.value if q.context else "transaction",
        "compliant_answer": q.compliant_answer.value if q.compliant_answer else "yes",
        "created_by": q.created_by,
        "created_at": q.created_at,
        "updated_at": q.updated_at,
    }


# ── Monitoring Config Endpoints ───────────────────────────────────────────────


@router.get("/monitoring-config")
def get_monitoring_config(
    db: Session = Depends(get_db),
    current_user: User = Depends(require_compliance_or_above),
):
    """
    Return the current monitoring weight configuration for this org.
    Weights are used to calculate alert scores and the final approval score.
    """
    org_id = org_id_for(current_user)
    config = _get_or_create_config(org_id, db)
    return _config_dict(config)


@router.patch("/monitoring-config")
def update_monitoring_config(
    payload: MonitoringConfigUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_compliance_or_above),
):
    """
    Update monitoring weight configuration.

    Alert score weights (behaviour + rule + customer_risk + risk_matrix) should sum to 1.0.
    Risk matrix dimension weights (customer + geographic + product + transaction) should sum to 1.0.
    Custom question weight controls how much pre-approval questions affect the final score (0–40%).

    Weights are validated to sum to 1.0 ± 0.01 when all four are provided.
    """
    org_id = org_id_for(current_user)
    config = _get_or_create_config(org_id, db)

    updates = payload.model_dump(exclude_none=True)

    # Validate alert score weights sum if all four present
    alert_keys = {
        "behaviour_weight",
        "rule_weight",
        "customer_risk_weight",
        "risk_matrix_weight",
    }
    provided_alert = {k: updates[k] for k in alert_keys if k in updates}
    if len(provided_alert) == 4:
        total = sum(provided_alert.values())
        if abs(total - 1.0) > 0.01:
            raise HTTPException(
                status_code=422,
                detail=f"Alert score weights must sum to 1.0 (got {total:.4f}).",
            )

    # Validate matrix dimension weights sum if all four present
    matrix_keys = {
        "matrix_customer_weight",
        "matrix_geographic_weight",
        "matrix_product_weight",
        "matrix_transaction_weight",
    }
    provided_matrix = {k: updates[k] for k in matrix_keys if k in updates}
    if len(provided_matrix) == 4:
        total = sum(provided_matrix.values())
        if abs(total - 1.0) > 0.01:
            raise HTTPException(
                status_code=422,
                detail=f"Risk matrix dimension weights must sum to 1.0 (got {total:.4f}).",
            )

    for k, v in updates.items():
        setattr(config, k, v)
    config.updated_by = current_user.id

    db.commit()
    db.refresh(config)
    return _config_dict(config)


# ── Approval Question Endpoints ───────────────────────────────────────────────


@router.get("/approval-questions")
def list_approval_questions(
    context: Optional[QuestionContext] = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_compliance_or_above),
):
    """
    List the org's pre-approval checklist questions, ordered by question_order.

    These questions are presented to the compliance officer when reviewing an
    alert, approving a transaction, or approving a customer/onboarding record
    (depending on `context`). Answers contribute custom_question_weight
    percent of the final approval score. Pass `context=transaction` or
    `context=customer` to filter to one workflow; omit to list both.
    """
    org_id = org_id_for(current_user)
    filters = [
        OrgApprovalQuestion.org_id == org_id,
        OrgApprovalQuestion.is_active == True,
    ]
    if context is not None:
        filters.append(OrgApprovalQuestion.context == context)
    questions = (
        db.query(OrgApprovalQuestion)
        .filter(*filters)
        .order_by(OrgApprovalQuestion.question_order)
        .all()
    )
    config = _get_or_create_config(org_id, db)
    return {
        "question_count": len(questions),
        "custom_question_weight": config.custom_question_weight,
        "questions": [_question_dict(q) for q in questions],
        "guidance": (
            f"You may configure {MIN_APPROVAL_QUESTIONS}–{MAX_APPROVAL_QUESTIONS} "
            "questions. These are answered by the compliance officer before approving "
            f"any transaction. Questions contribute {config.custom_question_weight * 100:.0f}% "
            "of the final approval score (adjustable via PATCH /org/monitoring-config)."
        ),
        "disclaimer": DISCLAIMER,
    }


@router.post("/approval-questions", status_code=201)
def create_approval_question(
    payload: ApprovalQuestionCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_compliance_or_above),
):
    """
    Add a pre-approval checklist question (maximum 5 per org).

    Questions should be yes/no prompts relevant to your industry's AML/CTF
    obligations. A "yes" answer is treated as compliant (lower risk);
    a "no" answer flags a concern that increases the approval risk score.

    Examples:
      - "Have you verified the source of funds for this transaction?"
      - "Is the counterparty a known business contact on file?"
      - "Does this transaction align with the customer's declared business purpose?"
    """
    org_id = org_id_for(current_user)

    active_count = (
        db.query(OrgApprovalQuestion)
        .filter(
            OrgApprovalQuestion.org_id == org_id,
            OrgApprovalQuestion.is_active == True,
            OrgApprovalQuestion.context == payload.context,
        )
        .count()
    )
    if active_count >= MAX_APPROVAL_QUESTIONS:
        raise HTTPException(
            status_code=409,
            detail=f"Maximum of {MAX_APPROVAL_QUESTIONS} active {payload.context.value} "
            "questions allowed. Deactivate an existing question before adding a new one.",
        )

    q = OrgApprovalQuestion(
        id=f"oaq_{uuid4().hex[:10]}",
        org_id=org_id,
        created_by=current_user.id,
        **payload.model_dump(),
    )
    db.add(q)
    db.commit()
    db.refresh(q)
    return _question_dict(q)


@router.patch("/approval-questions/{question_id}")
def update_approval_question(
    question_id: str,
    payload: ApprovalQuestionUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_compliance_or_above),
):
    """Update an existing approval question's text, order, or metadata."""
    org_id = org_id_for(current_user)
    q = (
        db.query(OrgApprovalQuestion)
        .filter(
            OrgApprovalQuestion.id == question_id,
            OrgApprovalQuestion.org_id == org_id,
        )
        .first()
    )
    if not q:
        raise HTTPException(404, "Question not found.")
    if not q.is_active:
        raise HTTPException(
            409, "Cannot update a deactivated question. Reactivate it first."
        )

    for k, v in payload.model_dump(exclude_none=True).items():
        setattr(q, k, v)
    db.commit()
    db.refresh(q)
    return _question_dict(q)


@router.delete("/approval-questions/{question_id}", status_code=204)
def deactivate_approval_question(
    question_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_compliance_or_above),
):
    """
    Deactivate a pre-approval question (soft delete — historical answers preserved).
    The question will no longer be presented for new transactions.
    """
    org_id = org_id_for(current_user)
    q = (
        db.query(OrgApprovalQuestion)
        .filter(
            OrgApprovalQuestion.id == question_id,
            OrgApprovalQuestion.org_id == org_id,
        )
        .first()
    )
    if not q:
        raise HTTPException(404, "Question not found.")

    active_count = (
        db.query(OrgApprovalQuestion)
        .filter(
            OrgApprovalQuestion.org_id == org_id,
            OrgApprovalQuestion.is_active == True,
            OrgApprovalQuestion.id != question_id,
        )
        .count()
    )
    if active_count < MIN_APPROVAL_QUESTIONS:
        raise HTTPException(
            status_code=409,
            detail=f"Cannot deactivate: minimum of {MIN_APPROVAL_QUESTIONS} questions required. "
            "Add a replacement question first.",
        )

    q.is_active = False
    db.commit()
