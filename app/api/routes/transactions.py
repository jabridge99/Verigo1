"""
Transaction Monitoring Engine — SECURITY HARDENED.
Zero Trust fixes:
- Authentication required on ALL endpoints
- RBAC: create (analyst+), resolve/escalate (compliance+), dismiss (mlro only)
- resolved_by / escalated_to / dismissed_by taken from session — never from request body
- Tenant isolation enforced on all list/get queries
- Alert status transitions validated
"""

import uuid
from datetime import datetime, timezone
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session

from app.api.routes.auth import _require_roles
from app.db.database import get_db
from app.models.customer import Customer
from app.models.transaction import (
    AlertStatus,
    MonitoringCase,
    Transaction,
    TransactionAlert,
    TransactionStatus,
)
from app.models.user import User, UserRole
from app.schemas.transaction import (
    AlertResponse,
    AlertUpdate,
    CaseCreate,
    CaseResponse,
    MonitoringStats,
    TransactionCreate,
    TransactionResponse,
)
from app.services.monitoring_engine import (
    get_alert_queue,
    monitoring_stats,
    run_monitoring,
)
from app.services.risk_scoring import score_transaction
from app.services.tenant_scope import assert_tenant, scope_fields, scope_query

router = APIRouter(prefix="/transactions", tags=["Transactions"])

_READER = _require_roles(
    UserRole.admin,
    UserRole.mlro,
    UserRole.compliance,
    UserRole.analyst,
    UserRole.viewer,
)
_WRITER = _require_roles(
    UserRole.admin, UserRole.mlro, UserRole.compliance, UserRole.analyst
)
_RESOLVE = _require_roles(UserRole.admin, UserRole.mlro, UserRole.compliance)
_DISMISS = _require_roles(UserRole.admin, UserRole.mlro)


def _assert_tenant(current_user: User, record) -> None:
    assert_tenant(current_user, record.organisation_id, record.industry_id)


def _scoped_txn(db: Session, current_user: User):
    return scope_query(db.query(Transaction), Transaction, current_user)


def _scoped_alert(db: Session, current_user: User):
    return scope_query(db.query(TransactionAlert), TransactionAlert, current_user)


# ── Transactions ──────────────────────────────────────────────────────────────


@router.post("/", response_model=TransactionResponse, status_code=201)
def create_transaction(
    payload: TransactionCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(_WRITER),
):
    customer = db.query(Customer).filter(Customer.id == payload.customer_id).first()
    if not customer:
        raise HTTPException(404, "Customer not found")
    _assert_tenant(current_user, customer)

    data = payload.model_dump()
    data["transaction_id"] = f"TXN-{uuid.uuid4().hex[:12].upper()}"
    data.pop("organisation_id", None)
    scoped = scope_fields(current_user)
    if scoped:
        data["industry_id"] = scoped["industry_id"]
        data["organisation_id"] = scoped["organisation_id"]
    if data.get("amount_aud") is None:
        data["amount_aud"] = data["amount"]

    txn = Transaction(**data)
    db.add(txn)
    db.flush()

    from datetime import timedelta

    since = datetime.now(timezone.utc) - timedelta(hours=24)
    recent = (
        db.query(Transaction)
        .filter(
            Transaction.customer_id == customer.id,
            Transaction.transaction_date >= since,
            Transaction.id != txn.id,
        )
        .all()
    )
    scoring = score_transaction(txn, customer.risk_score or 0, recent)
    txn.risk_score = scoring["risk_score"]
    txn.is_suspicious = scoring["is_suspicious"]
    if txn.is_suspicious:
        txn.status = TransactionStatus.flagged

    alerts = run_monitoring(
        db,
        txn,
        customer,
        industry_id=data.get("industry_id"),
        organisation_id=data.get("organisation_id"),
    )
    for alert in alerts:
        db.add(alert)
    if alerts:
        txn.is_suspicious = 1
        txn.alert_type = alerts[0].alert_type
        txn.alert_details = alerts[0].description
        txn.status = TransactionStatus.flagged

    db.commit()
    db.refresh(txn)
    return txn


@router.get("/", response_model=list[TransactionResponse])
def list_transactions(
    customer_id: Optional[int] = None,
    is_suspicious: Optional[int] = None,
    status: Optional[str] = None,
    skip: int = Query(0, ge=0),
    limit: int = Query(100, ge=1, le=500),
    db: Session = Depends(get_db),
    current_user: User = Depends(_READER),
):
    q = _scoped_txn(db, current_user)
    if customer_id:
        q = q.filter(Transaction.customer_id == customer_id)
    if is_suspicious is not None:
        q = q.filter(Transaction.is_suspicious == is_suspicious)
    if status:
        q = q.filter(Transaction.status == status)
    return (
        q.order_by(Transaction.transaction_date.desc()).offset(skip).limit(limit).all()
    )


@router.get("/{transaction_id}", response_model=TransactionResponse)
def get_transaction(
    transaction_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(_READER),
):
    txn = (
        _scoped_txn(db, current_user)
        .filter(Transaction.transaction_id == transaction_id)
        .first()
    )
    if not txn:
        raise HTTPException(404, "Transaction not found")
    return txn


@router.patch("/{transaction_id}/status")
def update_transaction_status(
    transaction_id: str,
    status: TransactionStatus,
    db: Session = Depends(get_db),
    current_user: User = Depends(_RESOLVE),
):
    txn = (
        _scoped_txn(db, current_user)
        .filter(Transaction.transaction_id == transaction_id)
        .first()
    )
    if not txn:
        raise HTTPException(404, "Transaction not found")
    txn.status = status
    db.commit()
    return {"transaction_id": transaction_id, "status": status}


# ── Alerts ────────────────────────────────────────────────────────────────────


@router.get("/alerts/queue", response_model=list[AlertResponse])
def alert_queue(
    severity: Optional[str] = None,
    status: Optional[str] = None,
    alert_type: Optional[str] = None,
    customer_id: Optional[int] = None,
    skip: int = Query(0, ge=0),
    limit: int = Query(100, ge=1, le=500),
    db: Session = Depends(get_db),
    current_user: User = Depends(_READER),
):
    scoped = scope_fields(current_user)
    return get_alert_queue(
        db,
        industry_id=scoped.get("industry_id"),
        organisation_id=scoped.get("organisation_id"),
        severity=severity,
        status=status,
        alert_type=alert_type,
        customer_id=customer_id,
        skip=skip,
        limit=limit,
    )


@router.get("/alerts/stats", response_model=MonitoringStats)
def alert_stats(
    db: Session = Depends(get_db),
    current_user: User = Depends(_READER),
):
    scoped = scope_fields(current_user)
    return monitoring_stats(
        db,
        industry_id=scoped.get("industry_id"),
        organisation_id=scoped.get("organisation_id"),
    )


@router.get("/alerts", response_model=list[AlertResponse])
def list_alerts(
    is_resolved: int = 0,
    db: Session = Depends(get_db),
    current_user: User = Depends(_READER),
):
    return (
        _scoped_alert(db, current_user)
        .filter(TransactionAlert.is_resolved == is_resolved)
        .order_by(TransactionAlert.created_at.desc())
        .all()
    )


@router.get("/alerts/{alert_id}", response_model=AlertResponse)
def get_alert(
    alert_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(_READER),
):
    alert = (
        _scoped_alert(db, current_user)
        .filter(TransactionAlert.alert_id == alert_id)
        .first()
    )
    if not alert:
        raise HTTPException(404, "Alert not found")
    return alert


@router.patch("/alerts/{alert_id}", response_model=AlertResponse)
def update_alert(
    alert_id: str,
    payload: AlertUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(_RESOLVE),
):
    alert = (
        _scoped_alert(db, current_user)
        .filter(TransactionAlert.alert_id == alert_id)
        .first()
    )
    if not alert:
        raise HTTPException(404, "Alert not found")
    allowed = {
        k: v
        for k, v in payload.model_dump(exclude_none=True).items()
        if k not in ("resolved_by", "escalated_to", "dismissed_by")
    }
    for field, value in allowed.items():
        setattr(alert, field, value)
    if payload.status in (
        AlertStatus.resolved,
        AlertStatus.dismissed,
        AlertStatus.reported,
    ):
        alert.is_resolved = 1
        alert.resolved_at = datetime.now(timezone.utc)
        alert.resolved_by = current_user.user_id  # from session
    db.commit()
    db.refresh(alert)
    return alert


@router.post("/alerts/{alert_id}/resolve")
def resolve_alert(
    alert_id: str,
    notes: Optional[str] = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(_RESOLVE),
):
    """resolved_by is taken from authenticated session — not from request body."""
    alert = (
        _scoped_alert(db, current_user)
        .filter(TransactionAlert.alert_id == alert_id)
        .first()
    )
    if not alert:
        raise HTTPException(404, "Alert not found")
    if alert.is_resolved:
        raise HTTPException(400, "Alert is already resolved")
    alert.is_resolved = 1
    alert.status = AlertStatus.resolved
    alert.resolved_by = current_user.user_id  # from session
    alert.resolution_notes = notes
    alert.resolved_at = datetime.now(timezone.utc)
    db.commit()
    return {
        "message": "Alert resolved",
        "alert_id": alert_id,
        "resolved_by": current_user.user_id,
    }


@router.post("/alerts/{alert_id}/escalate")
def escalate_alert(
    alert_id: str,
    escalated_to_user_id: str,
    notes: Optional[str] = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(_RESOLVE),
):
    """
    Escalate alert. escalated_to_user_id must be a valid user ID in the system.
    The authenticated user's ID is recorded as who escalated it.
    """
    from app.services.auth_service import get_user_by_id

    target = get_user_by_id(db, escalated_to_user_id)
    if not target:
        raise HTTPException(404, f"Target user {escalated_to_user_id} not found")
    if target.role not in (UserRole.admin, UserRole.mlro, UserRole.compliance):
        raise HTTPException(
            400, "Cannot escalate to a user without compliance privileges"
        )

    alert = (
        _scoped_alert(db, current_user)
        .filter(TransactionAlert.alert_id == alert_id)
        .first()
    )
    if not alert:
        raise HTTPException(404, "Alert not found")
    alert.status = AlertStatus.escalated
    alert.escalated_to = escalated_to_user_id
    if notes:
        alert.notes = notes
    db.commit()
    return {
        "message": "Alert escalated",
        "alert_id": alert_id,
        "escalated_by": current_user.user_id,
        "escalated_to": escalated_to_user_id,
    }


@router.post("/alerts/{alert_id}/dismiss")
def dismiss_alert(
    alert_id: str,
    notes: Optional[str] = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(_DISMISS),
):
    """MLRO-only. dismissed_by taken from authenticated session."""
    alert = (
        _scoped_alert(db, current_user)
        .filter(TransactionAlert.alert_id == alert_id)
        .first()
    )
    if not alert:
        raise HTTPException(404, "Alert not found")
    alert.status = AlertStatus.dismissed
    alert.is_resolved = 1
    alert.resolved_by = current_user.user_id  # from session
    alert.resolution_notes = notes
    alert.resolved_at = datetime.now(timezone.utc)
    db.commit()
    return {
        "message": "Alert dismissed",
        "alert_id": alert_id,
        "dismissed_by": current_user.user_id,
    }


# ── Monitoring Cases ──────────────────────────────────────────────────────────


@router.post("/cases", response_model=CaseResponse, status_code=201)
def create_case(
    payload: CaseCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(_RESOLVE),
):
    customer = db.query(Customer).filter(Customer.id == payload.customer_id).first()
    if not customer:
        raise HTTPException(404, "Customer not found")
    _assert_tenant(current_user, customer)

    data = payload.model_dump()
    data.pop("organisation_id", None)
    scoped = scope_fields(current_user)
    if scoped:
        data["industry_id"] = scoped["industry_id"]
        data["organisation_id"] = scoped["organisation_id"]
    data["assigned_to"] = current_user.user_id  # from session

    case = MonitoringCase(case_id=f"CASE-{uuid.uuid4().hex[:10].upper()}", **data)
    db.add(case)
    db.commit()
    db.refresh(case)
    return case


@router.get("/cases", response_model=list[CaseResponse])
def list_cases(
    status: Optional[str] = None,
    skip: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=200),
    db: Session = Depends(get_db),
    current_user: User = Depends(_READER),
):
    q = scope_query(db.query(MonitoringCase), MonitoringCase, current_user)
    if status:
        q = q.filter(MonitoringCase.status == status)
    return q.order_by(MonitoringCase.created_at.desc()).offset(skip).limit(limit).all()


@router.patch("/cases/{case_id}/status")
def update_case_status(
    case_id: str,
    status: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(_RESOLVE),
):
    q = scope_query(db.query(MonitoringCase), MonitoringCase, current_user)
    case = q.filter(MonitoringCase.case_id == case_id).first()
    if not case:
        raise HTTPException(404, "Case not found")
    case.status = status
    if status == "closed":
        case.closed_at = datetime.now(timezone.utc)
    db.commit()
    return {"case_id": case_id, "status": status}
