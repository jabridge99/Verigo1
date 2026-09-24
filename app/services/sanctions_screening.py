"""
Quick sanctions name-screen used by the onboarding applicant portal
(onboarding_service.py::submit_onboarding) and the Screening Hub's
quick-screen endpoint (app/api/routes/screening.py).

Delegates to the real sanctions provider factory (app.integrations.sanctions
-- InternalSanctionsProvider by default, ComplyAdvantage when configured)
rather than matching against a fixed local list -- SANCTIONS_PROVIDER
controls which provider is actually consulted (see app/config.py).
"""

from app.integrations.sanctions import get_provider


async def screen_name(full_name: str) -> dict:
    provider = get_provider()
    result = await provider.screen(full_name)
    return {
        "screened_name": full_name,
        "match_found": result.is_match,
        "matches": [
            {
                "name": m.match_name,
                "list": m.list_name,
                "match_score": m.match_score,
                "program": m.program,
            }
            for m in result.matches
        ],
        "watchlists_checked": result.lists_checked,
    }


async def screen_transaction(counterparty_name: str) -> dict:
    if not counterparty_name:
        return {"match_found": False, "matches": [], "watchlists_checked": []}
    return await screen_name(counterparty_name)
