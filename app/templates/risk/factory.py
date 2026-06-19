"""
Risk Assessment Framework seeding.

Called on Organisation signup (alongside seed_aml_solution) to pre-populate
a RiskFramework with industry-specific RiskCategories and RiskFactors.

Usage:
    from app.templates.risk.factory import seed_risk_framework

    seed_risk_framework(db=db, org=organisation, solution_id=solution.id, created_by=user.id)
"""

from __future__ import annotations

import importlib
import logging

from sqlalchemy.orm import Session

from app.models.organisation import Organisation
from app.models.risk_engine import (
    RiskCategory,
    RiskFactor,
    RiskFramework,
    RiskLibraryFactor,
)
from app.templates.risk.base import RiskLibrary

log = logging.getLogger("verigo.templates.risk")

INDUSTRY_MODULE_MAP = {
    # ── Tranche 1 ─────────────────────────────────────────────────────────────
    "remittance": "remittance",
    "vasp": "vasp",
    "bullion_dealers": "other",
    # ── Tranche 2 ─────────────────────────────────────────────────────────────
    "accountants": "accounting",
    "conveyancers": "real_estate",
    "legal_professionals": "legal",
    "real_estate": "real_estate",
    "precious_metals": "other",
    "pubs_clubs": "other",
    # ── Custom-package industries (not primary target) ─────────────────────────
    "banking": "banking",
    "bookmakers_betting": "other",
    "casinos": "other",
    "financial_services": "fintech",
    "superannuation": "other",
    "other": "other",
}

GOVERNANCE_DISCLAIMER = (
    "This risk assessment framework is a configurable tool only. "
    "Risk ratings, scoring, assumptions, and conclusions are the sole responsibility "
    "of the reporting entity and its MLRO/compliance officer. "
    "Verigo does not determine final risk ratings, provide legal or compliance advice, "
    "or accept liability for risk outcomes. Users must independently verify the "
    "appropriateness of all ratings, controls, and mitigation measures."
)


def _load_library(industry: str) -> RiskLibrary:
    key = industry.value if hasattr(industry, "value") else str(industry)
    module_name = INDUSTRY_MODULE_MAP.get(key, "other")
    mod = importlib.import_module(f"app.templates.risk.industries.{module_name}")
    return mod.get_library()


def seed_risk_framework(
    db: Session,
    org: Organisation,
    solution_id: str,
    created_by: str,
) -> RiskFramework:
    """
    Create and persist RiskFramework + RiskCategories + RiskFactors for an org.
    Also seeds RiskLibraryFactor records if not already present for the industry.
    Returns the created RiskFramework (not yet committed).
    """
    library = _load_library(org.industry_type)

    log.info(
        "Seeding RiskFramework for org=%s industry=%s",
        org.id,
        org.industry_type,
    )

    # ── 1. RiskFramework ─────────────────────────────────────────────────────
    framework = RiskFramework(
        org_id=org.id,
        solution_id=solution_id,
        name=f"ML/TF Risk Assessment Framework — {org.name}",
        industry=org.industry_type.value
        if hasattr(org.industry_type, "value")
        else str(org.industry_type),
        category_weights=library.category_weights,
        governance_disclaimer=GOVERNANCE_DISCLAIMER,
        created_by=created_by,
    )
    db.add(framework)
    db.flush()

    # ── 2. RiskCategories ────────────────────────────────────────────────────
    category_map: dict[str, RiskCategory] = {}
    category_labels = {
        "customer": "Customer Risk",
        "product": "Product & Service Risk",
        "service": "Service Delivery Risk",
        "geographic": "Geographic Risk",
        "channel": "Channel Risk",
        "transaction": "Transaction Risk",
        "regulatory": "Regulatory & Compliance Risk",
    }
    for cat_type, weight in library.category_weights.items():
        cat = RiskCategory(
            framework_id=framework.id,
            org_id=org.id,
            category_type=cat_type,
            name=category_labels.get(cat_type, cat_type.title()),
            description=f"Risk factors related to {cat_type} exposure.",
            weight=weight,
            is_active=True,
        )
        db.add(cat)
        db.flush()
        category_map[cat_type] = cat

    # ── 3. RiskLibraryFactor seeds (idempotent) ───────────────────────────────
    existing_refs = {
        r[0]
        for r in db.query(RiskLibraryFactor.factor_ref)
        .filter(RiskLibraryFactor.industry == library.industry)
        .all()
    }

    for lf in library.factors:
        if lf.ref not in existing_refs:
            db.add(
                RiskLibraryFactor(
                    industry=library.industry,
                    category_type=lf.category_type,
                    factor_ref=lf.ref,
                    factor_name=lf.name,
                    description=lf.description,
                    suggested_likelihood=lf.suggested_likelihood,
                    suggested_consequence=lf.suggested_consequence,
                    rationale=lf.rationale,
                    mitigation_examples=lf.mitigation_examples,
                )
            )

    # ── 4. RiskFactors (org-specific, editable copies) ───────────────────────
    for lf in library.factors:
        cat = category_map.get(lf.category_type)
        if not cat:
            continue
        db.add(
            RiskFactor(
                category_id=cat.id,
                org_id=org.id,
                factor_ref=lf.ref,
                name=lf.name,
                description=lf.description,
                suggested_likelihood=lf.suggested_likelihood,
                suggested_consequence=lf.suggested_consequence,
                rationale=lf.rationale,
                mitigation_examples=lf.mitigation_examples,
                is_active=True,
                created_by=created_by,
            )
        )

    log.info(
        "RiskFramework seeded: framework_id=%s categories=%d factors=%d",
        framework.id,
        len(category_map),
        len(library.factors),
    )

    return framework
