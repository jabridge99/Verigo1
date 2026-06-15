"""
Accounting / Bookkeeping / Tax Agent AML template — Tranche 2 (2026 reform).
NO IFTI.  Key risks: client trust accounts, structuring advice, shell companies.
"""
from app.templates.aml.base import AMLTemplateBase, BASE_CONTROLS, BASE_POLICIES
import copy


def get_template(risk_level: str = "medium") -> AMLTemplateBase:
    t = AMLTemplateBase(industry="accounting", risk_level=risk_level)
    t.has_ifti_obligation = False
    t.has_ttr_obligation = False
    t.has_travel_rule = False
    t.is_tranche_2 = True

    t.scope = (
        "This Program applies to accounting, bookkeeping and tax services provided "
        "by the Organisation that constitute designated services under the AML/CTF Act "
        "as amended (Tranche 2, commencing 31 March 2026).\n\n"
        "In-scope services include:\n"
        "- Receiving, holding or managing client monies or assets in trust;\n"
        "- Acting as a tax agent for business clients;\n"
        "- Company formation, structuring or dissolution services;\n"
        "- Acting as a nominee director or shareholder;\n"
        "- Advice in relation to capital transactions (mergers, acquisitions, investments).\n\n"
        "Standard compliance and audit services provided to regulated entities "
        "may be excluded — seek legal advice on scope."
    )

    t.designated_services = (
        "The Organisation provides the following designated services:\n"
        "- Accounting and bookkeeping services involving client trust accounts;\n"
        "- Tax agent services for business clients involving material financial transactions;\n"
        "- Company formation and corporate structuring services.\n\n"
        "As a Tranche 2 entity, IFTI and TTR reporting obligations do not apply "
        "unless the Organisation separately provides remittance services."
    )

    t.risk_factors_customer = (
        "Accounting-specific customer risk factors:\n"
        "- Clients with complex or opaque corporate structures;\n"
        "- Clients requesting advice on minimising transaction trails;\n"
        "- Clients from high-risk industries (gambling, real estate, cash-intensive businesses);\n"
        "- Clients who cannot clearly explain the source of business funds;\n"
        "- Clients with beneficial owners in high-risk jurisdictions;\n"
        "- Clients with unusual urgency around transactions;\n"
        "- Politically Exposed Persons as business owners or controllers."
    )

    t.risk_factors_product = (
        "Product/service risk factors specific to accounting:\n"
        "- Client trust account management (pooled funds risk);\n"
        "- Company formation — creating shell companies for unknown purposes;\n"
        "- Nominee services — acting in client's name;\n"
        "- Tax minimisation advice involving offshore structures;\n"
        "- Large or unusual trust distributions."
    )

    t.beneficial_ownership_procedures = (
        "For all business clients, the Organisation identifies and verifies:\n"
        "- All individuals owning or controlling >= 25% of the business;\n"
        "- All directors and senior managing officials;\n"
        "- Where the client is a trust: trustee(s), settlor, and material beneficiaries.\n\n"
        "Company formation services: the Organisation must identify the beneficial "
        "owner BEFORE forming the company, not after. Refusal to disclose beneficial "
        "ownership is grounds to decline the engagement.\n\n"
        "Nominee arrangements: If asked to act as a nominee director or shareholder, "
        "the Organisation must know the true beneficial owner and document this relationship."
    )

    t.ttr_procedures = (
        "TTR reporting does not apply to this Organisation's accounting services. "
        "Client trust accounts do not constitute 'accepting physical currency' for "
        "TTR purposes unless the Organisation physically accepts cash.\n\n"
        "The Organisation's policy is to NOT accept cash payments from clients. "
        "All client payments must be made via bank transfer or cheque."
    )

    t.ifti_procedures = (
        "IFTI reporting does not apply to this Organisation's designated "
        "accounting and tax services."
    )

    extra_controls = [
        {"control_ref": "CTL-010", "title": "Client Trust Account Monitoring",
         "control_type": "detective", "risk_area": "trust_accounts"},
        {"control_ref": "CTL-011", "title": "Company Formation CDD",
         "control_type": "preventive", "risk_area": "corporate_structures"},
        {"control_ref": "CTL-012", "title": "Cash Payment Prohibition",
         "control_type": "preventive", "risk_area": "transaction_monitoring"},
    ]

    t._policies = copy.deepcopy(BASE_POLICIES) + [
        {"title": "Client Trust Account AML Policy",  "policy_type": "trust_accounts"},
        {"title": "Company Formation CDD Policy",     "policy_type": "corporate_structures"},
        {"title": "Cash Prohibition Policy",          "policy_type": "transaction_monitoring"},
    ]
    t._controls = copy.deepcopy(BASE_CONTROLS) + extra_controls

    return t
