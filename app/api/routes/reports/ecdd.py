"""
Reports — Enhanced Customer Due Diligence (ECDD). Part of the reports route
package; see __init__.py for the combined router.
"""

from datetime import datetime, timezone
from typing import Optional
from uuid import uuid4

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.api.deps import (
    org_id_for,
    require_analyst_or_above,
    require_compliance_or_above,
)
from app.db.database import get_db
from app.models.customer import Customer
from app.models.report import ECDDRecord, ECDDRejectionType, ECDDStatus
from app.models.user import User
from app.schemas.report import ECDDCreate, ECDDDecisionRequest, ECDDResponse
from app.services import audit_service
from app.services.ecdd_service import compute_ecdd_score, determine_recommendation

router = APIRouter()


# ── ECDD (Enhanced Customer Due Diligence) ───────────────────────────────────


def _get_ecdd_or_404(ecdd_id: str, org_id: str, db: Session) -> ECDDRecord:
    r = (
        db.query(ECDDRecord)
        .filter(ECDDRecord.ecdd_id == ecdd_id, ECDDRecord.org_id == org_id)
        .first()
    )
    if not r:
        raise HTTPException(404, "ECDD record not found.")
    return r


@router.get("/ecdd/", response_model=list[ECDDResponse])
def list_ecdd(
    db: Session = Depends(get_db),
    current_user: User = Depends(require_analyst_or_above),
):
    org_id = org_id_for(current_user)
    return (
        db.query(ECDDRecord)
        .filter(ECDDRecord.org_id == org_id)
        .order_by(ECDDRecord.created_at.desc())
        .all()
    )


@router.post("/ecdd/", response_model=ECDDResponse, status_code=status.HTTP_201_CREATED)
def create_ecdd(
    payload: ECDDCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_analyst_or_above),
):
    org_id = org_id_for(current_user)
    customer = (
        db.query(Customer)
        .filter(Customer.id == str(payload.customer_id), Customer.org_id == org_id)
        .first()
    )
    if not customer:
        raise HTTPException(404, "Customer not found.")

    if (
        payload.trigger_reason.value == "other"
        and not (payload.trigger_reason_other or "").strip()
    ):
        raise HTTPException(
            400, "trigger_reason_other is required when trigger_reason is 'other'."
        )

    record = ECDDRecord(
        ecdd_id=f"ECDD-{uuid4().hex[:12].upper()}",
        org_id=org_id,
        customer_id=customer.id,
        trigger_reason=payload.trigger_reason,
        trigger_reason_other=payload.trigger_reason_other,
        pep_status=bool(payload.pep_status),
        adverse_media_found=bool(payload.adverse_media_found),
        adverse_media_details=payload.adverse_media_details,
        beneficial_owner_verified=bool(payload.beneficial_owner_verified),
        beneficial_owner_details=payload.beneficial_owner_details,
        source_of_wealth_verified=bool(payload.source_of_wealth_verified),
        source_of_funds=payload.source_of_funds,
        source_of_wealth_notes=payload.source_of_wealth_notes
        or payload.source_of_wealth_details,
        purpose_of_transaction=payload.purpose_of_transaction,
        high_tax_risk=bool(payload.high_tax_risk),
        tax_risk_notes=payload.tax_risk_notes,
        investment_legitimacy_notes=payload.investment_legitimacy_notes,
        analyst_notes=payload.analyst_notes,
        created_by=current_user.id,
    )
    record.enhanced_risk_score = compute_ecdd_score(record)
    record.recommendation = determine_recommendation(
        record.enhanced_risk_score, record.pep_status, record.adverse_media_found
    )
    db.add(record)
    db.commit()
    db.refresh(record)

    audit_service.log_action(
        db,
        action="ecdd_created",
        entity_type="ecdd_record",
        entity_id=record.id,
        actor=current_user.email,
        actor_role=current_user.role.value if current_user.role else None,
        organisation_id=org_id,
        after_state={
            "ecdd_id": record.ecdd_id,
            "enhanced_risk_score": record.enhanced_risk_score,
            "recommendation": record.recommendation,
        },
    )
    return record


@router.patch("/ecdd/{ecdd_id}/decision", response_model=ECDDResponse)
def decide_ecdd(
    ecdd_id: str,
    payload: ECDDDecisionRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_compliance_or_above),
):
    """
    Manually accept, reject, or revert an ECDD assessment. Reversible: a
    completed/rejected record can be moved back to any other status (e.g.
    to correct a mistaken decision) — every change is timestamped via
    last_revised_at and logged to AuditLog with the supplied decision_notes
    rationale, so the full revision history is auditable without a bespoke
    history table.
    """
    org_id = org_id_for(current_user)
    record = _get_ecdd_or_404(ecdd_id, org_id, db)

    try:
        new_status = ECDDStatus(payload.status)
    except ValueError:
        raise HTTPException(
            400, f"status must be one of {[s.value for s in ECDDStatus]}"
        )
    if not payload.decision_notes.strip():
        raise HTTPException(
            400,
            "decision_notes is required — record why this customer was accepted, rejected, or reverted.",
        )

    rejection_type: Optional[ECDDRejectionType] = None
    if new_status == ECDDStatus.rejected:
        if not payload.rejection_type:
            raise HTTPException(
                400,
                "rejection_type is required when rejecting — "
                f"one of {[t.value for t in ECDDRejectionType]}",
            )
        try:
            rejection_type = ECDDRejectionType(payload.rejection_type)
        except ValueError:
            raise HTTPException(
                400,
                f"rejection_type must be one of {[t.value for t in ECDDRejectionType]}",
            )

    before_status = record.status.value
    now = datetime.now(timezone.utc)
    record.status = new_status
    # Only meaningful while status == rejected -- cleared on any re-decision
    # that moves the record to a different status (e.g. a mistaken rejection
    # reverted to pending), so a stale value never lingers.
    record.rejection_type = rejection_type
    record.decision_notes = payload.decision_notes
    record.decided_by = current_user.id
    record.decided_at = now
    record.last_revised_at = now
    db.commit()
    db.refresh(record)

    audit_service.log_action(
        db,
        action="ecdd_decision",
        entity_type="ecdd_record",
        entity_id=record.id,
        actor=current_user.email,
        actor_role=current_user.role.value if current_user.role else None,
        organisation_id=org_id,
        before_state={"status": before_status},
        after_state={
            "status": new_status.value,
            "rejection_type": rejection_type.value if rejection_type else None,
        },
        notes=payload.decision_notes,
    )
    return record
