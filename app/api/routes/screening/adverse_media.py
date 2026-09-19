"""
Screening — adverse media findings. Part of the screening route package;
see __init__.py for the combined router.
"""

from datetime import datetime, timezone
from uuid import uuid4

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session

from app.api.deps import (
    org_id_for,
    require_analyst_or_above,
    require_compliance_or_above,
)
from app.db.database import get_db
from app.models.screening import AdverseMediaResult, AlertStatus
from app.models.user import User
from app.schemas.screening import AdverseMediaRequest

from ._shared import DISCLAIMER, _log, _resolve_customer

router = APIRouter()


@router.post("/adverse-media", status_code=201)
def record_adverse_media(
    payload: AdverseMediaRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_compliance_or_above),
):
    """
    Record an adverse media finding for a customer.

    Typically called by an integration (ComplyAdvantage, LexisNexis, etc.)
    or entered manually by a compliance analyst after media review.

    DISCLAIMER: Adverse media is a data input. The platform does not assess
    whether media constitutes evidence of financial crime.
    """
    org_id = org_id_for(current_user)
    _resolve_customer(payload.customer_id, org_id, db)

    result = AdverseMediaResult(
        id=f"adm_{uuid4().hex[:12]}",
        org_id=org_id,
        customer_id=payload.customer_id,
        category=payload.category,
        headline=payload.headline,
        source_name=payload.source_name,
        source_url=payload.source_url,
        publication_date=payload.publication_date,
        jurisdiction=payload.jurisdiction,
        match_confidence=payload.match_confidence,
        review_status=AlertStatus.open,
        provider_raw_response=payload.provider_raw_response,
    )
    db.add(result)
    db.commit()
    db.refresh(result)
    _log(
        db,
        current_user,
        org_id,
        "adverse_media_result",
        result.id,
        action="adverse_media_recorded",
        after_state={
            "customer_id": result.customer_id,
            "category": result.category.value,
            "headline": result.headline,
        },
    )

    return {
        "id": result.id,
        "customer_id": result.customer_id,
        "category": result.category.value,
        "headline": result.headline,
        "source_name": result.source_name,
        "match_confidence": result.match_confidence,
        "review_status": result.review_status.value,
        "created_at": result.created_at,
        "disclaimer": DISCLAIMER,
    }


@router.get("/adverse-media/{customer_id}")
def list_adverse_media(
    customer_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_analyst_or_above),
):
    """List all adverse media results for a customer."""
    org_id = org_id_for(current_user)
    results = (
        db.query(AdverseMediaResult)
        .filter(
            AdverseMediaResult.org_id == org_id,
            AdverseMediaResult.customer_id == customer_id,
        )
        .order_by(AdverseMediaResult.created_at.desc())
        .all()
    )

    return [
        {
            "id": r.id,
            "category": r.category.value,
            "headline": r.headline,
            "source_name": r.source_name,
            "publication_date": r.publication_date,
            "jurisdiction": r.jurisdiction,
            "match_confidence": r.match_confidence,
            "is_confirmed_match": r.is_confirmed_match,
            "is_false_positive": r.is_false_positive,
            "review_status": r.review_status.value,
            "reviewed_by": r.reviewed_by,
            "reviewed_at": r.reviewed_at,
            "created_at": r.created_at,
        }
        for r in results
    ]


@router.post("/adverse-media/{result_id}/review")
def review_adverse_media(
    result_id: str,
    action: str = Query(..., description="confirm or dismiss"),
    notes: str = Query(..., min_length=10),
    db: Session = Depends(get_db),
    current_user: User = Depends(require_compliance_or_above),
):
    """Review an adverse media result — confirm the match or dismiss as false positive."""
    org_id = org_id_for(current_user)
    result = (
        db.query(AdverseMediaResult)
        .filter(
            AdverseMediaResult.id == result_id,
            AdverseMediaResult.org_id == org_id,
        )
        .first()
    )
    if not result:
        raise HTTPException(404, "Adverse media result not found.")

    if action == "confirm":
        result.is_confirmed_match = True
        result.review_status = AlertStatus.under_review
    elif action == "dismiss":
        result.is_false_positive = True
        result.review_status = AlertStatus.dismissed
    else:
        raise HTTPException(400, "Action must be 'confirm' or 'dismiss'.")

    result.reviewed_by = current_user.id
    result.reviewed_at = datetime.now(timezone.utc)
    result.reviewer_notes = notes

    db.commit()
    db.refresh(result)
    _log(
        db,
        current_user,
        org_id,
        "adverse_media_result",
        result.id,
        action=f"adverse_media_{action}",
        after_state={"review_status": result.review_status.value},
        notes=notes,
    )
    return {
        "id": result.id,
        "is_confirmed_match": result.is_confirmed_match,
        "is_false_positive": result.is_false_positive,
        "review_status": result.review_status.value,
        "reviewed_by": result.reviewed_by,
        "disclaimer": DISCLAIMER,
    }
