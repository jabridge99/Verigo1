"""
Virtual Asset Service Provider (VASP) / Cryptocurrency exchange AML template.
Tranche 1 — IFTI ✓  Travel Rule ✓  TTR (cash only) ✓
Updated for AML/CTF Amendment Act 2024 — new VASP definition includes
stablecoins, NFTs, and the broader 'virtual asset' definition.
"""
from app.templates.aml.base import AMLTemplateBase, BASE_CONTROLS, BASE_POLICIES
import copy


def get_template(risk_level: str = "medium") -> AMLTemplateBase:
    t = AMLTemplateBase(industry="cryptocurrency", risk_level=risk_level)
    t.has_ifti_obligation = True
    t.has_ttr_obligation = True   # cash on/off ramps
    t.has_travel_rule = True
    t.is_tranche_2 = False

    t.scope = (
        "This Program applies to all virtual asset services provided by the Organisation "
        "as a Virtual Asset Service Provider (VASP) registered with AUSTRAC. It covers:\n"
        "- Exchange of virtual assets for fiat currency (on/off ramps);\n"
        "- Exchange of one virtual asset for another;\n"
        "- Transfer of virtual assets;\n"
        "- Safekeeping or custody of virtual assets or keys;\n"
        "- Participation in and provision of financial services for ICOs/token sales.\n\n"
        "The 2024 Amendment Act expanded the definition of 'virtual asset' to include "
        "stablecoins, NFTs with financial characteristics, and other digital representations "
        "of value. All such assets are in scope of this Program."
    )

    t.designated_services = (
        "The Organisation provides the following designated services:\n"
        "- Virtual asset exchange services (fiat-to-crypto and crypto-to-fiat);\n"
        "- Virtual asset transfer services;\n"
        "- Virtual asset custody services (where applicable).\n\n"
        "AUSTRAC Registration: The Organisation must register with AUSTRAC as a VASP "
        "prior to providing any virtual asset service. Registration must be renewed "
        "every 3 years."
    )

    t.risk_factors_product = (
        "Virtual asset-specific risk factors:\n"
        "- Pseudonymous or anonymous nature of blockchain transactions;\n"
        "- Irreversibility of confirmed transactions;\n"
        "- Speed of cross-border transfers (near-instant settlement);\n"
        "- Peer-to-peer transfers bypassing the Organisation;\n"
        "- Mixing/tumbling services or privacy coins (e.g. Monero, Zcash);\n"
        "- Decentralised finance (DeFi) protocols;\n"
        "- Non-custodial wallets — customer controls private keys;\n"
        "- NFTs used for value transfer or layering."
    )

    t.risk_factors_customer = (
        "Customer risk factors specific to VASP:\n"
        "- Customers using self-hosted (non-custodial) wallets for large transactions;\n"
        "- Transactions to/from wallets flagged by blockchain analytics;\n"
        "- Customers in high-risk jurisdictions;\n"
        "- Customers who cannot explain the source of virtual assets;\n"
        "- Politically Exposed Persons;\n"
        "- Customers requesting unusually large or frequent transactions;\n"
        "- Customers with known links to darknet markets or illicit activity."
    )

    t.transaction_monitoring = (
        "In addition to standard transaction monitoring, the Organisation uses "
        "blockchain analytics tools to:\n\n"
        "- Screen wallet addresses at onboarding and on each transaction;\n"
        "- Detect transactions from wallets linked to darknet markets, ransomware, "
        "theft, or sanctioned entities;\n"
        "- Identify on-chain risk indicators (mixer usage, rapid pass-through, "
        "large unexplained receipts from unknown sources);\n"
        "- Monitor transaction clusters for structuring patterns.\n\n"
        "HIGH-RISK wallet risk scores trigger immediate compliance review and may "
        "result in transaction blocking and SMR filing."
    )

    t.travel_rule_procedures = (
        "OBLIGATION: Under AML/CTF Rules 2025, the Travel Rule applies to all "
        "virtual asset transfers above AUD $1,000 (or equivalent).\n\n"
        "OUTGOING VIRTUAL ASSET TRANSFERS — transmit to receiving VASP:\n"
        "- Originator: full name, wallet address, account number/reference, "
        "and address OR date of birth OR ID number;\n"
        "- Beneficiary: full name, wallet address.\n\n"
        "INCOMING VIRTUAL ASSET TRANSFERS — receive from sending VASP:\n"
        "- Verify Travel Rule information accompanies the transfer;\n"
        "- If receiving from a non-compliant VASP, apply enhanced due diligence;\n"
        "- Transfers from self-hosted wallets above AUD $1,000 require "
        "counterparty verification.\n\n"
        "SUNRISE ISSUE: Where the counterparty VASP is in a jurisdiction that "
        "has not yet implemented the Travel Rule, apply best-efforts procedures "
        "and document the approach.\n\n"
        "RECORDS: All Travel Rule information retained for 7 years."
    )

    t.ifti_procedures = (
        "OBLIGATION: Submit an IFTI report for every virtual asset transfer "
        "that constitutes an international funds transfer instruction.\n\n"
        "SCOPE: IFTI reporting applies where the Organisation sends or receives "
        "a transfer of virtual assets on behalf of a customer, where the "
        "counterparty is located outside Australia.\n\n"
        "REPORTING DEADLINE: Within 10 business days of the transfer.\n\n"
        "NOTE: Purely on-chain transfers between self-hosted wallets where the "
        "Organisation is not acting as an intermediary may not constitute an IFTI. "
        "Seek legal advice where scope is unclear."
    )

    extra_controls = [
        {"control_ref": "CTL-010", "title": "Blockchain Analytics Wallet Screening",
         "control_type": "detective", "risk_area": "transaction_monitoring"},
        {"control_ref": "CTL-011", "title": "Self-Hosted Wallet Risk Assessment",
         "control_type": "detective", "risk_area": "customer_risk"},
        {"control_ref": "CTL-012", "title": "Travel Rule — Virtual Asset Transfers",
         "control_type": "preventive", "risk_area": "travel_rule"},
        {"control_ref": "CTL-013", "title": "IFTI Reporting — Virtual Asset Transfers",
         "control_type": "detective", "risk_area": "ifti_reporting"},
    ]

    t._policies = copy.deepcopy(BASE_POLICIES) + [
        {"title": "Virtual Asset Risk Policy",        "policy_type": "virtual_asset"},
        {"title": "Travel Rule Compliance Policy",    "policy_type": "travel_rule"},
        {"title": "Blockchain Analytics Policy",      "policy_type": "transaction_monitoring"},
        {"title": "Self-Hosted Wallet Policy",        "policy_type": "kyc"},
    ]
    t._controls = copy.deepcopy(BASE_CONTROLS) + extra_controls

    return t
