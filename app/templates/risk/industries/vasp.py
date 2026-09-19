"""
VASP risk library — derived from the Organisation's real ISO 31000:2018 EWRA
(VERIGO_VASP_Risk_Matrix_v1.xlsx), a 16-row inherent/residual register.
`ref` values match the real matrix's own IDs (CR-*, PR-*, GR-*, SP-*, ER-*,
PC-*) rather than an independently invented scheme.

The real matrix uses 6 top-level categories — Customer Risk, Product/Service
Risk, Geographic Risk, Sanctions/PEP Risk, Employee/Internal Risk,
Program/Compliance Risk — which don't map 1:1 onto the 7-category
RiskCategoryType schema (no dedicated "Sanctions/PEP", "Employee/Internal" or
"Program/Compliance" slot; see PARKING_LOT.md P17/P18/P23). Per the precedent
set for Conveyancers and Remittance, unsupported categories are folded into
the closest existing category rather than force-fitting new enum values:
  - Sanctions/PEP Risk (SP-*)        -> regulatory
  - Employee/Internal Risk (ER-*)    -> service (same fold as Conveyancers)
  - Program/Compliance Risk (PC-*)   -> regulatory
  - Travel Rule failure (PR-05), a reporting-obligation risk rather than a
    product-feature risk -> transaction, matching this session's convention
    (Remittance's IFTI-DRA failures are scored the same way)

PR-01 (mixing/tumbling/privacy coins, 25/25) is the single highest inherent
score in the whole matrix and is FATF's own "highest risk VA typology" — it
is weighted and rationale'd accordingly, not treated as one factor among many.
"""

from app.templates.risk.base import LibraryFactor, RiskLibrary


def get_library() -> RiskLibrary:
    return RiskLibrary(
        industry="vasp",
        description=(
            "Virtual Asset Service Provider (VASP) / Cryptocurrency exchange — "
            "Tranche 1. Mixing/tumbling exposure (PR-01) is the sector's highest "
            "inherent risk (25/25) and FATF's own highest-priority VA typology; "
            "Travel Rule compliance (PR-05, 20/25) is the other CRITICAL risk."
        ),
        category_weights={
            "customer": 0.22,
            "product": 0.20,
            "service": 0.08,
            "geographic": 0.13,
            "channel": 0.07,
            "transaction": 0.20,
            "regulatory": 0.10,
        },
        factors=[
            LibraryFactor(
                ref="PR-01",
                category_type="product",
                name="Mixing, tumbling, or privacy-enhancing service usage",
                description=(
                    "Virtual assets processed through a mixing/tumbling service "
                    "(e.g. Tornado Cash) or privacy coins (Monero, Zcash) used "
                    "with no apparent legitimate purpose."
                ),
                suggested_likelihood=5,
                suggested_consequence=5,
                rationale=(
                    "FATF's own guidance names this the HIGHEST-RISK VA typology. "
                    "The single highest inherent score in the whole Risk Matrix "
                    "(25/25, CRITICAL) — deliberately obscures the blockchain "
                    "trail, making the source of funds untraceable."
                ),
                mitigation_examples=[
                    "Blockchain analytics screening mandatory on every transaction",
                    "Positive mixing indicator: immediate transaction halt and CO review",
                    "SMR mandatory on any confirmed mixing/tumbling exposure",
                    "Privacy coin transactions: ECDD mandatory, Director approval before processing",
                ],
            ),
            LibraryFactor(
                ref="PR-05",
                category_type="transaction",
                name="Travel Rule — failure to obtain or transmit required information",
                description=(
                    "Failure to collect, verify, or transmit originator/"
                    "beneficiary information with a virtual asset transfer as "
                    "required by AML/CTF Rules 2025 s.23."
                ),
                suggested_likelihood=4,
                suggested_consequence=5,
                rationale=(
                    "Risk Matrix PR-05 — CRITICAL inherent rating (20/25), tied "
                    "for the sector's most severe risk alongside mixing/"
                    "tumbling. No minimum threshold applies under Australian law."
                ),
                mitigation_examples=[
                    "Travel Rule compliance procedures documented and staff trained",
                    "Weekly CO review of Travel Rule data completeness",
                    "Exception log maintained for every instance of incomplete data",
                    "Director notification for any systemic Travel Rule gap",
                ],
                is_tranche1_only=True,
            ),
            LibraryFactor(
                ref="CR-01",
                category_type="customer",
                name="Anonymous or pseudonymous onboarding",
                description=(
                    "Customer creates an account with limited identity "
                    "information and conducts significant transactions before "
                    "CDD is completed."
                ),
                suggested_likelihood=4,
                suggested_consequence=5,
                rationale=(
                    "FATF VA Guidance 2021 names pseudonymous onboarding the "
                    "primary ML risk for VASPs. Risk Matrix CR-01 — CRITICAL "
                    "inherent rating (20/25)."
                ),
                mitigation_examples=[
                    "CDD mandatory before any designated service is provided",
                    "eKYC mandatory for all digital onboarding",
                    "Liveness check for medium/high-risk customers",
                    "CO approval before high-risk customer accounts are activated",
                ],
            ),
            LibraryFactor(
                ref="PR-02",
                category_type="product",
                name="Unhosted (self-custodied) wallet transactions",
                description=(
                    "Transfer to or from a wallet where private keys are held "
                    "directly by the customer, not a third-party custodian."
                ),
                suggested_likelihood=4,
                suggested_consequence=4,
                rationale=(
                    "The wallet controller's identity cannot be verified "
                    "through a custodian. Risk Matrix PR-02 — HIGH inherent "
                    "rating (16/25)."
                ),
                mitigation_examples=[
                    "Risk-based unhosted wallet policy with defined thresholds",
                    "Wallet ownership verification (signed message or equivalent) above threshold",
                    "ECDD plus blockchain analytics for high-risk or high-value transfers",
                    "Director approval for very high-value unhosted transfers",
                ],
            ),
            LibraryFactor(
                ref="CR-04",
                category_type="customer",
                name="Complex or offshore company/trust customer",
                description=(
                    "Corporate or trust customer using multiple entity layers "
                    "and VA transfers to obscure beneficial ownership."
                ),
                suggested_likelihood=4,
                suggested_consequence=4,
                rationale="Risk Matrix CR-04 — HIGH inherent rating (16/25).",
                mitigation_examples=[
                    "Entity KYC and beneficial ownership identification at 25% threshold",
                    "ECDD for offshore or nominee-controlled entities",
                    "CO approval before account activation; annual OCDD",
                ],
            ),
            LibraryFactor(
                ref="CR-02",
                category_type="customer",
                name="Politically Exposed Person using VASP services",
                description=(
                    "PEP, or close associate/family member, converting or "
                    "transferring funds via virtual assets."
                ),
                suggested_likelihood=3,
                suggested_consequence=5,
                rationale="Risk Matrix CR-02 — HIGH inherent rating (15/25).",
                mitigation_examples=[
                    "PEP screening at onboarding via commercial database",
                    "ECDD mandatory; source of wealth and funds documented",
                    "Board/Director approval for foreign PEPs before account activation",
                ],
            ),
            LibraryFactor(
                ref="CR-03",
                category_type="customer",
                name="Customer from FATF grey/black-list jurisdiction",
                description=(
                    "Customer resident in, or transacting from, a jurisdiction "
                    "with strategic AML/CTF deficiencies."
                ),
                suggested_likelihood=3,
                suggested_consequence=5,
                rationale="Risk Matrix CR-03 — HIGH inherent rating (15/25).",
                mitigation_examples=[
                    "FATF list reviewed monthly",
                    "ECDD mandatory; certified documentation required",
                    "Director approval; decline considered for black-list jurisdictions",
                ],
            ),
            LibraryFactor(
                ref="GR-01",
                category_type="geographic",
                name="VA transfers to/from FATF grey/black-list jurisdictions",
                description=(
                    "Transfer corridor terminating in a jurisdiction with "
                    "inadequate AML/CTF frameworks, frequently exploited via "
                    "unregulated exchanges."
                ),
                suggested_likelihood=3,
                suggested_consequence=5,
                rationale="Risk Matrix GR-01 — HIGH inherent rating (15/25).",
                mitigation_examples=[
                    "Enhanced monitoring plus ECDD for grey/black-list transfers",
                    "Director approval mandatory; decline considered for black-list",
                ],
            ),
            LibraryFactor(
                ref="PR-03",
                category_type="product",
                name="DeFi protocol exposure",
                description=(
                    "Customer virtual assets interact with a decentralised "
                    "finance protocol with no AML/CTF controls."
                ),
                suggested_likelihood=3,
                suggested_consequence=4,
                rationale="Risk Matrix PR-03 — HIGH inherent rating (12/25).",
                mitigation_examples=[
                    "DeFi exposure assessment during blockchain analytics screening",
                    "CO review before processing transactions with significant DeFi exposure",
                    "ECDD for customers with known high-risk DeFi activity",
                ],
            ),
            LibraryFactor(
                ref="PR-04",
                category_type="product",
                name="Stablecoin mass value transfer",
                description=(
                    "Stability and interoperability of stablecoins enable rapid "
                    "mass value transfer across jurisdictions at scale."
                ),
                suggested_likelihood=3,
                suggested_consequence=4,
                rationale="Risk Matrix PR-04 — HIGH inherent rating (12/25).",
                mitigation_examples=[
                    "Enhanced monitoring thresholds for stablecoin transfers",
                    "Source of funds assessed for high-value stablecoin purchases",
                    "CO review for stablecoin transfers to/from high-risk jurisdictions",
                ],
            ),
            LibraryFactor(
                ref="CR-05",
                category_type="customer",
                name="Other VASP (B2B) counterparty due diligence",
                description=(
                    "Transfer to or from another VASP without adequate due "
                    "diligence on that counterpart's AML/CTF framework."
                ),
                suggested_likelihood=3,
                suggested_consequence=4,
                rationale="Risk Matrix CR-05 — HIGH inherent rating (12/25).",
                mitigation_examples=[
                    "Verify counterpart VASP registration/licensing in home jurisdiction",
                    "Assess counterpart AML/CTF framework and jurisdiction risk",
                    "Decline transfers involving non-compliant VASPs",
                ],
            ),
            LibraryFactor(
                ref="PC-01",
                category_type="regulatory",
                name="Travel Rule non-compliance — systemic failure",
                description=(
                    "Program-level breakdown in Travel Rule data collection, "
                    "verification, or transmission (not an isolated instance)."
                ),
                suggested_likelihood=3,
                suggested_consequence=4,
                rationale=(
                    "Risk Matrix Program/Compliance Risk category, PC-01 — HIGH "
                    "inherent rating (12/25). Folded into 'regulatory' (see "
                    "module docstring)."
                ),
                mitigation_examples=[
                    "Weekly CO review of Travel Rule data completeness",
                    "Annual external compliance review includes Travel Rule assessment",
                ],
                is_tranche1_only=True,
            ),
            LibraryFactor(
                ref="SP-01",
                category_type="regulatory",
                name="Transaction involving a sanctioned address, person, or entity",
                description=(
                    "Customer, counterparty, or wallet address matched against "
                    "a sanctions list."
                ),
                suggested_likelihood=2,
                suggested_consequence=5,
                rationale=(
                    "Risk Matrix Sanctions/PEP Risk category, SP-01 — MEDIUM "
                    "inherent rating (10/25). Folded into 'regulatory' — the "
                    "7-category schema has no dedicated Sanctions/PEP slot."
                ),
                mitigation_examples=[
                    "DFAT, UN, and blockchain analytics screening on every transaction",
                    "Live lists only — no cached copies",
                    "Confirmed match: immediate cessation, AFP within 24 hours, SMR within 24 hours",
                ],
            ),
            LibraryFactor(
                ref="ER-01",
                category_type="service",
                name="Staff facilitating anonymous accounts or ignoring blockchain alerts",
                description=(
                    "Internal compliance failure — staff approving high-risk "
                    "accounts without CDD, or overriding blockchain analytics "
                    "alerts without authority."
                ),
                suggested_likelihood=2,
                suggested_consequence=5,
                rationale=(
                    "Risk Matrix Employee/Internal Risk category, ER-01 — "
                    "MEDIUM inherent rating (10/25). Folded into 'service' — "
                    "the same fold used for Conveyancers' Employee/Internal "
                    "Risk (see PARKING_LOT.md P19)."
                ),
                mitigation_examples=[
                    "Dual authorisation for high-risk account approvals",
                    "Blockchain analytics alerts cannot be overridden without CO approval",
                    "Quarterly compliance culture reviews; whistleblower policy",
                ],
            ),
            LibraryFactor(
                ref="PC-02",
                category_type="regulatory",
                name="AML/CTF Program not reflecting 2024 Amendment Act updates",
                description=(
                    "Program not updated for the new virtual asset definition, "
                    "Travel Rule, proliferation financing risk, or consolidated "
                    "program requirements effective 31 March 2026."
                ),
                suggested_likelihood=2,
                suggested_consequence=4,
                rationale=(
                    "Risk Matrix Program/Compliance Risk category, PC-02 — "
                    "MEDIUM inherent rating (8/25)."
                ),
                mitigation_examples=[
                    "Annual independent review",
                    "Program updated within 30 days of material regulatory change",
                    "Compliance calendar tracking all AML/CTF deadlines",
                ],
            ),
            LibraryFactor(
                ref="GR-02",
                category_type="geographic",
                name="Proliferation financing — VA transfers to PF-sanctioned parties",
                description=(
                    "Virtual asset transfer connected to a state subject to "
                    "PF-related sanctions (DPRK, Iran)."
                ),
                suggested_likelihood=1,
                suggested_consequence=5,
                rationale=(
                    "Risk Matrix GR-02 — LOW inherent rating on likelihood "
                    "(5/25) but with an immediate, mandatory escalation path "
                    "regardless of score: DPRK's Lazarus Group uses VASPs as a "
                    "primary WMD-funding channel."
                ),
                mitigation_examples=[
                    "DPRK/Iran-connected wallets or counterparties prohibited outright",
                    "PF sanctions screening (UN Security Council PF lists) for all customers",
                    "Immediate cessation, mandatory AFP referral, SMR within 24 hours",
                ],
            ),
            LibraryFactor(
                ref="CHAN-001",
                category_type="channel",
                name="Fully digital / API / mobile-only onboarding",
                description=(
                    "Non-face-to-face customer onboarding conducted entirely "
                    "via eKYC, API, or mobile application."
                ),
                suggested_likelihood=3,
                suggested_consequence=3,
                rationale=(
                    "The Organisation's only onboarding channel (KYC Guideline "
                    "Part I §26.1) — increases identity-fraud and synthetic-"
                    "identity risk relative to in-person onboarding."
                ),
                mitigation_examples=[
                    "eKYC mandatory via an approved provider",
                    "Liveness check for medium/high-risk customers",
                    "Enhanced eKYC plus video-call verification for high-value customers",
                ],
            ),
            LibraryFactor(
                ref="CHAN-002",
                category_type="channel",
                name="Peer-to-peer (P2P) trading",
                description=(
                    "Platform facilitates direct user-to-user virtual asset "
                    "trades without exchange intermediation."
                ),
                suggested_likelihood=3,
                suggested_consequence=3,
                rationale="P2P trading bypasses centrally controlled transaction monitoring.",
                mitigation_examples=[
                    "Mandatory KYC on both sides of a P2P trade",
                    "Escrow controls with AML checks before release",
                ],
            ),
        ],
    )
