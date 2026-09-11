"""
Accounting / Tax Agent AML template — Tranche 2 (2026 reform).
NO IFTI/TTR (unless the firm separately provides remittance services). Key
risks: entity formation, nominee/registered office services, managed client
funds, tax-structuring advice that crosses into concealment of criminal
income.

Content is drawn from the Organisation's real VERIGO_ACCOUNTANT_* document
suite: KYC_Guideline (VERIGO-ACC-KYC-G01), ECDD_Guideline
(VERIGO-ACC-ECDD-G01), TMP_Guideline (VERIGO-ACC-TMP-G01), SMR_Guideline
(VERIGO-ACC-SMR-G01), Sanctions_Policy (VERIGO-ACC-SANC-P01), RATP_Addendum
(VERIGO-ACC-RATP-A01, Module M-10), and the Risk_Matrix
(VERIGO_ACCOUNTANT_Risk_Matrix_v1.xlsx, ISO 31000:2018, 17-row
inherent/residual register). The AML/CTF Program (AMLCTF_Template) exists
only as an unreadable .dotx in the source suite — this rewrite proceeds
from the other six documents, which extensively cross-reference and
restate the Program's substantive content (as with the Legal sector, see
PARKING_LOT.md P20).

DESIGNATED VS NON-DESIGNATED SERVICES is the single most load-bearing
distinction for this sector — more so than for any other Tranche 2 sector
reviewed this session. Per the real TMP Guideline §12.1: income tax return
preparation and lodgement, BAS/FBT/payroll tax compliance, financial
statement preparation, and pure audit/assurance work are explicitly NOT
designated services and are NOT subject to AML/CTF obligations. Entity
formation, nominee/registered office services, and managed client funds
ARE designated services. Critically, where a single engagement spans both
designated and non-designated components, the ENTIRE engagement falls
within AML/CTF scope — this "mixed engagement" rule was entirely absent
from the prior generic template.

AUSTRAC's ranked STR typologies for this sector (SMR Guideline §12,
Risk Matrix source references): #1 entity formation with no legitimate
purpose (EF-01, CRITICAL 20/25), #2 nominee director/secretary/shareholder
services (EF-03, CRITICAL 20/25), #3 unexplained/unidentified managed
client fund receipts (MF-01, CRITICAL 20/25).

DUAL REGULATORY REGIME: registered tax agents operate under a parallel
Tax Practitioners Board (TPB) Code of Professional Conduct / Tax Agent
Services Act 2009 regime alongside the AML/CTF Act. Tax structuring advice
that crosses from legitimate minimisation into concealment of criminal
income (Risk Matrix TA-01/TA-02) is both a TPB Code breach and a
potential SMR trigger, with a parallel ATO reporting consideration. APES
110 (CPA Australia / CA ANZ / IPA) is referenced throughout the source
suite as a complementary professional-ethics framework.

CATEGORY FOLDING (RiskCategoryType has exactly 7 members — see
app/models/risk_engine.py:54 — the real matrix uses 9 categories):
- Entity Formation Risk (EF-01..04) -> product. These are service-line
  offerings (forming/administering entities) analogous to Legal's
  entity-formation/nominee PR-02/PR-03 -> product folding (PARKING_LOT P20).
- Tax Agent Risk (TA-01/TA-02) and Registered Company Auditor Risk
  (AU-01) -> service. Distinct professional service lines (tax agent
  services; dual-role audit engagements), not transactional risk.
- Managed Client Funds Risk (MF-01) -> transaction, consistent with this
  session's established precedent for pooled/third-party-fund typologies
  (Conveyancers TXN-001, Remittance CR-02/PR-01, VASP PR-05, Legal PR-01,
  Real Estate PR-01).
- Employee/Internal Risk (ER-01) -> service (established precedent).
- Sanctions/PEP Risk (SP-01) and Program/Compliance Risk (PC-01/PC-02)
  -> regulatory (established precedent).
- Geographic Risk (GR-01) maps directly to the schema's geographic type.
- UNLIKE every other sector reviewed this session, the real Accountants
  Risk Matrix has NO delivery-channel risk category at all — no rows are
  folded into `channel`. This is a genuine finding, not an omission: the
  channel weight below is retained only as a residual/systemic allowance,
  matching the source document's structure rather than inventing a
  channel factor to fill the schema.

TTR/IFTI: the real Risk Matrix and TMP Guideline confirm GEN-01 (physical
currency >= AUD $10,000) remains a live, monitored general rule even
though accounting engagements are not expected to routinely involve cash
receipts — mirroring the Legal sector's resolution of the same
oversimplification (PARKING_LOT.md P20).
"""

import copy

from app.templates.aml.base import BASE_CONTROLS, BASE_POLICIES, AMLTemplateBase


def get_template(risk_level: str = "medium") -> AMLTemplateBase:
    t = AMLTemplateBase(industry="accounting", risk_level=risk_level)
    t.has_ifti_obligation = False
    t.has_ttr_obligation = False
    t.has_travel_rule = False
    t.is_tranche_2 = True

    t.scope = (
        "This Program applies to accounting and tax services provided by the "
        "Organisation that constitute designated services under the AML/CTF "
        "Act as amended (Tranche 2, commencing 1 July 2026 anticipated).\n\n"
        "IN-SCOPE DESIGNATED SERVICES:\n"
        "- Company, trust, or other entity formation, structuring, or "
        "dissolution;\n"
        "- Acting as, or arranging, a nominee director, secretary, trustee, "
        "or shareholder;\n"
        "- Registered office or business address services;\n"
        "- Managing or holding client monies or assets in a managed client "
        "funds account.\n\n"
        "NOT DESIGNATED SERVICES (per TMP Guideline §12.1):\n"
        "- Income tax return preparation and lodgement;\n"
        "- BAS, FBT, and payroll tax compliance;\n"
        "- Preparation of financial statements and management accounts;\n"
        "- Audit and assurance engagements, UNLESS the same client also "
        "receives a designated service from the Organisation;\n"
        "- Advice-only engagements with no financial flows.\n\n"
        "MIXED ENGAGEMENTS: where a single engagement spans both designated "
        "and non-designated components (for example, an audit client who "
        "also uses the firm's entity formation or managed funds service), "
        "the ENTIRE engagement falls within the scope of this Program — the "
        "non-designated components are not carved out."
    )

    t.designated_services = (
        "The Organisation provides the following designated services:\n"
        "- Entity formation, structuring and dissolution (company, trust, "
        "or other legal arrangement);\n"
        "- Nominee director, secretary, trustee, or shareholder services;\n"
        "- Registered office and business address services;\n"
        "- Managed client funds — holding or managing client monies.\n\n"
        "As a Tranche 2 entity, IFTI and TTR reporting obligations do not "
        "apply unless the Organisation separately provides remittance "
        "services. TMP rule GEN-01 (physical currency >= AUD $10,000) "
        "remains a live monitored rule regardless (see ttr_procedures).\n\n"
        "Registered tax agents providing tax agent services to business "
        "clients face parallel obligations under the Tax Practitioners "
        "Board (TPB) Code of Professional Conduct and the Tax Agent "
        "Services Act 2009, in addition to this Program."
    )

    t.risk_factors_customer = (
        "Accounting-specific customer risk factors (Risk Matrix Customer "
        "Risk category, CR-01 to CR-04):\n"
        "- CR-01 — client refusing CDD or unable to explain the source of "
        "funds used to capitalise, establish, or fund an entity — the "
        "primary client-level ML risk for accountants (CRITICAL, 20/25);\n"
        "- CR-02 — PEP as client, director, or beneficial owner, frequently "
        "using accounting practices for entity formation, nominee services, "
        "or financial structure management to invest proceeds of corruption "
        "(HIGH, 15/25);\n"
        "- CR-03 — client from a FATF grey-list or black-list jurisdiction "
        "requesting entity formation or nominee services (HIGH, 15/25);\n"
        "- CR-04 — referral from an unregulated or unknown intermediary "
        "with no direct client access — professional money launderers "
        "insert intermediaries to obscure source of funds and client "
        "identity (HIGH, 12/25)."
    )

    t.risk_factors_product = (
        "Accounting-specific product/service risk factors (Risk Matrix "
        "Entity Formation Risk category, EF-01 to EF-04):\n"
        "- EF-01 — company, trust, or other entity formed with no apparent "
        "legitimate commercial, tax, or succession purpose (AUSTRAC STR "
        "Rank #1, CRITICAL, 20/25);\n"
        "- EF-02 — shelf company or dormant company acquisition, used to "
        "make a newly-formed ML vehicle appear as a legitimate trading "
        "entity with an established history (HIGH, 12/25);\n"
        "- EF-03 — nominee director, secretary, or shareholder services — a "
        "primary vehicle for concealing the true controller of an entity "
        "(AUSTRAC STR Rank #2, CRITICAL, 20/25);\n"
        "- EF-04 — registered office or business address services provided "
        "without adequate knowledge of the entity's purpose and true "
        "controller (MEDIUM, 9/25)."
    )

    t.beneficial_ownership_procedures = (
        "For all business clients, the Organisation identifies and "
        "verifies:\n"
        "- All individuals owning or controlling >= 25% of the business;\n"
        "- All directors and senior managing officials;\n"
        "- Where the client is a trust: trustee(s), settlor, and material "
        "beneficiaries.\n\n"
        "ENTITY FORMATION: the beneficial owner must be identified and "
        "verified BEFORE forming the company, trust, or other legal "
        "arrangement — not after. The stated commercial, tax, or succession "
        "purpose of every entity formed must be documented and assessed for "
        "plausibility against the client's profile and instructions. "
        "Decline the engagement where the legitimate purpose cannot be "
        "established.\n\n"
        "NOMINEE ARRANGEMENTS: where the Organisation acts as, or arranges, "
        "a nominee director, secretary, trustee, or shareholder, it must "
        "identify and verify the ultimate beneficial owner on whose behalf "
        "the nominee acts, obtain written authority from that beneficial "
        "owner, and review the arrangement annually. Decline or terminate "
        "the arrangement where the ultimate beneficial owner cannot be "
        "identified or CDD can no longer be maintained.\n\n"
        "SHELF COMPANY ACQUISITIONS: beneficial ownership of both the "
        "acquiring client and the shelf company itself must be verified, "
        "with the source of acquisition funds documented."
    )

    t.cdd_individuals = (
        "For individual clients, the Organisation collects and verifies "
        "(per KYC Guideline):\n\n"
        "IDENTIFICATION:\n"
        "- Full legal name, date of birth, residential address;\n"
        "- Occupation, source of funds for the specific engagement, "
        "expected transaction activity;\n"
        "- Whether the client is acting on their own behalf or as an agent "
        "or nominee, and the designated service(s) sought.\n\n"
        "VERIFICATION — must use at least one of:\n"
        "- Primary photographic document (passport, driver's licence);\n"
        "- Primary non-photographic document PLUS a secondary document;\n"
        "- Reliable electronic data matching (eKYC).\n\n"
        "CDD MUST BE COMPLETED BEFORE the Organisation accepts instructions "
        "for any designated service — entity formation, nominee "
        "arrangement, registered office service, or managed client funds "
        "engagement — and before any client funds are received. CDD is not "
        "required for genuinely non-designated engagements (tax returns, "
        "BAS, audit-only), but a MIXED ENGAGEMENT pulls the whole "
        "relationship into scope (see scope)."
    )

    t.cdd_enhanced_procedures = (
        "ECDD is mandatory where any of the following triggers apply "
        "(cross-referenced to the Risk Matrix):\n\n"
        "SECTOR-SPECIFIC TRIGGERS:\n"
        "- ENTITY FORMATION — no documented legitimate commercial, tax, or "
        "succession purpose (Risk Matrix EF-01, CRITICAL, AUSTRAC STR Rank "
        "#1) — assess purpose plausibility, ECDD for multi-jurisdictional "
        "or nominee-controlled structures, Managing Partner approval for "
        "high-risk formations, decline where purpose cannot be "
        "established;\n"
        "- SHELF COMPANY ACQUISITION — client acquiring a pre-formed entity "
        "with existing history (Risk Matrix EF-02, HIGH) — assess "
        "rationale for acquiring existing history over forming a new "
        "entity, ECDD where the shelf company has existing financial "
        "history, Managing Partner approval mandatory;\n"
        "- NOMINEE SERVICES — director, secretary, trustee, or shareholder "
        "arrangement where the ultimate beneficial owner cannot be "
        "identified (Risk Matrix EF-03, CRITICAL, AUSTRAC STR Rank #2) — "
        "ECDD mandatory, written authority from the ultimate BO, Managing "
        "Partner approval for offshore or high-risk jurisdiction nominees, "
        "annual review;\n"
        "- MANAGED CLIENT FUNDS — unexplained or third-party funds received "
        "into a client account managed by the practice (Risk Matrix MF-01, "
        "CRITICAL, AUSTRAC STR Rank #3) — same CDD as if the payer were the "
        "client, source of funds confirmed in writing, AML/CTF CO sign-off "
        "before acceptance of large or unusual deposits (>= AUD $50,000), "
        "Managing Partner approval before any refund of unexplained funds;\n"
        "- TAX STRUCTURING — advice requested that appears designed to "
        "conceal the origin of income rather than achieve legitimate tax "
        "minimisation (Risk Matrix TA-01, HIGH) — mandatory AML/CTF CO "
        "escalation before any advice is provided;\n"
        "- CONCEALMENT REQUESTS — client seeking advice on concealing "
        "assets, income, or beneficial ownership from tax authorities or "
        "regulators (Risk Matrix TA-02, HIGH) — decline to advise, AML/CTF "
        "CO and Managing Partner review, SMR consideration, ATO referral "
        "consideration under the parallel TPB/TASA regime;\n"
        "- INTERMEDIARY REFERRALS — instructions received without direct "
        "access to the ultimate client (Risk Matrix CR-04) — direct CDD on "
        "the underlying principal is mandatory;\n"
        "- Foreign PEP as client, director, trustee, or beneficial owner "
        "(Risk Matrix CR-02);\n"
        "- Client or funds from a FATF grey/black-list jurisdiction (Risk "
        "Matrix CR-03/GR-01).\n\n"
        "APPROVAL AUTHORITY: Managing Partner approval is required for "
        "complex or offshore entity formations, all nominee arrangements in "
        "high-risk jurisdictions, and any managed client funds receipt "
        "above AUD $50,000. Every ECDD case is documented in an ECDD Case "
        "File recording the trigger, client profile, measures applied, "
        "approval workflow, and outcome, including a documented SMR "
        "consideration."
    )

    t.pep_procedures = (
        "IDENTIFICATION: at onboarding and on an ongoing basis, the "
        "Organisation screens all clients, beneficial owners, and — for "
        "entity formation and nominee engagements — proposed directors and "
        "trustees, against PEP databases via commercial database search, "
        "internet/media search, and a mandatory client self-declaration.\n\n"
        "RISK RATING: PEPs are rated HIGH inherent risk (Risk Matrix CR-02, "
        "15/25). PEPs seeking to invest proceeds of corruption frequently "
        "use accounting practices for entity formation, nominee services, "
        "and financial structure management.\n\n"
        "FOREIGN PEPs: ECDD is mandatory regardless of other risk factors. "
        "Managing Partner approval is required before accepting "
        "instructions. Source of wealth and source of funds must be "
        "established from independent documentary evidence. Enhanced OCDD "
        "applies throughout the engagement.\n\n"
        "DOMESTIC PEPs / close associates: risk-based — the Compliance "
        "Officer assesses whether high ML/TF risk applies; if so, the same "
        "measures as for foreign PEPs apply.\n\n"
        "The Organisation will NOT accept or continue instructions for a "
        "foreign PEP without prior Managing Partner approval documented in "
        "writing."
    )

    t.sanctions_procedures = (
        "The Organisation complies with Australia's targeted financial "
        "sanctions obligations under the Charter of the United Nations Act "
        "1945 and the Autonomous Sanctions Act 2011 (Sanctions Policy "
        "VERIGO-ACC-SANC-P01).\n\n"
        "MANDATORY LISTS — accessed LIVE at the time of screening, never "
        "cached: DFAT Consolidated Sanctions List; UN Security Council "
        "Consolidated List.\n\n"
        "WHO IS SCREENED: client, beneficial owners, directors/trustees, "
        "any entity to be formed or administered (including proposed "
        "directors and beneficial owners), any nominee-arrangement "
        "principal, and managed client fund remitting parties — before "
        "accepting entity formation, nominee, or managed funds "
        "instructions, and monthly thereafter for existing nominee and "
        "registered office arrangements.\n\n"
        "CONFIRMED MATCH — immediate response (Risk Matrix SP-01, ML "
        "scenario: forming or managing entities on behalf of a sanctioned "
        "person or entity facilitates sanctions evasion):\n"
        "1. Immediately cease the engagement;\n"
        "2. Do NOT tip off the matched party;\n"
        "3. Notify the AML/CTF Compliance Officer immediately;\n"
        "4. Notify the Managing Partner immediately;\n"
        "5. Report to the AFP within 24 hours;\n"
        "6. Lodge an SMR with AUSTRAC within 24 hours.\n\n"
        "All screening and confirmed-match actions are recorded in the "
        "Sanctions Screening Log."
    )

    t.transaction_monitoring = (
        "The Organisation operates a rules-based Transaction Monitoring "
        "Program (TMP-G01) combining 10 general AML/CTF rules and 12 "
        "accounting-sector-specific rules, calibrated to the Risk "
        "Matrix.\n\n"
        "APPLICABILITY: the TMP applies ONLY to designated accounting "
        "services (entity formation, nominee/registered office services, "
        "managed client funds) — NOT to tax return preparation, BAS, "
        "financial statement preparation, or audit-only engagements, "
        "except where a mixed engagement pulls the whole relationship into "
        "scope (see scope).\n\n"
        "GENERAL RULES (GEN-01 to GEN-10): physical currency >= AUD "
        "$10,000 (a live monitored rule despite cash receipts not being "
        "routine for this sector — see ttr_procedures); volume increase >= "
        "100% in 5 days; sanctions match; PEP with no/lapsed ECDD; "
        "structuring; baseline deviation; third-party unidentified funds; "
        "high-risk jurisdiction funds; rapid fund movement < 48 hours; "
        "unusual arrangements.\n\n"
        "SECTOR-SPECIFIC RULES (ACC-01 to ACC-12), each with a defined "
        "threshold, review frequency, and responsible officer:\n"
        "- ACC-01 — entity formation with no documented legitimate purpose "
        "(AUSTRAC STR Rank #1): per engagement, Compliance Officer;\n"
        "- ACC-02 — 3 or more entity formations for the same client within "
        "60 days: monthly, Compliance Officer + Managing Partner;\n"
        "- ACC-03 — shelf company acquisition: per engagement, Compliance "
        "Officer + Managing Partner;\n"
        "- ACC-04 — nominee services for an offshore or high-risk "
        "jurisdiction entity: per engagement, Compliance Officer + "
        "Managing Partner;\n"
        "- ACC-05 — managed client funds received from an unidentified "
        "third party: per receipt, Compliance Officer;\n"
        "- ACC-06 — managed client funds deposit >= AUD $50,000 that is "
        "unexpected or unusual: per receipt, Compliance Officer + Managing "
        "Partner;\n"
        "- ACC-07 — managed client funds overpayment followed by a refund "
        "request: per request, Compliance Officer + Managing Partner;\n"
        "- ACC-08 — tax structuring advice suspected of concealing "
        "criminal income: per engagement, Tax Team Leader + Compliance "
        "Officer;\n"
        "- ACC-09 — client seeking advice on concealing assets or "
        "beneficial ownership from regulators: as identified, Compliance "
        "Officer + Managing Partner;\n"
        "- ACC-10 — registered office client with no apparent business "
        "activity: annual review, Compliance Officer;\n"
        "- ACC-11 — referral from an unregulated intermediary with no "
        "direct client access: per engagement, Compliance Officer;\n"
        "- ACC-12 — PEP as client, director, trustee, or beneficial owner: "
        "per engagement, Compliance Officer + Managing Partner.\n\n"
        "ALERT ASSESSMENT TIMEFRAMES: CRITICAL (sanctions/TF) = 1 hour, "
        "HIGH (structured/PEP/high-risk jurisdiction) = 24 hours, MEDIUM "
        "(baseline deviation/third-party funds) = 48 hours, LOW (minor "
        "deviation) = 5 business days.\n\n"
        "Every alert is recorded in a TMP Alert Log and retained for 7 "
        "years."
    )

    t.smr_procedures = (
        "OBLIGATION: the Organisation must report a Suspicious Matter to "
        "AUSTRAC as soon as practicable and no later than 24 hours "
        "(terrorism financing) or 3 business days (all other matters) "
        "after the Compliance Officer forms a suspicion under s.41 of the "
        "AML/CTF Act.\n\n"
        "SUSPICION STANDARD: lower than proof; no minimum matter value; a "
        "continuing obligation regardless of whether the matter has "
        "already concluded.\n\n"
        "SECTOR-SPECIFIC SMR TRIGGERS, the most commonly reported ML/TF "
        "typologies in AUSTRAC STR data for accountants (SMR-G01 §12):\n"
        "1. ENTITY FORMATION — NO LEGITIMATE PURPOSE (AUSTRAC STR Rank "
        "#1) — company, trust, or other legal arrangement formed with no "
        "documented commercial, tax, or succession purpose; includes "
        "shelf company acquisitions the client cannot explain;\n"
        "2. NOMINEE SERVICES (AUSTRAC STR Rank #2) — the ultimate "
        "beneficial owner of a nominee arrangement cannot be identified, "
        "or nominee services are requested through an unregulated "
        "intermediary;\n"
        "3. MANAGED CLIENT FUNDS (AUSTRAC STR Rank #3) — funds received "
        "from a person not identified as the client, an unexplained "
        "overpayment-and-refund request, or client funds moved through "
        "the managed account with no apparent commercial purpose;\n"
        "4. TAX STRUCTURING AND TAX EVASION — structuring advice that "
        "appears designed to conceal criminal income as legitimate "
        "business income, or a request to conceal offshore assets from "
        "the ATO or ASIC. Where this trigger is identified, the "
        "Compliance Officer must also consider whether there is a "
        "parallel obligation to report under the Tax Agent Services Act "
        "2009 and the TPB Code of Professional Conduct.\n\n"
        "PROCEDURE: employee escalates to the Compliance Officer "
        "immediately; CO reviews and determines whether suspicion is "
        "formed; if confirmed, the SMR is lodged via AUSTRAC Online using "
        "the Pre-Lodgement Checklist; the existence of an SMR decision — "
        "including a decision NOT to lodge — is retained in the SMR "
        "Internal Decision Log regardless of outcome.\n\n"
        "TIPPING OFF: it is a criminal offence under s.123 (up to 2 years "
        "imprisonment) to disclose to any person, including the client's "
        "own tax agent, lawyer, or a co-worker who does not need to know, "
        "that an SMR has been or may be submitted."
    )

    t.ttr_procedures = (
        "Cash receipts are not expected in the ordinary course of the "
        "Organisation's designated accounting services, and the "
        "Organisation's practice is to require client payments and "
        "managed-funds transfers by bank transfer rather than physical "
        "currency.\n\n"
        "This does NOT remove the underlying obligation: TMP rule GEN-01 "
        "(physical currency >= AUD $10,000) remains a live, monitored rule "
        "for the exceptional case a cash receipt occurs. Any client who "
        "offers physical currency must be referred to the Compliance "
        "Officer immediately, given the sector's structuring risk (TMP "
        "rule GEN-05). Where physical currency of AUD $10,000 or more is "
        "received, a TTR must be lodged with AUSTRAC within 10 business "
        "days — separate from and in addition to any SMR obligation."
    )

    t.ifti_procedures = (
        "IFTI reporting does not apply to this Organisation's designated "
        "accounting services, unless the Organisation separately provides "
        "remittance or international funds transfer services."
    )

    t.independent_review = (
        "Given the real Risk Matrix's CRITICAL-rated inherent risks "
        "(client CDD refusal CR-01, entity formation with no legitimate "
        "purpose EF-01, nominee services EF-03, and managed client funds "
        "MF-01 — all 20/25), the AML/CTF Program is independently reviewed "
        "ANNUALLY rather than the base 3-year cycle, by an external "
        "AML/CTF specialist.\n\n"
        "The review must additionally be brought forward:\n"
        "- Within 12 months of a material change to the business, client "
        "base, or regulatory obligations;\n"
        "- As directed by AUSTRAC;\n"
        "- A Tranche 2 readiness assessment must be completed before 1 "
        "July 2026, including verification that the Program correctly "
        "distinguishes designated from non-designated services.\n\n"
        "SCOPE: the review specifically tests entity formation and "
        "nominee ECDD effectiveness, managed client funds account "
        "controls, the designated-vs-non-designated service boundary "
        "(the most common program deficiency identified in the Risk "
        "Matrix, PC-02), the TPB/AML-CTF dual-regulatory interface for tax "
        "structuring advice, and SMR decision-log completeness, in "
        "addition to the Program's general effectiveness.\n\n"
        "REPORTING: results are reported to senior management (Managing "
        "Partner or equivalent) and findings must be actioned and "
        "documented."
    )

    extra_controls = [
        {
            "control_ref": "CTL-010",
            "title": "Entity Formation Purpose Assessment and BO Verification",
            "control_type": "preventive",
            "risk_area": "entity_formation",
        },
        {
            "control_ref": "CTL-011",
            "title": "Nominee Services ECDD and Annual Review",
            "control_type": "preventive",
            "risk_area": "nominee_services",
        },
        {
            "control_ref": "CTL-012",
            "title": "Managed Client Funds Third-Party Receipt Review",
            "control_type": "detective",
            "risk_area": "managed_client_funds",
        },
        {
            "control_ref": "CTL-013",
            "title": "Tax Structuring Advice Escalation (TPB/AML-CTF Interface)",
            "control_type": "preventive",
            "risk_area": "tax_agent",
        },
        {
            "control_ref": "CTL-014",
            "title": "Designated vs Non-Designated Service Mapping",
            "control_type": "preventive",
            "risk_area": "program_compliance",
        },
        {
            "control_ref": "CTL-015",
            "title": "Shelf Company Acquisition Review",
            "control_type": "preventive",
            "risk_area": "entity_formation",
        },
    ]

    t._policies = copy.deepcopy(BASE_POLICIES) + [
        {
            "title": "Entity Formation and Nominee Services ECDD Policy",
            "policy_type": "ecdd",
        },
        {
            "title": "Managed Client Funds AML Policy",
            "policy_type": "managed_client_funds",
        },
        {
            "title": "Tax Structuring / TPB-AML-CTF Interface Policy",
            "policy_type": "tax_agent",
        },
        {
            "title": "Designated Services Scope Policy",
            "policy_type": "program_compliance",
        },
    ]
    t._controls = copy.deepcopy(BASE_CONTROLS) + extra_controls

    return t
