import re

SAMPLE_WATCHLIST = [
    {"name": "John Doe Sanction", "id": "SDN-001", "list": "OFAC"},
    {"name": "Jane Criminal", "id": "UN-002", "list": "UN"},
    {"name": "Acme Shell Corp", "id": "EU-003", "list": "EU"},
]


def _normalize(name: str) -> str:
    return re.sub(r"[^a-z0-9 ]", "", name.lower()).strip()


def _name_match(name_a: str, name_b: str, threshold: float = 0.7) -> bool:
    a = _normalize(name_a).split()
    b = _normalize(name_b).split()
    if not a or not b:
        return False
    common = set(a) & set(b)
    similarity = len(common) / max(len(a), len(b))
    return similarity >= threshold


def screen_name(full_name: str) -> dict:
    matches = []
    for entry in SAMPLE_WATCHLIST:
        if _name_match(full_name, entry["name"]):
            matches.append(entry)
    return {
        "screened_name": full_name,
        "match_found": len(matches) > 0,
        "matches": matches,
        "watchlists_checked": list({e["list"] for e in SAMPLE_WATCHLIST}),
    }


def screen_transaction(counterparty_name: str) -> dict:
    if not counterparty_name:
        return {"match_found": False, "matches": [], "watchlists_checked": []}
    return screen_name(counterparty_name)
