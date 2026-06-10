"""
Transaction Monitoring Engine — API routes.
"""

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from typing import Optional
import uuid
from datetime import datetime, timezone

from app.db.database import get_db
from app.models.transaction import (
    Transaction, TransactionAlert, MonitoringCase,
    TransactionStatus, AlertStatus, AlertSeverity,
)
from app.models.customer import Customer
from app.schemas.transaction import (
    TransactionCreate, TransactionResponse, AlertResponse,
    AlertUpdate, CaseCreate, CaseResponse, MonitoringStats,
)
from app.services.risk_scoring import score_transaction
from app.services.monitoring_engine import run_monitoring, get_alert_queue, monitoring_stats

router = APIRouter(prefix="/transactions", tags=["Transactions"])


@router.post("/", response_model=TransactionResponse, status_code=201)
def create_transaction(payload: TransactionCreate, db: Session = Depends(get_db)):
    customer = db.query(Customer).filter(Customer.id == payload.customer_id).first()
    if not customer:
        raise HTTPException(404, "Customer not found")
    data = payload.model_dump()
    data["transaction_id"] = f"TXN-{uuid.uuid4().hex[:12].upper()}"
    if data.get("amount_aud") is None:
        data["amount_aud"] = data["amount"]
    txn = Transaction(**data)
    db.add(txn)
    db.flush()
    from datetime import timedelta
    since = datetime.now(timezone.utc) - timedelta(hours=24)
    recent = db.query(Transaction).filter(
        Transaction.customer_id == customer.id,
        Transaction.transaction_date >= since,
        Transaction.id != txn.id,
    ).all()
    scoring = score_transaction(txn, customer.risk_score or 0, recent)
    txn.risk_score = scoring["risk_score"]
    txn.is_suspicious = scoring["is_suspicious"]
    if txn.is_suspicious:
        txn.status = TransactionStatus.flagged
    alerts = run_monitoring(db, txn, customer, industry_id=payload.industry_id)
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
    customer_id: Optional[int] = None, industry_id: Optional[str] = None,
    is_suspicious: Optional[int] = None, status: Optional[str] = None,
    skip: int = 0, limit: int = 100, db: Session = Depends(get_db),
):
    q = db.query(Transaction)
    if customer_id: q = q.filter_by(customer_id=customer_id)
    if industry_id: q = q.filter_by(industry_id=industry_id)
    if is_suspicious is not None: q = q.filter(Transaction.is_suspicious == is_suspicious)
    if status: q = q.filter(Transaction.status == status)
    return q.order_by(Transaction.transaction_date.desc()).offset(skip).limit(limit).all()


@router.get("/alerts/queue", response_model=list[AlertResponse])
def alert_queue(
    industry_id: Optional[str] = None, severity: Optional[str] = None,
    status: Optional[str] = None, alert_type: Optional[str] = None,
    customer_id: Optional[int] = None, skip: int = 0, limit: int = 100,
    db: Session = Depends(get_db),
):
    return get_alert_queue(db, industry_id=industry_id, severity=severity,
                           status=status, alert_type=alert_type,
                           customer_id=customer_id, skip=skip, limit=limit)


@router.get("/alerts/stats", response_model=MonitoringStats)
def alert_stats(industry_id: Optional[str] = None, db: Session = Depends(get_db)):
    return monitoring_stats(db, industry_id=industry_id)


@router.get("/alerts/{alert_id}", response_model=AlertResponse)
def get_alert(alert_id: str, db: Session = Depends(get_db)):
    alert = db.query(TransactionAlert).filter_by(alert_id=alert_id).first()
    if not alert: raise HTTPException(404, "Alert not found")
    return alert


@router.patch("/alerts/{alert_id}", response_model=AlertResponse)
def update_alert(alert_id: str, payload: AlertUpdate, db: Session = Depends(get_db)):
    alert = db.query(TransactionAlert).filter_by(alert_id=alert_id).first()
    if not alert: raise HTTPException(404, "Alert not found")
    for field, value in payload.model_dump(exclude_none=True).items():
        setattr(alert, field, value)
    if payload.status in (AlertStatus.resolved, AlertStatus.dismissed, AlertStatus.reported):
        alert.is_resolved = 1
        alert.resolved_at = datetime.now(timezone.utc)
    db.commit(); db.refresh(alert)
    return alert


@router.post("/alerts/{alert_id}/resolve")
def resolve_alert(alert_id: str, resolved_by: str, notes: Optional[str] = None, db: Session = Depends(get_db)):
    alert = db.query(TransactionAlert).filter_by(alert_id=alert_id).first()
    if not alert: raise HTTPException(404, "Alert not found")
    alert.is_resolved = 1; alert.status = AlertStatus.resolved
    alert.resolved_by = resolved_by; alert.resolution_notes = notes
    alert.resolved_at = datetime.now(timezone.utc)
    db.commit()
    return {"message": "Alert resolved", "alert_id": alert_id}


@router.post("/alerts/{alert_id}/escalate")
def escalate_alert(alert_id: str, escalated_to: str, notes: Optional[str] = None, db: Session = Depends(get_db)):
    alert = db.query(TransactionAlert).filter_by(alert_id=alert_id).first()
    if not alert: raise HTTPException(404, "Alert not found")
    alert.status = AlertStatus.escalated; alert.escalated_to = escalated_to
    if notes: alert.notes = notes
    db.commit()
    return {"message": "Alert escalated", "alert_id": alert_id}


@router.post("/alerts/{alert_id}/dismiss")
def dismiss_alert(alert_id: str, notes: Optional[str] = None, dismissed_by: Optional[str] = None, db: Session = Depends(get_db)):
    alert = db.query(TransactionAlert).filter_by(alert_id=alert_id).first()
    if not alert: raise HTTPException(404, "Alert not found")
    alert.status = AlertStatus.dismissed; alert.is_resolved = 1
    alert.resolved_by = dismissed_by; alert.resolution_notes = notes
    alert.resolved_at = datetime.now(timezone.utc)
    db.commit()
    return {"message": "Alert dismissed", "alert_id": alert_id}


@router.get("/alerts", response_model=list[AlertResponse])
def list_alerts(is_resolved: int = 0, db: Session = Depends(get_db)):
    return db.query(TransactionAlert).filter(
        TransactionAlert.is_resolved == is_resolved
    ).order_by(TransactionAlert.created_at.desc()).all()


@router.get("/{transaction_id}", response_model=TransactionResponse)
def get_transaction(transaction_id: str, db: Session = Depends(get_db)):
    txn = db.query(Transaction).filter_by(transaction_id=transaction_id).first()
    if not txn: raise HTTPException(404, "Transaction not found")
    return txn


@router.patch("/{transaction_id}/status")
def update_transaction_status(transaction_id: str, status: TransactionStatus, db: Session = Depends(get_db)):
    txn = db.query(Transaction).filter_by(transaction_id=transaction_id).first()
    if not txn: raise HTTPException(404, "Transaction not found")
    txn.status = status; db.commit()
    return {"transaction_id": transaction_id, "status": status}


@router.post("/cases", response_model=CaseResponse, status_code=201)
def create_case(payload: CaseCreate, db: Session = Depends(get_db)):
    customer = db.query(Customer).filter(Customer.id == payload.customer_id).first()
    if not customer: raise HTTPException(404, "Customer not found")
    case = MonitoringCase(case_id=f"CASE-{uuid.uuid4().hex[:10].upper()}", **payload.model_dump())
    db.add(case); db.commit(); db.refresh(case)
    return case


@router.get("/cases", response_model=list[CaseResponse])
def list_cases(industry_id: Optional[str] = None, status: Optional[str] = None, skip: int = 0, limit: int = 50, db: Session = Depends(get_db)):
    q = db.query(MonitoringCase)
    if industry_id: q = q.filter_by(industry_id=industry_id)
    if status: q = q.filter_by(status=status)
    return q.order_by(MonitoringCase.created_at.desc()).offset(skip).limit(limit).all()


@router.patch("/cases/{case_id}/status")
def update_case_status(case_id: str, status: str, db: Session = Depends(get_db)):
    case = db.query(MonitoringCase).filter_by(case_id=case_id).first()
    if not case: raise HTTPException(404, "Case not found")
    case.status = status
    if status == "closed": case.closed_at = datetime.now(timezone.utc)
    db.commit()
    return {"case_id": case_id, "status": status}
