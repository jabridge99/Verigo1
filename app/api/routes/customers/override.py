"""
Customers — MLRO unified override. Part of the customers route package;
see __init__.py for the combined router.
"""

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.api.deps import org_id_for, require_mlro_or_above
from app.db.database import get_db
from app.models.audit_log import AuditEventType, AuditLog
from app.models.user import User
from app.schemas.customer import CustomerOverrideRequest, CustomerResponse

from ._shared import _get_customer, _record_risk_history

router = APIRouter()


# ── MLRO Unified Override ───────────────────────────────────────────────────────
# A single, audited entry point for the manual overrides an MLRO needs to make.
# Writes to existing Customer fields only — every change is reasoned and logged
# to the canonical AuditLog, never silent.


@router.post("/{customer_id}/override", response_model=CustomerResponse)
def override_customer(
    customer_id: str,
    payload: CustomerOverrideRequest,
    current_user: User = Depends(require_mlro_or_above),
    db: Session = Depends(get_db),
):
    customer = _get_customer(customer_id, org_id_for(current_user), db)

    changes = payload.model_dump(
        exclude={"reason", "classification", "monitoring_level"}, exclude_none=True
    )
    custom_field_changes = payload.model_dump(
        include={"classification", "monitoring_level"}, exclude_none=True
    )
    if not changes and not custom_field_changes:
        raise HTTPException(422, "No fields supplied to override")

    before = {f: getattr(customer, f) for f in changes}
    risk_changed = "risk_score" in changes or "risk_level" in changes
    cdd_changed = "cdd_level" in changes

    for field, value in changes.items():
        setattr(customer, field, value)

    if custom_field_changes:
        before_custom = dict(customer.custom_fields or {})
        customer.custom_fields = {**before_custom, **custom_field_changes}
        before["custom_fields"] = before_custom

    if risk_changed or cdd_changed:
        _record_risk_history(
            customer, "mlro_override", current_user.id, db, notes=payload.reason
        )

    def _serialise(v):
        return (
            v.value
            if hasattr(v, "value")
            else (v.isoformat() if hasattr(v, "isoformat") else v)
        )

    db.add(
        AuditLog(
            org_id=customer.org_id,
            actor_id=current_user.id,
            event_type=AuditEventType.customer_updated,
            action="customer.mlro_override",
            object_type="Customer",
            object_id=customer.id,
            old_value={k: _serialise(v) for k, v in before.items()},
            new_value={
                **{k: _serialise(v) for k, v in changes.items()},
                **custom_field_changes,
                "reason": payload.reason,
            },
        )
    )
    db.commit()
    db.refresh(customer)
    return customer
