def compute_ecdd_score(ecdd) -> float:
    score = 0.0
    if ecdd.pep_status:
        score += 30
    if ecdd.adverse_media_found:
        score += 35
    if not ecdd.beneficial_owner_verified:
        score += 20
    if not ecdd.source_of_wealth_verified:
        score += 15
    if ecdd.high_tax_risk:
        score += 10
    return min(score, 100.0)


def determine_recommendation(score: float, pep: bool, adverse_media: bool) -> str:
    if adverse_media or score >= 80:
        return "reject"
    if pep or score >= 50:
        return "monitor"
    return "approve"
