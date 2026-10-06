"""
Shared helpers for the screening route package (quick_screen.py, records.py,
dashboard.py, alerts.py, batch.py, crypto_wallet.py, adverse_media.py,
customer_summary.py) — split out of what was a single 1570-line
app/api/routes/screening.py.
"""

from typing import Optional
from uuid import uuid4

from fastapi import HTTPException
from sqlalchemy.orm import Session

from app.integrations.base import ProviderRejectedError, ProviderUnavailableError
from app.integrations.pep import get_provider as get_pep_provider
from app.integrations.sanctions import get_provider as get_sanctions_provider
from app.models.customer import Customer
from app.models.screening import (
    ScreeningAlert,
    ScreeningProvider,
    ScreeningRecord,
    ScreeningStatus,
    ScreeningType,
)
from app.models.user import User
from app.services import audit_service

DISCLAIMER = (
    "Screening results are data inputs to the compliance workflow only. "
    "The platform does not determine whether a match constitutes a sanctions violation, "
    "PEP risk, or any regulatory breach. All decisions remain with the reporting entity."
)


def _log(
    db: Session,
    current_user: User,
    org_id: Optional[str],
    entity_type: str,
    entity_id: str,
    action: str,
    after_state: Optional[dict] = None,
    notes: Optional[str] = None,
) -> None:
    """
    Screening Hub audit trail. Sanctions/PEP/adverse-media/crypto-wallet
    screening decisions -- and the identity-verification decision that
    gates a customer's KYC status -- are exactly the "who did it, why"
    record this platform's other AML/CTF domains already write.
    """
    audit_service.log_action(
        db,
        action=action,
        entity_type=entity_type,
        entity_id=entity_id,
        actor=current_user.email,
        actor_role=current_user.role.value if current_user.role else None,
        organisation_id=org_id,
        after_state=after_state,
        notes=notes,
    )


def _record_dict(r: ScreeningRecord) -> dict:
    return {
        "id": r.id,
        "customer_id": r.customer_id,
        "screening_type": r.screening_type.value,
        "entity_type": r.entity_type.value,
        "entity_id": r.entity_id,
        "entity_name": r.entity_name,
        "provider": r.provider.value,
        "status": r.status.value,
        "match_count": r.match_count,
        "match_score": r.match_score,
        "match_details": r.match_details,
        "pep_category": r.pep_category,
        "pep_country": r.pep_country,
        "pep_position": r.pep_position,
        "is_false_positive": r.is_false_positive,
        "reviewed_by": r.reviewed_by,
        "reviewed_at": r.reviewed_at,
        "reviewer_notes": r.reviewer_notes,
        "triggered_by": r.triggered_by,
        "screened_at": r.screened_at,
        "alerts": [_alert_dict(a) for a in (r.alerts or [])],
    }


def _alert_dict(a: ScreeningAlert) -> dict:
    return {
        "id": a.id,
        "screening_record_id": a.screening_record_id,
        "customer_id": a.customer_id,
        "severity": a.severity.value,
        "status": a.status.value,
        "alert_type": a.alert_type,
        "summary": a.summary,
        "assigned_to": a.assigned_to,
        "assigned_at": a.assigned_at,
        "resolved_by": a.resolved_by,
        "resolved_at": a.resolved_at,
        "resolution_notes": a.resolution_notes,
        "escalated_to": a.escalated_to,
        "escalated_at": a.escalated_at,
        "created_at": a.created_at,
    }


def _resolve_customer(customer_id: str, org_id: str, db: Session) -> Customer:
    customer = (
        db.query(Customer)
        .filter(
            Customer.id == customer_id,
            Customer.org_id == org_id,
        )
        .first()
    )
    if not customer:
        raise HTTPException(404, f"Customer '{customer_id}' not found.")
    return customer


def _simulate_screening(
    screening_type: ScreeningType,
    entity_name: str,
    provider: ScreeningProvider,
) -> dict:
    """
    Fallback for screening types with no real provider layer yet: watchlist,
    adverse_media, regulatory, law_enforcement, ubo_adverse, manual_review.
    Sanctions/PEP (and their ubo_* variants) are real -- see
    _run_real_screening() below -- routed through app.integrations.sanctions
    / app.integrations.pep instead of this placeholder.
    """
    return {
        "status": ScreeningStatus.clear,
        "match_count": 0,
        "match_score": None,
        "match_details": None,
        "provider_reference": f"SIM-{uuid4().hex[:8].upper()}",
        "note": "Simulation only — no provider integration exists yet for this screening type.",
    }


_SANCTIONS_TYPES = {ScreeningType.sanctions, ScreeningType.ubo_sanctions}
_PEP_TYPES = {ScreeningType.pep, ScreeningType.ubo_pep}


def _sanctions_result_to_dict(result) -> dict:
    top = result.matches[0] if result.matches else None
    return {
        "status": (
            ScreeningStatus.potential_match
            if result.is_match
            else ScreeningStatus.clear
        ),
        "match_count": len(result.matches),
        "match_score": top.match_score if top else None,
        "match_details": {
            "matches": [
                {
                    "list_name": m.list_name,
                    "match_name": m.match_name,
                    "match_score": m.match_score,
                    "program": m.program,
                }
                for m in result.matches
            ],
            "lists_checked": result.lists_checked,
        }
        if result.matches
        else None,
        "provider_reference": f"{result.provider.upper()}-{uuid4().hex[:8]}",
        "note": f"Screened via {result.provider} sanctions provider.",
    }


def _pep_result_to_dict(result) -> dict:
    top = result.matches[0] if result.matches else None
    return {
        "status": (
            ScreeningStatus.potential_match if result.is_pep else ScreeningStatus.clear
        ),
        "match_count": len(result.matches),
        "match_score": top.match_score if top else None,
        "match_details": {
            "matches": [
                {
                    "match_name": m.match_name,
                    "match_score": m.match_score,
                    "pep_tier": m.pep_tier,
                    "position": m.position,
                    "country": m.country,
                }
                for m in result.matches
            ]
        }
        if result.matches
        else None,
        "provider_reference": f"{result.provider.upper()}-{uuid4().hex[:8]}",
        "note": f"Screened via {result.provider} PEP provider.",
    }


async def _run_real_screening(
    screening_type: ScreeningType,
    entity_name: str,
    entity_dob: Optional[str] = None,
    entity_nationality: Optional[str] = None,
) -> Optional[dict]:
    """
    Routes sanctions/PEP screening types to their real provider (see
    app.integrations.sanctions / app.integrations.pep, selected by the
    SANCTIONS_PROVIDER / PEP_PROVIDER settings). Returns None for any other
    screening_type, or if the configured provider itself isn't usable
    (e.g. "worldcheck", not yet implemented) -- callers fall back to
    _simulate_screening() in that case.
    """
    if screening_type in _SANCTIONS_TYPES:
        try:
            sanctions_provider = get_sanctions_provider()
        except (NotImplementedError, ProviderUnavailableError):
            return None
        try:
            sanctions_result = await sanctions_provider.screen(
                entity_name, dob=entity_dob, country=entity_nationality
            )
        except ProviderRejectedError as exc:
            raise HTTPException(502, str(exc))
        return _sanctions_result_to_dict(sanctions_result)

    if screening_type in _PEP_TYPES:
        try:
            pep_provider = get_pep_provider()
        except (NotImplementedError, ProviderUnavailableError):
            return None
        try:
            pep_result = await pep_provider.screen(
                entity_name, dob=entity_dob, country=entity_nationality
            )
        except ProviderRejectedError as exc:
            raise HTTPException(502, str(exc))
        return _pep_result_to_dict(pep_result)

    return None


async def _screen(
    screening_type: ScreeningType,
    entity_name: str,
    provider: ScreeningProvider,
    entity_dob: Optional[str] = None,
    entity_nationality: Optional[str] = None,
) -> dict:
    """Real screening for sanctions/PEP, simulation for every other type."""
    real = await _run_real_screening(
        screening_type, entity_name, entity_dob, entity_nationality
    )
    return (
        real
        if real is not None
        else _simulate_screening(screening_type, entity_name, provider)
    )
