"""
Customers — per-customer screening: trigger/review sanctions-PEP-etc
screening records, crypto wallet screening, and screening alerts. Part of
the customers route package; see __init__.py for the combined router.

Not to be confused with the standalone Screening Hub at
app.api.routes.screening — this module is the customer-scoped subset of
screening actions nested under /customers/{customer_id}/...
"""

from datetime import datetime, timezone
from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session

from app.api.deps import (
    org_id_for,
    require_analyst_or_above,
    require_compliance_or_above,
)
from app.db.database import get_db
from app.models.audit_log import AuditEventType, AuditLog
from app.models.customer import Customer
from app.models.screening import (
    CryptoWalletScreening,
    ScreeningAlert,
    ScreeningEntityType,
    ScreeningRecord,
    ScreeningStatus,
    ScreeningType,
)
from app.models.user import User
from app.schemas.customer import (
    AlertResponse,
    AlertUpdateRequest,
    ScreeningRecordResponse,
    ScreeningReviewUpdate,
    ScreeningTriggerRequest,
    WalletScreeningCreate,
    WalletScreeningResponse,
)

from ._shared import _get_customer, _update_checklist_flag

router = APIRouter()

# Maps a screening type to the checklist flag it satisfies once the result is clear.
_SCREENING_CHECKLIST_FLAG = {
    ScreeningType.pep: "pep_screened",
    ScreeningType.sanctions: "sanctions_screened",
    ScreeningType.adverse_media: "adverse_media_screened",
    ScreeningType.ubo_pep: "ubo_screened",
    ScreeningType.ubo_sanctions: "ubo_screened",
}


# ── Screening ──────────────────────────────────────────────────────────────────


@router.post(
    "/{customer_id}/screen",
    response_model=List[ScreeningRecordResponse],
    status_code=201,
)
def trigger_screening(
    customer_id: str,
    payload: ScreeningTriggerRequest,
    current_user: User = Depends(require_analyst_or_above),
    db: Session = Depends(get_db),
):
    """
    Trigger one or more screening types against a customer or UBO.
    Results are stored immediately as 'pending'; background job updates them.
    """
    customer = _get_customer(customer_id, org_id_for(current_user), db)
    entity_id = payload.entity_id or customer.id
    entity_name = customer.full_name

    results = []
    for stype in payload.screening_types:
        rec = ScreeningRecord(
            org_id=customer.org_id,
            customer_id=customer.id,
            screening_type=stype,
            entity_type=ScreeningEntityType(payload.entity_type or "customer"),
            entity_id=entity_id,
            entity_name=entity_name,
            provider=payload.provider,
            status=ScreeningStatus.pending,
            triggered_by=current_user.id,
        )
        db.add(rec)
        results.append(rec)

    db.flush()

    # NOTE: checklist "screened" flags are intentionally NOT set here. Triggering
    # a screening only means a check was *requested* (status=pending) — it is not
    # evidence the customer is clear. Flags are only flipped to True once a result
    # comes back clear, in review_screening_result below. Setting them here let
    # customers pass the activation gate in update_customer_status while their
    # sanctions/PEP screening was still pending or had come back a confirmed match.

    db.add(
        AuditLog(
            org_id=customer.org_id,
            actor_id=current_user.id,
            event_type=AuditEventType.screening_completed,
            action="customer.screening.triggered",
            object_type="Customer",
            object_id=customer.id,
            new_value={
                "types": [t.value for t in payload.screening_types],
                "provider": payload.provider.value,
            },
        )
    )
    db.commit()
    for r in results:
        db.refresh(r)
    return results


@router.get("/{customer_id}/screening", response_model=List[ScreeningRecordResponse])
def list_screening_records(
    customer_id: str,
    screening_type: Optional[ScreeningType] = Query(None),
    current_user: User = Depends(require_analyst_or_above),
    db: Session = Depends(get_db),
):
    _get_customer(customer_id, org_id_for(current_user), db)
    q = db.query(ScreeningRecord).filter(ScreeningRecord.customer_id == customer_id)
    if screening_type:
        q = q.filter(ScreeningRecord.screening_type == screening_type)
    return q.order_by(ScreeningRecord.screened_at.desc()).all()


@router.patch(
    "/{customer_id}/screening/{record_id}/review",
    response_model=ScreeningRecordResponse,
)
def review_screening_result(
    customer_id: str,
    record_id: str,
    payload: ScreeningReviewUpdate,
    current_user: User = Depends(require_compliance_or_above),
    db: Session = Depends(get_db),
):
    _get_customer(customer_id, org_id_for(current_user), db)
    rec = (
        db.query(ScreeningRecord)
        .filter(
            ScreeningRecord.id == record_id,
            ScreeningRecord.customer_id == customer_id,
        )
        .first()
    )
    if not rec:
        raise HTTPException(404, "Screening record not found")
    rec.status = payload.status
    rec.reviewer_notes = payload.reviewer_notes
    rec.is_false_positive = payload.is_false_positive
    rec.reviewed_by = current_user.id
    rec.reviewed_at = datetime.now(timezone.utc)

    flag = _SCREENING_CHECKLIST_FLAG.get(rec.screening_type)
    if flag:
        customer = db.query(Customer).filter(Customer.id == customer_id).first()
        is_clear = payload.status in (
            ScreeningStatus.clear,
            ScreeningStatus.false_positive,
        )
        # Flips the flag back True on a cleared/false-positive result, and back to
        # False (re-blocking activation) if a result that was previously clear is
        # later reclassified as a match.
        _update_checklist_flag(customer, flag, is_clear, db)

    db.commit()
    db.refresh(rec)
    return rec


# ── Crypto Wallet Screening ────────────────────────────────────────────────────


@router.post(
    "/{customer_id}/wallet-screening",
    response_model=WalletScreeningResponse,
    status_code=201,
)
def screen_crypto_wallet(
    customer_id: str,
    payload: WalletScreeningCreate,
    current_user: User = Depends(require_analyst_or_above),
    db: Session = Depends(get_db),
):
    customer = _get_customer(customer_id, org_id_for(current_user), db)
    rec = CryptoWalletScreening(
        org_id=customer.org_id,
        customer_id=customer.id,
        wallet_address=payload.wallet_address,
        network=payload.network,
        wallet_label=payload.wallet_label,
        provider=payload.provider,
        status=ScreeningStatus.pending,
        triggered_by=current_user.id,
    )
    db.add(rec)
    db.commit()
    db.refresh(rec)
    return rec


@router.get(
    "/{customer_id}/wallet-screenings", response_model=List[WalletScreeningResponse]
)
def list_wallet_screenings(
    customer_id: str,
    current_user: User = Depends(require_analyst_or_above),
    db: Session = Depends(get_db),
):
    _get_customer(customer_id, org_id_for(current_user), db)
    return (
        db.query(CryptoWalletScreening)
        .filter(CryptoWalletScreening.customer_id == customer_id)
        .order_by(CryptoWalletScreening.screened_at.desc())
        .all()
    )


# ── Screening Alerts ───────────────────────────────────────────────────────────


@router.get("/{customer_id}/alerts", response_model=List[AlertResponse])
def list_customer_alerts(
    customer_id: str,
    current_user: User = Depends(require_analyst_or_above),
    db: Session = Depends(get_db),
):
    _get_customer(customer_id, org_id_for(current_user), db)
    return (
        db.query(ScreeningAlert)
        .filter(ScreeningAlert.customer_id == customer_id)
        .order_by(ScreeningAlert.created_at.desc())
        .all()
    )


@router.patch("/{customer_id}/alerts/{alert_id}", response_model=AlertResponse)
def resolve_alert(
    customer_id: str,
    alert_id: str,
    payload: AlertUpdateRequest,
    current_user: User = Depends(require_compliance_or_above),
    db: Session = Depends(get_db),
):
    _get_customer(customer_id, org_id_for(current_user), db)
    alert = (
        db.query(ScreeningAlert)
        .filter(
            ScreeningAlert.id == alert_id,
            ScreeningAlert.customer_id == customer_id,
        )
        .first()
    )
    if not alert:
        raise HTTPException(404, "Alert not found")
    alert.status = payload.status
    alert.resolution_notes = payload.resolution_notes
    alert.resolved_by = current_user.id
    alert.resolved_at = datetime.now(timezone.utc)
    if payload.escalated_to:
        alert.escalated_to = payload.escalated_to
        alert.escalated_at = datetime.now(timezone.utc)
    db.commit()
    db.refresh(alert)
    return alert
