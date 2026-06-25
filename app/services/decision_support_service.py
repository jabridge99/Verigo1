"""
Decision Support Service — aggregates risk signals into a structured compliance panel.

Uses OrgRiskFactor weights (configurable per org) rather than hardcoded values.
Integrates with regulatory_decision_service for AUSTRAC obligation indicators.

DISCLAIMER: Decision support panels are compliance workflow guidance only.
The system never automatically approves compliance decisions.
All decisions remain with the reporting entity.
"""

from __future__ import annotations

import logging
from typing import Optional

from sqlalchemy.orm import Session

from app.services.regulatory_decision_service import (
    RegulatoryDecisionResult,
    evaluate_transaction,
)

log = logging.getLogger("tvg.decision_support")

DISCLAIMER = (
    "Decision support panels are compliance workflow guidance only. "
    "The system never automatically approves compliance decisions. "
    "All decisions remain with the reporting entity."
)


# ── Risk factor computation using OrgRiskFactor weights ──────────────────────


def compute_weighted_risk_score(
    db: Session,
    org_id: str,
    transaction,
    customer,
    crypto_detail=None,
    behaviour_profile=None,
) -> dict:
    """
    Compute a multi-dimensional risk score using the org's configured OrgRiskFactor weights.
    Falls back to equal-weight defaults if org has no configured factors.

    Returns a breakdown dict with:
      customer_score, geographic_score, product_score, transaction_score,
      behaviour_score, crypto_score, composite_score, level, factor_hits
    """
    from app.models.risk_matrix import OrgMonitoringConfig
    from app.models.risk_matrix_config import OrgRiskFactor

    factors = db.query(OrgRiskFactor).filter_by(org_id=org_id, is_active=True).all()

    config = db.query(OrgMonitoringConfig).filter_by(org_id=org_id).first()
    matrix_weights = {
        "customer": getattr(config, "matrix_customer_weight", 0.30) if config else 0.30,
        "geographic": getattr(config, "matrix_geographic_weight", 0.25)
        if config
        else 0.25,
        "product": getattr(config, "matrix_product_weight", 0.20) if config else 0.20,
        "transaction": getattr(config, "matrix_transaction_weight", 0.25)
        if config
        else 0.25,
    }

    amount_aud = float(
        getattr(transaction, "amount_aud", None)
        or getattr(transaction, "amount", 0)
        or 0
    )
    payment_method = str(getattr(transaction, "payment_method", "") or "")
    transaction_type = str(getattr(transaction, "transaction_type", "") or "")
    source_country = str(getattr(transaction, "source_country", "") or "").upper()
    destination_country = str(
        getattr(transaction, "destination_country", "") or ""
    ).upper()
    is_cross_border = bool(getattr(transaction, "is_cross_border", False))
    is_structuring = bool(getattr(transaction, "is_structuring_suspect", False))
    is_near_threshold = bool(getattr(transaction, "is_near_threshold", False))
    is_round = bool(getattr(transaction, "is_round_number", False))

    from app.services.regulatory_decision_service import (
        FATF_BLACK_LIST,
        FATF_GREY_LIST,
        SANCTIONED_COUNTRIES,
    )

    countries = {c for c in [source_country, destination_country] if c}

    # ── Evaluate each factor ──────────────────────────────────────────────────
    scores_by_category: dict[str, float] = {
        "customer": 0.0,
        "geographic": 0.0,
        "product": 0.0,
        "transaction": 0.0,
        "behaviour": 0.0,
        "crypto": 0.0,
    }
    max_by_category: dict[str, float] = {k: 0.0 for k in scores_by_category}
    factor_hits = []

    for factor in factors:
        cat = (
            factor.category.value
            if hasattr(factor.category, "value")
            else str(factor.category)
        )
        weight = float(factor.weight or 0.10)
        key = factor.factor_key
        hit = False
        score_contribution = weight * 100

        # Customer factors
        if cat == "customer":
            if key == "pep_status" and getattr(customer, "is_pep", False):
                hit = True
            elif key == "high_risk_rating" and str(
                getattr(customer, "risk_level", "")
            ) in ("high", "critical"):
                hit = True
            elif key == "adverse_media" and getattr(
                customer, "is_adverse_media", False
            ):
                hit = True
            elif key == "non_face_to_face" and str(
                getattr(customer, "onboarding_channel", "")
            ) in ("online", "mobile_app", "api"):
                hit = True
            elif key == "new_customer":
                created_at = getattr(customer, "created_at", None)
                if created_at:
                    from datetime import datetime, timezone

                    age_days = (datetime.now(timezone.utc) - created_at).days
                    if age_days < 90:
                        hit = True

        # Geographic factors
        elif cat == "geographic":
            if key == "fatf_blacklist" and any(c in FATF_BLACK_LIST for c in countries):
                hit = True
            elif key == "sanctioned_country" and any(
                c in SANCTIONED_COUNTRIES for c in countries
            ):
                hit = True
            elif key == "fatf_greylist" and any(c in FATF_GREY_LIST for c in countries):
                hit = True
            elif key == "cross_border" and is_cross_border:
                hit = True

        # Product factors
        elif cat == "product":
            if key == "crypto" and (
                "crypto" in payment_method or "crypto" in transaction_type
            ):
                hit = True
            elif key == "remittance" and (
                "remittance" in transaction_type or "transfer" in payment_method
            ):
                hit = True
            elif key == "cash" and (
                "cash" in payment_method
                or getattr(transaction, "is_cash_intensive", False)
            ):
                hit = True
            elif key == "real_estate" and "real_estate" in transaction_type:
                hit = True

        # Transaction factors
        elif cat == "transaction":
            if key == "structuring" and is_structuring:
                hit = True
            elif key == "near_threshold" and is_near_threshold:
                hit = True
            elif key == "high_value" and amount_aud >= 50_000:
                hit = True
            elif key == "round_number" and is_round:
                hit = True

        # Behaviour factors
        elif cat == "behaviour" and behaviour_profile:
            if key == "dormant_reactivation" and getattr(
                behaviour_profile, "dormant_reactivated", False
            ):
                hit = True
            elif key == "velocity_breach":
                total_30d = int(
                    getattr(behaviour_profile, "total_txn_count_30d", 0) or 0
                )
                avg_monthly = float(
                    getattr(behaviour_profile, "avg_txn_per_month", 0) or 0
                )
                if avg_monthly > 0 and total_30d > avg_monthly * 2:
                    hit = True
            elif key == "unusual_channel":
                usual_channels = getattr(behaviour_profile, "usual_channels", []) or []
                txn_channel = getattr(transaction, "delivery_channel", "")
                if usual_channels and txn_channel and txn_channel not in usual_channels:
                    hit = True

        # Crypto factors
        elif cat == "crypto" and crypto_detail:
            if (
                key == "mixer_exposure"
                and (getattr(crypto_detail, "mixer_exposure_pct", 0) or 0) >= 5
            ):
                hit = True
            elif (
                key == "darknet_exposure"
                and (getattr(crypto_detail, "darknet_exposure_pct", 0) or 0) >= 1
            ):
                hit = True
            elif (
                key == "sanctioned_wallet"
                and (getattr(crypto_detail, "sanctioned_exposure_pct", 0) or 0) > 0
            ):
                hit = True

        if hit:
            scores_by_category[cat if cat in scores_by_category else "transaction"] += (
                score_contribution
            )
            factor_hits.append(
                {
                    "factor_key": key,
                    "category": cat,
                    "label": factor.label,
                    "weight": weight,
                    "score_contribution": round(score_contribution, 1),
                }
            )
            max_by_category[cat if cat in scores_by_category else "transaction"] = max(
                max_by_category.get(cat, 0), score_contribution
            )

    # Cap each category at 100
    for cat in scores_by_category:
        scores_by_category[cat] = min(scores_by_category[cat], 100.0)

    # Composite score using matrix weights
    composite = (
        scores_by_category["customer"] * matrix_weights["customer"]
        + scores_by_category["geographic"] * matrix_weights["geographic"]
        + scores_by_category["product"] * matrix_weights["product"]
        + scores_by_category["transaction"] * matrix_weights["transaction"]
    )

    # Behaviour and crypto boost (additive, not part of matrix weights)
    if scores_by_category["behaviour"] > 0:
        composite = min(100, composite + scores_by_category["behaviour"] * 0.15)
    if scores_by_category["crypto"] > 0:
        composite = min(100, composite + scores_by_category["crypto"] * 0.20)

    composite = round(min(composite, 100.0), 1)

    level = (
        "critical"
        if composite >= 80
        else "high"
        if composite >= 60
        else "medium"
        if composite >= 35
        else "low"
    )

    return {
        "composite_score": composite,
        "level": level,
        "customer_score": round(scores_by_category["customer"], 1),
        "geographic_score": round(scores_by_category["geographic"], 1),
        "product_score": round(scores_by_category["product"], 1),
        "transaction_score": round(scores_by_category["transaction"], 1),
        "behaviour_score": round(scores_by_category["behaviour"], 1),
        "crypto_score": round(scores_by_category["crypto"], 1),
        "matrix_weights": matrix_weights,
        "factor_hits": factor_hits,
        "factors_evaluated": len(factors),
    }


# ── Live panel computation ────────────────────────────────────────────────────


def build_live_panel(
    db: Session,
    org_id: str,
    transaction,
    customer,
    org,
    crypto_detail=None,
    behaviour_profile=None,
    alert_score: float = 0.0,
    alert_breakdown: Optional[dict] = None,
) -> dict:
    """
    Build a complete, real-time decision support panel for a transaction.
    Combines weighted risk scoring with AUSTRAC regulatory indicators.

    This is the core "what should the compliance officer consider next?" function.
    """
    # 1. Weighted risk scoring from OrgRiskFactor configuration
    risk_breakdown = compute_weighted_risk_score(
        db=db,
        org_id=org_id,
        transaction=transaction,
        customer=customer,
        crypto_detail=crypto_detail,
        behaviour_profile=behaviour_profile,
    )

    # 2. AUSTRAC regulatory obligation indicators
    reg_result: RegulatoryDecisionResult = evaluate_transaction(
        transaction=transaction,
        customer=customer,
        org=org,
        alert_score=alert_score,
        crypto_detail=crypto_detail,
        behaviour_profile=behaviour_profile,
    )

    # 3. Outstanding tasks check
    from app.models.task import Task, TaskStatus

    outstanding_tasks = (
        db.query(Task)
        .filter(
            Task.org_id == org_id,
            Task.customer_id == str(customer.id),
            Task.status.notin_([TaskStatus.completed, TaskStatus.cancelled]),
        )
        .all()
    )

    # 4. Missing document check
    missing_documents = []
    if not getattr(customer, "source_of_funds", None):
        missing_documents.append("Source of Funds documentation")
    if getattr(customer, "is_pep", False) and not getattr(
        customer, "source_of_wealth", None
    ):
        missing_documents.append("Source of Wealth documentation (required for PEP)")
    if (
        not getattr(customer, "date_of_birth", None)
        and getattr(customer, "customer_type", "") == "individual"
    ):
        missing_documents.append("Date of Birth — required for individual CDD")

    # 5. Approval step
    from app.models.automation_rule import ApprovalStepType

    composite = risk_breakdown["composite_score"]
    if composite >= 80 or reg_result.potential_smr:
        current_step = ApprovalStepType.mlro_review.value
    elif composite >= 60 or reg_result.potential_edd:
        current_step = ApprovalStepType.compliance_review.value
    else:
        current_step = ApprovalStepType.analyst_review.value

    return {
        # Risk scores
        "composite_risk_score": risk_breakdown["composite_score"],
        "risk_level": risk_breakdown["level"],
        "risk_breakdown": {
            "customer": risk_breakdown["customer_score"],
            "geographic": risk_breakdown["geographic_score"],
            "product": risk_breakdown["product_score"],
            "transaction": risk_breakdown["transaction_score"],
            "behaviour": risk_breakdown["behaviour_score"],
            "crypto": risk_breakdown["crypto_score"],
        },
        "matrix_weights": risk_breakdown["matrix_weights"],
        "risk_factors_hit": risk_breakdown["factor_hits"],
        "alert_score": alert_score,
        # Regulatory indicators
        "potential_ifti": reg_result.potential_ifti,
        "potential_ttr": reg_result.potential_ttr,
        "potential_smr": reg_result.potential_smr,
        "potential_edd": reg_result.potential_edd,
        "potential_customer_review": reg_result.potential_customer_review,
        "potential_sof_request": reg_result.potential_sof_request,
        "regulatory_indicators": [
            {
                "type": ind.indicator_type,
                "title": ind.title,
                "rationale": ind.rationale,
                "regulatory_basis": ind.regulatory_basis,
                "priority": ind.priority,
                "auto_prefill_type": ind.auto_prefill_type,
            }
            for ind in reg_result.indicators
        ],
        "industry_guidance": reg_result.industry_guidance,
        "compliance_actions": reg_result.compliance_actions,
        "risk_summary": reg_result.risk_summary,
        # Workflow
        "required_step": current_step,
        "outstanding_tasks": [
            {
                "id": t.id,
                "task_ref": t.task_ref,
                "title": t.title,
                "status": t.status.value,
                "due_date": str(t.due_date) if t.due_date else None,
            }
            for t in outstanding_tasks
        ],
        "missing_documents": missing_documents,
        "disclaimer": DISCLAIMER,
    }
