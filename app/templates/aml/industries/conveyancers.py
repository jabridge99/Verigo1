"""
Conveyancers AML template — Tranche 2 (AML/CTF Amendment Act 2024, commencing
1 July 2026 anticipated).

Previously conveyancers shared the real_estate.py template (see PARKING_LOT.md
P19) — a real estate agent's front-line sales/listing exposure is a materially
different ML vehicle to a conveyancer's statutory trust account and PEXA/Sympli
e-conveyancing settlement platform. AUSTRAC's own STR data for this sector is
dominated by trust-account typologies, not sales-side ones:
  #1 — third-party settlement funds (trust account receipt from an unidentified
       payer not named in the contract)
  #2 — trust account manipulation (overpayment followed by a refund request)
  #3 — last-minute settlement account changes

Content reflects: FATF DNFBP Guidance 2023, AUSTRAC's Conveyancing Financial
Crime Guide typology rankings, ARNECC Model Participation Rules (PEXA/Sympli),
and the State/Territory conveyancer trust-account licensing regimes
(Conveyancers Licensing Act 2003 (NSW), Conveyancers Act 2006 (VIC),
Property Occupations Act 2014 (QLD), Settlement Agents Act 1981 (WA),
Land Agents Act 1994 (SA)) that run in parallel with AML/CTF obligations.
"""

import copy

from app.templates.aml.base import BASE_CONTROLS, BASE_POLICIES, AMLTemplateBase


def get_template(risk_level: str = "medium") -> AMLTemplateBase:
    t = AMLTemplateBase(industry="conveyancers", risk_level=risk_level)
    t.has_ifti_obligation = False
    t.has_ttr_obligation = True
    t.has_travel_rule = False
    t.is_tranche_2 = True

    t.scope = (
        "This Program applies to all conveyancing services provided by the "
        "Organisation that constitute designated services under the AML/CTF Act "
        "2006 as amended by the 2024 Amendment Act (Tranche 2, commencing "
        "1 July 2026).\n\n"
        "In-scope activities include:\n"
        "- Acting for a purchaser or vendor in a residential or commercial "
        "property settlement;\n"
        "- Holding and disbursing client funds through the Organisation's "
        "statutory trust account;\n"
        "- Preparing and lodging electronic settlement instructions via PEXA "
        "or Sympli;\n"
        "- Acting on off-the-plan contracts, contract assignments, and "
        "subdivision/development settlements.\n\n"
        "This Program operates alongside — and does not replace — the "
        "Organisation's trust account obligations under its State/Territory "
        "conveyancing licensing legislation."
    )

    t.designated_services = (
        "The Organisation provides conveyancing designated services that "
        "involve:\n"
        "- Acting as a licensed conveyancer in the sale or purchase of real "
        "property;\n"
        "- Receiving and disbursing settlement funds through the trust "
        "account;\n"
        "- Coordinating settlement via electronic conveyancing platforms "
        "(PEXA/Sympli) under ARNECC Model Participation Rules;\n"
        "- Preparing transfer documentation for subdivision and development "
        "settlements.\n\n"
        "As a Tranche 2 reporting entity, the Organisation does not have IFTI "
        "reporting obligations unless it separately provides remittance or "
        "international transfer services. Threshold Transaction Reporting "
        "(TTR) applies where physical currency of AUD $10,000 or more is "
        "received in connection with a settlement (see TTR procedures below)."
    )

    t.risk_factors_customer = (
        "Conveyancing-specific customer risk factors "
        "(Risk Matrix categories CR/CUST):\n"
        "- Purchaser or vendor unable or unwilling to explain the source of "
        "settlement funds (highest-rated inherent risk in the sector — "
        "CRITICAL);\n"
        "- Foreign purchaser with funds from a FATF grey- or black-list "
        "jurisdiction;\n"
        "- Politically Exposed Person as purchaser, vendor, or beneficial "
        "owner of a purchasing entity;\n"
        "- Company or trust purchaser with a complex or opaque beneficial "
        "ownership structure (3+ entity layers);\n"
        "- Nominee purchaser or bare trust arrangement where the underlying "
        "principal is undisclosed;\n"
        "- Self-managed superannuation fund (SMSF) purchaser, including "
        "limited recourse borrowing arrangements (LRBA) — a common ML "
        "vehicle in Australian conveyancing per AUSTRAC/ATO joint guidance."
    )

    t.risk_factors_product = (
        "Conveyancing-specific product/service risk factors:\n"
        "- Third-party settlement funds — funds paid into the trust account "
        "by a person not named in the contract (AUSTRAC STR Rank #1);\n"
        "- Trust account overpayment followed by a request to refund the "
        "excess to a different account (AUSTRAC STR Rank #2, trust account "
        "layering typology);\n"
        "- Multi-tranche trust account receipts — a single settlement funded "
        "in three or more separate payments;\n"
        "- Off-the-plan contract assignment before settlement at a "
        "significant price variation;\n"
        "- Subdivision or development settlement involving multiple lot "
        "purchasers, particularly where common beneficial ownership is "
        "present across lots;\n"
        "- High-value settlement (single matter above AUD $2,000,000)."
    )

    t.risk_factors_channel = (
        "Delivery channel risks specific to conveyancing:\n"
        "- Remote or fully digital client onboarding without face-to-face "
        "identity verification;\n"
        "- Electronic conveyancing platform (PEXA/Sympli) account compromise "
        "or workspace manipulation;\n"
        "- Settlement account details communicated only by email, with no "
        "out-of-band verification (a leading vector for both money "
        "laundering and conveyancing payment-diversion fraud/scams);\n"
        "- Use of intermediaries (mortgage brokers, buyer's agents) who are "
        "not themselves subject to AML/CTF obligations."
    )

    t.risk_factors_geography = (
        "Geographic risk factors specific to conveyancing:\n"
        "- Settlement funds originating from a FATF grey-list or black-list "
        "jurisdiction — certified banking documentation from the originating "
        "jurisdiction required, Director approval mandatory;\n"
        "- Foreign purchaser where FIRB (Foreign Investment Review Board) "
        "approval status cannot be confirmed — potential nominee-purchaser "
        "arrangement used to circumvent FIRB requirements, with a possible "
        "ATO referral;\n"
        "- Overseas wire transfer used to fund settlement without adequate "
        "supporting documentation.\n\n"
        "The Organisation will not settle a transaction involving funds from "
        "a country subject to Australian or UN sanctions without prior "
        "Director/Compliance Officer approval."
    )

    t.risk_factors_proliferation = (
        "Proliferation financing (PF) risk in conveyancing is generally low "
        "for standard residential settlements, and elevated for commercial "
        "property settlements involving foreign state-owned entities or "
        "purchasers connected to jurisdictions subject to UN Security "
        "Council PF-related sanctions (DPRK, Iran).\n\n"
        "The Organisation screens all purchasers, vendors, and beneficial "
        "owners against the DFAT Consolidated Sanctions List and UN "
        "Security Council sanctions lists (live access only, never cached) "
        "before settlement proceeds, and periodically throughout the "
        "business relationship."
    )

    t.cdd_individuals = (
        "For individual purchaser and vendor clients, verify:\n"
        "- Full legal name, date of birth, residential address;\n"
        "- Source of settlement funds — required for all purchaser clients, "
        "documented via bank statements (minimum 3 months);\n"
        "- Source of wealth — required for HIGH-risk customers and all "
        "foreign PEPs.\n\n"
        "VERIFICATION: Primary photographic ID (passport, driver's licence) "
        "or electronic verification (eKYC) meeting AUSTRAC guidance. "
        "Non-standard verification (non-photographic ID + secondary "
        "document) requires Compliance Officer approval.\n\n"
        "FOREIGN CUSTOMERS: Foreign ID not in English requires a certified "
        "English translation by a NAATI-accredited translator. FATF grey/"
        "black-list jurisdiction customers require ECDD and Compliance "
        "Officer approval."
    )

    t.cdd_companies = (
        "For company purchaser/vendor customers:\n\n"
        "- Full company name, ACN, registered office and principal place of "
        "business, director names, beneficial owners (>= 25% threshold);\n"
        "- Domestic companies: ASIC company search verification. Foreign "
        "companies: search of the relevant foreign regulator/exchange, plus "
        "CO approval and certified documentation for high-risk "
        "jurisdictions.\n\n"
        "SELF-MANAGED SUPERANNUATION FUNDS (SMSFs) — sector-specific "
        "requirement: CDD required on ALL trustees (individual and "
        "corporate) and ALL members. Obtain and verify the SMSF deed and "
        "ATO ABN registration. Where a Limited Recourse Borrowing "
        "Arrangement (LRBA) is involved, identify and document the bare "
        "trustee and the lender."
    )

    t.cdd_trusts = (
        "For trust purchaser/vendor customers:\n\n"
        "- Full name and type of trust, country of establishment, settlor "
        "(unless contribution < AUD $10,000, settlor deceased, or "
        "simplified procedure applies);\n"
        "- Full CDD on each individual or corporate trustee;\n"
        "- Full name and address of each beneficiary, or description of "
        "each class of beneficiary.\n\n"
        "VERIFICATION: Certified extract of the trust deed combined with "
        "individual/company CDD for each trustee.\n\n"
        "NOMINEE / BARE TRUST PURCHASES: Both the nominee and the "
        "underlying principal must be identified and subject to CDD. "
        "Written authority from the principal must be obtained and filed. "
        "Director approval is required where the rationale for the nominee "
        "arrangement is unclear."
    )

    t.cdd_partnerships = (
        "For partnership customers: full name and ABN of the partnership, "
        "full CDD on at least one partner, and full name and residential "
        "address of each partner. Verification: partnership agreement or "
        "certified extract, combined with individual CDD for at least one "
        "partner."
    )

    t.cdd_government_bodies = (
        "Australian government bodies (Commonwealth, State, Territory) and "
        "their agencies are subject to simplified verification — confirming "
        "the body's existence and government status from reliable "
        "independent documentation. Individual identification of officers "
        "is not required unless the risk assessment indicates otherwise."
    )

    t.cdd_simplified_procedures = (
        "Simplified verification may apply, subject to Compliance Officer "
        "approval documented on file, where the purchaser/vendor is:\n"
        "- A domestic listed public company (ASX search or public register);\n"
        "- A majority-owned subsidiary of a domestic listed company;\n"
        "- A managed investment scheme registered by ASIC, or a wholesale "
        "MIS meeting the applicable Corporations Act conditions;\n"
        "- A Commonwealth statutory regulator or government "
        "superannuation fund.\n\n"
        "Simplified procedures never apply where any suspicion indicator is "
        "present, regardless of customer type."
    )

    t.cdd_enhanced_procedures = (
        "ECDD is mandatory where:\n"
        "- The customer's risk rating is assessed as HIGH under the EWRA;\n"
        "- The customer is a foreign PEP, or close associate/family member "
        "of one — Board/Director approval required before proceeding;\n"
        "- The customer or funds originate from a FATF grey/black-list "
        "jurisdiction;\n"
        "- Beneficial ownership is complex, opaque, or cannot be fully "
        "identified;\n"
        "- Settlement funds are received from an unidentified or "
        "undisclosed third party (sector's #1-ranked STR typology);\n"
        "- An overpayment-then-refund request is made from the trust "
        "account;\n"
        "- Settlement account details change within 48 hours of settlement "
        "without independent (out-of-band) verification;\n"
        "- FIRB approval is required for a foreign purchaser but has not "
        "been confirmed.\n\n"
        "ECDD measures: enhanced source of funds/wealth documentation, "
        "independent re-verification, enhanced beneficial ownership "
        "tracing to the ultimate natural person, and senior "
        "management (Compliance Officer + Director) approval before the "
        "designated service proceeds. Every ECDD case must record a "
        "documented SMR consideration, whether or not an SMR is ultimately "
        "lodged."
    )

    t.ongoing_cdd = (
        "The Organisation conducts risk-based ongoing due diligence "
        "throughout each engagement, escalating immediately on any of the "
        "following trigger events:\n"
        "- The customer's name, address, or identification details change;\n"
        "- Beneficial ownership structure changes;\n"
        "- A transaction or series of transactions reaches or exceeds "
        "AUD $10,000 in physical currency;\n"
        "- Transaction volume increases by 100% or more within a 5-calendar-"
        "day period;\n"
        "- Additional funds are received from a party not identified in the "
        "transaction;\n"
        "- A request is made to refund an overpayment from the trust "
        "account;\n"
        "- Settlement account details change after instructions are "
        "accepted.\n\n"
        "Enhanced OCDD review frequency after an ECDD approval: quarterly "
        "minimum for HIGH-risk customers; monthly for the first 12 months "
        "for foreign PEPs (quarterly thereafter); per-settlement-event plus "
        "quarterly for subdivision purchasers approved post-ECDD."
    )

    t.transaction_monitoring = (
        "The trust account is the Organisation's primary ML risk vehicle and "
        "therefore the primary transaction monitoring focus. Every trust "
        "account receipt and disbursement is reconciled daily against the "
        "matter file, in addition to the general monitoring rules below.\n\n"
        "GENERAL RULES: physical currency >= AUD $10,000 (TTR trigger); "
        "transaction value increase >= 100% within 5 days; sanctions/PEP "
        "matches; structuring indicators (multiple near-threshold receipts); "
        "baseline deviation from the customer's known profile; rapid fund "
        "movement within 24-48 hours with no apparent legitimate purpose.\n\n"
        "SECTOR-SPECIFIC RULES (thresholds calibrated to the Organisation's "
        "Risk Matrix):\n"
        "- Trust account receipt from an unidentified or undisclosed third "
        "party — manual review per receipt, Compliance Officer sign-off "
        "before funds are released;\n"
        "- Trust account overpayment (receipt exceeds the settlement "
        "amount) — automatic balance-check flag, Compliance Officer + "
        "Director approval before any refund;\n"
        "- Settlement account change within 48 hours of settlement — "
        "mandatory out-of-band (telephone) verification to an "
        "independently sourced number before acceptance, Compliance "
        "Officer + Director approval;\n"
        "- High-value settlement (>= AUD $2,000,000) — automatic value "
        "flag, Compliance Officer + Director notification;\n"
        "- Multi-tranche trust account receipts (3+ separate payments for "
        "one matter) — manual review, assess for structuring/layering;\n"
        "- Subdivision settlement with common beneficial ownership across "
        "2+ lots — manual beneficial-ownership review per project;\n"
        "- FIRB approval not confirmed for a foreign purchaser — manual "
        "checklist per matter, settlement does not proceed until resolved.\n\n"
        "All alerts must be assessed and documented by the Compliance "
        "Officer, including a mandatory SMR consideration for every "
        "unresolved alert, whether or not an SMR is ultimately lodged."
    )

    t.beneficial_ownership_procedures = (
        "The Organisation identifies and verifies beneficial owners (>= 25% "
        "ownership or control threshold) for all non-individual purchaser "
        "and vendor customers before settlement.\n\n"
        "PROCEDURE: request the customer's ownership/control structure; "
        "trace intermediate entities to natural persons at the 25%+ "
        "threshold; document a beneficial ownership chart for structures "
        "with 3 or more entity layers; verify each identified beneficial "
        "owner using individual CDD procedures.\n\n"
        "Where the beneficial owner cannot be identified after these steps, "
        "identify the senior managing official and escalate to the "
        "Compliance Officer, who determines whether to proceed and whether "
        "an SMR is warranted. Disclosure certificates may be used with CO "
        "approval where other verification sources are not reasonably "
        "available.\n\n"
        "Director approval is required for structures with 3 or more entity "
        "layers, and for all subdivision/development projects exceeding "
        "10 lots or AUD $5,000,000 in total value."
    )

    t.pep_procedures = (
        "PEP screening is conducted at onboarding via commercial database, "
        "internet/media search, and government-issued PEP lists, plus a "
        "mandatory customer self-declaration.\n\n"
        "FOREIGN PEPs: ECDD is mandatory regardless of other risk factors. "
        "Board/Director approval required before establishing or continuing "
        "the engagement. Source of wealth and source of funds must be "
        "independently established. Enhanced OCDD applies throughout the "
        "transaction lifecycle.\n\n"
        "DOMESTIC PEPs / close associates: risk-based — Compliance Officer "
        "assesses whether high ML/TF risk applies; if so, the same measures "
        "as for foreign PEPs apply.\n\n"
        "PEPs as purchaser, vendor, or beneficial owner of a purchasing "
        "entity are rated HIGH inherent risk on the Organisation's Risk "
        "Matrix and require Compliance Officer + Director sign-off before "
        "settlement."
    )

    t.sanctions_procedures = (
        "The Organisation screens every customer, beneficial owner, "
        "director/trustee, agent, counterparty, and third-party trust "
        "account payer against the DFAT Consolidated Sanctions List, UN "
        "Security Council Consolidated List, Australian listed terrorist "
        "organisations, and the Criminal Code Regulations 2002 list — "
        "accessed live at the time of screening, never from a cached copy.\n\n"
        "SCREENING TRIGGERS: customer onboarding; before each significant "
        "transaction; at each OCDD review; before accepting any trust "
        "account receipt from a third party; before settlement proceeds; "
        "and whenever DFAT or UN lists are updated (reviewed at least "
        "monthly by the Compliance Officer).\n\n"
        "CONFIRMED MATCH: immediately cease all dealings; do not tip off "
        "the matched party; notify the Compliance Officer within 15 "
        "minutes and the Director immediately; place trust account funds "
        "on hold — do not disburse; notify the AFP within 24 hours (131 AFP "
        "/ 131 237); lodge an SMR with AUSTRAC within 24 hours; seek legal "
        "advice on asset-freezing obligations under the Charter of the "
        "United Nations Act 1945.\n\n"
        "PROLIFERATION FINANCING: additionally screen against UN Security "
        "Council PF-related resolutions (DPRK, Iran) for commercial "
        "settlements involving foreign state-owned entities."
    )

    t.smr_procedures = (
        "The obligation to lodge an SMR arises the moment the Compliance "
        "Officer forms a suspicion under s.41 of the AML/CTF Act — not when "
        "the suspicion is proven or investigated to a conclusion. Every "
        "employee must immediately escalate a suspicion to the Compliance "
        "Officer and must not tip off the customer (s.123 — criminal "
        "offence, up to 2 years imprisonment).\n\n"
        "SECTOR-SPECIFIC SMR TRIGGERS (AUSTRAC's ranked typologies for "
        "conveyancers):\n"
        "1. Trust account receipt from an unidentified third party — "
        "source not established after Compliance Officer review;\n"
        "2. Overpayment followed by a refund request — Compliance Officer "
        "not satisfied with the explanation;\n"
        "3. Settlement account change that cannot be independently "
        "verified within the required timeframe;\n"
        "4. Multiple trust account tranches indicating structuring or "
        "layering;\n"
        "5. FIRB approval not obtained for a foreign purchaser — potential "
        "evasion;\n"
        "6. PEP transaction where source of funds cannot be established;\n"
        "7. Structuring — multiple receipts designed to stay below "
        "AUD $10,000.\n\n"
        "TIMEFRAMES: 24 hours for terrorism financing; 3 business days for "
        "all other matters. The Organisation continues normal dealings "
        "with the customer after lodging an SMR unless AUSTRAC or the AFP "
        "directs otherwise. Every escalated matter — whether or not an SMR "
        "is lodged — is documented in the SMR Decision Log and retained "
        "for 7 years."
    )

    t.ttr_procedures = (
        "Threshold Transaction Reports (TTR) apply where the Organisation "
        "receives physical currency of AUD $10,000 or more (or an "
        "equivalent structured series) in connection with a settlement — "
        "lodged with AUSTRAC within 10 business days.\n\n"
        "The Organisation's ordinary practice is to require all settlement "
        "funds via traceable bank transfer or the PEXA/Sympli electronic "
        "workspace; physical currency receipts are exceptional and must be "
        "escalated to the Compliance Officer immediately, regardless of "
        "amount, given the sector's structuring risk. A TTR obligation is "
        "separate from and in addition to any SMR obligation — the same "
        "transaction may require both."
    )

    t.ifti_procedures = (
        "IFTI reporting does not apply to this Organisation's designated "
        "conveyancing services. The Organisation does not itself transmit "
        "international funds transfer instructions.\n\n"
        "Where a purchaser funds settlement via an overseas wire transfer, "
        "the Organisation requests evidence of the transfer and its source "
        "as part of CDD/ECDD (see risk factor GR-01/GR-02), but the IFTI "
        "reporting obligation sits with the remitting financial institution, "
        "not the Organisation."
    )

    extra_controls = [
        {
            "control_ref": "CTL-010",
            "title": "Trust Account Third-Party Receipt Review",
            "control_type": "detective",
            "risk_area": "trust_accounts",
        },
        {
            "control_ref": "CTL-011",
            "title": "Trust Account Overpayment / Refund Approval",
            "control_type": "preventive",
            "risk_area": "trust_accounts",
        },
        {
            "control_ref": "CTL-012",
            "title": "Settlement Account Change — Out-of-Band Verification",
            "control_type": "preventive",
            "risk_area": "trust_accounts",
        },
        {
            "control_ref": "CTL-013",
            "title": "Beneficial Ownership — Property Purchasers",
            "control_type": "preventive",
            "risk_area": "beneficial_ownership",
        },
        {
            "control_ref": "CTL-014",
            "title": "FIRB Status Verification — Foreign Purchasers",
            "control_type": "preventive",
            "risk_area": "customer_identity",
        },
    ]

    t._policies = copy.deepcopy(BASE_POLICIES) + [
        {
            "title": "Trust Account AML Policy",
            "policy_type": "trust_accounts",
        },
        {
            "title": "Settlement Account Change Verification Policy",
            "policy_type": "trust_accounts",
        },
    ]
    t._controls = copy.deepcopy(BASE_CONTROLS) + extra_controls

    return t
