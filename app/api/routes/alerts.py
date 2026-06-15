"""
Alert Management API — transaction alert workflow.

Roles:
  GET  /alerts — analyst+
  GET  /alerts/{id} — analyst+
  POST /alerts/{id}/assign — compliance+
  POST /alerts/{id}/review — compliance+
  POST /alerts/{id}/escalate — compliance+
  POST /alerts/{id}/flag-smr — mlro+

DISCLAIMER: Alerts are indicators for human review. No alert constitutes a
determination of suspicious activity or a requirement to lodge an SMR.
"""
from datetime import datetime, timezone
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session

from app.api.deps import (
    Pagination,
    org_id_for,
    require_analyst_or_above,
    require_compliance_or_above,
    require_mlro_or_above,
)
from app.db.database import get_db
from app.models.monitoring import (
    AlertCategory,
    AlertSeverity,
    AlertStatus,
    TransactionAlert,
)
from app.models.user import User
from app.schemas.monitoring import (
    AlertAssignRequest,
    AlertEscalateRequest,
    AlertListOut,
    AlertOut,
    AlertReviewRequest,
)

router = APIRouter(prefix="/alerts", tags=["Alerts"])

DISCLAIMER = (
    "Alerts are generated for human review only. "
    "No alert constitutes a finding of suspicious activity or criminal conduct. "
    "Decisions to lodge Suspicious Matter Reports remain entirely with the reporting entity."
)


def _get_alert_or_404(alert_id: str, org_id: str, db: Session) -> TransactionAlert:
    alert = db.query(TransactionAlert).filter(
        TransactionAlert.id == alert_id,
        TransactionAlert.org_id == org_id,
    ).first()
    if not alert:
        raise HTTPException(status_code=404, detail="Alert not found.")
    return alert


@router.get("", response_model=list[AlertListOut])
def list_alerts(
    customer_id: Optional[str] = Query(None),
    alert_status: Optional[AlertStatus] = Query(None),
    severity: Optional[AlertSeverity] = Query(None),
    category: Optional[AlertCategory] = Query(None),
    is_smr_candidate: Optional[bool] = Query(None),
    assigned_to: Optional[str] = Query(None),
    pagination: Pagination = Depends(),
    db: Session = Depends(get_db),
    current_user: User = Depends(require_analyst_or_above),
):
    org_id = org_id_for(current_user)
    q = db.query(TransactionAlert).filter(TransactionAlert.org_id == org_id)

    if customer_id:
        q = q.filter(TransactionAlert.customer_id == customer_id)
    if alert_status:
        q = q.filter(TransactionAlert.status == alert_status)
    if severity:
        q = q.filter(TransactionAlert.severity == severity)
    if category:
        q = q.filter(TransactionAlert.category == category)
    if is_smr_candidate is not None:
        q = q.filter(TransactionAlert.is_smr_candidate == is_smr_candidate)
    if assigned_to:
        q = q.filter(TransactionAlert.assigned_to == assigned_to)

    q = q.order_by(TransactionAlert.trigger_date.desc())
    return pagination.apply(q).all()


@router.get("/dashboard")
def alert_dashboard(
    db: Session = Depends(get_db),
    current_user: User = Depends(require_analyst_or_above),
):
    """Alert queue summary for dashboard."""
    org_id = org_id_for(current_user)
    q = db.query(TransactionAlert).filter(TransactionAlert.org_id == org_id)

    total = q.count()
    open_alerts = q.filter(
        TransactionAlert.status.not_in([
            AlertStatus.dismissed, AlertStatus.resolved,
        ])
    ).count()
    smr_candidates = q.filter(TransactionAlert.is_smr_candidate == True).count()

    by_severity = {}
    for sev in AlertSeverity:
        by_severity[sev.value] = q.filter(TransactionAlert.severity == sev).count()

    by_status = {}
    for st in AlertStatus:
        by_status[st.value] = q.filter(TransactionAlert.status == st).count()

    return {
        "total_alerts": total,
        "open_alerts": open_alerts,
        "smr_candidates": smr_candidates,
        "by_severity": by_severity,
        "by_status": by_status,
        "disclaimer": DISCLAIMER,
    }


@router.get("/{alert_id}", response_model=AlertOut)
def get_alert(
    alert_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_analyst_or_above),
):
    return _get_alert_or_404(alert_id, org_id_for(current_user), db)


@router.post("/{alert_id}/assign", response_model=AlertOut)
def assign_alert(
    alert_id: str,
    payload: AlertAssignRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_compliance_or_above),
):
    alert = _get_alert_or_404(alert_id, org_id_for(current_user), db)

    if alert.status in (AlertStatus.dismissed, AlertStatus.resolved):
        raise HTTPException(status_code=409, detail="Cannot assign a closed alert.")

    alert.assigned_to = payload.assign_to
    alert.assigned_at = datetime.now(timezone.utc)
    alert.assigned_by = current_user.id
    alert.status = AlertStatus.assigned
    db.commit()
    db.refresh(alert)
    return alert


@router.post("/{alert_id}/review", response_model=AlertOut)
def review_alert(
    alert_id: str,
    payload: AlertReviewRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_compliance_or_above),
):
    """
    Submit a review decision on an alert.
    resolution: dismissed | escalated_to_case | smr_candidate | cleared
    """
    alert = _get_alert_or_404(alert_id, org_id_for(current_user), db)

    if alert.status in (AlertStatus.dismissed, AlertStatus.resolved):
        raise HTTPException(status_code=409, detail="Alert is already closed.")

    valid_resolutions = {"dismissed", "escalated_to_case", "smr_candidate", "cleared"}
    if payload.resolution not in valid_resolutions:
        raise HTTPException(
            status_code=400,
            detail=f"resolution must be one of: {', '.join(valid_resolutions)}",
        )

    alert.reviewed_by = current_user.id
    alert.reviewed_at = datetime.now(timezone.utc)
    alert.review_notes = payload.review_notes
    alert.is_false_positive = payload.is_false_positive
    alert.resolution = payload.resolution
    alert.resolution_notes = payload.review_notes

    if payload.resolution == "dismissed":
        alert.status = AlertStatus.dismissed
        alert.resolved_by = current_user.id
        alert.resolved_at = datetime.now(timezone.utc)
    elif payload.resolution == "cleared":
        alert.status = AlertStatus.resolved
        alert.resolved_by = current_user.id
        alert.resolved_at = datetime.now(timezone.utc)
    elif payload.resolution == "smr_candidate":
        alert.status = AlertStatus.smr_candidate
        alert.is_smr_candidate = True
    else:
        alert.status = AlertStatus.resolved

    db.commit()
    db.refresh(alert)
    return alert


@router.post("/{alert_id}/escalate", response_model=AlertOut)
def escalate_alert(
    alert_id: str,
    payload: AlertEscalateRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_compliance_or_above),
):
    alert = _get_alert_or_404(alert_id, org_id_for(current_user), db)

    if alert.status in (AlertStatus.dismissed, AlertStatus.resolved):
        raise HTTPException(status_code=409, detail="Cannot escalate a closed alert.")

    alert.escalated_to = payload.escalate_to
    alert.escalated_at = datetime.now(timezone.utc)
    alert.escalation_reason = payload.escalation_reason
    alert.status = AlertStatus.escalated
    db.commit()
    db.refresh(alert)
    return alert


@router.post("/{alert_id}/flag-smr", response_model=AlertOut)
def flag_smr_candidate(
    alert_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_mlro_or_above),
):
    """
    MLRO flags an alert as requiring SMR consideration.

    DISCLAIMER: This flag supports the MLRO's workflow. The decision to lodge
    a Suspicious Matter Report remains entirely with the reporting entity.
    """
    alert = _get_alert_or_404(alert_id, org_id_for(current_user), db)

    alert.is_smr_candidate = True
    alert.status = AlertStatus.smr_candidate
    db.commit()
    db.refresh(alert)
    return alert
