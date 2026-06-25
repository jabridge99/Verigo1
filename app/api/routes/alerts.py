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

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session

from app.api.deps import (
    Pagination,
    org_id_for,
    require_analyst_or_above,
    require_compliance_or_above,
    require_mlro_or_above,
)
from app.db.database import get_db
from app.models.case import Case, CaseAlert
from app.models.monitoring import (
    AlertCategory,
    AlertResult,
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
    AlertResultRequest,
    AlertReviewRequest,
)
from app.services import audit_service

router = APIRouter(prefix="/alerts", tags=["Alerts"])

DISCLAIMER = (
    "Alerts are generated for human review only. "
    "No alert constitutes a finding of suspicious activity or criminal conduct. "
    "Decisions to lodge Suspicious Matter Reports remain entirely with the reporting entity."
)


def _get_alert_or_404(alert_id: str, org_id: str, db: Session) -> TransactionAlert:
    alert = (
        db.query(TransactionAlert)
        .filter(
            TransactionAlert.id == alert_id,
            TransactionAlert.org_id == org_id,
        )
        .first()
    )
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
        TransactionAlert.status.notin_(
            [
                AlertStatus.dismissed,
                AlertStatus.resolved,
            ]
        )
    ).count()
    smr_candidates = q.filter(TransactionAlert.is_smr_candidate.is_(True)).count()

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
    audit_service.log_action(
        db,
        action="alert_assigned",
        entity_type="alert",
        entity_id=alert.id,
        actor=current_user.email,
        actor_role=current_user.role.value if current_user.role else None,
        organisation_id=org_id_for(current_user),
        after_state={"assigned_to": payload.assign_to, "status": alert.status.value},
    )
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
    # Dismissing/clearing an AML alert without a recorded reason leaves no
    # audit trail for why a potentially suspicious transaction was waved
    # through — require a non-empty explanation for those resolutions.
    if payload.resolution in ("dismissed", "cleared") and not (
        payload.review_notes and payload.review_notes.strip()
    ):
        raise HTTPException(
            status_code=400,
            detail="review_notes is required when dismissing or clearing an alert",
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
    audit_service.log_action(
        db,
        action="alert_reviewed",
        entity_type="alert",
        entity_id=alert.id,
        actor=current_user.email,
        actor_role=current_user.role.value if current_user.role else None,
        organisation_id=org_id_for(current_user),
        after_state={
            "resolution": alert.resolution,
            "status": alert.status.value,
            "is_false_positive": alert.is_false_positive,
        },
        notes=payload.review_notes,
    )
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
    audit_service.log_action(
        db,
        action="alert_escalated",
        entity_type="alert",
        entity_id=alert.id,
        actor=current_user.email,
        actor_role=current_user.role.value if current_user.role else None,
        organisation_id=org_id_for(current_user),
        after_state={"escalated_to": payload.escalate_to, "status": alert.status.value},
        notes=payload.escalation_reason,
    )
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
    audit_service.log_action(
        db,
        action="alert_flagged_smr_candidate",
        entity_type="alert",
        entity_id=alert.id,
        actor=current_user.email,
        actor_role=current_user.role.value if current_user.role else None,
        organisation_id=org_id_for(current_user),
        after_state={"is_smr_candidate": True, "status": alert.status.value},
    )
    return alert


@router.post("/{alert_id}/record-result", response_model=AlertOut)
def record_result(
    alert_id: str,
    payload: AlertResultRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_compliance_or_above),
):
    """
    Record what happened AFTER the monitoring review decision.

    This is separate from `status` (workflow state):
      status  — where the alert is in the review workflow
                (generated → assigned → under_review → resolved / dismissed)
      result  — what action was taken as a consequence of the decision
                (no_action_required, transaction_released, transaction_blocked,
                 edd_initiated, case_opened, smr_filed, ttr_lodged, customer_exited, ...)

    The result can be set or updated at any point after review begins.
    Changing a result is audit-logged via result_set_by / result_set_at.

    DISCLAIMER: Recording a result is a compliance workflow action only.
    It does not constitute a regulatory determination or submission.
    SMR lodgement, TTR/IFTI reporting, and all AUSTRAC obligations remain
    with the reporting entity.
    """
    alert = _get_alert_or_404(alert_id, org_id_for(current_user), db)

    alert.result = payload.result
    alert.result_notes = payload.result_notes
    alert.result_set_by = current_user.id
    alert.result_set_at = datetime.now(timezone.utc)

    # Auto-advance status to resolved when a definitive result is recorded
    _definitive = {
        AlertResult.no_action_required,
        AlertResult.transaction_released,
        AlertResult.transaction_blocked,
        AlertResult.transaction_returned,
        AlertResult.smr_filed,
        AlertResult.ttr_lodged,
        AlertResult.ifti_reported,
        AlertResult.referred_law_enforcement,
        AlertResult.customer_exited,
        AlertResult.customer_restricted,
    }
    if payload.result in _definitive and alert.status not in (
        AlertStatus.dismissed,
        AlertStatus.resolved,
    ):
        alert.status = AlertStatus.resolved
        alert.resolved_by = current_user.id
        alert.resolved_at = datetime.now(timezone.utc)

    db.commit()
    db.refresh(alert)
    audit_service.log_action(
        db,
        action="alert_result_recorded",
        entity_type="alert",
        entity_id=alert.id,
        actor=current_user.email,
        actor_role=current_user.role.value if current_user.role else None,
        organisation_id=org_id_for(current_user),
        after_state={
            "result": alert.result.value if alert.result else None,
            "status": alert.status.value,
        },
        notes=payload.result_notes,
    )
    return alert


@router.post("/{alert_id}/create-case", status_code=201)
def create_case_from_alert(
    alert_id: str,
    title: Optional[str] = None,
    description: Optional[str] = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_compliance_or_above),
):
    """
    Convenience endpoint — create a compliance case pre-linked to this alert.

    Creates the Case, links the alert via CaseAlert, and sets the alert status
    to escalated. The case is opened in 'open' state for further investigation.

    DISCLAIMER: Opening a case does not constitute suspicion of criminal activity.
    Case management supports the compliance workflow only.
    """
    from datetime import datetime, timezone
    from uuid import uuid4

    from app.models.case import CaseSeverity, CaseType

    org_id = org_id_for(current_user)
    alert = _get_alert_or_404(alert_id, org_id, db)

    if alert.status in (AlertStatus.dismissed, AlertStatus.resolved):
        raise HTTPException(409, "Cannot create a case from a closed alert.")

    # Derive severity from alert
    sev_map = {"low": "low", "medium": "medium", "high": "high", "critical": "critical"}
    case_severity = CaseSeverity(sev_map.get(alert.severity.value, "medium"))

    case_ref = f"CASE-{uuid4().hex[:8].upper()}"
    case = Case(
        id=f"case_{uuid4().hex[:12]}",
        case_ref=case_ref,
        org_id=org_id,
        customer_id=alert.customer_id,
        case_type=CaseType.smr_candidate
        if alert.is_smr_candidate
        else CaseType.internal_investigation,
        severity=case_severity,
        title=title or f"Investigation — {alert.title}",
        description=description
        or (
            f"Case opened from alert {alert.alert_ref}. "
            f"Alert category: {alert.category.value}. "
            f"Alert score: {alert.alert_score:.1f}/100."
        ),
        is_smr_candidate=alert.is_smr_candidate,
        created_by=current_user.id,
    )
    db.add(case)

    link = CaseAlert(
        id=f"cal_{uuid4().hex[:10]}",
        case_id=case.id,
        alert_id=alert.id,
        transaction_id=alert.transaction_id,
        org_id=org_id,
        added_by=current_user.id,
        notes=f"Alert linked at case creation via /alerts/{alert_id}/create-case",
    )
    db.add(link)

    alert.status = AlertStatus.escalated
    alert.escalated_at = datetime.now(timezone.utc)
    alert.escalation_reason = f"Case {case_ref} opened"

    db.commit()
    db.refresh(case)

    return {
        "case_id": case.id,
        "case_ref": case_ref,
        "alert_id": alert_id,
        "status": "open",
        "message": f"Case {case_ref} created and linked to alert {alert.alert_ref}.",
        "disclaimer": DISCLAIMER,
    }


@router.get("/{alert_id}/recommendations")
def get_alert_recommendations(
    alert_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_analyst_or_above),
):
    """Regulatory recommendations linked to this alert."""
    from app.models.regulatory_recommendation import RegulatoryRecommendation

    org_id = org_id_for(current_user)
    _get_alert_or_404(alert_id, org_id, db)

    recs = (
        db.query(RegulatoryRecommendation)
        .filter(
            RegulatoryRecommendation.alert_id == alert_id,
            RegulatoryRecommendation.org_id == org_id,
        )
        .order_by(RegulatoryRecommendation.created_at.desc())
        .all()
    )
    return {
        "alert_id": alert_id,
        "recommendations": [
            {
                "id": r.id,
                "recommendation_type": r.recommendation_type.value,
                "priority": r.priority.value,
                "status": r.status.value,
                "title": r.title,
                "recommendation_text": r.recommendation_text,
                "regulatory_basis": r.regulatory_basis,
                "created_at": r.created_at,
            }
            for r in recs
        ],
        "disclaimer": DISCLAIMER,
    }
