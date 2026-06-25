"""
FATF-Based AML Questionnaire Seed Service.

Seeds industry-specific, categorised pre-approval questionnaires aligned with:
  - FATF Recommendations 10, 12, 13, 14, 15, 16, 22, 23
  - AUSTRAC AML/CTF Rules Part 4 (CDD/EDD)
  - AUSTRAC guidance: remittance, crypto, PSP, professional services

Questionnaires are:
  - Industry-specific (Remittance, Crypto/VASP, PSP, Legal, Real Estate, General)
  - Categorised (customer_risk, transaction_risk, geographic_risk, crypto_risk, source_of_funds)
  - Version-controlled via template_ref
  - Editable/deactivatable by the org without developer involvement

DISCLAIMER: Questionnaire templates are compliance workflow prompts.
All compliance decisions remain with the reporting entity.
"""

from __future__ import annotations

import logging

from sqlalchemy.orm import Session

from app.models.risk_matrix import OrgApprovalQuestion, QuestionAnswer, QuestionCategory

log = logging.getLogger("tvg.questionnaire_seed")


# ── Template definitions ──────────────────────────────────────────────────────

FATF_GENERAL_QUESTIONS = [
    # Customer Risk
    {
        "category": QuestionCategory.customer_risk,
        "question_text": "Is the customer a Politically Exposed Person (PEP) or family member/close associate of a PEP?",
        "help_text": "PEPs require Enhanced Due Diligence under AML/CTF Rules 4.2. If yes, MLRO review is required.",
        "compliant_answer": QuestionAnswer.no,
        "risk_weight": 2.0,
        "template_ref": "fatf_general_v1",
        "applicable_industries": [],
    },
    {
        "category": QuestionCategory.customer_risk,
        "question_text": "Does the customer have a complex ownership or control structure (trusts, nominees, foreign entities)?",
        "help_text": "Complex structures may conceal beneficial ownership. Identify all UBOs holding ≥25% interest.",
        "compliant_answer": QuestionAnswer.no,
        "risk_weight": 1.5,
        "template_ref": "fatf_general_v1",
        "applicable_industries": [],
    },
    {
        "category": QuestionCategory.customer_risk,
        "question_text": "Is the customer's identity and Source of Funds verified on file?",
        "help_text": "CDD must be completed before or during the establishment of the business relationship.",
        "compliant_answer": QuestionAnswer.yes,
        "risk_weight": 1.5,
        "template_ref": "fatf_general_v1",
        "applicable_industries": [],
    },
    # Transaction Risk
    {
        "category": QuestionCategory.transaction_risk,
        "question_text": "Is this transaction consistent with the customer's known business profile and expected activity?",
        "help_text": "Deviation from expected activity is a red flag requiring investigation.",
        "compliant_answer": QuestionAnswer.yes,
        "risk_weight": 2.0,
        "template_ref": "fatf_general_v1",
        "applicable_industries": [],
    },
    {
        "category": QuestionCategory.transaction_risk,
        "question_text": "Does this transaction exceed the customer's previously documented expected transaction activity?",
        "help_text": "Transactions above the documented expected level require explanation and documentation.",
        "compliant_answer": QuestionAnswer.no,
        "risk_weight": 1.5,
        "template_ref": "fatf_general_v1",
        "applicable_industries": [],
    },
    {
        "category": QuestionCategory.transaction_risk,
        "question_text": "Does this transaction involve a third-party payor or payee not previously identified?",
        "help_text": "Third-party involvement requires identification of the third party and the reason for their involvement.",
        "compliant_answer": QuestionAnswer.no,
        "risk_weight": 1.5,
        "template_ref": "fatf_general_v1",
        "applicable_industries": [],
    },
    # Geographic Risk
    {
        "category": QuestionCategory.geographic_risk,
        "question_text": "Does this transaction involve a FATF grey list or black list jurisdiction?",
        "help_text": "FATF grey list: countries under increased monitoring. Black list: non-cooperative jurisdictions. Enhanced scrutiny required.",
        "compliant_answer": QuestionAnswer.no,
        "risk_weight": 2.0,
        "template_ref": "fatf_general_v1",
        "applicable_industries": [],
    },
    {
        "category": QuestionCategory.geographic_risk,
        "question_text": "Does this transaction involve a country subject to UN or OFAC sanctions?",
        "help_text": "Sanctioned jurisdictions: transactions may be prohibited. Immediate compliance review required.",
        "compliant_answer": QuestionAnswer.no,
        "risk_weight": 3.0,
        "template_ref": "fatf_general_v1",
        "applicable_industries": [],
    },
]

REMITTANCE_QUESTIONS = [
    {
        "category": QuestionCategory.customer_risk,
        "question_text": "Has the beneficiary of this remittance been identified and verified?",
        "help_text": "FATF R.16 (travel rule) requires ordering and beneficiary information for cross-border transfers.",
        "compliant_answer": QuestionAnswer.yes,
        "risk_weight": 2.0,
        "template_ref": "remittance_v1",
        "applicable_industries": ["remittance", "money_service_business"],
    },
    {
        "category": QuestionCategory.transaction_risk,
        "question_text": "Is this remittance cash-funded?",
        "help_text": "Cash-funded remittances are higher risk. Source of Cash must be documented.",
        "compliant_answer": QuestionAnswer.no,
        "risk_weight": 2.0,
        "template_ref": "remittance_v1",
        "applicable_industries": ["remittance", "money_service_business"],
    },
    {
        "category": QuestionCategory.geographic_risk,
        "question_text": "Is the beneficiary country subject to enhanced due diligence requirements?",
        "help_text": "Check AUSTRAC guidance and FATF lists for the destination country.",
        "compliant_answer": QuestionAnswer.no,
        "risk_weight": 1.5,
        "template_ref": "remittance_v1",
        "applicable_industries": ["remittance", "money_service_business"],
    },
    {
        "category": QuestionCategory.transaction_risk,
        "question_text": "Has the transaction velocity for this customer been reviewed against their documented profile?",
        "help_text": "Multiple remittances in a short period may indicate structuring.",
        "compliant_answer": QuestionAnswer.yes,
        "risk_weight": 1.5,
        "template_ref": "remittance_v1",
        "applicable_industries": ["remittance", "money_service_business"],
    },
    {
        "category": QuestionCategory.source_of_funds,
        "question_text": "Has the Source of Funds been documented for this remittance?",
        "help_text": "For remittances ≥ AUD 10,000, SOF documentation is recommended best practice.",
        "compliant_answer": QuestionAnswer.yes,
        "risk_weight": 1.5,
        "template_ref": "remittance_v1",
        "applicable_industries": ["remittance", "money_service_business"],
    },
]

CRYPTO_QUESTIONS = [
    {
        "category": QuestionCategory.crypto_risk,
        "question_text": "Is the customer's wallet a self-hosted (unhosted) wallet?",
        "help_text": "Self-hosted wallets present higher ML/TF risk. Apply enhanced monitoring per FATF VA Guidance 2021.",
        "compliant_answer": QuestionAnswer.no,
        "risk_weight": 2.0,
        "template_ref": "crypto_v1",
        "applicable_industries": [
            "cryptocurrency",
            "digital_currency_exchange",
            "vasp",
        ],
    },
    {
        "category": QuestionCategory.crypto_risk,
        "question_text": "Has the wallet been screened for mixer/tumbler exposure?",
        "help_text": "Mixer exposure indicates potential attempt to obscure transaction trail.",
        "compliant_answer": QuestionAnswer.yes,
        "risk_weight": 2.5,
        "template_ref": "crypto_v1",
        "applicable_industries": [
            "cryptocurrency",
            "digital_currency_exchange",
            "vasp",
        ],
    },
    {
        "category": QuestionCategory.crypto_risk,
        "question_text": "Does the wallet screening show any sanctioned entity exposure?",
        "help_text": "Any sanctioned wallet exposure requires immediate SMR consideration and MLRO escalation.",
        "compliant_answer": QuestionAnswer.no,
        "risk_weight": 3.0,
        "template_ref": "crypto_v1",
        "applicable_industries": [
            "cryptocurrency",
            "digital_currency_exchange",
            "vasp",
        ],
    },
    {
        "category": QuestionCategory.crypto_risk,
        "question_text": "Does the wallet screening show darknet market exposure?",
        "help_text": "Darknet exposure is a high-risk indicator requiring immediate escalation.",
        "compliant_answer": QuestionAnswer.no,
        "risk_weight": 3.0,
        "template_ref": "crypto_v1",
        "applicable_industries": [
            "cryptocurrency",
            "digital_currency_exchange",
            "vasp",
        ],
    },
    {
        "category": QuestionCategory.transaction_risk,
        "question_text": "Is the transaction consistent with the customer's declared crypto activity purpose?",
        "help_text": "Assess whether transaction type and volume match onboarding disclosures.",
        "compliant_answer": QuestionAnswer.yes,
        "risk_weight": 1.5,
        "template_ref": "crypto_v1",
        "applicable_industries": [
            "cryptocurrency",
            "digital_currency_exchange",
            "vasp",
        ],
    },
]

LEGAL_TRUST_QUESTIONS = [
    {
        "category": QuestionCategory.source_of_funds,
        "question_text": "Is the source of the trust account funds verified and documented?",
        "help_text": "Lawyers must identify the source of funds held in trust per FATF R.22 and AML/CTF Rules.",
        "compliant_answer": QuestionAnswer.yes,
        "risk_weight": 2.5,
        "template_ref": "legal_trust_v1",
        "applicable_industries": ["legal", "conveyancing", "law_firm"],
    },
    {
        "category": QuestionCategory.customer_risk,
        "question_text": "Have all beneficial owners of the transaction been identified?",
        "help_text": "For property and corporate transactions, all beneficial owners must be identified.",
        "compliant_answer": QuestionAnswer.yes,
        "risk_weight": 2.0,
        "template_ref": "legal_trust_v1",
        "applicable_industries": ["legal", "conveyancing", "law_firm"],
    },
    {
        "category": QuestionCategory.transaction_risk,
        "question_text": "Is a third party funding this transaction on behalf of the client?",
        "help_text": "Third-party funding of legal matters is a significant red flag requiring investigation.",
        "compliant_answer": QuestionAnswer.no,
        "risk_weight": 2.0,
        "template_ref": "legal_trust_v1",
        "applicable_industries": ["legal", "conveyancing", "law_firm"],
    },
    {
        "category": QuestionCategory.transaction_risk,
        "question_text": "Does the transaction involve unusual or complex payment arrangements?",
        "help_text": "Unusual payment structures (multiple sources, delayed payments, overseas funding) require explanation.",
        "compliant_answer": QuestionAnswer.no,
        "risk_weight": 1.5,
        "template_ref": "legal_trust_v1",
        "applicable_industries": ["legal", "conveyancing", "law_firm"],
    },
]

REAL_ESTATE_QUESTIONS = [
    {
        "category": QuestionCategory.source_of_funds,
        "question_text": "Has the Source of Funds for this property transaction been documented?",
        "help_text": "For high-value property transactions, detailed SOF documentation is required.",
        "compliant_answer": QuestionAnswer.yes,
        "risk_weight": 2.5,
        "template_ref": "real_estate_v1",
        "applicable_industries": ["real_estate", "property"],
    },
    {
        "category": QuestionCategory.source_of_funds,
        "question_text": "Has the Source of Wealth been verified for purchasers of high-value property (≥ AUD 1M)?",
        "help_text": "Source of Wealth is required for high-value property acquisitions.",
        "compliant_answer": QuestionAnswer.yes,
        "risk_weight": 2.0,
        "template_ref": "real_estate_v1",
        "applicable_industries": ["real_estate", "property"],
    },
    {
        "category": QuestionCategory.customer_risk,
        "question_text": "Is the purchaser a foreign person or entity subject to FIRB approval requirements?",
        "help_text": "Foreign purchasers present additional regulatory and ML/TF risk.",
        "compliant_answer": QuestionAnswer.no,
        "risk_weight": 1.5,
        "template_ref": "real_estate_v1",
        "applicable_industries": ["real_estate", "property"],
    },
    {
        "category": QuestionCategory.transaction_risk,
        "question_text": "Does this transaction involve any cash component or bearer instruments?",
        "help_text": "Cash components in real estate are extremely high-risk and require immediate escalation.",
        "compliant_answer": QuestionAnswer.no,
        "risk_weight": 3.0,
        "template_ref": "real_estate_v1",
        "applicable_industries": ["real_estate", "property"],
    },
    {
        "category": QuestionCategory.customer_risk,
        "question_text": "Have all beneficial owners of the purchasing entity been identified and verified?",
        "help_text": "Corporate purchasers require UBO identification to ≥25% threshold.",
        "compliant_answer": QuestionAnswer.yes,
        "risk_weight": 2.0,
        "template_ref": "real_estate_v1",
        "applicable_industries": ["real_estate", "property"],
    },
]

PSP_QUESTIONS = [
    {
        "category": QuestionCategory.transaction_risk,
        "question_text": "Is the merchant's transaction volume consistent with their onboarded business profile?",
        "help_text": "Merchant volume anomalies may indicate fraud, structuring, or undisclosed business activity.",
        "compliant_answer": QuestionAnswer.yes,
        "risk_weight": 2.0,
        "template_ref": "psp_v1",
        "applicable_industries": [
            "payment_service_provider",
            "psp",
            "merchant_services",
        ],
    },
    {
        "category": QuestionCategory.geographic_risk,
        "question_text": "Does the cross-border settlement involve a high-risk or sanctioned jurisdiction?",
        "help_text": "PSP cross-border flows require jurisdiction risk assessment.",
        "compliant_answer": QuestionAnswer.no,
        "risk_weight": 2.0,
        "template_ref": "psp_v1",
        "applicable_industries": [
            "payment_service_provider",
            "psp",
            "merchant_services",
        ],
    },
    {
        "category": QuestionCategory.transaction_risk,
        "question_text": "Has the merchant's KYB (Know Your Business) due diligence been refreshed within the last 12 months?",
        "help_text": "Merchant onboarding information must be kept current, especially for high-volume merchants.",
        "compliant_answer": QuestionAnswer.yes,
        "risk_weight": 1.5,
        "template_ref": "psp_v1",
        "applicable_industries": [
            "payment_service_provider",
            "psp",
            "merchant_services",
        ],
    },
]


ALL_TEMPLATES = {
    "fatf_general_v1": FATF_GENERAL_QUESTIONS,
    "remittance_v1": REMITTANCE_QUESTIONS,
    "crypto_v1": CRYPTO_QUESTIONS,
    "legal_trust_v1": LEGAL_TRUST_QUESTIONS,
    "real_estate_v1": REAL_ESTATE_QUESTIONS,
    "psp_v1": PSP_QUESTIONS,
}

INDUSTRY_TEMPLATE_MAP = {
    "remittance": ["fatf_general_v1", "remittance_v1"],
    "money_service_business": ["fatf_general_v1", "remittance_v1"],
    "cryptocurrency": ["fatf_general_v1", "crypto_v1"],
    "digital_currency_exchange": ["fatf_general_v1", "crypto_v1"],
    "vasp": ["fatf_general_v1", "crypto_v1"],
    "payment_service_provider": ["fatf_general_v1", "psp_v1"],
    "psp": ["fatf_general_v1", "psp_v1"],
    "legal": ["fatf_general_v1", "legal_trust_v1"],
    "conveyancing": ["fatf_general_v1", "legal_trust_v1"],
    "law_firm": ["fatf_general_v1", "legal_trust_v1"],
    "real_estate": ["fatf_general_v1", "real_estate_v1"],
    "property": ["fatf_general_v1", "real_estate_v1"],
}


def seed_questionnaire_for_org(
    db: Session,
    org_id: str,
    industry: str,
    created_by: str,
    template_keys: list[str] = None,
    skip_if_exists: bool = True,
) -> dict:
    """
    Seed FATF-aligned questionnaire questions for an organisation.

    Args:
        db: Database session
        org_id: Organisation ID
        industry: Industry type string (maps to INDUSTRY_TEMPLATE_MAP)
        created_by: User ID seeding the questions
        template_keys: Override template selection
        skip_if_exists: Skip if system questions already exist for this org

    Returns:
        {"seeded": int, "skipped": int, "templates_applied": list}
    """
    if skip_if_exists:
        existing = (
            db.query(OrgApprovalQuestion)
            .filter_by(org_id=org_id, is_system=True)
            .first()
        )
        if existing:
            log.info(
                "questionnaire.skip_seed org=%s already_has_system_questions", org_id
            )
            return {"seeded": 0, "skipped": 1, "templates_applied": []}

    industry_lower = industry.lower()
    templates_to_apply = template_keys or INDUSTRY_TEMPLATE_MAP.get(
        industry_lower, ["fatf_general_v1"]
    )

    seeded = 0
    order = 1
    applied = []

    for tpl_key in templates_to_apply:
        questions = ALL_TEMPLATES.get(tpl_key, [])
        for q_def in questions:
            # Skip if this exact template_ref + org_id + question_text already exists
            exists = (
                db.query(OrgApprovalQuestion)
                .filter_by(
                    org_id=org_id,
                    template_ref=q_def["template_ref"],
                    question_text=q_def["question_text"],
                )
                .first()
            )
            if exists:
                continue

            q = OrgApprovalQuestion(
                org_id=org_id,
                question_text=q_def["question_text"],
                help_text=q_def.get("help_text"),
                category=q_def["category"],
                risk_weight=q_def.get("risk_weight", 1.0),
                compliant_answer=q_def["compliant_answer"],
                applicable_industries=q_def.get("applicable_industries", []),
                template_ref=q_def["template_ref"],
                is_system=True,
                industry_context=industry,
                question_order=order,
                is_required=True,
                is_active=True,
                created_by=created_by,
            )
            db.add(q)
            seeded += 1
            order += 1

        if questions:
            applied.append(tpl_key)

    db.commit()
    log.info(
        "questionnaire.seeded org=%s industry=%s seeded=%d templates=%s",
        org_id,
        industry,
        seeded,
        applied,
    )
    return {"seeded": seeded, "skipped": 0, "templates_applied": applied}


def get_available_templates() -> dict:
    """Return all available questionnaire templates and their question counts."""
    return {
        tpl_key: {
            "question_count": len(questions),
            "categories": list({q["category"].value for q in questions}),
            "applicable_industries": list(
                {ind for q in questions for ind in q.get("applicable_industries", [])}
            ),
        }
        for tpl_key, questions in ALL_TEMPLATES.items()
    }
