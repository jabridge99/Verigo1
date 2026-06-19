"""
Remittance / Independent Remittance Dealer (IRD) AML template.
Tranche 1 — IFTI ✓  TTR ✓  Travel Rule ✓
"""

import copy

from app.templates.aml.base import BASE_CONTROLS, BASE_POLICIES, AMLTemplateBase


def get_template(risk_level: str = "medium") -> AMLTemplateBase:
    t = AMLTemplateBase(industry="remittance", risk_level=risk_level)
    t.has_ifti_obligation = True
    t.has_ttr_obligation = True
    t.has_travel_rule = True
    t.is_tranche_2 = False

    t.scope = (
        "This Program applies to all remittance services provided by the Organisation "
        "as an Independent Remittance Dealer (IRD) registered on AUSTRAC's Remittance "
        "Sector Register. It covers all inbound and outbound international funds "
        "transfer instructions (IFTIs), domestic threshold transactions, and all "
        "staff and agents handling customer funds or instructions."
    )

    t.designated_services = (
        "The Organisation provides the following designated services:\n"
        "- Item 31: Registrable designated remittance service (outgoing IFTIs);\n"
        "- Item 32: Registrable designated remittance service (incoming IFTIs);\n"
        "- Cash handling and currency exchange where applicable.\n\n"
        "AUSTRAC Registration: The Organisation must be registered on the Remittance "
        "Sector Register prior to providing any remittance service. Registration must "
        "be renewed every 3 years."
    )

    t.risk_factors_channel = (
        "Delivery channel risks specific to remittance:\n"
        "- Non-face-to-face customer onboarding (online/phone orders);\n"
        "- Use of sub-agents or retail outlets to accept instructions;\n"
        "- Cash acceptance at branch or agent locations;\n"
        "- Correspondent or network providers (Tranche 1 obligations apply);\n"
        "- Mobile or online payment platforms."
    )

    t.risk_factors_geography = (
        "The Organisation transacts with counterparties in multiple jurisdictions. "
        "High-risk destination countries (FATF grey/black list) require ECDD. "
        "The Organisation maintains an approved country list and reviews it "
        "quarterly against FATF and DFAT updates.\n\n"
        "Transactions to sanctioned countries are prohibited."
    )

    t.travel_rule_procedures = (
        "OBLIGATION: Under the AML/CTF Rules 2025, the Organisation must transmit "
        "required payer and payee information with all international funds transfers.\n\n"
        "OUTGOING TRANSFERS — information transmitted to receiving institution:\n"
        "- Payer: full name, account number/reference, address or DOB or ID number;\n"
        "- Payee: full name, account number/reference.\n\n"
        "INCOMING TRANSFERS — information received from sending institution:\n"
        "- Verify that required Travel Rule information accompanies all incoming IFTIs;\n"
        "- If information is missing or incomplete, apply risk-based procedures "
        "before crediting or releasing funds;\n"
        "- Where information is consistently absent from a correspondent, review "
        "the correspondent relationship.\n\n"
        "RECORDS: Travel Rule information must be retained for 7 years."
    )

    t.ifti_procedures = (
        "OBLIGATION: The Organisation must submit an IFTI report to AUSTRAC for "
        "every international funds transfer instruction it sends or receives, "
        "regardless of amount.\n\n"
        "REPORTING DEADLINES:\n"
        "- IFTI-DRA OUT (outgoing): report within 10 business days of instruction;\n"
        "- IFTI-DRA IN (incoming): report within 10 business days of receipt.\n\n"
        "INFORMATION REQUIRED (112/115 column AUSTRAC format):\n"
        "- Ordering customer: full ID details, account, address;\n"
        "- Beneficiary customer: name, account, institution, country;\n"
        "- Transfer details: amount, currency, date, reference, method;\n"
        "- Reporter details: Organisation name, AUSTRAC ID, ABN.\n\n"
        "SUBMISSION: IFTIs are submitted via AUSTRAC Online or approved reporting "
        "software. The AML/CTF Compliance Officer is responsible for all IFTI submissions.\n\n"
        "STRUCTURING: Monitor for remittances structured to avoid IFTI reporting. "
        "Multiple related transfers that appear to form part of a larger transfer "
        "must be assessed as a single IFTI where applicable."
    )

    t.ttr_procedures = (
        "OBLIGATION: Report all physical currency transactions of AUD $10,000 or more "
        "within 15 business days.\n\n"
        "REMITTANCE-SPECIFIC CONSIDERATIONS:\n"
        "- Cash receipts from customers to fund remittances are TTR-reportable;\n"
        "- Foreign currency equivalent of AUD $10,000 must also be reported;\n"
        "- Structuring detection: watch for multiple cash deposits below $10,000 "
        "that appear designed to avoid TTR obligations.\n\n"
        "AGENT OBLIGATIONS: Where sub-agents accept cash on behalf of the Organisation, "
        "they must report cash receipts >= $10,000 to the Organisation within 2 "
        "business days for TTR submission."
    )

    # Add IFTI-specific controls
    extra_controls = [
        {
            "control_ref": "CTL-010",
            "title": "IFTI Reporting — Outgoing Transfers",
            "control_type": "detective",
            "risk_area": "ifti_reporting",
        },
        {
            "control_ref": "CTL-011",
            "title": "IFTI Reporting — Incoming Transfers",
            "control_type": "detective",
            "risk_area": "ifti_reporting",
        },
        {
            "control_ref": "CTL-012",
            "title": "Travel Rule Information Transmission",
            "control_type": "preventive",
            "risk_area": "travel_rule",
        },
        {
            "control_ref": "CTL-013",
            "title": "Sub-Agent Due Diligence and Monitoring",
            "control_type": "preventive",
            "risk_area": "agent_oversight",
        },
    ]

    t._policies = copy.deepcopy(BASE_POLICIES) + [
        {"title": "IFTI Reporting Procedures", "policy_type": "ifti"},
        {"title": "Travel Rule Compliance Policy", "policy_type": "travel_rule"},
        {"title": "Sub-Agent Management Policy", "policy_type": "agent_oversight"},
    ]
    t._controls = copy.deepcopy(BASE_CONTROLS) + extra_controls

    return t
