from app.templates.risk.base import LibraryFactor, RiskLibrary

def get_library() -> RiskLibrary:
    return RiskLibrary(
        industry="accounting",
        description="Accounting firm / tax agent — Tranche 2. No IFTI/TTR obligations.",
        category_weights={
            "customer":    0.30,
            "product":     0.15,
            "service":     0.15,
            "geographic":  0.10,
            "channel":     0.05,
            "transaction": 0.15,
            "regulatory":  0.10,
        },
        factors=[
            LibraryFactor(
                ref="CUST-001", category_type="customer",
                name="High-net-worth individuals with complex structures",
                description="Clients with complex trust, company, or family office structures.",
                suggested_likelihood=3, suggested_consequence=4,
                rationale="Complex structures can be used to obscure beneficial ownership and launder proceeds.",
                mitigation_examples=["Beneficial ownership mapping for all structures", "Source of wealth documentation for HNWI clients"],
            ),
            LibraryFactor(
                ref="CUST-002", category_type="customer",
                name="Politically Exposed Persons (PEPs)",
                description="PEP clients or their associates engaging accounting services.",
                suggested_likelihood=2, suggested_consequence=4,
                rationale="Accountants may be used by PEPs to create legal structures obscuring corrupt funds.",
                mitigation_examples=["PEP screening at client onboarding", "Senior partner sign-off for PEP engagements"],
            ),
            LibraryFactor(
                ref="SERV-001", category_type="service",
                name="Company formation / trust establishment",
                description="Assisting clients with establishing companies, trusts, or other legal structures.",
                suggested_likelihood=3, suggested_consequence=4,
                rationale="Gatekeeping function: accountants creating structures are key ML enablers if not vigilant.",
                mitigation_examples=["Beneficial ownership declaration before company formation", "Refuse to create nominee/bearer share structures"],
            ),
            LibraryFactor(
                ref="SERV-002", category_type="service",
                name="Client account / trust account management",
                description="Holding or managing client funds in trust accounts.",
                suggested_likelihood=2, suggested_consequence=4,
                rationale="Client accounts can be used to layer funds with professional legitimacy.",
                mitigation_examples=["Strict trust account reconciliation", "Investigate any unexplained client fund movements"],
            ),
            LibraryFactor(
                ref="TXN-001", category_type="transaction",
                name="Unusual large fee payments or retainers",
                description="Clients paying large advance retainers inconsistent with services provided.",
                suggested_likelihood=2, suggested_consequence=3,
                rationale="Overpayment of professional fees can be a method to clean funds.",
                mitigation_examples=["Fee reasonableness review policy", "Refund unexplained overpayments; do not retain"],
            ),
            LibraryFactor(
                ref="REG-001", category_type="regulatory",
                name="Tranche 2 AML/CTF — new obligations",
                description="Risk of non-compliance with accounting sector Tranche 2 obligations from 31 March 2026.",
                suggested_likelihood=3, suggested_consequence=4,
                rationale="Newly regulated; sector unfamiliarity with AML obligations creates systemic risk.",
                mitigation_examples=["All partners and staff complete AML/CTF training", "Designate MLRO within firm", "Enrol with AUSTRAC before providing designated services"],
            ),
        ],
    )
