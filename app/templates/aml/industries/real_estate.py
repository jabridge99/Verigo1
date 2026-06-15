"""
Real Estate AML template — Tranche 2 (new 2026 reform).
NO IFTI obligation.  NO TTR (no cash handling obligation as remittance dealer).
Key risks: property transactions, trust accounts, opacity of beneficial ownership.
"""
from app.templates.aml.base import AMLTemplateBase, BASE_CONTROLS, BASE_POLICIES
import copy


def get_template(risk_level: str = "medium") -> AMLTemplateBase:
    t = AMLTemplateBase(industry="real_estate", risk_level=risk_level)
    t.has_ifti_obligation = False
    t.has_ttr_obligation = False
    t.has_travel_rule = False
    t.is_tranche_2 = True

    t.scope = (
        "This Program applies to all real estate services provided by the Organisation "
        "that constitute designated services under the AML/CTF Act 2006 as amended "
        "by the 2024 Amendment Act (Tranche 2, commencing 31 March 2026).\n\n"
        "In-scope activities include:\n"
        "- Buying or selling real property on behalf of a customer;\n"
        "- Arranging the transfer or settlement of real property;\n"
        "- Holding or managing client funds in relation to property transactions;\n"
        "- Acting as a buyer's agent.\n\n"
        "Out of scope: purely property management (leasing/rental) activities "
        "that do not involve property transactions."
    )

    t.designated_services = (
        "The Organisation provides real estate agency services that involve:\n"
        "- Acting as a real estate agent in the sale or purchase of real property;\n"
        "- Holding deposits and vendor proceeds in trust accounts;\n"
        "- Settlement coordination.\n\n"
        "As a Tranche 2 reporting entity, the Organisation does not have IFTI or "
        "TTR reporting obligations unless it separately provides remittance or "
        "cash-handling services."
    )

    t.risk_factors_customer = (
        "Real estate-specific customer risk factors:\n"
        "- Offshore or foreign buyers (particularly from high-risk jurisdictions);\n"
        "- Purchases through trusts, companies or nominees without clear beneficial ownership;\n"
        "- Politically Exposed Persons purchasing high-value property;\n"
        "- Customers paying in cash or via cryptocurrency;\n"
        "- Customers with no apparent connection to the property location;\n"
        "- Multiple property purchases in a short period;\n"
        "- Customers who are reluctant to provide identity documentation."
    )

    t.risk_factors_product = (
        "Real estate-specific product risk factors:\n"
        "- High-value property transactions (> AUD $1 million);\n"
        "- Rapid resale (buy and sell within 12 months);\n"
        "- Undervalued or overvalued properties (price manipulation);\n"
        "- Off-plan or pre-construction purchases;\n"
        "- Use of third-party funds (someone other than the buyer pays);\n"
        "- Complex settlement structures."
    )

    t.risk_factors_channel = (
        "Delivery channel risks specific to real estate:\n"
        "- Transactions conducted entirely remotely without face-to-face contact;\n"
        "- Use of intermediaries (lawyers, accountants, buyer's agents) who are "
        "themselves not subject to AML obligations;\n"
        "- Overseas purchasers transacting through local representatives."
    )

    t.cdd_individuals = (
        "For individual customers (buyers and sellers), verify:\n"
        "- Full legal name;\n"
        "- Date of birth;\n"
        "- Residential address;\n"
        "- Source of funds for the purchase (particularly for high-value transactions).\n\n"
        "VERIFICATION: As per standard individual CDD procedures (passport, "
        "driver's licence, or equivalent).\n\n"
        "HIGH-VALUE TRANSACTIONS (> AUD $1 million):\n"
        "- Enhanced source of funds verification required;\n"
        "- Document explanation of how funds are derived;\n"
        "- Escalate to Compliance Officer if source of funds is unclear."
    )

    t.beneficial_ownership_procedures = (
        "Where a customer is purchasing through a company, trust or other structure:\n\n"
        "1. Identify all beneficial owners (individuals with >= 25% interest);\n"
        "2. Verify the identity of each beneficial owner;\n"
        "3. Obtain a beneficial ownership declaration signed by the customer;\n"
        "4. If beneficial ownership cannot be determined, do not proceed and "
        "report to the Compliance Officer;\n"
        "5. Where property is purchased by a trust, identify the trustee, "
        "settlor and all beneficiaries with a material interest.\n\n"
        "Nominee or 'straw man' purchases (buying in another person's name) "
        "are a significant red flag and must be escalated immediately."
    )

    t.ifti_procedures = (
        "IFTI reporting does not apply to this Organisation's designated real estate "
        "services. The Organisation does not transmit international funds transfer "
        "instructions as part of its designated services.\n\n"
        "If a customer wishes to use proceeds from an international funds transfer "
        "for a property purchase, the Organisation should request evidence of "
        "the transfer and its source as part of CDD."
    )

    t.ttr_procedures = (
        "TTR reporting obligations (physical currency >= AUD $10,000) do not apply "
        "to this Organisation's real estate services.\n\n"
        "The Organisation does NOT accept cash payments for property transactions. "
        "Any customer who offers cash must be declined and reported to the "
        "Compliance Officer, who will assess whether an SMR is warranted."
    )

    extra_controls = [
        {"control_ref": "CTL-010", "title": "Source of Funds Verification — High-Value Property",
         "control_type": "preventive", "risk_area": "source_of_funds"},
        {"control_ref": "CTL-011", "title": "Beneficial Ownership — Property Purchasers",
         "control_type": "preventive", "risk_area": "beneficial_ownership"},
        {"control_ref": "CTL-012", "title": "Cash Payment Prohibition",
         "control_type": "preventive", "risk_area": "transaction_monitoring"},
        {"control_ref": "CTL-013", "title": "Trust Account Monitoring",
         "control_type": "detective", "risk_area": "trust_accounts"},
    ]

    t._policies = copy.deepcopy(BASE_POLICIES) + [
        {"title": "Source of Funds Policy — Property Transactions", "policy_type": "source_of_funds"},
        {"title": "Cash Payment Prohibition Policy",                "policy_type": "transaction_monitoring"},
        {"title": "Trust Account AML Policy",                       "policy_type": "trust_accounts"},
    ]
    t._controls = copy.deepcopy(BASE_CONTROLS) + extra_controls

    return t
