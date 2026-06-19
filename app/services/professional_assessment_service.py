"""
Professional Assessment Compliance Assistant Service.

Generates configurable guidance based on completed assessment sections,
customer profile, and transaction signals.

DISCLAIMER: Guidance is compliance workflow assistance only.
The platform does not make compliance decisions, provide legal advice,
or determine tax obligations. All decisions remain with the reporting entity.
"""

from __future__ import annotations

from dataclasses import dataclass

DISCLAIMER = (
    "Recommendations are compliance workflow guidance only. "
    "The platform does not make compliance decisions, provide legal advice, "
    "or determine tax obligations. All decisions remain with the reporting entity."
)


@dataclass
class AssessmentRecommendation:
    action: str
    rationale: str
    priority: str  # urgent | high | medium | low
    category: str  # sof | sow | edd | escalation | smr | monitoring | documentation
    regulatory_basis: str = ""


def generate_assessment_recommendations(
    assessment,
    customer,
    transaction=None,
) -> list[AssessmentRecommendation]:
    """
    Generate compliance assistant recommendations from a ProfessionalAssessment.

    Evaluates:
      - SOF completeness and outcome
      - SOW completeness and outcome
      - Tax risk indicator count
      - Investment legitimacy flags
      - Judgment checklist completion
      - Customer risk profile (PEP, risk level)
      - Transaction signals (if linked)

    Returns a list of AssessmentRecommendation sorted by priority.
    DISCLAIMER: Returned items are guidance prompts only.
    """
    recs: list[AssessmentRecommendation] = []

    def _add(
        action: str, rationale: str, priority: str, category: str, basis: str = ""
    ):
        recs.append(
            AssessmentRecommendation(
                action=action,
                rationale=rationale,
                priority=priority,
                category=category,
                regulatory_basis=basis,
            )
        )

    customer_is_pep = getattr(customer, "is_pep", False)
    risk_level = getattr(customer, "risk_level", None)
    risk_val = (
        risk_level.value if hasattr(risk_level, "value") else str(risk_level or "low")
    )

    # ── SOF recommendations ───────────────────────────────────────────────────
    sof = getattr(assessment, "sof_assessment", None)
    if sof is None:
        _add(
            "Request Source of Funds documentation",
            "No SOF assessment has been initiated for this matter.",
            "high",
            "sof",
            "AML/CTF Act 2006 s.36 — Customer Due Diligence",
        )
    else:
        if not sof.evidence_uploaded:
            _add(
                "Upload Source of Funds supporting documents",
                "SOF assessment initiated but no evidence has been uploaded.",
                "high",
                "sof",
                "AML/CTF Act 2006 s.36 — Customer Due Diligence",
            )
        elif not sof.evidence_reviewed:
            _add(
                "Review uploaded Source of Funds evidence",
                "SOF documents have been uploaded but not yet reviewed.",
                "medium",
                "sof",
            )
        elif not sof.evidence_sufficient:
            _add(
                "Request additional Source of Funds documentation",
                "Existing SOF evidence has been reviewed but assessed as insufficient.",
                "high",
                "sof",
                "AML/CTF Act 2006 s.36 — Customer Due Diligence",
            )
        if sof.additional_info_required:
            _add(
                "Follow up — additional SOF information required from client",
                "Reviewer has flagged that additional information is required.",
                "high",
                "sof",
            )

    # ── SOW recommendations ───────────────────────────────────────────────────
    sow = getattr(assessment, "sow_assessment", None)
    if sow is None and (customer_is_pep or risk_val in ("high", "critical")):
        _add(
            "Conduct Source of Wealth assessment",
            "Customer is PEP or high/critical risk — SOW assessment is required for EDD.",
            "urgent",
            "sow",
            "AML/CTF Act 2006 s.37 — Enhanced Customer Due Diligence",
        )
    elif sow is not None:
        if not sow.wealth_explanation_provided:
            _add(
                "Obtain Source of Wealth explanation from client",
                "SOW assessment initiated but no wealth explanation has been recorded.",
                "high",
                "sow",
                "AML/CTF Act 2006 s.37 — Enhanced Customer Due Diligence",
            )
        elif not sow.evidence_reviewed:
            _add(
                "Review Source of Wealth supporting evidence",
                "SOW explanation provided but evidence has not yet been reviewed.",
                "medium",
                "sow",
            )
        elif not sow.wealth_profile_consistent:
            _add(
                "Escalate — Source of Wealth inconsistency identified",
                "Reviewer has assessed the SOW profile as inconsistent. "
                "Consider escalation and SMR assessment.",
                "urgent",
                "sow",
                "AML/CTF Act 2006 s.41 — Suspicious Matter Reports",
            )
        if sow.additional_review_required:
            _add(
                "Continue Source of Wealth review",
                "Additional review has been flagged as required for SOW.",
                "high",
                "sow",
            )

    # ── Tax risk indicators ───────────────────────────────────────────────────
    tax = getattr(assessment, "tax_risk_assessment", None)
    if tax is not None and (tax.indicator_count or 0) > 0:
        count = tax.indicator_count
        if count >= 4:
            _add(
                "Escalate to Compliance Officer — multiple tax risk indicators present",
                f"{count} tax evasion risk indicators identified. Escalation and enhanced "
                "scrutiny are recommended. Consider SMR assessment.",
                "urgent",
                "escalation",
                "AML/CTF Act 2006 s.41 — Suspicious Matter Reports; "
                "AUSTRAC Tax Evasion Risk Indicators Guidance",
            )
        elif count >= 2:
            _add(
                "Review tax risk indicators with Compliance Officer",
                f"{count} tax risk indicators identified. Compliance Officer review recommended.",
                "high",
                "escalation",
                "AUSTRAC Tax Evasion Risk Indicators Guidance",
            )
        else:
            _add(
                "Document response to identified tax risk indicator",
                f"{count} tax risk indicator noted. Document the explanation and any mitigating factors.",
                "medium",
                "documentation",
            )
        if tax.indicator_unexplained_wealth or tax.indicator_income_inconsistency:
            _add(
                "Consider SMR assessment — unexplained wealth or income inconsistency",
                "Unexplained wealth or income inconsistency indicator is present. "
                "Review whether a Suspicious Matter Report should be considered.",
                "urgent",
                "smr",
                "AML/CTF Act 2006 s.41 — Suspicious Matter Reports",
            )

    # ── Investment legitimacy ─────────────────────────────────────────────────
    inv = getattr(assessment, "investment_assessment", None)
    if inv is not None:
        if inv.high_risk_jurisdiction_involved and not inv.funds_destination_verified:
            _add(
                "Verify funds destination — high-risk jurisdiction involved",
                "Investment involves a high-risk jurisdiction but funds destination has not been verified.",
                "urgent",
                "documentation",
                "FATF Recommendation 19 — Higher-Risk Countries",
            )
        if not inv.beneficial_ownership_verified:
            _add(
                "Verify beneficial ownership of investment counterparty",
                "Investment legitimacy assessment is incomplete — beneficial ownership not verified.",
                "high",
                "edd",
                "AML/CTF Act 2006 s.36 — Customer Due Diligence",
            )
        if not inv.regulatory_registration_verified:
            _add(
                "Verify regulatory registration of investment counterparty (where applicable)",
                "Regulatory registration of the counterparty has not been confirmed.",
                "medium",
                "documentation",
            )

    # ── Checklist completeness ────────────────────────────────────────────────
    checklist = getattr(assessment, "checklist", None)
    if checklist is not None and not checklist.is_complete:
        unchecked = checklist.total_items - (checklist.checked_items or 0)
        if unchecked > 0:
            _add(
                f"Complete professional judgment checklist ({unchecked} items remaining)",
                "The judgment checklist is not fully completed. "
                "All required items should be addressed before the assessment is finalised.",
                "medium",
                "documentation",
            )

    # ── PEP / High-risk customer ──────────────────────────────────────────────
    if customer_is_pep:
        _add(
            "Conduct Enhanced Due Diligence — PEP customer",
            "Customer is a Politically Exposed Person. EDD is required under AUSTRAC rules.",
            "urgent",
            "edd",
            "AML/CTF Act 2006 s.37 — Enhanced Customer Due Diligence; "
            "FATF Recommendation 12 — Politically Exposed Persons",
        )
        _add(
            "Obtain senior management approval for PEP relationship",
            "Senior management approval is required before establishing or continuing "
            "a business relationship with a PEP.",
            "urgent",
            "escalation",
            "AML/CTF Act 2006 s.37 — Enhanced Customer Due Diligence",
        )

    elif risk_val in ("high", "critical"):
        _add(
            "Conduct Enhanced Due Diligence — high risk customer",
            f"Customer is rated {risk_val} risk. EDD measures should be applied.",
            "high",
            "edd",
            "AML/CTF Act 2006 s.37 — Enhanced Customer Due Diligence",
        )

    # ── Transaction signals ───────────────────────────────────────────────────
    if transaction is not None:
        amount = (
            getattr(transaction, "amount_aud", None)
            or getattr(transaction, "amount", 0)
            or 0
        )
        is_cross_border = getattr(transaction, "is_cross_border", False)
        is_structuring = getattr(transaction, "is_structuring_suspect", False)
        is_near_threshold = getattr(transaction, "is_near_threshold", False)

        if is_structuring:
            _add(
                "Consider SMR assessment — structuring indicators present",
                "The linked transaction has been flagged for possible structuring. "
                "Review whether a Suspicious Matter Report is required.",
                "urgent",
                "smr",
                "AML/CTF Act 2006 s.41 — Suspicious Matter Reports; "
                "AUSTRAC Structuring Indicators Guidance",
            )
        if is_near_threshold:
            _add(
                "Review transaction for TTR obligation",
                "Linked transaction is near the AUD 10,000 TTR reporting threshold.",
                "high",
                "documentation",
                "AML/CTF Act 2006 s.43 — Threshold Transaction Reports",
            )
        if is_cross_border and amount >= 10_000:
            _add(
                "Review transaction for IFTI obligation",
                "Linked transaction is cross-border and may trigger IFTI reporting.",
                "high",
                "documentation",
                "AML/CTF Act 2006 s.45 — International Funds Transfer Instructions",
            )

    # ── Ongoing monitoring ────────────────────────────────────────────────────
    if risk_val in ("high", "critical") or customer_is_pep:
        _add(
            "Schedule ongoing transaction monitoring review",
            "High-risk customers require enhanced ongoing monitoring. "
            "Schedule a periodic review in the compliance calendar.",
            "medium",
            "monitoring",
            "AML/CTF Act 2006 s.36 — Ongoing Customer Due Diligence",
        )

    # ── Sort by priority ──────────────────────────────────────────────────────
    priority_order = {"urgent": 0, "high": 1, "medium": 2, "low": 3}
    recs.sort(key=lambda r: priority_order.get(r.priority, 4))
    return recs


def compute_assessment_risk_rating(assessment) -> str:
    """
    Derive an overall risk rating from completed assessment sections.
    Returns: low | medium | high | critical
    Used to auto-suggest the overall_risk_rating field (human confirms).
    """
    score = 0

    sof = getattr(assessment, "sof_assessment", None)
    if sof:
        if not sof.evidence_sufficient:
            score += 2
        if sof.additional_info_required:
            score += 1

    sow = getattr(assessment, "sow_assessment", None)
    if sow:
        if not sow.wealth_profile_consistent:
            score += 4
        if sow.additional_review_required:
            score += 2

    tax = getattr(assessment, "tax_risk_assessment", None)
    if tax:
        count = tax.indicator_count or 0
        score += count * 2

    inv = getattr(assessment, "investment_assessment", None)
    if inv:
        if inv.high_risk_jurisdiction_involved:
            score += 3
        if not inv.beneficial_ownership_verified:
            score += 2

    customer_is_pep = getattr(getattr(assessment, "customer", None), "is_pep", False)
    if customer_is_pep:
        score += 5

    if score >= 12:
        return "critical"
    elif score >= 7:
        return "high"
    elif score >= 3:
        return "medium"
    return "low"
