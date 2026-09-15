"""
SMR (Suspicious Matter Report) Internal Decision Log API.

Roles:
  GET endpoints             — analyst+
  Create / assess / update  — compliance+

DISCLAIMER: This module records the entity's own suspicion-assessment
decisions. The platform does not determine whether a matter is
suspicious, does not form a suspicion on the entity's behalf, and does
not lodge SMRs with AUSTRAC. All decisions remain with the reporting
entity's Compliance Officer.
"""

from datetime import datetime, timedelta, timezone
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
from app.models.customer import Customer
from app.models.smr_decision_log import (
    SMRContinueDealings,
    SMRDecisionLog,
    SMRDecisionOutcome,
    SMRMatterSource,
    SMRSuspicionType,
)
from app.models.user import User
from app.services import audit_service

router = APIRouter(prefix="/smr-decision-logs", tags=["SMR Decision Log"])

DISCLAIMER = (
    "This record documents the entity's own suspicion-assessment decision. "
    "The platform does not determine whether a matter is suspicious and "
    "does not lodge SMRs with AUSTRAC. All decisions remain with the "
    "reporting entity's Compliance Officer."
)


def _log(db: Session, current_user: User, decision_id: str, action: str) -> None:
    audit_service.log_action(
        db,
        action=action,
        entity_type="smr_decision_log",
        entity_id=decision_id,
        actor=current_user.email,
        actor_role=current_user.role.value if current_user.role else None,
        organisation_id=org_id_for(current_user),
    )


# ── Schemas ───────────────────────────────────────────────────────────────────


class DecisionLogCreate(BaseModel):
    customer_id: Optional[str] = None
    case_id: Optional[str] = None
    tmp_alert_id: Optional[str] = None
    ecdd_case_id: Optional[str] = None
    related_transaction_id: Optional[str] = None
    matter_source: SMRMatterSource
    identifying_employee: Optional[str] = None
    suspicion_category: Optional[str] = Field(None, max_length=100)
    risk_matrix_ref: Optional[str] = Field(None, max_length=50)
    description: Optional[str] = None


class DecisionAssess(BaseModel):
    suspicion_formed: bool
    suspicion_type: Optional[SMRSuspicionType] = None
    is_terrorism_financing_indicator: bool = False
    reasons: str = Field(..., min_length=1)
    enhanced_monitoring_applied: bool = False


class DecisionLodge(BaseModel):
    austrac_reference: str = Field(..., min_length=1, max_length=100)
    tipping_off_check_confirmed: bool
    director_notified: bool = False
    continue_dealings: SMRContinueDealings = SMRContinueDealings.continue_normal
    post_decision_notes: Optional[str] = None


class DecisionClose(BaseModel):
    outcome: SMRDecisionOutcome
    post_decision_notes: Optional[str] = None
    next_review_date: Optional[str] = None  # ISO date string


# ── Helpers ───────────────────────────────────────────────────────────────────


def _get_or_404(decision_id: str, org_id: str, db: Session) -> SMRDecisionLog:
    row = (
        db.query(SMRDecisionLog)
        .filter(SMRDecisionLog.id == decision_id, SMRDecisionLog.org_id == org_id)
        .first()
    )
    if not row:
        raise HTTPException(404, "SMR decision log entry not found.")
    return row


def _decision_ref(db: Session, org_id: str) -> str:
    count = db.query(SMRDecisionLog).filter(SMRDecisionLog.org_id == org_id).count()
    return f"SMRDL-{count + 1:05d}"


def _dict(row: SMRDecisionLog) -> dict:
    return {
        "id": row.id,
        "decision_ref": row.decision_ref,
        "org_id": row.org_id,
        "customer_id": row.customer_id,
        "case_id": row.case_id,
        "tmp_alert_id": row.tmp_alert_id,
        "ecdd_case_id": row.ecdd_case_id,
        "related_transaction_id": row.related_transaction_id,
        "matter_source": row.matter_source.value,
        "identifying_employee": row.identifying_employee,
        "suspicion_category": row.suspicion_category,
        "risk_matrix_ref": row.risk_matrix_ref,
        "description": row.description,
        "co_user_id": row.co_user_id,
        "suspicion_formed": row.suspicion_formed,
        "suspicion_formed_at": row.suspicion_formed_at,
        "suspicion_type": row.suspicion_type.value if row.suspicion_type else None,
        "is_terrorism_financing_indicator": row.is_terrorism_financing_indicator,
        "reasons": row.reasons,
        "enhanced_monitoring_applied": row.enhanced_monitoring_applied,
        "smr_deadline": row.smr_deadline,
        "outcome": row.outcome.value if row.outcome else None,
        "smr_lodged_at": row.smr_lodged_at,
        "austrac_reference": row.austrac_reference,
        "tipping_off_check_confirmed": row.tipping_off_check_confirmed,
        "director_notified": row.director_notified,
        "director_notified_at": row.director_notified_at,
        "continue_dealings": row.continue_dealings.value
        if row.continue_dealings
        else None,
        "post_decision_notes": row.post_decision_notes,
        "next_review_date": row.next_review_date,
        "created_by": row.created_by,
        "created_at": row.created_at,
        "updated_at": row.updated_at,
        "disclaimer": DISCLAIMER,
    }


# ── CRUD ──────────────────────────────────────────────────────────────────────


@router.post("", status_code=201)
def create_decision_log(
    payload: DecisionLogCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_compliance_or_above),
):
    """
    Open a new SMR internal decision log entry for an escalated suspicion.

    This must be created for every escalated matter regardless of whether
    it is expected to result in an SMR — a documented decision NOT to
    lodge is as important a record as a lodged SMR.
    """
    org_id = org_id_for(current_user)

    if payload.customer_id:
        customer = (
            db.query(Customer)
            .filter(Customer.id == payload.customer_id, Customer.org_id == org_id)
            .first()
        )
        if not customer:
            raise HTTPException(404, "Customer not found.")

    row = SMRDecisionLog(
        id=f"smrdl_{uuid4().hex[:12]}",
        decision_ref=_decision_ref(db, org_id),
        org_id=org_id,
        customer_id=payload.customer_id,
        case_id=payload.case_id,
        tmp_alert_id=payload.tmp_alert_id,
        ecdd_case_id=payload.ecdd_case_id,
        related_transaction_id=payload.related_transaction_id,
        matter_source=payload.matter_source,
        identifying_employee=payload.identifying_employee,
        suspicion_category=payload.suspicion_category,
        risk_matrix_ref=payload.risk_matrix_ref,
        description=payload.description,
        suspicion_formed=False,
        outcome=SMRDecisionOutcome.under_assessment,
        created_by=current_user.id,
    )
    db.add(row)
    db.commit()
    db.refresh(row)
    _log(db, current_user, row.id, "smr_decision_log_created")
    return _dict(row)


@router.get("")
def list_decision_logs(
    customer_id: Optional[str] = Query(None),
    case_id: Optional[str] = Query(None),
    outcome: Optional[SMRDecisionOutcome] = Query(None),
    suspicion_formed: Optional[bool] = Query(None),
    pagination: Pagination = Depends(),
    db: Session = Depends(get_db),
    current_user: User = Depends(require_analyst_or_above),
):
    org_id = org_id_for(current_user)
    q = db.query(SMRDecisionLog).filter(SMRDecisionLog.org_id == org_id)
    if customer_id:
        q = q.filter(SMRDecisionLog.customer_id == customer_id)
    if case_id:
        q = q.filter(SMRDecisionLog.case_id == case_id)
    if outcome:
        q = q.filter(SMRDecisionLog.outcome == outcome)
    if suspicion_formed is not None:
        q = q.filter(SMRDecisionLog.suspicion_formed == suspicion_formed)
    q = q.order_by(SMRDecisionLog.created_at.desc())
    return [_dict(row) for row in pagination.apply(q).all()]


@router.get("/{decision_id}")
def get_decision_log(
    decision_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_analyst_or_above),
):
    row = _get_or_404(decision_id, org_id_for(current_user), db)
    return _dict(row)


@router.post("/{decision_id}/assess")
def assess_decision_log(
    decision_id: str,
    payload: DecisionAssess,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_compliance_or_above),
):
    """
    Record the Compliance Officer's assessment of whether a suspicion is
    formed under AML/CTF Act s.41. Sets the SMR deadline (24 hours for
    terrorism financing, 3 business days for all other matters) from the
    moment the suspicion is formed — never from staff escalation or matter
    creation, matching every real Program reviewed this session.

    All fields here are a human decision only — never auto-set.
    """
    row = _get_or_404(decision_id, org_id_for(current_user), db)
    now = datetime.now(timezone.utc)

    row.co_user_id = current_user.id
    row.suspicion_formed = payload.suspicion_formed
    row.suspicion_type = payload.suspicion_type
    row.is_terrorism_financing_indicator = payload.is_terrorism_financing_indicator
    row.reasons = payload.reasons
    row.enhanced_monitoring_applied = payload.enhanced_monitoring_applied

    if payload.suspicion_formed:
        row.suspicion_formed_at = now
        row.outcome = SMRDecisionOutcome.smr_to_be_lodged
        if payload.is_terrorism_financing_indicator:
            row.smr_deadline = now + timedelta(hours=24)
        else:
            # 3 business days, approximated as 3 calendar days plus a
            # weekend allowance; the CO's own calendar governs the actual
            # deadline — this is a working estimate for dashboard/alerting
            # purposes only, not a substitute for the entity's own
            # business-day calculation.
            row.smr_deadline = now + timedelta(days=5)
    else:
        row.outcome = SMRDecisionOutcome.smr_not_lodged

    db.commit()
    db.refresh(row)
    _log(db, current_user, row.id, "smr_decision_log_assessed")
    return _dict(row)


@router.post("/{decision_id}/lodge")
def lodge_decision_log(
    decision_id: str,
    payload: DecisionLodge,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_compliance_or_above),
):
    """
    Record that the SMR has been lodged with AUSTRAC for this decision.

    Requires the tipping-off check to be explicitly confirmed — every real
    Program reviewed this session treats this as a mandatory pre-lodgement
    step, not an afterthought.
    """
    row = _get_or_404(decision_id, org_id_for(current_user), db)
    if not row.suspicion_formed:
        raise HTTPException(
            400, "Cannot lodge an SMR for a decision where suspicion was not formed."
        )
    if not payload.tipping_off_check_confirmed:
        raise HTTPException(
            400, "Tipping-off check must be confirmed before recording lodgement."
        )

    row.outcome = SMRDecisionOutcome.smr_lodged
    row.austrac_reference = payload.austrac_reference
    row.tipping_off_check_confirmed = True
    row.smr_lodged_at = datetime.now(timezone.utc)
    row.director_notified = payload.director_notified
    if payload.director_notified:
        row.director_notified_at = datetime.now(timezone.utc)
    row.continue_dealings = payload.continue_dealings
    if payload.post_decision_notes:
        row.post_decision_notes = payload.post_decision_notes

    db.commit()
    db.refresh(row)
    _log(db, current_user, row.id, "smr_decision_log_lodged")
    return _dict(row)


@router.post("/{decision_id}/close")
def close_decision_log(
    decision_id: str,
    payload: DecisionClose,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_compliance_or_above),
):
    """
    Close a decision log entry whose suspicion was cleared without SMR
    lodgement, or record a supplementary outcome/review date. Retained
    permanently regardless of outcome — AUSTRAC may audit the decision
    NOT to lodge an SMR as closely as a lodged one.
    """
    row = _get_or_404(decision_id, org_id_for(current_user), db)
    row.outcome = payload.outcome
    if payload.post_decision_notes:
        row.post_decision_notes = payload.post_decision_notes
    if payload.next_review_date:
        row.next_review_date = datetime.fromisoformat(payload.next_review_date).date()

    db.commit()
    db.refresh(row)
    _log(db, current_user, row.id, "smr_decision_log_closed")
    return _dict(row)
