"""
Legal Professionals AML template — Tranche 2 (2026 reform).
NO IFTI. Key risks: solicitor trust accounts, entity formation, nominee
services, registered office services, real property and M&A transactions.

Content is drawn from the Organisation's real VERIGO_LEGAL_* document suite:
AMLCTF_Template, KYC_Guideline (VERIGO-LEGAL-KYC-G01), ECDD_Guideline
(VERIGO-LEGAL-ECDD-G01), TMP_Guideline (VERIGO-LEGAL-TMP-G01), SMR_Guideline
(VERIGO-LEGAL-SMR-G01), Sanctions_Policy (VERIGO-LEGAL-SANC-P01),
RATP_Addendum (VERIGO-LEGAL-RATP-A01, Module M-10) and the Risk_Matrix
(ISO 31000:2018, 19-row inherent/residual register — the largest of any
sector's real matrix reviewed this session).

Legal Professional Privilege (LPP) is a first-class, recurring theme across
every real document: LPP does NOT exempt designated legal services (entity
formation, trust account management, real property transactions, nominee
services, registered office services — NOT pure litigation or advice-only
work) from CDD, ECDD, TMP, SMR, or sanctions obligations. The real Risk
Matrix even gives LPP-as-a-shield its own dedicated risk category
(LP-01) — previously entirely absent from this template beyond one passing
mention.

TTR: the Organisation's ordinary practice is to prohibit cash acceptance
(see ttr_procedures) — but the real TMP Guideline still carries GEN-01
(physical currency >= AUD $10,000) as a live, monitored rule for the
exceptional case a cash receipt occurs anyway, so this isn't the "cash
prohibited, so TTR doesn't apply" oversimplification flagged in
PARKING_LOT.md P20 — the monitoring rule stays live even though the firm's
policy is to decline cash.
"""

import copy

from app.templates.aml.base import BASE_CONTROLS, BASE_POLICIES, AMLTemplateBase


def get_template(risk_level: str = "medium") -> AMLTemplateBase:
    t = AMLTemplateBase(industry="legal", risk_level=risk_level)
    t.has_ifti_obligation = False
    t.has_ttr_obligation = False
    t.has_travel_rule = False
    t.is_tranche_2 = True

    t.scope = (
        "This Program applies to legal services provided by the Organisation that "
        "constitute designated legal services under the AML/CTF Act as amended "
        "(Tranche 2, commencing 1 July 2026 anticipated).\n\n"
        "In-scope designated services include:\n"
        "- Conveyancing and real property transactions;\n"
        "- Receiving or disbursing client monies through the solicitor trust account;\n"
        "- Company or trust formation;\n"
        "- Acting as, or arranging, a nominee director, secretary, trustee or "
        "shareholder;\n"
        "- Registered office or business address services;\n"
        "- Mergers, acquisitions and other capital transactions.\n\n"
        "NOTE: Pure litigation services and advice-only legal work that does not "
        "involve managing client funds or forming/administering structures are "
        "excluded from designated legal services.\n\n"
        "LEGAL PROFESSIONAL PRIVILEGE (LPP) does NOT exempt designated legal "
        "services from the obligations in this Program. LPP is a confidentiality "
        "protection over lawyer-client communications; it is not a basis to "
        "decline CDD, ECDD, transaction monitoring, or SMR obligations for a "
        "designated service."
    )

    t.designated_services = (
        "The Organisation provides the following designated services:\n"
        "- Conveyancing services involving the transfer of real property;\n"
        "- Solicitor trust account management for clients;\n"
        "- Company and trust formation services;\n"
        "- Nominee director, secretary, trustee, or shareholder services;\n"
        "- Registered office and business address services;\n"
        "- Transactional legal services (including M&A) involving the movement "
        "of client funds.\n\n"
        "As a Tranche 2 entity, IFTI and TTR obligations do not apply unless "
        "the Organisation separately provides financial transfer services. "
        "Physical currency is not accepted (see ttr_procedures)."
    )

    t.risk_factors_customer = (
        "Legal-specific customer risk factors (Risk Matrix Customer Risk "
        "category, CR-01 to CR-05):\n"
        "- CR-01 — client refuses to disclose identity, beneficial owner, or "
        "source of funds. The most fundamental ML risk for legal professionals "
        "— accepting instructions from a client who cannot or will not satisfy "
        "CDD (CRITICAL, 20/25). LPP does NOT excuse non-disclosure for a "
        "designated service;\n"
        "- CR-02 — PEP as client, principal, or beneficial owner, frequently "
        "targeting legal professionals to invest proceeds of corruption "
        "through property, entity formation, or asset management (HIGH, 15/25);\n"
        "- CR-03 — instructions received via an intermediary with no direct "
        "access to the ultimate client — a known technique to obscure the "
        "client's identity and source of funds (HIGH, 12/25);\n"
        "- CR-04 — corporate client with a complex, offshore, or layered "
        "ownership structure used to obscure the ultimate beneficial owner "
        "(HIGH, 16/25);\n"
        "- CR-05 — client from a FATF grey-list or black-list jurisdiction "
        "(HIGH, 15/25)."
    )

    t.risk_factors_product = (
        "Legal-specific product/service risk factors (Risk Matrix "
        "Product/Service Risk category — the highest-scoring category on the "
        "real Risk Matrix, average inherent 17.7):\n"
        "- PR-02 — entity formation (company, trust, or other legal "
        "arrangement) with no apparent legitimate commercial, tax, or "
        "succession purpose (AUSTRAC STR Rank #2, CRITICAL, 20/25);\n"
        "- PR-03 — nominee director, secretary, trustee, or shareholder "
        "services — a primary vehicle for concealing beneficial ownership "
        "(AUSTRAC STR Rank #3, CRITICAL, 20/25);\n"
        "- PR-06 — registered office or correspondence address services "
        "provided without adequate knowledge of who controls the entity or "
        "for what purpose (MEDIUM, 9/25)."
    )

    t.beneficial_ownership_procedures = (
        "LEGAL PROFESSIONAL PRIVILEGE NOTE: Beneficial ownership CDD obligations "
        "apply in full to designated legal services. LPP does not override "
        "AML/CTF identification obligations.\n\n"
        "For all non-individual clients:\n"
        "- Identify all beneficial owners (>= 25% ownership or effective control);\n"
        "- Verify identity of each beneficial owner using standard procedures;\n"
        "- For trusts: identify trustee(s), settlor, and all material beneficiaries;\n"
        "- Document the beneficial ownership chain in the client file.\n\n"
        "CONVEYANCING: For property purchases, identify the true purchaser "
        "(including any person providing funds for the purchase) in addition "
        "to the legal title holder.\n\n"
        "ENTITY FORMATION AND NOMINEE SERVICES: identify and verify the "
        "ultimate beneficial owner of any entity formed or administered by "
        "the Organisation before accepting the engagement — this includes the "
        "person on whose behalf a nominee director, secretary, trustee, or "
        "shareholder acts. Written authority from the ultimate beneficial "
        "owner must be obtained and retained. Decline the engagement where "
        "the ultimate beneficial owner cannot be identified."
    )

    t.cdd_individuals = (
        "For individual clients, the Organisation collects and verifies (per "
        "KYC-G01 §9.1):\n\n"
        "IDENTIFICATION:\n"
        "- Full legal name, date of birth, residential address (not a PO Box);\n"
        "- For medium/high-risk clients: occupation, source of funds for the "
        "specific matter, source of wealth, expected transaction activity, any "
        "alias names;\n"
        "- Legal matter reference and stated purpose of the engagement;\n"
        "- Whether the client is acting on their own behalf or as an agent or "
        "nominee.\n\n"
        "VERIFICATION — must use at least one of:\n"
        "- Primary photographic document (passport, driver's licence);\n"
        "- Primary non-photographic document PLUS a secondary document;\n"
        "- Reliable electronic data matching (eKYC).\n\n"
        "CDD MUST BE COMPLETED BEFORE: accepting a retainer for any designated "
        "legal service and before receiving any funds into the solicitor "
        "trust account. CDD cannot be deferred. LPP does not override this "
        "obligation."
    )

    t.cdd_enhanced_procedures = (
        "ECDD is mandatory where any of the following triggers apply (ECDD-G01 "
        "§4.1/§4.2, cross-referenced to the Risk Matrix):\n\n"
        "SECTOR-SPECIFIC TRIGGERS:\n"
        "- TRUST ACCOUNT — third-party or unexplained funds received into the "
        "solicitor trust account (Risk Matrix PR-01, CRITICAL, AUSTRAC STR "
        "Rank #1) — full CDD is required on the actual remitting party, source "
        "of funds confirmed in writing before receipt, and Compliance Officer "
        "sign-off before acceptance for deposits above AUD $50,000;\n"
        "- ENTITY FORMATION — no apparent legitimate commercial, tax, or "
        "succession purpose documented (Risk Matrix PR-02, CRITICAL, AUSTRAC "
        "STR Rank #2) — assess purpose plausibility, ECDD for multi-"
        "jurisdictional or nominee-controlled structures, Managing Partner "
        "approval for high-risk formations, decline where purpose cannot be "
        "established;\n"
        "- NOMINEE SERVICES — director, secretary, trustee, or shareholder "
        "arrangement where the ultimate beneficial owner cannot be identified "
        "(Risk Matrix PR-03, CRITICAL, AUSTRAC STR Rank #3) — ECDD mandatory, "
        "written authority from the ultimate BO, Managing Partner approval for "
        "offshore or high-risk jurisdiction nominees, annual review;\n"
        "- INTERMEDIARY INSTRUCTIONS — instructions received without direct "
        "access to the ultimate client (Risk Matrix CR-03) — direct CDD on "
        "the underlying principal is mandatory, the firm cannot rely solely "
        "on the intermediary's CDD;\n"
        "- REAL PROPERTY — source of settlement funds not established (Risk "
        "Matrix PR-04);\n"
        "- M&A — purchase price significantly above or below fair market "
        "value (Risk Matrix PR-05) — independent valuation where price "
        "deviates > 15% from market value;\n"
        "- Foreign PEP as client, director, trustee, or beneficial owner "
        "(Risk Matrix CR-02);\n"
        "- Client or funds from a FATF grey/black-list jurisdiction (Risk "
        "Matrix CR-05/GR-01);\n"
        "- LEGAL PROFESSIONAL PRIVILEGE claimed to resist CDD or ECDD (Risk "
        "Matrix LP-01) — this is itself a suspicious indicator, not a valid "
        "basis to decline the inquiry; seek independent legal advice "
        "immediately and document the LPP assessment in the ECDD Case File.\n\n"
        "APPROVAL AUTHORITY: Managing Partner approval is required for complex "
        "or offshore structures, all nominee arrangements in high-risk "
        "jurisdictions, and transactions above AUD $5,000,000 (M&A) or where "
        "the CO recommends decline. Board approval is required for foreign "
        "PEPs.\n\n"
        "Every ECDD case is documented in an ECDD Case File recording the "
        "trigger, client profile, measures applied, approval workflow, and "
        "outcome, including a mandatory documented SMR consideration."
    )

    t.pep_procedures = (
        "IDENTIFICATION: At onboarding and on an ongoing basis, the Organisation "
        "screens all clients, beneficial owners, and — for entity formation and "
        "nominee engagements — proposed directors and trustees, against PEP "
        "databases via commercial database search, internet/media search, "
        "government-issued PEP lists, and a mandatory client self-declaration.\n\n"
        "RISK RATING: PEPs are rated HIGH inherent risk (Risk Matrix CR-02, "
        "15/25). PEPs frequently target legal professionals to invest "
        "corruption proceeds through property, entity formation, or asset "
        "management.\n\n"
        "FOREIGN PEPs: ECDD is mandatory regardless of other risk factors. "
        "Board/Director approval is required before accepting instructions. "
        "Source of wealth and source of funds must be established from "
        "independent documentary evidence. The engagement letter must note "
        "the PEP status and heightened obligations. Enhanced OCDD applies "
        "throughout the engagement.\n\n"
        "DOMESTIC PEPs / close associates: risk-based — the Compliance "
        "Officer assesses whether high ML/TF risk applies; if so, the same "
        "measures as for foreign PEPs apply.\n\n"
        "The Organisation will NOT accept or continue instructions for a "
        "foreign PEP without prior Board/Director approval documented in "
        "writing."
    )

    t.sanctions_procedures = (
        "The Organisation complies with Australia's targeted financial "
        "sanctions obligations under the Charter of the United Nations Act "
        "1945 and the Autonomous Sanctions Act 2011 (Sanctions Policy "
        "VERIGO-LEGAL-SANC-P01).\n\n"
        "MANDATORY LISTS — accessed LIVE at the time of screening, never "
        "cached: DFAT Consolidated Sanctions List; UN Security Council "
        "Consolidated List; Australian listed terrorist organisations; "
        "Criminal Code Regulations 2002 list; DFAT Russia/Iran/DPRK "
        "regime-specific lists.\n\n"
        "WHO IS SCREENED: client, beneficial owners, directors/trustees, "
        "authorised representatives, counterparties, third-party payers, any "
        "entity to be formed or administered (including proposed directors "
        "and beneficial owners), any nominee-arrangement principal, and the "
        "trust account remitting party — before accepting entity formation, "
        "nominee, or trust account instructions, and periodically thereafter "
        "(annual review for existing nominee and registered office "
        "arrangements).\n\n"
        "LPP DOES NOT OVERRIDE sanctions screening obligations or "
        "asset-freezing requirements — these are statutory, not discretionary. "
        "A claim of LPP to resist screening of a client's ultimate beneficial "
        "owner is itself a sanctions-evasion indicator.\n\n"
        "PROLIFERATION FINANCING: elevated risk for legal professionals "
        "providing entity formation, nominee services, and commercial "
        "transaction advice — entities formed for sanctioned parties may be "
        "used to procure dual-use goods or transfer WMD-programme funds.\n\n"
        "CONFIRMED MATCH — immediate response:\n"
        "1. Cease all work on the matter immediately;\n"
        "2. Do NOT tip off the matched party;\n"
        "3. Notify the Compliance Officer within 15 minutes;\n"
        "4. Notify the Director/Managing Partner immediately;\n"
        "5. Place trust account funds on hold — do not disburse; do not "
        "complete any entity formation, nominee, or registered office "
        "instruction;\n"
        "6. Notify the AFP within 24 hours (131 AFP);\n"
        "7. Lodge an SMR within 24 hours;\n"
        "8. Seek urgent independent legal advice on obligations to the client "
        "versus sanctions obligations, including asset-freezing under the "
        "Charter of the United Nations Act 1945.\n\n"
        "All screening and confirmed-match actions are recorded in the "
        "Sanctions Screening Log."
    )

    t.transaction_monitoring = (
        "The Organisation operates a rules-based Transaction Monitoring "
        "Program (TMP-G01) combining 10 general AML/CTF rules and 12 "
        "legal-sector-specific rules, calibrated to the Risk Matrix.\n\n"
        "GENERAL RULES (GEN-01 to GEN-10): physical currency >= AUD $10,000 "
        "(a live monitored rule despite the Organisation's cash-prohibition "
        "policy — see ttr_procedures); volume increase >= 100% in 5 days; "
        "sanctions match; PEP with no/lapsed ECDD; structuring; baseline "
        "deviation; third-party unidentified funds; high-risk jurisdiction "
        "funds; rapid fund movement < 48 hours; unusual arrangements.\n\n"
        "SOLICITOR TRUST ACCOUNT MONITORING — PRIMARY TMP FOCUS: the trust "
        "account is the sector's primary ML risk vehicle. Every trust "
        "account receipt is matched to a known client, matter, and expected "
        "financial flow before acceptance.\n\n"
        "LEGAL-SECTOR RULES (LEGAL-01 to LEGAL-12), each with a defined "
        "review frequency and responsible officer:\n"
        "- LEGAL-01 — trust account receipt from an unidentified third party "
        "(AUSTRAC STR Rank #1): per receipt, Compliance Officer;\n"
        "- LEGAL-02 — trust account deposit > 150% of estimated matter "
        "disbursements: per receipt, Compliance Officer;\n"
        "- LEGAL-03 — trust account overpayment followed by a refund "
        "request: per request, Compliance Officer + Managing Partner;\n"
        "- LEGAL-04 — entity formation with no documented legitimate "
        "purpose: per engagement, Compliance Officer;\n"
        "- LEGAL-05 — 3 or more entity formations for the same client within "
        "60 days: monthly, Compliance Officer + Managing Partner;\n"
        "- LEGAL-06 — nominee services for an offshore or high-risk "
        "jurisdiction entity: per engagement, Compliance Officer + Managing "
        "Partner;\n"
        "- LEGAL-07 — instructions from an intermediary with no direct "
        "client contact: per engagement, Compliance Officer;\n"
        "- LEGAL-08 — real property matter where source of settlement funds "
        "is not documented: per matter, Compliance Officer;\n"
        "- LEGAL-09 — M&A purchase price +/- 15% of independent valuation: "
        "per matter, Compliance Officer + Managing Partner;\n"
        "- LEGAL-10 — registered office client with no apparent business "
        "activity: annual review, Compliance Officer;\n"
        "- LEGAL-11 — LPP claimed to resist a TMP review: as identified, "
        "Compliance Officer + Managing Partner, with independent legal "
        "advice sought before proceeding;\n"
        "- LEGAL-12 — PEP as client, director, trustee, or beneficial owner: "
        "per engagement, Compliance Officer + Managing Partner.\n\n"
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
        "SUSPICION STANDARD: lower than proof; no minimum matter value; a "
        "continuing obligation regardless of whether the matter has already "
        "concluded.\n\n"
        "SECTOR-SPECIFIC SMR TRIGGERS, the most commonly reported ML/TF "
        "typologies in AUSTRAC STR data for this sector (SMR-G01 §12):\n"
        "1. SOLICITOR TRUST ACCOUNT — THIRD-PARTY FUNDS (AUSTRAC STR Rank "
        "#1) — an SMR MUST be assessed where trust account funds are "
        "received from a person not identified as the client and the source "
        "cannot be adequately explained;\n"
        "2. ENTITY FORMATION — NO LEGITIMATE PURPOSE (AUSTRAC STR Rank #2) — "
        "client cannot articulate a plausible commercial, tax, or succession "
        "purpose for a company, trust, or other legal arrangement;\n"
        "3. NOMINEE SERVICES (AUSTRAC STR Rank #3) — the ultimate beneficial "
        "owner of a nominee arrangement cannot be identified;\n"
        "4. Real property, M&A, or registered office indicators — source of "
        "settlement funds unresolved, purchase price manipulation, or an "
        "entity with no apparent business activity.\n\n"
        "LPP AND SMR OBLIGATIONS: LPP does NOT prevent or delay the SMR "
        "obligation for designated legal services. A client's claim of LPP "
        "to resist SMR-related inquiries may itself be a suspicious "
        "indicator; seek independent legal advice immediately.\n\n"
        "PROCEDURE: employee escalates to the Compliance Officer immediately; "
        "CO reviews and determines whether suspicion is formed; if "
        "confirmed, the SMR is lodged via AUSTRAC Online; the existence of "
        "an SMR decision — including a decision NOT to lodge — is retained "
        "in the SMR Internal Decision Log regardless of outcome.\n\n"
        "TIPPING OFF: it is a criminal offence under s.123 (up to 2 years "
        "imprisonment) to disclose to any person, including the client's own "
        "external accountant or another lawyer, that an SMR has been or may "
        "be submitted."
    )

    t.ttr_procedures = (
        "The Organisation's ordinary practice is to decline cash: it does "
        "not accept physical currency through the solicitor trust account or "
        "in payment of fees. All payments must be made by bank transfer or "
        "cheque, so a TTR obligation is not expected to arise in the ordinary "
        "course.\n\n"
        "This does NOT remove the underlying obligation: TMP rule GEN-01 "
        "(physical currency >= AUD $10,000) remains a live, monitored rule "
        "for the exceptional case a cash receipt occurs despite the "
        "Organisation's policy. Any client who offers cash must be referred "
        "to the Compliance Officer immediately, regardless of amount, given "
        "the sector's structuring risk. Where physical currency of AUD "
        "$10,000 or more is received, a TTR must be lodged with AUSTRAC "
        "within 10 business days — separate from and in addition to any SMR "
        "obligation."
    )

    t.ifti_procedures = "IFTI reporting does not apply to this Organisation's designated legal services."

    t.independent_review = (
        "Given the real Risk Matrix's CRITICAL-rated inherent risks (client "
        "CDD refusal CR-01, trust account third-party funds PR-01, entity "
        "formation without purpose PR-02, and nominee services PR-03 — all "
        "20-25/25), the AML/CTF Program is independently reviewed ANNUALLY "
        "rather than the base 3-year cycle, by an external AML/CTF specialist "
        "(not the firm's own lawyers).\n\n"
        "The review must additionally be brought forward:\n"
        "- Within 12 months of a material change to the business, client "
        "base, or regulatory obligations;\n"
        "- As directed by AUSTRAC;\n"
        "- A Tranche 2 readiness assessment must be completed before 1 July "
        "2026.\n\n"
        "SCOPE: the review specifically tests trust account third-party "
        "receipt controls, entity formation and nominee ECDD effectiveness, "
        "the LPP/AML-CTF interface (whether LPP is ever incorrectly used to "
        "resist CDD, ECDD, TMP, or SMR obligations), and SMR decision-log "
        "completeness, in addition to the Program's general effectiveness.\n\n"
        "REPORTING: results are reported to senior management (Board or "
        "equivalent) and findings must be actioned and documented."
    )

    extra_controls = [
        {
            "control_ref": "CTL-010",
            "title": "Legal Trust Account AML Controls",
            "control_type": "preventive",
            "risk_area": "trust_accounts",
        },
        {
            "control_ref": "CTL-011",
            "title": "Conveyancing CDD — Property Purchasers",
            "control_type": "preventive",
            "risk_area": "kyc",
        },
        {
            "control_ref": "CTL-012",
            "title": "Cash Prohibition — Client Payments",
            "control_type": "preventive",
            "risk_area": "transaction_monitoring",
        },
        {
            "control_ref": "CTL-013",
            "title": "Trust Account Third-Party Receipt Review (PR-01)",
            "control_type": "detective",
            "risk_area": "trust_accounts",
        },
        {
            "control_ref": "CTL-014",
            "title": "Entity Formation Purpose Assessment",
            "control_type": "preventive",
            "risk_area": "entity_formation",
        },
        {
            "control_ref": "CTL-015",
            "title": "Nominee Services ECDD and Ultimate BO Verification",
            "control_type": "preventive",
            "risk_area": "nominee_services",
        },
        {
            "control_ref": "CTL-016",
            "title": "LPP / AML-CTF Interface — Annual Staff Training",
            "control_type": "preventive",
            "risk_area": "lpp_interface",
        },
    ]

    t._policies = copy.deepcopy(BASE_POLICIES) + [
        {"title": "Legal Trust Account AML Policy", "policy_type": "trust_accounts"},
        {"title": "Conveyancing CDD Policy", "policy_type": "kyc"},
        {"title": "Cash Prohibition Policy", "policy_type": "transaction_monitoring"},
        {
            "title": "Entity Formation and Nominee Services ECDD Policy",
            "policy_type": "ecdd",
        },
        {"title": "LPP / AML-CTF Interface Policy", "policy_type": "risk_assessment"},
    ]
    t._controls = copy.deepcopy(BASE_CONTROLS) + extra_controls

    return t
