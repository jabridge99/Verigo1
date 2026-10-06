"""
Conveyancers risk library — derived from the Organisation's real ISO 31000-style
EWRA (VERIGO_CONVEYANCER_Risk_Matrix_v1.xlsx). Category weights reflect that
matrix's own inherent-risk emphasis: PR-01 (third-party settlement funds) is
the single highest-scoring risk in the whole matrix (25/25, CRITICAL), so
"transaction" (which carries the trust-account-specific risks) and "customer"
are weighted highest.

The 7-category RiskCategoryType schema doesn't have dedicated slots for the
real matrix's "Employee/Internal Risk" or "Sanctions/PEP Risk" categories
(a known base-schema limitation, not something to force-fit — see
PARKING_LOT.md P18/P23) — those risks are folded into the closest available
category ("service" and "regulatory" respectively) rather than invented.
"""

from app.templates.risk.base import LibraryFactor, RiskLibrary


def get_library() -> RiskLibrary:
    return RiskLibrary(
        industry="conveyancers",
        description=(
            "Conveyancers — Tranche 2 (commencing 1 July 2026 anticipated). "
            "Trust account and e-conveyancing settlement platform (PEXA/Sympli) "
            "are the sector's primary ML risk vehicles. No IFTI obligation."
        ),
        category_weights={
            "customer": 0.25,
            "product": 0.15,
            "service": 0.07,
            "geographic": 0.10,
            "channel": 0.08,
            "transaction": 0.25,
            "regulatory": 0.10,
        },
        factors=[
            LibraryFactor(
                ref="CUST-001",
                category_type="customer",
                name="Source of settlement funds unknown or undisclosed",
                description=(
                    "Purchaser unable or unwilling to explain the origin of "
                    "settlement funds."
                ),
                suggested_likelihood=4,
                suggested_consequence=5,
                rationale=(
                    "AUSTRAC Conveyancing FCG Typology #1 for the customer "
                    "dimension — funds may originate from drug trafficking, "
                    "fraud, or tax evasion; the most common ML vector in "
                    "Australian conveyancing."
                ),
                mitigation_examples=[
                    "Mandatory source-of-funds declaration before accepting instructions",
                    "Bank statements (min. 3 months) for all purchaser clients",
                    "Source-of-wealth documentation for transactions > AUD $1M",
                    "ECDD and Director approval where source cannot be explained",
                ],
            ),
            LibraryFactor(
                ref="CUST-002",
                category_type="customer",
                name="Foreign purchaser — high-risk or FATF grey/black-list jurisdiction",
                description=(
                    "Cross-border purchase funded from a jurisdiction with "
                    "strategic AML/CTF deficiencies."
                ),
                suggested_likelihood=4,
                suggested_consequence=5,
                rationale=(
                    "FATF PML 2018: cross-border property purchases are a "
                    "known method for exporting criminal proceeds."
                ),
                mitigation_examples=[
                    "ECDD mandatory for all foreign purchasers",
                    "Certified, translated overseas bank statements",
                    "FIRB approval status verified and filed",
                    "Director approval for grey/black-list jurisdiction purchasers",
                ],
            ),
            LibraryFactor(
                ref="CUST-003",
                category_type="customer",
                name="PEP as purchaser, vendor, or beneficial owner",
                description=(
                    "Politically exposed person, or close associate/family "
                    "member, involved in the transaction."
                ),
                suggested_likelihood=3,
                suggested_consequence=5,
                rationale=(
                    "PEPs may use property transactions to integrate proceeds "
                    "of corruption or bribery; foreign PEPs present the "
                    "highest risk."
                ),
                mitigation_examples=[
                    "PEP screening at onboarding via commercial database and media search",
                    "Mandatory ECDD, source of wealth/funds documented",
                    "Board/Director approval for foreign PEPs",
                ],
            ),
            LibraryFactor(
                ref="CUST-004",
                category_type="customer",
                name="Complex or opaque beneficial ownership structure",
                description=(
                    "Company or trust purchaser with layered corporate "
                    "structures obscuring the ultimate beneficial owner."
                ),
                suggested_likelihood=4,
                suggested_consequence=4,
                rationale=(
                    "Particularly prevalent in commercial and high-value "
                    "residential settlements; a documented FATF DNFBP "
                    "typology."
                ),
                mitigation_examples=[
                    "Beneficial ownership chart mandatory for 3+ entity layers",
                    "CDD on each identified beneficial owner",
                    "Director approval for complex structures",
                ],
            ),
            LibraryFactor(
                ref="CUST-005",
                category_type="customer",
                name="Nominee purchaser or bare trust — undisclosed principal",
                description=(
                    "Named purchaser acts as a 'front' for an undisclosed principal."
                ),
                suggested_likelihood=3,
                suggested_consequence=5,
                rationale=(
                    "AUSTRAC Conveyancing FCG: nominee arrangements conceal "
                    "the true party's identity and source of funds."
                ),
                mitigation_examples=[
                    "Identify and CDD both the nominee and the principal",
                    "Written authority from the principal on file",
                    "Assess legitimate rationale vs. concealment",
                ],
            ),
            LibraryFactor(
                ref="TXN-001",
                category_type="transaction",
                name="Third-party settlement funds — payer not a party to the contract",
                description=(
                    "Trust account receipt from a person not named in the "
                    "contract of sale."
                ),
                suggested_likelihood=5,
                suggested_consequence=5,
                rationale=(
                    "AUSTRAC Conveyancing FCG Typology #1, ranked #1 in "
                    "Australian STR data for this sector — the highest-"
                    "scoring inherent risk in the matrix."
                ),
                mitigation_examples=[
                    "Full CDD on the third-party payer as if they were the client",
                    "Written explanation obtained from the purchaser",
                    "Compliance Officer sign-off before funds are released",
                    "SMR consideration mandatory where source is unexplained",
                ],
            ),
            LibraryFactor(
                ref="TXN-002",
                category_type="transaction",
                name="Trust account overpayment and refund requests",
                description=(
                    "Funds deposited in excess of the settlement amount, "
                    "followed by a request to refund the excess."
                ),
                suggested_likelihood=3,
                suggested_consequence=4,
                rationale=(
                    "AUSTRAC Conveyancing FCG Typology #2 — trust accounts "
                    "used to layer proceeds by creating a clean financial "
                    "record via a refund cheque."
                ),
                mitigation_examples=[
                    "Flag any overpayment immediately to the Compliance Officer",
                    "ECDD + Director approval before any refund is processed",
                    "Written client authority required for all disbursements",
                ],
            ),
            LibraryFactor(
                ref="TXN-003",
                category_type="transaction",
                name="Last-minute settlement account change",
                description=(
                    "Disbursement account details changed shortly before settlement."
                ),
                suggested_likelihood=4,
                suggested_consequence=4,
                rationale=(
                    "AUSTRAC Conveyancing FCG Typology #3 (ranked #3) — used "
                    "both for money laundering and for conveyancing "
                    "payment-diversion fraud/scams."
                ),
                mitigation_examples=[
                    "Out-of-band phone verification to a known, independently sourced number",
                    "Director approval for changes within 48 hours of settlement",
                    "Treat all last-minute account changes as suspicious pending verification",
                ],
            ),
            LibraryFactor(
                ref="TXN-004",
                category_type="transaction",
                name="Multi-tranche trust account receipts",
                description=(
                    "A single settlement funded through three or more "
                    "separate trust account receipts."
                ),
                suggested_likelihood=3,
                suggested_consequence=3,
                rationale=(
                    "Structuring and layering indicator — multiple sources "
                    "for one settlement warrants scrutiny of each remitting "
                    "party."
                ),
                mitigation_examples=[
                    "Identify and verify each remitting party separately",
                    "Assess plausible legitimate explanation for tranches",
                    "ECDD if the pattern cannot be adequately explained",
                ],
            ),
            LibraryFactor(
                ref="PROD-001",
                category_type="product",
                name="Off-the-plan contract assignment",
                description=(
                    "Rapid transfer of a pre-settlement contract, often at a "
                    "significant price variation."
                ),
                suggested_likelihood=3,
                suggested_consequence=4,
                rationale=(
                    "Assignment before settlement is used to layer funds — "
                    "the assignor profits from a price uplift or absorbs a "
                    "loss to generate a clean transaction record."
                ),
                mitigation_examples=[
                    "CDD on both the original purchaser and the assignee",
                    "Monitor for reassignment within 90 days of purchase",
                    "Director notification for all contract assignments",
                ],
            ),
            LibraryFactor(
                ref="PROD-002",
                category_type="product",
                name="Subdivision / development settlement — multiple lots",
                description=(
                    "Complex multi-party, high-value settlements with "
                    "layered financing."
                ),
                suggested_likelihood=3,
                suggested_consequence=4,
                rationale=(
                    "Increased ML exposure relative to standard residential "
                    "settlements; common beneficial ownership across lots is "
                    "a structuring indicator."
                ),
                mitigation_examples=[
                    "ECDD for all subdivision/development clients",
                    "Monitor for common beneficial ownership across lot purchases",
                    "Director notification for projects > 10 lots or > AUD $5M",
                ],
            ),
            LibraryFactor(
                ref="GEO-001",
                category_type="geographic",
                name="Settlement funds from FATF grey/black-list jurisdictions",
                description=(
                    "Funds originating from a jurisdiction with strategic "
                    "AML/CTF deficiencies."
                ),
                suggested_likelihood=3,
                suggested_consequence=5,
                rationale=(
                    "FATF Jurisdictions under Increased Monitoring — funds "
                    "from these jurisdictions present materially elevated "
                    "ML/TF/PF risk."
                ),
                mitigation_examples=[
                    "Monthly review of the FATF grey/black list",
                    "Certified banking documentation from the originating jurisdiction",
                    "Director approval mandatory; decline if documentation inadequate",
                ],
            ),
            LibraryFactor(
                ref="GEO-002",
                category_type="geographic",
                name="FIRB non-disclosure — concealed foreign investment",
                description=(
                    "Nominee or Australian-citizen-front arrangements used "
                    "to circumvent FIRB approval requirements."
                ),
                suggested_likelihood=3,
                suggested_consequence=4,
                rationale=(
                    "AUSTRAC/ATO joint guidance identifies FIRB evasion as a "
                    "recurring typology involving concealed true foreign "
                    "ownership of Australian property."
                ),
                mitigation_examples=[
                    "FIRB status assessed for all purchasers with foreign indicators",
                    "FIRB approval copy obtained and filed before settlement",
                    "ATO referral for suspected FIRB evasion",
                ],
            ),
            LibraryFactor(
                ref="CHAN-001",
                category_type="channel",
                name="Remote / digital onboarding without in-person verification",
                description=(
                    "Non-face-to-face onboarding for high-value or "
                    "high-risk settlements."
                ),
                suggested_likelihood=3,
                suggested_consequence=4,
                rationale=(
                    "AUSTRAC Digital Identity Guidance: non-face-to-face "
                    "onboarding increases identity-fraud and impersonation "
                    "risk."
                ),
                mitigation_examples=[
                    "Electronic verification mandatory for all remote clients",
                    "Liveness check for high-value or high-risk remote clients",
                    "Video-call verification for ECDD cases",
                ],
            ),
            LibraryFactor(
                ref="CHAN-002",
                category_type="channel",
                name="PEXA / Sympli e-conveyancing platform controls",
                description=(
                    "Digital settlement workspace account compromise or "
                    "last-minute manipulation."
                ),
                suggested_likelihood=3,
                suggested_consequence=3,
                rationale=(
                    "ARNECC Model Participation Rules: e-conveyancing "
                    "improves some controls but introduces platform-specific "
                    "fraud risk (account compromise, workspace manipulation)."
                ),
                mitigation_examples=[
                    "Settlement workspace reconciled to client authority before settlement day",
                    "Multi-factor authentication mandatory for all staff platform accounts",
                    "Staff trained on platform-specific fraud typologies",
                ],
            ),
            LibraryFactor(
                ref="SVC-001",
                category_type="service",
                name="Inconsistent CDD application by settlement staff",
                description=(
                    "Frontline settlement clerks skipping CDD steps under "
                    "time pressure."
                ),
                suggested_likelihood=3,
                suggested_consequence=4,
                rationale=(
                    "Systemic CDD failures by frontline staff undermine even "
                    "well-designed policy — a recurring theme in AUSTRAC "
                    "enforcement actions across regulated sectors."
                ),
                mitigation_examples=[
                    "Mandatory CDD checklist for every new engagement",
                    "Quarterly file audits (minimum 10% of transactions)",
                    "Non-completion escalated to the Principal within 2 business days",
                ],
            ),
            LibraryFactor(
                ref="REG-001",
                category_type="regulatory",
                name="SMR failure — suspicious matter not reported or reported late",
                description=(
                    "Failure to lodge, or late lodgement of, a Suspicious "
                    "Matter Report."
                ),
                suggested_likelihood=3,
                suggested_consequence=5,
                rationale=(
                    "AUSTRAC's most heavily penalised AML/CTF breach "
                    "(Westpac $1.3B, CBA $700M — analogous enforcement "
                    "history); conveyancers have historically had very low "
                    "SMR submission rates, an under-reporting red flag."
                ),
                mitigation_examples=[
                    "Documented SMR decision within 24 hours of every escalated suspicion",
                    "Quarterly Director review of the SMR decision log",
                    "Annual external compliance review of SMR adequacy",
                ],
            ),
            LibraryFactor(
                ref="REG-002",
                category_type="regulatory",
                name="Tranche 2 readiness — program not current for 1 July 2026",
                description=(
                    "AML/CTF Program not yet reflecting Tranche 2 "
                    "obligations, or not updated after a regulatory change."
                ),
                suggested_likelihood=2,
                suggested_consequence=4,
                rationale=(
                    "Conveyancers are newly regulated from 1 July 2026 "
                    "(anticipated) — programs must be adopted, implemented, "
                    "and independently reviewed before that date."
                ),
                mitigation_examples=[
                    "Annual independent review of the AML/CTF Program",
                    "Tranche 2 readiness assessment completed before 1 July 2026",
                    "Compliance calendar tracking regulatory deadlines",
                ],
            ),
        ],
    )
