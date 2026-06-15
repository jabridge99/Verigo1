"""
Transaction API — bank-grade AML/CTF transaction register.

Roles:
  POST /transactions — analyst+
  GET  /transactions — analyst+
  GET  /transactions/{id} — analyst+
  PATCH /transactions/{id} — compliance+
  POST /transactions/{id}/run-monitoring — compliance+
"""
from datetime import datetime, timezone
from typing import Optional
from uuid import uuid4

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session

from app.api.deps import (
    Pagination,
    get_current_user,
    org_id_for,
    require_analyst_or_above,
    require_compliance_or_above,
)
from app.db.database import get_db
from app.models.customer import Customer
from app.models.monitoring import TransactionAlert
from app.models.transaction import (
    Transaction,
    TransactionCryptoDetail,
    TransactionStatus,
)
from app.models.user import User
from app.schemas.transaction import (
    TransactionCreate,
    TransactionListOut,
    TransactionOut,
    TransactionUpdate,
)
from app.services.monitoring_engine import run_monitoring

router = APIRouter(prefix="/transactions", tags=["Transactions"])


def _get_transaction_or_404(txn_id: str, org_id: str, db: Session) -> Transaction:
    txn = db.query(Transaction).filter(
        Transaction.id == txn_id,
        Transaction.org_id == org_id,
    ).first()
    if not txn:
        raise HTTPException(status_code=404, detail="Transaction not found.")
    return txn


@router.post("", response_model=TransactionOut, status_code=status.HTTP_201_CREATED)
def create_transaction(
    payload: TransactionCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_analyst_or_above),
):
    """Record a new transaction. Risk scoring and monitoring are handled separately."""
    org_id = org_id_for(current_user)

    # Verify customer belongs to org
    customer = db.query(Customer).filter(
        Customer.id == payload.customer_id,
        Customer.org_id == org_id,
    ).first()
    if not customer:
        raise HTTPException(status_code=404, detail="Customer not found.")

    # Check for duplicate ref
    existing = db.query(Transaction).filter(
        Transaction.transaction_ref == payload.transaction_ref,
        Transaction.org_id == org_id,
    ).first()
    if existing:
        raise HTTPException(status_code=409, detail="Transaction reference already exists.")

    txn = Transaction(
        id=f"txn_{uuid4().hex[:12]}",
        org_id=org_id,
        created_by=current_user.id,
        **payload.model_dump(exclude={"crypto_detail"}),
    )
    db.add(txn)

    if payload.crypto_detail:
        crypto = TransactionCryptoDetail(
            id=f"cdet_{uuid4().hex[:10]}",
            transaction_id=txn.id,
            org_id=org_id,
            **payload.crypto_detail.model_dump(),
        )
        db.add(crypto)

    db.commit()
    db.refresh(txn)
    return txn


@router.get("", response_model=list[TransactionListOut])
def list_transactions(
    customer_id: Optional[str] = Query(None),
    status: Optional[TransactionStatus] = Query(None),
    is_cross_border: Optional[bool] = Query(None),
    min_amount_aud: Optional[float] = Query(None),
    from_date: Optional[datetime] = Query(None),
    to_date: Optional[datetime] = Query(None),
    pagination: Pagination = Depends(),
    db: Session = Depends(get_db),
    current_user: User = Depends(require_analyst_or_above),
):
    org_id = org_id_for(current_user)
    q = db.query(Transaction).filter(Transaction.org_id == org_id)

    if customer_id:
        q = q.filter(Transaction.customer_id == customer_id)
    if status:
        q = q.filter(Transaction.status == status)
    if is_cross_border is not None:
        q = q.filter(Transaction.is_cross_border == is_cross_border)
    if min_amount_aud is not None:
        q = q.filter(Transaction.amount_aud >= min_amount_aud)
    if from_date:
        q = q.filter(Transaction.transaction_date >= from_date)
    if to_date:
        q = q.filter(Transaction.transaction_date <= to_date)

    q = q.order_by(Transaction.transaction_date.desc())
    return pagination.apply(q).all()


@router.get("/{txn_id}", response_model=TransactionOut)
def get_transaction(
    txn_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_analyst_or_above),
):
    return _get_transaction_or_404(txn_id, org_id_for(current_user), db)


@router.patch("/{txn_id}", response_model=TransactionOut)
def update_transaction(
    txn_id: str,
    payload: TransactionUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_compliance_or_above),
):
    """Update non-risk fields. Risk fields are engine-only and cannot be patched."""
    txn = _get_transaction_or_404(txn_id, org_id_for(current_user), db)

    if txn.status == TransactionStatus.completed:
        raise HTTPException(
            status_code=409,
            detail="Completed transactions are immutable.",
        )

    for k, v in payload.model_dump(exclude_none=True).items():
        setattr(txn, k, v)

    txn.updated_at = datetime.now(timezone.utc)
    db.commit()
    db.refresh(txn)
    return txn


@router.post("/{txn_id}/run-monitoring", status_code=status.HTTP_200_OK)
def run_monitoring_on_transaction(
    txn_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_compliance_or_above),
):
    """
    Manually trigger the monitoring engine against a specific transaction.
    This is automatically triggered on transaction creation in production;
    this endpoint supports re-evaluation and backfill use cases.

    DISCLAIMER: Alerts generated are indicators for human review only.
    """
    org_id = org_id_for(current_user)
    txn = _get_transaction_or_404(txn_id, org_id, db)

    customer = db.query(Customer).filter(
        Customer.id == txn.customer_id,
        Customer.org_id == org_id,
    ).first()
    if not customer:
        raise HTTPException(status_code=404, detail="Customer not found.")

    alerts = run_monitoring(txn, customer, db)
    db.commit()

    return {
        "transaction_id": txn_id,
        "alerts_generated": len(alerts),
        "alert_ids": [a.id for a in alerts],
        "disclaimer": (
            "Alerts are generated for human review only. "
            "No alert constitutes a finding of suspicious activity or criminal conduct."
        ),
    }
