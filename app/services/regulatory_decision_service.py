"""
Regulatory Decision Support Service — AUSTRAC-aligned obligation indicators.

Evaluates transaction data, customer profile, and industry context against
AUSTRAC reporting thresholds to surface possible regulatory obligations.

The system NEVER submits reports and NEVER makes compliance decisions.
Output is decision support guidance only — final determination and any
lodgement decisions remain exclusively with the reporting entity.

Regulatory obligations evaluated:
  IFTI  — AML/CTF Act 2006 s.45 (international funds transfer instructions ≥ AUD 10,000)
  TTR   — AML/CTF Act 2006 s.43 (threshold transactions ≥ AUD 10,000 cash)
  SMR   — AML/CTF Act 2006 s.41 (suspicious matter)
  EDD   — AML/CTF Rules r.4.2 (enhanced due diligence triggers)

Industry-specific factors per FATF Recommendations and AUSTRAC guidance:
  Remittance    — FATF R.10, R.14, R.16
  Crypto/VASP   — FATF R.15, FATF VA Guidance 2021
  PSP           — FATF R.14, R.16
  Legal/Trust   — FATF R.22, R.23
  Real Estate   — FATF R.22
"""

from __future__ import annotations

import logging
from dataclasses import dataclass, field
from typing import Optional

log = logging.getLogger("tvg.regulatory_decision")

DISCLAIMER = (
    "These indicators are decision support guidance only. "
    "The reporting entity bears sole responsibility for all regulatory reporting decisions. "
    "This system does not make compliance determinations or lodge reports."
)

# ── AUSTRAC threshold constants ────────────────────────────────────────────────

IFTI_THRESHOLD_AUD = 10_000.0  # AML/CTF Act s.45
TTR_THRESHOLD_AUD = 10_000.0  # AML/CTF Act s.43 (physical currency)
STRUCTURING_WINDOW_THRESHOLD = 9_000.0  # Near-threshold structuring indicator
HIGH_ALERT_SCORE_FOR_SMR = 65.0

# FATF grey/black list countries (abbreviated — update per current FATF plenary)
FATF_BLACK_LIST = {"KP", "IR", "MM"}
FATF_GREY_LIST = {
    "AF",
    "AL",
    "BB",
    "BF",
    "CM",
    "CF",
    "CD",
    "HT",
    "JM",
    "JO",
    "ML",
    "MZ",
    "NG",
    "PK",
    "PA",
    "PH",
    "SN",
    "SO",
    "SS",
    "SY",
    "TZ",
    "TN",
    "UG",
    "AE",
    "VU",
    "VN",
    "YE",
}
SANCTIONED_COUNTRIES = {"KP", "IR", "CU", "SY", "BY", "RU", "VE"}

# High-corruption proxy (Transparency International CPI ≤ 30 approximately)
HIGH_CORRUPTION_COUNTRIES = {
    "SO",
    "SS",
    "SY",
    "YE",
    "VE",
    "AF",
    "CF",
    "LY",
    "HT",
    "NI",
    "GN",
    "GW",
    "SD",
    "ER",
    "CG",
    "TD",
    "MM",
    "TJ",
    "TM",
    "UZ",
}

# Crypto mixer / high-risk exposure thresholds
MIXER_EXPOSURE_ALERT_PCT = 5.0  # >5% mixer exposure
DARKNET_EXPOSURE_ALERT_PCT = 1.0  # >1% darknet exposure
SANCTIONED_WALLET_ALERT_PCT = 0.5  # any sanctioned exposure


@dataclass
class RegulatoryIndicator:
    """A single potential regulatory obligation or risk signal."""

    indicator_type: (
        str  # "potential_ifti", "potential_ttr", "potential_smr", "potential_edd", etc.
    )
    title: str
    rationale: str
    regulatory_basis: str  # e.g. "AML/CTF Act 2006 s.45"
    priority: str  # "urgent", "high", "medium", "low"
    industry_specific: bool = False
    auto_prefill_type: Optional[str] = (
        None  # "ifti", "ttr", "smr" — enables draft report generation
    )


@dataclass
class RegulatoryDecisionResult:
    """Complete decision support result for a transaction + customer context."""

    transaction_id: str
    indicators: list[RegulatoryIndicator] = field(default_factory=list)
    potential_ifti: bool = False
    potential_ttr: bool = False
    potential_smr: bool = False
    potential_edd: bool = False
    potential_customer_review: bool = False
    potential_sof_request: bool = False
    compliance_actions: list[str] = field(default_factory=list)
    industry_guidance: list[str] = field(default_factory=list)
    risk_summary: dict = field(default_factory=dict)
    disclaimer: str = DISCLAIMER


# ── Core evaluation ───────────────────────────────────────────────────────────


def evaluate_transaction(
    transaction,
    customer,
    org,
    alert_score: float = 0.0,
    crypto_detail=None,
    behaviour_profile=None,
    industry_override: Optional[str] = None,
) -> RegulatoryDecisionResult:
    """
    Evaluate a transaction against AUSTRAC reporting thresholds and FATF risk indicators.

    Args:
        transaction: Transaction ORM object
        customer: Customer ORM object
        org: Organisation ORM object
        alert_score: Composite alert score from monitoring engine (0–100)
        crypto_detail: TransactionCryptoDetail ORM object (crypto transactions)
        behaviour_profile: CustomerBehaviourProfile ORM object
        industry_override: Override industry string if org industry differs

    Returns:
        RegulatoryDecisionResult — decision support payload, NOT a regulatory decision
    """
    result = RegulatoryDecisionResult(transaction_id=str(transaction.id))

    amount_aud = float(
        getattr(transaction, "amount_aud", None)
        or getattr(transaction, "amount", 0)
        or 0
    )
    is_cross_border = bool(getattr(transaction, "is_cross_border", False))
    payment_method = str(getattr(transaction, "payment_method", "") or "")
    transaction_type = str(getattr(transaction, "transaction_type", "") or "")
    source_country = str(getattr(transaction, "source_country", "") or "").upper()
    destination_country = str(
        getattr(transaction, "destination_country", "") or ""
    ).upper()
    country_origin = str(
        getattr(transaction, "country_origin", source_country) or ""
    ).upper()
    country_destination = str(
        getattr(transaction, "country_destination", destination_country) or ""
    ).upper()
    is_structuring = bool(getattr(transaction, "is_structuring_suspect", False))
    is_near_threshold = bool(getattr(transaction, "is_near_threshold", False))
    is_cash_intensive = bool(getattr(transaction, "is_cash_intensive", False))

    is_pep = bool(getattr(customer, "is_pep", False))
    is_sanctions = bool(getattr(customer, "is_sanctions_match", False))
    customer_risk_level = str(getattr(customer, "risk_level", "low") or "low")

    org_industry = industry_override or str(getattr(org, "industry", "") or "")

    cash_methods = {"cash"}
    is_cash = payment_method in cash_methods or is_cash_intensive

    cross_border_methods = {
        "swift",
        "cross_border_transfer",
        "remittance",
        "bank_transfer",
        "crypto",
        "digital_wallet",
    }
    effective_cross_border = (
        is_cross_border
        or payment_method in cross_border_methods
        or (
            bool(country_origin)
            and bool(country_destination)
            and country_origin != country_destination
        )
    )

    # ── IFTI evaluation (AML/CTF Act s.45) ────────────────────────────────────
    if effective_cross_border and amount_aud >= IFTI_THRESHOLD_AUD:
        result.potential_ifti = True
        result.indicators.append(
            RegulatoryIndicator(
                indicator_type="potential_ifti",
                title="Potential IFTI Obligation",
                rationale=(
                    f"Cross-border transaction of AUD {amount_aud:,.0f} meets or exceeds the "
                    f"AUD {IFTI_THRESHOLD_AUD:,.0f} IFTI reporting threshold. "
                    f"Origin: {country_origin or 'unknown'} → Destination: {country_destination or 'unknown'}."
                ),
                regulatory_basis="AML/CTF Act 2006 s.45",
                priority="urgent",
                auto_prefill_type="ifti",
            )
        )

    # ── TTR evaluation (AML/CTF Act s.43) ─────────────────────────────────────
    if is_cash and amount_aud >= TTR_THRESHOLD_AUD:
        result.potential_ttr = True
        result.indicators.append(
            RegulatoryIndicator(
                indicator_type="potential_ttr",
                title="Potential TTR Obligation",
                rationale=(
                    f"Cash transaction of AUD {amount_aud:,.0f} meets or exceeds the "
                    f"AUD {TTR_THRESHOLD_AUD:,.0f} threshold transaction reporting threshold."
                ),
                regulatory_basis="AML/CTF Act 2006 s.43",
                priority="urgent",
                auto_prefill_type="ttr",
            )
        )

    # ── SMR indicators (AML/CTF Act s.41) ────────────────────────────────────

    smr_reasons = []

    if is_structuring:
        smr_reasons.append(
            "Structuring indicators detected (transactions near reporting threshold)"
        )
    if is_pep:
        smr_reasons.append("Customer is a Politically Exposed Person (PEP)")
    if is_sanctions:
        smr_reasons.append("Customer has an active sanctions match")
    if alert_score >= HIGH_ALERT_SCORE_FOR_SMR:
        smr_reasons.append(
            f"Composite alert score {alert_score:.0f}/100 exceeds SMR consideration threshold"
        )
    if customer_risk_level in ("high", "critical"):
        smr_reasons.append(f"Customer rated {customer_risk_level} risk")

    # Geographic SMR signals
    countries_to_check = {c for c in [country_origin, country_destination] if c}
    for country in countries_to_check:
        if country in FATF_BLACK_LIST:
            smr_reasons.append(f"FATF Black List jurisdiction involved: {country}")
        elif country in SANCTIONED_COUNTRIES:
            smr_reasons.append(f"OFAC/UN sanctioned jurisdiction involved: {country}")

    # Crypto-specific SMR signals
    if crypto_detail:
        mixer_pct = float(getattr(crypto_detail, "mixer_exposure_pct", 0) or 0)
        darknet_pct = float(getattr(crypto_detail, "darknet_exposure_pct", 0) or 0)
        sanctioned_pct = float(
            getattr(crypto_detail, "sanctioned_exposure_pct", 0) or 0
        )
        if mixer_pct >= MIXER_EXPOSURE_ALERT_PCT:
            smr_reasons.append(f"Crypto wallet has {mixer_pct:.1f}% mixer exposure")
        if darknet_pct >= DARKNET_EXPOSURE_ALERT_PCT:
            smr_reasons.append(
                f"Crypto wallet has {darknet_pct:.1f}% darknet market exposure"
            )
        if sanctioned_pct >= SANCTIONED_WALLET_ALERT_PCT:
            smr_reasons.append(
                f"Crypto wallet has {sanctioned_pct:.1f}% sanctioned entity exposure"
            )

    if smr_reasons:
        result.potential_smr = True
        result.indicators.append(
            RegulatoryIndicator(
                indicator_type="potential_smr",
                title="Potential SMR Consideration",
                rationale=(
                    "The following indicators may require SMR consideration by the MLRO:\n• "
                    + "\n• ".join(smr_reasons)
                ),
                regulatory_basis="AML/CTF Act 2006 s.41",
                priority="high",
                auto_prefill_type="smr",
            )
        )

    # ── EDD triggers ──────────────────────────────────────────────────────────
    edd_reasons = []
    if is_pep:
        edd_reasons.append("PEP status requires Enhanced Due Diligence")
    if customer_risk_level in ("high", "critical"):
        edd_reasons.append("High/critical customer risk rating requires EDD review")
    if any(c in FATF_GREY_LIST or c in FATF_BLACK_LIST for c in countries_to_check):
        edd_reasons.append("Transaction involves a FATF grey/black list jurisdiction")
    if crypto_detail:
        src_risk = float(getattr(crypto_detail, "source_wallet_risk_score", 0) or 0)
        if src_risk >= 70:
            edd_reasons.append(
                f"Source wallet risk score {src_risk:.0f}/100 requires EDD"
            )

    if edd_reasons:
        result.potential_edd = True
        result.indicators.append(
            RegulatoryIndicator(
                indicator_type="potential_edd",
                title="Enhanced Due Diligence Recommended",
                rationale="\n• ".join(edd_reasons),
                regulatory_basis="AML/CTF Rules Part 4.2",
                priority="high",
            )
        )

    # ── Source of Funds request ───────────────────────────────────────────────
    sof_reasons = []
    if amount_aud >= 50_000:
        sof_reasons.append(
            f"Transaction value AUD {amount_aud:,.0f} warrants SOF verification"
        )
    if is_pep:
        sof_reasons.append(
            "PEP transactions require Source of Funds and Source of Wealth verification"
        )
    if not getattr(customer, "source_of_funds", None):
        if amount_aud >= 10_000:
            sof_reasons.append("Source of Funds not on file for this customer")

    if sof_reasons:
        result.potential_sof_request = True
        result.indicators.append(
            RegulatoryIndicator(
                indicator_type="potential_sof_request",
                title="Source of Funds/Wealth Verification Required",
                rationale="\n• ".join(sof_reasons),
                regulatory_basis="AML/CTF Rules Part 4.1; FATF Recommendation 10",
                priority="medium",
            )
        )

    # ── Customer review trigger ───────────────────────────────────────────────
    if behaviour_profile:
        avg_monthly = float(getattr(behaviour_profile, "avg_txn_per_month", 0) or 0)
        volume_30d = float(getattr(behaviour_profile, "total_volume_30d_aud", 0) or 0)
        total_30d = int(getattr(behaviour_profile, "total_txn_count_30d", 0) or 0)
        dormant_reactivated = bool(
            getattr(behaviour_profile, "dormant_reactivated", False)
        )

        if dormant_reactivated:
            result.potential_customer_review = True
            result.indicators.append(
                RegulatoryIndicator(
                    indicator_type="potential_customer_review",
                    title="Customer Review — Dormant Account Reactivated",
                    rationale="Account was dormant and has been reactivated. Periodic customer review is recommended.",
                    regulatory_basis="AML/CTF Rules Part 4.2; FATF Recommendation 10",
                    priority="medium",
                )
            )
        elif avg_monthly > 0 and total_30d > avg_monthly * 3:
            result.potential_customer_review = True
            result.indicators.append(
                RegulatoryIndicator(
                    indicator_type="potential_customer_review",
                    title="Customer Review — Unusual Transaction Velocity",
                    rationale=(
                        f"Transaction count this month ({total_30d}) is 3x the customer's "
                        f"average monthly activity ({avg_monthly:.0f}). "
                        "Customer profile review recommended."
                    ),
                    regulatory_basis="AML/CTF Rules Part 4.2; FATF Recommendation 10",
                    priority="medium",
                )
            )

    # ── Industry-specific guidance ─────────────────────────────────────────────
    result.industry_guidance = _industry_guidance(
        org_industry,
        transaction_type,
        payment_method,
        amount_aud,
        effective_cross_border,
        crypto_detail,
        is_cash,
    )

    # ── Required compliance actions ───────────────────────────────────────────
    result.compliance_actions = _required_actions(result)

    # ── Risk summary ──────────────────────────────────────────────────────────
    result.risk_summary = {
        "amount_aud": amount_aud,
        "is_cross_border": effective_cross_border,
        "is_cash": is_cash,
        "is_structuring_suspect": is_structuring,
        "alert_score": alert_score,
        "customer_risk_level": customer_risk_level,
        "is_pep": is_pep,
        "is_sanctions_match": is_sanctions,
        "countries_involved": list(countries_to_check),
        "fatf_black_list_exposure": any(
            c in FATF_BLACK_LIST for c in countries_to_check
        ),
        "fatf_grey_list_exposure": any(c in FATF_GREY_LIST for c in countries_to_check),
        "sanctioned_country_exposure": any(
            c in SANCTIONED_COUNTRIES for c in countries_to_check
        ),
        "industry": org_industry,
    }

    log.debug(
        "regulatory_eval txn=%s ifti=%s ttr=%s smr=%s edd=%s indicators=%d",
        transaction.id,
        result.potential_ifti,
        result.potential_ttr,
        result.potential_smr,
        result.potential_edd,
        len(result.indicators),
    )
    return result


def _industry_guidance(
    industry: str,
    transaction_type: str,
    payment_method: str,
    amount_aud: float,
    is_cross_border: bool,
    crypto_detail,
    is_cash: bool,
) -> list[str]:
    """Return industry-specific FATF/AUSTRAC compliance guidance."""

    guidance = []
    ind = industry.lower()

    if "remittance" in ind or "money_service" in ind or "msb" in ind:
        if is_cross_border:
            guidance.append(
                "Remittance: Verify beneficiary identity and account details (FATF R.16 travel rule)"
            )
            guidance.append(
                "Remittance: Consider IFTI obligation for international transfers ≥ AUD 10,000"
            )
        if is_cash:
            guidance.append(
                "Remittance: Cash-funded remittances are high-risk — verify Source of Funds"
            )
        if amount_aud > 0:
            guidance.append(
                "Remittance: Check beneficiary country against FATF grey/black list and sanctions"
            )

    elif (
        "crypto" in ind
        or "digital_currency" in ind
        or "vasp" in ind
        or "blockchain" in ind
    ):
        if crypto_detail:
            mixer = float(getattr(crypto_detail, "mixer_exposure_pct", 0) or 0)
            darknet = float(getattr(crypto_detail, "darknet_exposure_pct", 0) or 0)
            if mixer > 0:
                guidance.append(
                    f"Crypto: Mixer exposure detected ({mixer:.1f}%) — assess SMR obligation (FATF VA Guidance 2021)"
                )
            if darknet > 0:
                guidance.append(
                    f"Crypto: Darknet exposure detected ({darknet:.1f}%) — immediate MLRO escalation recommended"
                )
            guidance.append(
                "Crypto: Verify wallet type (custodial vs self-hosted) per FATF travel rule requirements"
            )
        guidance.append(
            "Crypto: Apply enhanced monitoring for unhosted/self-hosted wallet transactions"
        )

    elif "psp" in ind or "payment_service" in ind or "payment_facilit" in ind:
        guidance.append(
            "PSP: Monitor merchant settlement volumes for structuring patterns"
        )
        if is_cross_border:
            guidance.append(
                "PSP: Cross-border settlement — verify merchant legitimacy and counterparty jurisdiction"
            )
        guidance.append(
            "PSP: Review merchant category codes for high-risk business types"
        )

    elif "legal" in ind or "law" in ind or "solicitor" in ind or "conveyancing" in ind:
        guidance.append(
            "Legal/Trust: Verify trust account transaction has proper client authorisation"
        )
        guidance.append(
            "Legal/Trust: Identify ultimate beneficial owner for property and corporate transactions"
        )
        if amount_aud >= 10_000:
            guidance.append(
                "Legal/Trust: Consider Source of Funds for transactions ≥ AUD 10,000 (FATF R.22)"
            )
        if is_cash:
            guidance.append(
                "Legal/Trust: Cash received in trust account — immediate SOF verification required"
            )

    elif "real_estate" in ind or "property" in ind:
        guidance.append(
            "Real Estate: Identify all purchasers and Ultimate Beneficial Owners"
        )
        if amount_aud >= 100_000:
            guidance.append(
                "Real Estate: High-value property transaction — Source of Wealth verification required"
            )
        guidance.append(
            "Real Estate: Screen for foreign purchasers and foreign investment restrictions"
        )
        if is_cash:
            guidance.append(
                "Real Estate: Cash component in property transaction — high money laundering risk"
            )

    elif "accounting" in ind or "auditor" in ind or "tax_agent" in ind:
        guidance.append(
            "Accounting: Verify client SOF where handling significant funds"
        )
        guidance.append(
            "Accounting: Document rationale for unusual transactions in client file"
        )

    elif "gambling" in ind or "gaming" in ind or "wagering" in ind:
        guidance.append(
            "Gambling: Apply customer due diligence for winnings/payouts ≥ reporting threshold"
        )
        guidance.append(
            "Gambling: Monitor for source of gambling funds — structuring risk"
        )

    # General guidance always included
    if amount_aud >= IFTI_THRESHOLD_AUD:
        guidance.append(
            f"All industries: Transactions ≥ AUD {IFTI_THRESHOLD_AUD:,.0f} must be reviewed for reporting obligations"
        )

    return guidance


def _required_actions(result: RegulatoryDecisionResult) -> list[str]:
    """Derive required compliance actions from indicator flags."""
    actions = []
    if result.potential_ifti:
        actions.append(
            "Review for IFTI obligation — MLRO assessment required before processing"
        )
    if result.potential_ttr:
        actions.append(
            "Review for TTR obligation — complete threshold transaction assessment"
        )
    if result.potential_smr:
        actions.append(
            "Escalate to MLRO for SMR consideration — do not tip off customer"
        )
    if result.potential_edd:
        actions.append(
            "Initiate Enhanced Due Diligence process before transaction approval"
        )
    if result.potential_sof_request:
        actions.append("Request Source of Funds documentation from customer")
    if result.potential_customer_review:
        actions.append(
            "Schedule customer profile review — behaviour deviation from baseline"
        )
    return actions


# ── Draft report prefill ──────────────────────────────────────────────────────


def prefill_ifti_data(transaction, customer, org) -> dict:
    """
    Pre-populate IFTI report fields from transaction data.
    The compliance officer must review, edit, and approve before any lodgement.
    """
    return {
        "prefilled": True,
        "disclaimer": DISCLAIMER,
        "suggested_fields": {
            "direction": "outgoing"
            if str(getattr(transaction, "direction", "")) == "outgoing"
            else "incoming",
            "currency_code": getattr(transaction, "currency", "AUD"),
            "amount": getattr(transaction, "amount", None),
            "amount_aud": getattr(transaction, "amount_aud", None),
            "transaction_date": str(getattr(transaction, "transaction_date", "") or ""),
            "source_country": getattr(transaction, "source_country", None),
            "destination_country": getattr(transaction, "destination_country", None),
            "payer_name": getattr(customer, "full_name", None),
            "payer_account": getattr(transaction, "source_account_number", None),
            "payer_bsb": getattr(transaction, "source_bsb", None),
            "payer_bank_name": getattr(transaction, "source_bank_name", None),
            "payer_bank_bic": getattr(transaction, "source_bank_bic", None),
            "payee_name": getattr(transaction, "destination_account_name", None),
            "payee_account": getattr(transaction, "destination_account_number", None),
            "payee_bank_name": getattr(transaction, "destination_bank_name", None),
            "payee_bank_bic": getattr(transaction, "destination_bank_bic", None),
            "transaction_ref": getattr(transaction, "transaction_ref", None),
        },
        "requires_mlro_review": True,
        "regulatory_basis": "AML/CTF Act 2006 s.45",
    }


def prefill_ttr_data(transaction, customer, org) -> dict:
    """
    Pre-populate TTR report fields from transaction data.
    """
    return {
        "prefilled": True,
        "disclaimer": DISCLAIMER,
        "suggested_fields": {
            "transaction_date": str(getattr(transaction, "transaction_date", "") or ""),
            "amount": getattr(transaction, "amount", None),
            "currency_code": getattr(transaction, "currency", "AUD"),
            "customer_name": getattr(customer, "full_name", None),
            "customer_dob": str(getattr(customer, "date_of_birth", "") or ""),
            "customer_address": getattr(customer, "address_line1", None),
            "transaction_type": getattr(transaction, "transaction_type", None),
            "payment_method": getattr(transaction, "payment_method", None),
            "account_number": getattr(transaction, "source_account_number", None),
            "bsb": getattr(transaction, "source_bsb", None),
            "transaction_ref": getattr(transaction, "transaction_ref", None),
        },
        "requires_mlro_review": True,
        "regulatory_basis": "AML/CTF Act 2006 s.43",
    }


def prefill_smr_data(
    transaction, customer, org, indicators: list[RegulatoryIndicator]
) -> dict:
    """
    Pre-populate SMR report fields from transaction and alert data.
    """
    smr_reasons = [
        ind.rationale for ind in indicators if ind.indicator_type == "potential_smr"
    ]
    return {
        "prefilled": True,
        "disclaimer": DISCLAIMER,
        "suggested_fields": {
            "transaction_date": str(getattr(transaction, "transaction_date", "") or ""),
            "amount": getattr(transaction, "amount", None),
            "currency_code": getattr(transaction, "currency", "AUD"),
            "customer_name": getattr(customer, "full_name", None),
            "customer_dob": str(getattr(customer, "date_of_birth", "") or ""),
            "suspicious_activity_summary": "\n".join(smr_reasons)
            if smr_reasons
            else "",
            "transaction_ref": getattr(transaction, "transaction_ref", None),
            "account_number": getattr(transaction, "source_account_number", None),
        },
        "requires_mlro_review": True,
        "requires_mlro_sign_off": True,
        "regulatory_basis": "AML/CTF Act 2006 s.41",
        "warning": (
            "SMR drafts must be reviewed and approved by the MLRO. "
            "Do not disclose SMR consideration to the subject (tipping-off prohibition s.123)."
        ),
    }
