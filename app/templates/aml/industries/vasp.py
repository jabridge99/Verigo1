"""
Virtual Asset Service Provider (VASP) / Cryptocurrency exchange AML template.
Tranche 1 — IFTI ✓  Travel Rule ✓  TTR (physical-currency component only) ✓

Content is drawn from the Organisation's real VERIGO_VASP_* document suite:
AMLCTFProgram, KYC_Guideline (VERIGO-VASP-KYC-G01), ECDD_Guideline
(VERIGO-VASP-ECDD-G01), TMP_Guideline (VERIGO-VASP-TMP-G01), SMR_Guideline
(VERIGO-VASP-SMR-G01), Sanctions_Policy (VERIGO-VASP-SANC-P01),
TravelRule_Guideline, RATP_Addendum (VERIGO-VASP-RATP-A01, Module M-10) and
the Risk_Matrix (ISO 31000:2018, 16-row inherent/residual register).

Travel Rule threshold: the real Travel Rule Guideline confirms authoritatively
that there is NO minimum threshold under the AML/CTF Rules 2025 s.23 — every
virtual asset transfer, of any size, is in scope. The Organisation's separate
AUD $1,000 CDD-exemption threshold (for a non-customer withdrawing virtual
assets to a self-hosted wallet) is a different rule entirely and must not be
conflated with the Travel Rule threshold — this distinction is preserved
below.

Mixing/tumbling exposure (Risk Matrix PR-01, 25/25) is the ONLY CRITICAL-rated
risk tied for highest in the matrix alongside PR-05 (Travel Rule failure,
20/25) — FATF's own guidance names mixing/tumbling the "highest risk VA
typology." Both are made first-class, named controls rather than folded into
generic transaction-monitoring text.
"""

import copy

from app.templates.aml.base import BASE_CONTROLS, BASE_POLICIES, AMLTemplateBase


def get_template(risk_level: str = "medium") -> AMLTemplateBase:
    t = AMLTemplateBase(industry="cryptocurrency", risk_level=risk_level)
    t.has_ifti_obligation = True
    t.has_ttr_obligation = True  # physical-currency on/off-ramp component only
    t.has_travel_rule = True
    t.is_tranche_2 = False

    t.scope = (
        "This Program applies to all virtual asset services provided by the Organisation "
        "as a Virtual Asset Service Provider (VASP) registered with AUSTRAC. It covers:\n"
        "- Exchange of virtual assets for fiat currency (on/off ramps);\n"
        "- Exchange of one virtual asset for another;\n"
        "- Transfer of virtual assets, including VASP-to-VASP (B2B) transfers;\n"
        "- Safekeeping or custody of virtual assets or keys;\n"
        "- Participation in and provision of financial services for ICOs/token sales.\n\n"
        "The 2024 Amendment Act expanded the definition of 'virtual asset' to include "
        "stablecoins, NFTs with financial characteristics, and other digital representations "
        "of value. All such assets are in scope of this Program."
    )

    t.designated_services = (
        "The Organisation provides the following designated services under the AML/CTF Act:\n"
        "- Item 50D — Exchange service: exchanging virtual assets for money or other virtual "
        "assets on behalf of another person;\n"
        "- Item 50E — Transfer service: arranging for the transfer of virtual assets from one "
        "person to another;\n"
        "- Item 50F — Custody service: holding, storing, or administering virtual assets on "
        "behalf of another person;\n"
        "- Item 50G — Participation in financial services: participating in or providing "
        "financial services related to the offering or sale of virtual assets.\n\n"
        "AUSTRAC Registration: The Organisation must register with AUSTRAC as a VASP "
        "prior to providing any virtual asset service. Registration must be renewed "
        "every 3 years."
    )

    t.risk_factors_customer = (
        "Customer risk factors specific to VASP (Risk Matrix Customer Risk category, "
        "CR-01 to CR-05):\n"
        "- CR-01 — anonymous or pseudonymous onboarding: the primary ML risk for VASPs "
        "per FATF VA Guidance — customers can create accounts with limited identity "
        "information and conduct significant transactions before CDD is completed "
        "(CRITICAL, 20/25 — the highest customer-category inherent risk);\n"
        "- CR-02 — PEP using VASP services, exploiting the speed and pseudonymity of "
        "blockchain to convert and move corruption proceeds (HIGH, 15/25);\n"
        "- CR-03 — customer from a FATF grey/black-list jurisdiction (HIGH, 15/25);\n"
        "- CR-04 — non-individual customer (company/trust) with a complex or offshore "
        "structure used to layer proceeds through multiple entity layers and VA "
        "transfers (HIGH, 16/25);\n"
        "- CR-05 — other VASP (B2B) counterparty risk — nested ML/TF exposure from "
        "transacting with non-compliant or unregulated VASPs (HIGH, 12/25)."
    )

    t.risk_factors_product = (
        "Virtual asset-specific product/service risk factors (Risk Matrix "
        "Product/Service Risk category, PR-01 to PR-04):\n"
        "- PR-01 — mixing, tumbling, or privacy-enhancing service usage (e.g. Tornado "
        "Cash) and privacy coins (Monero, Zcash): FATF's own guidance names this the "
        "HIGHEST-RISK VA typology — deliberately obscures the blockchain trail, making "
        "the source of funds untraceable (CRITICAL, 25/25 — the highest inherent score "
        "in the entire Risk Matrix);\n"
        "- PR-02 — unhosted (self-custodied) wallet transactions, where the identity of "
        "the wallet controller cannot be verified through a third-party custodian "
        "(HIGH, 16/25);\n"
        "- PR-03 — DeFi protocol exposure — automated, pseudonymous financial services "
        "with no AML/CTF controls, potentially commingling customer funds with criminal "
        "proceeds (HIGH, 12/25);\n"
        "- PR-04 — stablecoin transactions — stability and interoperability create mass "
        "value transfer potential across jurisdictions at scale (HIGH, 12/25);\n\n"
        "Irreversibility of confirmed transactions and near-instant cross-border "
        "settlement compound each of the above."
    )

    t.risk_factors_channel = (
        "Delivery channel risk factors specific to VASP:\n"
        "- Fully digital, non-face-to-face onboarding via eKYC — the Organisation's "
        "only onboarding channel, per KYC Guideline Part I §26.1 — increases "
        "identity-fraud and synthetic-identity risk relative to in-person onboarding;\n"
        "- API and mobile application access, which may enable automated, high-volume "
        "account creation or transaction submission with reduced human oversight;\n"
        "- Peer-to-peer (P2P) trading facilitated by the platform, which bypasses "
        "centrally controlled transaction monitoring where the Organisation is not "
        "itself a party to the trade."
    )

    t.risk_factors_geography = (
        "Geographic risk factors specific to VASP (Risk Matrix Geographic Risk "
        "category, GR-01/GR-02):\n"
        "- GR-01 — VA transfers to/from FATF grey/black-list jurisdictions, frequently "
        "exploited for cross-border ML/TF via unregulated exchanges (HIGH, 15/25); "
        "the Organisation reviews the FATF list monthly and requires Director approval "
        "for any grey-list transfer, with black-list transfers considered for decline;\n"
        "- GR-02 — proliferation financing corridors (see risk_factors_proliferation) — "
        "rated LOW on likelihood but carries an immediate, mandatory escalation path "
        "regardless of score (5/25 inherent)."
    )

    t.risk_factors_proliferation = (
        "Proliferation financing (PF) risk for VASPs is assessed by FATF and the "
        "Organisation's own Sanctions Policy as the HIGHEST sector risk despite a LOW "
        "likelihood score — virtual assets are a primary mechanism for states subject "
        "to PF-related sanctions to raise and move funds for weapons of mass "
        "destruction (WMD) programmes (Risk Matrix GR-02).\n\n"
        "DPRK's Lazarus Group specifically uses VASPs as a primary channel to fund its "
        "WMD programme; Iran uses virtual assets to evade financial sanctions. All "
        "DPRK-connected and Iran-connected virtual asset transactions are PROHIBITED "
        "outright, not merely subject to enhanced review.\n\n"
        "PF INDICATORS specific to VASPs: a wallet address or customer connected to a "
        "DPRK-linked entity (Lazarus Group blockchain-analytics patterns); transactions "
        "involving a state-owned entity from DPRK or Iran; enquiries about converting "
        "large virtual asset amounts to dual-use goods or technology; and any "
        "transaction pattern consistent with known state-actor VA laundering.\n\n"
        "The Organisation screens all customers, counterparties, and wallet addresses "
        "against UN Security Council PF-related resolutions and DFAT PF-related "
        "sanctions lists — accessed live, never cached — before onboarding, before "
        "every transaction, and at each periodic review. A confirmed PF connection "
        "triggers immediate cessation, mandatory AFP referral, and an SMR within "
        "24 hours."
    )

    t.cdd_individuals = (
        "For individual customers, the Organisation collects and verifies (per "
        "KYC-G01 §9.1, all onboarding conducted digitally — Part I §26.1):\n\n"
        "IDENTIFICATION:\n"
        "- Full legal name, date of birth, residential address (not a PO Box);\n"
        "- For medium/high-risk customers: occupation, source of funds for the "
        "specific transaction, source of wealth, expected transaction behaviour, "
        "any alias names;\n"
        "- Primary blockchain wallet address(es) used with the Organisation;\n"
        "- Source of virtual asset funds (mining, exchange purchase, employment, "
        "other) and nature of VA activity (trading, investment, payments, DeFi);\n"
        "- Whether the customer uses unhosted wallets and for what stated purpose.\n\n"
        "VERIFICATION: electronic verification (eKYC) via an approved provider is "
        "mandatory for all individual customers — the Organisation's onboarding is "
        "fully digital. Liveness check required for medium/high-risk customers; "
        "enhanced eKYC plus video-call verification for very high-value customers "
        "or foreign PEPs."
    )

    t.cdd_enhanced_procedures = (
        "ECDD is mandatory where any of the following triggers apply (ECDD-G01 §4.1/§4.2, "
        "cross-referenced to the Risk Matrix):\n\n"
        "SECTOR-SPECIFIC TRIGGERS:\n"
        "- BLOCKCHAIN ANALYTICS — MIXING/TUMBLING/DARKNET/SANCTIONED ADDRESS EXPOSURE "
        "(Risk Matrix PR-01, CRITICAL) — ECDD mandatory, Director approval required "
        "before processing any transaction;\n"
        "- PRIVACY COIN TRANSACTIONS (Monero, Zcash) — ECDD mandatory for every "
        "instance regardless of other risk factors, Director approval required before "
        "processing, purpose documented and its plausibility assessed, decline "
        "considered if purpose cannot be established;\n"
        "- UNHOSTED WALLET transaction above the Organisation's ECDD threshold "
        "(Risk Matrix PR-02, HIGH) — wallet ownership verification plus blockchain "
        "analytics required, Director approval above the maximum unhosted threshold;\n"
        "- DeFi protocol exposure with high-risk characteristics (Risk Matrix PR-03) — "
        "ECDD and Director notification for material exposure;\n"
        "- TRAVEL RULE data missing or inconsistent (Risk Matrix PR-05) — ECDD applied "
        "to the transaction, CO assesses the risk of proceeding vs. declining;\n"
        "- VASP-TO-VASP counterparty from an unregulated or high-risk jurisdiction "
        "(Risk Matrix CR-05) — ECDD on the counterpart VASP's AML/CTF framework;\n"
        "- Foreign PEP (Risk Matrix CR-02) — see pep_procedures;\n"
        "- Customer or funds from a FATF grey/black-list jurisdiction (Risk Matrix "
        "CR-03/GR-01).\n\n"
        "APPROVAL AUTHORITY: privacy coin transactions and critical blockchain-analytics "
        "risk scores require CO + Director approval mandatory in every case; foreign "
        "PEPs require Board/Director approval; unhosted wallet transactions above the "
        "maximum threshold require CO + Director approval.\n\n"
        "Every ECDD case is documented in an ECDD Case File recording the trigger, "
        "customer profile, measures applied, approval workflow, and outcome, including "
        "a mandatory documented SMR consideration."
    )

    t.pep_procedures = (
        "IDENTIFICATION: At onboarding and on an ongoing basis, the Organisation "
        "screens all customers against PEP databases via commercial database search, "
        "internet/media search, government-issued PEP lists, and a mandatory customer "
        "self-declaration.\n\n"
        "PEP CATEGORIES: domestic PEPs, foreign PEPs, international organisation PEPs, "
        "and family members/close associates of all categories.\n\n"
        "DOMESTIC / INTERNATIONAL ORGANISATION PEPs: risk-based — the Compliance "
        "Officer assesses whether the customer presents high ML/TF/PF risk; if so, the "
        "same measures as for foreign PEPs apply.\n\n"
        "FOREIGN PEPs: ECDD is mandatory regardless of other risk factors. Board/"
        "Director approval is required before establishing or continuing the business "
        "relationship. Source of wealth and source of funds must be established from "
        "independent documentary evidence. Enhanced OCDD applies at quarterly minimum "
        "for the first 12 months, quarterly thereafter.\n\n"
        "The Organisation will NOT establish or continue a business relationship with "
        "a foreign PEP without prior Board/Director approval documented in writing."
    )

    t.sanctions_procedures = (
        "The Organisation complies with Australia's targeted financial sanctions "
        "obligations under the Charter of the United Nations Act 1945 and the "
        "Autonomous Sanctions Act 2011 (Sanctions Policy VERIGO-VASP-SANC-P01).\n\n"
        "MANDATORY LISTS — accessed LIVE at the time of screening, never cached:\n"
        "- DFAT Consolidated Sanctions List; UN Security Council Consolidated List;\n"
        "- Australian National Security listed terrorist organisations;\n"
        "- Criminal Code Regulations 2002 list;\n"
        "- DFAT DPRK / Iran / Russia regime-specific lists;\n"
        "- The Organisation's blockchain analytics sanctions watchlist, updated "
        "weekly, covering originating and destination wallet addresses on every "
        "transaction.\n\n"
        "WHO IS SCREENED: customer, beneficial owners, directors/trustees, "
        "authorised representatives, counterparties, third-party payers, originating "
        "and destination wallet addresses, and any VASP counterparty before a new "
        "B2B relationship is activated.\n\n"
        "PROLIFERATION FINANCING: rated the sector's HIGHEST risk despite a LOW "
        "likelihood score (see risk_factors_proliferation) — any DPRK- or "
        "Iran-connected wallet, customer, or counterparty is prohibited outright.\n\n"
        "CONFIRMED MATCH — immediate response:\n"
        "1. Cease all dealings with the matched party immediately — do not process "
        "or release any virtual asset;\n"
        "2. Do NOT tip off the matched party;\n"
        "3. Notify the Compliance Officer within 15 minutes;\n"
        "4. Notify the Director immediately;\n"
        "5. Freeze any virtual assets held on behalf of the matched party pending "
        "legal advice and AFP direction — do not return VA to the customer;\n"
        "6. Notify the AFP within 24 hours (131 AFP);\n"
        "7. Lodge an SMR within 24 hours;\n"
        "8. Seek legal advice on asset-freezing obligations under the Charter of the "
        "United Nations Act 1945.\n\n"
        "All screening and confirmed-match actions are recorded in the Sanctions "
        "Screening Log."
    )

    t.transaction_monitoring = (
        "The Organisation operates a rules-based Transaction Monitoring Program "
        "(TMP-G01) comprising three integrated components: automated/systematic "
        "monitoring against the Rules Schedule below, periodic manual review "
        "(weekly standard, daily for high-risk customers), and immediate "
        "trigger-based review.\n\n"
        "BLOCKCHAIN ANALYTICS IS THE PRIMARY TMP CONTROL for VASPs, replacing many "
        "of the manual reviews used in traditional financial services (§12.1). Every "
        "VA transaction must be screened before processing. Analytics alerts cannot "
        "be overridden by sales or operations staff without CO written approval.\n\n"
        "RISK-BASED MONITORING TIERS: monitoring frequency and alert thresholds scale "
        "with customer risk rating — LOW (weekly batch), MEDIUM (weekly + 80% "
        "thresholds), HIGH (daily + 60% thresholds), PEP-Foreign (daily + 50% "
        "thresholds, Director notified of alerts), Sanctions-Listed (immediate "
        "cessation, CO+Director+AFP).\n\n"
        "GENERAL RULES (GEN-01 to GEN-10): physical currency >= AUD $10,000; volume "
        "increase >= 100% in 5 days; sanctions match (auto-escalation); PEP with no/"
        "lapsed ECDD; structuring — near-threshold transactions; baseline deviation; "
        "third-party funds; high-risk jurisdiction; rapid fund movement < 48 hours; "
        "unusual transaction arrangements.\n\n"
        "SECTOR-SPECIFIC RULES (VASP-01 to VASP-12), each with a defined review "
        "frequency and responsible officer:\n"
        "- VASP-01 — blockchain analytics mixing/tumbling/darknet: per transaction, CO;\n"
        "- VASP-02 — unhosted wallet above ECDD threshold: per transaction, CO;\n"
        "- VASP-03 — privacy coin transaction: per transaction, CO + Director;\n"
        "- VASP-04 — rapid layering, multi-wallet dispersal < 24hrs: daily, CO;\n"
        "- VASP-05 — sanctioned wallet address: per transaction, CO + Director;\n"
        "- VASP-06 — Travel Rule data incomplete: per transfer, CO;\n"
        "- VASP-07 — high-risk DeFi protocol interaction: per transaction, CO;\n"
        "- VASP-08 — unregulated/high-risk VASP counterparty: per transfer, CO;\n"
        "- VASP-09 — transaction value surge > 300% of baseline: daily, CO;\n"
        "- VASP-10 — high-risk jurisdiction transaction: per transaction, CO;\n"
        "- VASP-11 — PEP, any VA transaction: per transaction, CO + Director;\n"
        "- VASP-12 — large cross-border stablecoin transfer from high-risk "
        "jurisdiction (> AUD $50,000): per transaction, CO.\n\n"
        "ALERT ASSESSMENT TIMEFRAMES: CRITICAL (sanctions/TF) = 1 hour, HIGH "
        "(structured/PEP/high-risk jurisdiction) = 24 hours, MEDIUM (baseline "
        "deviation/third-party funds) = 48 hours, LOW (minor deviation) = 5 business "
        "days.\n\n"
        "TRAVEL RULE MONITORING: every incoming VA transfer is reviewed for Travel "
        "Rule data completeness; a Travel Rule exception log records every instance "
        "of incomplete data, the CO's assessment, and the action taken.\n\n"
        "RAPID LAYERING DETECTION: any account where VA is received and immediately "
        "transferred to multiple different addresses within 24 hours is flagged; ECDD "
        "is triggered for confirmed patterns and an SMR consideration is mandatory "
        "where no legitimate purpose can be established.\n\n"
        "Every alert is recorded in a TMP Alert Log and retained for 7 years."
    )

    t.smr_procedures = (
        "OBLIGATION: The Organisation must report a Suspicious Matter to AUSTRAC as "
        "soon as practicable and no later than 24 hours (terrorism financing) or 3 "
        "business days (all other matters) after the Compliance Officer forms a "
        "suspicion under s.41 of the AML/CTF Act.\n\n"
        "SUSPICION STANDARD: lower than proof; no minimum transaction amount — a "
        "AUD $1 VA transaction can give rise to an SMR obligation; a continuing "
        "obligation that applies even where the transaction has already occurred.\n\n"
        "SECTOR-SPECIFIC SMR TRIGGERS, ranked by AUSTRAC/FATF priority for this "
        "sector (SMR-G01 Part E):\n"
        "1. BLOCKCHAIN ANALYTICS ALERTS (Rank #1) — mixing/tumbling, darknet, or "
        "sanctioned-address exposure MUST be assessed for SMR immediately; the fact "
        "that a transaction was halted does not remove the SMR obligation;\n"
        "2. UNHOSTED WALLET / PRIVACY COIN (Rank #2) — high-value unhosted wallet "
        "transaction where ownership cannot be verified after ECDD, or a privacy coin "
        "transaction with no established legitimate purpose;\n"
        "3. RAPID LAYERING (Rank #3) — VA received and immediately dispersed to "
        "multiple wallets with no apparent legitimate purpose;\n"
        "4. Travel Rule data gaps — CO cannot verify originator identity for a "
        "high-risk incoming transfer after escalation;\n"
        "5. DeFi exposure or non-compliant VASP counterparty that cannot be "
        "adequately explained.\n\n"
        "PROCEDURE: employee escalates to the Compliance Officer immediately; CO "
        "reviews and determines whether suspicion is formed; if confirmed, the SMR is "
        "lodged via AUSTRAC Online; the existence of an SMR decision — including a "
        "decision NOT to lodge — is retained in the SMR Internal Decision Log "
        "regardless of outcome.\n\n"
        "TIPPING OFF: it is a criminal offence under s.123 (up to 2 years "
        "imprisonment) to disclose to any person, including a VASP counterparty, that "
        "an SMR has been or may be submitted."
    )

    t.ttr_procedures = (
        "TTR obligations apply ONLY to the physical currency component of a "
        "designated service — virtual asset-only transactions do NOT trigger TTR "
        "obligations (AML/CTF Program §19.2/§23).\n\n"
        "Where a customer exchanges physical currency (banknotes) for virtual assets, "
        "or virtual assets for physical currency, at or above AUD $10,000, a TTR must "
        "be submitted within 10 business days.\n\n"
        "Where the Organisation's designated services are entirely electronic "
        "(no fiat cash acceptance or disbursement — e.g. bank transfer on/off-ramps "
        "only), this obligation does not arise in practice, but the Organisation must "
        "continue to monitor for any physical currency acceptance and apply this "
        "procedure immediately if the service offering changes.\n\n"
        "STRUCTURING: monitor for multiple related physical-currency transactions "
        "structured to remain below the AUD $10,000 threshold."
    )

    t.travel_rule_procedures = (
        "OBLIGATION: Under the AML/CTF Rules 2025 s.23, the Travel Rule applies to "
        "ALL virtual asset transfers regardless of value — there is NO minimum "
        "threshold under Australian law. This is stricter than the FATF threshold "
        "recommendation of USD/EUR 1,000 equivalent; even a AUD $1 VA transfer to "
        "another VASP is subject to full Travel Rule data requirements.\n\n"
        "OUTGOING VIRTUAL ASSET TRANSFERS — transmit to receiving VASP:\n"
        "- Originator: full name, wallet address, account number/reference, and "
        "address OR date of birth OR ID number;\n"
        "- Beneficiary: full name, wallet address.\n\n"
        "INCOMING VIRTUAL ASSET TRANSFERS — receive from sending VASP:\n"
        "- Verify Travel Rule information accompanies the transfer;\n"
        "- If receiving from a non-compliant VASP, apply enhanced due diligence "
        "(ECDD) and consider whether to proceed;\n"
        "- Transfers to/from self-hosted (unhosted) wallets require counterparty "
        "wallet-ownership verification above the Organisation's risk-based threshold.\n\n"
        "SUNRISE ISSUE: where the counterparty VASP is in a jurisdiction that has not "
        "yet implemented the Travel Rule, apply best-efforts procedures and document "
        "the approach.\n\n"
        "RECORDS: all Travel Rule information retained for 7 years.\n\n"
        "NOTE — separate, unrelated AUD $1,000 threshold: the AML/CTF Rules 2025 do "
        "contain an AUD $1,000 figure for VASPs, but it is a customer due diligence "
        "exemption (initial CDD is not required for a non-customer withdrawing less "
        "than $1,000 in virtual assets to a self-hosted wallet), not a Travel Rule "
        "threshold — the two must not be conflated."
    )

    t.ifti_procedures = (
        "OBLIGATION: Submit an IFTI report for every virtual asset transfer "
        "that constitutes an international funds transfer instruction.\n\n"
        "SCOPE: IFTI reporting applies where the Organisation sends or receives "
        "a transfer of virtual assets on behalf of a customer, where the "
        "counterparty is located outside Australia.\n\n"
        "REPORTING DEADLINE: Within 10 business days of the transfer.\n\n"
        "NOTE: Purely on-chain transfers between self-hosted wallets where the "
        "Organisation is not acting as an intermediary may not constitute an IFTI. "
        "Seek legal advice where scope is unclear."
    )

    t.independent_review = (
        "Given the Organisation's Tranche 1 obligations and its CRITICAL-rated "
        "inherent risks (mixing/tumbling exposure PR-01 and Travel Rule failure "
        "PR-05, both 25/20 out of 25 on the Risk Matrix), the AML/CTF Program is "
        "independently reviewed ANNUALLY (AML/CTF Program §25) — more frequently "
        "than the base 3-year cycle that applies to lower-risk reporting entities.\n\n"
        "The review must additionally be brought forward:\n"
        "- Whenever a significant change in ML/TF/PF risk occurs;\n"
        "- Whenever a new designated service, delivery method, or technology is "
        "adopted;\n"
        "- Following any SMR lodgement arising from a TMP alert, to assess whether "
        "the monitoring rules adequately captured the suspicious activity;\n"
        "- As directed by AUSTRAC.\n\n"
        "SCOPE: the review specifically tests blockchain analytics screening "
        "effectiveness, Travel Rule data completeness and transmission, ECDD "
        "trigger identification for sector-specific risks, and SMR Decision Log "
        "completeness, in addition to the Program's general effectiveness.\n\n"
        "REPORTING: results are reported to senior management (Board or "
        "equivalent) and findings must be actioned and documented."
    )

    extra_controls = [
        {
            "control_ref": "CTL-010",
            "title": "Blockchain Analytics Wallet Screening",
            "control_type": "detective",
            "risk_area": "transaction_monitoring",
        },
        {
            "control_ref": "CTL-011",
            "title": "Self-Hosted / Unhosted Wallet Risk Assessment",
            "control_type": "detective",
            "risk_area": "customer_risk",
        },
        {
            "control_ref": "CTL-012",
            "title": "Travel Rule — Virtual Asset Transfers",
            "control_type": "preventive",
            "risk_area": "travel_rule",
        },
        {
            "control_ref": "CTL-013",
            "title": "IFTI Reporting — Virtual Asset Transfers",
            "control_type": "detective",
            "risk_area": "ifti_reporting",
        },
        {
            "control_ref": "CTL-014",
            "title": "Mixing/Tumbling and Privacy Coin ECDD (PR-01)",
            "control_type": "preventive",
            "risk_area": "mixing_privacy_coins",
        },
        {
            "control_ref": "CTL-015",
            "title": "VASP-to-VASP (B2B) Counterparty Due Diligence",
            "control_type": "preventive",
            "risk_area": "vasp_counterparty",
        },
        {
            "control_ref": "CTL-016",
            "title": "Proliferation Financing Screening (DPRK/Iran)",
            "control_type": "preventive",
            "risk_area": "proliferation_financing",
        },
        {
            "control_ref": "CTL-017",
            "title": "Blockchain Analytics Alert Override Restriction",
            "control_type": "preventive",
            "risk_area": "employee_oversight",
        },
    ]

    t._policies = copy.deepcopy(BASE_POLICIES) + [
        {"title": "Virtual Asset Risk Policy", "policy_type": "virtual_asset"},
        {"title": "Travel Rule Compliance Policy", "policy_type": "travel_rule"},
        {
            "title": "Blockchain Analytics Policy",
            "policy_type": "transaction_monitoring",
        },
        {"title": "Self-Hosted Wallet Policy", "policy_type": "kyc"},
        {
            "title": "Mixing/Tumbling and Privacy Coin ECDD Policy",
            "policy_type": "ecdd",
        },
        {"title": "VASP Counterparty Due Diligence Policy", "policy_type": "kyc"},
    ]
    t._controls = copy.deepcopy(BASE_CONTROLS) + extra_controls

    return t
