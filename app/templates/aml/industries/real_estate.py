"""
Real Estate Agents AML template — Tranche 2 (new 2026 reform).
NO IFTI obligation. NO TTR obligation (no cash acceptance).
Key risks: third-party settlement funds, high-value/foreign purchasers,
FIRB compliance, settlement account manipulation, opacity of beneficial
ownership.

Content is drawn from the Organisation's real VERIGO_REA_* document suite:
AMLCTF_Template, KYC_Guideline (VERIGO-REA-KYC-G01), ECDD_Guideline
(VERIGO-REA-ECDD-G01), TMP_Guideline (VERIGO-REA-TMP-G01), SMR_Guideline
(VERIGO-REA-SMR-G01), Sanctions_Policy (VERIGO-REA-SANC-P01), RATP_Addendum
(VERIGO-REA-RATP-A01, Module M-10) and the Risk_Matrix (ISO 31000:2018,
27-row inherent/residual register — the largest of any sector's real matrix
reviewed this session).

Unlike Conveyancers (P19), which was forced onto this template before
getting its own, this module is genuinely written for real estate agents
(buyer's-agent language, cash-purchase framing) — but per PARKING_LOT.md
P22, it was still substantially thinner than the real REA document suite:
missing FIRB approval verification, the >AUD $3M mandatory source-of-funds
AND source-of-wealth threshold, nominee-purchaser CDD, off-the-plan
assignment CDD, SMSF/LRBA-specific triggers, and a dedicated
cryptocurrency-funded-settlement procedure. All are now covered below.
"""

import copy

from app.templates.aml.base import BASE_CONTROLS, BASE_POLICIES, AMLTemplateBase


def get_template(risk_level: str = "medium") -> AMLTemplateBase:
    t = AMLTemplateBase(industry="real_estate", risk_level=risk_level)
    t.has_ifti_obligation = False
    t.has_ttr_obligation = False
    t.has_travel_rule = False
    t.is_tranche_2 = True

    t.scope = (
        "This Program applies to all real estate services provided by the Organisation "
        "that constitute designated services under the AML/CTF Act 2006 as amended "
        "by the 2024 Amendment Act (Tranche 2, commencing 1 July 2026 anticipated).\n\n"
        "In-scope activities include:\n"
        "- Buying or selling real property on behalf of a customer;\n"
        "- Arranging the transfer or settlement of real property;\n"
        "- Off-the-plan sales and contract assignments;\n"
        "- Acting as a buyer's agent;\n"
        "- Vendor marketing and agency agreements.\n\n"
        "Out of scope: purely property management (leasing/rental) activities "
        "that do not involve property transactions are NOT a Tranche 2 designated "
        "service — however, trust account controls for rental receipts still apply "
        "under State/Territory property licensing legislation, and unusual rental "
        "payment patterns should still be escalated to the Compliance Officer."
    )

    t.designated_services = (
        "The Organisation provides real estate agency services that involve:\n"
        "- Acting as a real estate agent in the sale or purchase of real property "
        "(residential and commercial);\n"
        "- Coordinating settlement, including third-party and trust account fund "
        "flows;\n"
        "- Off-the-plan sales and buyer's agent services.\n\n"
        "As a Tranche 2 reporting entity, the Organisation does not have IFTI or "
        "TTR reporting obligations unless it separately provides remittance or "
        "cash-handling services. The Organisation does not accept cash payments "
        "(see ttr_procedures)."
    )

    t.risk_factors_customer = (
        "Real estate-specific customer risk factors (Risk Matrix Customer Risk "
        "category, CR-01 to CR-07, the largest category on the real Risk Matrix):\n"
        "- CR-01 — individual purchaser with a cash-funded settlement, particularly "
        "for properties AUD $500,000+ (CRITICAL, 20/25);\n"
        "- CR-02 — foreign buyer from a FATF grey/black-list jurisdiction, with "
        "FIRB non-disclosure risk (CRITICAL, 20/25);\n"
        "- CR-03 — domestic or foreign PEP as buyer or vendor, including family "
        "members and close associates (HIGH, 15/25);\n"
        "- CR-04 — company or trust purchaser with complex/opaque beneficial "
        "ownership used to layer through multiple entity levels (HIGH, 16/25);\n"
        "- CR-05 — SMSF purchaser with an LRBA or related-party transaction that "
        "may mask ML/TF through inflated valuations or undisclosed contribution "
        "sources (HIGH, 12/25);\n"
        "- CR-06 — nominee purchaser or bare trust concealing an undisclosed "
        "principal behind the named buyer (HIGH, 15/25);\n"
        "- CR-07 — developer or property syndicate in off-the-plan sales, "
        "vulnerable to deposit structuring and contract-assignment layering "
        "(HIGH, 12/25)."
    )

    t.risk_factors_product = (
        "Real estate-specific product/service risk factors (Risk Matrix "
        "Product/Service Risk category, PR-01 to PR-06):\n"
        "- PR-01 — third-party deposit or settlement funds, where the payer is "
        "not a party to the contract: AUSTRAC's most frequently reported real "
        "estate ML indicator (CRITICAL, 25/25 — the highest inherent score in "
        "the entire Risk Matrix);\n"
        "- PR-02 — high-value residential transaction exceeding AUD $3 million "
        "(HIGH, 15/25) — mandatory source of funds AND source of wealth "
        "documentation applies regardless of other risk factors;\n"
        "- PR-03 — commercial property transaction with a complex financing "
        "structure (sale-leaseback, vendor finance, mezzanine debt) that may "
        "obscure true financial flows (HIGH, 12/25);\n"
        "- PR-04 — rapid resale/property flipping — purchase and resale within "
        "12 months with no renovation or development justification (HIGH, 12/25);\n"
        "- PR-05 — off-market transaction with no competitive pricing process, "
        "used for value transfer between related parties (HIGH, 12/25);\n"
        "- PR-06 — property management trust account receipts from unverified "
        "sources — NOT itself a Tranche 2 designated service, but flagged for "
        "awareness where the Organisation also provides property management "
        "(MEDIUM, 9/25)."
    )

    t.risk_factors_channel = (
        "Delivery channel risks specific to real estate (Risk Matrix Delivery "
        "Channel Risk category, DC-01 to DC-03):\n"
        "- DC-01 — remote/digital onboarding where identity is not verified in "
        "person, increasing synthetic-identity and impersonation risk (HIGH, "
        "12/25);\n"
        "- DC-02 — digital platform/online listing inquiries made anonymously "
        "or pseudonymously before CDD is triggered at engagement (MEDIUM, 9/25);\n"
        "- DC-03 — cryptocurrency or virtual asset contribution to settlement, "
        "circumventing traditional AML/CTF controls and creating source-of-funds "
        "opacity (MEDIUM, 10/25 — ECDD and blockchain analytics mandatory, "
        "Director approval required before proceeding)."
    )

    t.risk_factors_geography = (
        "Geographic risk factors specific to real estate (Risk Matrix Geographic "
        "Risk category, GR-01 to GR-03):\n"
        "- GR-01 — funds originating from FATF grey/black-list jurisdictions "
        "(HIGH, 15/25); the Organisation reviews the FATF list monthly;\n"
        "- GR-02 — Foreign Investment Review Board (FIRB) non-disclosure or "
        "evasion — nominee purchasers, Australian-citizen fronts, or SMSFs used "
        "to circumvent FIRB requirements (HIGH, 12/25); potential ATO referral "
        "where evasion is suspected;\n"
        "- GR-03 — domestic high-risk precincts or property types with a known "
        "ML/TF or criminal history (MEDIUM, 6/25)."
    )

    t.risk_factors_proliferation = (
        "Proliferation financing (PF) risk is assessed as LOW for standard "
        "residential sales and elevated for commercial property transactions "
        "involving foreign state-owned entities or dual-use industry sectors "
        "(Risk Matrix SP-02, 5/25 inherent — but escalation is immediate and "
        "mandatory regardless of score).\n\n"
        "The Organisation screens all purchasers, vendors, and beneficial owners "
        "against UN Security Council PF-related resolutions and the DFAT "
        "Consolidated Sanctions List — accessed live, never cached — before "
        "engagement and periodically thereafter. A confirmed PF connection "
        "triggers immediate cessation, mandatory AFP referral, and an SMR within "
        "24 hours."
    )

    t.cdd_individuals = (
        "For individual customers (buyers and sellers), the Organisation "
        "collects and verifies (per KYC-G01 §9.1, §26):\n\n"
        "IDENTIFICATION:\n"
        "- Full legal name, date of birth, residential address;\n"
        "- For medium/high-risk individuals: occupation, source of funds for the "
        "specific transaction, source of wealth, expected transaction activity;\n"
        "- FIRB status for foreign individual purchasers;\n"
        "- Intended use of the property (investment, owner-occupier, "
        "development).\n\n"
        "CDD TIMING: for vendor agency, CDD on the vendor must be completed "
        "before signing the agency agreement and before listing the property. "
        "For buyer's agency, CDD on the buyer must be completed before "
        "submitting any offer or executing any contract. Dual agency requires "
        "CDD on both parties independently.\n\n"
        "HIGH-VALUE TRANSACTIONS (> AUD $3 million) — Risk Matrix PR-02:\n"
        "- Mandatory source of funds AND source of wealth documentation "
        "regardless of other risk factors;\n"
        "- Enhanced beneficial ownership verification;\n"
        "- Director sign-off on CDD adequacy before exchange of contracts;\n"
        "- Quarterly OCDD monitoring during extended settlement periods."
    )

    t.cdd_enhanced_procedures = (
        "ECDD is mandatory where any of the following triggers apply (ECDD-G01 "
        "§4.1/§4.2, cross-referenced to the Risk Matrix):\n\n"
        "SECTOR-SPECIFIC TRIGGERS:\n"
        "- THIRD-PARTY SETTLEMENT FUNDS (Risk Matrix PR-01, CRITICAL, AUSTRAC "
        "STR Rank #1) — full CDD on the third-party payer as if they were the "
        "client, written explanation obtained from the purchaser, source of "
        "funds independently documented, CO sign-off before the agent proceeds, "
        "SMR consideration mandatory if source is unexplained;\n"
        "- FOREIGN PURCHASER — FIRB (Risk Matrix GR-02) — FIRB approval status "
        "verified at onboarding, copy obtained and retained on file, nominee "
        "arrangements assessed for FIRB evasion, ATO referral where evasion is "
        "suspected;\n"
        "- SETTLEMENT ACCOUNT CHANGES (Risk Matrix, AUSTRAC STR Rank #3) — any "
        "change verified via out-of-band communication (a direct call to a "
        "known, previously verified number) before acceptance; changes within "
        "48 hours of settlement require CO + Director approval;\n"
        "- NOMINEE PURCHASER (Risk Matrix CR-06) — CDD on both the nominee and "
        "the underlying principal, written authority from the principal, "
        "Director approval where the rationale is unclear;\n"
        "- SMSF / LRBA PURCHASE (Risk Matrix CR-05) — CDD on all trustees and "
        "members, LRBA structure identified and documented, ECDD for "
        "unexplained or offshore contributions;\n"
        "- OFF-THE-PLAN CONTRACT ASSIGNMENT (Risk Matrix CR-07) — CDD on both "
        "the original purchaser and the assignee, ECDD for assignments at a "
        "significant premium or discount to the contract price;\n"
        "- CRYPTOCURRENCY-FUNDED SETTLEMENT (Risk Matrix DC-03) — a blockchain "
        "analytics report is mandatory, Director approval required before "
        "proceeding, SMR consideration mandatory, decline where analytics "
        "indicate mixing, darknet, or sanctioned-address exposure;\n"
        "- Property purchase price deviating > 15% from a documented "
        "comparative market analysis (Risk Matrix PR-05);\n"
        "- Foreign PEP as buyer or vendor (Risk Matrix CR-03).\n\n"
        "APPROVAL AUTHORITY: Director sign-off is mandatory for every "
        "transaction above AUD $3,000,000 and for third-party settlement funds "
        "where the source is unexplained; Board approval is required for "
        "foreign PEPs.\n\n"
        "Every ECDD case is documented in an ECDD Case File recording the "
        "trigger, customer profile, measures applied, approval workflow, and "
        "outcome, including a mandatory documented SMR consideration."
    )

    t.beneficial_ownership_procedures = (
        "Where a customer is purchasing through a company, trust, SMSF, or "
        "other structure:\n\n"
        "1. Identify all beneficial owners (individuals with >= 25% interest "
        "or effective control);\n"
        "2. Verify the identity of each beneficial owner;\n"
        "3. Obtain a beneficial ownership declaration signed by the customer;\n"
        "4. If beneficial ownership cannot be determined, do not proceed and "
        "report to the Compliance Officer;\n"
        "5. Where property is purchased by a trust, identify the trustee, "
        "settlor and all beneficiaries with a material interest;\n"
        "6. For SMSF purchasers: CDD on all trustees (individual and "
        "corporate) and all members; obtain the SMSF deed and confirm ATO ABN "
        "registration; where an LRBA is involved, identify the bare trustee "
        "and the lender.\n\n"
        "Nominee or 'straw man' purchases (buying in another person's name) "
        "are a significant red flag (Risk Matrix CR-06) and must be escalated "
        "immediately — CDD is required on both the nominee and the underlying "
        "principal, with written authority from the principal on file."
    )

    t.pep_procedures = (
        "IDENTIFICATION: At onboarding and on an ongoing basis, the Organisation "
        "screens all customers, beneficial owners, and directors/trustees "
        "against PEP databases via commercial database search, internet/media "
        "search, government-issued PEP lists, and a mandatory customer "
        "self-declaration.\n\n"
        "RISK RATING: PEPs (domestic or foreign) as buyer or vendor are rated "
        "HIGH inherent risk (Risk Matrix CR-03, 15/25) — PEPs may use real "
        "property to invest proceeds of corruption.\n\n"
        "FOREIGN PEPs: ECDD is mandatory regardless of other risk factors. "
        "Board/Director approval is required before proceeding. Source of "
        "wealth and source of funds must be established from independent "
        "documentary evidence. Enhanced OCDD applies at quarterly minimum "
        "throughout the transaction.\n\n"
        "DOMESTIC PEPs / close associates: risk-based — the Compliance "
        "Officer assesses whether high ML/TF risk applies; if so, the same "
        "measures as for foreign PEPs apply.\n\n"
        "The Organisation will NOT accept instructions for a foreign PEP "
        "without prior Board/Director approval documented in writing."
    )

    t.sanctions_procedures = (
        "The Organisation complies with Australia's targeted financial "
        "sanctions obligations under the Charter of the United Nations Act "
        "1945 and the Autonomous Sanctions Act 2011 (Sanctions Policy "
        "VERIGO-REA-SANC-P01).\n\n"
        "MANDATORY LISTS — accessed LIVE at the time of screening, never "
        "cached: DFAT Consolidated Sanctions List; UN Security Council "
        "Consolidated List; Australian listed terrorist organisations; "
        "Criminal Code Regulations 2002 list; DFAT Russia and Myanmar "
        "regime-specific lists.\n\n"
        "WHO IS SCREENED: customer, beneficial owners, directors/trustees, "
        "authorised representatives, counterparties, third-party payers, "
        "settlement counterparty banks (where offshore), and any off-the-plan "
        "developer — before exchange of contracts and again before settlement.\n\n"
        "SECTOR-SPECIFIC EVASION INDICATORS: a foreign purchaser using an "
        "Australian-citizen nominee to conceal beneficial ownership by a "
        "sanctioned party; settlement funds routed through multiple offshore "
        "accounts before reaching the trust account; property purchased "
        "significantly below market value as a value-transfer mechanism to a "
        "sanctioned party.\n\n"
        "CONFIRMED MATCH — immediate response:\n"
        "1. Cease all associated work immediately — do not proceed to the "
        "next stage of the transaction;\n"
        "2. Do NOT tip off the matched party;\n"
        "3. Notify the Compliance Officer within 15 minutes;\n"
        "4. Notify the Director/Managing Partner immediately;\n"
        "5. Cancel exchange of contracts if not yet exchanged; do not proceed "
        "to settlement; do not disburse any deposit held in trust;\n"
        "6. Notify the AFP within 24 hours (131 AFP);\n"
        "7. Lodge an SMR within 24 hours;\n"
        "8. Seek legal advice on asset-freezing obligations under the Charter "
        "of the United Nations Act 1945.\n\n"
        "All screening and confirmed-match actions are recorded in the "
        "Sanctions Screening Log."
    )

    t.transaction_monitoring = (
        "The Organisation operates a rules-based Transaction Monitoring "
        "Program (TMP-G01) combining 10 general AML/CTF rules and 12 "
        "real-estate-sector-specific rules, calibrated to the Risk Matrix.\n\n"
        "SETTLEMENT FUND MONITORING — PRIMARY TMP FOCUS: the primary TMP focus "
        "is the source, timing, and consistency of settlement funds with the "
        "purchaser's KYC profile. All settlement fund sources are confirmed "
        "against the purchaser's KYC profile before exchange of contracts for "
        "medium/high-risk transactions, and before settlement for all "
        "transactions. Any change in the source of settlement funds after "
        "exchange is immediately escalated to the Compliance Officer.\n\n"
        "GENERAL RULES (GEN-01 to GEN-10): physical currency >= AUD $10,000; "
        "volume increase >= 100% in 5 days; sanctions match; PEP with no/"
        "lapsed ECDD; structuring; baseline deviation; third-party unidentified "
        "funds; high-risk jurisdiction; rapid fund movement < 48 hours; "
        "unusual arrangements.\n\n"
        "SECTOR RULES (REA-01 to REA-12), each with a defined review "
        "frequency and responsible officer:\n"
        "- REA-01 — third-party settlement funds: per transaction, CO;\n"
        "- REA-02 — settlement account change post-exchange (AUSTRAC STR Rank "
        "#3): per change, CO + Director;\n"
        "- REA-03 — high-value residential transaction >= AUD $3,000,000: per "
        "transaction, CO + Director;\n"
        "- REA-04 — foreign purchaser, overseas wire transfer: per "
        "transaction, CO;\n"
        "- REA-05 — rapid resale, listed within 12 months of purchase: per "
        "listing, CO;\n"
        "- REA-06 — off-the-plan contract assignment: per assignment, CO;\n"
        "- REA-07 — 3+ purchasers with a common funding source in one "
        "project: per project, CO;\n"
        "- REA-08 — cryptocurrency contribution to settlement: per "
        "transaction, CO + Director;\n"
        "- REA-09 — SMSF unusual contribution > AUD $50,000: per transaction, "
        "CO;\n"
        "- REA-10 — nominee/bare trust mid-contract name change: per change, "
        "CO;\n"
        "- REA-11 — purchase price +/- 15% of comparable market value: per "
        "transaction, CO;\n"
        "- REA-12 — PEP purchaser or vendor: per transaction, CO + Director.\n\n"
        "ALERT ASSESSMENT TIMEFRAMES: CRITICAL (sanctions/TF) = 1 hour, HIGH "
        "(structured/PEP/high-risk jurisdiction) = 24 hours, MEDIUM (baseline "
        "deviation/third-party funds) = 48 hours, LOW (minor deviation) = 5 "
        "business days.\n\n"
        "Every alert is recorded in a TMP Alert Log and retained for 7 years."
    )

    t.smr_procedures = (
        "OBLIGATION: The Organisation must report a Suspicious Matter to "
        "AUSTRAC as soon as practicable and no later than 24 hours (terrorism "
        "financing) or 3 business days (all other matters) after the "
        "Compliance Officer forms a suspicion under s.41 of the AML/CTF Act.\n\n"
        "SUSPICION STANDARD: lower than proof; no minimum transaction value; a "
        "continuing obligation regardless of whether the transaction has "
        "already settled.\n\n"
        "SECTOR-SPECIFIC SMR TRIGGERS, the most commonly reported ML/TF "
        "typologies in AUSTRAC STR data for this sector (SMR-G01 §12):\n"
        "1. THIRD-PARTY SETTLEMENT FUNDS (AUSTRAC STR Rank #1) — an SMR MUST "
        "be assessed where settlement funds are received from a person not "
        "named in the contract of sale and the source cannot be adequately "
        "explained;\n"
        "2. SOURCE OF FUNDS UNKNOWN OR UNDISCLOSED (AUSTRAC STR Rank #2) — "
        "all-cash purchase, funds from a FATF grey/black-list jurisdiction, or "
        "an unexplained overseas wire transfer;\n"
        "3. SETTLEMENT ACCOUNT CHANGE AND MANIPULATION (AUSTRAC STR Rank #3) — "
        "account details changed after exchange and the change cannot be "
        "independently verified;\n"
        "4. Property flipping/value manipulation — rapid resale with no "
        "legitimate explanation, or a purchase price significantly below "
        "market value;\n"
        "5. Nominee, PEP, and beneficial ownership indicators — an "
        "unidentifiable ultimate principal or beneficial owner after ECDD.\n\n"
        "PROCEDURE: employee escalates to the Compliance Officer immediately; "
        "CO reviews and determines whether suspicion is formed; if "
        "confirmed, the SMR is lodged via AUSTRAC Online; the existence of "
        "an SMR decision — including a decision NOT to lodge — is retained "
        "in the SMR Internal Decision Log regardless of outcome.\n\n"
        "TIPPING OFF: it is a criminal offence under s.123 (up to 2 years "
        "imprisonment) to disclose to any person, including the purchaser's "
        "own solicitor or accountant, that an SMR has been or may be "
        "submitted."
    )

    t.ifti_procedures = (
        "IFTI reporting does not apply to this Organisation's designated real estate "
        "services. The Organisation does not transmit international funds transfer "
        "instructions as part of its designated services.\n\n"
        "If a customer wishes to use proceeds from an international funds transfer "
        "for a property purchase, the Organisation should request evidence of "
        "the transfer and its source as part of CDD."
    )

    t.ttr_procedures = (
        "TTR reporting obligations (physical currency >= AUD $10,000) do not apply "
        "to this Organisation's real estate services.\n\n"
        "The Organisation does NOT accept cash payments for property transactions. "
        "Any customer who offers cash must be declined and reported to the "
        "Compliance Officer, who will assess whether an SMR is warranted."
    )

    t.independent_review = (
        "Given the real Risk Matrix's CRITICAL-rated inherent risks (cash-"
        "funded settlement CR-01, foreign buyer non-disclosure CR-02, and "
        "third-party settlement funds PR-01 — all 20-25/25), the AML/CTF "
        "Program is independently reviewed ANNUALLY by a qualified external "
        "reviewer, rather than the base 3-year cycle.\n\n"
        "The review must additionally be brought forward:\n"
        "- Within 12 months of a material change to the business, customer "
        "base, or regulatory obligations;\n"
        "- As directed by AUSTRAC;\n"
        "- A Tranche 2 readiness assessment must be completed before 1 July "
        "2026.\n\n"
        "SCOPE: the review specifically tests third-party settlement fund "
        "controls, FIRB verification effectiveness, settlement account "
        "change verification, and SMR decision-log completeness (real "
        "estate agents have historically had low SMR submission rates, an "
        "AUSTRAC red flag), in addition to the Program's general "
        "effectiveness.\n\n"
        "REPORTING: results are reported to senior management (Board or "
        "equivalent) and findings must be actioned and documented."
    )

    extra_controls = [
        {
            "control_ref": "CTL-010",
            "title": "Source of Funds Verification — High-Value Property",
            "control_type": "preventive",
            "risk_area": "source_of_funds",
        },
        {
            "control_ref": "CTL-011",
            "title": "Beneficial Ownership — Property Purchasers",
            "control_type": "preventive",
            "risk_area": "beneficial_ownership",
        },
        {
            "control_ref": "CTL-012",
            "title": "Cash Payment Prohibition",
            "control_type": "preventive",
            "risk_area": "transaction_monitoring",
        },
        {
            "control_ref": "CTL-013",
            "title": "Trust Account Monitoring",
            "control_type": "detective",
            "risk_area": "trust_accounts",
        },
        {
            "control_ref": "CTL-014",
            "title": "Third-Party Settlement Funds Review (PR-01)",
            "control_type": "detective",
            "risk_area": "third_party_funds",
        },
        {
            "control_ref": "CTL-015",
            "title": "FIRB Status Verification — Foreign Purchasers",
            "control_type": "preventive",
            "risk_area": "firb_compliance",
        },
        {
            "control_ref": "CTL-016",
            "title": "Settlement Account Change — Out-of-Band Verification",
            "control_type": "preventive",
            "risk_area": "settlement_accounts",
        },
        {
            "control_ref": "CTL-017",
            "title": "Cryptocurrency-Funded Settlement ECDD",
            "control_type": "preventive",
            "risk_area": "virtual_assets",
        },
    ]

    t._policies = copy.deepcopy(BASE_POLICIES) + [
        {
            "title": "Source of Funds Policy — Property Transactions",
            "policy_type": "source_of_funds",
        },
        {
            "title": "Cash Payment Prohibition Policy",
            "policy_type": "transaction_monitoring",
        },
        {"title": "Trust Account AML Policy", "policy_type": "trust_accounts"},
        {"title": "FIRB Compliance and Foreign Purchaser Policy", "policy_type": "kyc"},
    ]
    t._controls = copy.deepcopy(BASE_CONTROLS) + extra_controls

    return t
