"""
Legal / Conveyancing AML template — Tranche 2 (2026 reform).
NO IFTI.  Key risks: client trust accounts, conveyancing, company/trust formation.
"""

import copy

from app.templates.aml.base import BASE_CONTROLS, BASE_POLICIES, AMLTemplateBase


def get_template(risk_level: str = "medium") -> AMLTemplateBase:
    t = AMLTemplateBase(industry="legal", risk_level=risk_level)
    t.has_ifti_obligation = False
    t.has_ttr_obligation = False
    t.has_travel_rule = False
    t.is_tranche_2 = True

    t.scope = (
        "This Program applies to legal services provided by the Organisation that "
        "constitute designated services under the AML/CTF Act as amended "
        "(Tranche 2, commencing 31 March 2026).\n\n"
        "In-scope services include:\n"
        "- Conveyancing and property transactions;\n"
        "- Receiving or disbursing client monies through a trust account;\n"
        "- Company or trust formation;\n"
        "- Acting as a nominee director or trustee;\n"
        "- Managing assets or business arrangements on behalf of a client;\n"
        "- Mergers, acquisitions and capital transactions.\n\n"
        "NOTE: Litigation services and purely advisory legal services that do not "
        "involve managing client funds or forming structures are generally excluded. "
        "Seek guidance from your legal professional body on scope."
    )

    t.designated_services = (
        "The Organisation provides the following designated services:\n"
        "- Conveyancing services involving the transfer of real property;\n"
        "- Legal trust account management for clients;\n"
        "- Trust and company formation services;\n"
        "- Transactional legal services involving the movement of client funds.\n\n"
        "As a Tranche 2 entity, IFTI and TTR obligations do not apply unless "
        "the Organisation separately provides financial transfer services."
    )

    t.risk_factors_customer = (
        "Legal-specific customer risk factors:\n"
        "- Clients purchasing property through opaque structures;\n"
        "- Clients requesting unusual or complex trust/company structures;\n"
        "- Foreign clients or those with offshore funding sources;\n"
        "- Clients who are reluctant to explain the purpose of legal services;\n"
        "- PEPs or their associates;\n"
        "- Clients from high-risk industries or jurisdictions;\n"
        "- Clients seeking nominee or bearer arrangements."
    )

    t.beneficial_ownership_procedures = (
        "LEGAL PROFESSIONAL PRIVILEGE NOTE: Beneficial ownership CDD obligations "
        "apply to legal services within scope of this Program. Legal professional "
        "privilege does not override AML/CTF identification obligations.\n\n"
        "For all non-individual clients:\n"
        "- Identify all beneficial owners (>= 25% ownership or effective control);\n"
        "- Verify identity of each beneficial owner using standard procedures;\n"
        "- For trusts: identify trustee(s), settlor, and all material beneficiaries;\n"
        "- Document the beneficial ownership chain in the client file.\n\n"
        "CONVEYANCING: For property purchases, identify the true purchaser "
        "(including any person providing funds for the purchase) in addition "
        "to the legal title holder."
    )

    t.ttr_procedures = (
        "TTR reporting does not apply to this Organisation's legal services.\n\n"
        "The Organisation does not accept cash through its trust account or in "
        "payment of fees. All payments must be made by bank transfer or cheque. "
        "Any client who offers cash must be referred to the Compliance Officer."
    )

    t.ifti_procedures = "IFTI reporting does not apply to this Organisation's designated legal services."

    extra_controls = [
        {
            "control_ref": "CTL-010",
            "title": "Legal Trust Account AML Controls",
            "control_type": "preventive",
            "risk_area": "trust_accounts",
        },
        {
            "control_ref": "CTL-011",
            "title": "Conveyancing CDD — Property Purchasers",
            "control_type": "preventive",
            "risk_area": "kyc",
        },
        {
            "control_ref": "CTL-012",
            "title": "Cash Prohibition — Client Payments",
            "control_type": "preventive",
            "risk_area": "transaction_monitoring",
        },
    ]

    t._policies = copy.deepcopy(BASE_POLICIES) + [
        {"title": "Legal Trust Account AML Policy", "policy_type": "trust_accounts"},
        {"title": "Conveyancing CDD Policy", "policy_type": "kyc"},
        {"title": "Cash Prohibition Policy", "policy_type": "transaction_monitoring"},
    ]
    t._controls = copy.deepcopy(BASE_CONTROLS) + extra_controls

    return t
