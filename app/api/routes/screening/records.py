"""
Screening — the screening record lifecycle: run, list, get, re-screen. Part
of the screening route package; see __init__.py for the combined router.

Route registration order: get_screening_record's GET /{record_id} is a
single-segment path-parameter route, so __init__.py must register
dashboard.py's GET /dashboard and alerts.py's GET /alerts before this
file's router — otherwise those literal paths would be shadowed. See
__init__.py.
"""

from typing import Optional
from uuid import uuid4

from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException, Query
from sqlalchemy.orm import Session

from app.api.deps import (
    Pagination,
    org_id_for,
    require_analyst_or_above,
    require_compliance_or_above,
)
from app.db.database import get_db
from app.models.screening import (
    AlertSeverity,
    AlertStatus,
    ScreeningAlert,
    ScreeningRecord,
    ScreeningStatus,
    ScreeningType,
)
from app.models.user import User
from app.schemas.screening import ScreeningRunRequest
from app.services import billing_service as billing_svc
from app.services.api_key_service import dispatch_event_background
from app.worker import add_background_task

from ._shared import (
    _PEP_TYPES,
    _SANCTIONS_TYPES,
    DISCLAIMER,
    _log,
    _record_dict,
    _resolve_customer,
    _screen,
)

router = APIRouter()


def _severity_for_type(
    screening_type: ScreeningType, match_count: int
) -> AlertSeverity:
    if screening_type == ScreeningType.sanctions:
        return AlertSeverity.critical
    if screening_type in (ScreeningType.pep, ScreeningType.ubo_pep):
        return AlertSeverity.high
    if screening_type == ScreeningType.adverse_media:
        return AlertSeverity.medium
    return AlertSeverity.medium


@router.post("/run", status_code=201)
async def run_screening(
    payload: ScreeningRunRequest,
    background_tasks: BackgroundTasks,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_compliance_or_above),
):
    """
    Run one or more screening types for a customer.

    Each type creates a separate ScreeningRecord (append-only).
    Matches above threshold automatically raise ScreeningAlerts.

    Sanctions/PEP (and their ubo_* variants) route to the real configured
    provider (SANCTIONS_PROVIDER / PEP_PROVIDER — see app/config.py).
    Every other screening type (watchlist, adverse_media, regulatory,
    law_enforcement, ubo_adverse, manual_review) has no provider integration
    yet and still runs in simulation mode.

    DISCLAIMER: Screening results are not compliance determinations.
    """
    org_id = org_id_for(current_user)
    customer = _resolve_customer(payload.customer_id, org_id, db)

    real_count = sum(
        1 for stype in payload.screening_types if stype in _SANCTIONS_TYPES | _PEP_TYPES
    )
    billing_svc.enforce_screening_limit(db, org_id, additional=real_count)

    entity_id = payload.entity_id or customer.id
    entity_name = (
        payload.entity_name or getattr(customer, "full_name", None) or customer.id
    )

    created_records = []
    matched_record_ids = []
    alerts_for_webhook = []
    for stype in payload.screening_types:
        result = await _screen(
            stype,
            entity_name,
            payload.provider,
            payload.entity_dob,
            payload.entity_nationality,
        )

        record = ScreeningRecord(
            id=f"scr_{uuid4().hex[:12]}",
            org_id=org_id,
            customer_id=customer.id,
            screening_type=stype,
            entity_type=payload.entity_type,
            entity_id=entity_id,
            entity_name=entity_name,
            entity_dob=payload.entity_dob,
            entity_nationality=payload.entity_nationality,
            provider=payload.provider,
            provider_reference=result.get("provider_reference"),
            status=result["status"],
            match_count=result.get("match_count", 0),
            match_score=result.get("match_score"),
            match_details=result.get("match_details"),
            triggered_by=current_user.id,
        )
        db.add(record)
        db.flush()

        # Raise alert on any match
        if (
            result["match_count"] > 0
            or result["status"] == ScreeningStatus.potential_match
        ):
            alert = ScreeningAlert(
                id=f"alert_{uuid4().hex[:10]}",
                org_id=org_id,
                screening_record_id=record.id,
                customer_id=customer.id,
                severity=_severity_for_type(stype, result["match_count"]),
                status=AlertStatus.open,
                alert_type=stype.value,
                summary=(
                    f"{stype.value.upper()} screening: {result['match_count']} "
                    f"potential match(es) found for '{entity_name}'. "
                    "Review required before proceeding."
                ),
            )
            db.add(alert)
            matched_record_ids.append(record.id)
            alerts_for_webhook.append(alert)

        created_records.append(record)

    db.commit()
    for r in created_records:
        db.refresh(r)

    for alert in alerts_for_webhook:
        db.refresh(alert)
        add_background_task(
            background_tasks,
            dispatch_event_background,
            "aml_alert.created",
            {
                "alert_id": alert.id,
                "customer_id": alert.customer_id,
                "severity": alert.severity.value,
                "alert_type": alert.alert_type,
                "summary": alert.summary,
            },
            org_id,
        )

    for r in created_records:
        _log(
            db,
            current_user,
            org_id,
            "screening_record",
            r.id,
            action="screening_run",
            after_state={
                "customer_id": customer.id,
                "screening_type": r.screening_type.value,
                "status": r.status.value,
                "match_count": r.match_count,
            },
        )

    if matched_record_ids:
        from app.models.automation_rule import RuleEventType
        from app.services.automation_engine import evaluate_automation_rules

        matched_records = [r for r in created_records if r.id in matched_record_ids]
        for r in matched_records:
            evaluate_automation_rules(
                db,
                RuleEventType.screening_match,
                org_id,
                "customer",
                customer.id,
                {
                    "screening": {
                        "screening_type": r.screening_type.value
                        if hasattr(r.screening_type, "value")
                        else r.screening_type,
                        "status": r.status.value
                        if hasattr(r.status, "value")
                        else r.status,
                        "match_count": r.match_count,
                        "match_score": r.match_score,
                    }
                },
                triggered_by=current_user.id,
            )

    return {
        "records_created": len(created_records),
        "records": [_record_dict(r) for r in created_records],
        "disclaimer": DISCLAIMER,
    }


@router.get("")
def list_screening_records(
    customer_id: Optional[str] = Query(None),
    screening_type: Optional[ScreeningType] = Query(None),
    status: Optional[ScreeningStatus] = Query(None),
    has_alerts: Optional[bool] = Query(None),
    db: Session = Depends(get_db),
    current_user: User = Depends(require_analyst_or_above),
    page: Pagination = Depends(),
):
    """List screening records for this org with optional filters."""
    org_id = org_id_for(current_user)
    q = db.query(ScreeningRecord).filter(ScreeningRecord.org_id == org_id)

    if customer_id:
        q = q.filter(ScreeningRecord.customer_id == customer_id)
    if screening_type:
        q = q.filter(ScreeningRecord.screening_type == screening_type)
    if status:
        q = q.filter(ScreeningRecord.status == status)

    records = (
        q.order_by(ScreeningRecord.screened_at.desc())
        .offset(page.offset)
        .limit(page.page_size)
        .all()
    )

    if has_alerts is not None:
        if has_alerts:
            records = [r for r in records if r.alerts]
        else:
            records = [r for r in records if not r.alerts]

    return {
        "records": [_record_dict(r) for r in records],
        "count": len(records),
        "disclaimer": DISCLAIMER,
    }


@router.get("/{record_id}")
def get_screening_record(
    record_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_analyst_or_above),
):
    """Get a specific screening record with its alerts."""
    org_id = org_id_for(current_user)
    record = (
        db.query(ScreeningRecord)
        .filter(
            ScreeningRecord.id == record_id,
            ScreeningRecord.org_id == org_id,
        )
        .first()
    )
    if not record:
        raise HTTPException(404, "Screening record not found.")
    return _record_dict(record)


@router.post("/{record_id}/re-screen", status_code=201)
async def re_screen(
    record_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_compliance_or_above),
):
    """
    Trigger a new screening run based on an existing record.
    Creates a fresh ScreeningRecord — previous records are preserved (append-only audit trail).
    """
    org_id = org_id_for(current_user)
    original = (
        db.query(ScreeningRecord)
        .filter(
            ScreeningRecord.id == record_id,
            ScreeningRecord.org_id == org_id,
        )
        .first()
    )
    if not original:
        raise HTTPException(404, "Screening record not found.")

    if original.screening_type in _SANCTIONS_TYPES | _PEP_TYPES:
        billing_svc.enforce_screening_limit(db, org_id, additional=1)

    result = await _screen(
        original.screening_type,
        original.entity_name or "",
        original.provider,
        original.entity_dob,
        original.entity_nationality,
    )

    new_record = ScreeningRecord(
        id=f"scr_{uuid4().hex[:12]}",
        org_id=org_id,
        customer_id=original.customer_id,
        screening_type=original.screening_type,
        entity_type=original.entity_type,
        entity_id=original.entity_id,
        entity_name=original.entity_name,
        entity_dob=original.entity_dob,
        entity_nationality=original.entity_nationality,
        provider=original.provider,
        provider_reference=result.get("provider_reference"),
        status=result["status"],
        match_count=result.get("match_count", 0),
        match_score=result.get("match_score"),
        match_details=result.get("match_details"),
        triggered_by=current_user.id,
    )
    db.add(new_record)
    db.commit()
    db.refresh(new_record)
    _log(
        db,
        current_user,
        org_id,
        "screening_record",
        new_record.id,
        action="screening_rescreened",
        after_state={
            "original_record_id": record_id,
            "status": new_record.status.value,
            "match_count": new_record.match_count,
        },
    )
    return {
        "message": "Re-screening record created.",
        "record": _record_dict(new_record),
        "disclaimer": DISCLAIMER,
    }
