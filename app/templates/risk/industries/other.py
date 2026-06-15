from app.templates.risk.base import LibraryFactor, RiskLibrary

def get_library() -> RiskLibrary:
    return RiskLibrary(
        industry="other",
        description="General / other regulated entity. Balanced risk factor baseline.",
        category_weights={
            "customer":    0.25,
            "product":     0.15,
            "service":     0.10,
            "geographic":  0.15,
            "channel":     0.10,
            "transaction": 0.15,
            "regulatory":  0.10,
        },
        factors=[
            LibraryFactor(
                ref="CUST-001", category_type="customer",
                name="Unknown or unverified customers",
                description="Customers where identity cannot be satisfactorily verified.",
                suggested_likelihood=2, suggested_consequence=4,
                rationale="Inability to verify identity is a fundamental AML/CTF risk.",
                mitigation_examples=["Do not provide services until identity verified", "Enhanced CDD for higher-risk customers"],
            ),
            LibraryFactor(
                ref="CUST-002", category_type="customer",
                name="Politically Exposed Persons (PEPs)",
                description="Customers who are PEPs or their immediate family/associates.",
                suggested_likelihood=2, suggested_consequence=4,
                rationale="PEPs present elevated corruption and bribery risk across all industries.",
                mitigation_examples=["PEP screening at onboarding and annually", "Senior management approval for PEP relationships"],
            ),
            LibraryFactor(
                ref="PROD-001", category_type="product",
                name="High-value products / services",
                description="Products or services with a value that could facilitate significant ML.",
                suggested_likelihood=2, suggested_consequence=3,
                rationale="Higher-value transactions carry greater absolute ML risk.",
                mitigation_examples=["Source-of-funds declaration above threshold", "Enhanced monitoring for high-value transactions"],
            ),
            LibraryFactor(
                ref="GEO-001", category_type="geographic",
                name="Transactions involving high-risk jurisdictions",
                description="Business conducted with counterparties in FATF grey/black-listed countries.",
                suggested_likelihood=2, suggested_consequence=4,
                rationale="High-risk jurisdictions present elevated ML/TF exposure.",
                mitigation_examples=["Jurisdiction risk rating maintained", "Enhanced CDD for high-risk jurisdiction customers", "Sanctions screening on all counterparties"],
            ),
            LibraryFactor(
                ref="TXN-001", category_type="transaction",
                name="Unusual transaction patterns",
                description="Transactions inconsistent with a customer's known profile or expected activity.",
                suggested_likelihood=2, suggested_consequence=3,
                rationale="Deviation from expected customer profile is a primary ML indicator.",
                mitigation_examples=["Customer baseline profiling at onboarding", "Alert on significant deviation from expected activity"],
            ),
            LibraryFactor(
                ref="REG-001", category_type="regulatory",
                name="AML/CTF program maintenance",
                description="Risk of AML/CTF program becoming outdated or non-compliant with current obligations.",
                suggested_likelihood=2, suggested_consequence=3,
                rationale="Outdated programs fail to address current risks and AUSTRAC expectations.",
                mitigation_examples=["Annual program review", "Regulatory change monitoring process"],
            ),
        ],
    )
