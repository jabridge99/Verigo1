"""
Fintech / Payment Services AML template.
Tranche 1 — IFTI ✓  TTR ✓ (if cash handling)  Travel Rule ✓
Covers: payment platforms, BNPL, digital wallets, neobanks, payment facilitators.
"""

import copy

from app.templates.aml.base import BASE_CONTROLS, BASE_POLICIES, AMLTemplateBase


def get_template(risk_level: str = "medium") -> AMLTemplateBase:
    t = AMLTemplateBase(industry="fintech", risk_level=risk_level)
    t.has_ifti_obligation = True
    t.has_ttr_obligation = True
    t.has_travel_rule = True
    t.is_tranche_2 = False

    t.scope = (
        "This Program applies to all payment and financial technology services "
        "provided by the Organisation that constitute designated services under "
        "the AML/CTF Act.\n\n"
        "In-scope services may include:\n"
        "- Digital wallet services;\n"
        "- Domestic and international payment facilitation;\n"
        "- Buy Now Pay Later (BNPL) credit services;\n"
        "- Merchant acquiring and payment processing;\n"
        "- Stored value facilities;\n"
        "- Neobank or banking-as-a-service (BaaS) products.\n\n"
        "The Organisation must identify which specific designated services it "
        "provides and update this section accordingly."
    )

    t.risk_factors_product = (
        "Fintech-specific product risk factors:\n"
        "- Fully digital, non-face-to-face customer onboarding;\n"
        "- High transaction velocity enabled by technology;\n"
        "- Cross-border payments (IFTI obligations);\n"
        "- Stored value or prepaid instruments;\n"
        "- API-based integrations with third-party platforms;\n"
        "- BNPL — deferred payment structures;\n"
        "- P2P payment features (customer-to-customer transfers)."
    )

    t.travel_rule_procedures = (
        "OBLIGATION: Travel Rule applies to all cross-border transfers and "
        "international payment instructions facilitated by the Organisation.\n\n"
        "DIGITAL WALLET TRANSFERS:\n"
        "- For transfers between the Organisation's own wallets (intra-platform), "
        "the Organisation holds full originator/beneficiary information;\n"
        "- For transfers to external financial institutions, transmit required "
        "Travel Rule information to the receiving institution.\n\n"
        "API-BASED PAYMENTS: Where payments are initiated via API by third-party "
        "platforms or merchants, the Organisation must ensure Travel Rule information "
        "is captured at the source and transmitted with the payment instruction."
    )

    t.ifti_procedures = (
        "OBLIGATION: Report all international funds transfer instructions (IFTIs) "
        "within 10 business days.\n\n"
        "AGGREGATION: Where the Organisation processes multiple small cross-border "
        "payments on behalf of the same customer in a short period, assess whether "
        "they constitute a single reportable IFTI (structuring detection).\n\n"
        "MERCHANT PAYMENTS: Cross-border merchant settlement payments must be "
        "assessed for IFTI reporting obligations based on the direction of funds "
        "and the Organisation's role in the transaction chain."
    )

    extra_controls = [
        {
            "control_ref": "CTL-010",
            "title": "Digital Onboarding Identity Verification",
            "control_type": "preventive",
            "risk_area": "kyc",
        },
        {
            "control_ref": "CTL-011",
            "title": "IFTI Reporting — Cross-Border Payments",
            "control_type": "detective",
            "risk_area": "ifti_reporting",
        },
        {
            "control_ref": "CTL-012",
            "title": "Travel Rule — Payment Instructions",
            "control_type": "preventive",
            "risk_area": "travel_rule",
        },
        {
            "control_ref": "CTL-013",
            "title": "API/Third-Party Payment Risk Controls",
            "control_type": "preventive",
            "risk_area": "third_party",
        },
    ]

    t._policies = copy.deepcopy(BASE_POLICIES) + [
        {"title": "Digital Onboarding AML Policy", "policy_type": "kyc"},
        {"title": "IFTI Reporting Policy", "policy_type": "ifti"},
        {"title": "Travel Rule Policy", "policy_type": "travel_rule"},
        {"title": "Third-Party/API Risk Policy", "policy_type": "third_party"},
    ]
    t._controls = copy.deepcopy(BASE_CONTROLS) + extra_controls

    return t
