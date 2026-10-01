"""
Accounting / Tax Agent risk library — Tranche 2.

All 17 factors below are drawn directly from the Organisation's real
VERIGO_ACCOUNTANT_Risk_Matrix_v1.xlsx (ISO 31000:2018, FATF DNFBP Guidance
2023, FATF Professional Money Laundering Report 2018, AUSTRAC Accounting
Sector Guidance), matching the source document's own dashboard total
("Total Risks Assessed: 17"). Refs match the real matrix's IDs exactly.

CATEGORY FOLDING (RiskCategoryType has exactly 7 members — customer,
product, service, geographic, channel, transaction, regulatory — see
app/models/risk_engine.py:54 — the real matrix uses 9 named categories):
- Entity Formation Risk (EF-01..04) -> product, consistent with Legal's
  entity-formation/nominee folding (PARKING_LOT.md P20).
- Tax Agent Risk (TA-01/TA-02) and Registered Company Auditor Risk
  (AU-01) -> service — distinct professional service lines, not
  transactional risk.
- Managed Client Funds Risk (MF-01) -> transaction, consistent with this
  session's established pooled/third-party-fund precedent (Conveyancers
  TXN-001, Remittance CR-02/PR-01, VASP PR-05, Legal PR-01, Real Estate
  PR-01).
- Employee/Internal Risk (ER-01) -> service (established precedent).
- Sanctions/PEP Risk (SP-01) and Program/Compliance Risk (PC-01/PC-02)
  -> regulatory (established precedent).
- Geographic Risk (GR-01) maps directly to the schema's geographic type.
- UNLIKE every other sector reviewed this session, the real matrix has NO
  delivery-channel risk category — no factor is folded into `channel`.
  The channel weight below is a small residual allowance reflecting this
  genuine absence, not an invented factor.

Likelihood/Consequence values and ratings below match the real matrix's
Risk Register and Dashboard exactly: CRITICAL (20-25/25) = CR-01, EF-01,
EF-03, MF-01; HIGH (12-19/25) = CR-02, CR-03, CR-04, EF-02, TA-01, TA-02,
GR-01, PC-01; MEDIUM (6-11/25) = EF-04, AU-01, ER-01, SP-01, PC-02.
"""

from app.templates.risk.base import LibraryFactor, RiskLibrary


def get_library() -> RiskLibrary:
    return RiskLibrary(
        industry="accounting",
        description=(
            "Accounting firm / tax agent — Tranche 2. No IFTI/TTR "
            "obligations unless remittance services are separately "
            "provided. Highest risks: entity formation with no legitimate "
            "purpose, nominee services, and managed client funds (all "
            "CRITICAL, AUSTRAC STR Ranks #1-#3)."
        ),
        category_weights={
            "customer": 0.24,
            "product": 0.20,
            "service": 0.14,
            "geographic": 0.08,
            "channel": 0.04,
            "transaction": 0.18,
            "regulatory": 0.12,
        },
        factors=[
            LibraryFactor(
                ref="CR-01",
                category_type="customer",
                name="Client refusing CDD or unable to explain source of funds",
                description=(
                    "Client refuses CDD or cannot explain the source of "
                    "funds used to capitalise, establish, or fund an "
                    "entity — the primary client-level ML risk for "
                    "accountants providing designated services."
                ),
                suggested_likelihood=4,
                suggested_consequence=5,
                rationale=(
                    "FATF DNFBP 2023 §4.1 and FATF PML 2018 §3.1: clients "
                    "who refuse CDD or cannot explain the origin of funds "
                    "represent the primary client-level ML risk for "
                    "accountants."
                ),
                mitigation_examples=[
                    "CDD mandatory before accepting instructions for any designated service",
                    "Decline engagement and notify AML/CTF CO of all CDD refusals",
                    "Source of funds for entity capitalisation documented for all engagements",
                ],
            ),
            LibraryFactor(
                ref="CR-02",
                category_type="customer",
                name="PEP as client, director, or beneficial owner",
                description=(
                    "Politically exposed person as client, director, or "
                    "beneficial owner of an entity serviced by the "
                    "practice."
                ),
                suggested_likelihood=3,
                suggested_consequence=5,
                rationale=(
                    "PEPs seeking to invest proceeds of corruption "
                    "frequently use accounting practices for entity "
                    "formation, nominee services, and financial structure "
                    "management."
                ),
                mitigation_examples=[
                    "PEP screening at onboarding via commercial database and media search",
                    "ECDD mandatory for all identified PEPs; Managing Partner approval for foreign PEPs",
                    "Source of wealth and funds documented independently",
                ],
            ),
            LibraryFactor(
                ref="CR-03",
                category_type="customer",
                name="Client from FATF grey/black-list jurisdiction",
                description=(
                    "Client from a FATF grey-list or black-list "
                    "jurisdiction requesting entity formation or nominee "
                    "services."
                ),
                suggested_likelihood=3,
                suggested_consequence=5,
                rationale=(
                    "Entity formation or nominee services for clients from "
                    "high-risk jurisdictions face elevated ML/TF/PF risk "
                    "due to limited ability to verify overseas source of "
                    "funds."
                ),
                mitigation_examples=[
                    "FATF grey/black-list reviewed monthly by AML/CTF CO",
                    "ECDD mandatory; certified documentation from originating jurisdiction required",
                    "Managing Partner approval required; decline if documentation inadequate",
                ],
            ),
            LibraryFactor(
                ref="CR-04",
                category_type="customer",
                name="Referral from unregulated intermediary",
                description=(
                    "Referral from an unregulated or unknown intermediary "
                    "with no direct access to the ultimate client."
                ),
                suggested_likelihood=3,
                suggested_consequence=4,
                rationale=(
                    "FATF PML 2018 §3.3: professional money launderers "
                    "insert intermediaries between the practice and the "
                    "ultimate client to obscure source of funds and client "
                    "identity."
                ),
                mitigation_examples=[
                    "Direct CDD on the ultimate client mandatory — cannot rely solely on intermediary CDD",
                    "Written authority from the underlying principal obtained",
                    "Decline where the underlying principal cannot be identified",
                ],
            ),
            LibraryFactor(
                ref="EF-01",
                category_type="product",
                name="Entity formed with no apparent legitimate purpose",
                description=(
                    "Company, trust, or other entity formed with no "
                    "apparent legitimate commercial, tax, or succession "
                    "purpose."
                ),
                suggested_likelihood=4,
                suggested_consequence=5,
                rationale=(
                    "AUSTRAC STR Rank #1 for accountants. FATF PML 2018 "
                    "§3.4: formation of shell companies and trusts is the "
                    "primary ML technique facilitated by accountants."
                ),
                mitigation_examples=[
                    "Document the stated commercial, tax, or succession purpose of every entity formed",
                    "ECDD for multi-jurisdictional structures, nominee shareholders/directors, or rapid multiple formations",
                    "Managing Partner approval for high-risk formations; decline if purpose unestablished",
                ],
            ),
            LibraryFactor(
                ref="EF-02",
                category_type="product",
                name="Shelf company or dormant company acquisition",
                description=(
                    "Client acquiring a pre-formed company with an "
                    "existing history rather than forming a new entity."
                ),
                suggested_likelihood=3,
                suggested_consequence=4,
                rationale=(
                    "Acquisition of shelf companies with established "
                    "histories is used to make newly-formed ML vehicles "
                    "appear as legitimate trading entities."
                ),
                mitigation_examples=[
                    "CDD on both the acquiring client and the shelf company itself",
                    "ECDD where the shelf company has existing financial history, bank accounts, or creditors",
                    "Managing Partner approval mandatory for all shelf company acquisitions",
                ],
            ),
            LibraryFactor(
                ref="EF-03",
                category_type="product",
                name="Nominee director, secretary, or shareholder services",
                description=(
                    "Accounting practice provides nominee director, "
                    "secretary, or shareholder services on behalf of an "
                    "undisclosed principal."
                ),
                suggested_likelihood=4,
                suggested_consequence=5,
                rationale=(
                    "AUSTRAC STR Rank #2 for accountants. Nominee services "
                    "are a primary vehicle for concealing the true "
                    "controller of an entity; a designated service under "
                    "Tranche 2."
                ),
                mitigation_examples=[
                    "ECDD mandatory for all nominee arrangements; identify and verify ultimate BO",
                    "Written authority from ultimate BO obtained and retained",
                    "Managing Partner approval for high-risk/offshore jurisdictions; annual review",
                ],
            ),
            LibraryFactor(
                ref="EF-04",
                category_type="product",
                name="Registered office services without adequate BO knowledge",
                description=(
                    "Registered office or business address service "
                    "provided without adequate knowledge of the entity's "
                    "purpose and true controller."
                ),
                suggested_likelihood=3,
                suggested_consequence=3,
                rationale=(
                    "Providing a registered business address without "
                    "adequate knowledge of purpose and controller "
                    "represents a beneficial-ownership opacity risk."
                ),
                mitigation_examples=[
                    "CDD on requesting party and the entity; identify and verify BO",
                    "Document stated purpose and commercial rationale for using the firm's address",
                    "Annual review; terminate where CDD cannot be maintained",
                ],
            ),
            LibraryFactor(
                ref="TA-01",
                category_type="service",
                name="Tax structuring advice bordering on concealment",
                description=(
                    "Tax structuring advice that appears designed to "
                    "conceal criminal income rather than minimise tax."
                ),
                suggested_likelihood=3,
                suggested_consequence=4,
                rationale=(
                    "The boundary between legitimate tax minimisation and "
                    "facilitation of ML through tax structuring is a key "
                    "risk for registered tax agents."
                ),
                mitigation_examples=[
                    "Tax agent staff trained to distinguish legitimate minimisation from income-concealment structures",
                    "Suspicious structuring requests escalated to AML/CTF CO",
                    "TPB Code of Professional Conduct obligations reinforced in training; SMR consideration",
                ],
            ),
            LibraryFactor(
                ref="TA-02",
                category_type="service",
                name="Client seeking to conceal assets/income from tax authorities",
                description=(
                    "Client seeking advice on concealing assets, income, "
                    "or beneficial ownership from tax authorities."
                ),
                suggested_likelihood=3,
                suggested_consequence=5,
                rationale=(
                    "Advice requests to conceal offshore income, use "
                    "nominee ownership to avoid disclosure, or structure "
                    "transactions to avoid reporting represent both a tax "
                    "and ML risk."
                ),
                mitigation_examples=[
                    "Mandatory AML/CTF CO escalation before any advice provided",
                    "Engagement letter prohibits facilitating tax evasion or AML/CTF Act breaches",
                    "Decline engagement; SMR consideration; ATO referral if tax evasion confirmed",
                ],
            ),
            LibraryFactor(
                ref="AU-01",
                category_type="service",
                name="Audit engagement concealing ML/TF proceeds",
                description=(
                    "Audit engagement where financial statements appear "
                    "to conceal ML/TF proceeds, where the practice also "
                    "provides designated services to the same client."
                ),
                suggested_likelihood=2,
                suggested_consequence=4,
                rationale=(
                    "Registered company auditors may encounter financial "
                    "statements concealing ML/TF proceeds; not exempt from "
                    "SMR obligations where they hold a dual role providing "
                    "designated services to the same client."
                ),
                mitigation_examples=[
                    "Escalate unusual transactions identified during audit work to AML/CTF CO for SMR assessment",
                    "Independence obligations assessed against AML/CTF CO reporting requirements",
                    "ASIC referral if audit concerns identified",
                ],
            ),
            LibraryFactor(
                ref="MF-01",
                category_type="transaction",
                name="Unexplained or third-party managed client funds",
                description=(
                    "Unexplained or third-party funds received into a "
                    "client account managed by the accounting practice."
                ),
                suggested_likelihood=4,
                suggested_consequence=5,
                rationale=(
                    "AUSTRAC STR Rank #3 for accountants. Practices "
                    "managing client money may receive funds from third "
                    "parties or in amounts inconsistent with the stated "
                    "purpose of the account, constituting layering."
                ),
                mitigation_examples=[
                    "Identify and verify all remitting parties before receipt; same CDD as if payer were the client",
                    "Large or unusual deposits require AML/CTF CO sign-off before acceptance",
                    "SMR mandatory if source of funds unexplained; Managing Partner approval before any refund",
                ],
            ),
            LibraryFactor(
                ref="GR-01",
                category_type="geographic",
                name="Entity formation/nominee services in high-risk jurisdictions",
                description=(
                    "Entity formation or nominee services requested for "
                    "entities in high-risk jurisdictions."
                ),
                suggested_likelihood=3,
                suggested_consequence=5,
                rationale=(
                    "Offshore entity formation and nominee services in "
                    "high-risk jurisdictions represent the intersection of "
                    "the two highest accounting sector ML risks."
                ),
                mitigation_examples=[
                    "FATF grey/black-list reviewed monthly",
                    "ECDD mandatory for offshore formations/nominee arrangements; DFAT and UN sanctions screening",
                    "Managing Partner approval required; decline if documentation inadequate",
                ],
            ),
            LibraryFactor(
                ref="ER-01",
                category_type="service",
                name="Accountant or staff facilitating ML/TF",
                description=(
                    "Accountant or staff member knowingly facilitating "
                    "ML/TF — professional complicity or fee-pressure "
                    "acceptance."
                ),
                suggested_likelihood=2,
                suggested_consequence=5,
                rationale=(
                    "Accountants have been identified in Australian ML "
                    "investigations as knowingly forming entities, "
                    "providing nominee services, or managing funds for "
                    "criminal clients; billing pressure is a contributing "
                    "factor."
                ),
                mitigation_examples=[
                    "Employee due diligence: CDD, reference checks, AFP criminal history check, PEP/sanctions screening",
                    "Dual authorisation for client fund disbursements > AUD $50,000",
                    "Whistleblower policy and hotline; AML/CTF CO authority overrides billing targets",
                ],
            ),
            LibraryFactor(
                ref="SP-01",
                category_type="regulatory",
                name="Entity formation/management for sanctioned parties",
                description=(
                    "Entity formation or management for or on behalf of a "
                    "sanctioned person or entity."
                ),
                suggested_likelihood=2,
                suggested_consequence=5,
                rationale=(
                    "Accountants forming or managing entities on behalf of "
                    "sanctioned parties facilitate sanctions evasion — a "
                    "criminal offence carrying significant penalties."
                ),
                mitigation_examples=[
                    "DFAT and UN sanctions lists screened for all clients, BOs, and entities before engagement",
                    "Live list access only; re-screening at material engagement stages",
                    "Positive match: immediate cessation, AFP notification within 24 hours, SMR within 24 hours",
                ],
            ),
            LibraryFactor(
                ref="PC-01",
                category_type="regulatory",
                name="SMR failure — suspicious matter not reported",
                description=(
                    "Suspicious matter not reported to AUSTRAC, or "
                    "reporting decision not documented."
                ),
                suggested_likelihood=3,
                suggested_consequence=5,
                rationale=(
                    "Failure to lodge SMRs is the most heavily penalised "
                    "AML/CTF breach; the accounting sector historically "
                    "has low SMR submission rates, indicating systemic "
                    "under-reporting."
                ),
                mitigation_examples=[
                    "SMR procedure documented and trained for all accountants and staff",
                    "AML/CTF CO decision documented within 24 hours of escalated suspicion",
                    "Quarterly log review by Managing Partner; annual external compliance review",
                ],
            ),
            LibraryFactor(
                ref="PC-02",
                category_type="regulatory",
                name="Program not correctly distinguishing designated services",
                description=(
                    "AML/CTF Program inadequate, not updated for Tranche "
                    "2, or not correctly distinguishing designated from "
                    "non-designated services."
                ),
                suggested_likelihood=2,
                suggested_consequence=4,
                rationale=(
                    "The most common program risk for accountants is "
                    "failing to correctly identify which services are "
                    "designated (entity formation, nominee) versus not "
                    "designated (tax returns, audit); programs must be "
                    "Tranche 2-ready before 1 July 2026."
                ),
                mitigation_examples=[
                    "Annual independent review by external AML/CTF specialist",
                    "Program includes current designated vs non-designated service mapping",
                    "Tranche 2 readiness assessment completed before 1 July 2026",
                ],
            ),
        ],
    )
