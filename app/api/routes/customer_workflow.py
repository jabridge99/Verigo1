"""
Customer Onboarding Workflow API.

Implements the 9-phase enterprise workflow:
  Phase 1: Customer Creation (in customers.py)
  Phase 2: Data Collection
  Phase 3: Verification Layer
  Phase 4: Screening Layer
  Phase 5: Risk Assessment (5-dimension engine)
  Phase 6: Decision Gateway (auto-routes CDD vs EDD)
  Phase 7: EDD (with senior approval gate)
  Phase 8: CDD/EDD Compliance Review
  Phase 9: Approval / Reject / RFI

State machine enforces valid transitions only.
Every transition creates an immutable CustomerWorkflowEvent.
"""

import logging
from datetime import date, datetime, timedelta, timezone
from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session

from app.api.deps import (
    org_id_for,
    require_analyst_or_above,
    require_compliance_or_above,
    require_mlro_or_above,
)
from app.db.database import get_db
from app.models.audit_log import AuditEventType, AuditLog
from app.models.customer import Customer
from app.models.customer_workflow import (
    ACTION_TO_STATE,
    WORKFLOW_TRANSITIONS,
    CustomerRiskProfile,
    CustomerWorkflow,
    CustomerWorkflowEvent,
    WorkflowAction,
    WorkflowState,
)
from app.models.user import User
from app.schemas.customer_workflow import (
    ApprovalRequest,
    EDDApprovalRequest,
    RFIRequest,
    RiskAssessmentRequest,
    RiskAssessmentResponse,
    RiskDimensionResponse,
    RiskProfileResponse,
    WorkflowActionRequest,
    WorkflowAssignRequest,
    WorkflowEventResponse,
    WorkflowResponse,
)
from app.services.customer_risk_engine import (
    assess_customer_risk,
    cdd_level_from_gateway,
    risk_level_from_score,
)

log = logging.getLogger("verigo.api.customer_workflow")
router = APIRouter(
    prefix="/customers/{customer_id}/workflow", tags=["Customer Workflow"]
)

# EDD SLA: 30 days from EDD trigger; standard CDD: 14 days
SLA_DAYS = {"edd": 30, "cdd": 14, "default": 14}

# Role gates for specific actions
_EDD_APPROVAL_ROLES = ("admin", "mlro")
_APPROVAL_ROLES = ("admin", "mlro", "compliance")


# ── Helpers ───────────────────────────────────────────────────────────────────


def _get_customer_and_workflow(
    customer_id: str, org_id: str, db: Session
) -> tuple[Customer, CustomerWorkflow]:
    customer = (
        db.query(Customer)
        .filter(Customer.id == customer_id, Customer.org_id == org_id)
        .first()
    )
    if not customer:
        raise HTTPException(404, "Customer not found")

    workflow = (
        db.query(CustomerWorkflow)
        .filter(CustomerWorkflow.customer_id == customer_id)
        .first()
    )
    if not workflow:
        # Auto-create if missing (backward compat)
        workflow = CustomerWorkflow(
            customer_id=customer_id,
            org_id=org_id,
            state=WorkflowState.draft,
            customer_type=customer.customer_type.value,
        )
        db.add(workflow)
        db.flush()

    return customer, workflow


def _transition(
    workflow: CustomerWorkflow,
    action: WorkflowAction,
    actor: User,
    db: Session,
    comments: Optional[str] = None,
    metadata: Optional[dict] = None,
) -> None:
    to_state = ACTION_TO_STATE.get(action)
    if not to_state:
        raise HTTPException(422, f"Unknown workflow action: '{action}'")

    allowed = WORKFLOW_TRANSITIONS.get(workflow.state, [])
    if to_state not in allowed:
        raise HTTPException(
            422,
            f"Cannot transition from '{workflow.state.value}' to '{to_state.value}' "
            f"(action: '{action.value}')",
        )

    event = CustomerWorkflowEvent(
        workflow_id=workflow.id,
        customer_id=workflow.customer_id,
        org_id=workflow.org_id,
        action=action,
        from_state=workflow.state,
        to_state=to_state,
        actor_id=actor.id,
        actor_role=actor.role.value,
        comments=comments,
        metadata=metadata or {},
        occurred_at=datetime.now(timezone.utc),
    )
    db.add(event)
    workflow.state = to_state


# ── GET workflow ──────────────────────────────────────────────────────────────


@router.get("", response_model=WorkflowResponse)
def get_workflow(
    customer_id: str,
    current_user: User = Depends(require_analyst_or_above),
    db: Session = Depends(get_db),
):
    _, workflow = _get_customer_and_workflow(customer_id, org_id_for(current_user), db)
    return workflow


@router.get("/events", response_model=List[WorkflowEventResponse])
def get_workflow_events(
    customer_id: str,
    current_user: User = Depends(require_analyst_or_above),
    db: Session = Depends(get_db),
):
    _, workflow = _get_customer_and_workflow(customer_id, org_id_for(current_user), db)
    return workflow.events


# ── Assign reviewers / SLA ─────────────────────────────────────────────────────


@router.patch("/assign", response_model=WorkflowResponse)
def assign_workflow(
    customer_id: str,
    payload: WorkflowAssignRequest,
    current_user: User = Depends(require_compliance_or_above),
    db: Session = Depends(get_db),
):
    _, workflow = _get_customer_and_workflow(customer_id, org_id_for(current_user), db)
    if payload.assigned_analyst:
        workflow.assigned_analyst = payload.assigned_analyst
    if payload.assigned_compliance:
        workflow.assigned_compliance = payload.assigned_compliance
    if payload.assigned_senior:
        workflow.assigned_senior = payload.assigned_senior
    if payload.sla_due_date:
        workflow.sla_due_date = payload.sla_due_date
    db.commit()
    db.refresh(workflow)
    return workflow


# ── Phase 2: Start data collection ────────────────────────────────────────────


@router.post("/start", response_model=WorkflowResponse)
def start_data_collection(
    customer_id: str,
    comments: Optional[str] = None,
    current_user: User = Depends(require_analyst_or_above),
    db: Session = Depends(get_db),
):
    customer, workflow = _get_customer_and_workflow(
        customer_id, org_id_for(current_user), db
    )
    _transition(workflow, WorkflowAction.start_collection, current_user, db, comments)
    workflow.started_at = datetime.now(timezone.utc)
    workflow.sla_due_date = workflow.sla_due_date or (
        date.today() + timedelta(days=SLA_DAYS["default"])
    )
    db.commit()
    db.refresh(workflow)
    return workflow


# ── Phase 3: Submit for verification ──────────────────────────────────────────


@router.post("/submit-verification", response_model=WorkflowResponse)
def submit_for_verification(
    customer_id: str,
    payload: WorkflowActionRequest,
    current_user: User = Depends(require_analyst_or_above),
    db: Session = Depends(get_db),
):
    """Submit customer record for identity/document verification."""
    customer, workflow = _get_customer_and_workflow(
        customer_id, org_id_for(current_user), db
    )

    # Validate minimum data before submitting
    errors = []
    if not customer.full_name:
        errors.append("full_name required")
    if not customer.date_of_birth:
        errors.append("date_of_birth required")
    if (
        customer.customer_type.value in ("company", "trust", "partnership")
        and not customer.business_detail_id
    ):
        errors.append("business_detail required for business customers")
    if errors:
        raise HTTPException(422, f"Data collection incomplete: {'; '.join(errors)}")

    _transition(
        workflow,
        WorkflowAction.submit_for_verification,
        current_user,
        db,
        payload.comments,
    )
    workflow.verification_started_at = datetime.now(timezone.utc)
    db.commit()
    db.refresh(workflow)
    return workflow


@router.post("/verification-result", response_model=WorkflowResponse)
def record_verification_result(
    customer_id: str,
    passed: bool,
    comments: Optional[str] = None,
    current_user: User = Depends(require_analyst_or_above),
    db: Session = Depends(get_db),
):
    """Record the outcome of identity/document verification."""
    customer, workflow = _get_customer_and_workflow(
        customer_id, org_id_for(current_user), db
    )
    action = (
        WorkflowAction.verification_passed
        if passed
        else WorkflowAction.verification_failed
    )
    _transition(workflow, action, current_user, db, comments)
    db.commit()
    db.refresh(workflow)
    return workflow


# ── Phase 4: Trigger screening ────────────────────────────────────────────────


@router.post("/trigger-screening", response_model=WorkflowResponse)
def trigger_screening_phase(
    customer_id: str,
    comments: Optional[str] = None,
    current_user: User = Depends(require_analyst_or_above),
    db: Session = Depends(get_db),
):
    """Advance workflow to screening_in_progress. Actual screening calls go to /screen."""
    customer, workflow = _get_customer_and_workflow(
        customer_id, org_id_for(current_user), db
    )
    _transition(workflow, WorkflowAction.trigger_screening, current_user, db, comments)
    workflow.screening_started_at = datetime.now(timezone.utc)
    db.commit()
    db.refresh(workflow)
    return workflow


@router.post("/screening-complete", response_model=WorkflowResponse)
def mark_screening_complete(
    customer_id: str,
    comments: Optional[str] = None,
    current_user: User = Depends(require_analyst_or_above),
    db: Session = Depends(get_db),
):
    """Mark all screening runs complete; advance to risk_assessment state."""
    customer, workflow = _get_customer_and_workflow(
        customer_id, org_id_for(current_user), db
    )
    _transition(workflow, WorkflowAction.screening_complete, current_user, db, comments)
    db.commit()
    db.refresh(workflow)
    return workflow


# ── Phase 5 + 6: Risk Assessment + Decision Gateway ───────────────────────────


@router.post("/assess-risk", response_model=RiskAssessmentResponse)
def run_risk_assessment(
    customer_id: str,
    payload: RiskAssessmentRequest,
    current_user: User = Depends(require_analyst_or_above),
    db: Session = Depends(get_db),
):
    """
    Run 5-dimension risk assessment and fire the Decision Gateway.

    Automatically advances workflow:
      risk_assessment → decision_gateway → cdd_review | edd_required
    """
    customer, workflow = _get_customer_and_workflow(
        customer_id, org_id_for(current_user), db
    )
    if workflow.state != WorkflowState.risk_assessment:
        raise HTTPException(
            422,
            f"Risk assessment requires state 'risk_assessment'; current: '{workflow.state.value}'",
        )

    # Run engine
    result = assess_customer_risk(
        customer=customer,
        is_pep=customer.is_pep,
        pep_type=customer.pep_type.value if customer.pep_type else None,
        is_sanctions_match=customer.is_sanctions_match,
        involves_remittance=payload.involves_remittance,
        involves_fx=payload.involves_fx,
        involves_crypto=payload.involves_crypto,
        involves_cash=payload.involves_cash,
        involves_trust=payload.involves_trust,
        involves_bearer=payload.involves_bearer,
        countries=payload.additional_countries or [],
        channel=payload.channel,
        is_introduced=payload.is_introduced,
        is_third_party_reliance=payload.is_third_party_reliance,
        expected_monthly_volume_aud=payload.expected_monthly_volume_aud,
        expected_max_transaction_aud=payload.expected_max_transaction_aud,
        expected_frequency=payload.expected_frequency,
        crosses_border=payload.crosses_border,
    )

    # Persist risk profile
    profile = (
        db.query(CustomerRiskProfile)
        .filter(CustomerRiskProfile.workflow_id == workflow.id)
        .first()
    )
    if profile:
        profile.version += 1
    else:
        profile = CustomerRiskProfile(
            workflow_id=workflow.id,
            customer_id=customer_id,
            org_id=customer.org_id,
        )
        db.add(profile)

    cr, pr, gr, chr_, tr = (
        result.customer_risk,
        result.product_risk,
        result.geographic_risk,
        result.channel_risk,
        result.transaction_risk,
    )
    profile.customer_risk_score = cr.score
    profile.customer_risk_factors = cr.factors
    profile.is_pep = cr.flags.get("is_pep", False)
    profile.nationality_risk = (
        "high"
        if cr.flags.get("blacklist_nationality")
        else "medium"
        if cr.score > 20
        else "low"
    )
    profile.nationality_country = customer.nationality

    profile.product_risk_score = pr.score
    profile.product_risk_factors = pr.factors
    profile.involves_remittance = payload.involves_remittance
    profile.involves_fx = payload.involves_fx
    profile.involves_crypto = payload.involves_crypto
    profile.involves_cash = payload.involves_cash
    profile.involves_trust_structure = payload.involves_trust
    profile.involves_bearer_instruments = payload.involves_bearer

    profile.geographic_risk_score = gr.score
    profile.geographic_risk_factors = gr.factors
    profile.countries_involved = list(
        set(
            filter(
                None,
                [
                    customer.nationality,
                    customer.country_of_residence,
                    customer.country_of_birth,
                    *(payload.additional_countries or []),
                ],
            )
        )
    )
    profile.has_fatf_blacklist_country = gr.flags.get("fatf_blacklist", False)
    profile.has_fatf_greylist_country = gr.flags.get("fatf_greylist", False)
    profile.has_sanctions_country = gr.flags.get("sanctions_country", False)
    profile.highest_risk_country = gr.flags.get("highest_risk_country")  # type: ignore

    profile.channel_risk_score = chr_.score
    profile.channel_risk_factors = chr_.factors
    profile.channel = payload.channel
    profile.is_non_face_to_face = chr_.flags.get("non_face_to_face", True)
    profile.is_introduced = payload.is_introduced
    profile.is_third_party_reliance = payload.is_third_party_reliance

    profile.transaction_risk_score = tr.score
    profile.transaction_risk_factors = tr.factors
    profile.expected_monthly_volume_aud = payload.expected_monthly_volume_aud
    profile.expected_transaction_frequency = payload.expected_frequency
    profile.expected_max_transaction_aud = payload.expected_max_transaction_aud
    profile.is_high_value = tr.flags.get("is_high_value", False)
    profile.crosses_border = payload.crosses_border

    profile.overall_risk_score = result.overall_score
    profile.overall_risk_level = result.overall_level
    profile.gateway_decision = result.gateway_decision
    profile.edd_triggers = result.edd_triggers
    profile.weights_used = result.weights
    profile.assessed_by = current_user.id
    profile.assessment_notes = payload.assessment_notes

    # Update customer risk fields
    old_risk_level = customer.risk_level
    old_risk_score = customer.risk_score
    new_level = risk_level_from_score(result.overall_score)
    new_cdd = cdd_level_from_gateway(result.gateway_decision, result.overall_score)
    customer.risk_score = result.overall_score
    customer.risk_level = new_level
    customer.cdd_level = new_cdd

    # Advance through decision gateway
    _transition(
        workflow,
        WorkflowAction.run_risk_assessment,
        current_user,
        db,
        comments=f"Score: {result.overall_score} ({result.overall_level})",
        metadata={"score": result.overall_score, "level": result.overall_level},
    )
    # Auto-fire decision gateway
    route_action = (
        WorkflowAction.route_edd
        if result.gateway_decision == "edd"
        else WorkflowAction.route_cdd
    )
    _transition(
        workflow,
        route_action,
        current_user,
        db,
        comments=f"Auto-routed by gateway: {result.gateway_decision.upper()}",
        metadata={"edd_triggers": result.edd_triggers, "auto": True},
    )
    workflow.risk_assessed_at = datetime.now(timezone.utc)
    workflow.risk_gate_result = result.overall_level
    workflow.risk_gate_score = result.overall_score
    workflow.auto_routed = True

    if result.gateway_decision == "edd":
        workflow.edd_triggered = True
        workflow.edd_triggers = result.edd_triggers
        if result.edd_triggers:
            workflow.sla_due_date = date.today() + timedelta(days=SLA_DAYS["edd"])
        # Create immutable risk score history record
        from app.models.customer import CustomerRiskScoreHistory

        db.add(
            CustomerRiskScoreHistory(
                customer_id=customer_id,
                org_id=customer.org_id,
                risk_score=result.overall_score,
                risk_level=new_level,
                cdd_level=new_cdd,
                scoring_factors={
                    "customer": cr.factors,
                    "product": pr.factors,
                    "geographic": gr.factors,
                    "channel": chr_.factors,
                    "transaction": tr.factors,
                },
                trigger="risk_assessment",
                triggered_by=current_user.id,
                notes=f"Gateway: EDD. Triggers: {result.edd_triggers}",
            )
        )

    db.add(
        AuditLog(
            event_type=AuditEventType.other,
            org_id=customer.org_id,
            actor_id=current_user.id,
            action="customer.risk_assessment",
            object_type="Customer",
            object_id=customer_id,
            new_value={
                "score": result.overall_score,
                "level": result.overall_level,
                "gateway": result.gateway_decision,
                "edd_triggers": result.edd_triggers,
            },
        )
    )
    db.commit()

    if old_risk_level != new_level or old_risk_score != result.overall_score:
        from app.models.automation_rule import RuleEventType
        from app.services.automation_engine import (
            customer_context,
            evaluate_automation_rules,
        )

        evaluate_automation_rules(
            db,
            RuleEventType.customer_risk_changed,
            customer.org_id,
            "customer",
            customer.id,
            customer_context(customer),
            triggered_by=current_user.id,
        )

    state_after = (
        WorkflowState.edd_required.value
        if result.gateway_decision == "edd"
        else WorkflowState.cdd_review.value
    )

    return RiskAssessmentResponse(
        customer_risk=RiskDimensionResponse(**vars(cr)),
        product_risk=RiskDimensionResponse(**vars(pr)),
        geographic_risk=RiskDimensionResponse(**vars(gr)),
        channel_risk=RiskDimensionResponse(**vars(chr_)),
        transaction_risk=RiskDimensionResponse(**vars(tr)),
        overall_score=result.overall_score,
        overall_level=result.overall_level,
        gateway_decision=result.gateway_decision,
        edd_triggers=result.edd_triggers,
        weights=result.weights,
        cdd_level=new_cdd.value,
        workflow_state_after=state_after,
    )


@router.get("/risk-profile", response_model=RiskProfileResponse)
def get_risk_profile(
    customer_id: str,
    current_user: User = Depends(require_analyst_or_above),
    db: Session = Depends(get_db),
):
    _, workflow = _get_customer_and_workflow(customer_id, org_id_for(current_user), db)
    profile = (
        db.query(CustomerRiskProfile)
        .filter(CustomerRiskProfile.workflow_id == workflow.id)
        .first()
    )
    if not profile:
        raise HTTPException(404, "Risk profile not yet generated")
    return profile


# ── Phase 7: EDD ──────────────────────────────────────────────────────────────


@router.post("/edd/start", response_model=WorkflowResponse)
def start_edd_collection(
    customer_id: str,
    comments: Optional[str] = None,
    current_user: User = Depends(require_analyst_or_above),
    db: Session = Depends(get_db),
):
    """Begin collecting EDD documentation (SOF, SOW, additional docs)."""
    customer, workflow = _get_customer_and_workflow(
        customer_id, org_id_for(current_user), db
    )
    _transition(
        workflow, WorkflowAction.start_edd_collection, current_user, db, comments
    )
    db.commit()
    db.refresh(workflow)
    return workflow


@router.post("/edd/submit", response_model=WorkflowResponse)
def submit_edd_for_approval(
    customer_id: str,
    comments: Optional[str] = None,
    current_user: User = Depends(require_analyst_or_above),
    db: Session = Depends(get_db),
):
    """Submit EDD documentation for senior approval."""
    customer, workflow = _get_customer_and_workflow(
        customer_id, org_id_for(current_user), db
    )

    # Validate EDD checklist items
    from app.models.customer import CustomerOnboardingChecklist

    chk = (
        db.query(CustomerOnboardingChecklist)
        .filter(CustomerOnboardingChecklist.customer_id == customer_id)
        .first()
    )
    if chk and not (
        chk.edd_source_of_funds_verified and chk.edd_source_of_wealth_verified
    ):
        raise HTTPException(
            422,
            "EDD requires source of funds and source of wealth verification before submission",
        )

    _transition(workflow, WorkflowAction.submit_edd, current_user, db, comments)
    db.commit()
    db.refresh(workflow)
    return workflow


@router.post("/edd/approve", response_model=WorkflowResponse)
def approve_edd(
    customer_id: str,
    payload: EDDApprovalRequest,
    current_user: User = Depends(require_mlro_or_above),
    db: Session = Depends(get_db),
):
    """Senior (MLRO/Admin) approves or returns EDD."""
    customer, workflow = _get_customer_and_workflow(
        customer_id, org_id_for(current_user), db
    )

    if current_user.role.value not in _EDD_APPROVAL_ROLES:
        raise HTTPException(403, "Only MLRO or Admin can approve EDD")

    if payload.approved:
        _transition(
            workflow, WorkflowAction.approve_edd, current_user, db, payload.notes
        )
        workflow.edd_approved_by = current_user.id
        workflow.edd_approved_at = datetime.now(timezone.utc)
        workflow.edd_notes = payload.notes

        # Mark checklist
        from app.models.customer import CustomerOnboardingChecklist

        chk = (
            db.query(CustomerOnboardingChecklist)
            .filter(CustomerOnboardingChecklist.customer_id == customer_id)
            .first()
        )
        if chk:
            chk.edd_senior_approval_obtained = True
    else:
        _transition(
            workflow,
            WorkflowAction.return_edd,
            current_user,
            db,
            payload.return_reason or payload.notes,
        )

    db.add(
        AuditLog(
            event_type=AuditEventType.other,
            org_id=customer.org_id,
            actor_id=current_user.id,
            action="customer.edd.approved"
            if payload.approved
            else "customer.edd.returned",
            object_type="Customer",
            object_id=customer_id,
            new_value={"approved": payload.approved, "notes": payload.notes},
        )
    )
    db.commit()
    db.refresh(workflow)
    return workflow


# ── Phase 8: CDD/EDD Review ───────────────────────────────────────────────────


@router.post("/submit-review", response_model=WorkflowResponse)
def submit_for_final_review(
    customer_id: str,
    comments: Optional[str] = None,
    current_user: User = Depends(require_compliance_or_above),
    db: Session = Depends(get_db),
):
    """Compliance submits reviewed file for final approval decision."""
    customer, workflow = _get_customer_and_workflow(
        customer_id, org_id_for(current_user), db
    )
    _transition(
        workflow, WorkflowAction.submit_for_approval, current_user, db, comments
    )
    workflow.review_started_at = datetime.now(timezone.utc)
    db.commit()
    db.refresh(workflow)
    return workflow


@router.post("/request-information", response_model=WorkflowResponse)
def request_more_information(
    customer_id: str,
    payload: RFIRequest,
    current_user: User = Depends(require_compliance_or_above),
    db: Session = Depends(get_db),
):
    """Put customer on hold — request further information (RFI)."""
    customer, workflow = _get_customer_and_workflow(
        customer_id, org_id_for(current_user), db
    )
    _transition(
        workflow,
        WorkflowAction.request_information,
        current_user,
        db,
        payload.rfi_notes,
    )
    workflow.rfi_notes = payload.rfi_notes
    db.commit()
    db.refresh(workflow)
    return workflow


@router.post("/escalate-edd", response_model=WorkflowResponse)
def escalate_to_edd(
    customer_id: str,
    trigger: str = Query(..., description="EDDTrigger value"),
    comments: Optional[str] = None,
    current_user: User = Depends(require_compliance_or_above),
    db: Session = Depends(get_db),
):
    """Escalate from CDD review to EDD mid-review (compliance discretion)."""
    customer, workflow = _get_customer_and_workflow(
        customer_id, org_id_for(current_user), db
    )
    _transition(
        workflow,
        WorkflowAction.escalate_edd,
        current_user,
        db,
        comments,
        metadata={"trigger": trigger, "escalated_by_compliance": True},
    )
    workflow.edd_triggered = True
    existing = workflow.edd_triggers or []
    if trigger not in existing:
        existing.append(trigger)
    workflow.edd_triggers = existing
    db.commit()
    db.refresh(workflow)
    return workflow


# ── Phase 9: Final Approval ───────────────────────────────────────────────────


@router.post("/decision", response_model=WorkflowResponse)
def final_decision(
    customer_id: str,
    payload: ApprovalRequest,
    current_user: User = Depends(require_compliance_or_above),
    db: Session = Depends(get_db),
):
    """
    Final approval, rejection, or on-hold decision.
    Approve → active; Reject → rejected.
    """
    customer, workflow = _get_customer_and_workflow(
        customer_id, org_id_for(current_user), db
    )

    if workflow.state != WorkflowState.pending_approval:
        raise HTTPException(
            422,
            f"Decision requires 'pending_approval' state; current: '{workflow.state.value}'",
        )

    if current_user.role.value not in _APPROVAL_ROLES:
        raise HTTPException(403, "Compliance role or above required for final decision")

    action = (
        WorkflowAction.approve
        if payload.decision == "approve"
        else WorkflowAction.reject
    )
    _transition(workflow, action, current_user, db, payload.notes)

    workflow.decision = payload.decision
    workflow.decision_by = current_user.id
    workflow.decision_notes = payload.notes
    workflow.decision_at = datetime.now(timezone.utc)
    if payload.decision == "reject":
        workflow.rejection_reason = payload.rejection_reason

    # Sync customer status
    from app.models.customer import CustomerStatus

    customer.status = (
        CustomerStatus.active
        if payload.decision == "approve"
        else CustomerStatus.rejected
    )

    db.add(
        AuditLog(
            event_type=AuditEventType.other,
            org_id=customer.org_id,
            actor_id=current_user.id,
            action=f"customer.{payload.decision}",
            object_type="Customer",
            object_id=customer_id,
            new_value={
                "decision": payload.decision,
                "notes": payload.notes,
                "rejection_reason": payload.rejection_reason,
            },
        )
    )
    db.commit()
    db.refresh(workflow)
    return workflow


# ── Ongoing: Periodic Review ──────────────────────────────────────────────────


@router.post("/periodic-review/start", response_model=WorkflowResponse)
def start_periodic_review(
    customer_id: str,
    comments: Optional[str] = None,
    current_user: User = Depends(require_compliance_or_above),
    db: Session = Depends(get_db),
):
    customer, workflow = _get_customer_and_workflow(
        customer_id, org_id_for(current_user), db
    )
    _transition(
        workflow, WorkflowAction.trigger_periodic_review, current_user, db, comments
    )
    db.commit()
    db.refresh(workflow)
    return workflow


@router.post("/periodic-review/complete", response_model=WorkflowResponse)
def complete_periodic_review(
    customer_id: str,
    comments: Optional[str] = None,
    current_user: User = Depends(require_compliance_or_above),
    db: Session = Depends(get_db),
):
    customer, workflow = _get_customer_and_workflow(
        customer_id, org_id_for(current_user), db
    )
    _transition(
        workflow, WorkflowAction.complete_periodic_review, current_user, db, comments
    )
    db.commit()
    db.refresh(workflow)
    return workflow
