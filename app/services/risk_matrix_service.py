"""
AUSTRAC/FATF Traditional Risk Matrix Service.

Implements the 4-dimension risk assessment methodology recommended by
AUSTRAC's Risk Management guidance and FATF Recommendation 1 (RBA):

  Dimension 1 — Customer Risk         (default 30%)
  Dimension 2 — Geographic Risk       (default 25%)
  Dimension 3 — Product/Service Risk  (default 20%)
  Dimension 4 — Transaction Risk      (default 25%)

Each dimension scores 0–100. The overall matrix score is a weighted sum,
also 0–100, mapped to a risk level (low / medium / high / critical).

DISCLAIMER: Risk matrix scores support compliance workflow only.
All regulatory decisions remain with the reporting entity.
"""
from __future__ import annotations

from dataclasses import dataclass, field
from typing import Optional

from sqlalchemy.orm import Session

from app.models.customer import Customer, RiskLevel
from app.models.transaction import Transaction

# ── Country Lists (FATF / AUSTRAC) ────────────────────────────────────────────

FATF_BLACKLIST = frozenset({"KP", "IR", "MM"})  # FATF call-to-action jurisdictions
FATF_GREYLIST = frozenset({
    "AF", "BB", "BF", "CM", "CD", "HT", "JM", "ML", "MZ", "NI",
    "NG", "PK", "PA", "PH", "SN", "SS", "SY", "TZ", "TT", "UG",
    "AE", "VN", "YE",
})
SANCTIONED_COUNTRIES = frozenset({"IR", "KP", "RU", "BY", "SY", "CU", "SD"})

# High-risk jurisdictions not on FATF list but with elevated AUSTRAC concern
AUSTRAC_WATCH_JURISDICTIONS = frozenset({"CN", "VN", "PH", "IN", "BD", "LB", "ET"})

# ── High-Risk Transaction Types ───────────────────────────────────────────────

_CRYPTO_TYPES = frozenset({"crypto_purchase", "crypto_transfer", "crypto_sale"})
_REMITTANCE_TYPES = frozenset({"remittance", "cross_border_transfer"})
_CASH_TYPES = frozenset({"cash_deposit", "cash_withdrawal"})
_REAL_ESTATE_TYPES = frozenset({"real_estate_settlement"})
_WIRE_TYPES = frozenset({"wire_transfer", "swift_transfer"})
_GAMBLING_TYPES = frozenset({"gambling_payout", "gambling_deposit"})

# High-risk payment methods per AUSTRAC guidance
_HIGH_RISK_PAYMENT_METHODS = frozenset({
    "cryptocurrency", "cash", "prepaid_card", "money_order", "hawala",
})
_MEDIUM_RISK_PAYMENT_METHODS = frozenset({
    "wire_transfer", "international_wire", "bank_transfer",
})

TTR_THRESHOLD = 10_000.0
NEAR_THRESHOLD_MIN = 9_000.0
HIGH_VALUE_1 = 50_000.0
HIGH_VALUE_2 = 100_000.0


# ── Result Types ───────────────────────────────────────────────────────────────

@dataclass
class RiskDimension:
    name: str
    score: float                        # 0–100
    weight: float                       # contribution weight (0.0–1.0)
    risk_level: str                     # low | medium | high | critical
    factors: list[str] = field(default_factory=list)
    max_factor: str = ""                # single most significant factor


@dataclass
class RiskMatrixResult:
    overall_score: float                # 0–100 weighted composite
    risk_level: str                     # low | medium | high | critical
    customer_dimension: RiskDimension
    geographic_dimension: RiskDimension
    product_dimension: RiskDimension
    transaction_dimension: RiskDimension

    def to_dict(self) -> dict:
        def _dim(d: RiskDimension) -> dict:
            return {
                "score": round(d.score, 1),
                "weight": d.weight,
                "risk_level": d.risk_level,
                "factors": d.factors,
                "primary_factor": d.max_factor,
            }
        return {
            "overall_score": round(self.overall_score, 1),
            "risk_level": self.risk_level,
            "dimensions": {
                "customer":    _dim(self.customer_dimension),
                "geographic":  _dim(self.geographic_dimension),
                "product":     _dim(self.product_dimension),
                "transaction": _dim(self.transaction_dimension),
            },
            "methodology": "AUSTRAC Risk Management Guidance / FATF Recommendation 1 (RBA)",
            "disclaimer": (
                "Risk matrix scores support compliance workflow only. "
                "All regulatory decisions remain with the reporting entity."
            ),
        }


def _risk_level_from_score(score: float) -> str:
    if score >= 76:
        return "critical"
    elif score >= 51:
        return "high"
    elif score >= 26:
        return "medium"
    return "low"


# ── Dimension 1: Customer Risk ─────────────────────────────────────────────────

def _score_customer_risk(customer: Customer, weight: float) -> RiskDimension:
    """
    FATF RBA — Customer risk factors:
      - PEP status (domestic, foreign, international organisation)
      - High Intensity Operation / HIO classification
      - Existing AML risk profile
      - Adverse media / negative news
      - Business type vs individual
      - Non-face-to-face / anonymous onboarding
    """
    score = 0.0
    factors: list[str] = []

    # PEP — highest individual risk factor per FATF Rec 12
    if getattr(customer, "is_pep", False):
        pep_type = getattr(customer, "pep_type", None)
        pep_val = pep_type.value if hasattr(pep_type, "value") else str(pep_type or "")
        if "foreign" in pep_val.lower():
            score += 55.0
            factors.append("foreign_pep")
        elif "domestic" in pep_val.lower():
            score += 40.0
            factors.append("domestic_pep")
        else:
            score += 45.0
            factors.append("pep")

    # Existing AML risk profile
    risk_level = getattr(customer, "risk_level", None)
    risk_val = risk_level.value if hasattr(risk_level, "value") else str(risk_level or "low")
    if risk_val == "critical":
        score += 40.0
        factors.append("customer_risk_level:critical")
    elif risk_val == "high":
        score += 30.0
        factors.append("customer_risk_level:high")
    elif risk_val == "medium":
        score += 15.0
        factors.append("customer_risk_level:medium")

    # Numeric risk score from customer profile
    customer_score = getattr(customer, "risk_score", 0) or 0
    if customer_score >= 80:
        score += 20.0
        factors.append(f"risk_score:{customer_score:.0f}")
    elif customer_score >= 60:
        score += 10.0
        factors.append(f"risk_score:{customer_score:.0f}")

    # Business customer — higher ML risk than individual (FATF)
    customer_type = getattr(customer, "customer_type", None)
    ctype = customer_type.value if hasattr(customer_type, "value") else str(customer_type or "")
    if ctype in ("company", "trust", "partnership", "association"):
        score += 10.0
        factors.append(f"business_entity:{ctype}")

    # Non-face-to-face / digital onboarding
    channel = getattr(customer, "onboarding_channel", None)
    ch_val = channel.value if hasattr(channel, "value") else str(channel or "")
    if ch_val in ("digital", "online", "third_party_introducer"):
        score += 8.0
        factors.append(f"onboarding_channel:{ch_val}")

    # CDD level — if EDD already applied, that itself is a signal
    cdd = getattr(customer, "cdd_level", None)
    cdd_val = cdd.value if hasattr(cdd, "value") else str(cdd or "")
    if cdd_val == "edd":
        score += 10.0
        factors.append("edd_applied")

    score = min(score, 100.0)
    primary = factors[0] if factors else "no_elevated_factors"
    return RiskDimension(
        name="customer",
        score=score,
        weight=weight,
        risk_level=_risk_level_from_score(score),
        factors=factors,
        max_factor=primary,
    )


# ── Dimension 2: Geographic Risk ──────────────────────────────────────────────

def _score_geographic_risk(txn: Transaction, customer: Customer, weight: float) -> RiskDimension:
    """
    FATF Recommendation 19 — Higher-risk countries:
      - FATF public statement (call to action / blacklist)
      - FATF grey list
      - UN/OFAC/DFAT sanctioned jurisdictions
      - Customer country of residence
    """
    score = 0.0
    factors: list[str] = []

    countries = {
        txn.source_country,
        txn.destination_country,
        getattr(customer, "country_of_residence", None),
        getattr(customer, "nationality", None),
    } - {None, "AU", "AUS"}

    for c in countries:
        if c in FATF_BLACKLIST:
            score += 60.0
            factors.append(f"fatf_blacklist:{c}")
        elif c in SANCTIONED_COUNTRIES:
            score += 50.0
            factors.append(f"sanctioned_country:{c}")
        elif c in FATF_GREYLIST:
            score += 30.0
            factors.append(f"fatf_greylist:{c}")
        elif c in AUSTRAC_WATCH_JURISDICTIONS:
            score += 15.0
            factors.append(f"austrac_watch:{c}")

    # Cross-border inherently higher risk
    if getattr(txn, "is_cross_border", False):
        score += 15.0
        factors.append("cross_border")

    # Source country ≠ destination country (routing complexity)
    src = txn.source_country
    dst = txn.destination_country
    if src and dst and src != dst and src != "AU" and dst != "AU":
        score += 10.0
        factors.append("third_country_routing")

    score = min(score, 100.0)
    primary = max(factors, key=lambda f: (
        60 if "blacklist" in f else
        50 if "sanctioned" in f else
        30 if "greylist" in f else
        15 if "austrac" in f else 10
    ), default="no_elevated_countries")
    return RiskDimension(
        name="geographic",
        score=score,
        weight=weight,
        risk_level=_risk_level_from_score(score),
        factors=factors,
        max_factor=primary,
    )


# ── Dimension 3: Product / Service Risk ───────────────────────────────────────

def _score_product_risk(txn: Transaction, weight: float) -> RiskDimension:
    """
    FATF Recommendation 1 — Product/service/delivery channel risk:
      - Transaction type (crypto, remittance, cash, real estate)
      - Payment method
      - Delivery channel anonymity
    """
    score = 0.0
    factors: list[str] = []

    txn_type = txn.transaction_type.value if txn.transaction_type else ""
    payment = txn.payment_method.value if txn.payment_method else ""
    channel = getattr(txn, "delivery_channel", None)
    ch_val = channel.value if hasattr(channel, "value") else str(channel or "")

    # Transaction type risk
    if txn_type in _CRYPTO_TYPES:
        score += 40.0
        factors.append(f"crypto_transaction:{txn_type}")
    elif txn_type in _REMITTANCE_TYPES:
        score += 35.0
        factors.append(f"remittance:{txn_type}")
    elif txn_type in _CASH_TYPES:
        score += 35.0
        factors.append(f"cash_transaction:{txn_type}")
    elif txn_type in _REAL_ESTATE_TYPES:
        score += 30.0
        factors.append("real_estate_settlement")
    elif txn_type in _GAMBLING_TYPES:
        score += 30.0
        factors.append(f"gambling:{txn_type}")
    elif txn_type in _WIRE_TYPES:
        score += 20.0
        factors.append(f"wire_transfer:{txn_type}")

    # Payment method risk
    if payment in _HIGH_RISK_PAYMENT_METHODS:
        score += 25.0
        factors.append(f"high_risk_payment_method:{payment}")
    elif payment in _MEDIUM_RISK_PAYMENT_METHODS:
        score += 10.0
        factors.append(f"medium_risk_payment_method:{payment}")

    # Delivery channel
    if ch_val in ("atm", "third_party", "agent", "online"):
        score += 10.0
        factors.append(f"delivery_channel:{ch_val}")

    score = min(score, 100.0)
    primary = factors[0] if factors else "standard_product"
    return RiskDimension(
        name="product",
        score=score,
        weight=weight,
        risk_level=_risk_level_from_score(score),
        factors=factors,
        max_factor=primary,
    )


# ── Dimension 4: Transaction Risk ─────────────────────────────────────────────

def _score_transaction_risk(txn: Transaction, weight: float) -> RiskDimension:
    """
    AUSTRAC TTR/structuring indicators + FATF high-value transaction risk.
    """
    score = 0.0
    factors: list[str] = []

    amount = txn.amount_aud or txn.amount or 0.0

    # Structuring — highest transaction risk indicator per AUSTRAC
    if getattr(txn, "is_structuring_suspect", False):
        score += 50.0
        factors.append("structuring_suspect")

    # Near-threshold (deliberate avoidance of TTR reporting)
    if NEAR_THRESHOLD_MIN <= amount < TTR_THRESHOLD:
        score += 35.0
        factors.append(f"near_ttr_threshold:AUD{amount:,.0f}")
    elif amount >= TTR_THRESHOLD:
        score += 15.0
        factors.append(f"above_ttr_threshold:AUD{amount:,.0f}")

    # High-value amounts
    if amount >= HIGH_VALUE_2:
        score += 25.0
        factors.append(f"very_high_value:AUD{amount:,.0f}")
    elif amount >= HIGH_VALUE_1:
        score += 15.0
        factors.append(f"high_value:AUD{amount:,.0f}")

    # Round number — AUSTRAC structuring indicator
    if getattr(txn, "is_round_number", False) and amount >= 1_000.0:
        score += 15.0
        factors.append("round_number_amount")

    # Cash intensity
    if getattr(txn, "is_cash_intensive", False):
        score += 20.0
        factors.append("cash_intensive")

    # Near-threshold flag already set by scoring engine
    if getattr(txn, "is_near_threshold", False) and "near_ttr_threshold" not in " ".join(factors):
        score += 20.0
        factors.append("near_threshold_flag")

    score = min(score, 100.0)
    primary = factors[0] if factors else "standard_transaction"
    return RiskDimension(
        name="transaction",
        score=score,
        weight=weight,
        risk_level=_risk_level_from_score(score),
        factors=factors,
        max_factor=primary,
    )


# ── Main Entry Point ───────────────────────────────────────────────────────────

def compute_risk_matrix(
    txn: Transaction,
    customer: Customer,
    db: Session,
    *,
    customer_weight: float = 0.30,
    geographic_weight: float = 0.25,
    product_weight: float = 0.20,
    transaction_weight: float = 0.25,
) -> RiskMatrixResult:
    """
    Compute the AUSTRAC/FATF 4-dimension risk matrix for a transaction.

    Weights default to AUSTRAC guidance; org-level overrides accepted.
    Returns a RiskMatrixResult with per-dimension detail and overall score.
    """
    c_dim = _score_customer_risk(customer, customer_weight)
    g_dim = _score_geographic_risk(txn, customer, geographic_weight)
    p_dim = _score_product_risk(txn, product_weight)
    t_dim = _score_transaction_risk(txn, transaction_weight)

    overall = (
        c_dim.score * customer_weight +
        g_dim.score * geographic_weight +
        p_dim.score * product_weight +
        t_dim.score * transaction_weight
    )
    overall = min(round(overall, 2), 100.0)

    return RiskMatrixResult(
        overall_score=overall,
        risk_level=_risk_level_from_score(overall),
        customer_dimension=c_dim,
        geographic_dimension=g_dim,
        product_dimension=p_dim,
        transaction_dimension=t_dim,
    )


# ── Approval Score Calculator ──────────────────────────────────────────────────

def compute_question_score(responses: list) -> Optional[float]:
    """
    Given a list of TransactionQuestionResponse ORM objects, compute 0–100.
    Excludes not_applicable answers from the denominator.
    Returns None if no responses are answered (not_applicable).
    """
    from app.models.risk_matrix import QuestionAnswer
    answered = [r for r in responses if r.answer != QuestionAnswer.not_applicable]
    if not answered:
        return None
    compliant = sum(
        1 for r in answered
        if r.answer == QuestionAnswer.yes
    )
    return round(compliant / len(answered) * 100.0, 2)


def compute_final_approval_score(
    alert_score: float,
    question_score: Optional[float],
    custom_question_weight: float = 0.20,
) -> tuple[float, dict]:
    """
    Combine the base alert score with the custom question score.

    If question_score is None (no questions answered yet), returns the
    alert_score unchanged and marks questions_complete = False.

    A question_score of 0 (all non-compliant) increases effective risk.
    A question_score of 100 (all compliant) reduces effective risk.
    Note: questions scoring 0 means maximum risk contribution.
    """
    if question_score is None:
        return round(alert_score, 2), {
            "alert_score": round(alert_score, 2),
            "question_score": None,
            "questions_complete": False,
            "final_approval_score": round(alert_score, 2),
        }

    q_weight = max(0.0, min(custom_question_weight, 0.40))
    base_weight = 1.0 - q_weight

    # Invert question score: 100% compliant → 0 risk contribution, 0% → 100 risk
    question_risk = 100.0 - question_score

    final = min((alert_score * base_weight) + (question_risk * q_weight), 100.0)
    final = round(final, 2)

    return final, {
        "alert_score": round(alert_score, 2),
        "question_score": round(question_score, 2),
        "question_risk_contribution": round(question_risk * q_weight, 2),
        "alert_score_contribution": round(alert_score * base_weight, 2),
        "custom_question_weight": q_weight,
        "questions_complete": True,
        "final_approval_score": final,
    }
