"""
Dealers in Precious Metals & Stones (DPMS) risk library — derived from the
Organisation's real ISO 31000:2018 EWRA (VERIGO_DPMS_Risk_Matrix_v1.xlsx), a
20-row inherent/residual register. `ref` values match the real matrix's own
IDs (CT-*, CR-*, PR-*, SG-*, DC-*, ER-*, PC-*) rather than an independently
invented scheme.

The real matrix uses 7 top-level categories — Cash Transaction Risk,
Customer Risk, Product/Service Risk, Sanctions/Geographic Risk, Delivery
Channel Risk, Employee/Internal Risk, Program/Compliance Risk — which don't
map 1:1 onto the 7-category RiskCategoryType schema. Per the precedent set
for Legal, Conveyancers, Remittance and VASP, unsupported categories are
folded into the closest existing category rather than force-fitting new
enum values:
  - Cash Transaction Risk (CT-*)        -> transaction (cash purchases/sales
    ARE the sector's designated-service transactions)
  - Product/Service Risk (PR-*)         -> product (each item is a specific
    product line — gold bullion, gemstones, watches — not a service type)
  - Sanctions/Geographic Risk (SG-*)    -> geographic (both risks are
    jurisdiction-of-origin/destination risk, not a generic sanctions fold)
  - Delivery Channel Risk (DC-*)        -> channel (direct match)
  - Employee/Internal Risk (ER-*)       -> service (same fold as Legal,
    Conveyancers and VASP)
  - Program/Compliance Risk (PC-*)      -> regulatory (same fold as Legal)

CT-01 (cash >= AUD 10,000, 25/25) and CT-02 (structuring, 25/25) are the two
highest inherent scores in the whole matrix, tied with PR-01 (gold bullion,
25/25) — AUSTRAC's #1, #2 and (implicitly, as the product those first two
typologies are conducted in) top-ranked ML typologies for this sector.
"""

from app.templates.risk.base import LibraryFactor, RiskLibrary


def get_library() -> RiskLibrary:
    return RiskLibrary(
        industry="dpms",
        description=(
            "Dealers in Precious Metals & Stones — Tranche 2 (commencing 1 "
            "July 2026 anticipated). TTR obligation applies (cash is central "
            "to this designated service, not incidental); IFTI and the "
            "Travel Rule do not apply unless the Organisation separately "
            "provides remittance or virtual-asset services. Cash purchase of "
            "gold bullion at or above AUD 10,000 (CT-01), structuring "
            "(CT-02) and gold bullion itself as a product (PR-01) are the "
            "three CRITICAL 25/25 risks — the highest inherent scores in the "
            "whole Risk Matrix."
        ),
        category_weights={
            "customer": 0.20,
            "product": 0.20,
            "service": 0.08,
            "geographic": 0.14,
            "channel": 0.06,
            "transaction": 0.24,
            "regulatory": 0.08,
        },
        factors=[
            LibraryFactor(
                ref="CT-01",
                category_type="transaction",
                name="Cash purchase of precious metals at or above AUD 10,000",
                description=(
                    "Cash purchase of gold, silver, or gemstones at or above "
                    "the AUD 10,000 TTR threshold."
                ),
                suggested_likelihood=5,
                suggested_consequence=5,
                rationale=(
                    "AUSTRAC DPMS Guidance Typology #1 (ranked #1 in DPMS STR "
                    "data) — cash purchases at or above AUD 10,000 are the "
                    "primary ML vector for DPMS, converting criminal cash "
                    "into a portable, anonymous, high-value asset. Risk "
                    "Matrix CT-01 — CRITICAL inherent rating (25/25), the "
                    "highest score in the matrix."
                ),
                mitigation_examples=[
                    "CDD mandatory before completing any transaction >= AUD 10,000",
                    "TTR submitted to AUSTRAC within 10 business days",
                    "Source of cash funds assessed and documented",
                    "Cash > AUD 50,000: ECDD + Director approval before proceeding",
                    "Receipt issued regardless of customer preference",
                ],
            ),
            LibraryFactor(
                ref="CT-02",
                category_type="transaction",
                name="Structuring — multiple cash transactions kept below AUD 10,000",
                description=(
                    "Multiple related cash transactions deliberately kept "
                    "below the AUD 10,000 threshold to avoid CDD and TTR."
                ),
                suggested_likelihood=5,
                suggested_consequence=5,
                rationale=(
                    "A criminal offence under AML/CTF Act s.142, and the most "
                    "common ML pattern in Australian DPMS STR data (AUSTRAC "
                    "Rank #2). Risk Matrix CT-02 — CRITICAL inherent rating "
                    "(25/25)."
                ),
                mitigation_examples=[
                    "Daily pattern review of near-threshold cash transactions",
                    "Staff trained to identify structuring indicators, never to disclose the threshold",
                    "Suspected structuring: do not complete the transaction; notify CO immediately",
                    "SMR mandatory where structuring is confirmed",
                    "Apply CDD to the cumulative transaction value across related transactions",
                ],
            ),
            LibraryFactor(
                ref="CT-03",
                category_type="transaction",
                name="Very large cash transaction — single purchase > AUD 100,000",
                description=(
                    "Physical currency exceeding AUD 100,000 in a single "
                    "precious-metals or high-value-gemstone purchase."
                ),
                suggested_likelihood=3,
                suggested_consequence=5,
                rationale=(
                    "ACIC Gold Report: very large cash transactions are "
                    "indicative of integration-stage ML, converting large "
                    "sums of criminal cash into portable assets in one "
                    "transaction. Risk Matrix CT-03 — HIGH inherent rating "
                    "(15/25)."
                ),
                mitigation_examples=[
                    "ECDD mandatory regardless of other risk factors",
                    "Full documentary source-of-funds evidence required",
                    "Director approval required before completing the transaction",
                    "Decline if source of funds cannot be adequately documented",
                ],
            ),
            LibraryFactor(
                ref="CR-01",
                category_type="customer",
                name="Walk-in retail customer — anonymous, high-value cash purchase",
                description=(
                    "No established relationship, purchasing gold coins, "
                    "bars, or high-value jewellery for cash."
                ),
                suggested_likelihood=5,
                suggested_consequence=4,
                rationale=(
                    "The most frequent DPMS ML typology in Australia — no "
                    "prior relationship means no transaction history for an "
                    "OCDD baseline. Risk Matrix CR-01 — CRITICAL inherent "
                    "rating (20/25)."
                ),
                mitigation_examples=[
                    "CDD mandatory for all transactions >= AUD 10,000 regardless of familiarity",
                    "Primary photographic ID sighted and recorded",
                    "Source of cash funds assessed",
                    "Multiple transactions by the same customer tracked for structuring",
                    "Decline the transaction if the customer refuses CDD",
                ],
            ),
            LibraryFactor(
                ref="CR-02",
                category_type="customer",
                name="PEP purchasing or selling high-value precious metals or stones",
                description=(
                    "Politically exposed person, or close associate/family "
                    "member, transacting with the Organisation."
                ),
                suggested_likelihood=2,
                suggested_consequence=5,
                rationale=(
                    "Precious metals and gemstones can store proceeds of "
                    "corruption in portable, discreet, high-value form. Risk "
                    "Matrix CR-02 — MEDIUM inherent rating (10/25)."
                ),
                mitigation_examples=[
                    "PEP screening at onboarding for regular/wholesale customers",
                    "PEP self-declaration for walk-in customers >= AUD 10,000",
                    "ECDD mandatory for all identified PEPs; source of wealth documented",
                    "Director approval before completing the transaction",
                ],
            ),
            LibraryFactor(
                ref="CR-03",
                category_type="customer",
                name="Wholesale customer — unverified registration, no trading history",
                description=(
                    "Unregistered or newly-registered wholesale buyer with "
                    "no verifiable trading history."
                ),
                suggested_likelihood=3,
                suggested_consequence=4,
                rationale=(
                    "ACIC Gold Report: used to insert a 'legitimate business' "
                    "layer into gold ML chains — the Australian gold refinery "
                    "exploitation typology. Risk Matrix CR-03 — HIGH inherent "
                    "rating (12/25)."
                ),
                mitigation_examples=[
                    "Entity KYC mandatory before first transaction, incl. ASIC company search",
                    "Beneficial ownership verified",
                    "ECDD for newly-registered entities (< 2 years) or high-risk jurisdictions",
                    "Annual OCDD review for ongoing wholesale relationships",
                ],
            ),
            LibraryFactor(
                ref="CR-04",
                category_type="customer",
                name="Customer purchasing on behalf of an undisclosed third party",
                description=(
                    "Mule-purchaser pattern — separate individuals making "
                    "purchases on behalf of a common, undisclosed controller."
                ),
                suggested_likelihood=4,
                suggested_consequence=4,
                rationale=(
                    "ACIC Gold Report: a known Australian organised-crime "
                    "typology used to structure cash gold purchases and avoid "
                    "CDD. Risk Matrix CR-04 — HIGH inherent rating (16/25)."
                ),
                mitigation_examples=[
                    "CDD on both the customer and the principal where acting for another",
                    "Decline if the principal cannot be identified",
                    "Staff trained on third-party-purchasing indicators",
                    "Structuring monitoring applied to associated customers",
                ],
            ),
            LibraryFactor(
                ref="PR-01",
                category_type="product",
                name="Gold bullion (bars, coins) — highest-risk DPMS product",
                description=(
                    "Gold bullion's portability, anonymity, international "
                    "fungibility, and store of value make it the sector's "
                    "primary ML vehicle."
                ),
                suggested_likelihood=5,
                suggested_consequence=5,
                rationale=(
                    "Universally identified by AUSTRAC and FATF as the "
                    "primary DPMS ML vehicle (a 1kg gold bar is worth "
                    "approximately AUD 120,000). Risk Matrix PR-01 — "
                    "CRITICAL inherent rating (25/25)."
                ),
                mitigation_examples=[
                    "Mandatory CDD and TTR for sales >= AUD 10,000",
                    "Sales > AUD 50,000: ECDD + Director approval",
                    "Buy-backs: provenance documentation required",
                    "Rapid buy-back: ECDD and SMR consideration",
                    "Transaction log maintained for all bullion sales and purchases",
                ],
            ),
            LibraryFactor(
                ref="PR-02",
                category_type="product",
                name="Precious metals of unknown or undocumented provenance",
                description=(
                    "Metals of unclear origin — potentially stolen, "
                    "smuggled, or criminal proceeds in metal form — "
                    "presented for trade or refining."
                ),
                suggested_likelihood=4,
                suggested_consequence=4,
                rationale=(
                    "ACIC Gold Report: Australian typology of stolen gold "
                    "sold to DPMS without provenance checks, introducing ML "
                    "risk into the supply chain. Risk Matrix PR-02 — HIGH "
                    "inherent rating (16/25)."
                ),
                mitigation_examples=[
                    "Provenance documentation required: receipt, mining/smelting certificate, hallmark, or gemological certificate",
                    "ECDD + Director approval where provenance cannot be established",
                    "Police stolen-metals alert list checked",
                    "SMR consideration where criminal-origin metals suspected",
                ],
            ),
            LibraryFactor(
                ref="PR-03",
                category_type="product",
                name="Rapid buy-back — items sold back at a loss shortly after purchase",
                description=(
                    "Customer purchases then sells back the same items "
                    "within 90 days, typically at a loss."
                ),
                suggested_likelihood=3,
                suggested_consequence=4,
                rationale=(
                    "AUSTRAC STR Rank #3 for DPMS — generates a 'clean' "
                    "transaction record with a small loss, an integration "
                    "technique to legitimise the criminal cash originally "
                    "used to buy the item. Risk Matrix PR-03 — HIGH inherent "
                    "rating (12/25)."
                ),
                mitigation_examples=[
                    "Monitoring flags any buy-back within 90 days of purchase",
                    "ECDD triggered for all rapid buy-back customers",
                    "Source of the original purchase funds re-assessed",
                    "SMR consideration where no commercial rationale exists",
                ],
            ),
            LibraryFactor(
                ref="PR-04",
                category_type="product",
                name="High-value gemstones and diamonds",
                description=(
                    "Portable, high-value stones in a market that lacks "
                    "standardised pricing, making value manipulation easier."
                ),
                suggested_likelihood=3,
                suggested_consequence=4,
                rationale=(
                    "Shares gold's ML characteristics but harder to detect ML "
                    "in, given the absence of standardised valuation. Risk "
                    "Matrix PR-04 — HIGH inherent rating (12/25)."
                ),
                mitigation_examples=[
                    "CDD and TTR for gemstone transactions >= AUD 10,000",
                    "Independent gemological valuation for transactions > AUD 50,000",
                    "Provenance documentation: GIA/AGS or equivalent certificate",
                    "Director approval for transactions > AUD 100,000",
                ],
            ),
            LibraryFactor(
                ref="PR-05",
                category_type="product",
                name="Luxury watches and high-value jewellery — secondary market",
                description=(
                    "Portable, brand-valuable items with an active secondary "
                    "market and growing cash-purchase ML typology."
                ),
                suggested_likelihood=3,
                suggested_consequence=3,
                rationale="Risk Matrix PR-05 — MEDIUM inherent rating (9/25).",
                mitigation_examples=[
                    "CDD and TTR for cash transactions >= AUD 10,000",
                    "ECDD for rapid buy-back, unusual volumes, or foreign cash buyers",
                    "Provenance documentation for pre-owned items > AUD 10,000",
                    "Source of funds assessed for single-item purchases > AUD 50,000",
                ],
            ),
            LibraryFactor(
                ref="SG-01",
                category_type="geographic",
                name="Precious metals from or destined for sanctioned jurisdictions",
                description=(
                    "Russian, Iranian, North Korean, or Myanmar-origin gold, "
                    "metals, or precious stones."
                ),
                suggested_likelihood=3,
                suggested_consequence=5,
                rationale=(
                    "Gold and precious metals are a primary global sanctions "
                    "evasion tool; Russian gold is specifically sanctioned "
                    "under UNSCR and DFAT measures. Risk Matrix SG-01 — HIGH "
                    "inherent rating (15/25)."
                ),
                mitigation_examples=[
                    "DFAT and UN sanctions lists screened for all customers, BOs and counterparties",
                    "Country of origin assessed for all wholesale purchases",
                    "Russian, Iranian, DPRK and Myanmar-origin metals: never purchase or sell",
                    "Positive match: cease dealings, notify CO, AFP within 24 hours, SMR within 24 hours",
                ],
            ),
            LibraryFactor(
                ref="SG-02",
                category_type="geographic",
                name="Customer or transaction involving a FATF grey/black-list jurisdiction",
                description=(
                    "Customer from, or transaction involving, a jurisdiction "
                    "under FATF increased monitoring."
                ),
                suggested_likelihood=3,
                suggested_consequence=4,
                rationale="Risk Matrix SG-02 — HIGH inherent rating (12/25).",
                mitigation_examples=[
                    "FATF grey/black list reviewed monthly by the CO",
                    "ECDD mandatory for grey/black-list jurisdiction transactions",
                    "Certified documentation from the originating jurisdiction required",
                    "Director approval required; decline if documentation is inadequate",
                ],
            ),
            LibraryFactor(
                ref="DC-01",
                category_type="channel",
                name="Online or remote precious-metal sales — no in-person verification",
                description=(
                    "Online platforms enabling anonymous or pseudonymous "
                    "purchases that bypass in-person CDD."
                ),
                suggested_likelihood=3,
                suggested_consequence=4,
                rationale="Risk Matrix DC-01 — HIGH inherent rating (12/25).",
                mitigation_examples=[
                    "Electronic verification mandatory for online transactions >= AUD 10,000",
                    "Payment via verified bank transfer or traceable method only — no cryptocurrency, no anonymous methods",
                    "Delivery address verified and consistent with the KYC profile",
                    "No delivery until the payment source is confirmed",
                ],
            ),
            LibraryFactor(
                ref="DC-02",
                category_type="channel",
                name="Cryptocurrency payment for precious metals",
                description=(
                    "Cryptocurrency used to purchase precious metals, "
                    "circumventing traditional AML/CTF controls."
                ),
                suggested_likelihood=2,
                suggested_consequence=5,
                rationale=(
                    "An emerging Australian typology of crypto-to-gold "
                    "conversion that creates source-of-funds opacity. Risk "
                    "Matrix DC-02 — MEDIUM inherent rating (10/25)."
                ),
                mitigation_examples=[
                    "ECDD mandatory for any cryptocurrency payment",
                    "Blockchain analytics report required (Chainalysis, Elliptic, or equivalent)",
                    "Director approval required before completing the transaction",
                    "Decline where analytics indicate mixing services, darknet, or sanctioned wallet activity",
                ],
            ),
            LibraryFactor(
                ref="ER-01",
                category_type="service",
                name="Staff facilitating structuring or advising threshold avoidance",
                description=(
                    "Sales staff who advise customers on structuring, or "
                    "knowingly complete structured transactions."
                ),
                suggested_likelihood=3,
                suggested_consequence=5,
                rationale=(
                    "A criminal offence under AML/CTF Act s.142 for the staff "
                    "member alongside the customer. Risk Matrix ER-01 — HIGH "
                    "inherent rating (15/25)."
                ),
                mitigation_examples=[
                    "Training: assisting structuring is a criminal offence, at induction and annually",
                    "Staff prohibited from disclosing the AUD 10,000 threshold to customers",
                    "Transaction log reviewed for near-threshold patterns; random file audits",
                    "Immediate termination and law-enforcement referral for confirmed assistance",
                ],
            ),
            LibraryFactor(
                ref="ER-02",
                category_type="service",
                name="Inconsistent CDD at point of sale under business pressure",
                description=(
                    "Sales staff under volume pressure failing to complete "
                    "CDD for threshold or near-threshold transactions."
                ),
                suggested_likelihood=3,
                suggested_consequence=4,
                rationale="Risk Matrix ER-02 — HIGH inherent rating (12/25).",
                mitigation_examples=[
                    "CDD checklist mandatory for every threshold transaction",
                    "Manager sign-off required before completing threshold transactions",
                    "Quarterly file audits of at least 10% of threshold transactions",
                    "Non-completion escalated to the CO within 2 business days",
                ],
            ),
            LibraryFactor(
                ref="PC-01",
                category_type="regulatory",
                name="TTR failure — threshold transaction not reported or reported late",
                description=(
                    "Failure to submit a TTR within 10 business days of a "
                    "threshold transaction."
                ),
                suggested_likelihood=3,
                suggested_consequence=4,
                rationale=(
                    "A strict-liability offence under AML/CTF Act s.45 — "
                    "DPMS are expected to have high TTR volumes, so systemic "
                    "failures indicate inadequate transaction monitoring. "
                    "Risk Matrix PC-01 — HIGH inherent rating (12/25)."
                ),
                mitigation_examples=[
                    "Daily transaction log reviewed by the CO for threshold transactions",
                    "TTR submission deadline tracked in the compliance calendar",
                    "Monthly TTR volume reviewed by the Director",
                    "Voluntary disclosure to AUSTRAC considered for any missed TTR",
                ],
            ),
            LibraryFactor(
                ref="PC-02",
                category_type="regulatory",
                name="SMR failure or tipping off",
                description=(
                    "Suspicious matter not reported, or the customer "
                    "inadvertently tipped off that a suspicion exists."
                ),
                suggested_likelihood=3,
                suggested_consequence=4,
                rationale=(
                    "SMR failure and tipping off are separately penalised "
                    "offences; DPMS staff are particularly vulnerable to "
                    "inadvertent tipping off when asking about structuring "
                    "openly. Risk Matrix PC-02 — HIGH inherent rating "
                    "(12/25)."
                ),
                mitigation_examples=[
                    "SMR procedure and tipping-off prohibition trained for all staff",
                    "CO decision documented within 24 hours of an escalated suspicion",
                    "Staff instructed to complete transactions normally if safe, then notify the CO",
                    "Tipping-off included in every training session with sector-specific examples",
                ],
            ),
        ],
    )
