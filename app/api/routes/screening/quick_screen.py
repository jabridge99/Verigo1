"""
Screening — ad-hoc quick lookup, not linked to a customer record. Part of
the screening route package; see __init__.py for the combined router.
"""

from fastapi import APIRouter, Depends, HTTPException

from app.api.deps import require_analyst_or_above
from app.models.screening import ScreeningProvider, ScreeningType
from app.models.user import User
from app.schemas.screening import QuickScreenRequest
from app.services.sanctions_screening import screen_name

from ._shared import DISCLAIMER, _screen

router = APIRouter()

_QUICK_SCREEN_CATEGORIES = {"sanctions", "pep", "adverse_media", "company", "address"}


@router.post("/quick-screen")
async def quick_screen(
    payload: QuickScreenRequest,
    current_user: User = Depends(require_analyst_or_above),
):
    """
    Ad-hoc, not-yet-linked-to-a-customer lookup — a name (or address) typed
    straight into the Screening Hub, before any customer record exists.
    Not persisted; use POST /screening/run for a customer-linked, recorded
    screen that feeds alerts and the identity-verification score.
    """
    category = payload.category.lower()
    if category not in _QUICK_SCREEN_CATEGORIES:
        raise HTTPException(
            400, f"category must be one of {sorted(_QUICK_SCREEN_CATEGORIES)}"
        )

    if category == "address":
        return {
            "category": "address",
            "query": payload.query,
            "valid": True,
            "normalized": payload.query.strip(),
            "note": "Simulation only — wire to Integration Hub for live address validation.",
            "disclaimer": DISCLAIMER,
        }

    if category == "sanctions":
        result = await screen_name(payload.query)
        return {
            "category": "sanctions",
            "query": payload.query,
            "match_found": result["match_found"],
            "matches": result["matches"],
            "lists_checked": result["watchlists_checked"],
            "disclaimer": DISCLAIMER,
        }

    type_map = {
        "pep": ScreeningType.pep,
        "adverse_media": ScreeningType.adverse_media,
        "company": ScreeningType.regulatory,
    }
    result = await _screen(
        type_map[category], payload.query, ScreeningProvider.internal
    )
    return {
        "category": category,
        "query": payload.query,
        "match_found": result["match_count"] > 0,
        "match_count": result["match_count"],
        "status": result["status"].value,
        "provider_reference": result["provider_reference"],
        "disclaimer": DISCLAIMER,
    }
