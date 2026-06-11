HIGH_RISK_COUNTRIES = {
    "AF", "BY", "CF", "CG", "CU", "ER", "ET", "GN", "GW", "HT", "IR",
    "IQ", "LB", "LY", "ML", "MM", "NI", "KP", "RU", "SO", "SS", "SD",
    "SY", "VE", "YE", "ZW",
}

HIGH_RISK_INDUSTRIES = {"cryptocurrency", "real_estate"}

CTR_THRESHOLD = 10_000
STRUCTURING_WINDOW = 5


def score_customer(customer) -> float:
    score = 0.0
    if customer.country_of_residence.upper() in HIGH_RISK_COUNTRIES:
        score += 30
    if customer.nationality.upper() in HIGH_RISK_COUNTRIES:
        score += 15
    if customer.industry.value in HIGH_RISK_INDUSTRIES:
        score += 20
    if customer.is_pep:
        score += 25
    if not customer.source_of_funds:
        score += 10
    return min(score, 100.0)


def score_to_level(score: float) -> str:
    if score <= 30:
        return "low"
    if score <= 60:
        return "medium"
    if score <= 80:
        return "high"
    return "critical"


def score_transaction(transaction, customer_risk_score: float, recent_transactions: list) -> dict:
    score = 0.0
    alerts = []
    if transaction.amount >= CTR_THRESHOLD:
        score += 40
        alerts.append(("large_transaction", "high", f"Transaction amount ${transaction.amount:,.2f} exceeds CTR threshold"))
    below_threshold = [t for t in recent_transactions if 7_000 <= t.amount < CTR_THRESHOLD]
    if len(below_threshold) >= 3:
        score += 35
        alerts.append(("structuring", "high", "Multiple transactions near CTR threshold detected (possible structuring)"))
    if transaction.counterparty_country and transaction.counterparty_country.upper() in HIGH_RISK_COUNTRIES:
        score += 25
        alerts.append(("high_risk_country", "medium", f"Counterparty country {transaction.counterparty_country} is high-risk"))
    if len(recent_transactions) >= 10:
        score += 20
        alerts.append(("velocity_breach", "medium", f"{len(recent_transactions)} transactions detected in recent window"))
    score += customer_risk_score * 0.2
    return {"risk_score": min(score, 100.0), "is_suspicious": 1 if score >= 40 else 0, "alerts": alerts}
