"""
Screening — batch (multi-customer) screening. Part of the screening route
package; see __init__.py for the combined router.
"""

from uuid import uuid4

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.api.deps import org_id_for, require_compliance_or_above
from app.db.database import get_db
from app.models.customer import Customer
from app.models.screening import ScreeningEntityType, ScreeningRecord
from app.models.user import User
from app.schemas.screening import BatchScreeningRequest
from app.services import billing_service as billing_svc

from ._shared import _PEP_TYPES, _SANCTIONS_TYPES, DISCLAIMER, _log, _screen

router = APIRouter()


@router.post("/batch", status_code=202)
async def batch_screen(
    payload: BatchScreeningRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_compliance_or_above),
):
    """
    Queue batch screening for up to 50 customers.

    Each customer × each screening type = one ScreeningRecord.
    Returns summary; in production this dispatches to a background task queue.
    Currently runs synchronously (small batches only in demo mode).

    DISCLAIMER: Screening results are not compliance determinations.
    """
    org_id = org_id_for(current_user)

    customers = (
        db.query(Customer)
        .filter(
            Customer.id.in_(payload.customer_ids),
            Customer.org_id == org_id,
        )
        .all()
    )

    found_ids = {c.id for c in customers}
    missing = [cid for cid in payload.customer_ids if cid not in found_ids]

    real_types_requested = sum(
        1 for stype in payload.screening_types if stype in _SANCTIONS_TYPES | _PEP_TYPES
    )
    billing_svc.enforce_screening_limit(
        db, org_id, additional=real_types_requested * len(customers)
    )

    records_created = 0
    for customer in customers:
        entity_name = getattr(customer, "full_name", None) or customer.id
        for stype in payload.screening_types:
            result = await _screen(stype, entity_name, payload.provider)
            record = ScreeningRecord(
                id=f"scr_{uuid4().hex[:12]}",
                org_id=org_id,
                customer_id=customer.id,
                screening_type=stype,
                entity_type=ScreeningEntityType.customer,
                entity_id=customer.id,
                entity_name=entity_name,
                provider=payload.provider,
                provider_reference=result.get("provider_reference"),
                status=result["status"],
                match_count=result.get("match_count", 0),
                match_score=result.get("match_score"),
                match_details=result.get("match_details"),
                triggered_by=current_user.id,
            )
            db.add(record)
            records_created += 1

    db.commit()
    _log(
        db,
        current_user,
        org_id,
        "screening_batch",
        f"batch_{uuid4().hex[:12]}",
        action="screening_batch_run",
        after_state={
            "customer_ids": [c.id for c in customers],
            "screening_types": [t.value for t in payload.screening_types],
            "records_created": records_created,
        },
    )
    return {
        "customers_screened": len(customers),
        "records_created": records_created,
        "screening_types": [t.value for t in payload.screening_types],
        "missing_customer_ids": missing,
        "disclaimer": DISCLAIMER,
    }
