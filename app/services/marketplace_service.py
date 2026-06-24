"""
Verification Marketplace service — order lifecycle and billing bridge.

Completing a billable order creates a UsageRecord (the existing metered-
billing pipeline, see app.models.usage) rather than a new charge model.
"""

from datetime import datetime, timezone
from typing import Optional
from uuid import uuid4

from sqlalchemy.orm import Session

from app.models.marketplace import VerificationOrder, VerificationOrderStatus, VerificationProvider
from app.models.usage import UsageEventType, UsageRecord, UsageRecordStatus

_CHECK_TO_USAGE_EVENT = {
    "identity_verification": UsageEventType.identity_verification,
    "business_verification": UsageEventType.business_verification,
    "address_verification": UsageEventType.address_verification,
    "sanctions_screening": UsageEventType.sanctions_screening,
    "pep_screening": UsageEventType.sanctions_screening,
    "adverse_media": UsageEventType.other,
    "crypto_wallet_screening": UsageEventType.other,
    "source_of_funds": UsageEventType.other,
    "other": UsageEventType.other,
}


def complete_order(
    db: Session,
    order: VerificationOrder,
    provider: VerificationProvider,
    reviewed_by: str,
    result_summary: Optional[dict] = None,
    evidence_url: Optional[str] = None,
    screening_record_id: Optional[str] = None,
    accepted: bool = True,
) -> VerificationOrder:
    """
    Mark an order completed (or rejected) and, if the provider has a
    non-zero unit cost, create a billable UsageRecord for it.
    """
    order.status = VerificationOrderStatus.completed if accepted else VerificationOrderStatus.rejected
    order.reviewed_by = reviewed_by
    order.result_summary = result_summary
    if evidence_url:
        order.evidence_url = evidence_url
    if screening_record_id:
        order.screening_record_id = screening_record_id
    order.completed_at = datetime.now(timezone.utc)

    if accepted and provider.unit_cost_aud and provider.unit_cost_aud > 0:
        billed = provider.unit_cost_aud * (1 + (provider.markup_pct or 0.0))
        usage = UsageRecord(
            id=f"usage_{uuid4().hex[:14]}",
            org_id=order.org_id,
            customer_id=order.entity_id if order.entity_type == "customer" else None,
            event_type=_CHECK_TO_USAGE_EVENT.get(provider.check_type.value, UsageEventType.other),
            provider=provider.vendor_key or provider.name,
            provider_reference=order.id,
            status=UsageRecordStatus.completed,
            unit_cost_aud=provider.unit_cost_aud,
            markup_pct=provider.markup_pct or 0.0,
            billed_amount_aud=round(billed, 4),
        )
        db.add(usage)
        db.flush()
        order.usage_record_id = usage.id

    return order
