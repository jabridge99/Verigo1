"""
Dealers in Precious Metals & Stones (DPMS) AML template.
Tranche 2 — IFTI ✗  TTR ✓  Travel Rule ✗

Covers both `IndustryType.bullion_dealers` and `IndustryType.precious_metals`
(bullion and precious-stones dealing are the same designated service item
under the AML/CTF Rules; there is no separate template needed for each).

This module exists because the generic `other.py` fallback both sectors
used to share is factually backwards for DPMS: its `ttr_procedures` states
the organisation does not accept cash and must decline any offered — the
opposite of DPMS-01, the sector's own first monitoring rule, which is built
entirely around DPMS routinely accepting large cash transactions. An org
onboarded as DPMS under the old fallback got a Program that told it to
refuse the cash transactions its own designated service exists to handle.
This module covers the core TTR/cash-monitoring correction plus the
sector's own concrete, threshold-driven monitoring rules (DPMS-01 through
DPMS-08, sourced from `VERIGO_DPMS_TMP_Guideline_v1.docx`); it is not yet
the full sector rewrite tracked in `PARKING_LOT.md` (P21) -- gemstone/watch-
specific CDD nuance, the full 12-rule TMP set, and a dedicated risk-library
factor set remain parked pending a dedicated content-authoring pass.
"""

import copy

from app.templates.aml.base import BASE_CONTROLS, BASE_POLICIES, AMLTemplateBase


def get_template(risk_level: str = "medium") -> AMLTemplateBase:
    t = AMLTemplateBase(industry="dpms", risk_level=risk_level)
    t.has_ifti_obligation = False
    t.has_ttr_obligation = True
    t.has_travel_rule = False
    t.is_tranche_2 = True

    t.scope = (
        "This Program applies to the Organisation's designated service of buying "
        "and selling bullion, precious metals, and precious stones as a dealer, "
        "under the AML/CTF Act 2006 as amended by the 2024 Amendment Act. It "
        "covers all cash and non-cash purchases and sales, all customer-facing "
        "staff, and all locations at which the Organisation trades."
    )

    t.designated_services = (
        "The Organisation provides the designated service of dealing in bullion, "
        "precious metals or precious stones (buying, selling, or exchanging) as "
        "listed in the AML/CTF Act's designated services table.\n\n"
        "As a Tranche 2 reporting entity, IFTI reporting and the Travel Rule do "
        "not apply unless the Organisation separately provides remittance or "
        "virtual asset transfer services. Threshold Transaction Reporting DOES "
        "apply — see below — because cash acceptance is central to this "
        "designated service, not incidental to it."
    )

    t.ifti_procedures = (
        "IFTI reporting does not apply to this Organisation's designated services."
    )

    t.ttr_procedures = (
        "OBLIGATION: The Organisation must report a Threshold Transaction Report "
        "(TTR) to AUSTRAC within 15 business days for any cash transaction of "
        "AUD $10,000 or more (DPMS-01 — the sector's primary monitoring rule).\n\n"
        "DPMS-01 — CASH TRANSACTION AT OR ABOVE AUD $10,000: CDD and TTR are "
        "mandatory for any cash purchase or sale at or above this threshold. "
        "Cash is a normal and expected part of this designated service — it "
        "must be accepted, verified, and reported, not declined.\n\n"
        "ADDITIONAL DPMS-SPECIFIC MONITORING RULES:\n"
        "- Structuring near $10,000: multiple related cash transactions that "
        "together approach or exceed the threshold, including same-day or "
        "near-term multiple visits by the same customer;\n"
        "- Very-large cash transactions (>= AUD $100,000): require Director "
        "sign-off in addition to standard CDD/TTR, regardless of customer "
        "risk rating;\n"
        "- Rapid buy-back: the Organisation repurchasing an item it recently "
        "sold to the same customer within 90 days, particularly at a loss;\n"
        "- Unknown or undocumented provenance of metals/stones offered for sale;\n"
        "- Cryptocurrency offered as payment for bullion/precious metals;\n"
        "- Indicators consistent with a mule purchaser (buying on behalf of an "
        "undisclosed third party);\n"
        "- Wholesale purchase volume exceeding 200% of a customer's stated "
        "usual trading range;\n"
        "- Metals or stones with an origin in a sanctioned jurisdiction — "
        "Russia, Iran, North Korea, or Myanmar are explicitly prohibited "
        "origins for this Organisation's trading.\n\n"
        "Records of cash transactions, structuring assessments, and any "
        "Director sign-offs are retained per the record-keeping obligations "
        "in Section 12."
    )

    t.risk_factors_product = (
        "Product and service risk factors specific to DPMS:\n"
        "- Bullion, precious metals and precious stones are highly portable, "
        "globally liquid, and can be used to move value with minimal traceability;\n"
        "- Cash is the Organisation's normal and expected mode of payment, "
        "elevating ML/TF risk relative to non-cash-handling sectors;\n"
        "- Items with unknown or undocumented provenance;\n"
        "- Items originating from sanctioned jurisdictions (Russia, Iran, "
        "North Korea, Myanmar are prohibited origins);\n"
        "- Rapid buy-back or resale patterns inconsistent with genuine trade."
    )

    t.risk_factors_customer = (
        "Customer risk factors specific to DPMS:\n"
        "- Politically Exposed Persons (PEPs) and their associates;\n"
        "- Customers from high-risk jurisdictions (FATF grey/black list countries);\n"
        "- Customers purchasing or selling on behalf of an undisclosed third "
        "party (mule-purchaser indicators);\n"
        "- Customers whose transaction volume or value is materially "
        "inconsistent with their stated occupation or business;\n"
        "- Customers offering cryptocurrency as payment;\n"
        "- Wholesale customers whose purchase volume exceeds 200% of their "
        "stated usual trading range."
    )

    t.transaction_monitoring = (
        "The Organisation monitors every cash and non-cash transaction against "
        "the DPMS-specific rules in the TTR Procedures section above (DPMS-01 "
        "and related structuring, large-value, buy-back, provenance, "
        "cryptocurrency-payment, mule-purchaser, and sanctioned-origin rules), "
        "in addition to the standard monitoring described below.\n\n"
        "AUTOMATED RULES:\n"
        "- Cash transactions at or approaching the AUD $10,000 TTR threshold;\n"
        "- Cash transactions at or above AUD $100,000 (Director sign-off required);\n"
        "- Repurchase of a previously sold item within 90 days;\n"
        "- Transactions inconsistent with the customer's known business profile.\n\n"
        "MANUAL REVIEW: Alerts are reviewed by a compliance analyst and escalated "
        "to the AML/CTF Compliance Officer where required. The Compliance "
        "Officer determines whether an SMR is warranted, in addition to any "
        "separate TTR obligation the same transaction triggers."
    )

    t._policies = copy.deepcopy(BASE_POLICIES) + [
        {"title": "Cash Transaction & TTR Policy", "policy_type": "reporting"},
    ]
    t._controls = copy.deepcopy(BASE_CONTROLS) + [
        {
            "control_ref": "CTL-010",
            "title": "Cash Transaction Threshold Monitoring (DPMS-01)",
            "control_type": "detective",
            "risk_area": "transaction_monitoring",
        },
        {
            "control_ref": "CTL-011",
            "title": "Director Sign-off for Cash Transactions >= AUD $100,000",
            "control_type": "preventive",
            "risk_area": "high_value_transactions",
        },
        {
            "control_ref": "CTL-012",
            "title": "Metals/Stones Provenance and Sanctioned-Origin Check",
            "control_type": "preventive",
            "risk_area": "product_risk",
        },
    ]

    return t
