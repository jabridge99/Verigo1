"""
Phase I — onboarding: generate a baseline organisation-level risk assessment
from the chosen industry and risk profile. This is distinct from the AML/CTF
program (a control checklist) and from per-customer KYC risk scoring — it's
a short statement of inherent risk factors used to justify the program.
"""

from datetime import datetime, timezone
from typing import Optional

from sqlalchemy.orm import Session

from app.models.organisation import Organisation, RiskProfile
from app.services.aml_program_service import _industry_category

# Inherent risk factors common to every reporting entity.
BASE_FACTORS: list[dict] = [
    {
        "factor": "customer_risk",
        "label": "Customer Risk",
        "description": "Risk arising from the customer base (PEPs, foreign customers, beneficial ownership complexity).",
    },
    {
        "factor": "product_risk",
        "label": "Product & Service Risk",
        "description": "Risk arising from the products/services offered (cash-intensive, anonymity, cross-border).",
    },
    {
        "factor": "channel_risk",
        "label": "Delivery Channel Risk",
        "description": "Risk arising from non-face-to-face onboarding and digital delivery channels.",
    },
    {
        "factor": "jurisdiction_risk",
        "label": "Jurisdiction Risk",
        "description": "Risk arising from customers, counterparties, or transactions linked to higher-risk jurisdictions.",
    },
]

# Extra inherent risk factors layered on by industry category.
INDUSTRY_FACTORS: dict[str, list[dict]] = {
    "banking": [{"factor": "ifti_risk", "label": "Cross-Border Transfer Risk", "description": "Exposure from IFTI/correspondent banking flows."}],
    "fintech": [{"factor": "velocity_risk", "label": "Transaction Velocity Risk", "description": "High-volume, automated, digital-first transaction flows."}],
    "cryptocurrency": [{"factor": "vasp_risk", "label": "Virtual Asset Risk", "description": "Pseudo-anonymity and cross-border virtual asset transfers."}],
    "remittance": [{"factor": "corridor_risk", "label": "Remittance Corridor Risk", "description": "Exposure from specific high-risk remittance corridors."}],
    "real_estate": [{"factor": "settlement_risk", "label": "Settlement Risk", "description": "Large, one-off transactions with complex source-of-funds."}],
}

_RATING_BY_PROFILE = {
    RiskProfile.low: "low",
    RiskProfile.standard: "medium",
    RiskProfile.high: "high",
}


def build_risk_factors(industry_id: str, risk_profile: RiskProfile) -> list[dict]:
    factors = list(BASE_FACTORS) + INDUSTRY_FACTORS.get(_industry_category(industry_id), [])
    rating = _RATING_BY_PROFILE.get(risk_profile, "medium")
    return [{**f, "rating": rating} for f in factors]


def generate_risk_assessment(db: Session, org: Organisation) -> dict:
    """Generate (or regenerate) a baseline risk assessment for an
    organisation from its industry_id and risk_profile. Idempotent —
    re-running replaces the stored assessment."""
    if not org.industry_id:
        raise ValueError("Organisation has no industry selected")
    if not org.risk_profile:
        raise ValueError("Organisation has no risk profile selected")

    assessment = {
        "industry_id": org.industry_id,
        "risk_profile": org.risk_profile.value,
        "overall_rating": _RATING_BY_PROFILE.get(org.risk_profile, "medium"),
        "factors": build_risk_factors(org.industry_id, org.risk_profile),
    }
    org.risk_assessment = assessment
    org.risk_assessment_generated_at = datetime.now(timezone.utc)
    db.commit()
    db.refresh(org)
    return assessment


def get_risk_assessment(org: Organisation) -> Optional[dict]:
    return org.risk_assessment
