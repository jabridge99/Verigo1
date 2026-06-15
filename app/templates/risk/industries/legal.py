from app.templates.risk.base import LibraryFactor, RiskLibrary

def get_library() -> RiskLibrary:
    return RiskLibrary(
        industry="legal",
        description="Law firm / conveyancer — Tranche 2. No IFTI/TTR obligations.",
        category_weights={
            "customer":    0.30,
            "product":     0.10,
            "service":     0.20,
            "geographic":  0.10,
            "channel":     0.05,
            "transaction": 0.15,
            "regulatory":  0.10,
        },
        factors=[
            LibraryFactor(
                ref="CUST-001", category_type="customer",
                name="Clients with opaque beneficial ownership",
                description="Clients acting through trusts, companies, or overseas entities with unknown ultimate beneficial owners.",
                suggested_likelihood=3, suggested_consequence=5,
                rationale="Legal gatekeepers are a primary target for ML; lawyers can legitimise otherwise suspicious transactions.",
                mitigation_examples=["Mandatory UBO identification for all entity clients", "Refuse to act where UBO cannot be identified"],
            ),
            LibraryFactor(
                ref="CUST-002", category_type="customer",
                name="Politically Exposed Persons (PEPs)",
                description="PEP clients instructing the firm in connection with property, company, or financial matters.",
                suggested_likelihood=2, suggested_consequence=5,
                rationale="PEPs misusing legal services to launder corrupt proceeds is a well-documented FATF typology.",
                mitigation_examples=["Partner approval for all PEP matters", "Source of wealth documentation", "Annual relationship review"],
            ),
            LibraryFactor(
                ref="SERV-001", category_type="service",
                name="Conveyancing and real estate transactions",
                description="Acting as lawyer or conveyancer in property purchase/sale transactions.",
                suggested_likelihood=3, suggested_consequence=5,
                rationale="Real estate is the #1 ML integration vehicle; lawyers handling conveyancing are key gatekeepers.",
                mitigation_examples=["Source of funds verification before settlement", "Beneficial ownership verification for purchasing entities", "Decline cash settlement payments"],
            ),
            LibraryFactor(
                ref="SERV-002", category_type="service",
                name="Company / trust establishment",
                description="Establishing legal structures — companies, trusts, partnerships — on behalf of clients.",
                suggested_likelihood=3, suggested_consequence=4,
                rationale="Shell company and trust creation is a central ML layering tool when lawyers act as nominee directors.",
                mitigation_examples=["No nominee director/shareholder arrangements", "Register UBO before structure established", "Decline bearer share structures"],
            ),
            LibraryFactor(
                ref="SERV-003", category_type="service",
                name="Client trust account management",
                description="Holding client funds in trust (settlement funds, retainers, damages payments).",
                suggested_likelihood=2, suggested_consequence=4,
                rationale="Trust accounts are a target for client ML; legal professional privilege can complicate investigation.",
                mitigation_examples=["Monthly trust account reconciliation", "Investigate unexplained third-party deposits", "Report suspicious movements via SMR"],
            ),
            LibraryFactor(
                ref="TXN-001", category_type="transaction",
                name="Third-party payments / unexpected third-party funds",
                description="Settlement or legal fees paid by unrelated third parties on behalf of the client.",
                suggested_likelihood=3, suggested_consequence=4,
                rationale="Third-party payment of legal fees is a known layering technique.",
                mitigation_examples=["Require written explanation for third-party payments", "CDD on third-party payers"],
            ),
            LibraryFactor(
                ref="REG-001", category_type="regulatory",
                name="Tranche 2 AML/CTF obligations — legal sector",
                description="Non-compliance with Tranche 2 obligations applicable to law firms from 31 March 2026.",
                suggested_likelihood=3, suggested_consequence=4,
                rationale="The legal sector is newly regulated and unfamiliar with AML/CTF obligations.",
                mitigation_examples=["Appoint MLRO (senior partner responsibility)", "Staff-wide AML training before 31 March 2026", "AUSTRAC enrolment for designated legal services"],
            ),
        ],
    )
