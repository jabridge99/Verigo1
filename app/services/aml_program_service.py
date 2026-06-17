"""
Phase C — auto-generate an AML/CTF program for a newly onboarded
organisation, from its chosen industry and risk profile.
"""

import uuid
from typing import Optional

from sqlalchemy.orm import Session

from app.models.aml_program import AMLProgram, AMLProgramItem, AMLProgramStatus
from app.models.organisation import Organisation, RiskProfile

# Baseline control set every organisation needs, regardless of industry.
BASE_PROGRAM: list[dict] = [
    {
        "category": "governance",
        "title": "Appoint an AML/CTF Compliance Officer (MLRO)",
        "description": "Designate a senior individual accountable for the AML/CTF program.",
        "review_frequency": "annual",
    },
    {
        "category": "governance",
        "title": "Board-approved AML/CTF Policy",
        "description": "Document and approve the organisation's AML/CTF policy and risk appetite.",
        "review_frequency": "annual",
    },
    {
        "category": "kyc",
        "title": "Customer Identification & Verification Procedure",
        "description": "Verify identity documents and screen customers at onboarding.",
        "review_frequency": "annual",
    },
    {
        "category": "kyc",
        "title": "Sanctions & PEP Screening",
        "description": "Screen all customers against sanctions and PEP watchlists.",
        "review_frequency": "monthly",
    },
    {
        "category": "monitoring",
        "title": "Ongoing Transaction Monitoring",
        "description": "Monitor transactions for suspicious activity against defined rules.",
        "review_frequency": "monthly",
    },
    {
        "category": "reporting",
        "title": "Suspicious Matter Reporting (SMR/SAR) Procedure",
        "description": "Process for identifying, escalating, and lodging suspicious matter reports.",
        "review_frequency": "annual",
    },
    {
        "category": "training",
        "title": "Staff AML/CTF Training Program",
        "description": "Train all staff on AML/CTF obligations and red flags.",
        "review_frequency": "annual",
    },
    {
        "category": "governance",
        "title": "Independent Program Review",
        "description": "Periodic independent review of the AML/CTF program's effectiveness.",
        "review_frequency": "annual",
    },
]

# Additional, industry-specific obligations layered on top of the baseline.
INDUSTRY_PROGRAM: dict[str, list[dict]] = {
    "banking": [
        {
            "category": "reporting",
            "title": "Threshold Transaction Reports (TTR)",
            "description": "Lodge reports for cash transactions at or above the regulatory threshold.",
            "review_frequency": "monthly",
        },
        {
            "category": "monitoring",
            "title": "International Funds Transfer Instruction (IFTI) Reporting",
            "description": "Report cross-border electronic funds transfers as required.",
            "review_frequency": "monthly",
        },
    ],
    "fintech": [
        {
            "category": "monitoring",
            "title": "Velocity & Structuring Detection Rules",
            "description": "Detect rapid, high-volume, or structured payment patterns typical of digital-first products.",
            "review_frequency": "quarterly",
        },
    ],
    "cryptocurrency": [
        {
            "category": "kyc",
            "title": "Travel Rule / Originator-Beneficiary Information",
            "description": "Collect and transmit originator/beneficiary information on virtual asset transfers.",
            "review_frequency": "monthly",
        },
        {
            "category": "monitoring",
            "title": "Blockchain Analytics & Wallet Screening",
            "description": "Screen wallet addresses against known illicit-activity clusters.",
            "review_frequency": "monthly",
        },
    ],
    "insurance": [
        {
            "category": "kyc",
            "title": "Beneficial Owner Identification for Policy Payouts",
            "description": "Verify beneficial owners before large claim or surrender payouts.",
            "review_frequency": "annual",
        },
    ],
    "real_estate": [
        {
            "category": "kyc",
            "title": "Source of Funds Verification for Property Transactions",
            "description": "Verify the source of funds for deposits and settlements.",
            "review_frequency": "annual",
        },
    ],
    "remittance": [
        {
            "category": "monitoring",
            "title": "Cross-Border Remittance Monitoring",
            "description": "Monitor outbound and inbound remittances against typologies and corridor risk.",
            "review_frequency": "monthly",
        },
    ],
    "foreign_exchange": [
        {
            "category": "monitoring",
            "title": "Currency Exchange Transaction Monitoring",
            "description": "Monitor high-value and structured currency exchange transactions.",
            "review_frequency": "monthly",
        },
    ],
    "payment_service": [
        {
            "category": "monitoring",
            "title": "Payment Service Transaction Monitoring",
            "description": "Monitor payment flows for layering and structuring across merchant accounts.",
            "review_frequency": "quarterly",
        },
    ],
    "legal_accounting": [
        {
            "category": "kyc",
            "title": "Client Due Diligence for Designated Services",
            "description": "Apply CDD to designated legal/accounting services such as trust and company formation.",
            "review_frequency": "annual",
        },
    ],
    "precious_metals": [
        {
            "category": "kyc",
            "title": "High-Value Dealer Customer Verification",
            "description": "Verify identity and source of funds for high-value bullion/precious metals transactions.",
            "review_frequency": "annual",
        },
    ],
    "reporting_group": [
        {
            "category": "governance",
            "title": "Reporting Group Coordination Procedure",
            "description": "Coordinate AML/CTF compliance obligations across reporting group members.",
            "review_frequency": "annual",
        },
    ],
    "mortgage_broker": [
        {
            "category": "kyc",
            "title": "Source of Funds Verification for Mortgage Applications",
            "description": "Verify the source of funds and deposit for mortgage broking clients.",
            "review_frequency": "annual",
        },
    ],
}

# Map real-world industry slugs (web/lib/industries.ts ids, and other
# free-form values) to a template category key above.
_INDUSTRY_SLUG_MAP: dict[str, str] = {
    "digital-currency-exchange": "cryptocurrency",
    "remittance-provider": "remittance",
    "foreign-exchange": "foreign_exchange",
    "payment-service-provider": "payment_service",
    "real-estate": "real_estate",
    "conveyancer": "legal_accounting",
    "law-firm": "legal_accounting",
    "accounting-firm": "legal_accounting",
    "precious-metals": "precious_metals",
    "reporting-group": "reporting_group",
    "mortgage-broker": "mortgage_broker",
}

# Risk-profile adjustments: extra obligations and tighter review cadence.
RISK_PROFILE_PROGRAM: dict[RiskProfile, list[dict]] = {
    RiskProfile.high: [
        {
            "category": "kyc",
            "title": "Enhanced Due Diligence (EDD) for All High-Risk Customers",
            "description": "Apply EDD — additional identity checks, source-of-wealth review, and senior sign-off.",
            "review_frequency": "quarterly",
        },
        {
            "category": "monitoring",
            "title": "Tightened Transaction Monitoring Thresholds",
            "description": "Lower alert thresholds and increase manual review sampling.",
            "review_frequency": "monthly",
        },
    ],
    RiskProfile.standard: [],
    RiskProfile.low: [],
}

# Review frequency to bump high-risk organisations to (caps cadence at this rate).
_FREQ_RANK = {"monthly": 0, "quarterly": 1, "annual": 2}


def _industry_category(industry_id: str) -> str:
    """Map a free-form industry_id (e.g. 'banking-au-001', or a real slug
    like 'remittance-provider') to a template key."""
    key = (industry_id or "").lower()
    if key in _INDUSTRY_SLUG_MAP:
        return _INDUSTRY_SLUG_MAP[key]
    for category in INDUSTRY_PROGRAM:
        if key.startswith(category) or category in key:
            return category
    return "other"


def _new_program_id() -> str:
    return f"AMLP-{uuid.uuid4().hex[:10].upper()}"


def _tighten_frequency(freq: Optional[str], risk_profile: RiskProfile) -> Optional[str]:
    if risk_profile != RiskProfile.high or not freq:
        return freq
    if _FREQ_RANK.get(freq, 2) > _FREQ_RANK["quarterly"]:
        return "quarterly"
    return freq


def build_program_items(industry_id: str, risk_profile: RiskProfile) -> list[dict]:
    items = list(BASE_PROGRAM) + INDUSTRY_PROGRAM.get(_industry_category(industry_id), [])
    items += RISK_PROFILE_PROGRAM.get(risk_profile, [])
    return [
        {**item, "review_frequency": _tighten_frequency(item.get("review_frequency"), risk_profile)}
        for item in items
    ]


def generate_program(db: Session, org: Organisation) -> AMLProgram:
    """Generate (or regenerate) an organisation's AML/CTF program from its
    chosen industry_id and risk_profile. Idempotent — re-running replaces
    the item set and bumps the version."""
    if not org.industry_id:
        raise ValueError("Organisation has no industry selected")
    if not org.risk_profile:
        raise ValueError("Organisation has no risk profile selected")

    program = (
        db.query(AMLProgram).filter(AMLProgram.organisation_id == org.id).first()
    )
    if program:
        db.query(AMLProgramItem).filter(AMLProgramItem.program_id == program.id).delete()
        program.industry_id = org.industry_id
        program.risk_profile = org.risk_profile.value
        program.status = AMLProgramStatus.active
        program.version = (program.version or 1) + 1
    else:
        program = AMLProgram(
            program_id=_new_program_id(),
            organisation_id=org.id,
            industry_id=org.industry_id,
            risk_profile=org.risk_profile.value,
            status=AMLProgramStatus.active,
            version=1,
        )
        db.add(program)
    db.flush()

    for i, item in enumerate(build_program_items(org.industry_id, org.risk_profile)):
        db.add(
            AMLProgramItem(
                program_id=program.id,
                category=item["category"],
                title=item["title"],
                description=item.get("description"),
                review_frequency=item.get("review_frequency"),
                is_required=item.get("is_required", True),
                sort_order=i,
            )
        )
    db.commit()
    db.refresh(program)
    return program


def get_program(db: Session, org: Organisation) -> Optional[AMLProgram]:
    return db.query(AMLProgram).filter(AMLProgram.organisation_id == org.id).first()


def get_program_items(db: Session, program: AMLProgram) -> list[AMLProgramItem]:
    return (
        db.query(AMLProgramItem)
        .filter(AMLProgramItem.program_id == program.id)
        .order_by(AMLProgramItem.sort_order)
        .all()
    )
