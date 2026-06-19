"""
AML Template base dataclass.

All industry templates inherit from AMLTemplateBase. Fields map 1:1
to AMLProgram model columns. Industry subclasses override only what differs.
Risk overlays are applied on top to adjust language for low/medium/high risk appetite.
"""

from __future__ import annotations

from dataclasses import dataclass


@dataclass
class AMLTemplateBase:
    """
    Base AML/CTF Program content — reflects the 2026 single consolidated
    program structure under the AML/CTF Amendment Act 2024 and Rules 2025.

    Content is written to be industry-agnostic and AUSTRAC-compliant.
    Industry subclasses replace sections that differ materially.
    """

    # ── Meta ──────────────────────────────────────────────────────────────────
    industry: str = "other"
    risk_level: str = "medium"  # low | medium | high

    # Tranche flags — controls which reporting sections are active
    has_ifti_obligation: bool = False
    has_ttr_obligation: bool = False
    has_travel_rule: bool = False
    is_tranche_2: bool = False

    # ── Section 1: Overview & Scope ───────────────────────────────────────────
    overview: str = (
        "This AML/CTF Program ('Program') has been adopted by [Organisation Name] "
        "('the Organisation') in compliance with the Anti-Money Laundering and "
        "Counter-Terrorism Financing Act 2006 (Cth) ('AML/CTF Act') as amended by "
        "the Anti-Money Laundering and Counter-Terrorism Financing Amendment Act 2024, "
        "and the AML/CTF Rules 2025 (commencing 31 March 2026).\n\n"
        "The Program is a single, consolidated risk-based document that sets out how "
        "the Organisation identifies, mitigates and manages its money laundering, "
        "terrorism financing and proliferation financing ('ML/TF/PF') risks.\n\n"
        "The Organisation is a reporting entity under the AML/CTF Act and must comply "
        "with this Program from the date it is adopted and as varied from time to time."
    )

    scope: str = (
        "This Program applies to:\n"
        "- All designated services provided by the Organisation;\n"
        "- All employees, contractors and agents involved in providing designated services;\n"
        "- All permanent establishments of the Organisation in Australia;\n"
        "- All customer relationships, including new and existing customers.\n\n"
        "The AML/CTF Compliance Officer is responsible for maintaining and implementing "
        "this Program and must report directly to senior management."
    )

    designated_services: str = (
        "The Organisation provides the following designated services as listed in the "
        "AML/CTF Act:\n\n"
        "[To be completed: list the specific designated service items from Table 1 "
        "of section 6 of the AML/CTF Act that apply to this Organisation's business.]"
    )

    # ── Section 2: ML/TF/PF Risk Assessment (EWRA) ───────────────────────────
    ewra_summary: str = (
        "The Organisation conducts an Enterprise-Wide Risk Assessment ('EWRA') at "
        "least annually, or whenever there is a material change to the business, "
        "customer base, products, delivery channels, geographic exposure or regulatory "
        "obligations.\n\n"
        "The EWRA uses a risk-based approach to assess inherent ML/TF/PF risks and "
        "the effectiveness of controls, resulting in a residual risk rating. "
        "Risk ratings are: Low, Medium, High, or Critical."
    )

    risk_factors_customer: str = (
        "Customer risk factors considered include:\n"
        "- Politically Exposed Persons (PEPs) and their associates;\n"
        "- Customers from high-risk jurisdictions (FATF grey/black list countries);\n"
        "- Non-face-to-face customer relationships;\n"
        "- Customers with complex or opaque ownership structures;\n"
        "- Customers whose source of funds or wealth is unclear;\n"
        "- Customers with a history of suspicious behaviour;\n"
        "- High-volume or high-value transaction customers."
    )

    risk_factors_product: str = (
        "Product and service risk factors include:\n"
        "- Anonymity features of the product or service;\n"
        "- Speed and irreversibility of transactions;\n"
        "- Cross-border nature of transactions;\n"
        "- Complexity of transaction chains;\n"
        "- Cash or cash-equivalent handling;\n"
        "- High transaction values or volumes."
    )

    risk_factors_channel: str = (
        "Delivery channel risk factors include:\n"
        "- Non-face-to-face or fully digital onboarding;\n"
        "- Use of intermediaries, agents or third parties;\n"
        "- Online or mobile-only service delivery;\n"
        "- Automated or AI-driven service delivery without human review."
    )

    risk_factors_geography: str = (
        "Geographic risk factors include:\n"
        "- Countries on FATF grey or black lists;\n"
        "- Countries subject to Australian sanctions (DFAT consolidated list);\n"
        "- High-risk jurisdictions identified by AUSTRAC;\n"
        "- Countries with weak AML/CTF regulatory frameworks;\n\n"
        "The Organisation will not transact with persons or entities in countries "
        "subject to Australian or UN sanctions without prior compliance approval."
    )

    risk_factors_proliferation: str = (
        "Proliferation financing (PF) risk factors include:\n"
        "- Customers or counterparties linked to weapons of mass destruction programs;\n"
        "- Transactions involving sanctioned countries (e.g. North Korea, Iran);\n"
        "- Customers subject to UN Security Council targeted financial sanctions;\n"
        "- Unusual interest in military or dual-use goods.\n\n"
        "The Organisation screens all customers against the UN Consolidated Sanctions "
        "List, DFAT Australia Sanctions List and OFAC SDN list prior to onboarding "
        "and on an ongoing basis."
    )

    # ── Section 3: Customer Due Diligence ─────────────────────────────────────
    cdd_individuals: str = (
        "For individual customers, the Organisation must collect and verify:\n\n"
        "IDENTIFICATION:\n"
        "- Full legal name;\n"
        "- Date of birth;\n"
        "- Residential address.\n\n"
        "VERIFICATION — must use at least one of:\n"
        "- Primary photographic document (passport, driver's licence, proof-of-age card);\n"
        "- Primary non-photographic document (birth certificate, citizenship certificate) "
        "PLUS a secondary document (government notice with name and address);\n"
        "- Reliable electronic data matching (government database, credit bureau).\n\n"
        "ADDITIONAL INFORMATION (risk-based):\n"
        "- Occupation and employer;\n"
        "- Source of funds;\n"
        "- Purpose of the business relationship;\n"
        "- Source of wealth (for high-risk customers)."
    )

    cdd_companies: str = (
        "For company customers, the Organisation must collect and verify:\n\n"
        "IDENTIFICATION:\n"
        "- Full company name and ACN/ABN;\n"
        "- Registered address and principal place of business;\n"
        "- Nature of business;\n"
        "- Names of directors and beneficial owners (>= 25% ownership).\n\n"
        "VERIFICATION — must use at least one of:\n"
        "- ASIC company search (within 3 months);\n"
        "- ABR ABN lookup;\n"
        "- Reliable and independent documentation (e.g. Certificate of Incorporation).\n\n"
        "BENEFICIAL OWNERS: Identify all individuals owning or controlling >= 25% "
        "and verify their identity using the individual CDD procedures above."
    )

    cdd_trusts: str = (
        "For trust customers, the Organisation must collect and verify:\n\n"
        "- Full name of the trust;\n"
        "- Type of trust (discretionary, unit, fixed, testamentary);\n"
        "- Full name and verification of the trustee(s);\n"
        "- ABN of the trust (if applicable);\n"
        "- Full name and date of birth of all beneficial owners (beneficiaries with "
        ">= 25% interest, or if none, the settlor and all discretionary beneficiaries);\n\n"
        "VERIFICATION: Obtain a certified copy of the trust deed or a letter from "
        "a qualified accountant or lawyer confirming the trust details."
    )

    cdd_partnerships: str = (
        "For partnership customers:\n\n"
        "- Full name of the partnership;\n"
        "- ABN of the partnership;\n"
        "- Names and verification of all partners.\n\n"
        "VERIFICATION: Partnership agreement or ABN lookup confirming partnership details."
    )

    cdd_government_bodies: str = (
        "Australian government bodies (Commonwealth, State, Territory) and their "
        "agencies are subject to simplified CDD. Verification is by confirming the "
        "entity is listed on an official government website or in official records. "
        "Individual identification of officers is not required unless the risk "
        "assessment indicates otherwise."
    )

    cdd_simplified_procedures: str = (
        "Simplified CDD may apply where the risk of ML/TF is assessed as LOW, including:\n"
        "- Listed public companies (ASX or equivalent foreign exchange);\n"
        "- Australian government bodies;\n"
        "- Regulated financial institutions in FATF member countries;\n"
        "- Superannuation funds regulated by APRA.\n\n"
        "Simplified CDD does not apply where there are any suspicion indicators "
        "regardless of customer type."
    )

    cdd_enhanced_procedures: str = (
        "Enhanced Customer Due Diligence (ECDD) is required for HIGH-RISK customers:\n\n"
        "- Politically Exposed Persons (PEPs) and their close associates;\n"
        "- Customers from high-risk or sanctioned jurisdictions;\n"
        "- Customers with complex or opaque structures;\n"
        "- Customers where standard CDD cannot be completed satisfactorily;\n"
        "- Any customer where the AML/CTF Compliance Officer directs ECDD.\n\n"
        "ECDD measures include:\n"
        "- Senior management approval prior to establishing the relationship;\n"
        "- Enhanced verification of identity and source of funds/wealth;\n"
        "- More frequent and intensive ongoing monitoring;\n"
        "- MLRO/Compliance Officer sign-off on the relationship;\n"
        "- Annual review of the customer relationship."
    )

    # ── Section 4: Ongoing CDD & Transaction Monitoring ──────────────────────
    ongoing_cdd: str = (
        "The Organisation conducts ongoing customer due diligence throughout the "
        "customer relationship, including:\n\n"
        "- Monitoring transactions for consistency with the known customer profile;\n"
        "- Keeping customer identification information up to date;\n"
        "- Re-verifying customer identity when there are material changes;\n"
        "- Reviewing high-risk customer relationships at least annually;\n"
        "- Exiting relationships where CDD cannot be completed or maintained.\n\n"
        "Trigger events for re-verification include:\n"
        "- Change of name, address, or controlling persons;\n"
        "- Unusual or unexplained transaction patterns;\n"
        "- Adverse media or sanctions alerts;\n"
        "- Expiry of identity documents."
    )

    transaction_monitoring: str = (
        "The Organisation operates an automated and manual transaction monitoring "
        "program to detect potentially suspicious activity, including:\n\n"
        "AUTOMATED RULES:\n"
        "- Transactions at or near reporting thresholds (structuring detection);\n"
        "- Unusually high transaction frequency or velocity;\n"
        "- Transactions to/from high-risk countries;\n"
        "- Transactions inconsistent with the customer's known business profile;\n"
        "- Rapid movement of funds (in and out within 24-48 hours).\n\n"
        "MANUAL REVIEW: Alerts generated by automated rules are reviewed by a "
        "compliance analyst and escalated to the AML/CTF Compliance Officer where "
        "required. The Compliance Officer determines whether an SMR is warranted."
    )

    # ── Section 5: Beneficial Ownership ───────────────────────────────────────
    beneficial_ownership_procedures: str = (
        "The Organisation identifies and verifies the beneficial owners of all "
        "non-individual customers (companies, trusts, partnerships).\n\n"
        "DEFINITION: A beneficial owner is any individual who:\n"
        "- Directly or indirectly owns >= 25% of the customer; or\n"
        "- Exercises effective control over the customer.\n\n"
        "PROCEDURE:\n"
        "1. Identify all persons meeting the beneficial ownership definition;\n"
        "2. Verify identity using individual CDD procedures;\n"
        "3. Obtain a beneficial ownership declaration from the customer;\n"
        "4. Update records when ownership changes are notified or detected;\n"
        "5. Where the beneficial owner cannot be determined, treat the senior "
        "managing official as the beneficial owner and document the reasons.\n\n"
        "Records of beneficial ownership are retained for 7 years."
    )

    # ── Section 6: PEP Procedures ─────────────────────────────────────────────
    pep_procedures: str = (
        "IDENTIFICATION: At onboarding and on an ongoing basis, the Organisation "
        "screens all customers and beneficial owners against PEP databases.\n\n"
        "PEP CATEGORIES:\n"
        "- Domestic PEPs: holders of prominent public positions in Australian government;\n"
        "- Foreign PEPs: equivalent positions in foreign governments;\n"
        "- International organisation PEPs;\n"
        "- Family members and close associates of all PEP categories.\n\n"
        "PEP RISK ASSESSMENT: All PEPs are treated as HIGH RISK. ECDD applies.\n\n"
        "ECDD FOR PEPs:\n"
        "- Senior management approval required before onboarding;\n"
        "- Enhanced verification of identity and source of wealth;\n"
        "- Ongoing monitoring at increased frequency;\n"
        "- Annual review of the PEP relationship;\n"
        "- AML/CTF Compliance Officer must approve all PEP relationships.\n\n"
        "FORMER PEPs: Individuals who have ceased to hold a PEP position within "
        "the past 12 months continue to be treated as PEPs."
    )

    # ── Section 7: Sanctions ──────────────────────────────────────────────────
    sanctions_procedures: str = (
        "The Organisation complies with Australia's targeted financial sanctions "
        "obligations under the Autonomous Sanctions Act 2011 and UN Security Council "
        "resolutions.\n\n"
        "SCREENING: All customers and beneficial owners are screened against:\n"
        "- DFAT Australia Consolidated Sanctions List;\n"
        "- UN Consolidated Sanctions List;\n"
        "- OFAC SDN List (US sanctions, for USD transactions);\n"
        "- EU Consolidated Sanctions List (where applicable).\n\n"
        "SCREENING TIMING:\n"
        "- Prior to onboarding (before providing any designated service);\n"
        "- Ongoing screening when lists are updated (at minimum weekly);\n"
        "- On any transaction above AUD $1,000 for new/unverified relationships.\n\n"
        "SANCTIONS MATCH PROCEDURE:\n"
        "1. Freeze assets immediately and do not proceed with the transaction;\n"
        "2. Notify the AML/CTF Compliance Officer immediately;\n"
        "3. Report to DFAT within 10 business days via the sanctions portal;\n"
        "4. Do NOT tip off the customer;\n"
        "5. Document all actions taken."
    )

    # ── Section 8: Travel Rule ────────────────────────────────────────────────
    # Default: not applicable (overridden by remittance/VASP templates)
    travel_rule_procedures: str = (
        "The Travel Rule does not apply to this Organisation's designated services. "
        "This section will be updated if the Organisation commences providing "
        "remittance or virtual asset transfer services."
    )

    # ── Section 9: Reporting Obligations ──────────────────────────────────────
    smr_procedures: str = (
        "OBLIGATION: The Organisation must report a Suspicious Matter to AUSTRAC's "
        "CEO as soon as practicable (and no later than 3 business days) after forming "
        "a suspicion that a transaction or customer involves ML/TF/PF.\n\n"
        "SUSPICION INDICATORS include:\n"
        "- Transactions inconsistent with the customer's known profile;\n"
        "- Structuring to avoid reporting thresholds;\n"
        "- Unusual urgency or secrecy about transactions;\n"
        "- Providing false or inconsistent information;\n"
        "- Transactions linked to high-risk jurisdictions without clear purpose;\n"
        "- Any behaviour suggesting awareness of AML/CTF obligations.\n\n"
        "PROCEDURE:\n"
        "1. Employee identifies suspicious matter and reports to Compliance Officer;\n"
        "2. Compliance Officer reviews and determines if suspicion is formed;\n"
        "3. If suspicion confirmed, SMR lodged via AUSTRAC Online;\n"
        "4. Do NOT tip off the customer;\n"
        "5. Document the suspicion, review, and decision regardless of outcome.\n\n"
        "TIPPING OFF: It is a criminal offence to disclose to any person that an "
        "SMR has been or may be submitted."
    )

    ttr_procedures: str = (
        "Threshold Transaction Reports (TTR) apply to physical currency transactions "
        "of AUD $10,000 or more (or equivalent in foreign currency).\n\n"
        "OBLIGATION: Lodge a TTR with AUSTRAC within 15 business days of the "
        "threshold transaction occurring.\n\n"
        "INFORMATION REQUIRED:\n"
        "- Full customer identification details;\n"
        "- Transaction date, amount, and currency;\n"
        "- Transaction type (cash deposit, withdrawal, exchange);\n"
        "- Location where the transaction occurred.\n\n"
        "STRUCTURING: Monitor for transactions structured to avoid the $10,000 "
        "threshold. Multiple related transactions that together exceed $10,000 "
        "may constitute a reportable threshold transaction and/or an SMR."
    )

    # IFTI: default off (overridden by Tranche 1 templates)
    ifti_procedures: str = (
        "International Funds Transfer Instruction (IFTI) reporting does not apply "
        "to this Organisation's designated services under the current regulatory framework.\n\n"
        "Note: If the Organisation commences providing cross-border transfer services "
        "in the future, IFTI reporting obligations will apply and this section must "
        "be updated accordingly."
    )

    annual_compliance_report: str = (
        "OBLIGATION: The Organisation must submit an AML/CTF Compliance Report to "
        "AUSTRAC within 3 months of the end of each reporting period (financial year "
        "ending 30 June).\n\n"
        "The report must cover:\n"
        "- Compliance with AML/CTF obligations during the period;\n"
        "- Changes to ML/TF/PF risk profile;\n"
        "- Review and update of this Program;\n"
        "- Training delivered to staff;\n"
        "- Results of independent review (if conducted);\n"
        "- Any material non-compliance and remediation steps taken.\n\n"
        "The AML/CTF Compliance Officer is responsible for preparing and submitting "
        "the Annual Compliance Report via AUSTRAC Online."
    )

    # ── Section 10: Employee Due Diligence ────────────────────────────────────
    employee_due_diligence: str = (
        "The Organisation applies appropriate due diligence to employees, contractors "
        "and agents who have AML/CTF responsibilities, including:\n\n"
        "PRE-ENGAGEMENT:\n"
        "- Identity verification and right-to-work checks;\n"
        "- Criminal history check (police check);\n"
        "- Reference checks from previous employers;\n"
        "- Review of AML/CTF training history where available.\n\n"
        "ONGOING:\n"
        "- Annual review of AML/CTF responsibilities and authority;\n"
        "- Monitoring for conflicts of interest;\n"
        "- Reporting obligations for staff suspicions (internal SAR process);\n"
        "- Disciplinary procedures for non-compliance with this Program."
    )

    # ── Section 11: Training ──────────────────────────────────────────────────
    training_program_summary: str = (
        "All employees, contractors and agents with AML/CTF responsibilities must "
        "receive appropriate AML/CTF training.\n\n"
        "TRAINING REQUIREMENTS:\n"
        "- Induction training prior to commencing AML/CTF responsibilities;\n"
        "- Annual refresher training (minimum);\n"
        "- Role-specific training for the AML/CTF Compliance Officer;\n"
        "- Ad hoc training when regulatory changes occur (e.g. 2026 reforms).\n\n"
        "TRAINING CONTENT includes:\n"
        "- Overview of AML/CTF Act obligations;\n"
        "- The Organisation's AML/CTF Program and procedures;\n"
        "- How to identify and report suspicious matters;\n"
        "- Record keeping obligations;\n"
        "- Penalties for non-compliance.\n\n"
        "Records of all training (date, content, attendees, assessment results) "
        "are retained for 7 years. See Training Records module for detail."
    )

    # ── Section 12: Record Keeping ────────────────────────────────────────────
    record_keeping: str = (
        "The Organisation retains all AML/CTF records for a minimum of 7 years, "
        "or 10 years where required by AUSTRAC or other applicable law.\n\n"
        "RECORDS TO BE RETAINED:\n"
        "- This Program and all prior versions;\n"
        "- Customer identification and verification records;\n"
        "- Beneficial ownership records;\n"
        "- Transaction records (all designated service transactions);\n"
        "- SMR submissions (existence and date only — content is protected);\n"
        "- TTR submissions;\n"
        "- IFTI submissions (where applicable);\n"
        "- Annual Compliance Reports;\n"
        "- Independent review reports;\n"
        "- Staff training records;\n"
        "- AUSTRAC correspondence and feedback.\n\n"
        "Records must be stored securely and made available to AUSTRAC upon request. "
        "Electronic records are acceptable provided they are readily accessible "
        "and can be reproduced in hard copy."
    )

    # ── Section 13: Independent Review ───────────────────────────────────────
    independent_review: str = (
        "The Organisation must conduct an independent evaluation of this Program "
        "at prescribed intervals.\n\n"
        "FREQUENCY:\n"
        "- At least every 3 years; or\n"
        "- Within 12 months of a material change to the business, customer base, "
        "or regulatory obligations; or\n"
        "- As directed by AUSTRAC.\n\n"
        "INDEPENDENCE: The review must be conducted by a person who is independent "
        "of the AML/CTF function being reviewed. This may be:\n"
        "- An internal audit function with appropriate independence;\n"
        "- An external AML/CTF consultant or law firm;\n"
        "- A qualified independent reviewer approved by senior management.\n\n"
        "SCOPE: The review assesses whether this Program is effective in identifying, "
        "mitigating and managing ML/TF/PF risks.\n\n"
        "REPORTING: Results must be reported to senior management (Board or equivalent) "
        "and findings must be actioned and documented."
    )

    # ── Section 14: AUSTRAC Registration ─────────────────────────────────────
    austrac_enrolment_date: str = ""
    austrac_registration_date: str = ""
    austrac_registration_expiry: str = ""
    designated_business_group: str = ""


# ── Default policies seeded per industry ─────────────────────────────────────

BASE_POLICIES = [
    {"title": "AML/CTF Risk Assessment Policy", "policy_type": "risk_assessment"},
    {"title": "Customer Due Diligence Policy", "policy_type": "kyc"},
    {
        "title": "Ongoing CDD & Monitoring Policy",
        "policy_type": "transaction_monitoring",
    },
    {"title": "Suspicious Matter Reporting Policy", "policy_type": "reporting"},
    {"title": "Record Keeping Policy", "policy_type": "record_keeping"},
    {"title": "Staff Training Policy", "policy_type": "staff_training"},
    {"title": "Sanctions Screening Policy", "policy_type": "sanctions"},
    {"title": "PEP Policy", "policy_type": "pep"},
    {"title": "Independent Review Policy", "policy_type": "independent_review"},
]

BASE_CONTROLS = [
    {
        "control_ref": "CTL-001",
        "title": "Customer Identity Verification",
        "control_type": "preventive",
        "risk_area": "customer_identity",
    },
    {
        "control_ref": "CTL-002",
        "title": "Sanctions Screening at Onboarding",
        "control_type": "preventive",
        "risk_area": "sanctions",
    },
    {
        "control_ref": "CTL-003",
        "title": "PEP Screening at Onboarding",
        "control_type": "preventive",
        "risk_area": "pep",
    },
    {
        "control_ref": "CTL-004",
        "title": "Ongoing Transaction Monitoring",
        "control_type": "detective",
        "risk_area": "transaction_monitoring",
    },
    {
        "control_ref": "CTL-005",
        "title": "SMR Review and Submission Process",
        "control_type": "detective",
        "risk_area": "reporting",
    },
    {
        "control_ref": "CTL-006",
        "title": "Annual Staff AML/CTF Training",
        "control_type": "preventive",
        "risk_area": "staff_training",
    },
    {
        "control_ref": "CTL-007",
        "title": "Customer Risk Rating Assignment",
        "control_type": "preventive",
        "risk_area": "customer_risk",
    },
    {
        "control_ref": "CTL-008",
        "title": "Record Retention and Security",
        "control_type": "preventive",
        "risk_area": "record_keeping",
    },
    {
        "control_ref": "CTL-009",
        "title": "Independent Program Review",
        "control_type": "detective",
        "risk_area": "governance",
    },
]
