"""
Transaction Monitoring Engine.

Pipeline for each transaction:
  1. Evaluate 6-dimension behaviour signals (frequency, velocity, value, geographic, behaviour, crypto)
  2. Evaluate no-code MonitoringRules (AND within group, OR across groups)
  3. Calculate composite alert score: behaviour(50%) + rule(35%) + customer_risk(15%)
  4. Emit TransactionAlert records and log RuleExecution records (immutable)

DISCLAIMER: The engine flags transactions for human review only.
No match constitutes a determination of suspicious activity or criminal conduct.
"""
from __future__ import annotations

from dataclasses import dataclass, field
from datetime import datetime, timedelta, timezone
from typing import Any, Optional
from uuid import uuid4

from sqlalchemy.orm import Session

from app.models.customer import Customer
from app.models.monitoring import (
    AlertCategory,
    AlertSeverity,
    AlertStatus,
    AlertType,
    MonitoringRule,
    RuleExecution,
    RuleStatus,
    TransactionAlert,
)
from app.models.transaction import (
    CustomerBehaviourProfile,
    Transaction,
    TransactionCryptoDetail,
)

# ── Constants ──────────────────────────────────────────────────────────────────

FATF_BLACKLIST = frozenset({"KP", "IR", "MM"})
FATF_GREYLIST = frozenset({
    "AF", "BB", "BF", "CM", "CD", "HT", "JM", "ML", "MZ", "NI",
    "NG", "PK", "PA", "PH", "SN", "SS", "SY", "TZ", "TT", "UG",
    "AE", "VN", "YE",
})
SANCTIONED_COUNTRIES = frozenset({"IR", "KP", "RU", "BY", "SY", "CU", "SD"})

TTR_THRESHOLD_AUD = 10_000.0
NEAR_THRESHOLD_PCT = 0.10     # within 10% of reporting threshold

DEFAULT_SIGNAL_WEIGHTS: dict[str, float] = {
    "frequency": 0.15,
    "velocity":  0.20,
    "value":     0.20,
    "geographic": 0.20,
    "behaviour": 0.15,
    "crypto":    0.10,
}

# Score → severity thresholds
SCORE_THRESHOLDS = {"critical": 80.0, "high": 60.0, "medium": 40.0}


# ── Behaviour Signal Dataclass ─────────────────────────────────────────────────

@dataclass
class BehaviourSignals:
    # Frequency dimension
    frequency_score: float = 0.0
    txn_per_day: float = 0.0
    rapid_repeat: bool = False
    dormant_reactivated: bool = False
    freq_factors: list[str] = field(default_factory=list)

    # Velocity dimension
    velocity_score: float = 0.0
    high_speed_movement: bool = False
    burst_activity: bool = False
    velocity_factors: list[str] = field(default_factory=list)

    # Value dimension
    value_score: float = 0.0
    is_large: bool = False
    is_near_threshold: bool = False
    is_round_number: bool = False
    sudden_increase: bool = False
    value_factors: list[str] = field(default_factory=list)

    # Geographic dimension
    geographic_score: float = 0.0
    fatf_blacklist_country: bool = False
    sanctioned_country: bool = False
    fatf_greylist_country: bool = False
    geo_factors: list[str] = field(default_factory=list)

    # Behaviour dimension
    behaviour_score: float = 0.0
    profile_deviation: bool = False
    occupation_mismatch: bool = False
    unusual_channel: bool = False
    behaviour_factors: list[str] = field(default_factory=list)

    # Crypto dimension
    crypto_score: float = 0.0
    mixer_exposure: bool = False
    darknet_exposure: bool = False
    sanctioned_wallet: bool = False
    crypto_factors: list[str] = field(default_factory=list)

    # Combined
    combined_score: float = 0.0
    signal_weights: dict[str, float] = field(default_factory=dict)

    def to_dict(self) -> dict[str, Any]:
        return {
            "frequency": {
                "score": self.frequency_score, "txn_per_day": self.txn_per_day,
                "rapid_repeat": self.rapid_repeat,
                "dormant_reactivated": self.dormant_reactivated,
                "factors": self.freq_factors,
            },
            "velocity": {
                "score": self.velocity_score,
                "high_speed_movement": self.high_speed_movement,
                "burst_activity": self.burst_activity,
                "factors": self.velocity_factors,
            },
            "value": {
                "score": self.value_score, "is_large": self.is_large,
                "is_near_threshold": self.is_near_threshold,
                "is_round_number": self.is_round_number,
                "sudden_increase": self.sudden_increase,
                "factors": self.value_factors,
            },
            "geographic": {
                "score": self.geographic_score,
                "fatf_blacklist": self.fatf_blacklist_country,
                "sanctioned": self.sanctioned_country,
                "fatf_greylist": self.fatf_greylist_country,
                "factors": self.geo_factors,
            },
            "behaviour": {
                "score": self.behaviour_score,
                "profile_deviation": self.profile_deviation,
                "occupation_mismatch": self.occupation_mismatch,
                "unusual_channel": self.unusual_channel,
                "factors": self.behaviour_factors,
            },
            "crypto": {
                "score": self.crypto_score,
                "mixer_exposure": self.mixer_exposure,
                "darknet_exposure": self.darknet_exposure,
                "sanctioned_wallet": self.sanctioned_wallet,
                "factors": self.crypto_factors,
            },
            "combined_score": self.combined_score,
        }


# ── Dimension Scorers ──────────────────────────────────────────────────────────

def _score_frequency(
    txn: Transaction,
    profile: Optional[CustomerBehaviourProfile],
    recent_24h: list[Transaction],
) -> tuple[float, dict]:
    score = 0.0
    signals: dict[str, Any] = {
        "rapid_repeat": False, "dormant_reactivated": False, "factors": [],
    }

    count_24h = len(recent_24h)

    if profile:
        if profile.is_dormant or profile.dormancy_reactivated:
            score += 40.0
            signals["dormant_reactivated"] = True
            signals["factors"].append("dormant_account_reactivated")

        daily_avg = profile.avg_txn_per_day or 1.0
        if count_24h > daily_avg * 3:
            score += 30.0
            signals["rapid_repeat"] = True
            signals["factors"].append(f"txn_count_24h={count_24h}_vs_avg={daily_avg:.1f}")

    if count_24h >= 10:
        score += 20.0
        signals["factors"].append(f"high_24h_count={count_24h}")

    signals["txn_per_day"] = count_24h
    return min(score, 100.0), signals


def _score_velocity(
    txn: Transaction,
    profile: Optional[CustomerBehaviourProfile],
    recent_1h: list[Transaction],
    recent_24h: list[Transaction],
) -> tuple[float, dict]:
    score = 0.0
    signals: dict[str, Any] = {
        "high_speed_movement": False, "burst_activity": False, "factors": [],
    }

    volume_1h = sum(t.amount_aud or t.amount for t in recent_1h)
    volume_24h = sum(t.amount_aud or t.amount for t in recent_24h)

    if len(recent_1h) >= 5:
        score += 30.0
        signals["burst_activity"] = True
        signals["factors"].append(f"burst_5+_txns_in_1h")

    if volume_1h >= 50_000:
        score += 40.0
        signals["high_speed_movement"] = True
        signals["factors"].append(f"volume_1h=AUD${volume_1h:,.0f}")

    if profile:
        monthly_avg = profile.total_volume_30d_aud / 30 if profile.total_volume_30d_aud else 1.0
        if volume_24h > monthly_avg * 5:
            score += 25.0
            signals["factors"].append(f"velocity_24h_5x_daily_avg")

    return min(score, 100.0), signals


def _score_value(
    txn: Transaction,
    profile: Optional[CustomerBehaviourProfile],
) -> tuple[float, dict]:
    score = 0.0
    amount = txn.amount_aud or txn.amount
    signals: dict[str, Any] = {
        "is_large": False, "is_near_threshold": False,
        "is_round_number": False, "sudden_increase": False, "factors": [],
    }

    if amount >= TTR_THRESHOLD_AUD:
        score += 30.0
        signals["is_large"] = True
        signals["factors"].append(f"amount_AUD${amount:,.0f}_>=_TTR")

    near_threshold = TTR_THRESHOLD_AUD * (1 - NEAR_THRESHOLD_PCT)
    if near_threshold <= amount < TTR_THRESHOLD_AUD:
        score += 25.0
        signals["is_near_threshold"] = True
        signals["factors"].append("near_TTR_threshold")

    if txn.is_round_number:
        score += 10.0
        signals["is_round_number"] = True
        signals["factors"].append("round_number_structuring_indicator")

    if profile and profile.avg_txn_amount_aud:
        if amount > profile.avg_txn_amount_aud * 5:
            score += 25.0
            signals["sudden_increase"] = True
            signals["factors"].append(f"amount_5x_avg={profile.avg_txn_amount_aud:,.0f}")

    return min(score, 100.0), signals


def _score_geographic(txn: Transaction) -> tuple[float, dict]:
    score = 0.0
    signals: dict[str, Any] = {
        "fatf_blacklist_country": False,
        "sanctioned_country": False,
        "fatf_greylist_country": False,
        "factors": [],
    }

    countries = {
        c for c in [
            txn.source_country, txn.destination_country,
            txn.country_origin, txn.country_destination,
        ] if c
    }

    for country in countries:
        cc = country.upper()
        if cc in FATF_BLACKLIST:
            score += 60.0
            signals["fatf_blacklist_country"] = True
            signals["factors"].append(f"FATF_blacklist:{cc}")
        elif cc in SANCTIONED_COUNTRIES:
            score += 50.0
            signals["sanctioned_country"] = True
            signals["factors"].append(f"sanctioned_country:{cc}")
        elif cc in FATF_GREYLIST:
            score += 20.0
            signals["fatf_greylist_country"] = True
            signals["factors"].append(f"FATF_greylist:{cc}")

    if txn.is_cross_border:
        score += 10.0
        signals["factors"].append("cross_border")

    return min(score, 100.0), signals


# Occupations that are inconsistent with high-value / cross-border / crypto activity
_LOW_INCOME_OCCUPATIONS = frozenset({
    "student", "retiree", "retired", "pensioner", "unemployed", "homemaker",
    "home maker", "cleaner", "labourer", "laborer", "driver", "tradesperson",
    "apprentice", "volunteer", "carer", "caretaker", "part time", "casual",
})

# Transaction types that are high-risk when paired with a low-income occupation profile
_HIGH_RISK_TXN_TYPES = frozenset({
    "remittance", "crypto_transfer", "crypto_purchase", "real_estate_settlement",
    "cross_border_transfer",
})

_OCCUPATION_MISMATCH_AMOUNT_AUD = 5_000.0


def _score_behaviour(
    txn: Transaction,
    customer: Customer,
    profile: Optional[CustomerBehaviourProfile],
) -> tuple[float, dict]:
    score = 0.0
    signals: dict[str, Any] = {
        "profile_deviation": False, "occupation_mismatch": False,
        "unusual_channel": False, "factors": [],
    }

    if customer.is_pep:
        score += 20.0
        signals["factors"].append("pep_customer")

    # Occupation mismatch — high-risk transaction inconsistent with declared occupation
    occupation = (getattr(customer, "occupation", None) or "").lower().strip()
    if occupation:
        is_low_income_occupation = any(o in occupation for o in _LOW_INCOME_OCCUPATIONS)
        amount_aud = txn.amount_aud or txn.amount
        if (
            is_low_income_occupation
            and txn.transaction_type.value in _HIGH_RISK_TXN_TYPES
            and amount_aud >= _OCCUPATION_MISMATCH_AMOUNT_AUD
        ):
            score += 25.0
            signals["occupation_mismatch"] = True
            signals["factors"].append(
                f"occupation_mismatch:occupation={occupation},"
                f"txn_type={txn.transaction_type.value},amount=AUD${amount_aud:,.0f}"
            )

    if profile:
        usual_methods = profile.usual_payment_methods or []
        if usual_methods and txn.payment_method.value not in usual_methods:
            score += 15.0
            signals["unusual_channel"] = True
            signals["factors"].append(f"unusual_payment_method:{txn.payment_method.value}")

        usual_countries = set((profile.usual_destination_countries or []) +
                               (profile.usual_source_countries or []))
        countries = {txn.source_country, txn.destination_country} - {None}
        if countries and not countries.intersection(usual_countries):
            score += 20.0
            signals["profile_deviation"] = True
            signals["factors"].append("new_country_not_in_profile")

    return min(score, 100.0), signals


def _score_crypto(txn: Transaction, db: Session) -> tuple[float, dict]:
    score = 0.0
    signals: dict[str, Any] = {
        "mixer_exposure": False, "darknet_exposure": False,
        "sanctioned_wallet": False, "factors": [],
    }

    detail: Optional[TransactionCryptoDetail] = (
        db.query(TransactionCryptoDetail)
        .filter(TransactionCryptoDetail.transaction_id == txn.id)
        .first()
    )
    if not detail:
        return 0.0, signals

    if (detail.mixer_exposure_pct or 0) > 10:
        score += 50.0
        signals["mixer_exposure"] = True
        signals["factors"].append(f"mixer_exposure={detail.mixer_exposure_pct:.1f}%")

    if (detail.darknet_exposure_pct or 0) > 5:
        score += 60.0
        signals["darknet_exposure"] = True
        signals["factors"].append(f"darknet_exposure={detail.darknet_exposure_pct:.1f}%")

    if (detail.sanctioned_exposure_pct or 0) > 0:
        score += 70.0
        signals["sanctioned_wallet"] = True
        signals["factors"].append(f"sanctioned_exposure={detail.sanctioned_exposure_pct:.1f}%")

    return min(score, 100.0), signals


# ── Main Signal Evaluator ──────────────────────────────────────────────────────

def evaluate_behaviour_signals(
    transaction: Transaction,
    customer: Customer,
    profile: Optional[CustomerBehaviourProfile],
    db: Session,
    weights: Optional[dict[str, float]] = None,
) -> BehaviourSignals:
    w = weights or DEFAULT_SIGNAL_WEIGHTS
    now = datetime.now(timezone.utc)

    recent_1h = _recent_transactions(db, transaction.customer_id, transaction.org_id, now, hours=1)
    recent_24h = _recent_transactions(db, transaction.customer_id, transaction.org_id, now, hours=24)

    freq_score, freq_sigs = _score_frequency(transaction, profile, recent_24h)
    vel_score, vel_sigs = _score_velocity(transaction, profile, recent_1h, recent_24h)
    val_score, val_sigs = _score_value(transaction, profile)
    geo_score, geo_sigs = _score_geographic(transaction)
    beh_score, beh_sigs = _score_behaviour(transaction, customer, profile)
    cry_score, cry_sigs = _score_crypto(transaction, db)

    combined = (
        freq_score * w["frequency"] +
        vel_score  * w["velocity"] +
        val_score  * w["value"] +
        geo_score  * w["geographic"] +
        beh_score  * w["behaviour"] +
        cry_score  * w["crypto"]
    )

    return BehaviourSignals(
        frequency_score=freq_score,
        txn_per_day=freq_sigs.get("txn_per_day", 0),
        rapid_repeat=freq_sigs.get("rapid_repeat", False),
        dormant_reactivated=freq_sigs.get("dormant_reactivated", False),
        freq_factors=freq_sigs.get("factors", []),

        velocity_score=vel_score,
        high_speed_movement=vel_sigs.get("high_speed_movement", False),
        burst_activity=vel_sigs.get("burst_activity", False),
        velocity_factors=vel_sigs.get("factors", []),

        value_score=val_score,
        is_large=val_sigs.get("is_large", False),
        is_near_threshold=val_sigs.get("is_near_threshold", False),
        is_round_number=val_sigs.get("is_round_number", False),
        sudden_increase=val_sigs.get("sudden_increase", False),
        value_factors=val_sigs.get("factors", []),

        geographic_score=geo_score,
        fatf_blacklist_country=geo_sigs.get("fatf_blacklist_country", False),
        sanctioned_country=geo_sigs.get("sanctioned_country", False),
        fatf_greylist_country=geo_sigs.get("fatf_greylist_country", False),
        geo_factors=geo_sigs.get("factors", []),

        behaviour_score=beh_score,
        profile_deviation=beh_sigs.get("profile_deviation", False),
        occupation_mismatch=beh_sigs.get("occupation_mismatch", False),
        unusual_channel=beh_sigs.get("unusual_channel", False),
        behaviour_factors=beh_sigs.get("factors", []),

        crypto_score=cry_score,
        mixer_exposure=cry_sigs.get("mixer_exposure", False),
        darknet_exposure=cry_sigs.get("darknet_exposure", False),
        sanctioned_wallet=cry_sigs.get("sanctioned_wallet", False),
        crypto_factors=cry_sigs.get("factors", []),

        combined_score=min(combined, 100.0),
        signal_weights=w,
    )


# ── Rule Engine ────────────────────────────────────────────────────────────────

def _resolve_field(obj: Any, path: str) -> Any:
    """Resolve dot-notation field path on a transaction context dict."""
    parts = path.split(".")
    current = obj
    for part in parts:
        if isinstance(current, dict):
            current = current.get(part)
        else:
            current = getattr(current, part, None)
        if current is None:
            return None
    return current


def _evaluate_condition(context: dict, condition) -> bool:
    """Evaluate a single RuleCondition against a transaction context dict."""
    from app.models.monitoring import RuleConditionOperator
    val = _resolve_field(context, condition.field_path)
    cv = condition.value
    op = condition.operator

    if op == RuleConditionOperator.equals:
        return str(val) == str(cv) if val is not None else False
    elif op == RuleConditionOperator.not_equals:
        return str(val) != str(cv)
    elif op == RuleConditionOperator.greater_than:
        return float(val or 0) > float(cv)
    elif op == RuleConditionOperator.greater_or_equal:
        return float(val or 0) >= float(cv)
    elif op == RuleConditionOperator.less_than:
        return float(val or 0) < float(cv)
    elif op == RuleConditionOperator.less_or_equal:
        return float(val or 0) <= float(cv)
    elif op == RuleConditionOperator.in_list:
        return str(val) in (cv or [])
    elif op == RuleConditionOperator.not_in_list:
        return str(val) not in (cv or [])
    elif op == RuleConditionOperator.contains:
        return cv in str(val or "")
    elif op == RuleConditionOperator.starts_with:
        return str(val or "").startswith(str(cv))
    elif op == RuleConditionOperator.is_true:
        return bool(val)
    elif op == RuleConditionOperator.is_false:
        return not bool(val)
    elif op == RuleConditionOperator.is_null:
        return val is None
    elif op == RuleConditionOperator.between:
        lo, hi = cv[0], cv[1]
        return float(lo) <= float(val or 0) <= float(hi)
    return False


def _build_txn_context(
    transaction: Transaction,
    customer: Customer,
    profile: Optional[CustomerBehaviourProfile],
    signals: BehaviourSignals,
) -> dict[str, Any]:
    """Flat dict for no-code rule evaluation."""
    amount_aud = transaction.amount_aud or transaction.amount
    ctx: dict[str, Any] = {
        # Transaction fields
        "amount_aud": amount_aud,
        "amount": transaction.amount,
        "currency": transaction.currency,
        "transaction_type": transaction.transaction_type.value,
        "payment_method": transaction.payment_method.value,
        "direction": transaction.direction.value,
        "is_cross_border": transaction.is_cross_border,
        "is_near_threshold": transaction.is_near_threshold,
        "is_round_number": transaction.is_round_number,
        "is_structuring_suspect": transaction.is_structuring_suspect,
        "is_cash_intensive": transaction.is_cash_intensive,
        "source_country": transaction.source_country,
        "destination_country": transaction.destination_country,
        "risk_score": transaction.risk_score,
        "behaviour_score": transaction.behaviour_score,
        # Customer fields
        "customer": {
            "risk_level": getattr(customer, "risk_level", None),
            "risk_score": getattr(customer, "risk_score", 0),
            "is_pep": getattr(customer, "is_pep", False),
            "cdd_level": getattr(customer.cdd_level, "value", None) if hasattr(customer, "cdd_level") else None,
            "country_of_residence": getattr(customer, "country_of_residence", None),
            "nationality": getattr(customer, "nationality", None),
        },
        # Behaviour signal scores
        "behaviour_signals": {
            "combined_score": signals.combined_score,
            "frequency_score": signals.frequency_score,
            "velocity_score": signals.velocity_score,
            "value_score": signals.value_score,
            "geographic_score": signals.geographic_score,
            "is_dormant_reactivated": signals.dormant_reactivated,
            "has_mixer_exposure": signals.mixer_exposure,
            "has_darknet_exposure": signals.darknet_exposure,
            "has_sanctioned_wallet": signals.sanctioned_wallet,
        },
    }
    return ctx


def evaluate_rules(
    transaction: Transaction,
    customer: Customer,
    profile: Optional[CustomerBehaviourProfile],
    signals: BehaviourSignals,
    rules: list[MonitoringRule],
    db: Session,
) -> list[dict[str, Any]]:
    """
    Evaluate all active rules against a transaction.
    Logs immutable RuleExecution for every rule (matched or not).
    Returns list of dicts for rules that matched.
    """
    ctx = _build_txn_context(transaction, customer, profile, signals)
    matched_rules = []

    for rule in rules:
        groups = rule.condition_groups
        matched_group_index: Optional[int] = None

        for g_idx, group in enumerate(groups):
            group_result = all(
                _evaluate_condition(ctx, cond) for cond in group.conditions
            )
            if group_result:
                matched_group_index = g_idx
                break

        did_match = matched_group_index is not None

        exec_log = RuleExecution(
            id=f"rex_{uuid4().hex[:10]}",
            rule_id=rule.id,
            transaction_id=transaction.id,
            org_id=transaction.org_id,
            matched=did_match,
            groups_evaluated=len(groups),
            matched_group=matched_group_index,
        )
        db.add(exec_log)

        if did_match:
            matched_rules.append({
                "rule_id": rule.id,
                "rule_name": rule.name,
                "category": rule.category,
                "alert_severity": rule.alert_severity,
                "alert_score": rule.alert_score,
                "alert_title_template": rule.alert_title_template,
            })

    return matched_rules


# ── Alert Score Calculator ─────────────────────────────────────────────────────

def calculate_alert_score(
    signals: BehaviourSignals,
    rule_score: float,
    customer_risk_score: float,
) -> tuple[float, dict[str, float]]:
    """
    Composite alert score:
      behaviour  50%
      rule       35%
      customer   15%
    """
    behaviour_contrib = signals.combined_score * 0.50
    rule_contrib = rule_score * 0.35
    customer_contrib = min(customer_risk_score, 100.0) * 0.15
    total = min(behaviour_contrib + rule_contrib + customer_contrib, 100.0)

    breakdown = {
        "behaviour": round(behaviour_contrib, 2),
        "rule": round(rule_contrib, 2),
        "customer_risk": round(customer_contrib, 2),
        "total": round(total, 2),
    }
    return round(total, 2), breakdown


def alert_severity_from_score(score: float) -> AlertSeverity:
    if score >= SCORE_THRESHOLDS["critical"]:
        return AlertSeverity.critical
    elif score >= SCORE_THRESHOLDS["high"]:
        return AlertSeverity.high
    elif score >= SCORE_THRESHOLDS["medium"]:
        return AlertSeverity.medium
    return AlertSeverity.low


def _alert_category_from_signals(signals: BehaviourSignals, rule_category: Optional[AlertCategory] = None) -> AlertCategory:
    if rule_category:
        return rule_category
    if signals.sanctioned_country or signals.sanctioned_wallet:
        return AlertCategory.sanctions_exposure
    if signals.fatf_blacklist_country:
        return AlertCategory.sanctioned_jurisdiction
    if signals.mixer_exposure:
        return AlertCategory.crypto_mixer
    if signals.darknet_exposure:
        return AlertCategory.darknet_exposure
    if signals.dormant_reactivated:
        return AlertCategory.dormant_reactivation
    if signals.is_near_threshold:
        return AlertCategory.near_threshold
    if signals.is_large:
        return AlertCategory.high_value
    if signals.burst_activity:
        return AlertCategory.velocity_breach
    if signals.rapid_repeat:
        return AlertCategory.frequency_anomaly
    if signals.profile_deviation:
        return AlertCategory.profile_deviation
    return AlertCategory.unusual_behaviour


# ── Behaviour Profile Updater ──────────────────────────────────────────────────

def update_behaviour_profile(
    transaction: Transaction,
    customer: Customer,
    db: Session,
) -> CustomerBehaviourProfile:
    """
    Update or create the rolling CustomerBehaviourProfile after a transaction is processed.
    Called at the end of run_monitoring() to keep baselines current.

    Uses a lightweight recalculation over the last 30/90 days rather than
    recomputing the entire history on every transaction.
    """
    from uuid import uuid4

    profile = (
        db.query(CustomerBehaviourProfile)
        .filter(
            CustomerBehaviourProfile.customer_id == transaction.customer_id,
            CustomerBehaviourProfile.org_id == transaction.org_id,
        )
        .first()
    )

    now = datetime.now(timezone.utc)
    cutoff_30d = now - timedelta(days=30)
    cutoff_90d = now - timedelta(days=90)

    # Load recent transactions for recalculation (exclude current — it may not be committed)
    recent_90d = (
        db.query(Transaction)
        .filter(
            Transaction.customer_id == transaction.customer_id,
            Transaction.org_id == transaction.org_id,
            Transaction.transaction_date >= cutoff_90d,
            Transaction.id != transaction.id,
        )
        .all()
    )
    recent_30d = [t for t in recent_90d if t.transaction_date >= cutoff_30d]

    # Include the current transaction in rolling counts
    all_30d_amounts = [t.amount_aud or t.amount for t in recent_30d] + [transaction.amount_aud or transaction.amount]
    all_90d_amounts = [t.amount_aud or t.amount for t in recent_90d] + [transaction.amount_aud or transaction.amount]

    volume_30d = sum(all_30d_amounts)
    volume_90d = sum(all_90d_amounts)
    count_30d = len(recent_30d) + 1
    count_90d = len(recent_90d) + 1

    avg_amount = volume_30d / count_30d if count_30d else 0.0
    avg_per_day = count_30d / 30.0
    avg_per_week = count_30d / 4.0
    avg_per_month = float(count_30d)

    # Aggregate countries and channels
    all_txns_sample = recent_30d + [transaction]
    dest_countries = list({t.destination_country for t in all_txns_sample if t.destination_country})
    src_countries = list({t.source_country for t in all_txns_sample if t.source_country})
    channels = list({t.payment_method.value for t in all_txns_sample})

    # Dormancy: was previously dormant if last_transaction_date > 90 days ago
    was_dormant = False
    if profile and profile.last_transaction_date:
        last_dt = profile.last_transaction_date
        if not last_dt.tzinfo:
            last_dt = last_dt.replace(tzinfo=timezone.utc)
        was_dormant = (now - last_dt).days > 90

    if profile is None:
        profile = CustomerBehaviourProfile(
            id=f"cbp_{uuid4().hex[:10]}",
            customer_id=transaction.customer_id,
            org_id=transaction.org_id,
            observation_start_date=now.date(),
        )
        db.add(profile)

    profile.avg_txn_per_day = round(avg_per_day, 4)
    profile.avg_txn_per_week = round(avg_per_week, 4)
    profile.avg_txn_per_month = round(avg_per_month, 2)
    profile.avg_txn_amount_aud = round(avg_amount, 2)
    profile.max_txn_amount_aud = max(
        profile.max_txn_amount_aud or 0.0,
        transaction.amount_aud or transaction.amount,
    )
    profile.total_volume_30d_aud = round(volume_30d, 2)
    profile.total_volume_90d_aud = round(volume_90d, 2)
    profile.total_txn_count_30d = count_30d
    profile.total_txn_count_90d = count_90d
    profile.usual_destination_countries = dest_countries
    profile.usual_source_countries = src_countries
    profile.usual_payment_methods = channels
    profile.last_transaction_date = now
    profile.dormancy_reactivated = was_dormant
    profile.is_dormant = False   # receiving a transaction ends dormancy
    profile.txn_count_total = (profile.txn_count_total or 0) + 1
    profile.last_calculated_at = now

    return profile


# ── Main Entry Point ───────────────────────────────────────────────────────────

def run_monitoring(
    transaction: Transaction,
    customer: Customer,
    db: Session,
    alert_ref_prefix: str = "ALRT",
) -> list[TransactionAlert]:
    """
    Full monitoring pipeline for a single transaction.
    Returns list of TransactionAlert ORM objects (caller must flush/commit).
    """
    profile: Optional[CustomerBehaviourProfile] = (
        db.query(CustomerBehaviourProfile)
        .filter(
            CustomerBehaviourProfile.customer_id == transaction.customer_id,
            CustomerBehaviourProfile.org_id == transaction.org_id,
        )
        .first()
    )

    # 1. Evaluate behaviour signals
    signals = evaluate_behaviour_signals(transaction, customer, profile, db)

    # 2. Load active rules for this org, filtered by applicable_industries
    from app.models.organisation import Organisation
    org = db.query(Organisation).filter(Organisation.id == transaction.org_id).first()
    org_industry = org.industry_type.value if org and org.industry_type else None

    all_active_rules = (
        db.query(MonitoringRule)
        .filter(
            MonitoringRule.org_id == transaction.org_id,
            MonitoringRule.status.in_([RuleStatus.active, RuleStatus.testing]),
        )
        .all()
    )
    # A rule with an empty applicable_industries list applies to all industries
    active_rules = [
        r for r in all_active_rules
        if not (r.applicable_industries or [])
        or org_industry in (r.applicable_industries or [])
    ]

    # 3. Evaluate rules — logs RuleExecution immutably
    matched_rules = evaluate_rules(transaction, customer, profile, signals, active_rules, db)

    # 4. Emit one alert if signals or any rule matched
    alerts: list[TransactionAlert] = []
    customer_risk_score = getattr(customer, "risk_score", 0) or 0

    # Always emit if behaviour signals are non-trivial
    if signals.combined_score >= 20.0 or matched_rules:
        rule_score = max((r["alert_score"] for r in matched_rules), default=0.0)
        alert_score, score_breakdown = calculate_alert_score(
            signals, rule_score, customer_risk_score
        )
        severity = alert_severity_from_score(alert_score)

        primary_rule = matched_rules[0] if matched_rules else None
        category = _alert_category_from_signals(
            signals,
            primary_rule["category"] if primary_rule else None,
        )

        title = _build_alert_title(transaction, signals, primary_rule)

        alert_id = f"alrt_{uuid4().hex[:10]}"
        alert_ref = f"{alert_ref_prefix}-{uuid4().hex[:8].upper()}"

        alert = TransactionAlert(
            id=alert_id,
            alert_ref=alert_ref,
            org_id=transaction.org_id,
            transaction_id=transaction.id,
            customer_id=transaction.customer_id,
            alert_type=AlertType.rule_triggered if matched_rules else AlertType.behaviour_anomaly,
            category=category,
            severity=severity,
            status=AlertStatus.generated,
            rule_id=primary_rule["rule_id"] if primary_rule else None,
            rule_name=primary_rule["rule_name"] if primary_rule else None,
            rules_matched=[r["rule_id"] for r in matched_rules],
            alert_score=alert_score,
            score_breakdown=score_breakdown,
            title=title,
            behaviour_signals=signals.to_dict(),
            is_smr_candidate=False,
        )
        db.add(alert)
        alerts.append(alert)

        # Update transaction counters
        transaction.alerts_generated = (transaction.alerts_generated or 0) + 1
        transaction.behaviour_signals = signals.to_dict()
        transaction.behaviour_score = signals.combined_score

        # Update rule statistics
        for rule_match in matched_rules:
            rule_obj = next((r for r in active_rules if r.id == rule_match["rule_id"]), None)
            if rule_obj:
                rule_obj.total_alerts_generated = (rule_obj.total_alerts_generated or 0) + 1
                rule_obj.last_triggered_at = datetime.now(timezone.utc)

    # 5. Update (or create) the customer behaviour profile with this transaction's data
    update_behaviour_profile(transaction, customer, db)

    return alerts


def _build_alert_title(
    transaction: Transaction,
    signals: BehaviourSignals,
    primary_rule: Optional[dict],
) -> str:
    if primary_rule and primary_rule.get("alert_title_template"):
        template = primary_rule["alert_title_template"]
        amount = transaction.amount_aud or transaction.amount
        return (
            template
            .replace("{amount}", f"AUD ${amount:,.2f}")
            .replace("{country}", transaction.destination_country or "")
            .replace("{rule}", primary_rule.get("rule_name", ""))
        )
    amount = transaction.amount_aud or transaction.amount
    if signals.sanctioned_country or signals.sanctioned_wallet:
        return f"Sanctions Exposure — AUD ${amount:,.2f}"
    if signals.fatf_blacklist_country:
        return f"FATF Blacklist Country Transaction — AUD ${amount:,.2f}"
    if signals.mixer_exposure:
        return f"Crypto Mixer Exposure Detected — AUD ${amount:,.2f}"
    if signals.is_near_threshold:
        return f"Near-Threshold Transaction — AUD ${amount:,.2f}"
    if signals.burst_activity:
        return f"Burst Transaction Activity — AUD ${amount:,.2f}"
    if signals.dormant_reactivated:
        return f"Dormant Account Reactivation — AUD ${amount:,.2f}"
    return f"Unusual Transaction Activity — AUD ${amount:,.2f}"


# ── Helper ─────────────────────────────────────────────────────────────────────

def _recent_transactions(
    db: Session,
    customer_id: str,
    org_id: str,
    since_dt: datetime,
    hours: int,
) -> list[Transaction]:
    cutoff = since_dt - timedelta(hours=hours)
    return (
        db.query(Transaction)
        .filter(
            Transaction.customer_id == customer_id,
            Transaction.org_id == org_id,
            Transaction.transaction_date >= cutoff,
        )
        .all()
    )
