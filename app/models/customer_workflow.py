"""
Customer Onboarding Workflow — enterprise state machine.

States flow:
  draft → data_collection → verification_pending → verification_complete
  → screening_in_progress → risk_assessment
  → [Decision Gateway]
      low/medium → cdd_review
      high       → edd_required → edd_collection → edd_senior_approval → cdd_review
  → pending_approval
  → active | rejected | on_hold
  → periodic_review (ongoing)

Every transition creates an immutable CustomerWorkflowEvent.
Risk is scored across 5 dimensions; decision gateway fires automatically after scoring.
"""

import enum
from uuid import uuid4

from sqlalchemy import (
    JSON,
    Boolean,
    Column,
    Date,
    DateTime,
    Enum,
    Float,
    ForeignKey,
    Integer,
    String,
    Text,
    func,
)
from sqlalchemy.orm import relationship

from app.db.database import Base

# ── Workflow States ────────────────────────────────────────────────────────────


class WorkflowState(str, enum.Enum):
    draft = "draft"
    data_collection = "data_collection"
    verification_pending = "verification_pending"  # docs submitted, awaiting check
    verification_complete = "verification_complete"  # all verifications passed
    screening_in_progress = "screening_in_progress"
    risk_assessment = "risk_assessment"  # engine calculating
    decision_gateway = "decision_gateway"  # routing low/medium/high
    cdd_review = "cdd_review"  # compliance reviewing
    edd_required = "edd_required"  # EDD triggered by gateway
    edd_collection = "edd_collection"  # collecting EDD docs
    edd_senior_approval = "edd_senior_approval"  # awaiting senior approval
    pending_approval = "pending_approval"  # final approval decision
    on_hold = "on_hold"  # RFI / more info needed
    active = "active"
    periodic_review = "periodic_review"
    rejected = "rejected"


class WorkflowAction(str, enum.Enum):
    start_collection = "start_collection"
    submit_for_verification = "submit_for_verification"
    verification_passed = "verification_passed"
    verification_failed = "verification_failed"  # return to data_collection
    trigger_screening = "trigger_screening"
    screening_complete = "screening_complete"
    run_risk_assessment = "run_risk_assessment"
    route_cdd = "route_cdd"  # gateway: low/medium
    route_edd = "route_edd"  # gateway: high
    start_edd_collection = "start_edd_collection"
    submit_edd = "submit_edd"
    approve_edd = "approve_edd"  # senior approval granted
    return_edd = "return_edd"  # senior sends back for more info
    submit_for_approval = "submit_for_approval"
    request_information = "request_information"  # RFI → on_hold
    approve = "approve"
    reject = "reject"
    trigger_periodic_review = "trigger_periodic_review"
    complete_periodic_review = "complete_periodic_review"
    escalate_edd = "escalate_edd"  # CDD → EDD mid-review


WORKFLOW_TRANSITIONS: dict[WorkflowState, list[WorkflowState]] = {
    WorkflowState.draft: [WorkflowState.data_collection],
    WorkflowState.data_collection: [WorkflowState.verification_pending],
    WorkflowState.verification_pending: [
        WorkflowState.verification_complete,
        WorkflowState.data_collection,
    ],
    WorkflowState.verification_complete: [WorkflowState.screening_in_progress],
    WorkflowState.screening_in_progress: [WorkflowState.risk_assessment],
    WorkflowState.risk_assessment: [WorkflowState.decision_gateway],
    WorkflowState.decision_gateway: [
        WorkflowState.cdd_review,
        WorkflowState.edd_required,
    ],
    WorkflowState.edd_required: [WorkflowState.edd_collection],
    WorkflowState.edd_collection: [WorkflowState.edd_senior_approval],
    WorkflowState.edd_senior_approval: [
        WorkflowState.cdd_review,
        WorkflowState.edd_collection,
    ],
    WorkflowState.cdd_review: [
        WorkflowState.pending_approval,
        WorkflowState.on_hold,
        WorkflowState.edd_required,
    ],
    WorkflowState.pending_approval: [
        WorkflowState.active,
        WorkflowState.rejected,
        WorkflowState.on_hold,
    ],
    WorkflowState.on_hold: [
        WorkflowState.data_collection,
        WorkflowState.edd_collection,
        WorkflowState.cdd_review,
        WorkflowState.verification_pending,
    ],
    WorkflowState.active: [WorkflowState.periodic_review],
    WorkflowState.periodic_review: [
        WorkflowState.active,
        WorkflowState.edd_required,
        WorkflowState.on_hold,
    ],
    WorkflowState.rejected: [],
}

ACTION_TO_STATE: dict[WorkflowAction, WorkflowState] = {
    WorkflowAction.start_collection: WorkflowState.data_collection,
    WorkflowAction.submit_for_verification: WorkflowState.verification_pending,
    WorkflowAction.verification_passed: WorkflowState.verification_complete,
    WorkflowAction.verification_failed: WorkflowState.data_collection,
    WorkflowAction.trigger_screening: WorkflowState.screening_in_progress,
    WorkflowAction.screening_complete: WorkflowState.risk_assessment,
    WorkflowAction.run_risk_assessment: WorkflowState.decision_gateway,
    WorkflowAction.route_cdd: WorkflowState.cdd_review,
    WorkflowAction.route_edd: WorkflowState.edd_required,
    WorkflowAction.start_edd_collection: WorkflowState.edd_collection,
    WorkflowAction.submit_edd: WorkflowState.edd_senior_approval,
    WorkflowAction.approve_edd: WorkflowState.cdd_review,
    WorkflowAction.return_edd: WorkflowState.edd_collection,
    WorkflowAction.submit_for_approval: WorkflowState.pending_approval,
    WorkflowAction.request_information: WorkflowState.on_hold,
    WorkflowAction.approve: WorkflowState.active,
    WorkflowAction.reject: WorkflowState.rejected,
    WorkflowAction.trigger_periodic_review: WorkflowState.periodic_review,
    WorkflowAction.complete_periodic_review: WorkflowState.active,
    WorkflowAction.escalate_edd: WorkflowState.edd_required,
}


# ── EDD Trigger Reasons ────────────────────────────────────────────────────────


class EDDTrigger(str, enum.Enum):
    pep_match = "pep_match"
    sanctions_match = "sanctions_match"
    adverse_media = "adverse_media"
    high_risk_country = "high_risk_country"
    high_risk_score = "high_risk_score"
    complex_ownership = "complex_ownership"
    high_value_customer = "high_value_customer"
    crypto_exposure = "crypto_exposure"
    cash_intensive = "cash_intensive"
    unusual_activity = "unusual_activity"
    compliance_discretion = "compliance_discretion"


# ── Customer Workflow Record ───────────────────────────────────────────────────


class CustomerWorkflow(Base):
    """
    One record per customer. Tracks current state, assigned reviewers,
    EDD triggers, and timing metrics.
    """

    __tablename__ = "customer_workflows"

    id = Column(String, primary_key=True, default=lambda: f"wf_{uuid4().hex[:12]}")
    customer_id = Column(
        String,
        ForeignKey("customers.id", ondelete="CASCADE"),
        nullable=False,
        unique=True,
        index=True,
    )
    org_id = Column(String, nullable=False, index=True)

    state = Column(
        Enum(WorkflowState), nullable=False, default=WorkflowState.draft, index=True
    )
    customer_type = Column(String(50))  # snapshot of customer type for routing

    # Timing
    started_at = Column(DateTime(timezone=True))  # when data_collection began
    verification_started_at = Column(DateTime(timezone=True))
    screening_started_at = Column(DateTime(timezone=True))
    risk_assessed_at = Column(DateTime(timezone=True))
    review_started_at = Column(DateTime(timezone=True))
    decision_at = Column(DateTime(timezone=True))  # when approved/rejected
    sla_due_date = Column(Date)  # target completion date

    # Assignments
    assigned_analyst = Column(String)  # user_id
    assigned_compliance = Column(String)  # user_id (CDD/EDD reviewer)
    assigned_senior = Column(String)  # user_id (EDD senior approver)

    # EDD
    edd_triggered = Column(Boolean, default=False)
    edd_triggers = Column(JSON)  # list of EDDTrigger values
    edd_approved_by = Column(String)
    edd_approved_at = Column(DateTime(timezone=True))
    edd_notes = Column(Text)

    # Final decision
    decision = Column(String(20))  # approved | rejected | on_hold
    decision_by = Column(String)
    decision_notes = Column(Text)
    rejection_reason = Column(Text)
    rfi_notes = Column(Text)  # what was requested in on_hold

    # Risk gate results (populated by decision_gateway)
    risk_gate_result = Column(String(20))  # low | medium | high | critical
    risk_gate_score = Column(Float)
    auto_routed = Column(Boolean, default=False)  # whether gateway fired automatically

    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())

    customer = relationship("Customer", foreign_keys=[customer_id], uselist=False)
    events = relationship(
        "CustomerWorkflowEvent",
        back_populates="workflow",
        cascade="all, delete-orphan",
        order_by="CustomerWorkflowEvent.occurred_at",
    )
    risk_profile = relationship(
        "CustomerRiskProfile",
        back_populates="workflow",
        uselist=False,
        cascade="all, delete-orphan",
    )


# ── Workflow Event (immutable) ─────────────────────────────────────────────────


class CustomerWorkflowEvent(Base):
    """Immutable audit trail — one record per transition. Never updated."""

    __tablename__ = "customer_workflow_events"

    id = Column(String, primary_key=True, default=lambda: f"wfe_{uuid4().hex[:10]}")
    workflow_id = Column(
        String,
        ForeignKey("customer_workflows.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    customer_id = Column(String, nullable=False, index=True)
    org_id = Column(String, nullable=False)

    action = Column(Enum(WorkflowAction), nullable=False)
    from_state = Column(Enum(WorkflowState), nullable=False)
    to_state = Column(Enum(WorkflowState), nullable=False)
    actor_id = Column(String)  # user_id or "system"
    actor_role = Column(String(50))
    comments = Column(Text)
    event_metadata = Column(JSON)  # action-specific data (risk scores, triggers, etc.)
    occurred_at = Column(DateTime(timezone=True), nullable=False)

    workflow = relationship("CustomerWorkflow", back_populates="events")


# ── 5-Dimension Risk Profile ───────────────────────────────────────────────────


class CustomerRiskProfile(Base):
    """
    Stores the 5-dimension risk assessment result.
    Created/replaced on each risk assessment run.
    """

    __tablename__ = "customer_risk_profiles"

    id = Column(String, primary_key=True, default=lambda: f"rp_{uuid4().hex[:12]}")
    workflow_id = Column(
        String,
        ForeignKey("customer_workflows.id", ondelete="CASCADE"),
        nullable=False,
        unique=True,
        index=True,
    )
    customer_id = Column(
        String,
        ForeignKey("customers.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    org_id = Column(String, nullable=False)
    version = Column(Integer, default=1)  # increments on each re-assessment

    # ── Dimension 1: Customer Risk ────────────────────────────────────────────
    customer_risk_score = Column(Float, default=0.0)
    customer_risk_factors = Column(
        JSON
    )  # breakdown: {"pep": 40, "nationality": 20, ...}
    is_pep = Column(Boolean, default=False)
    pep_type = Column(String(50))
    nationality_risk = Column(String(20))  # low | medium | high
    nationality_country = Column(String(2))
    occupation_risk = Column(String(20))
    is_cash_intensive = Column(Boolean, default=False)

    # ── Dimension 2: Product/Service Risk ─────────────────────────────────────
    product_risk_score = Column(Float, default=0.0)
    product_risk_factors = Column(JSON)
    involves_remittance = Column(Boolean, default=False)
    involves_fx = Column(Boolean, default=False)
    involves_crypto = Column(Boolean, default=False)
    involves_cash = Column(Boolean, default=False)
    involves_trust_structure = Column(Boolean, default=False)
    involves_bearer_instruments = Column(Boolean, default=False)

    # ── Dimension 3: Geographic Risk ──────────────────────────────────────────
    geographic_risk_score = Column(Float, default=0.0)
    geographic_risk_factors = Column(JSON)
    countries_involved = Column(JSON)  # list of ISO codes
    has_fatf_blacklist_country = Column(Boolean, default=False)
    has_fatf_greylist_country = Column(Boolean, default=False)
    has_sanctions_country = Column(Boolean, default=False)
    has_high_risk_country = Column(Boolean, default=False)
    highest_risk_country = Column(String(2))

    # ── Dimension 4: Delivery Channel Risk ────────────────────────────────────
    channel_risk_score = Column(Float, default=0.0)
    channel_risk_factors = Column(JSON)
    channel = Column(String(50))  # online | mobile | branch | agent | third_party
    is_non_face_to_face = Column(Boolean, default=True)
    is_introduced = Column(Boolean, default=False)
    is_third_party_reliance = Column(Boolean, default=False)

    # ── Dimension 5: Transaction Risk ─────────────────────────────────────────
    transaction_risk_score = Column(Float, default=0.0)
    transaction_risk_factors = Column(JSON)
    expected_monthly_volume_aud = Column(Float)
    expected_transaction_frequency = Column(
        String(50)
    )  # daily | weekly | monthly | occasional
    expected_max_transaction_aud = Column(Float)
    is_high_value = Column(Boolean, default=False)  # > $10,000 threshold
    crosses_border = Column(Boolean, default=False)

    # ── Overall result ─────────────────────────────────────────────────────────
    # Weighted: customer 30%, product 25%, geographic 20%, channel 15%, transaction 10%
    overall_risk_score = Column(Float, nullable=False, default=0.0)
    overall_risk_level = Column(String(20))  # low | medium | high | critical
    gateway_decision = Column(String(20))  # cdd | edd
    edd_triggers = Column(JSON)  # list of EDDTrigger values if edd

    weights_used = Column(JSON)  # snapshot of weights applied
    assessed_by = Column(String)  # user_id or "system"
    assessed_at = Column(DateTime(timezone=True), server_default=func.now())
    assessment_notes = Column(Text)

    workflow = relationship("CustomerWorkflow", back_populates="risk_profile")
