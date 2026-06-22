"""
Rule Builder & Decision Support Panel API — Phase 4.

Provides a no-code automation rule builder and pre-approval decision support.

Rule Builder:
  Events     — what triggers rule evaluation (customer created, transaction, alert, etc.)
  Conditions — field/operator/value groups (AND within group, OR across groups)
  Actions    — what happens when conditions match (create alert, escalate, notify, etc.)

Decision Support Panel:
  Aggregates all risk signals before a compliance officer approves/rejects.
  Shows: customer risk, transaction risk, triggered rules, reporting obligations,
  outstanding tasks, missing documents.

Approval Workflow:
  analyst_review → compliance_review → (mlro_review) → decision
  System NEVER automatically approves. All decisions require human action.

DISCLAIMER: The rule engine and decision support are compliance workflow tools.
All decisions remain with the reporting entity.
"""

from datetime import datetime, timezone
from typing import Optional
from uuid import uuid4

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session

from app.api.deps import (
    Pagination,
    org_id_for,
    require_analyst_or_above,
    require_compliance_or_above,
)
from app.db.database import get_db
from app.models.automation_rule import (
    ApprovalDecisionType,
    ApprovalStepType,
    ApprovalWorkflowStep,
    AutomationRule,
    AutomationRuleExecution,
    AutomationRuleStatus,
    DecisionSupportPanel,
    RuleActionType,
    RuleEventType,
)
from app.models.user import User

router = APIRouter(prefix="/rule-builder", tags=["Rule Builder"])

DISCLAIMER = (
    "Automation rules and decision support panels are compliance workflow tools. "
    "The system never automatically approves compliance decisions. "
    "All decisions remain with the reporting entity."
)


# ── Schemas ───────────────────────────────────────────────────────────────────


class ConditionSchema(BaseModel):
    field: str = Field(
        ..., description="Dot-notation field path e.g. 'customer.risk_level'"
    )
    operator: str = Field(
        ...,
        description="eq | ne | gt | lt | gte | lte | in | not_in | contains | is_true | is_false | between",
    )
    value: object = None
    value_label: Optional[str] = None


class ConditionGroupSchema(BaseModel):
    logic: str = Field(default="AND", description="AND (all must match within group)")
    description: Optional[str] = None
    conditions: list[ConditionSchema]


class ActionSchema(BaseModel):
    action_type: RuleActionType
    params: dict = Field(default_factory=dict)
    delay_minutes: int = Field(default=0, ge=0)
    description: Optional[str] = None


class RuleCreate(BaseModel):
    name: str = Field(..., min_length=3, max_length=255)
    description: Optional[str] = None
    event_type: RuleEventType
    condition_groups: list[ConditionGroupSchema] = Field(default_factory=list)
    actions: list[ActionSchema] = Field(..., min_length=1)
    priority: int = Field(default=100, ge=1, le=9999)
    applicable_industries: list[str] = Field(default_factory=list)
    tags: list[str] = Field(default_factory=list)


class RuleUpdate(BaseModel):
    name: Optional[str] = Field(None, max_length=255)
    description: Optional[str] = None
    status: Optional[AutomationRuleStatus] = None
    condition_groups: Optional[list[ConditionGroupSchema]] = None
    actions: Optional[list[ActionSchema]] = None
    priority: Optional[int] = Field(None, ge=1, le=9999)
    applicable_industries: Optional[list[str]] = None
    tags: Optional[list[str]] = None


class ApprovalDecision(BaseModel):
    decision: ApprovalDecisionType
    review_notes: str = Field(..., min_length=5)
    conditions: list[str] = Field(default_factory=list)


# ── Helpers ───────────────────────────────────────────────────────────────────


def _rule_ref(db: Session, org_id: str) -> str:
    count = db.query(AutomationRule).filter(AutomationRule.org_id == org_id).count()
    return f"AUTO-{count + 1:04d}"


def _rule_dict(r: AutomationRule) -> dict:
    return {
        "id": r.id,
        "rule_ref": r.rule_ref,
        "name": r.name,
        "description": r.description,
        "event_type": r.event_type.value,
        "status": r.status.value,
        "is_system": r.is_system,
        "priority": r.priority,
        "condition_groups": r.condition_groups or [],
        "actions": r.actions or [],
        "applicable_industries": r.applicable_industries or [],
        "tags": r.tags or [],
        "trigger_count": r.trigger_count or 0,
        "last_triggered_at": r.last_triggered_at,
        "last_executed_at": r.last_executed_at,
        "created_by": r.created_by,
        "created_at": r.created_at,
        "updated_at": r.updated_at,
    }


def _panel_dict(p: DecisionSupportPanel) -> dict:
    return {
        "id": p.id,
        "org_id": p.org_id,
        "transaction_id": p.transaction_id,
        "case_id": p.case_id,
        "customer_id": p.customer_id,
        "risk_summary": {
            "customer_risk_score": p.customer_risk_score,
            "customer_risk_level": p.customer_risk_level,
            "transaction_risk_score": p.transaction_risk_score,
            "geographic_risk_score": p.geographic_risk_score,
            "product_risk_score": p.product_risk_score,
            "behaviour_risk_score": p.behaviour_risk_score,
            "risk_matrix_score": p.risk_matrix_score,
            "alert_score": p.alert_score,
            "final_approval_score": p.final_approval_score,
        },
        "triggered_rules": p.triggered_rules or [],
        "required_actions": p.required_actions or [],
        "recommended_actions": p.recommended_actions or [],
        "reporting_obligations": {
            "potential_ttr": p.potential_ttr,
            "potential_ifti": p.potential_ifti,
            "potential_smr": p.potential_smr,
            "rationale": p.reporting_rationale or {},
        },
        "outstanding_tasks": p.outstanding_tasks or [],
        "missing_documents": p.missing_documents or [],
        "workflow": {
            "current_step": p.current_step.value if p.current_step else None,
            "is_complete": p.is_complete,
            "final_decision": p.final_decision.value if p.final_decision else None,
            "final_decision_by": p.final_decision_by,
            "final_decision_at": p.final_decision_at,
            "final_decision_notes": p.final_decision_notes,
        },
        "generated_by": p.generated_by,
        "generated_at": p.generated_at,
        "disclaimer": DISCLAIMER,
    }


# ── Rule Builder CRUD ─────────────────────────────────────────────────────────


@router.get("/rules")
def list_rules(
    event_type: Optional[RuleEventType] = Query(None),
    status: Optional[AutomationRuleStatus] = Query(None),
    search: Optional[str] = Query(None, max_length=100),
    pagination: Pagination = Depends(),
    db: Session = Depends(get_db),
    current_user: User = Depends(require_analyst_or_above),
):
    """
    List all automation rules for this org.
    Rules are ordered by priority (lower number = evaluated first).
    """
    org_id = org_id_for(current_user)
    q = db.query(AutomationRule).filter(AutomationRule.org_id == org_id)
    if event_type:
        q = q.filter(AutomationRule.event_type == event_type)
    if status:
        q = q.filter(AutomationRule.status == status)
    if search:
        q = q.filter(AutomationRule.name.ilike(f"%{search}%"))
    q = q.order_by(AutomationRule.priority, AutomationRule.created_at)
    return [_rule_dict(r) for r in pagination.apply(q).all()]


@router.get("/rules/reference")
def rule_builder_reference(
    db: Session = Depends(get_db),
    current_user: User = Depends(require_analyst_or_above),
):
    """
    Return the full reference for the rule builder:
    available event types, condition fields, operators, and action types.
    """
    return {
        "event_types": [
            {"value": e.value, "label": e.value.replace("_", " ").title()}
            for e in RuleEventType
        ],
        "action_types": [
            {"value": a.value, "label": a.value.replace("_", " ").title()}
            for a in RuleActionType
        ],
        "operators": [
            {"value": "eq", "label": "Equals"},
            {"value": "ne", "label": "Not equals"},
            {"value": "gt", "label": "Greater than"},
            {"value": "lt", "label": "Less than"},
            {"value": "gte", "label": "Greater than or equal"},
            {"value": "lte", "label": "Less than or equal"},
            {"value": "in", "label": "In list"},
            {"value": "not_in", "label": "Not in list"},
            {"value": "contains", "label": "Contains"},
            {"value": "between", "label": "Between (value is [min, max])"},
            {"value": "is_true", "label": "Is true"},
            {"value": "is_false", "label": "Is false"},
        ],
        "condition_fields": {
            "customer": [
                "customer.risk_level",
                "customer.is_pep",
                "customer.customer_type",
                "customer.nationality",
                "customer.country_of_residence",
                "customer.cdd_level",
                "customer.risk_score",
                "customer.status",
            ],
            "transaction": [
                "transaction.amount_aud",
                "transaction.currency",
                "transaction.transaction_type",
                "transaction.payment_method",
                "transaction.is_cross_border",
                "transaction.source_country",
                "transaction.destination_country",
                "transaction.is_structuring_suspect",
                "transaction.is_near_threshold",
                "transaction.is_round_number",
                "transaction.risk_score",
            ],
            "alert": [
                "alert.severity",
                "alert.category",
                "alert.alert_score",
                "alert.is_smr_candidate",
                "alert.risk_matrix_level",
            ],
            "case": [
                "case.status",
                "case.case_type",
                "case.severity",
            ],
            "screening": [
                "screening.match_type",
                "screening.risk_level",
                "crypto_wallet.risk_category",
                "crypto_wallet.mixer_exposure_pct",
            ],
        },
        "action_params_reference": {
            "create_alert": {
                "required": ["severity", "title"],
                "optional": ["description", "category"],
            },
            "create_case": {
                "required": ["case_type", "severity", "title"],
                "optional": ["description"],
            },
            "send_email": {
                "required": ["template", "recipient"],
                "optional": ["subject"],
            },
            "send_sms": {
                "required": ["recipient", "message"],
            },
            "trigger_webhook": {
                "required": ["url", "method"],
                "optional": ["headers", "payload_template"],
            },
            "assign_user": {
                "required": ["user_id"],
                "optional": ["note"],
            },
            "set_risk_level": {
                "required": ["risk_level"],
                "optional": ["reason"],
            },
            "escalate_compliance": {
                "optional": ["reason"],
            },
            "generate_report_draft": {
                "required": ["report_type"],
                "note": "Generates a DRAFT only. Never auto-submits.",
            },
        },
        "disclaimer": DISCLAIMER,
    }


@router.post("/rules", status_code=201)
def create_rule(
    payload: RuleCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_compliance_or_above),
):
    """
    Create a new automation rule.

    Condition groups are evaluated with OR logic across groups,
    AND logic within each group (same pattern as MonitoringRule).

    Rules in 'testing' status evaluate conditions and log what
    WOULD have happened, but do not execute actions.

    DISCLAIMER: Rules automate workflow steps only.
    The system never automatically approves compliance decisions.
    """
    org_id = org_id_for(current_user)

    r = AutomationRule(
        id=f"ar_{uuid4().hex[:10]}",
        org_id=org_id,
        rule_ref=_rule_ref(db, org_id),
        name=payload.name,
        description=payload.description,
        event_type=payload.event_type,
        status=AutomationRuleStatus.active,
        priority=payload.priority,
        condition_groups=[g.model_dump() for g in payload.condition_groups],
        actions=[a.model_dump() for a in payload.actions],
        applicable_industries=payload.applicable_industries,
        tags=payload.tags,
        created_by=current_user.id,
    )
    db.add(r)
    db.commit()
    db.refresh(r)
    return _rule_dict(r)


@router.get("/rules/{rule_id}")
def get_rule(
    rule_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_analyst_or_above),
):
    org_id = org_id_for(current_user)
    r = (
        db.query(AutomationRule)
        .filter(
            AutomationRule.id == rule_id,
            AutomationRule.org_id == org_id,
        )
        .first()
    )
    if not r:
        raise HTTPException(404, "Rule not found.")
    return _rule_dict(r)


@router.patch("/rules/{rule_id}")
def update_rule(
    rule_id: str,
    payload: RuleUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_compliance_or_above),
):
    """Update an automation rule. System rules (is_system=True) cannot be deleted or archived."""
    org_id = org_id_for(current_user)
    r = (
        db.query(AutomationRule)
        .filter(
            AutomationRule.id == rule_id,
            AutomationRule.org_id == org_id,
        )
        .first()
    )
    if not r:
        raise HTTPException(404, "Rule not found.")
    if r.is_system and payload.status == AutomationRuleStatus.archived:
        raise HTTPException(409, "System rules cannot be archived.")

    data = payload.model_dump(exclude_none=True)
    if "condition_groups" in data:
        data["condition_groups"] = [g for g in data["condition_groups"]]
    if "actions" in data:
        data["actions"] = [a for a in data["actions"]]

    for k, v in data.items():
        if k == "status":
            setattr(r, k, v)
        elif k in ("condition_groups", "actions"):
            setattr(r, k, v)
        else:
            setattr(r, k, v)

    db.commit()
    db.refresh(r)
    return _rule_dict(r)


@router.delete("/rules/{rule_id}", status_code=204)
def delete_rule(
    rule_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_compliance_or_above),
):
    """Delete a custom rule. System rules (is_system=True) cannot be deleted."""
    org_id = org_id_for(current_user)
    r = (
        db.query(AutomationRule)
        .filter(
            AutomationRule.id == rule_id,
            AutomationRule.org_id == org_id,
        )
        .first()
    )
    if not r:
        raise HTTPException(404, "Rule not found.")
    if r.is_system:
        raise HTTPException(
            409, "System rules cannot be deleted. Set status=inactive to disable."
        )
    db.delete(r)
    db.commit()


@router.get("/rules/{rule_id}/executions")
def rule_executions(
    rule_id: str,
    limit: int = Query(default=50, le=200),
    db: Session = Depends(get_db),
    current_user: User = Depends(require_analyst_or_above),
):
    """Return execution history for a rule (matched and non-matched)."""
    org_id = org_id_for(current_user)
    execs = (
        db.query(AutomationRuleExecution)
        .filter(
            AutomationRuleExecution.rule_id == rule_id,
            AutomationRuleExecution.org_id == org_id,
        )
        .order_by(AutomationRuleExecution.executed_at.desc())
        .limit(limit)
        .all()
    )
    return [
        {
            "id": e.id,
            "event_type": e.event_type,
            "entity_type": e.entity_type,
            "entity_id": e.entity_id,
            "conditions_matched": e.conditions_matched,
            "actions_executed": e.actions_executed or [],
            "is_shadow_mode": e.is_shadow_mode,
            "execution_time_ms": e.execution_time_ms,
            "error_message": e.error_message,
            "executed_at": e.executed_at,
        }
        for e in execs
    ]


# ── Decision Support Panel ────────────────────────────────────────────────────


@router.post("/decision-support", status_code=201)
def create_decision_panel(
    transaction_id: Optional[str] = None,
    case_id: Optional[str] = None,
    customer_id: str = Query(...),
    db: Session = Depends(get_db),
    current_user: User = Depends(require_compliance_or_above),
):
    """
    Generate a decision support panel for a transaction or case.

    Aggregates all available risk signals, triggered rules, potential
    reporting obligations, outstanding tasks, and missing documents.

    DISCLAIMER: Decision support panels are workflow guidance only.
    The system never automatically approves compliance decisions.
    """
    from app.models.customer import Customer
    from app.models.monitoring import TransactionAlert
    from app.models.regulatory_recommendation import (
        RecommendationStatus,
        RegulatoryRecommendation,
    )

    org_id = org_id_for(current_user)

    customer = (
        db.query(Customer)
        .filter(
            Customer.id == customer_id,
            Customer.org_id == org_id,
        )
        .first()
    )
    if not customer:
        raise HTTPException(404, "Customer not found.")

    # Pull latest alert data for this transaction
    customer_risk_score = getattr(customer, "risk_score", 0) or 0
    customer_risk_level = (
        customer.risk_level.value
        if hasattr(customer.risk_level, "value")
        else str(getattr(customer, "risk_level", "low"))
    )

    latest_alert = None
    alert_score = 0.0
    risk_matrix_score = None
    risk_matrix_level = None
    triggered_rules = []
    final_approval_score = None

    if transaction_id:
        latest_alert = (
            db.query(TransactionAlert)
            .filter(
                TransactionAlert.transaction_id == transaction_id,
                TransactionAlert.org_id == org_id,
            )
            .order_by(TransactionAlert.trigger_date.desc())
            .first()
        )

    if latest_alert:
        alert_score = latest_alert.alert_score or 0.0
        risk_matrix_score = latest_alert.risk_matrix_score
        risk_matrix_level = latest_alert.risk_matrix_level
        final_approval_score = latest_alert.final_approval_score
        breakdown = latest_alert.score_breakdown or {}
        # Triggered rules from alert
        if latest_alert.rules_matched:
            triggered_rules = [{"rule_id": rid} for rid in latest_alert.rules_matched]

    # Determine potential reporting obligations
    amount_aud = 0.0
    is_cross_border = False
    is_structuring = False
    is_near_threshold = False
    if transaction_id:
        from app.models.transaction import Transaction

        txn = (
            db.query(Transaction)
            .filter(Transaction.id == transaction_id, Transaction.org_id == org_id)
            .first()
        )
        if txn:
            amount_aud = txn.amount_aud or txn.amount or 0.0
            is_cross_border = getattr(txn, "is_cross_border", False)
            is_structuring = getattr(txn, "is_structuring_suspect", False)
            is_near_threshold = getattr(txn, "is_near_threshold", False)

    potential_ttr = amount_aud >= 10_000.0
    potential_ifti = is_cross_border and amount_aud >= 10_000.0
    potential_smr = is_structuring or alert_score >= 70.0 or customer_is_pep(customer)
    reporting_rationale = {}
    if potential_ttr:
        reporting_rationale["ttr"] = (
            f"Transaction amount AUD{amount_aud:,.0f} meets TTR threshold"
        )
    if potential_ifti:
        reporting_rationale["ifti"] = (
            "Cross-border transaction ≥ AUD 10,000 may require IFTI"
        )
    if potential_smr:
        reporting_rationale["smr"] = (
            "Structuring indicators, high alert score, or PEP involvement"
        )

    # Recommendations as required/recommended actions
    required_actions = []
    recommended_actions = []
    if transaction_id:
        recs = (
            db.query(RegulatoryRecommendation)
            .filter(
                RegulatoryRecommendation.transaction_id == transaction_id,
                RegulatoryRecommendation.org_id == org_id,
                RegulatoryRecommendation.status == RecommendationStatus.pending,
            )
            .all()
        )
        for rec in recs:
            action = {"text": rec.title, "regulatory_basis": rec.regulatory_basis}
            if rec.priority and rec.priority.value in ("urgent", "high"):
                required_actions.append(action)
            else:
                recommended_actions.append(action)

    # Score breakdown for panel
    breakdown_val = latest_alert.score_breakdown if latest_alert else {}
    geo_score = breakdown_val.get("geographic", 0.0) if breakdown_val else 0.0
    prod_score = breakdown_val.get("product", 0.0) if breakdown_val else 0.0
    beh_score = breakdown_val.get("behaviour", 0.0) if breakdown_val else 0.0
    txn_score = breakdown_val.get("transaction", 0.0) if breakdown_val else 0.0

    panel = DecisionSupportPanel(
        id=f"dsp_{uuid4().hex[:12]}",
        org_id=org_id,
        transaction_id=transaction_id,
        case_id=case_id,
        customer_id=customer_id,
        customer_risk_score=customer_risk_score,
        customer_risk_level=customer_risk_level,
        transaction_risk_score=txn_score,
        geographic_risk_score=geo_score,
        product_risk_score=prod_score,
        behaviour_risk_score=beh_score,
        risk_matrix_score=risk_matrix_score,
        alert_score=alert_score,
        final_approval_score=final_approval_score,
        triggered_rules=triggered_rules,
        required_actions=required_actions,
        recommended_actions=recommended_actions,
        potential_ttr=potential_ttr,
        potential_ifti=potential_ifti,
        potential_smr=potential_smr,
        reporting_rationale=reporting_rationale,
        outstanding_tasks=[],
        missing_documents=[],
        current_step=ApprovalStepType.analyst_review,
        generated_by=current_user.id,
    )
    db.add(panel)
    db.commit()
    db.refresh(panel)
    return _panel_dict(panel)


def customer_is_pep(customer) -> bool:
    return bool(getattr(customer, "is_pep", False))


@router.get("/decision-support/{panel_id}")
def get_decision_panel(
    panel_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_analyst_or_above),
):
    org_id = org_id_for(current_user)
    p = (
        db.query(DecisionSupportPanel)
        .filter(
            DecisionSupportPanel.id == panel_id,
            DecisionSupportPanel.org_id == org_id,
        )
        .first()
    )
    if not p:
        raise HTTPException(404, "Decision support panel not found.")
    return _panel_dict(p)


@router.get("/decision-support")
def list_decision_panels(
    customer_id: Optional[str] = Query(None),
    transaction_id: Optional[str] = Query(None),
    is_complete: Optional[bool] = Query(None),
    pagination: Pagination = Depends(),
    db: Session = Depends(get_db),
    current_user: User = Depends(require_analyst_or_above),
):
    org_id = org_id_for(current_user)
    q = db.query(DecisionSupportPanel).filter(DecisionSupportPanel.org_id == org_id)
    if customer_id:
        q = q.filter(DecisionSupportPanel.customer_id == customer_id)
    if transaction_id:
        q = q.filter(DecisionSupportPanel.transaction_id == transaction_id)
    if is_complete is not None:
        q = q.filter(DecisionSupportPanel.is_complete == is_complete)
    q = q.order_by(DecisionSupportPanel.generated_at.desc())
    return [_panel_dict(p) for p in pagination.apply(q).all()]


# ── Approval Workflow ─────────────────────────────────────────────────────────


@router.post("/decision-support/{panel_id}/review")
def submit_review_step(
    panel_id: str,
    payload: ApprovalDecision,
    step_type: ApprovalStepType = Query(ApprovalStepType.analyst_review),
    db: Session = Depends(get_db),
    current_user: User = Depends(require_compliance_or_above),
):
    """
    Submit a review decision on a decision support panel.

    Workflow stages:
      analyst_review     — initial analyst assessment
      compliance_review  — compliance officer review
      mlro_review        — MLRO review (for SMR candidates)
      senior_approval    — senior management sign-off

    Approved → panel marked complete.
    rejected or more_information → panel remains open.
    escalated → moves to next stage.

    DISCLAIMER: This records a human review decision.
    The system never automatically approves compliance decisions.
    """
    org_id = org_id_for(current_user)
    p = (
        db.query(DecisionSupportPanel)
        .filter(
            DecisionSupportPanel.id == panel_id,
            DecisionSupportPanel.org_id == org_id,
        )
        .first()
    )
    if not p:
        raise HTTPException(404, "Decision support panel not found.")
    if p.is_complete:
        raise HTTPException(409, "Panel workflow is already complete.")

    # Determine next step
    step_order = {
        ApprovalStepType.analyst_review: 1,
        ApprovalStepType.compliance_review: 2,
        ApprovalStepType.mlro_review: 3,
        ApprovalStepType.senior_approval: 4,
    }
    next_steps = {
        ApprovalStepType.analyst_review: ApprovalStepType.compliance_review,
        ApprovalStepType.compliance_review: ApprovalStepType.mlro_review,
        ApprovalStepType.mlro_review: ApprovalStepType.senior_approval,
        ApprovalStepType.senior_approval: None,
    }

    # Capture risk snapshot at decision time
    risk_snapshot = {
        "customer_risk_score": p.customer_risk_score,
        "alert_score": p.alert_score,
        "risk_matrix_score": p.risk_matrix_score,
        "final_approval_score": p.final_approval_score,
    }

    step = ApprovalWorkflowStep(
        id=f"aws_{uuid4().hex[:12]}",
        panel_id=panel_id,
        org_id=org_id,
        step_type=step_type,
        step_order=step_order.get(step_type, 0),
        decision=payload.decision,
        reviewer_id=current_user.id,
        review_notes=payload.review_notes,
        risk_snapshot=risk_snapshot,
        conditions=payload.conditions,
    )
    db.add(step)

    # Update panel state
    if payload.decision == ApprovalDecisionType.approved:
        next_step = next_steps.get(step_type)
        if next_step:
            p.current_step = next_step
        else:
            p.is_complete = True
            p.final_decision = ApprovalDecisionType.approved
            p.final_decision_by = current_user.id
            p.final_decision_at = datetime.now(timezone.utc)
            p.final_decision_notes = payload.review_notes
    elif payload.decision == ApprovalDecisionType.rejected:
        p.is_complete = True
        p.final_decision = ApprovalDecisionType.rejected
        p.final_decision_by = current_user.id
        p.final_decision_at = datetime.now(timezone.utc)
        p.final_decision_notes = payload.review_notes
    elif payload.decision == ApprovalDecisionType.escalated:
        next_step = next_steps.get(step_type)
        if next_step:
            p.current_step = next_step
    # more_information: leave panel open at current step

    db.commit()
    db.refresh(p)
    return {
        "panel_id": panel_id,
        "step_recorded": step_type.value,
        "decision": payload.decision.value,
        "is_complete": p.is_complete,
        "current_step": p.current_step.value if p.current_step else None,
        "final_decision": p.final_decision.value if p.final_decision else None,
        "disclaimer": DISCLAIMER,
    }


@router.get("/decision-support/{panel_id}/workflow-history")
def workflow_history(
    panel_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_analyst_or_above),
):
    """Return all review steps taken on a decision support panel."""
    org_id = org_id_for(current_user)
    steps = (
        db.query(ApprovalWorkflowStep)
        .filter(
            ApprovalWorkflowStep.panel_id == panel_id,
            ApprovalWorkflowStep.org_id == org_id,
        )
        .order_by(ApprovalWorkflowStep.step_order, ApprovalWorkflowStep.reviewed_at)
        .all()
    )
    return [
        {
            "id": s.id,
            "step_type": s.step_type.value,
            "step_order": s.step_order,
            "decision": s.decision.value,
            "reviewer_id": s.reviewer_id,
            "review_notes": s.review_notes,
            "conditions": s.conditions or [],
            "risk_snapshot": s.risk_snapshot,
            "reviewed_at": s.reviewed_at,
        }
        for s in steps
    ]
