"""
Dealers in Precious Metals & Stones (DPMS) AML template — Tranche 2.
IFTI ✗  TTR ✓  Travel Rule ✗

Covers both `IndustryType.bullion_dealers` and `IndustryType.precious_metals`
(bullion and precious-stones dealing are the same designated service item
under the AML/CTF Rules; there is no separate template needed for each).

Content is drawn from the Organisation's real VERIGO_DPMS_* document suite:
KYC_Guideline (VERIGO-DPMS-KYC-G01), ECDD_Guideline (VERIGO-DPMS-ECDD-G01),
TMP_Guideline (VERIGO-DPMS-TMP-G01), SMR_Guideline (VERIGO-DPMS-SMR-G01),
Sanctions_Policy (VERIGO-DPMS-SANC-P01), RATP_Addendum
(VERIGO-DPMS-RATP-A01, Module M-10) and the Risk_Matrix (ISO 31000:2018,
20-row inherent/residual register — see risk/industries/dpms.py).

This module previously covered only the core TTR/cash-monitoring
correction (an earlier fix for the generic `other.py` fallback's factually
backwards `ttr_procedures`, which told the Organisation to decline the cash
transactions its own designated service exists to handle) plus DPMS-01
through DPMS-08 of the sector's monitoring rules. It now carries the full
22-rule TMP set (GEN-01 to GEN-10 plus DPMS-01 to DPMS-12, including the
previously-missing gemstone/luxury-watch rule DPMS-11 and the PEP-specific
rule DPMS-12), the full CDD/ECDD/PEP/sanctions/SMR procedures from the real
KYC/ECDD/Sanctions/SMR Guidelines, and a dedicated risk library (see
risk/industries/dpms.py) — closing out the gap tracked in PARKING_LOT.md as
P21/"DPMS's remaining depth". Fixed alongside this: `risk/factory.py`'s
`INDUSTRY_MODULE_MAP` mapped both `bullion_dealers` and `precious_metals` to
the generic `other` risk library, not `dpms` — the AML side was already
correctly wired but the risk side never was, so a DPMS org has never
actually received the sector's own risk factors, only the fallback ones.
"""

import copy

from app.templates.aml.base import BASE_CONTROLS, BASE_POLICIES, AMLTemplateBase


def get_template(risk_level: str = "medium") -> AMLTemplateBase:
    t = AMLTemplateBase(industry="dpms", risk_level=risk_level)
    t.has_ifti_obligation = False
    t.has_ttr_obligation = True
    t.has_travel_rule = False
    t.is_tranche_2 = True

    t.scope = (
        "This Program applies to the Organisation's designated service of buying "
        "and selling bullion, precious metals, and precious stones as a dealer, "
        "under the AML/CTF Act 2006 as amended by the 2024 Amendment Act "
        "(Tranche 2, commencing 1 July 2026 anticipated). It covers all cash and "
        "non-cash purchases and sales, all customer-facing staff, and all "
        "locations at which the Organisation trades.\n\n"
        "In-scope precious metals and stones include gold, silver, platinum, "
        "palladium, rhodium and their alloys (bar, coin, granule, ingot, "
        "jewellery, or other form), and natural or synthetic diamonds, rubies, "
        "emeralds, sapphires and other gemstones, whether cut or uncut. "
        "'Related products' — jewellery and luxury watches whose value is "
        "substantially derived from precious metals or stones — are in scope "
        "on the same basis (Risk Matrix PR-05)."
    )

    t.designated_services = (
        "The Organisation provides the designated service of dealing in bullion, "
        "precious metals or precious stones (buying, selling, or exchanging) as "
        "listed in the AML/CTF Act's designated services table.\n\n"
        "As a Tranche 2 reporting entity, IFTI reporting and the Travel Rule do "
        "not apply unless the Organisation separately provides remittance or "
        "virtual asset transfer services. Threshold Transaction Reporting DOES "
        "apply — see below — because cash acceptance is central to this "
        "designated service, not incidental to it."
    )

    t.ewra_summary = (
        "The Organisation's Enterprise-Wide Risk Assessment follows the real "
        "VERIGO_DPMS_Risk_Matrix_v1.xlsx (ISO 31000:2018, 5x5 likelihood x "
        "consequence). Of 20 assessed risks, 4 are inherently CRITICAL (cash "
        "transactions >= AUD $10,000 CT-01, structuring CT-02, walk-in retail "
        "customers CR-01, and gold bullion as a product PR-01), 13 are HIGH, "
        "and 3 are MEDIUM — no risk on the real matrix is inherently LOW. After "
        "controls, the matrix shows a 66% average risk reduction, with no "
        "residual risk remaining HIGH or above and the highest residual score "
        "at 8/25 (MEDIUM). 17 of the 20 risks require Director approval at some "
        "point in their control chain, and 9 carry an explicit SMR "
        "consideration trigger at the inherent-risk stage alone."
    )

    t.risk_factors_customer = (
        "DPMS-specific customer risk factors (Risk Matrix Customer Risk "
        "category, CR-01 to CR-04):\n"
        "- CR-01 — walk-in retail customer: anonymous, no established "
        "relationship, high-value cash purchase — the most frequent DPMS ML "
        "typology in Australia, since no prior relationship means no OCDD "
        "baseline exists yet (CRITICAL, 20/25);\n"
        "- CR-02 — PEP purchasing or selling precious metals or stones, which "
        "can store proceeds of corruption in portable, discreet, high-value "
        "form (MEDIUM, 10/25);\n"
        "- CR-03 — wholesale trade customer with unverified business "
        "registration or no trading history, used to insert a 'legitimate "
        "business' layer into gold ML chains (HIGH, 12/25);\n"
        "- CR-04 — customer purchasing on behalf of an undisclosed third party "
        "('mule' purchaser) — multiple individuals making separate purchases "
        "on behalf of a common controller (HIGH, 16/25)."
    )

    t.risk_factors_product = (
        "DPMS-specific product risk factors (Risk Matrix Product/Service Risk "
        "category, PR-01 to PR-05):\n"
        "- PR-01 — gold bullion (bars, coins): the sector's highest-risk "
        "product, portable, anonymous, internationally fungible, and a store "
        "of value (a 1kg gold bar is worth roughly AUD $120,000) (CRITICAL, "
        "25/25 — tied with CT-01/CT-02 as the highest scores on the matrix);\n"
        "- PR-02 — precious metals of unknown or undocumented provenance "
        "presented for purchase or refining — the Australian typology of "
        "stolen gold sold to DPMS without provenance checks (HIGH, 16/25);\n"
        "- PR-03 — rapid buy-back: customer sells back recently purchased "
        "metals within 90 days, particularly at a loss — an ML integration "
        "technique that generates a 'clean' record with a small loss (HIGH, "
        "12/25);\n"
        "- PR-04 — high-value gemstones and diamonds, sharing gold's ML "
        "characteristics but lacking standardised pricing, making value "
        "manipulation harder to detect (HIGH, 12/25);\n"
        "- PR-05 — luxury watches and high-value jewellery — a growing "
        "secondary-market ML typology (MEDIUM, 9/25)."
    )

    t.risk_factors_channel = (
        "DPMS-specific delivery channel risk factors (Risk Matrix Delivery "
        "Channel Risk category, DC-01 to DC-02):\n"
        "- DC-01 — online or remote precious-metal sales with no in-person "
        "identity verification — enables anonymous or pseudonymous purchases "
        "that bypass in-person CDD (HIGH, 12/25);\n"
        "- DC-02 — cryptocurrency tendered as payment for precious metals, "
        "circumventing traditional AML/CTF controls and creating source-of-"
        "funds opacity — an emerging Australian crypto-to-gold conversion "
        "typology (MEDIUM, 10/25). Cryptocurrency payment requires a "
        "blockchain analytics report and Director approval before proceeding "
        "(see cdd_enhanced_procedures)."
    )

    t.risk_factors_geography = (
        "DPMS-specific geographic and sanctions risk factors (Risk Matrix "
        "Sanctions/Geographic Risk category, SG-01 to SG-02):\n"
        "- SG-01 — precious metals from or destined for sanctioned "
        "jurisdictions. Gold and precious metals are a primary global "
        "sanctions-evasion tool; Russian gold is specifically sanctioned "
        "under UNSCR and DFAT measures (HIGH, 15/25);\n"
        "- SG-02 — customer from, or transaction involving, a FATF grey-list "
        "or black-list jurisdiction (HIGH, 12/25).\n\n"
        "Russian-origin gold, Iranian-origin gold and precious metals, North "
        "Korean-origin metals, and Myanmar-origin jade and precious stones "
        "must NEVER be purchased or sold under any circumstances. Any "
        "suspicion of sanctioned-origin metals requires immediate cessation "
        "of dealings, CO and Director notification, AFP notification within "
        "24 hours, and an SMR within 24 hours (see sanctions_procedures)."
    )

    t.risk_factors_proliferation = (
        "DPMS carries the highest direct proliferation-financing (PF) "
        "exposure of any Tranche 2 designated service provider: gold, "
        "silver, platinum, and diamonds are directly usable for PF and "
        "sanctions evasion, DPRK uses gold exports to fund its weapons "
        "programme, and Iran uses precious metals to evade financial "
        "sanctions.\n\n"
        "PF indicators specific to this sector include: precious metals of "
        "DPRK, Iranian, Russian, or Myanmar origin; a wholesale gold purchase "
        "from a supplier in a PF-sanctioned jurisdiction, even through an "
        "intermediary country; gold with characteristics consistent with "
        "artisanal mining in a DPRK- or Iranian-controlled area; a "
        "state-owned entity from a sanctioned country seeking to purchase or "
        "sell precious metals in Australia; and payment routed through a "
        "financial institution in a PF-sanctioned jurisdiction.\n\n"
        "The Organisation screens against UN Security Council PF-related "
        "resolutions (DPRK, Iran) and DFAT PF-related sanctions, in addition "
        "to standard sanctions screening (see sanctions_procedures)."
    )

    t.cdd_individuals = (
        "For individual customers, the Organisation collects and verifies (per "
        "KYC-G01 Part C):\n\n"
        "IDENTIFICATION:\n"
        "- Full legal name, date of birth, residential address (not a PO Box);\n"
        "- For sole traders: ABN and principal place of business address;\n"
        "- For medium/high-risk individuals: occupation, source of funds for "
        "the specific transaction, source of wealth (high-risk/foreign PEPs), "
        "expected transaction activity, any alias names, transaction purpose;\n"
        "- Source of cash funds for any transaction at or above AUD $10,000, "
        "and (for cash > AUD $50,000) bank statements or wealth declaration;\n"
        "- Provenance of any metals or stones presented for purchase or trade.\n\n"
        "VERIFICATION — must use at least one of:\n"
        "- Primary photographic ID (Australian passport, driver's licence, "
        "foreign passport with certified translation, foreign national ID);\n"
        "- Electronic verification via an approved eKYC provider;\n"
        "- Non-standard procedure (primary non-photographic ID plus a "
        "secondary document issued within 3 months) — CO approval required.\n\n"
        "CDD MUST BE COMPLETED BEFORE completing any single transaction (or "
        "related series of transactions) at or above AUD $10,000 in cash or "
        "non-cash payment. The AUD $10,000 threshold is a CDD and TTR "
        "trigger — it is NOT a structuring threshold: deliberately splitting "
        "transactions below it is a criminal offence under AML/CTF Act s.142, "
        "for both the customer and any staff member who assists."
    )

    t.cdd_enhanced_procedures = (
        "ECDD is mandatory where any of the following triggers apply (ECDD-G01 "
        "Part B, cross-referenced to the Risk Matrix):\n\n"
        "SECTOR-SPECIFIC TRIGGERS:\n"
        "- Cash transaction at or above AUD $10,000 (Risk Matrix CT-01, "
        "CRITICAL) — CDD and TTR mandatory; cash > AUD $50,000 additionally "
        "requires source-of-funds documentary evidence and Director approval "
        "before proceeding;\n"
        "- Structuring indicators — multiple near-threshold transactions "
        "(Risk Matrix CT-02, CRITICAL, criminal-offence risk) — do not "
        "complete the pending transaction, notify the CO without alerting "
        "the customer, apply CDD to the cumulative value, lodge an SMR;\n"
        "- Very large cash transaction > AUD $100,000 (Risk Matrix CT-03, "
        "HIGH) — full documentary source-of-funds evidence and Director "
        "approval mandatory regardless of other risk factors;\n"
        "- Gold bullion purchase — all-cash, walk-in customer, no "
        "established relationship (Risk Matrix PR-01, CRITICAL);\n"
        "- Precious metals of unknown or uncertain provenance (Risk Matrix "
        "PR-02, HIGH) — independent documentary provenance evidence "
        "required (purchase receipt, mining/smelting certificate, hallmark "
        "documentation, or gemological certificate); ECDD + Director "
        "approval before purchase where provenance cannot be established;\n"
        "- Rapid buy-back — customer sells back recently purchased metals at "
        "a loss within 90 days (Risk Matrix PR-03, HIGH) — source of the "
        "original purchase funds re-assessed; SMR consideration mandatory;\n"
        "- Cryptocurrency payment tendered for precious metals (Risk Matrix "
        "DC-02, MEDIUM) — blockchain analytics report required (Chainalysis, "
        "Elliptic, or equivalent); Director approval before completing the "
        "transaction; decline where analytics indicate mixing services, "
        "darknet, or sanctioned wallet activity;\n"
        "- Customer purchasing on behalf of an undisclosed third party — "
        "mule indicators (Risk Matrix CR-04, HIGH);\n"
        "- Precious metals from sanctioned jurisdictions — Russia, Iran, "
        "DPRK, Myanmar (Risk Matrix SG-01, HIGH) — never purchase or sell; "
        "immediately cease dealings; notify CO and Director; AFP within 24 "
        "hours; SMR within 24 hours;\n"
        "- Customer from a FATF grey/black-list jurisdiction (Risk Matrix "
        "SG-02, HIGH);\n"
        "- PEP purchasing or selling precious metals or stones (Risk Matrix "
        "CR-02) — PEP self-declaration, commercial PEP database search, "
        "source of wealth from independent evidence, Director approval "
        "before completing any transaction with a foreign PEP.\n\n"
        "APPROVAL AUTHORITY: CO approval is required for all ECDD cases; "
        "Director approval is additionally required for cash > AUD $50,000, "
        "cryptocurrency payments, and PEP transactions; Board approval is "
        "required before establishing or continuing a relationship with a "
        "foreign PEP.\n\n"
        "Every ECDD case is documented in an ECDD Case File recording the "
        "trigger, customer profile, measures applied, approval workflow, and "
        "outcome, including a mandatory documented SMR consideration."
    )

    t.ongoing_cdd = (
        "OCDD review frequency is calibrated to customer risk rating "
        "(KYC-G01 Part G): LOW — annually or on trigger event; MEDIUM — "
        "every 6 months or on trigger event; HIGH — every 3 months or on "
        "trigger event; foreign PEP — quarterly minimum, or monthly for the "
        "first 12 months post-ECDD approval.\n\n"
        "Sector-specific trigger events requiring updated CDD include: a "
        "transaction or series of transactions exceeding AUD $10,000; "
        "transaction volume increasing by 100% within 5 calendar days; a "
        "cumulative transaction value reaching or approaching AUD $10,000 "
        "within a short period; a buy-back or sell-back request from a "
        "customer who recently purchased from the Organisation; and precious "
        "metals or stones of uncertain provenance presented for purchase or "
        "refining.\n\n"
        "Each OCDD review re-screens the customer against current DFAT/UN "
        "sanctions lists and PEP databases, reviews transaction activity "
        "since the last review, and re-assesses the customer's risk rating."
    )

    t.beneficial_ownership_procedures = (
        "For all non-individual customers, the Organisation identifies and "
        "verifies each beneficial owner (>= 25% ownership or effective "
        "control), tracing through intermediate entities to the ultimate "
        "natural person.\n\n"
        "WHOLESALE CUSTOMERS (Risk Matrix CR-03): before any first "
        "transaction, the Organisation conducts entity KYC including an ASIC "
        "company search, beneficial ownership verification, and an "
        "assessment of business licence and trading history. ECDD applies to "
        "newly-registered entities (< 2 years), entities from high-risk "
        "jurisdictions, or entities with no verifiable business activity — "
        "a known Australian typology for inserting a 'legitimate business' "
        "layer into gold ML chains. Ongoing wholesale relationships receive "
        "an annual OCDD review.\n\n"
        "Where the beneficial owner cannot be identified after these steps, "
        "CO review is required and the Organisation considers whether to "
        "proceed and whether an SMR is warranted."
    )

    t.pep_procedures = (
        "IDENTIFICATION: PEP screening is conducted at customer onboarding "
        "and at each OCDD review, via customer self-declaration, a "
        "commercial PEP database search, and (for foreign PEPs) adverse "
        "media and government-issued PEP lists relevant to the customer's "
        "jurisdiction.\n\n"
        "RISK RATING: PEPs are rated MEDIUM inherent risk on the real Risk "
        "Matrix (CR-02, 10/25) — lower than the sector's cash and product "
        "risks, but PEPs may still use precious metals and gemstones to "
        "store proceeds of corruption in portable, discreet, high-value "
        "form.\n\n"
        "FOREIGN PEPs: ECDD is mandatory regardless of other risk factors. "
        "Board/Director approval is required before establishing or "
        "continuing the relationship. Source of wealth and source of funds "
        "must be established from independent documentary evidence. Enhanced "
        "OCDD applies — quarterly minimum, or monthly for the first 12 "
        "months.\n\n"
        "DOMESTIC PEPs: risk-based — the CO assesses whether high ML/TF risk "
        "applies; if so, the same measures as for foreign PEPs apply.\n\n"
        "The Organisation will NOT establish or continue a business "
        "relationship with a foreign PEP without prior Board/Director "
        "approval documented in writing, and will NOT complete any "
        "transaction with a PEP without Director approval."
    )

    t.sanctions_procedures = (
        "The Organisation maintains a zero-tolerance approach to dealings "
        "with sanctioned persons, entities, vessels, countries, or "
        "activities (Sanctions Policy VERIGO-DPMS-SANC-P01).\n\n"
        "MANDATORY LISTS — accessed LIVE at the time of screening, never "
        "cached: DFAT Consolidated Sanctions List; UN Security Council "
        "Consolidated List; Australian listed terrorist organisations; "
        "Criminal Code Regulations 2002 list; and DFAT's Russia, Iran, "
        "DPRK, and Myanmar regime-specific lists (all four directly relevant "
        "to precious-metals sanctions evasion).\n\n"
        "WHO IS SCREENED: customer, beneficial owners, directors/trustees, "
        "authorised representatives, counterparties, third-party payers, the "
        "country of origin of purchased precious metals, wholesale suppliers, "
        "and any refinery or smelter involved — before onboarding, before "
        "each significant transaction, at each OCDD review, before "
        "purchasing precious metals from any party, and before each "
        "wholesale transaction.\n\n"
        "SANCTIONED PRECIOUS METALS — PROHIBITED IN ALL CIRCUMSTANCES: "
        "Russian-origin gold; Iranian-origin gold and precious metals; North "
        "Korean-origin metals; and Myanmar-origin jade and precious stones.\n\n"
        "CONFIRMED MATCH — immediate response:\n"
        "1. Immediately cease all dealings with the matched party;\n"
        "2. Do NOT tip off the matched party;\n"
        "3. Notify the AML/CTF Compliance Officer within 15 minutes;\n"
        "4. Notify the Director/Managing Partner immediately;\n"
        "5. Quarantine any metals of sanctioned-country origin — do not "
        "sell, process, export, or return them to the customer pending "
        "AFP and DFAT direction;\n"
        "6. Notify the AFP within 24 hours (131 AFP);\n"
        "7. Lodge an SMR with AUSTRAC within 24 hours;\n"
        "8. Seek legal advice on asset-freezing obligations under the "
        "Charter of the United Nations Act 1945.\n\n"
        "All screening and confirmed-match actions are recorded in the "
        "Sanctions Screening Log and retained for 7 years."
    )

    t.ttr_procedures = (
        "OBLIGATION: The Organisation must report a Threshold Transaction Report "
        "(TTR) to AUSTRAC within 10 business days for any cash transaction of "
        "AUD $10,000 or more (DPMS-01 — the sector's primary monitoring rule). "
        "The AUD $10,000 threshold is a CDD and TTR trigger, NOT a structuring "
        "threshold — deliberately splitting transactions below it is a "
        "criminal offence under AML/CTF Act s.142, for both the customer and "
        "any staff member who assists.\n\n"
        "DPMS-01 — CASH TRANSACTION AT OR ABOVE AUD $10,000: CDD and TTR are "
        "mandatory for any cash purchase or sale at or above this threshold. "
        "Cash is a normal and expected part of this designated service — it "
        "must be accepted, verified, and reported, not declined. A receipt is "
        "issued regardless of customer preference.\n\n"
        "DPMS-03 — VERY LARGE CASH TRANSACTIONS (>= AUD $100,000): require "
        "ECDD, full documentary source-of-funds evidence, and Director "
        "sign-off in addition to standard CDD/TTR, regardless of customer "
        "risk rating.\n\n"
        "TTR obligations are separate from and in addition to SMR "
        "obligations — a transaction may require both a TTR (for the "
        "physical currency element) and an SMR (where suspicion is also "
        "formed).\n\n"
        "Records of cash transactions, structuring assessments, and any "
        "Director sign-offs are retained per the record-keeping obligations "
        "in Section 12."
    )

    t.ifti_procedures = (
        "IFTI reporting does not apply to this Organisation's designated services."
    )

    t.transaction_monitoring = (
        "The Organisation operates a rules-based Transaction Monitoring "
        "Program (TMP-G01) combining 10 general AML/CTF rules and 12 "
        "DPMS-sector-specific rules, calibrated to the Risk Matrix. "
        "Monitoring intensity is tiered to customer risk rating: LOW gets "
        "weekly batch review at standard thresholds; MEDIUM gets weekly "
        "manual review at 80% of standard thresholds; HIGH gets daily review "
        "at 60% of standard thresholds; foreign PEPs get daily review at 50% "
        "of standard thresholds with Director notified of every alert; a "
        "sanctions match means immediate cessation.\n\n"
        "GENERAL RULES (GEN-01 to GEN-10): physical currency >= AUD $10,000 "
        "(TTR trigger); volume increase >= 100% in 5 days; sanctions match; "
        "PEP with no/lapsed ECDD; structuring (>= 2 near-threshold "
        "transactions within 3 days); baseline deviation; unidentified "
        "third-party funds; high-risk jurisdiction funds; rapid fund "
        "movement < 48 hours; unusual transaction arrangements.\n\n"
        "CASH TRANSACTION MONITORING — PRIMARY TMP FOCUS: consistent with the "
        "AUD $10,000 designated-service threshold, the CO maintains and "
        "reviews a daily cash transaction log every business day.\n\n"
        "DPMS-SECTOR RULES (DPMS-01 to DPMS-12), each with a defined "
        "threshold, review frequency, and responsible officer:\n"
        "- DPMS-01 — cash >= AUD $10,000 (TTR + CDD trigger): per "
        "transaction, CO;\n"
        "- DPMS-02 — structuring, >= 2 near-threshold transactions within 3 "
        "days totalling >= AUD $10,000: daily pattern review, CO;\n"
        "- DPMS-03 — cash >= AUD $100,000: per transaction, CO + Director;\n"
        "- DPMS-04 — rapid buy-back within 90 days at a loss: weekly review, "
        "CO;\n"
        "- DPMS-05 — gold bullion purchase, all-cash walk-in, no "
        "relationship: per transaction, CO;\n"
        "- DPMS-06 — unknown provenance metals presented for purchase: per "
        "purchase, CO;\n"
        "- DPMS-07 — cryptocurrency payment tendered: per transaction, CO + "
        "Director;\n"
        "- DPMS-08 — mule indicators, third-party purchasing: per "
        "transaction, CO;\n"
        "- DPMS-09 — wholesale volume > 200% of the customer's stated "
        "monthly purchasing range: monthly review, CO;\n"
        "- DPMS-10 — sanctioned-origin metals (Russia, Iran, DPRK, Myanmar): "
        "per transaction, CO + Director;\n"
        "- DPMS-11 — gemstone or luxury-watch purchase >= AUD $10,000 cash: "
        "per transaction, CO;\n"
        "- DPMS-12 — PEP purchasing or selling precious metals or stones: per "
        "transaction, CO + Director.\n\n"
        "STRUCTURING DETECTION: staff must never suggest a transaction amount "
        "to a customer or disclose the AUD $10,000 threshold — this is a "
        "criminal offence alongside the customer under AML/CTF Act s.142. "
        "Suspected structuring: do not complete the pending transaction, "
        "notify the CO without alerting the customer, assess the cumulative "
        "value, lodge an SMR.\n\n"
        "ALERT ASSESSMENT TIMEFRAMES: CRITICAL (sanctions/TF) = 1 hour, HIGH "
        "(structured/large cash/PEP/high-risk jurisdiction) = 24 hours, "
        "MEDIUM (baseline deviation/third-party funds) = 48 hours, LOW "
        "(minor deviation/first-time threshold) = 5 business days.\n\n"
        "Every alert is recorded in a TMP Alert Log and retained for 7 years."
    )

    t.smr_procedures = (
        "OBLIGATION: The Organisation must report a Suspicious Matter to "
        "AUSTRAC as soon as practicable and no later than 24 hours (terrorism "
        "financing) or 3 business days (all other matters) after the "
        "Compliance Officer forms a suspicion under s.41 of the AML/CTF Act. "
        "There is no minimum transaction value — a AUD $1 transaction can "
        "give rise to an SMR obligation, and the obligation is a continuing "
        "one even if the transaction has already occurred.\n\n"
        "SECTOR-SPECIFIC SMR TRIGGERS, the most commonly reported ML/TF "
        "typologies in AUSTRAC STR data for this sector (SMR-G01 Part E):\n"
        "1. CASH >= AUD $10,000 (AUSTRAC STR RANK #1) — an SMR MUST be "
        "assessed where the source of cash funds cannot be established or "
        "where the customer's profile is inconsistent with the transaction. "
        "A TTR must also be submitted — TTR and SMR are separate "
        "obligations that may both apply to the same transaction;\n"
        "2. STRUCTURING (AUSTRAC STR RANK #2, criminal offence under s.142) "
        "— multiple cash purchases by the same or associated customers "
        "individually below AUD $10,000 but collectively approaching or "
        "exceeding it. Staff must never alert the customer that structuring "
        "has been detected, nor advise of the threshold or how to avoid it;\n"
        "3. RAPID BUY-BACK (AUSTRAC STR RANK #3) — customer sells back "
        "recently purchased metals within 90 days, particularly at a loss, "
        "with no commercial explanation;\n"
        "4. Provenance — metals of unknown origin the customer cannot "
        "explain, or with sanctioned-jurisdiction indicators (immediate AFP "
        "notification and SMR within 24 hours);\n"
        "5. Cryptocurrency payment where blockchain analytics indicate "
        "high-risk wallet activity (mixing services, darknet, sanctioned "
        "addresses), or a customer purchasing on behalf of an undisclosed "
        "third party (mule scheme).\n\n"
        "PROCEDURE: employee escalates to the CO immediately, without "
        "investigating further or alerting the customer; CO reviews and "
        "determines whether a suspicion is formed; if confirmed, the SMR is "
        "lodged via AUSTRAC Online; the existence of an SMR decision — "
        "including a decision NOT to lodge — is retained in the SMR Internal "
        "Decision Log regardless of outcome (suspiciously low SMR rates for "
        "the Organisation's transaction volume are themselves an AUSTRAC red "
        "flag).\n\n"
        "TIPPING OFF: it is a criminal offence under s.123 (up to 2 years "
        "imprisonment) to disclose to any person, including the customer "
        "directly asking 'are you reporting me?', that a suspicion has been "
        "formed or an SMR has been or may be lodged. Unless AUSTRAC or the "
        "AFP directs otherwise, the Organisation continues to transact with "
        "the customer on the usual basis after lodging an SMR."
    )

    t.employee_due_diligence = (
        "In addition to standard pre-engagement and ongoing employee due "
        "diligence, the Organisation applies two DPMS-specific controls "
        "identified on the real Risk Matrix:\n\n"
        "ER-01 — STAFF FACILITATING STRUCTURING (HIGH, 15/25): staff who "
        "advise customers how to structure transactions below the AUD "
        "$10,000 threshold, or who knowingly complete structured "
        "transactions, commit a criminal offence alongside the customer "
        "(AML/CTF Act s.142). Staff are trained at induction and annually "
        "that this is a criminal offence, are prohibited from disclosing the "
        "threshold amount to customers, and are subject to transaction-log "
        "review for near-threshold patterns and random file audits. Any "
        "staff member confirmed to have assisted structuring is terminated "
        "immediately and referred to law enforcement.\n\n"
        "ER-02 — INCONSISTENT CDD AT POINT OF SALE (HIGH, 12/25): sales staff "
        "under volume pressure may fail to complete CDD for threshold "
        "transactions, particularly for regular or repeat customers who "
        "appear trustworthy. A CDD checklist is mandatory for every "
        "threshold transaction, manager sign-off is required before "
        "completing them, and quarterly file audits cover at least 10% of "
        "threshold transactions."
    )

    t.training_program_summary = (
        "In addition to the base AML/CTF training program, all customer-"
        "facing staff complete RATP Module M-10 — Red Flags, Scenarios and "
        "Sector-Specific Training for DPMS, delivered by the CO as an "
        "interactive workshop.\n\n"
        "AUSTRAC's top three reported ML/TF indicators for this sector: "
        "#1 cash purchases of gold bullion or coins at or near AUD $10,000 "
        "with no verifiable source of funds; #2 structuring (multiple "
        "purchases just below AUD $10,000); #3 rapid buy-back.\n\n"
        "Module M-10 works through real-world training scenarios — including "
        "'the threshold dancer' (two customers arriving together, each "
        "purchasing just under AUD $10,000), 'the mystery gold bars' "
        "(unmarked gold with Cyrillic hallmarks and no provenance, cash "
        "payment, ID declined), and 'the rapid buyback' (a customer selling "
        "back a $22,000 purchase three weeks later at a loss) — for each of "
        "which staff identify the red flag(s), the correct action, and who "
        "must be notified and when.\n\n"
        "Staff are drilled on what they can and cannot say when a customer "
        "asks about the reporting threshold or whether they are being "
        "reported: never disclose the threshold amount, never confirm or "
        "deny that a report is being made, and always notify the CO "
        "afterwards rather than confronting the customer directly."
    )

    t.record_keeping = (
        "In addition to the base 7-year retention obligation, the "
        "Organisation retains the following DPMS-specific records:\n\n"
        "- TMP Alert Logs — every screening alert, whether cleared, "
        "escalated, or SMR-lodged, including the daily cash transaction log "
        "reviews;\n"
        "- Sanctions Screening Logs — every screening outcome, including "
        "false-positive determinations with documented reasons, and the "
        "full Breach Notification Checklist for any confirmed match;\n"
        "- SMR Internal Decision Logs — for every escalated matter, whether "
        "or not an SMR was ultimately lodged;\n"
        "- ECDD Case Files — trigger, customer profile, measures applied, "
        "approval workflow, and outcome for every ECDD assessment;\n"
        "- Provenance documentation for all purchased metals and stones "
        "(purchase receipts, mining/smelting certificates, hallmark "
        "documentation, gemological certificates);\n"
        "- Cumulative-value structuring assessments and any Director "
        "sign-offs for cash >= AUD $100,000.\n\n"
        "All records must be stored securely, easily retrievable, and "
        "available for production to an AUSTRAC authorised officer within a "
        "reasonable period."
    )

    t.independent_review = (
        "Given the real Risk Matrix's CRITICAL-rated inherent risks (cash "
        "transactions >= AUD $10,000 CT-01, structuring CT-02, walk-in "
        "retail customers CR-01, and gold bullion PR-01 — all 20-25/25), the "
        "AML/CTF Program is independently reviewed ANNUALLY rather than the "
        "base 3-year cycle.\n\n"
        "The review must additionally be brought forward:\n"
        "- Within 12 months of a material change to the business, customer "
        "base, or regulatory obligations;\n"
        "- As directed by AUSTRAC;\n"
        "- A Tranche 2 readiness assessment must be completed before 1 July "
        "2026.\n\n"
        "SCOPE: the review specifically tests cash-threshold and structuring "
        "detection effectiveness, provenance and rapid-buy-back monitoring, "
        "sanctioned-metals screening, and SMR/TTR decision-log completeness, "
        "in addition to the Program's general effectiveness.\n\n"
        "REPORTING: results are reported to senior management (Board or "
        "equivalent) and findings must be actioned and documented."
    )

    extra_controls = [
        {
            "control_ref": "CTL-010",
            "title": "Cash Transaction Threshold Monitoring (DPMS-01)",
            "control_type": "detective",
            "risk_area": "transaction_monitoring",
        },
        {
            "control_ref": "CTL-011",
            "title": "Structuring Detection and Staff Prohibition (DPMS-02)",
            "control_type": "preventive",
            "risk_area": "transaction_monitoring",
        },
        {
            "control_ref": "CTL-012",
            "title": "Director Sign-off for Cash Transactions >= AUD $100,000",
            "control_type": "preventive",
            "risk_area": "high_value_transactions",
        },
        {
            "control_ref": "CTL-013",
            "title": "Metals/Stones Provenance and Sanctioned-Origin Check",
            "control_type": "preventive",
            "risk_area": "product_risk",
        },
        {
            "control_ref": "CTL-014",
            "title": "Rapid Buy-Back Monitoring (90-Day Window)",
            "control_type": "detective",
            "risk_area": "product_risk",
        },
        {
            "control_ref": "CTL-015",
            "title": "Cryptocurrency Payment Blockchain Analytics Review",
            "control_type": "detective",
            "risk_area": "delivery_channel",
        },
        {
            "control_ref": "CTL-016",
            "title": "Wholesale Customer Entity KYC and Trading History Check",
            "control_type": "preventive",
            "risk_area": "kyc",
        },
    ]

    t._policies = copy.deepcopy(BASE_POLICIES) + [
        {"title": "Cash Transaction & TTR Policy", "policy_type": "reporting"},
        {
            "title": "Structuring Detection Policy",
            "policy_type": "transaction_monitoring",
        },
        {"title": "Precious Metals Provenance Policy", "policy_type": "kyc"},
        {"title": "Sanctioned Metals Prohibition Policy", "policy_type": "sanctions"},
    ]
    t._controls = copy.deepcopy(BASE_CONTROLS) + extra_controls

    return t
