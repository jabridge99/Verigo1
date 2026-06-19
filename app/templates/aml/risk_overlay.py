"""
Risk level overlays applied on top of industry templates.
Adjusts CDD thresholds, monitoring intensity, and ECDD trigger criteria
based on the organisation's chosen risk appetite.
"""

from __future__ import annotations

from app.templates.aml.base import AMLTemplateBase


def apply_overlay(template: AMLTemplateBase, risk_level: str) -> AMLTemplateBase:
    """Apply risk-level-specific adjustments to a template in place."""
    if risk_level == "low":
        _apply_low(template)
    elif risk_level == "high":
        _apply_high(template)
    # medium = base template as-is
    template.risk_level = risk_level
    return template


def _apply_low(t: AMLTemplateBase) -> None:
    """
    Low risk appetite — simplified CDD for most customers,
    lighter monitoring frequency, basic controls.
    Suitable for: domestic-only, low-value, regulated customer base.
    """
    t.ewra_summary = (
        (
            "The Organisation has assessed its ML/TF/PF risk as LOW based on:\n"
            "- Predominantly domestic customer base;\n"
            "- Low transaction values and volumes;\n"
            "- Limited cross-border exposure;\n"
            "- Highly regulated customer types (e.g. government, listed companies);\n"
            "- Simple, transparent product/service offerings.\n\n"
            "Despite a low inherent risk profile, the Organisation maintains "
            "proportionate AML/CTF controls and reviews this assessment at least annually."
        )
        + "\n\n"
        + t.ewra_summary
    )

    t.cdd_simplified_procedures = (
        t.cdd_simplified_procedures + "\n\n"
        "LOW RISK PROFILE: Given the Organisation's low inherent risk, simplified "
        "CDD may be applied more broadly where customer risk is assessed as low "
        "and there are no suspicion indicators. Standard CDD must still be "
        "applied as a minimum for all new customers."
    )

    t.ongoing_cdd = (
        t.ongoing_cdd + "\n\n"
        "LOW RISK MONITORING: Customer risk reviews are conducted at least every "
        "3 years for low-risk customers, or sooner if trigger events occur."
    )


def _apply_high(t: AMLTemplateBase) -> None:
    """
    High risk appetite — enhanced CDD broadly applied, intensive monitoring,
    MLRO sign-off required for more decisions.
    Suitable for: high-value transactions, cross-border focus, PEP-heavy base,
    high-risk jurisdictions, crypto/remittance with complex customer types.
    """
    t.ewra_summary = (
        (
            "The Organisation has assessed its ML/TF/PF risk as HIGH based on:\n"
            "- High-value or high-volume transactions;\n"
            "- Significant cross-border or multi-jurisdictional exposure;\n"
            "- Customer base includes or may include PEPs and high-risk entities;\n"
            "- Products/services with high anonymity or irreversibility;\n"
            "- Presence in or transactions to/from high-risk jurisdictions.\n\n"
            "Given this HIGH risk profile, the Organisation applies enhanced controls "
            "across its entire business and reviews its EWRA at least every 6 months."
        )
        + "\n\n"
        + t.ewra_summary
    )

    t.cdd_enhanced_procedures = (
        "HIGH RISK PROFILE — ECDD is applied broadly:\n\n"
        "- ALL new customers undergo enhanced source of funds verification;\n"
        "- Senior management (AML/CTF Compliance Officer or above) must approve "
        "ALL new customer relationships;\n"
        "- Ongoing monitoring is conducted at minimum quarterly for all customers;\n"
        "- All customers are reviewed against PEP and sanctions lists monthly;\n"
        "- Beneficial ownership re-verification required annually for all business customers;\n"
        "- Any customer unable to provide satisfactory source of funds documentation "
        "is declined regardless of transaction size.\n\n"
    ) + t.cdd_enhanced_procedures

    t.ongoing_cdd = (
        t.ongoing_cdd + "\n\n"
        "HIGH RISK MONITORING: All customer relationships are reviewed at least "
        "annually. Transaction monitoring alerts are reviewed within 24 hours. "
        "High-value transactions (> AUD $50,000) require same-day compliance review."
    )

    t.pep_procedures = (
        "HIGH RISK PROFILE — ADDITIONAL PEP CONTROLS:\n"
        "- PEP screening is conducted monthly for all customers (not just at onboarding);\n"
        "- Board-level approval required for all PEP relationships;\n"
        "- PEP relationship reviews conducted every 6 months;\n"
        "- Source of wealth must be independently corroborated for all PEPs.\n\n"
    ) + t.pep_procedures
