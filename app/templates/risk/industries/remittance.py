"""
Remittance risk library — derived from the Organisation's real ISO 31000:2018
EWRA (VERIGO_REMITTANCE_Risk_Matrix_v1.xlsx), a 15-row inherent/residual
register. `ref` values match the real matrix's own IDs (CR-*, PR-*, GR-*,
SP-*, PC-*) rather than an independently invented scheme, so a factor here
can be traced directly back to its source row.

The real matrix uses 5 top-level categories — Customer Risk, Product/Service
Risk, Geographic Risk, Sanctions/PEP Risk, Program/Compliance Risk — which
don't map 1:1 onto the 7-category RiskCategoryType schema (no dedicated
"Sanctions/PEP" or "Program/Compliance" slot; see PARKING_LOT.md P17/P23).
Per the precedent set for Conveyancers, unsupported categories are folded
into the closest existing category rather than force-fitting new enum
values:
  - Sanctions/PEP Risk (SP-*)      -> regulatory
  - Program/Compliance Risk (PC-*) -> regulatory
  - Product/Service items describing IFTI-DRA/structuring behaviour
    (transactional in nature) -> transaction, matching this library's own
    existing convention of scoring IFTI/structuring risk under "transaction"
  - Product/Service items describing route/product characteristics
    (corridor choice, purpose declaration) -> product

CR-02 (third-party sender) is the ONLY CRITICAL-rated inherent risk in the
whole matrix (25/25) and AUSTRAC's #1-ranked STR typology for this sector —
it is weighted and rationale'd accordingly, not treated as one factor among
many.
"""

from app.templates.risk.base import LibraryFactor, RiskLibrary


def get_library() -> RiskLibrary:
    return RiskLibrary(
        industry="remittance",
        description=(
            "International remittance / money transfer — Tranche 1 IFTI-DRA "
            "reporting entity. Third-party sender detection (CR-02) is the "
            "sector's only CRITICAL inherent risk and AUSTRAC's #1-ranked STR "
            "typology; IFTI-DRA reporting is the primary Tranche 1 obligation."
        ),
        category_weights={
            "customer": 0.22,
            "product": 0.13,
            "service": 0.08,
            "geographic": 0.15,
            "channel": 0.10,
            "transaction": 0.22,
            "regulatory": 0.10,
        },
        factors=[
            LibraryFactor(
                ref="CR-02",
                category_type="customer",
                name="Third-party sender — funds not from the account holder",
                description=(
                    "Remittance instruction funded or given by a person who is "
                    "not the named transferor, with no adequate explanation "
                    "for the arrangement."
                ),
                suggested_likelihood=5,
                suggested_consequence=5,
                rationale=(
                    "AUSTRAC's #1-ranked STR typology for the remittance "
                    "sector and the Organisation's ONLY inherent CRITICAL "
                    "risk (25/25) — the single highest-scoring row in the "
                    "Risk Matrix."
                ),
                mitigation_examples=[
                    "Full CDD on the actual funding party, not just the named customer",
                    "Written explanation of the third-party arrangement obtained and filed",
                    "Compliance Officer sign-off required before completing the remittance",
                    "Mandatory SMR consideration regardless of the outcome",
                    "Director approval to proceed where the source cannot be explained",
                ],
            ),
            LibraryFactor(
                ref="CR-01",
                category_type="customer",
                name="Sender purpose unknown or inconsistent with profile",
                description=(
                    "Individual sender unable or unwilling to explain the "
                    "purpose of the transfer, or purpose is inconsistent with "
                    "their known profile."
                ),
                suggested_likelihood=4,
                suggested_consequence=4,
                rationale="Risk Matrix CR-01 — HIGH inherent rating (16/25).",
                mitigation_examples=[
                    "Purpose of transfer captured and assessed at every instruction",
                    "Follow-up required where purpose is vague or inconsistent",
                    "Escalation to Compliance Officer where explanation is inadequate",
                ],
            ),
            LibraryFactor(
                ref="CR-03",
                category_type="customer",
                name="Politically Exposed Person as sender or beneficiary",
                description=(
                    "Domestic or foreign PEP, or a close associate/family "
                    "member, as transferor or beneficiary."
                ),
                suggested_likelihood=3,
                suggested_consequence=5,
                rationale="Risk Matrix CR-03 — HIGH inherent rating (15/25).",
                mitigation_examples=[
                    "PEP screening at onboarding and on an ongoing basis",
                    "Board/Director approval mandatory before proceeding for foreign PEPs",
                    "Quarterly OCDD review frequency for PEP-Foreign relationships",
                ],
            ),
            LibraryFactor(
                ref="CR-04",
                category_type="customer",
                name="Customer linked to FATF grey/black-list jurisdiction",
                description=(
                    "Customer resident in, or regularly transacting with, a "
                    "jurisdiction with strategic AML/CTF deficiencies."
                ),
                suggested_likelihood=3,
                suggested_consequence=5,
                rationale="Risk Matrix CR-04 — HIGH inherent rating (15/25).",
                mitigation_examples=[
                    "Quarterly review of the approved country list against FATF/DFAT updates",
                    "ECDD required for grey/black-list-linked customers",
                    "Director approval before any black-list-linked relationship proceeds",
                ],
            ),
            LibraryFactor(
                ref="CR-05",
                category_type="customer",
                name="Non-individual (company/trust) remittance customer",
                description=(
                    "Company or trust customer sending or receiving a "
                    "remittance rather than an individual."
                ),
                suggested_likelihood=3,
                suggested_consequence=4,
                rationale="Risk Matrix CR-05 — HIGH inherent rating (12/25).",
                mitigation_examples=[
                    "Full company/trust CDD and beneficial ownership tracing to 25%+ threshold",
                    "Enhanced scrutiny of stated business purpose for the remittance",
                ],
            ),
            LibraryFactor(
                ref="PR-05",
                category_type="product",
                name="False or vague purpose declaration",
                description=(
                    "Purpose recorded as vague or generic (e.g. 'gift', "
                    "'family support') for a material-value transfer with no "
                    "supporting detail."
                ),
                suggested_likelihood=3,
                suggested_consequence=4,
                rationale=(
                    "AUSTRAC's #2-ranked STR typology for this sector. Risk "
                    "Matrix PR-05 — HIGH inherent rating (12/25)."
                ),
                mitigation_examples=[
                    "TMP rule REM-08: manual review of vague purpose above AUD $5,000",
                    "Additional supporting documentation requested where purpose is unclear",
                    "SMR consideration mandatory where purpose remains unresolved",
                ],
            ),
            LibraryFactor(
                ref="PR-04",
                category_type="product",
                name="High-risk corridor — drug trafficking / TF-linked destination",
                description=(
                    "Remittance corridor with a known association to drug "
                    "trafficking or terrorism financing networks."
                ),
                suggested_likelihood=3,
                suggested_consequence=4,
                rationale="Risk Matrix PR-04 — HIGH inherent rating (12/25).",
                mitigation_examples=[
                    "Corridor risk assessed at KYC and re-assessed at each transaction",
                    "TMP rule REM-05 (grey-list) / REM-06 (black-list, CO+Director)",
                ],
            ),
            LibraryFactor(
                ref="PR-01",
                category_type="transaction",
                name="IFTI-DRA reporting non-compliance",
                description=(
                    "Failure to lodge an IFTI-DRA report for a cross-border "
                    "instruction within the mandatory 10-business-day deadline."
                ),
                suggested_likelihood=3,
                suggested_consequence=5,
                rationale=(
                    "Primary Tranche 1 obligation for this sector. Risk Matrix "
                    "PR-01 — HIGH inherent rating (15/25)."
                ),
                mitigation_examples=[
                    "TMP rule REM-02: Day-8 deadline-approaching alert, checked daily",
                    "IFTI-DRA Submission Checklist completed for every instruction",
                    "Compliance Officer tracks every instruction against its deadline",
                ],
                is_tranche1_only=True,
            ),
            LibraryFactor(
                ref="PR-02",
                category_type="transaction",
                name="IFTI-DRA data quality failure",
                description=(
                    "Missing or incorrect mandatory fields (including Travel "
                    "Rule payer/payee data) in a submitted or pending IFTI-DRA."
                ),
                suggested_likelihood=3,
                suggested_consequence=4,
                rationale="Risk Matrix PR-02 — HIGH inherent rating (12/25).",
                mitigation_examples=[
                    "TMP rule REM-03: per-instruction data quality check before submission",
                    "Travel Rule data collection mandatory at KYC",
                ],
                is_tranche1_only=True,
            ),
            LibraryFactor(
                ref="PR-03",
                category_type="transaction",
                name="Structuring to avoid IFTI-DRA or TTR reporting",
                description=(
                    "Multiple related transfers structured to appear as "
                    "separate instructions and avoid reporting thresholds or "
                    "obligations."
                ),
                suggested_likelihood=4,
                suggested_consequence=4,
                rationale="Risk Matrix PR-03 — HIGH inherent rating (16/25).",
                mitigation_examples=[
                    "TMP rule REM-04: daily review of near-threshold multiple transfers",
                    "Related transfers assessed as a single IFTI-DRA where applicable",
                ],
            ),
            LibraryFactor(
                ref="GR-01",
                category_type="geographic",
                name="FATF grey/black-list corridor",
                description=(
                    "Remittance corridor terminating in a FATF grey- or "
                    "black-list jurisdiction."
                ),
                suggested_likelihood=3,
                suggested_consequence=5,
                rationale="Risk Matrix GR-01 — HIGH inherent rating (15/25).",
                mitigation_examples=[
                    "Quarterly corridor list review against FATF and DFAT updates",
                    "Director approval mandatory for black-list corridor transactions",
                ],
            ),
            LibraryFactor(
                ref="GR-02",
                category_type="geographic",
                name="Proliferation financing corridor (DPRK / Iran)",
                description=(
                    "Transfer routed to, from, or through a jurisdiction or "
                    "entity connected to weapons proliferation financing."
                ),
                suggested_likelihood=2,
                suggested_consequence=5,
                rationale=(
                    "Risk Matrix GR-02 — MEDIUM inherent rating (10/25) but "
                    "with an immediate, mandatory escalation path regardless "
                    "of score: cessation, AFP referral, SMR within 24 hours."
                ),
                mitigation_examples=[
                    "DPRK/Iran-connected beneficiaries or routing prohibited outright",
                    "Live screening against DFAT DPRK/Iran/Russia regime-specific lists",
                ],
            ),
            LibraryFactor(
                ref="SP-01",
                category_type="regulatory",
                name="Sanctioned person, entity or jurisdiction dealing",
                description=(
                    "Sender, beneficiary or corridor matched against a sanctions list."
                ),
                suggested_likelihood=2,
                suggested_consequence=5,
                rationale=(
                    "Risk Matrix Sanctions/PEP Risk category, SP-01 — MEDIUM "
                    "inherent rating (10/25). Folded into 'regulatory' — the "
                    "7-category schema has no dedicated Sanctions/PEP slot "
                    "(see module docstring)."
                ),
                mitigation_examples=[
                    "Live screening against DFAT and UN Consolidated Lists (never cached)",
                    "Mandatory beneficiary verification before fund release",
                    "7-step confirmed-match response procedure (CO+Director+AFP)",
                ],
            ),
            LibraryFactor(
                ref="PC-01",
                category_type="regulatory",
                name="IFTI-DRA systemic reporting failure",
                description=(
                    "Program-level breakdown in IFTI-DRA reporting (e.g. "
                    "widespread missed deadlines, not an isolated instance)."
                ),
                suggested_likelihood=2,
                suggested_consequence=5,
                rationale=(
                    "Risk Matrix Program/Compliance Risk category, PC-01 — "
                    "MEDIUM inherent rating (10/25). Folded into 'regulatory' "
                    "(see module docstring)."
                ),
                mitigation_examples=[
                    "Annual independent review specifically tests IFTI-DRA completeness",
                    "Monthly Compliance Officer reconciliation of instructions vs. lodgements",
                ],
            ),
            LibraryFactor(
                ref="PC-02",
                category_type="regulatory",
                name="SMR under-reporting (systemic)",
                description=(
                    "Program-level failure to escalate or lodge SMRs despite "
                    "recurring suspicion indicators."
                ),
                suggested_likelihood=3,
                suggested_consequence=5,
                rationale=(
                    "Risk Matrix Program/Compliance Risk category, PC-02 — "
                    "HIGH inherent rating (15/25). Cross-references the "
                    "Westpac ($1.3B) and CBA ($700M) AUSTRAC enforcement "
                    "actions cited in the SMR Guideline as motivation."
                ),
                mitigation_examples=[
                    "SMR Internal Decision Log completed for every escalated matter, including decisions not to lodge",
                    "Quarterly Director review of the SMR decision log",
                ],
            ),
            LibraryFactor(
                ref="CHAN-001",
                category_type="channel",
                name="Digital / mobile-app onboarding and instruction channel",
                description=(
                    "Non-face-to-face customer onboarding and instruction "
                    "submission via online or mobile channels."
                ),
                suggested_likelihood=3,
                suggested_consequence=3,
                rationale=(
                    "Non-face-to-face channels increase identity-fraud and "
                    "impersonation risk relative to in-person onboarding."
                ),
                mitigation_examples=[
                    "Electronic identity verification meeting AUSTRAC guidance",
                    "Liveness check for high-value or high-risk remote customers",
                ],
            ),
            LibraryFactor(
                ref="CHAN-002",
                category_type="channel",
                name="Retail / OTC cash intake",
                description=(
                    "Physical currency accepted at a branch or agent location, "
                    "applicable only where the Organisation's registration "
                    "covers the cash-handling variant of the designated "
                    "service (see ttr_procedures)."
                ),
                suggested_likelihood=3,
                suggested_consequence=4,
                rationale=(
                    "Where applicable, cash intake is a structuring vector "
                    "(TTR threshold evasion) distinct from the electronic-only "
                    "IFTI-DRA flow."
                ),
                mitigation_examples=[
                    "Sub-agent cash receipts >= $10,000 reported to the Organisation within 2 business days",
                    "TTR lodged within 15 business days where applicable",
                ],
            ),
            LibraryFactor(
                ref="SVC-001",
                category_type="service",
                name="Sub-agent / retail agent network oversight failure",
                description=(
                    "Sub-agents or retail outlets accepting instructions on "
                    "the Organisation's behalf without adequate oversight."
                ),
                suggested_likelihood=3,
                suggested_consequence=4,
                rationale=(
                    "The Organisation remains responsible for AML/CTF "
                    "compliance across its agent network; agent-level "
                    "failures are a recurring AUSTRAC enforcement theme in "
                    "the remittance sector."
                ),
                mitigation_examples=[
                    "Sub-agent due diligence at onboarding and periodic review",
                    "Sub-agent AML/CTF training and compliance attestation",
                ],
            ),
            LibraryFactor(
                ref="SVC-002",
                category_type="service",
                name="High-risk correspondent / partner remittance entity",
                description=(
                    "Correspondent or network provider relationship with an "
                    "entity presenting elevated ML/TF risk (weak home-country "
                    "AML/CTF regime, adverse history, or opaque ownership)."
                ),
                suggested_likelihood=2,
                suggested_consequence=4,
                rationale=(
                    "TMP rule REM-12 treats high-risk correspondent entities "
                    "as a distinct per-instruction monitoring trigger."
                ),
                mitigation_examples=[
                    "Correspondent due diligence at onboarding and periodic review",
                    "Review of correspondent relationship where Travel Rule data is consistently absent",
                ],
            ),
        ],
    )
