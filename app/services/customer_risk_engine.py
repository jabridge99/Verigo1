"""
5-Dimension Customer Risk Assessment Engine.

Scores:
  1. Customer Risk     — PEP, nationality, occupation, verification status
  2. Product Risk      — remittance, FX, crypto, cash, bearer instruments
  3. Geographic Risk   — FATF blacklist/greylist, sanctions countries
  4. Channel Risk      — online vs branch, introduced, third-party reliance
  5. Transaction Risk  — expected volume, value, frequency, cross-border

Weighted combination → overall score → decision gateway (CDD or EDD).

All country lists are illustrative starting points. Replace with live FATF/DFAT feeds.
"""
from dataclasses import dataclass, field
from typing import Optional

from app.models.customer import CDDLevel, Customer, RiskLevel
from app.models.customer_workflow import EDDTrigger


# ── Country Risk Lists (seed data — override with live feeds) ─────────────────

FATF_BLACKLIST = frozenset({"KP", "IR", "MM"})

FATF_GREYLIST = frozenset({
    "AL", "BB", "BF", "CM", "CD", "HT", "JM", "JO", "ML", "MZ",
    "NG", "PH", "SN", "SY", "TZ", "TN", "TR", "UG", "VU", "YE",
    "ZW", "VE", "PA",
})

SANCTIONS_COUNTRIES = frozenset({
    "IR", "KP", "RU", "BY", "SY", "CU", "SD", "LY", "SO",
})

HIGH_RISK_COUNTRIES = frozenset({
    "AF", "PK", "MM", "BI", "CF", "TD", "CO", "GN", "GW", "HT",
    "IQ", "LB", "LY", "ML", "MZ", "NG", "SS", "SD", "SO", "SY",
    "UA", "VE", "YE", "ZW",
})

# Occupations considered inherently higher risk for AML/CTF
HIGH_RISK_OCCUPATIONS = frozenset({
    "politician", "government_official", "law_enforcement", "military",
    "judge", "prosecutor", "diplomat", "central_banker",
    "casino_employee", "money_changer", "pawnbroker",
    "jeweller", "precious_metals_dealer", "real_estate_agent",
    "accountant", "lawyer", "notary",
})

# Default weights — can be overridden per org via GovernanceCustomScoring
DEFAULT_WEIGHTS = {
    "customer":     0.30,
    "product":      0.25,
    "geographic":   0.20,
    "channel":      0.15,
    "transaction":  0.10,
}

RISK_THRESHOLDS = {
    "low":      33.0,
    "medium":   66.0,
    "high":     85.0,
    # > high → critical
}


@dataclass
class RiskDimensionResult:
    score: float
    factors: dict[str, float] = field(default_factory=dict)
    flags: dict[str, bool] = field(default_factory=dict)


@dataclass
class RiskAssessmentResult:
    customer_risk: RiskDimensionResult
    product_risk: RiskDimensionResult
    geographic_risk: RiskDimensionResult
    channel_risk: RiskDimensionResult
    transaction_risk: RiskDimensionResult
    overall_score: float
    overall_level: str
    gateway_decision: str           # "cdd" | "edd"
    edd_triggers: list[str]
    weights: dict[str, float]


def _clamp(v: float) -> float:
    return max(0.0, min(100.0, v))


# ── Dimension 1: Customer Risk ────────────────────────────────────────────────

def score_customer_risk(customer: Customer, is_pep: bool, pep_type: Optional[str]) -> RiskDimensionResult:
    score = 0.0
    factors: dict[str, float] = {}
    flags: dict[str, bool] = {}

    if is_pep:
        pts = 50.0 if pep_type in ("foreign", "international_org") else 35.0
        score += pts
        factors["pep"] = pts
        flags["is_pep"] = True

    if customer.nationality in FATF_BLACKLIST:
        score += 40.0
        factors["fatf_blacklist_nationality"] = 40.0
        flags["blacklist_nationality"] = True
    elif customer.nationality in FATF_GREYLIST:
        score += 20.0
        factors["fatf_greylist_nationality"] = 20.0
    elif customer.nationality in HIGH_RISK_COUNTRIES:
        score += 15.0
        factors["high_risk_nationality"] = 15.0

    occ = (customer.occupation or "").lower().replace(" ", "_")
    if occ in HIGH_RISK_OCCUPATIONS:
        score += 15.0
        factors["high_risk_occupation"] = 15.0

    if customer.dual_nationality:
        if customer.dual_nationality in FATF_BLACKLIST:
            score += 20.0
            factors["fatf_blacklist_dual_nationality"] = 20.0

    # Unverified identity adds risk
    if not customer.tax_identification_number:
        score += 5.0
        factors["no_tax_id"] = 5.0

    return RiskDimensionResult(score=_clamp(score), factors=factors, flags=flags)


# ── Dimension 2: Product Risk ─────────────────────────────────────────────────

def score_product_risk(
    involves_remittance: bool = False,
    involves_fx: bool = False,
    involves_crypto: bool = False,
    involves_cash: bool = False,
    involves_trust: bool = False,
    involves_bearer: bool = False,
) -> RiskDimensionResult:
    score = 0.0
    factors: dict[str, float] = {}
    flags: dict[str, bool] = {}

    if involves_crypto:
        score += 40.0
        factors["crypto"] = 40.0
        flags["crypto"] = True
    if involves_remittance:
        score += 30.0
        factors["remittance"] = 30.0
    if involves_fx:
        score += 20.0
        factors["fx"] = 20.0
    if involves_cash:
        score += 25.0
        factors["cash"] = 25.0
        flags["cash_intensive"] = True
    if involves_trust:
        score += 20.0
        factors["trust_structure"] = 20.0
    if involves_bearer:
        score += 35.0
        factors["bearer_instruments"] = 35.0
        flags["bearer"] = True

    return RiskDimensionResult(score=_clamp(score), factors=factors, flags=flags)


# ── Dimension 3: Geographic Risk ──────────────────────────────────────────────

def score_geographic_risk(countries: list[str]) -> RiskDimensionResult:
    score = 0.0
    factors: dict[str, float] = {}
    flags: dict[str, bool] = {}
    highest_risk_country = None

    for country in countries:
        if country in FATF_BLACKLIST:
            score = max(score, 80.0)
            factors[f"blacklist_{country}"] = 80.0
            flags["fatf_blacklist"] = True
            highest_risk_country = country
        elif country in SANCTIONS_COUNTRIES:
            score = max(score, 75.0)
            factors[f"sanctions_{country}"] = 75.0
            flags["sanctions_country"] = True
            highest_risk_country = highest_risk_country or country
        elif country in FATF_GREYLIST:
            pts = 40.0
            score = max(score, pts)
            factors[f"greylist_{country}"] = pts
            flags["fatf_greylist"] = True
            highest_risk_country = highest_risk_country or country
        elif country in HIGH_RISK_COUNTRIES:
            pts = 25.0
            score = max(score, pts)
            factors[f"high_risk_{country}"] = pts
            highest_risk_country = highest_risk_country or country

    flags["highest_risk_country"] = highest_risk_country  # type: ignore[assignment]
    return RiskDimensionResult(score=_clamp(score), factors=factors, flags=flags)


# ── Dimension 4: Channel Risk ─────────────────────────────────────────────────

def score_channel_risk(
    channel: str,
    is_introduced: bool = False,
    is_third_party_reliance: bool = False,
) -> RiskDimensionResult:
    score = 0.0
    factors: dict[str, float] = {}
    flags: dict[str, bool] = {}

    channel_scores = {
        "branch": 0.0,
        "phone": 10.0,
        "online": 15.0,
        "mobile": 15.0,
        "agent": 25.0,
        "introduced": 20.0,
        "third_party": 25.0,
    }
    pts = channel_scores.get(channel, 15.0)
    score += pts
    factors[f"channel_{channel}"] = pts
    flags["non_face_to_face"] = channel not in ("branch",)

    if is_introduced:
        score += 15.0
        factors["introduced"] = 15.0
        flags["is_introduced"] = True

    if is_third_party_reliance:
        score += 20.0
        factors["third_party_reliance"] = 20.0
        flags["third_party"] = True

    return RiskDimensionResult(score=_clamp(score), factors=factors, flags=flags)


# ── Dimension 5: Transaction Risk ─────────────────────────────────────────────

def score_transaction_risk(
    expected_monthly_volume_aud: Optional[float] = None,
    expected_max_transaction_aud: Optional[float] = None,
    expected_frequency: Optional[str] = None,
    crosses_border: bool = False,
) -> RiskDimensionResult:
    score = 0.0
    factors: dict[str, float] = {}
    flags: dict[str, bool] = {}

    if expected_monthly_volume_aud is not None:
        if expected_monthly_volume_aud >= 1_000_000:
            score += 40.0
            factors["high_monthly_volume"] = 40.0
            flags["is_high_value"] = True
        elif expected_monthly_volume_aud >= 100_000:
            score += 25.0
            factors["medium_monthly_volume"] = 25.0
        elif expected_monthly_volume_aud >= 10_000:
            score += 10.0
            factors["threshold_monthly_volume"] = 10.0

    if expected_max_transaction_aud is not None:
        if expected_max_transaction_aud >= 100_000:
            score += 25.0
            factors["high_single_transaction"] = 25.0
            flags["is_high_value"] = True
        elif expected_max_transaction_aud >= 10_000:
            score += 10.0
            factors["threshold_single_transaction"] = 10.0

    freq_scores = {"daily": 20.0, "weekly": 10.0, "monthly": 5.0, "occasional": 0.0}
    if expected_frequency:
        pts = freq_scores.get(expected_frequency, 0.0)
        score += pts
        if pts:
            factors[f"frequency_{expected_frequency}"] = pts

    if crosses_border:
        score += 20.0
        factors["cross_border"] = 20.0
        flags["cross_border"] = True

    return RiskDimensionResult(score=_clamp(score), factors=factors, flags=flags)


# ── Decision Gateway ───────────────────────────────────────────────────────────

def _determine_gateway(
    overall_score: float,
    customer_r: RiskDimensionResult,
    product_r: RiskDimensionResult,
    geographic_r: RiskDimensionResult,
    is_pep: bool,
    is_sanctions: bool,
) -> tuple[str, list[str]]:
    """Returns (gateway_decision, edd_triggers)."""
    edd_triggers: list[str] = []

    if is_pep:
        edd_triggers.append(EDDTrigger.pep_match.value)
    if is_sanctions:
        edd_triggers.append(EDDTrigger.sanctions_match.value)
    if geographic_r.flags.get("fatf_blacklist"):
        edd_triggers.append(EDDTrigger.high_risk_country.value)
    if geographic_r.flags.get("sanctions_country"):
        edd_triggers.append(EDDTrigger.high_risk_country.value)
    if product_r.flags.get("bearer"):
        edd_triggers.append(EDDTrigger.complex_ownership.value)
    if product_r.flags.get("crypto"):
        edd_triggers.append(EDDTrigger.crypto_exposure.value)
    if overall_score > RISK_THRESHOLDS["medium"]:
        edd_triggers.append(EDDTrigger.high_risk_score.value)

    edd_triggers = list(set(edd_triggers))  # deduplicate
    gateway = "edd" if edd_triggers else "cdd"
    return gateway, edd_triggers


def _level(score: float) -> str:
    if score <= RISK_THRESHOLDS["low"]:
        return "low"
    if score <= RISK_THRESHOLDS["medium"]:
        return "medium"
    if score <= RISK_THRESHOLDS["high"]:
        return "high"
    return "critical"


# ── Main Entry Point ───────────────────────────────────────────────────────────

def assess_customer_risk(
    customer: Customer,
    is_pep: bool = False,
    pep_type: Optional[str] = None,
    is_sanctions_match: bool = False,
    # Product
    involves_remittance: bool = False,
    involves_fx: bool = False,
    involves_crypto: bool = False,
    involves_cash: bool = False,
    involves_trust: bool = False,
    involves_bearer: bool = False,
    # Geographic
    countries: Optional[list[str]] = None,
    # Channel
    channel: str = "online",
    is_introduced: bool = False,
    is_third_party_reliance: bool = False,
    # Transaction
    expected_monthly_volume_aud: Optional[float] = None,
    expected_max_transaction_aud: Optional[float] = None,
    expected_frequency: Optional[str] = None,
    crosses_border: bool = False,
    # Weights override
    weights: Optional[dict[str, float]] = None,
) -> RiskAssessmentResult:
    w = weights or DEFAULT_WEIGHTS

    c_result = score_customer_risk(customer, is_pep, pep_type)
    p_result = score_product_risk(involves_remittance, involves_fx, involves_crypto,
                                   involves_cash, involves_trust, involves_bearer)

    all_countries = list(set(filter(None, [
        customer.nationality, customer.dual_nationality,
        customer.country_of_birth, customer.country_of_residence,
        *(countries or []),
    ])))
    g_result = score_geographic_risk(all_countries)
    ch_result = score_channel_risk(channel, is_introduced, is_third_party_reliance)
    t_result = score_transaction_risk(
        expected_monthly_volume_aud, expected_max_transaction_aud,
        expected_frequency, crosses_border,
    )

    overall = (
        c_result.score  * w["customer"]     +
        p_result.score  * w["product"]      +
        g_result.score  * w["geographic"]   +
        ch_result.score * w["channel"]      +
        t_result.score  * w["transaction"]
    )
    overall = _clamp(overall)

    gateway, triggers = _determine_gateway(
        overall, c_result, p_result, g_result, is_pep, is_sanctions_match
    )

    return RiskAssessmentResult(
        customer_risk=c_result,
        product_risk=p_result,
        geographic_risk=g_result,
        channel_risk=ch_result,
        transaction_risk=t_result,
        overall_score=round(overall, 2),
        overall_level=_level(overall),
        gateway_decision=gateway,
        edd_triggers=triggers,
        weights=w,
    )


def cdd_level_from_gateway(gateway: str, overall_score: float) -> CDDLevel:
    if gateway == "edd":
        return CDDLevel.enhanced
    if overall_score <= RISK_THRESHOLDS["low"]:
        return CDDLevel.simplified
    return CDDLevel.standard


def risk_level_from_score(score: float) -> RiskLevel:
    level = _level(score)
    return RiskLevel[level] if level != "critical" else RiskLevel.critical
