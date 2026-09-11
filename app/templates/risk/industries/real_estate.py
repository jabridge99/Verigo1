"""
Real Estate Agents risk library — derived from the Organisation's real ISO
31000:2018 EWRA (VERIGO_REA_Risk_Matrix_v1.xlsx), a 27-row inherent/residual
register — the largest of any sector's real matrix reviewed this session.
`ref` values match the real matrix's own IDs (CR-*, PR-*, GR-*, DC-*, ER-*,
SP-*, PC-*) rather than an independently invented scheme.

The real matrix uses 7 top-level categories — Customer Risk, Product/Service
Risk, Geographic Risk, Delivery Channel Risk, Employee/Internal Risk,
Sanctions/PEP Risk, Program/Compliance Risk. Delivery Channel Risk maps
directly onto the schema's "channel" category — the first real matrix this
session where a category needs no folding at all. Employee/Internal Risk
and Sanctions/PEP Risk and Program/Compliance Risk still have no dedicated
slot, so per the precedent set for Conveyancers, Remittance, VASP and Legal:
  - Employee/Internal Risk (ER-*)           -> service
  - Sanctions/PEP Risk (SP-*)                -> regulatory
  - Program/Compliance Risk (PC-*)           -> regulatory
  - Product/Service items describing settlement-fund behaviour (PR-01,
    PR-04, PR-05 — transactional in nature) -> transaction, matching this
    session's convention (Conveyancers' TXN-001 is the identical typology)
  - Product/Service items describing a transaction type or structure
    (PR-02 high-value, PR-03 complex financing, PR-06 property management
    trust receipts) -> product/service

PR-01 (third-party settlement funds, 25/25) is the single highest inherent
score in the whole matrix and AUSTRAC's #1-ranked STR typology for this
sector.
"""

from app.templates.risk.base import LibraryFactor, RiskLibrary


def get_library() -> RiskLibrary:
    return RiskLibrary(
        industry="real_estate",
        description=(
            "Real estate agent — Tranche 2 (commencing 1 July 2026 "
            "anticipated). No IFTI/TTR/Travel Rule obligations. Third-party "
            "settlement funds (PR-01) is the sector's highest inherent risk "
            "(25/25) and AUSTRAC's #1-ranked STR typology."
        ),
        category_weights={
            "customer": 0.24,
            "product": 0.08,
            "service": 0.12,
            "geographic": 0.12,
            "channel": 0.10,
            "transaction": 0.20,
            "regulatory": 0.14,
        },
        factors=[
            LibraryFactor(
                ref="PR-01",
                category_type="transaction",
                name="Third-party deposit or settlement funds",
                description=(
                    "Funds paid by a person who is not a party to the "
                    "contract of sale, obscuring the true source of funds."
                ),
                suggested_likelihood=5,
                suggested_consequence=5,
                rationale=(
                    "AUSTRAC's most frequently reported real estate ML "
                    "indicator and the single highest inherent score in the "
                    "whole Risk Matrix (25/25, CRITICAL)."
                ),
                mitigation_examples=[
                    "Full CDD on the third-party payer as if they were the client",
                    "Written explanation obtained from the purchaser",
                    "Source of funds for the third party independently documented",
                    "ECDD applied automatically for all third-party payment situations",
                    "SMR consideration mandatory where source cannot be explained",
                ],
            ),
            LibraryFactor(
                ref="CR-01",
                category_type="customer",
                name="Individual purchaser — cash-funded settlement",
                description=(
                    "All-cash purchase used to place criminal proceeds into "
                    "real property without a traceable financial "
                    "transaction, particularly for properties AUD $500,000+."
                ),
                suggested_likelihood=4,
                suggested_consequence=5,
                rationale="Risk Matrix CR-01 — CRITICAL inherent rating (20/25).",
                mitigation_examples=[
                    "Source of funds declaration required before contract exchange",
                    "Bank statements and wealth evidence (min. 3 months)",
                    "Director approval before proceeding; SMR if source unexplained",
                ],
            ),
            LibraryFactor(
                ref="CR-02",
                category_type="customer",
                name="Foreign buyer — FATF grey/black-list jurisdiction",
                description=(
                    "Cross-border property purchase used to export criminal "
                    "proceeds from a high-risk jurisdiction, with potential "
                    "FIRB non-disclosure."
                ),
                suggested_likelihood=4,
                suggested_consequence=5,
                rationale="Risk Matrix CR-02 — CRITICAL inherent rating (20/25).",
                mitigation_examples=[
                    "ECDD mandatory for all foreign buyers",
                    "FIRB approval status verified and documented",
                    "Sanctions and PEP screening before engagement",
                    "Director approval before signing the agency agreement",
                ],
            ),
            LibraryFactor(
                ref="CR-04",
                category_type="customer",
                name="Company or trust purchaser — opaque beneficial ownership",
                description=(
                    "Use of legal entities to conceal the ultimate "
                    "beneficial owner of a property, layered through "
                    "multiple entity levels."
                ),
                suggested_likelihood=4,
                suggested_consequence=4,
                rationale="Risk Matrix CR-04 — HIGH inherent rating (16/25).",
                mitigation_examples=[
                    "Beneficial ownership identification mandatory (25% threshold)",
                    "Director approval for structures with 3+ entity layers",
                    "Decline if BO cannot be identified after ECDD",
                ],
            ),
            LibraryFactor(
                ref="CR-03",
                category_type="customer",
                name="PEP as buyer or vendor",
                description=(
                    "Domestic or foreign politically exposed person, or "
                    "close associate/family member, purchasing or selling "
                    "real property."
                ),
                suggested_likelihood=3,
                suggested_consequence=5,
                rationale="Risk Matrix CR-03 — HIGH inherent rating (15/25).",
                mitigation_examples=[
                    "PEP screening at onboarding via commercial database and media search",
                    "Mandatory ECDD, source of wealth/funds documented",
                    "Director/Board approval for foreign PEPs",
                ],
            ),
            LibraryFactor(
                ref="CR-06",
                category_type="customer",
                name="Nominee purchaser / bare trust — undisclosed principal",
                description=(
                    "Named purchaser acts as a 'front' for an undisclosed "
                    "principal, concealing the true buyer."
                ),
                suggested_likelihood=3,
                suggested_consequence=5,
                rationale="Risk Matrix CR-06 — HIGH inherent rating (15/25).",
                mitigation_examples=[
                    "Identify and CDD both the nominee and the underlying principal",
                    "Written authority from the principal on file",
                    "Director approval where the rationale is unclear",
                ],
            ),
            LibraryFactor(
                ref="PR-02",
                category_type="product",
                name="High-value residential transaction > AUD $3 million",
                description=(
                    "Large single-transaction property purchase capable of "
                    "absorbing significant criminal proceeds in one event."
                ),
                suggested_likelihood=3,
                suggested_consequence=5,
                rationale="Risk Matrix PR-02 — HIGH inherent rating (15/25).",
                mitigation_examples=[
                    "Automatic ECDD trigger for all transactions > AUD $3M",
                    "Source of funds AND source of wealth mandatory regardless of risk rating",
                    "Director sign-off on CDD adequacy before exchange of contracts",
                ],
            ),
            LibraryFactor(
                ref="GR-01",
                category_type="geographic",
                name="Funds from FATF grey/black-list jurisdictions",
                description=(
                    "Settlement funds sourced from a jurisdiction with "
                    "strategic AML/CTF deficiencies."
                ),
                suggested_likelihood=3,
                suggested_consequence=5,
                rationale="Risk Matrix GR-01 — HIGH inherent rating (15/25).",
                mitigation_examples=[
                    "FATF list reviewed monthly",
                    "ECDD mandatory; certified banking documentation required",
                    "Director approval; decline where adequate documentation cannot be obtained",
                ],
            ),
            LibraryFactor(
                ref="CR-05",
                category_type="customer",
                name="SMSF purchaser — LRBA or related-party transaction",
                description=(
                    "SMSF property investment masking ML/TF through "
                    "inflated valuations, related-party LRBA arrangements, "
                    "or contributions from undisclosed sources."
                ),
                suggested_likelihood=3,
                suggested_consequence=4,
                rationale="Risk Matrix CR-05 — HIGH inherent rating (12/25).",
                mitigation_examples=[
                    "CDD on all individual and corporate trustees and all members",
                    "LRBA structure identified and documented",
                    "ECDD for contributions from offshore or unexplained sources",
                ],
            ),
            LibraryFactor(
                ref="CR-07",
                category_type="customer",
                name="Developer or property syndicate — off-the-plan sales",
                description=(
                    "Off-the-plan sales vulnerable to deposit structuring, "
                    "contract assignment, and multiple-purchaser layering."
                ),
                suggested_likelihood=3,
                suggested_consequence=4,
                rationale="Risk Matrix CR-07 — HIGH inherent rating (12/25).",
                mitigation_examples=[
                    "Developer entity KYC and beneficial ownership",
                    "Monitor for rapid contract reassignment at a premium or discount",
                    "ECDD for developers from high-risk jurisdictions",
                ],
            ),
            LibraryFactor(
                ref="PR-03",
                category_type="product",
                name="Commercial property — complex financing structure",
                description=(
                    "Sale-leaseback, vendor finance, or mezzanine debt "
                    "arrangements used to obscure true financial flows."
                ),
                suggested_likelihood=3,
                suggested_consequence=4,
                rationale="Risk Matrix PR-03 — HIGH inherent rating (12/25).",
                mitigation_examples=[
                    "Review of vendor finance/mezzanine debt/sale-leaseback terms",
                    "ECDD for unusual structures or offshore lenders",
                    "Director approval for multiple financing layers",
                ],
            ),
            LibraryFactor(
                ref="PR-04",
                category_type="transaction",
                name="Rapid resale / property flipping",
                description=(
                    "Property purchased and resold within a short period, "
                    "particularly at a loss, to generate a clean financial "
                    "record."
                ),
                suggested_likelihood=3,
                suggested_consequence=4,
                rationale="Risk Matrix PR-04 — HIGH inherent rating (12/25).",
                mitigation_examples=[
                    "Flag any property listed within 12 months of purchase",
                    "Assess legitimate rationale (renovation, change in circumstances)",
                    "SMR consideration where no legitimate rationale identified",
                ],
            ),
            LibraryFactor(
                ref="PR-05",
                category_type="transaction",
                name="Off-market transaction — no competitive pricing process",
                description=(
                    "Off-market sale at above or below market value used for "
                    "value transfer between related parties."
                ),
                suggested_likelihood=3,
                suggested_consequence=4,
                rationale="Risk Matrix PR-05 — HIGH inherent rating (12/25).",
                mitigation_examples=[
                    "Comparative market analysis (CMA) retained on file",
                    "ECDD and Director notification where price deviates > 15% from CMA",
                ],
            ),
            LibraryFactor(
                ref="GR-02",
                category_type="geographic",
                name="FIRB non-disclosure or evasion",
                description=(
                    "Nominee or Australian-citizen-front arrangements used "
                    "to circumvent FIRB approval requirements for foreign "
                    "purchasers."
                ),
                suggested_likelihood=3,
                suggested_consequence=4,
                rationale="Risk Matrix GR-02 — HIGH inherent rating (12/25).",
                mitigation_examples=[
                    "FIRB status verified for all foreign buyers before exchange",
                    "Copy of FIRB approval obtained and filed",
                    "Decline to proceed if FIRB approval required but not obtained",
                ],
            ),
            LibraryFactor(
                ref="DC-01",
                category_type="channel",
                name="Remote / digital onboarding without in-person verification",
                description=(
                    "Non-face-to-face onboarding increasing identity-fraud "
                    "and impersonation risk."
                ),
                suggested_likelihood=3,
                suggested_consequence=4,
                rationale="Risk Matrix DC-01 — HIGH inherent rating (12/25).",
                mitigation_examples=[
                    "Electronic verification mandatory for remote onboarding",
                    "Liveness check for high-value or high-risk transactions",
                    "Video-call verification for ECDD cases",
                ],
            ),
            LibraryFactor(
                ref="ER-01",
                category_type="service",
                name="Sales agent — commission-incentive conflict of interest",
                description=(
                    "Commission-based agents financially incentivised to "
                    "complete transactions, risking suppression of red "
                    "flags."
                ),
                suggested_likelihood=3,
                suggested_consequence=4,
                rationale=(
                    "Risk Matrix Employee/Internal Risk category, ER-01 — "
                    "HIGH inherent rating (12/25). Folded into 'service' — "
                    "the same fold used for Conveyancers, VASP and Legal's "
                    "Employee/Internal Risk."
                ),
                mitigation_examples=[
                    "Commission structure reviewed for AML/CTF compliance conflicts",
                    "Compliance sign-off required before any transaction proceeds to exchange",
                    "CO authority to block transactions overrides sales management",
                ],
            ),
            LibraryFactor(
                ref="ER-03",
                category_type="service",
                name="Inadequate or inconsistent CDD by frontline staff",
                description=(
                    "Systemic CDD failures by frontline staff undermining "
                    "even well-designed policy."
                ),
                suggested_likelihood=3,
                suggested_consequence=4,
                rationale="Risk Matrix ER-03 — HIGH inherent rating (12/25).",
                mitigation_examples=[
                    "CDD checklist mandatory for every client engagement",
                    "Random file audits (minimum 10% of transactions per quarter)",
                    "Non-completion reported to Principal within 5 business days",
                ],
            ),
            LibraryFactor(
                ref="PC-02",
                category_type="regulatory",
                name="SMR failure — not reported or reported late",
                description=(
                    "Failure to lodge, or late lodgement of, a Suspicious "
                    "Matter Report."
                ),
                suggested_likelihood=3,
                suggested_consequence=5,
                rationale=(
                    "Risk Matrix Program/Compliance Risk category, PC-02 — "
                    "HIGH inherent rating (15/25). Real estate agents have "
                    "historically had low SMR submission rates, an AUSTRAC "
                    "red flag."
                ),
                mitigation_examples=[
                    "SMR decision documented within 24 hours of every escalated suspicion",
                    "Quarterly Director review of the SMR log",
                    "Annual external compliance review of SMR adequacy",
                ],
            ),
            LibraryFactor(
                ref="DC-03",
                category_type="channel",
                name="Cryptocurrency or virtual asset contribution to settlement",
                description=(
                    "Virtual assets used to fund property purchases, "
                    "circumventing traditional AML/CTF controls and "
                    "creating source-of-funds opacity."
                ),
                suggested_likelihood=2,
                suggested_consequence=5,
                rationale="Risk Matrix DC-03 — MEDIUM inherent rating (10/25).",
                mitigation_examples=[
                    "Blockchain analytics report required (e.g. Chainalysis, Elliptic)",
                    "Director approval required before proceeding",
                    "Decline if analytics indicate mixing, darknet, or sanctioned-address exposure",
                ],
            ),
            LibraryFactor(
                ref="SP-01",
                category_type="regulatory",
                name="Transaction involving a sanctioned individual, entity, or jurisdiction",
                description=(
                    "Sanctioned party using a real property transaction to "
                    "evade asset-freezing orders."
                ),
                suggested_likelihood=2,
                suggested_consequence=5,
                rationale=(
                    "Risk Matrix Sanctions/PEP Risk category, SP-01 — MEDIUM "
                    "inherent rating (10/25). Folded into 'regulatory' — the "
                    "7-category schema has no dedicated Sanctions/PEP slot."
                ),
                mitigation_examples=[
                    "Live DFAT/UN screening at onboarding, exchange, and settlement",
                    "Confirmed match: immediate cessation, AFP within 24 hours, SMR within 24 hours",
                ],
            ),
            LibraryFactor(
                ref="ER-02",
                category_type="service",
                name="Employee or agent facilitating or participating in ML/TF",
                description=(
                    "Corrupt insider providing false certifications, "
                    "overlooking CDD failures, or actively assisting "
                    "criminal clients."
                ),
                suggested_likelihood=2,
                suggested_consequence=5,
                rationale="Risk Matrix ER-02 — MEDIUM inherent rating (10/25).",
                mitigation_examples=[
                    "Employee due diligence including AFP criminal history checks",
                    "Dual authorisation for high-value transaction approvals",
                    "Whistleblower hotline maintained",
                ],
            ),
            LibraryFactor(
                ref="DC-02",
                category_type="channel",
                name="Digital platform — anonymous or pseudonymous inquiry",
                description=(
                    "Online property platforms used for anonymous inquiry "
                    "or early-stage reconnaissance before CDD is triggered."
                ),
                suggested_likelihood=3,
                suggested_consequence=3,
                rationale="Risk Matrix DC-02 — MEDIUM inherent rating (9/25).",
                mitigation_examples=[
                    "CDD triggered at point of engagement (signed agreement or mandate)",
                    "Staff trained to identify when an inquiry becomes an engagement",
                ],
            ),
            LibraryFactor(
                ref="PC-01",
                category_type="regulatory",
                name="AML/CTF Program not reflecting current obligations",
                description=(
                    "Program not updated after a regulatory change, or not "
                    "actually implemented in practice."
                ),
                suggested_likelihood=2,
                suggested_consequence=4,
                rationale="Risk Matrix PC-01 — MEDIUM inherent rating (8/25).",
                mitigation_examples=[
                    "Annual independent review by a qualified external reviewer",
                    "Program updated within 30 days of material regulatory change",
                    "Compliance calendar tracking all AML/CTF deadlines",
                ],
            ),
            LibraryFactor(
                ref="PR-06",
                category_type="product",
                name="Property management trust account — unverified receipts",
                description=(
                    "Trust account receipts from unexplained rental "
                    "payments, non-tenant payers, or overpayment-refund "
                    "schemes — not itself a Tranche 2 designated service, "
                    "flagged for awareness."
                ),
                suggested_likelihood=3,
                suggested_consequence=3,
                rationale="Risk Matrix PR-06 — MEDIUM inherent rating (9/25).",
                mitigation_examples=[
                    "Identify source of rental payments > AUD $10,000/month",
                    "Monitor for overpayment/refund requests",
                    "Notify Compliance Officer of unusual payment patterns",
                ],
            ),
            LibraryFactor(
                ref="GR-03",
                category_type="geographic",
                name="Domestic high-risk precinct or property with criminal history",
                description=(
                    "Property types or geographic areas with known "
                    "association to drug activity, gaming venues, or "
                    "criminal networks."
                ),
                suggested_likelihood=2,
                suggested_consequence=3,
                rationale="Risk Matrix GR-03 — MEDIUM inherent rating (6/25).",
                mitigation_examples=[
                    "CO awareness of AUSTRAC/AFP intelligence on high-risk precincts",
                    "ECDD for properties with known criminal history",
                ],
            ),
            LibraryFactor(
                ref="PC-03",
                category_type="regulatory",
                name="Record-keeping failure — CDD records not retained 7 years",
                description=(
                    "Failure to retain CDD records for the statutory 7-year period."
                ),
                suggested_likelihood=2,
                suggested_consequence=3,
                rationale=(
                    "Risk Matrix PC-03 — MEDIUM inherent rating (6/25). A "
                    "strict liability offence under AML/CTF Act s.112."
                ),
                mitigation_examples=[
                    "Document management system with 7-year retention enforced",
                    "Annual records audit",
                ],
            ),
            LibraryFactor(
                ref="SP-02",
                category_type="regulatory",
                name="Proliferation financing — WMD-related parties",
                description=(
                    "Real property used to invest PF proceeds or house "
                    "PF-related entities, principally in commercial "
                    "transactions."
                ),
                suggested_likelihood=1,
                suggested_consequence=5,
                rationale=(
                    "Risk Matrix SP-02 — LOW inherent rating on likelihood "
                    "(5/25) but with an immediate, mandatory escalation path "
                    "regardless of score."
                ),
                mitigation_examples=[
                    "UN Security Council PF-list screening",
                    "Commercial transactions assessed for dual-use industry links",
                    "Immediate cessation, AFP referral, SMR within 24 hours",
                ],
            ),
        ],
    )
