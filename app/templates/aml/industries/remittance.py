"""
Remittance / Independent Remittance Dealer (IRD) AML template.
Tranche 1 — IFTI-DRA ✓  Travel Rule ✓  TTR conditional (see ttr_procedures)

Content is drawn from the Organisation's real VERIGO_REMITTANCE_* document
suite: AMLCTFProgram, KYC_Guideline (VERIGO-REMITTANCE-KYC-G01),
ECDD_Guideline (VERIGO-REMITTANCE-ECDD-G01), TMP_Guideline
(VERIGO-REMITTANCE-TMP-G01), SMR_Guideline (VERIGO-REMITTANCE-SMR-G01),
Sanctions_Policy (VERIGO-REMITTANCE-SANC-P01), RATP_Addendum
(VERIGO-REMITTANCE-RATP-A01, Module M-10) and the Risk_Matrix (ISO
31000:2018, 15-row inherent/residual register).

TTR: the real Program (§23, Part A) states TTR is "NOT APPLICABLE — This
Entity does not handle physical currency" for the electronic-only IRD
variant. This template also serves the cash-handling money-changer /
currency-exchange variant of the same designated service (there is no
distinct AUSTRAC "money exchange" IndustryType — currency exchange is
itself a remittance-sector activity). ttr_procedures therefore states the
obligation conditionally rather than defaulting it on for every entity.

Third-party sender detection (Risk Matrix CR-02) is AUSTRAC's #1-ranked
STR typology for this sector and the only CRITICAL-rated inherent risk in
the Organisation's own Risk Matrix (25/25) — this template makes it a
first-class, named control rather than folding it into generic ECDD text.
"""

import copy

from app.templates.aml.base import BASE_CONTROLS, BASE_POLICIES, AMLTemplateBase


def get_template(risk_level: str = "medium") -> AMLTemplateBase:
    t = AMLTemplateBase(industry="remittance", risk_level=risk_level)
    t.has_ifti_obligation = True
    t.has_ttr_obligation = True
    t.has_travel_rule = True
    t.is_tranche_2 = False

    t.scope = (
        "This Program applies to all remittance services provided by the Organisation "
        "as an Independent Remittance Dealer (IRD) registered on AUSTRAC's Remittance "
        "Sector Register. It covers all inbound and outbound international funds "
        "transfer instructions (IFTIs), the transferor (sending customer) and the "
        "beneficiary (receiving customer) side of every instruction, domestic "
        "threshold transactions where physical currency is handled, and all staff "
        "and agents handling customer funds or instructions.\n\n"
        "This Program operates alongside — and does not replace — the Organisation's "
        "registration obligations under the AUSTRAC Remittance Sector Register and, "
        "where applicable, its Registrable Designated Remittance Provider (RDRP) "
        "network obligations."
    )

    t.designated_services = (
        "The Organisation provides the following designated services:\n"
        "- Item 31: Registrable designated remittance service (outgoing IFTIs);\n"
        "- Item 32: Registrable designated remittance service (incoming IFTIs);\n"
        "- Cash handling and currency exchange where the Organisation's registration "
        "covers this variant of the designated service (see ttr_procedures).\n\n"
        "AUSTRAC Registration: The Organisation must be registered on the Remittance "
        "Sector Register prior to providing any remittance service. Registration must "
        "be renewed every 3 years."
    )

    t.risk_factors_customer = (
        "Customer risk factors specific to remittance (Risk Matrix Customer Risk "
        "category, CR-01 to CR-05):\n"
        "- CR-02 — THIRD-PARTY SENDER: funds provided or the instruction given by a "
        "person who is not the account holder or named transferor, with no adequate "
        "explanation. This is AUSTRAC's #1-ranked STR typology for the remittance "
        "sector and the Organisation's ONLY inherent CRITICAL-rated risk (25/25 on "
        "the Risk Matrix). ECDD is mandatory regardless of transaction amount and "
        "Compliance Officer sign-off is required before any such remittance is "
        "completed;\n"
        "- CR-01 — sender unable or unwilling to explain the purpose of the transfer, "
        "or purpose is inconsistent with the sender's known profile (HIGH, 16/25);\n"
        "- CR-03 — Politically Exposed Person as sender or beneficiary (HIGH, 15/25);\n"
        "- CR-04 — customer resident in, or regularly transacting with, a FATF "
        "grey/black-list jurisdiction (HIGH, 15/25);\n"
        "- CR-05 — non-individual (company/trust) customer sending or receiving a "
        "remittance (HIGH, 12/25)."
    )

    t.risk_factors_product = (
        "Product/service risk factors specific to remittance (Risk Matrix "
        "Product/Service Risk category, PR-01 to PR-05):\n"
        "- PR-04 — high-risk remittance corridor with known drug-trafficking or "
        "terrorism-financing linkage (HIGH, 12/25);\n"
        "- PR-05 — false or vague purpose declaration, e.g. 'family support' or "
        "'gift' with no supporting detail for a material-value transfer (AUSTRAC "
        "Rank #2 STR typology, HIGH, 12/25);\n"
        "- Nested remittance / sub-agent and correspondent networks that obscure "
        "the true originator or beneficiary of funds;\n"
        "- Speed and irreversibility of completed transfers once beneficiary funds "
        "are released."
    )

    t.risk_factors_channel = (
        "Delivery channel risks specific to remittance:\n"
        "- Non-face-to-face customer onboarding (online/phone orders);\n"
        "- Use of sub-agents or retail outlets to accept instructions — sub-agent "
        "oversight failure is a distinct control area (see CTL-013);\n"
        "- Cash acceptance at branch or agent locations, where the Organisation's "
        "registration covers the cash-handling variant of this designated service;\n"
        "- Correspondent or network provider relationships (Tranche 1 obligations "
        "apply to the Organisation regardless of correspondent arrangements) — see "
        "REM-12 high-risk correspondent entity monitoring;\n"
        "- Mobile or online payment platforms."
    )

    t.risk_factors_geography = (
        "Geographic risk factors specific to remittance (Risk Matrix Geographic "
        "Risk category, GR-01/GR-02):\n"
        "- GR-01 — FATF grey/black-list corridors (HIGH, 15/25): the Organisation "
        "maintains an approved corridor list and reviews it quarterly against FATF "
        "and DFAT updates. Corridor risk is assessed at KYC (KYC-G01 §26.5) and "
        "again at each transaction via the TMP rules schedule (REM-05/REM-06);\n"
        "- GR-02 — proliferation financing corridors, principally DPRK and Iran "
        "(MEDIUM, 10/25 but escalation is immediate and mandatory — see "
        "risk_factors_proliferation);\n\n"
        "Transactions to sanctioned countries, or via a black-listed corridor "
        "without Director approval, are prohibited."
    )

    t.risk_factors_proliferation = (
        "Proliferation financing (PF) is assessed as a MEDIUM-HIGH inherent sector "
        "risk for remittance (Risk Matrix GR-02, escalation path: immediate cessation "
        "of the instruction, mandatory AFP referral, SMR within 24 hours).\n\n"
        "Any beneficiary, corridor, or routing connected to DPRK or Iran is "
        "PROHIBITED outright, not merely subject to enhanced review.\n\n"
        "PF INDICATORS specific to remittance include: transfers routed through "
        "multiple intermediary jurisdictions with no clear commercial rationale; "
        "beneficiaries linked to entities on UN Security Council PF-related "
        "sanctions lists; transfers to front companies or trading entities with "
        "no discernible legitimate business purpose; and structured transfers "
        "just below reporting or screening thresholds to a PF-risk corridor.\n\n"
        "The Organisation screens all senders, beneficiaries and corridors against "
        "the DFAT Consolidated Sanctions List and UN Security Council Consolidated "
        "List — accessed live at the time of screening, never from a cached copy — "
        "prior to onboarding and before every transaction."
    )

    t.cdd_individuals = (
        "For individual customers, the Organisation collects and verifies (per "
        "KYC-G01 §9 and §26.1):\n\n"
        "TRANSFEROR (SENDING CUSTOMER):\n"
        "- Full legal name, date of birth, residential address;\n"
        "- Typical remittance destinations, beneficiaries, and purpose of transfers;\n"
        "- Source of funds for the specific transfer;\n"
        "- Occupation, employer, and source of wealth for HIGH-risk or PEP customers.\n\n"
        "VERIFICATION — must use at least one of:\n"
        "- Primary photographic document (passport, driver's licence, proof-of-age "
        "card);\n"
        "- Primary non-photographic document PLUS a secondary document;\n"
        "- Reliable electronic data matching.\n\n"
        "BENEFICIARY (RECEIVING CUSTOMER) — KYC-G01 §26.2:\n"
        "- Full name and account/reference details as required for release of funds;\n"
        "- Screening against sanctions lists before funds are made available "
        "(mandatory beneficiary verification, Program §39A) — funds must not be "
        "released to a beneficiary who has not been screened;\n"
        "- Where the beneficiary cannot be adequately identified or screened, funds "
        "are held and the matter is escalated to the Compliance Officer."
    )

    t.cdd_enhanced_procedures = (
        "ECDD is mandatory where any of the following triggers apply (ECDD-G01 "
        "§4.1/§4.2, cross-referenced to the Risk Matrix):\n\n"
        "SECTOR-SPECIFIC TRIGGERS:\n"
        "- THIRD-PARTY SENDER (CR-02, CRITICAL, AUSTRAC STR Rank #1) — full CDD is "
        "required on the actual funding party (not just the named customer), a "
        "written explanation of the arrangement must be obtained, Compliance "
        "Officer sign-off is required before completing the remittance, and an "
        "SMR consideration is mandatory regardless of the outcome;\n"
        "- FALSE OR VAGUE PURPOSE (PR-05, HIGH, AUSTRAC STR Rank #2) — additional "
        "supporting documentation is required and an SMR consideration is "
        "mandatory where the purpose remains unclear after follow-up;\n"
        "- STRUCTURING (PR-03) — pattern analysis across the customer's recent "
        "transaction history, escalation to Compliance Officer;\n"
        "- HIGH-RISK CORRIDOR (PR-04/GR-01) — Director approval required for a "
        "grey-list corridor; a black-list corridor is escalated for a decline "
        "decision;\n"
        "- BENEFICIARY SANCTIONS INDICATOR (SP-01, CRITICAL escalation) — instruction "
        "is held, not processed, pending Compliance Officer and Director review;\n"
        "- PEP as transferor or beneficiary (CR-03) — see pep_procedures.\n\n"
        "APPROVAL AUTHORITY (ECDD-G01 §7): LOW risk = Compliance Officer only, "
        "rising to Compliance Officer + Director + AFP notification for a "
        "confirmed sanctions match.\n\n"
        "Every ECDD case is documented in an ECDD Case File recording: the "
        "trigger, the customer profile, measures applied, the approval workflow, "
        "and the outcome and any follow-up action."
    )

    t.beneficial_ownership_procedures = (
        "The Organisation identifies and verifies the beneficial owners of all "
        "non-individual customers (companies, trusts, partnerships) sending or "
        "receiving remittances.\n\n"
        "DEFINITION: A beneficial owner is any individual who directly or "
        "indirectly owns >= 25% of the customer, or exercises effective control.\n\n"
        "PROCEDURE:\n"
        "1. Identify all persons meeting the beneficial ownership definition;\n"
        "2. Verify identity using individual CDD procedures;\n"
        "3. Obtain a beneficial ownership declaration from the customer;\n"
        "4. Update records when ownership changes are notified or detected;\n"
        "5. Where the beneficial owner cannot be determined, treat the senior "
        "managing official as the beneficial owner and document the reasons.\n\n"
        "Records of beneficial ownership are retained for 7 years."
    )

    t.pep_procedures = (
        "IDENTIFICATION: At onboarding and on an ongoing basis, the Organisation "
        "screens all customers (both transferor and beneficiary, where beneficiary "
        "details are available) against PEP databases.\n\n"
        "PEP CATEGORIES:\n"
        "- Domestic PEPs: holders of prominent public positions in Australian "
        "government;\n"
        "- Foreign PEPs: equivalent positions in foreign governments;\n"
        "- International organisation PEPs;\n"
        "- Family members and close associates of all PEP categories.\n\n"
        "RISK RATING: PEPs are rated HIGH inherent risk (Risk Matrix CR-03, "
        "15/25). Foreign PEPs require Board/Director approval before any "
        "remittance is completed.\n\n"
        "ECDD FOR PEPs:\n"
        "- Board/Director approval required before the transaction proceeds "
        "(mandatory for foreign PEPs, risk-based for domestic PEPs and close "
        "associates);\n"
        "- Enhanced verification of identity and source of funds/wealth;\n"
        "- Quarterly OCDD review frequency for PEP-Foreign relationships (KYC-G01 "
        "§22 OCDD frequency table);\n"
        "- AML/CTF Compliance Officer must approve all PEP relationships.\n\n"
        "FORMER PEPs: Individuals who have ceased to hold a PEP position within "
        "the past 12 months continue to be treated as PEPs."
    )

    t.sanctions_procedures = (
        "The Organisation complies with Australia's targeted financial sanctions "
        "obligations under the Autonomous Sanctions Act 2011 and UN Security "
        "Council resolutions (Sanctions Policy VERIGO-REMITTANCE-SANC-P01).\n\n"
        "MANDATORY LISTS — accessed LIVE at the time of screening, never cached "
        "(§4):\n"
        "- DFAT Consolidated Sanctions List;\n"
        "- UN Security Council Consolidated List;\n"
        "- Australian listed terrorist organisations (National Security list);\n"
        "- Criminal Code Regulations 2002 list;\n"
        "- DFAT DPRK / Iran / Russia regime-specific lists.\n\n"
        "SCREENING TIMING: prior to onboarding; before every outgoing instruction "
        "and before releasing every incoming instruction to a beneficiary (mandatory "
        "beneficiary verification, Program §39A); and whenever the lists are "
        "updated.\n\n"
        "PROLIFERATION FINANCING: sector risk is rated MEDIUM-HIGH (§6). Any "
        "DPRK- or Iran-connected beneficiary or routing is prohibited outright.\n\n"
        "CONFIRMED MATCH — immediate response (§11, 7 steps):\n"
        "1. Cease dealings with the instruction immediately;\n"
        "2. Do NOT tip off the customer or the correspondent entity;\n"
        "3. Notify the Compliance Officer within 15 minutes;\n"
        "4. Notify the Director immediately;\n"
        "5. Notify the AFP within 24 hours (131 AFP);\n"
        "6. Lodge an SMR within 24 hours — this SMR replaces the normal IFTI-DRA "
        "report for that instruction, it does not sit alongside it;\n"
        "7. Seek legal advice on asset-freezing obligations.\n\n"
        "All screening and confirmed-match actions are recorded in the Sanctions "
        "Screening Log."
    )

    t.travel_rule_procedures = (
        "OBLIGATION: Under the AML/CTF Rules 2025, the Organisation must transmit "
        "required payer and payee information with all international funds "
        "transfers (Program §23B).\n\n"
        "OUTGOING TRANSFERS — information transmitted to the receiving "
        "institution:\n"
        "- Payer: full name, account number/reference, address or DOB or ID "
        "number;\n"
        "- Payee: full name, account number/reference.\n\n"
        "INCOMING TRANSFERS — information received from the sending institution:\n"
        "- Verify that required Travel Rule information accompanies all incoming "
        "IFTIs before the beneficiary is screened and funds are released "
        "(Program §39A);\n"
        "- If information is missing or incomplete, apply risk-based procedures "
        "before crediting or releasing funds;\n"
        "- Where information is consistently absent from a correspondent, review "
        "the correspondent relationship (REM-12 high-risk correspondent entity "
        "monitoring).\n\n"
        "RECORDS: Travel Rule information must be retained for 7 years."
    )

    t.ifti_procedures = (
        "OBLIGATION: The Organisation must submit an IFTI-DRA (International "
        "Funds Transfer Instruction under a Designated Remittance Arrangement) "
        "report to AUSTRAC for EVERY cross-border funds transfer instruction it "
        "sends or receives — there is no minimum threshold; this is the primary "
        "Tranche 1 obligation for this sector (Program §23A).\n\n"
        "REPORTING DEADLINES:\n"
        "- IFTI-DRA OUT (outgoing): report within 10 business days of the "
        "instruction;\n"
        "- IFTI-DRA IN (incoming): report within 10 business days of receipt.\n\n"
        "TRANSACTION REFERENCE FORMAT: [ENTITY PREFIX]-[YYYYMMDD]-[I/O]-[NNNN] "
        "(Program §23A).\n\n"
        "INFORMATION REQUIRED (112/115 column AUSTRAC format):\n"
        "- Ordering customer: full ID details, account, address;\n"
        "- Beneficiary customer: name, account, institution, country;\n"
        "- Transfer details: amount, currency, date, reference, method;\n"
        "- Reporter details: Organisation name, AUSTRAC ID, ABN.\n\n"
        "SUBMISSION: IFTI-DRAs are submitted via AUSTRAC Online or approved "
        "reporting software. The AML/CTF Compliance Officer is responsible for "
        "all IFTI-DRA submissions and tracks each instruction against its "
        "10-business-day deadline (Appendix 3, IFTI-DRA Submission Checklist).\n\n"
        "STRUCTURING: Monitor for remittances structured to avoid or distort "
        "IFTI-DRA reporting. Multiple related transfers that appear to form part "
        "of a larger transfer must be assessed as a single IFTI-DRA where "
        "applicable (Risk Matrix PR-03)."
    )

    t.ttr_procedures = (
        "APPLICABILITY DEPENDS ON THE ORGANISATION'S REGISTERED SERVICE VARIANT:\n\n"
        "ELECTRONIC-ONLY REMITTANCE DEALERS (no physical currency handled): "
        "Threshold Transaction Reporting does NOT apply. This Program's "
        "designated services are limited to electronic IFTI-DRA transfers, and "
        "the Organisation does not accept or disburse physical currency in "
        "connection with any remittance instruction (Program §23, Part A: "
        "'This Entity does not handle physical currency').\n\n"
        "CASH-HANDLING REMITTANCE DEALERS / CURRENCY EXCHANGE (where the "
        "Organisation's registration covers cash acceptance or currency "
        "exchange): Report all physical currency transactions of AUD $10,000 "
        "or more (or foreign currency equivalent) within 15 business days.\n"
        "- Cash receipts from customers to fund remittances are TTR-reportable;\n"
        "- Structuring detection: watch for multiple cash deposits below "
        "$10,000 that appear designed to avoid TTR obligations (Risk Matrix "
        "PR-03);\n"
        "- Sub-agent obligations: where sub-agents accept cash on behalf of the "
        "Organisation, they must report cash receipts >= $10,000 to the "
        "Organisation within 2 business days for TTR submission.\n\n"
        "The Organisation's current registered service variant and applicable "
        "TTR status must be confirmed against its AUSTRAC Remittance Sector "
        "Register entry and recorded in this Program."
    )

    t.transaction_monitoring = (
        "The Organisation operates a rules-based Transaction Monitoring Program "
        "(TMP-G01) combining 10 general AML/CTF rules and 12 remittance-specific "
        "rules, calibrated to the Risk Matrix.\n\n"
        "GENERAL RULES (GEN-01 to GEN-10): physical currency >= AUD $10,000 "
        "(N/A for no-cash variant, see ttr_procedures); volume increase >= 100% "
        "in 5 days; sanctions match (auto-escalation, CO + Director); PEP with "
        "no or lapsed ECDD; structuring — 2+ near-threshold transactions in 3 "
        "days; baseline deviation from customer profile; third-party funds; "
        "high-risk jurisdiction; rapid fund movement within 48 hours; unusual "
        "transaction arrangements.\n\n"
        "REMITTANCE-SPECIFIC RULES (REM-01 to REM-12), each with a defined "
        "review frequency and escalation owner:\n"
        "- REM-01 — third-party sender: manual review per transaction, "
        "Compliance Officer;\n"
        "- REM-02 — IFTI-DRA approaching deadline (Day 8 alert): daily, "
        "Compliance Officer;\n"
        "- REM-03 — IFTI-DRA data quality (missing fields): per instruction, "
        "Compliance Officer;\n"
        "- REM-04 — structuring (multiple near-threshold transfers): daily, "
        "Compliance Officer;\n"
        "- REM-05 — high-risk corridor (grey-list): per instruction, "
        "Compliance Officer;\n"
        "- REM-06 — black-list corridor: per instruction, Compliance Officer + "
        "Director;\n"
        "- REM-07 — beneficiary sanctions screen: per instruction, Compliance "
        "Officer + Director;\n"
        "- REM-08 — vague purpose > $5,000: per instruction, Compliance Officer;\n"
        "- REM-09 — volume surge > 100% in 5 days: weekly, Compliance Officer;\n"
        "- REM-10 — PEP transferor/beneficiary: per instruction, Compliance "
        "Officer + Director;\n"
        "- REM-11 — pattern change (new country/beneficiary/value): per "
        "instruction, Compliance Officer;\n"
        "- REM-12 — high-risk correspondent entity: per instruction, "
        "Compliance Officer.\n\n"
        "MONITORING TIERS: monitoring frequency and alert threshold scale with "
        "customer risk rating — LOW/MEDIUM/HIGH/PEP-Foreign/Sanctions-Listed "
        "(TMP-G01 §5).\n\n"
        "ALERT ASSESSMENT TIMEFRAMES (§10.2): CRITICAL = 1 hour, HIGH = 24 "
        "hours, MEDIUM = 48 hours, LOW = 5 business days.\n\n"
        "PRIMARY TMP OBLIGATIONS: IFTI-DRA compliance monitoring (§12.1) is the "
        "primary TMP obligation for this sector; third-party sender monitoring "
        "(§12.2) is the highest-priority manual TMP control; corridor risk "
        "monitoring (§12.3) is continuous.\n\n"
        "Every alert is recorded in a TMP Alert Log (trigger, assessment, "
        "decision, and any escalation) and retained for 7 years."
    )

    t.smr_procedures = (
        "OBLIGATION: The Organisation must report a Suspicious Matter to "
        "AUSTRAC as soon as practicable and no later than 24 hours (terrorism "
        "financing) or 3 business days (all other matters) after the "
        "Compliance Officer forms a suspicion under s.41 of the AML/CTF Act — "
        "the clock starts when suspicion is formed, not when it is proven "
        "(SMR-G01 §9).\n\n"
        "SUSPICION STANDARD: lower than proof; no minimum transaction amount; a "
        "continuing obligation that applies regardless of whether the "
        "transaction proceeds, is declined, or has already settled (§5).\n\n"
        "SECTOR-SPECIFIC SMR TRIGGERS (SMR-G01 §12):\n"
        "1. THIRD-PARTY SENDER (AUSTRAC STR Rank #1) — an SMR MUST be assessed "
        "where third-party funding is identified and the source cannot be "
        "adequately explained (§12.1);\n"
        "2. Structuring or IFTI-DRA evasion patterns (§12.2);\n"
        "3. High-risk corridor transfers, or beneficiary sanctions indicators, "
        "without adequate explanation (§12.3);\n"
        "4. False or vague purpose declarations that remain unresolved after "
        "follow-up (AUSTRAC STR Rank #2).\n\n"
        "PROCEDURE: employee escalates to the Compliance Officer; Compliance "
        "Officer reviews and determines whether suspicion is formed; if "
        "confirmed, the SMR is lodged via AUSTRAC Online using the 7-section "
        "field-by-field form guide (§11); the existence of an SMR decision — "
        "including a decision NOT to lodge — is retained in the SMR Internal "
        "Decision Log regardless of outcome (Appendix A).\n\n"
        "PRE-LODGEMENT: a Pre-Lodgement SMR Checklist (Appendix B) is completed "
        "before every SMR submission.\n\n"
        "TIPPING OFF: it is a criminal offence under s.123 (up to 2 years "
        "imprisonment) to disclose to any person that an SMR has been or may be "
        "submitted, including to the customer, the beneficiary, or a "
        "correspondent entity."
    )

    t.independent_review = (
        "Given the Organisation's Tranche 1 IFTI-DRA reporting obligations and "
        "its CRITICAL-rated inherent risk (third-party sender, Risk Matrix "
        "CR-02), the AML/CTF Program is independently reviewed ANNUALLY — more "
        "frequently than the base 3-year cycle that applies to lower-risk "
        "reporting entities.\n\n"
        "The review must additionally be brought forward:\n"
        "- Within 12 months of a material change to the business, corridor "
        "coverage, correspondent network, or regulatory obligations; or\n"
        "- As directed by AUSTRAC.\n\n"
        "INDEPENDENCE: the review must be conducted by a person independent of "
        "the AML/CTF function being reviewed — an internal audit function with "
        "appropriate independence, an external AML/CTF consultant or law firm, "
        "or a qualified independent reviewer approved by senior management.\n\n"
        "SCOPE: the review specifically tests IFTI-DRA reporting completeness "
        "and timeliness, third-party sender ECDD effectiveness, corridor risk "
        "assessment currency, and SMR decision-log completeness, in addition to "
        "the Program's general effectiveness.\n\n"
        "REPORTING: results are reported to senior management (Board or "
        "equivalent) and findings must be actioned and documented."
    )

    # Add IFTI-specific and remittance-specific controls
    extra_controls = [
        {
            "control_ref": "CTL-010",
            "title": "IFTI-DRA Reporting — Outgoing Transfers",
            "control_type": "detective",
            "risk_area": "ifti_reporting",
        },
        {
            "control_ref": "CTL-011",
            "title": "IFTI-DRA Reporting — Incoming Transfers",
            "control_type": "detective",
            "risk_area": "ifti_reporting",
        },
        {
            "control_ref": "CTL-012",
            "title": "Travel Rule Information Transmission",
            "control_type": "preventive",
            "risk_area": "travel_rule",
        },
        {
            "control_ref": "CTL-013",
            "title": "Sub-Agent Due Diligence and Monitoring",
            "control_type": "preventive",
            "risk_area": "agent_oversight",
        },
        {
            "control_ref": "CTL-014",
            "title": "Third-Party Sender Identification and ECDD (CR-02)",
            "control_type": "preventive",
            "risk_area": "third_party_sender",
        },
        {
            "control_ref": "CTL-015",
            "title": "Beneficiary Verification Before Fund Release",
            "control_type": "preventive",
            "risk_area": "beneficiary_screening",
        },
        {
            "control_ref": "CTL-016",
            "title": "Remittance Corridor Risk Assessment",
            "control_type": "preventive",
            "risk_area": "corridor_risk",
        },
        {
            "control_ref": "CTL-017",
            "title": "TMP Rules Schedule — General + Remittance-Specific Rules",
            "control_type": "detective",
            "risk_area": "transaction_monitoring",
        },
    ]

    t._policies = copy.deepcopy(BASE_POLICIES) + [
        {"title": "IFTI-DRA Reporting Procedures", "policy_type": "ifti"},
        {"title": "Travel Rule Compliance Policy", "policy_type": "travel_rule"},
        {"title": "Sub-Agent Management Policy", "policy_type": "agent_oversight"},
        {"title": "Third-Party Sender ECDD Policy", "policy_type": "ecdd"},
        {"title": "Remittance Corridor Risk Policy", "policy_type": "risk_assessment"},
    ]
    t._controls = copy.deepcopy(BASE_CONTROLS) + extra_controls

    return t
