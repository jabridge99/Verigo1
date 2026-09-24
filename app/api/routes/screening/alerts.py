"""
Screening — alert listing and management. Part of the screening route
package; see __init__.py for the combined router.
"""

from datetime import datetime, timezone
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query
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
)
from app.models.user import User
from app.schemas.screening import AlertReviewRequest

from ._shared import DISCLAIMER, _alert_dict, _log

router = APIRouter()


@router.get("/alerts")
def list_alerts(
    status: Optional[AlertStatus] = Query(None),
    severity: Optional[AlertSeverity] = Query(None),
    customer_id: Optional[str] = Query(None),
    db: Session = Depends(get_db),
    current_user: User = Depends(require_analyst_or_above),
    page: Pagination = Depends(),
):
    """List all screening alerts for this org."""
    org_id = org_id_for(current_user)
    q = db.query(ScreeningAlert).filter(ScreeningAlert.org_id == org_id)
    if status:
        q = q.filter(ScreeningAlert.status == status)
    if severity:
        q = q.filter(ScreeningAlert.severity == severity)
    if customer_id:
        q = q.filter(ScreeningAlert.customer_id == customer_id)

    alerts = (
        q.order_by(ScreeningAlert.created_at.desc())
        .offset(page.offset)
        .limit(page.page_size)
        .all()
    )
    return {"alerts": [_alert_dict(a) for a in alerts], "count": len(alerts)}


@router.post("/alerts/{alert_id}/review")
def review_alert(
    alert_id: str,
    payload: AlertReviewRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_compliance_or_above),
):
    """
    Action a screening alert.

    Actions:
      dismiss   — mark as false positive; requires notes
      confirm   — confirm the match; triggers EDD consideration
      escalate  — send to MLRO for further review
      close     — close without action (requires notes explaining why)

    DISCLAIMER: The platform does not determine whether a match requires regulatory action.
    All decisions remain with the reporting entity.
    """
    org_id = org_id_for(current_user)
    alert = (
        db.query(ScreeningAlert)
        .filter(
            ScreeningAlert.id == alert_id,
            ScreeningAlert.org_id == org_id,
        )
        .first()
    )
    if not alert:
        raise HTTPException(404, "Alert not found.")

    if alert.status in (AlertStatus.dismissed, AlertStatus.closed):
        raise HTTPException(409, f"Alert is already {alert.status.value}.")

    now = datetime.now(timezone.utc)
    action = payload.action.lower()

    if action == "dismiss":
        alert.status = AlertStatus.dismissed
        alert.resolved_by = current_user.id
        alert.resolved_at = now
        alert.resolution_notes = payload.notes
        # Mark screening record as false positive
        record = (
            db.query(ScreeningRecord)
            .filter(ScreeningRecord.id == alert.screening_record_id)
            .first()
        )
        if record:
            record.is_false_positive = True
            record.status = ScreeningStatus.false_positive
            record.reviewed_by = current_user.id
            record.reviewed_at = now
            record.reviewer_notes = payload.notes

    elif action == "confirm":
        alert.status = AlertStatus.under_review
        alert.resolved_by = current_user.id
        alert.resolution_notes = payload.notes
        record = (
            db.query(ScreeningRecord)
            .filter(ScreeningRecord.id == alert.screening_record_id)
            .first()
        )
        if record:
            record.status = ScreeningStatus.confirmed_match
            record.reviewed_by = current_user.id
            record.reviewed_at = now
            record.reviewer_notes = payload.notes

    elif action == "escalate":
        alert.status = AlertStatus.escalated
        alert.escalated_to = payload.assigned_to
        alert.escalated_at = now
        alert.resolution_notes = payload.notes

    elif action == "close":
        alert.status = AlertStatus.closed
        alert.resolved_by = current_user.id
        alert.resolved_at = now
        alert.resolution_notes = payload.notes

    else:
        raise HTTPException(
            400, f"Unknown action '{action}'. Use: dismiss, confirm, escalate, close."
        )

    if payload.assigned_to and action != "escalate":
        alert.assigned_to = payload.assigned_to
        alert.assigned_at = now

    db.commit()
    db.refresh(alert)
    _log(
        db,
        current_user,
        org_id,
        "screening_alert",
        alert.id,
        action=f"screening_alert_{action}",
        after_state={"status": alert.status.value},
        notes=payload.notes,
    )
    return {
        "alert": _alert_dict(alert),
        "disclaimer": DISCLAIMER,
    }


@router.post("/alerts/{alert_id}/assign")
def assign_alert(
    alert_id: str,
    assigned_to: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_compliance_or_above),
):
    """Assign a screening alert to a reviewer."""
    org_id = org_id_for(current_user)
    alert = (
        db.query(ScreeningAlert)
        .filter(
            ScreeningAlert.id == alert_id,
            ScreeningAlert.org_id == org_id,
        )
        .first()
    )
    if not alert:
        raise HTTPException(404, "Alert not found.")
    alert.assigned_to = assigned_to
    alert.assigned_at = datetime.now(timezone.utc)
    db.commit()
    db.refresh(alert)
    _log(
        db,
        current_user,
        org_id,
        "screening_alert",
        alert.id,
        action="screening_alert_assigned",
        after_state={"assigned_to": assigned_to},
    )
    return _alert_dict(alert)
