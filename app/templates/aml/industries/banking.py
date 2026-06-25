"""
Banking / ADI (Authorised Deposit-taking Institution) AML template.
Tranche 1 — IFTI ✓  TTR ✓  Travel Rule ✓  Full obligations.
"""

import copy

from app.templates.aml.base import BASE_CONTROLS, BASE_POLICIES, AMLTemplateBase


def get_template(risk_level: str = "medium") -> AMLTemplateBase:
    t = AMLTemplateBase(industry="banking", risk_level=risk_level)
    t.has_ifti_obligation = True
    t.has_ttr_obligation = True
    t.has_travel_rule = True
    t.is_tranche_2 = False

    t.scope = (
        "This Program applies to all banking, deposit-taking and payment services "
        "provided by the Organisation as an Authorised Deposit-taking Institution (ADI) "
        "or other regulated financial institution under the AML/CTF Act.\n\n"
        "In-scope services include:\n"
        "- Accepting deposits and managing bank accounts;\n"
        "- Domestic and international funds transfers;\n"
        "- Lending and credit facilities;\n"
        "- Foreign currency exchange;\n"
        "- Issuing and managing payment instruments (cards, cheques, BPay);\n"
        "- Correspondent banking relationships."
    )

    t.designated_services = (
        "The Organisation provides designated banking services including:\n"
        "- Deposit accounts and transaction accounts;\n"
        "- International funds transfers (IFTI);\n"
        "- Domestic EFT and SWIFT payments;\n"
        "- Foreign currency exchange;\n"
        "- Issuing payment instruments.\n\n"
        "The Organisation is also subject to APRA prudential standards (APS 001) "
        "and ASIC market integrity obligations in addition to AML/CTF requirements."
    )

    t.travel_rule_procedures = (
        "OBLIGATION: The Travel Rule applies to all funds transfers sent or received "
        "by the Organisation.\n\n"
        "OUTGOING TRANSFERS:\n"
        "- Transmit payer name, account/reference, and address (or DOB or ID number);\n"
        "- Transmit payee name and account number to the receiving institution;\n"
        "- Batch payments must include Travel Rule information for each payment.\n\n"
        "INCOMING TRANSFERS:\n"
        "- Verify that required information accompanies all incoming transfers;\n"
        "- Apply risk-based procedures to transfers with missing information;\n"
        "- Correspondent banking: include Travel Rule obligations in correspondent agreements.\n\n"
        "CORRESPONDENT BANKING: Due diligence on correspondent banks must include "
        "assessment of their AML/CTF controls and Travel Rule compliance."
    )

    t.ifti_procedures = (
        "OBLIGATION: Submit an IFTI report for every international funds transfer "
        "instruction sent or received, regardless of amount.\n\n"
        "REPORTING DEADLINE: Within 10 business days of the transfer instruction.\n\n"
        "BATCH REPORTING: Where multiple IFTIs are processed in a batch, each "
        "individual transfer must be reported separately.\n\n"
        "CORRESPONDENT BANKING: For transfers processed through correspondent "
        "banks, the Organisation remains responsible for IFTI reporting where "
        "it initiates or receives the instruction on behalf of a customer."
    )

    extra_controls = [
        {
            "control_ref": "CTL-010",
            "title": "IFTI Reporting — International Transfers",
            "control_type": "detective",
            "risk_area": "ifti_reporting",
        },
        {
            "control_ref": "CTL-011",
            "title": "Travel Rule — Funds Transfer Information",
            "control_type": "preventive",
            "risk_area": "travel_rule",
        },
        {
            "control_ref": "CTL-012",
            "title": "Correspondent Banking Due Diligence",
            "control_type": "preventive",
            "risk_area": "correspondent_banking",
        },
        {
            "control_ref": "CTL-013",
            "title": "Cash Threshold Reporting (TTR)",
            "control_type": "detective",
            "risk_area": "ttr_reporting",
        },
    ]

    t._policies = copy.deepcopy(BASE_POLICIES) + [
        {"title": "IFTI Reporting Policy", "policy_type": "ifti"},
        {"title": "Travel Rule Compliance Policy", "policy_type": "travel_rule"},
        {
            "title": "Correspondent Banking AML Policy",
            "policy_type": "correspondent_banking",
        },
    ]
    t._controls = copy.deepcopy(BASE_CONTROLS) + extra_controls

    return t
