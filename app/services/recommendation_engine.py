"""
Regulatory Recommendation Engine.

Generates structured compliance decision support output after transaction monitoring.
Called at the end of run_monitoring() for every transaction that triggers an alert.

Rule-based (no AI) — each recommendation is derived from deterministic signal logic.
Future AI integration point: replace or augment _draft_recommendation_text() with
AI-generated narrative while keeping the recommendation_type and regulatory_basis
fields rule-derived (so they remain auditable).

DISCLAIMER: All recommendations are compliance workflow guidance only.
The reporting entity bears sole responsibility for all regulatory decisions,
including whether to lodge reports with AUSTRAC.
"""
from datetime import datetime, timezone
from typing import Optional
from uuid import uuid4

from sqlalchemy.orm import Session

from app.models.customer import Customer
from app.models.monitoring import TransactionAlert
from app.models.organisation import Organisation
from app.models.regulatory_recommendation import (
    RecommendationPriority,
    RecommendationSource,
    RecommendationStatus,
    RecommendationType,
    RegulatoryRecommendation,
)
from app.models.transaction import Transaction

# ── Thresholds ────────────────────────────────────────────────────────────────

TTR_THRESHOLD_AUD = 10_000.0
NEAR_THRESHOLD_PCT = 0.10
NEAR_THRESHOLD_AUD = TTR_THRESHOLD_AUD * (1 - NEAR_THRESHOLD_PCT)  # 9,000

# Alert score thresholds for SMR/EDD escalation
SMR_SCORE_THRESHOLD = 70.0
EDD_SCORE_THRESHOLD = 50.0
SOF_SCORE_THRESHOLD = 40.0

# Customer risk levels that always require SOF verification
HIGH_RISK_LEVELS = {"high", "critical"}

# FATF blacklist / sanctioned country sets (mirrored from monitoring_engine)
FATF_BLACKLIST = frozenset({"KP", "IR", "MM"})
SANCTIONED_COUNTRIES = frozenset({"IR", "KP", "RU", "BY", "SY", "CU", "SD"})
FATF_GREYLIST = frozenset({
    "AF", "BB", "BF", "CM", "CD", "HT", "JM", "ML", "MZ", "NI",
    "NG", "PK", "PA", "PH", "SN", "SS", "SY", "TZ", "TT", "UG",
    "AE", "VN", "YE",
})


# ── Regulatory Basis Citations ────────────────────────────────────────────────

_REGULATORY_BASIS = {
    RecommendationType.consider_ifti:
        "AML/CTF Act 2006 s.45 — IFTI reporting obligation for cross-border transfers",
    RecommendationType.consider_ttr:
        "AML/CTF Act 2006 s.43 — TTR reporting obligation for threshold transactions ≥ AUD 10,000",
    RecommendationType.consider_smr:
        "AML/CTF Act 2006 s.41 — SMR reporting obligation when suspicion is formed",
    RecommendationType.consider_edd:
        "AML/CTF Rules 2007 Chapter 4 — Enhanced Customer Due Diligence",
    RecommendationType.request_source_of_funds:
        "FATF Recommendation 10 — Customer Due Diligence; AML/CTF Rules 2007 r.4.2.2",
    RecommendationType.request_source_of_wealth:
        "FATF Recommendation 10 — Source of Wealth for high-risk customers and PEPs",
    RecommendationType.trigger_customer_review:
        "AML/CTF Rules 2007 r.15 — Ongoing Customer Due Diligence",
    RecommendationType.escalate_to_mlro:
        "AML/CTF Act 2006 — MLRO accountability; internal escalation policy",
    RecommendationType.senior_approval_required:
        "AML/CTF Rules 2007 r.4.2.3 — Senior management approval for high-risk relationships",
    RecommendationType.enhanced_monitoring:
        "AML/CTF Rules 2007 r.15.5 — Enhanced Ongoing Monitoring",
    RecommendationType.create_case:
        "Internal AML/CTF Program — investigation workflow",
    RecommendationType.no_action_required:
        "Risk-based assessment — no mandatory obligation identified at this time",
}


# ── Core Generation Function ──────────────────────────────────────────────────

def generate_recommendations(
    txn: Transaction,
    customer: Customer,
    alerts: list[TransactionAlert],
    db: Session,
) -> list[RegulatoryRecommendation]:
    """
    Generate RegulatoryRecommendation records for a transaction after monitoring.

    Evaluates transaction signals, customer risk, and alert outputs.
    Returns unsaved ORM objects — caller must flush/commit after run_monitoring().

    Called automatically at the end of run_monitoring(). Also callable independently
    for re-evaluation (e.g. after customer risk score changes).
    """
    org = db.query(Organisation).filter(Organisation.id == txn.org_id).first()
    industry = org.industry_type.value if org and org.industry_type else None

    amount_aud = txn.amount_aud or txn.amount
    customer_risk = (getattr(customer, "risk_level", None) or "").value \
        if hasattr(getattr(customer, "risk_level", None), "value") \
        else str(getattr(customer, "risk_level", "") or "")
    is_pep = bool(getattr(customer, "is_pep", False))
    sof_verified = bool(getattr(customer, "source_of_funds_verified", False))
    sow_verified = bool(getattr(customer, "source_of_wealth_verified", False))

    countries = {
        c for c in [
            txn.source_country, txn.destination_country,
            txn.country_origin, txn.country_destination,
        ] if c
    }

    max_alert_score = max((a.alert_score for a in alerts), default=0.0)
    has_smr_candidate_alert = any(a.is_smr_candidate for a in alerts)
    primary_alert = alerts[0] if alerts else None
    primary_alert_id = primary_alert.id if primary_alert else None

    recs: list[RegulatoryRecommendation] = []
    seen_types: set[RecommendationType] = set()

    def _add(
        rec_type: RecommendationType,
        title: str,
        text: str,
        rationale: str,
        priority: RecommendationPriority = RecommendationPriority.normal,
    ) -> None:
        if rec_type in seen_types:
            return
        seen_types.add(rec_type)
        rec = RegulatoryRecommendation(
            org_id=txn.org_id,
            transaction_id=txn.id,
            alert_id=primary_alert_id,
            customer_id=txn.customer_id,
            recommendation_type=rec_type,
            priority=priority,
            source=RecommendationSource.monitoring_engine,
            title=title,
            recommendation_text=text,
            rationale=rationale,
            regulatory_basis=_REGULATORY_BASIS.get(rec_type, ""),
            status=RecommendationStatus.pending,
        )
        recs.append(rec)

    # ── 1. TTR — Threshold Transaction Report ────────────────────────────────

    if amount_aud >= TTR_THRESHOLD_AUD:
        _add(
            RecommendationType.consider_ttr,
            title=f"Potential TTR — AUD ${amount_aud:,.2f} threshold transaction",
            text=(
                f"This transaction of AUD ${amount_aud:,.2f} meets or exceeds the AUD 10,000 "
                f"cash reporting threshold. Review whether this transaction involves physical "
                f"currency or e-currency and whether a Threshold Transaction Report (TTR) "
                f"is required under the AML/CTF Act 2006 s.43. "
                f"TTR must be lodged within 10 business days of the transaction date."
            ),
            rationale=f"amount_aud={amount_aud:,.2f} >= TTR_THRESHOLD=10,000",
            priority=RecommendationPriority.high,
        )

    elif NEAR_THRESHOLD_AUD <= amount_aud < TTR_THRESHOLD_AUD:
        _add(
            RecommendationType.consider_ttr,
            title=f"Near-Threshold Transaction — AUD ${amount_aud:,.2f} (structuring risk)",
            text=(
                f"This transaction of AUD ${amount_aud:,.2f} is within 10% of the AUD 10,000 "
                f"reporting threshold. Consider whether this pattern may indicate deliberate "
                f"structuring to avoid reporting obligations. If structuring is suspected, "
                f"an SMR may be required regardless of the TTR threshold."
            ),
            rationale=f"amount_aud={amount_aud:,.2f} between {NEAR_THRESHOLD_AUD:,.0f} and {TTR_THRESHOLD_AUD:,.0f}",
            priority=RecommendationPriority.normal,
        )

    # ── 2. IFTI — International Funds Transfer Instruction ───────────────────

    if txn.is_cross_border:
        dest = txn.destination_country or txn.country_destination or "unknown jurisdiction"
        src = txn.source_country or txn.country_origin or "unknown jurisdiction"
        direction_str = "outgoing to" if txn.direction.value == "outgoing" else "incoming from"
        _add(
            RecommendationType.consider_ifti,
            title=f"Potential IFTI — Cross-border {txn.direction.value} transfer",
            text=(
                f"This cross-border transfer ({direction_str} {dest if txn.direction.value == 'outgoing' else src}) "
                f"may require an International Funds Transfer Instruction (IFTI) report "
                f"under the AML/CTF Act 2006 s.45. Review whether this is an international "
                f"funds transfer instruction and whether all required ordering/beneficiary "
                f"customer details are recorded. IFTI must be lodged within 10 business days."
            ),
            rationale=f"is_cross_border=True, direction={txn.direction.value}",
            priority=RecommendationPriority.high,
        )

    # ── 3. SMR — Suspicious Matter Report ───────────────────────────────────

    sanctioned_hit = bool(countries.intersection(SANCTIONED_COUNTRIES))
    blacklist_hit = bool(countries.intersection(FATF_BLACKLIST))

    if sanctioned_hit or blacklist_hit:
        hit_countries = list(countries.intersection(SANCTIONED_COUNTRIES | FATF_BLACKLIST))
        _add(
            RecommendationType.consider_smr,
            title=f"Potential SMR — Sanctioned/FATF Blacklist jurisdiction: {', '.join(hit_countries)}",
            text=(
                f"This transaction involves {', '.join(hit_countries)}, "
                f"{'a sanctioned country' if sanctioned_hit else 'a FATF blacklisted jurisdiction'}. "
                f"Any transaction with a sanctioned jurisdiction may give rise to suspicion. "
                f"Review whether grounds for suspicion exist and whether an SMR is required "
                f"under the AML/CTF Act 2006 s.41. If terrorism-financing is suspected, "
                f"an SMR must be lodged within 24 hours. The MLRO must be notified immediately. "
                f"\n\nDISCLAIMER: The decision to lodge an SMR remains with the reporting entity."
            ),
            rationale=f"countries_involved={list(countries)}, sanctioned_hit={sanctioned_hit}, blacklist_hit={blacklist_hit}",
            priority=RecommendationPriority.urgent,
        )

    elif has_smr_candidate_alert or max_alert_score >= SMR_SCORE_THRESHOLD:
        _add(
            RecommendationType.consider_smr,
            title=f"Potential SMR — Alert score {max_alert_score:.0f}/100 meets SMR consideration threshold",
            text=(
                f"This transaction has generated alerts with a combined score of {max_alert_score:.0f}/100, "
                f"which meets the threshold for SMR consideration. "
                f"Review the alert details, customer history, and transaction context. "
                f"If suspicion is formed, refer to the MLRO for SMR consideration. "
                f"\n\nDISCLAIMER: The decision to lodge an SMR remains with the reporting entity. "
                f"An alert score does not constitute a finding of suspicious activity."
            ),
            rationale=f"max_alert_score={max_alert_score:.1f}, has_smr_candidate_alert={has_smr_candidate_alert}",
            priority=RecommendationPriority.high,
        )

    # ── 4. EDD — Enhanced Due Diligence ─────────────────────────────────────

    edd_rationale_parts = []

    if customer_risk in HIGH_RISK_LEVELS:
        edd_rationale_parts.append(f"customer_risk_level={customer_risk}")
    if is_pep:
        edd_rationale_parts.append("customer_is_pep=True")
    if blacklist_hit:
        edd_rationale_parts.append("fatf_blacklist_country_involved")
    if max_alert_score >= EDD_SCORE_THRESHOLD and not edd_rationale_parts:
        edd_rationale_parts.append(f"alert_score={max_alert_score:.1f}")

    if edd_rationale_parts:
        edd_triggers = "; ".join(edd_rationale_parts)
        pep_note = (
            " As a Politically Exposed Person, enhanced scrutiny of this transaction "
            "and the customer relationship is required under AML/CTF Rules 2007 r.4.2."
        ) if is_pep else ""
        _add(
            RecommendationType.consider_edd,
            title=f"Consider EDD — {'PEP customer' if is_pep else f'{customer_risk.capitalize()} risk customer'}",
            text=(
                f"Enhanced Customer Due Diligence (EDD) consideration has been triggered. "
                f"{pep_note} "
                f"Verify the customer's identity documentation is current, review source of funds "
                f"and source of wealth, and document the basis for continuing the relationship. "
                f"Senior management sign-off may be required."
            ),
            rationale=edd_triggers,
            priority=RecommendationPriority.high if is_pep or blacklist_hit else RecommendationPriority.normal,
        )

    # ── 5. Source of Funds ───────────────────────────────────────────────────

    sof_needed = (
        (amount_aud >= TTR_THRESHOLD_AUD or customer_risk in HIGH_RISK_LEVELS or is_pep)
        and not sof_verified
    )
    if sof_needed:
        _add(
            RecommendationType.request_source_of_funds,
            title="Request Source of Funds documentation",
            text=(
                f"Source of funds has not been verified for this customer. "
                f"Given {'the transaction value' if amount_aud >= TTR_THRESHOLD_AUD else ''}"
                f"{'the customer risk level' if customer_risk in HIGH_RISK_LEVELS else ''}"
                f"{'PEP status' if is_pep else ''}, "
                f"obtain and document evidence of the origin of the funds used in this transaction. "
                f"Acceptable evidence includes: bank statements, payslips, business accounts, "
                f"sale proceeds documentation, or other verifiable records."
            ),
            rationale=f"sof_verified=False, amount_aud={amount_aud:,.2f}, risk={customer_risk}, is_pep={is_pep}",
            priority=RecommendationPriority.high if is_pep or customer_risk == "critical" else RecommendationPriority.normal,
        )

    # ── 6. Source of Wealth (PEP or high-value) ──────────────────────────────

    sow_needed = is_pep and not sow_verified
    if not sow_needed and customer_risk == "critical" and not sow_verified and amount_aud >= 50_000:
        sow_needed = True

    if sow_needed:
        _add(
            RecommendationType.request_source_of_wealth,
            title="Request Source of Wealth documentation" + (" — PEP customer" if is_pep else ""),
            text=(
                f"Source of wealth has not been verified for this customer. "
                f"{'As a PEP, source of wealth verification is mandatory under AML/CTF Rules 2007 r.4.2.3. ' if is_pep else ''}"
                f"Obtain evidence of the overall accumulation of the customer's net worth: "
                f"business interests, investments, inheritance, employment history, or other verifiable sources."
            ),
            rationale=f"sow_verified=False, is_pep={is_pep}, risk={customer_risk}",
            priority=RecommendationPriority.high,
        )

    # ── 7. Senior Approval ───────────────────────────────────────────────────

    if (is_pep or customer_risk == "critical") and amount_aud >= TTR_THRESHOLD_AUD:
        _add(
            RecommendationType.senior_approval_required,
            title=f"Senior approval required — {'PEP' if is_pep else 'critical risk'} customer transaction",
            text=(
                f"This transaction with a {'PEP' if is_pep else 'critical risk'} customer "
                f"requires senior management approval before processing. "
                f"Document the approval in the compliance file, including the approver's name, "
                f"date, and the basis for the approval decision."
            ),
            rationale=f"is_pep={is_pep}, risk={customer_risk}, amount_aud={amount_aud:,.2f}",
            priority=RecommendationPriority.urgent,
        )

    # ── 8. Create Case ───────────────────────────────────────────────────────

    if max_alert_score >= EDD_SCORE_THRESHOLD and alerts:
        _add(
            RecommendationType.create_case,
            title=f"Consider opening an investigation case — {len(alerts)} alert(s) generated",
            text=(
                f"{len(alerts)} alert(s) have been generated for this transaction with a "
                f"combined score of {max_alert_score:.0f}/100. Consider creating a compliance "
                f"case to track investigation progress, link evidence, and document "
                f"the compliance officer's review and conclusions."
            ),
            rationale=f"alert_count={len(alerts)}, max_score={max_alert_score:.1f}",
            priority=RecommendationPriority.normal,
        )

    # ── 9. Enhanced Monitoring ───────────────────────────────────────────────

    greylist_hit = bool(countries.intersection(FATF_GREYLIST)) and not blacklist_hit and not sanctioned_hit
    if greylist_hit or (customer_risk in HIGH_RISK_LEVELS and not has_smr_candidate_alert):
        hit_gl = list(countries.intersection(FATF_GREYLIST))
        _add(
            RecommendationType.enhanced_monitoring,
            title=f"Enhanced monitoring recommended"
                  + (f" — FATF grey list country: {', '.join(hit_gl)}" if greylist_hit else ""),
            text=(
                f"{'This transaction involves ' + ', '.join(hit_gl) + ', which is on the FATF grey list. ' if greylist_hit else ''}"
                f"{'The customer is rated ' + customer_risk + ' risk. ' if customer_risk in HIGH_RISK_LEVELS else ''}"
                f"Consider applying enhanced transaction monitoring for this customer, "
                f"including more frequent review intervals and lower alert thresholds."
            ),
            rationale=f"greylist_hit={greylist_hit}, customer_risk={customer_risk}",
            priority=RecommendationPriority.normal,
        )

    # ── 10. Customer Review ──────────────────────────────────────────────────

    review_date = getattr(customer, "next_review_date", None)
    from datetime import date
    today = datetime.now(timezone.utc).date()
    review_overdue = review_date and review_date < today

    if review_overdue:
        _add(
            RecommendationType.trigger_customer_review,
            title=f"Customer periodic review overdue — due {review_date}",
            text=(
                f"The customer's periodic CDD review was due on {review_date} "
                f"and has not been completed. Trigger a customer review before "
                f"processing further transactions above routine thresholds. "
                f"The review should include identity document refresh, risk re-assessment, "
                f"and updated source of funds/wealth documentation if appropriate."
            ),
            rationale=f"next_review_date={review_date}, today={today}",
            priority=RecommendationPriority.high,
        )

    # ── 11. No Action (when nothing else triggered) ──────────────────────────

    if not recs:
        _add(
            RecommendationType.no_action_required,
            title="No specific regulatory obligation identified",
            text=(
                "Based on available transaction signals, no specific regulatory reporting "
                "obligation has been automatically identified. Continue standard monitoring. "
                "This assessment is based on current data only — review is always the "
                "compliance officer's responsibility."
            ),
            rationale="no_threshold_or_signal_triggers_met",
            priority=RecommendationPriority.low,
        )

    # Write the primary recommendation back to each alert for quick UI access
    if recs and alerts:
        primary_rec = recs[0]
        for alert in alerts:
            alert.suggested_next_action = primary_rec.recommendation_type.value
            alert.recommendation_text = primary_rec.title

    return recs


def action_recommendation(
    rec_id: str,
    action_taken: str,
    actioned_by: str,
    db: Session,
    org_id: str,
) -> RegulatoryRecommendation:
    """Mark a recommendation as actioned with a description of what was done."""
    rec = db.query(RegulatoryRecommendation).filter(
        RegulatoryRecommendation.id == rec_id,
        RegulatoryRecommendation.org_id == org_id,
    ).first()
    if not rec:
        raise ValueError(f"Recommendation {rec_id} not found")
    if rec.status != RecommendationStatus.pending:
        raise ValueError(f"Recommendation is already {rec.status.value}")
    rec.status = RecommendationStatus.actioned
    rec.actioned_by = actioned_by
    rec.actioned_at = datetime.now(timezone.utc)
    rec.action_taken = action_taken
    db.commit()
    db.refresh(rec)
    return rec


def dismiss_recommendation(
    rec_id: str,
    dismissed_reason: str,
    dismissed_by: str,
    db: Session,
    org_id: str,
) -> RegulatoryRecommendation:
    """Dismiss a recommendation with a documented reason."""
    rec = db.query(RegulatoryRecommendation).filter(
        RegulatoryRecommendation.id == rec_id,
        RegulatoryRecommendation.org_id == org_id,
    ).first()
    if not rec:
        raise ValueError(f"Recommendation {rec_id} not found")
    if rec.status != RecommendationStatus.pending:
        raise ValueError(f"Recommendation is already {rec.status.value}")
    rec.status = RecommendationStatus.dismissed
    rec.dismissed_by = dismissed_by
    rec.dismissed_at = datetime.now(timezone.utc)
    rec.dismissed_reason = dismissed_reason
    db.commit()
    db.refresh(rec)
    return rec
