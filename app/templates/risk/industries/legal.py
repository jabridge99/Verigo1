"""
Legal Professionals risk library — derived from the Organisation's real ISO
31000:2018 EWRA (VERIGO_LEGAL_Risk_Matrix_v1.xlsx), a 19-row inherent/
residual register — the largest of any sector's real matrix reviewed this
session. `ref` values match the real matrix's own IDs (CR-*, PR-*, GR-*,
ER-*, LP-*, SP-*, PC-*) rather than an independently invented scheme.

The real matrix uses 7 top-level categories — Customer Risk, Product/Service
Risk, Geographic Risk, Employee/Internal Risk, LPP/Professional Obligations
Risk, Sanctions/PEP Risk, Program/Compliance Risk — which don't map 1:1 onto
the 7-category RiskCategoryType schema (no dedicated "Employee/Internal",
"LPP/Professional Obligations", "Sanctions/PEP" or "Program/Compliance"
slot; see PARKING_LOT.md P17/P18/P20/P23). Per the precedent set for
Conveyancers, Remittance and VASP, unsupported categories are folded into
the closest existing category rather than force-fitting new enum values:
  - Employee/Internal Risk (ER-*)             -> service (same fold as
    Conveyancers and VASP)
  - LPP/Professional Obligations Risk (LP-*)  -> regulatory (a compliance-
    process-integrity risk, not a customer- or product-type risk)
  - Sanctions/PEP Risk (SP-*)                 -> regulatory
  - Program/Compliance Risk (PC-*)            -> regulatory
  - Product/Service items describing the solicitor trust account's
    behavioural/transactional risk (PR-01, third-party funds) -> transaction,
    matching the identical typology's treatment for Conveyancers (TXN-001)
  - Product/Service items describing a designated service *line* (entity
    formation, nominee, property, M&A, registered office) -> product/service

PR-01 (trust account third-party funds, 25/25) is the single highest
inherent score in the whole matrix and AUSTRAC's #1-ranked STR typology for
this sector; PR-02 (entity formation, no purpose) and PR-03 (nominee
services) are the other two CRITICAL risks (20/25 each, AUSTRAC Rank #2/#3).
"""

from app.templates.risk.base import LibraryFactor, RiskLibrary


def get_library() -> RiskLibrary:
    return RiskLibrary(
        industry="legal",
        description=(
            "Law firm — Tranche 2 (commencing 1 July 2026 anticipated). No "
            "IFTI/TTR obligations expected in the ordinary course (cash is "
            "declined by policy). Solicitor trust account third-party funds "
            "(PR-01) is the sector's highest inherent risk and AUSTRAC's "
            "#1-ranked STR typology; entity formation (PR-02) and nominee "
            "services (PR-03) are the other two CRITICAL risks."
        ),
        category_weights={
            "customer": 0.24,
            "product": 0.10,
            "service": 0.20,
            "geographic": 0.10,
            "channel": 0.06,
            "transaction": 0.16,
            "regulatory": 0.14,
        },
        factors=[
            LibraryFactor(
                ref="PR-01",
                category_type="transaction",
                name="Solicitor trust account — third-party or unexplained funds",
                description=(
                    "Funds deposited into the trust account from a person not "
                    "identified as the client, with the source not adequately "
                    "explained."
                ),
                suggested_likelihood=5,
                suggested_consequence=5,
                rationale=(
                    "AUSTRAC's #1-ranked STR typology for legal professionals "
                    "and the single highest inherent score in the whole Risk "
                    "Matrix (25/25, CRITICAL) — the trust account provides a "
                    "'clean' origin certificate for criminal funds."
                ),
                mitigation_examples=[
                    "Full CDD on the actual remitting party, not just the named client",
                    "Source of funds confirmed in writing before receipt",
                    "Compliance Officer sign-off before accepting deposits > AUD $50,000",
                    "Monthly trust account reconciliation and review",
                    "SMR mandatory where the source cannot be adequately explained",
                ],
            ),
            LibraryFactor(
                ref="CR-01",
                category_type="customer",
                name="Client refusing to disclose identity, BO, or source of funds",
                description=(
                    "Client cannot or will not satisfy CDD requirements before "
                    "a designated service is provided."
                ),
                suggested_likelihood=4,
                suggested_consequence=5,
                rationale=(
                    "The most fundamental ML risk for legal professionals. "
                    "Risk Matrix CR-01 — CRITICAL inherent rating (20/25). LPP "
                    "does not excuse non-disclosure for designated services."
                ),
                mitigation_examples=[
                    "CDD mandatory before accepting any designated-service retainer",
                    "Decline retainer if client refuses CDD",
                    "Document the decision not to accept the retainer",
                ],
            ),
            LibraryFactor(
                ref="PR-02",
                category_type="product",
                name="Entity formation with no apparent legitimate purpose",
                description=(
                    "Client requests formation of a company, trust, or other "
                    "legal arrangement and cannot articulate a plausible "
                    "commercial, tax, or succession purpose."
                ),
                suggested_likelihood=4,
                suggested_consequence=5,
                rationale=(
                    "AUSTRAC's #2-ranked STR typology for this sector. Risk "
                    "Matrix PR-02 — CRITICAL inherent rating (20/25)."
                ),
                mitigation_examples=[
                    "Document and assess the stated commercial/tax/succession purpose",
                    "ECDD for multi-jurisdictional or nominee-controlled structures",
                    "Managing Partner approval for high-risk formation requests",
                    "Decline where legitimate purpose cannot be established",
                ],
            ),
            LibraryFactor(
                ref="PR-03",
                category_type="product",
                name="Nominee director, secretary, trustee, or shareholder services",
                description=(
                    "Acting as or arranging a nominee officer where the "
                    "ultimate beneficial owner cannot be identified."
                ),
                suggested_likelihood=4,
                suggested_consequence=5,
                rationale=(
                    "AUSTRAC's #3-ranked STR typology for this sector — a "
                    "primary vehicle for concealing beneficial ownership. Risk "
                    "Matrix PR-03 — CRITICAL inherent rating (20/25)."
                ),
                mitigation_examples=[
                    "Full CDD on the person on whose behalf the nominee acts",
                    "Written authority from the ultimate beneficial owner",
                    "Managing Partner approval for offshore/high-risk nominees",
                    "Annual review of all existing nominee arrangements",
                    "Decline for entities with unidentifiable beneficial owners",
                ],
            ),
            LibraryFactor(
                ref="PR-04",
                category_type="service",
                name="Real property transaction facilitated by the firm",
                description=(
                    "Acting for vendor or purchaser in a property transaction, "
                    "with elevated trust-account exposure at settlement."
                ),
                suggested_likelihood=4,
                suggested_consequence=5,
                rationale="Risk Matrix PR-04 — CRITICAL inherent rating (20/25).",
                mitigation_examples=[
                    "Source of settlement funds identified and documented",
                    "Beneficial ownership verified for all entity purchasers",
                    "ECDD for foreign buyers or high-risk-jurisdiction funds",
                    "Managing Partner sign-off for settlements > AUD $2M",
                ],
            ),
            LibraryFactor(
                ref="CR-04",
                category_type="customer",
                name="Corporate client — complex, offshore, or layered ownership",
                description=(
                    "Non-individual client with a multi-jurisdictional "
                    "structure obscuring the ultimate beneficial owner."
                ),
                suggested_likelihood=4,
                suggested_consequence=4,
                rationale="Risk Matrix CR-04 — HIGH inherent rating (16/25).",
                mitigation_examples=[
                    "Beneficial ownership chart mandatory for 3+ entity layers",
                    "Managing Partner approval for complex or offshore structures",
                    "Decline if BO unidentifiable after ECDD",
                ],
            ),
            LibraryFactor(
                ref="CR-02",
                category_type="customer",
                name="PEP as client, principal, or beneficial owner",
                description=(
                    "Politically exposed person, or close associate/family "
                    "member, instructing the firm."
                ),
                suggested_likelihood=3,
                suggested_consequence=5,
                rationale="Risk Matrix CR-02 — HIGH inherent rating (15/25).",
                mitigation_examples=[
                    "PEP screening at onboarding via commercial database and media search",
                    "Mandatory ECDD, source of wealth/funds documented",
                    "Board/Director approval for foreign PEPs",
                ],
            ),
            LibraryFactor(
                ref="CR-05",
                category_type="customer",
                name="Client from FATF grey-list or black-list jurisdiction",
                description=(
                    "Client, or funds, originating from a jurisdiction with "
                    "strategic AML/CTF deficiencies."
                ),
                suggested_likelihood=3,
                suggested_consequence=5,
                rationale="Risk Matrix CR-05 — HIGH inherent rating (15/25).",
                mitigation_examples=[
                    "FATF list reviewed monthly",
                    "ECDD mandatory; certified documentation required",
                    "Managing Partner approval; decline if documentation inadequate",
                ],
            ),
            LibraryFactor(
                ref="GR-01",
                category_type="geographic",
                name="Cross-border legal services — high-risk jurisdiction",
                description=(
                    "Instructions or funds involving a FATF grey/black-list "
                    "jurisdiction."
                ),
                suggested_likelihood=3,
                suggested_consequence=5,
                rationale="Risk Matrix GR-01 — HIGH inherent rating (15/25).",
                mitigation_examples=[
                    "FATF list reviewed monthly",
                    "ECDD mandatory; DFAT/UN sanctions screening",
                    "Managing Partner approval; decline if documentation inadequate",
                ],
            ),
            LibraryFactor(
                ref="ER-02",
                category_type="service",
                name="Fee-earner pressure to accept high-risk instructions",
                description=(
                    "Revenue-driven culture conflicts with the gatekeeping "
                    "obligation, pressuring acceptance of matters that should "
                    "be declined on AML/CTF grounds."
                ),
                suggested_likelihood=3,
                suggested_consequence=4,
                rationale="Risk Matrix ER-02 — HIGH inherent rating (12/25).",
                mitigation_examples=[
                    "CO has explicit authority to decline any matter regardless of fee potential",
                    "Fee-earner KPIs exclude AML/CTF-conflicting targets",
                    "Declined-matter decisions documented and reviewed quarterly",
                ],
            ),
            LibraryFactor(
                ref="LP-01",
                category_type="regulatory",
                name="LPP claimed to resist AML/CTF CDD or SMR obligations",
                description=(
                    "Legal Professional Privilege invoked to resist CDD, "
                    "ECDD, TMP, or SMR inquiries for a designated legal "
                    "service."
                ),
                suggested_likelihood=3,
                suggested_consequence=4,
                rationale=(
                    "Risk Matrix LP-01 — HIGH inherent rating (12/25). Folded "
                    "into 'regulatory' — the 7-category schema has no "
                    "dedicated LPP/Professional Obligations slot (see module "
                    "docstring). LPP does not exempt designated services from "
                    "AML/CTF obligations; the claim itself may be a "
                    "suspicious indicator."
                ),
                mitigation_examples=[
                    "Annual staff training on the LPP/AML-CTF interface",
                    "Written firm policy: LPP does not override CDD for designated services",
                    "CO consulted before any LPP claim is used to resist an inquiry",
                    "External legal advice for novel LPP/AML intersection issues",
                ],
            ),
            LibraryFactor(
                ref="PR-05",
                category_type="service",
                name="M&A / business sale — unclear provenance",
                description=(
                    "Acquisition of entities or assets used to integrate "
                    "criminal proceeds, or price manipulation used for value "
                    "transfer."
                ),
                suggested_likelihood=3,
                suggested_consequence=4,
                rationale="Risk Matrix PR-05 — HIGH inherent rating (12/25).",
                mitigation_examples=[
                    "Source of acquisition funds documented",
                    "Independent valuation for price deviating > 15% from FMV",
                    "Managing Partner approval for transactions > AUD $5M",
                ],
            ),
            LibraryFactor(
                ref="CR-03",
                category_type="customer",
                name="Client using intermediary — no direct end-client access",
                description=(
                    "Instructions inserted through an intermediary that "
                    "obscures the ultimate client's identity and source of "
                    "funds."
                ),
                suggested_likelihood=3,
                suggested_consequence=4,
                rationale="Risk Matrix CR-03 — HIGH inherent rating (12/25).",
                mitigation_examples=[
                    "Direct CDD on the ultimate client mandatory — cannot rely on intermediary CDD",
                    "Written authority from the underlying principal obtained",
                    "Decline where the underlying principal cannot be identified",
                ],
            ),
            LibraryFactor(
                ref="PC-01",
                category_type="regulatory",
                name="SMR failure — not reported, late, or inadequately documented",
                description=(
                    "Program-level failure to escalate or lodge SMRs despite "
                    "recurring suspicion indicators."
                ),
                suggested_likelihood=3,
                suggested_consequence=5,
                rationale=(
                    "Risk Matrix Program/Compliance Risk category, PC-01 — "
                    "HIGH inherent rating (15/25). The legal sector "
                    "historically has very low SMR rates, itself a red flag."
                ),
                mitigation_examples=[
                    "SMR Internal Decision Log completed for every escalated matter",
                    "Quarterly Managing Partner review of the log",
                    "Annual external compliance review of SMR adequacy",
                ],
            ),
            LibraryFactor(
                ref="PR-06",
                category_type="service",
                name="Registered office / correspondence address service",
                description=(
                    "Providing a registered address for an entity without "
                    "adequate knowledge of who controls it or for what "
                    "purpose."
                ),
                suggested_likelihood=3,
                suggested_consequence=3,
                rationale="Risk Matrix PR-06 — MEDIUM inherent rating (9/25).",
                mitigation_examples=[
                    "Identify and verify the entity's beneficial owner",
                    "Document the stated purpose of using the firm's address",
                    "Annual review of all registered office clients",
                ],
            ),
            LibraryFactor(
                ref="ER-01",
                category_type="service",
                name="Lawyer or staff facilitating ML/TF — professional complicity",
                description=(
                    "Internal compliance failure — a lawyer or staff member "
                    "knowingly facilitating a transaction or providing a "
                    "false legal opinion to enable ML/TF."
                ),
                suggested_likelihood=2,
                suggested_consequence=5,
                rationale=(
                    "Risk Matrix Employee/Internal Risk category, ER-01 — "
                    "MEDIUM inherent rating (10/25). Folded into 'service' — "
                    "the same fold used for Conveyancers' and VASP's "
                    "Employee/Internal Risk (see module docstring)."
                ),
                mitigation_examples=[
                    "Employee due diligence including AFP criminal history checks",
                    "Dual authorisation for trust account disbursements > AUD $100,000",
                    "CO authority to block matters overrides fee-earner and partner authority",
                ],
            ),
            LibraryFactor(
                ref="SP-01",
                category_type="regulatory",
                name="Transaction involving a sanctioned person, entity, or jurisdiction",
                description=(
                    "Client, beneficial owner, counterparty, or entity "
                    "matched against a sanctions list."
                ),
                suggested_likelihood=2,
                suggested_consequence=5,
                rationale=(
                    "Risk Matrix Sanctions/PEP Risk category, SP-01 — MEDIUM "
                    "inherent rating (10/25). Folded into 'regulatory' — the "
                    "7-category schema has no dedicated Sanctions/PEP slot."
                ),
                mitigation_examples=[
                    "Live DFAT/UN screening before instructions accepted",
                    "Re-screening at material transaction stages",
                    "Confirmed match: immediate cessation, AFP within 24 hours, SMR within 24 hours",
                ],
            ),
            LibraryFactor(
                ref="PC-02",
                category_type="regulatory",
                name="AML/CTF Program not updated for Tranche 2 designated services",
                description=(
                    "Program not yet reflecting the sector's Tranche 2 "
                    "obligations, or not updated after a regulatory change."
                ),
                suggested_likelihood=2,
                suggested_consequence=4,
                rationale=(
                    "Risk Matrix Program/Compliance Risk category, PC-02 — "
                    "MEDIUM inherent rating (8/25). Law firms are newly "
                    "regulated from 1 July 2026 (anticipated)."
                ),
                mitigation_examples=[
                    "Annual independent review by an external AML/CTF specialist",
                    "Tranche 2 readiness assessment completed before 1 July 2026",
                    "Compliance calendar tracking all AML/CTF deadlines",
                ],
            ),
            LibraryFactor(
                ref="GR-02",
                category_type="geographic",
                name="Proliferation financing — WMD or sanctions nexus",
                description=(
                    "Legal services provided to an entity connected to "
                    "weapons of mass destruction programmes, dual-use "
                    "technology, or a PF-sanctioned state."
                ),
                suggested_likelihood=1,
                suggested_consequence=5,
                rationale=(
                    "Risk Matrix GR-02 — LOW inherent rating on likelihood "
                    "(5/25) but with an immediate, mandatory escalation path "
                    "regardless of score."
                ),
                mitigation_examples=[
                    "UN Security Council PF-list and DFAT screening for all instructions",
                    "Decline engagement immediately if a PF link is identified",
                    "Immediate cessation, AFP referral, SMR within 24 hours",
                ],
            ),
            LibraryFactor(
                ref="CHAN-001",
                category_type="channel",
                name="Trust account disbursement instructions received only by email",
                description=(
                    "Payment or disbursement instructions accepted without "
                    "independent, out-of-band verification of the "
                    "instructing party."
                ),
                suggested_likelihood=3,
                suggested_consequence=4,
                rationale=(
                    "A recognised vector for both money laundering and "
                    "business-email-compromise payment-diversion fraud "
                    "against law firm trust accounts."
                ),
                mitigation_examples=[
                    "Out-of-band phone verification for any change to disbursement instructions",
                    "Treat last-minute account changes as suspicious pending verification",
                ],
            ),
            LibraryFactor(
                ref="CHAN-002",
                category_type="channel",
                name="Remote / digital retainer instruction without in-person meeting",
                description=(
                    "Client onboarded and instructed entirely remotely, with "
                    "no face-to-face meeting at any stage of the engagement."
                ),
                suggested_likelihood=3,
                suggested_consequence=3,
                rationale=(
                    "Non-face-to-face engagement increases identity-fraud and "
                    "impersonation risk relative to an in-person retainer."
                ),
                mitigation_examples=[
                    "Electronic identity verification (eKYC) mandatory for remote clients",
                    "Video-call verification for ECDD cases",
                ],
            ),
        ],
    )
