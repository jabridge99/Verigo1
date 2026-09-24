"""
Customers — periodic reviews and compliance notes. Part of the customers
route package; see __init__.py for the combined router.
"""

from typing import List

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.api.deps import (
    org_id_for,
    require_analyst_or_above,
    require_compliance_or_above,
)
from app.db.database import get_db
from app.models.customer import CustomerNote, CustomerReview
from app.models.user import User
from app.schemas.customer import (
    CustomerNoteCreate,
    CustomerNoteResponse,
    CustomerReviewCreate,
    CustomerReviewResponse,
)

from ._shared import _get_customer, _record_risk_history

router = APIRouter()


# ── Periodic Reviews ───────────────────────────────────────────────────────────


@router.post(
    "/{customer_id}/reviews", response_model=CustomerReviewResponse, status_code=201
)
def create_review(
    customer_id: str,
    payload: CustomerReviewCreate,
    current_user: User = Depends(require_compliance_or_above),
    db: Session = Depends(get_db),
):
    customer = _get_customer(customer_id, org_id_for(current_user), db)
    review = CustomerReview(
        customer_id=customer.id,
        org_id=customer.org_id,
        reviewed_by=current_user.id,
        **payload.model_dump(exclude_none=True),
    )
    db.add(review)
    if payload.next_review_date:
        customer.next_review_date = payload.next_review_date
        customer.last_reviewed_date = payload.review_date
        customer.last_reviewed_by = current_user.id
    if payload.cdd_level_after:
        customer.cdd_level = payload.cdd_level_after
    if payload.risk_score_after is not None:
        customer.risk_score = payload.risk_score_after
    if payload.risk_score_after is not None or payload.cdd_level_after:
        _record_risk_history(
            customer,
            "periodic_review",
            current_user.id,
            db,
            notes=payload.outcome_notes,
        )
    db.commit()
    db.refresh(review)
    return review


@router.get("/{customer_id}/reviews", response_model=List[CustomerReviewResponse])
def list_reviews(
    customer_id: str,
    current_user: User = Depends(require_compliance_or_above),
    db: Session = Depends(get_db),
):
    _get_customer(customer_id, org_id_for(current_user), db)
    return (
        db.query(CustomerReview)
        .filter(CustomerReview.customer_id == customer_id)
        .order_by(CustomerReview.review_date.desc())
        .all()
    )


# ── Compliance Notes ───────────────────────────────────────────────────────────


@router.post(
    "/{customer_id}/notes", response_model=CustomerNoteResponse, status_code=201
)
def add_note(
    customer_id: str,
    payload: CustomerNoteCreate,
    current_user: User = Depends(require_analyst_or_above),
    db: Session = Depends(get_db),
):
    customer = _get_customer(customer_id, org_id_for(current_user), db)
    note = CustomerNote(
        customer_id=customer.id,
        org_id=customer.org_id,
        note_type=payload.note_type,
        content=payload.content,
        is_confidential=payload.is_confidential,
        created_by=current_user.id,
    )
    db.add(note)
    db.commit()
    db.refresh(note)
    return note


@router.get("/{customer_id}/notes", response_model=List[CustomerNoteResponse])
def list_notes(
    customer_id: str,
    current_user: User = Depends(require_analyst_or_above),
    db: Session = Depends(get_db),
):
    customer = _get_customer(customer_id, org_id_for(current_user), db)
    q = db.query(CustomerNote).filter(CustomerNote.customer_id == customer_id)
    # Non-MLRO users cannot see confidential notes
    if current_user.role.value not in ("admin", "mlro"):
        q = q.filter(CustomerNote.is_confidential == False)
    return q.order_by(CustomerNote.created_at.desc()).all()
