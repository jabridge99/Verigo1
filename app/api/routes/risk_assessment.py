"""
Risk Assessment Engine API — EWRA (Enterprise-Wide Risk Assessment) for AML/CTF.

Each org has one RiskFramework (seeded at onboarding, fully customisable).
Assessments run against the framework: users score each RiskFactor (L × C × CE),
engine calculates inherent/residual scores, compares to previous runs.

Lifecycle:
  Framework config → Create run → Score factors → Finalise → Approve

Scoring formula:
  inherent_risk   = likelihood × consequence        (1–25)
  CEF             = {1:0.20, 2:0.40, 3:0.60, 4:0.80, 5:1.00}
  residual_risk   = inherent_risk × CEF
  category_score  = Σ(factor_residual × factor_weight) / Σweight
  overall_score   = Σ(category_score × category_weight)

Governance disclaimer is displayed on every response and acknowledged on approval.
"""
import logging
from datetime import date, datetime, timezone
from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session

from app.api.deps import (
    Pagination, get_current_user, org_id_for,
    require_analyst_or_above, require_compliance_or_above, require_mlro_or_above,
)
from app.db.database import get_db
from app.models.audit_log import AuditEventType, AuditLog
from app.models.risk_engine import (
    AssessmentStatus, MitigationStatus, RiskAssessmentRun, RiskCategory,
    RiskCategoryType, RiskControl, RiskFactor, RiskFramework,
    RiskMitigation, RiskRating, RiskScoreHistory, RiskFactorScore,
)
from app.models.user import User
from app.services.risk_engine import (
    control_effectiveness_factor, inherent_risk, residual_risk, risk_rating,
)

log = logging.getLogger("verigo.api.risk_assessment")
router = APIRouter(prefix="/risk", tags=["Risk Assessment"])

DISCLAIMER = (
    "This risk assessment framework is a configurable tool only. Risk ratings, scoring, "
    "assumptions, and conclusions remain the sole responsibility of the reporting entity. "
    "The platform does not determine final risk ratings, provide legal or compliance advice, "
    "or accept liability for risk outcomes."
)


# ── Helpers ───────────────────────────────────────────────────────────────────

def _get_framework(org_id: str, db: Session) -> RiskFramework:
    fw = db.query(RiskFramework).filter(RiskFramework.org_id == org_id).first()
    if not fw:
        raise HTTPException(404, "Risk framework not found — complete onboarding first")
    return fw


def _get_run(run_id: str, org_id: str, db: Session) -> RiskAssessmentRun:
    run = db.query(RiskAssessmentRun).filter(
        RiskAssessmentRun.id == run_id,
        RiskAssessmentRun.org_id == org_id,
    ).first()
    if not run:
        raise HTTPException(404, "Assessment run not found")
    return run


def _calculate_run_scores(run: RiskAssessmentRun, db: Session) -> dict:
    """
    Calculate inherent/residual scores for all categories and overall.
    Returns category_scores dict and overall scores.
    """
    factor_scores = db.query(RiskFactorScore).filter(
        RiskFactorScore.assessment_id == run.id
    ).all()

    # Group by category
    category_map: dict[str, list[RiskFactorScore]] = {}
    for fs in factor_scores:
        factor = db.query(RiskFactor).filter(RiskFactor.id == fs.factor_id).first()
        if not factor or not factor.is_active:
            continue
        cat_id = factor.category_id
        category_map.setdefault(cat_id, []).append(fs)

    categories = db.query(RiskCategory).filter(
        RiskCategory.framework_id == run.framework_id,
        RiskCategory.is_active == True,
    ).all()

    category_weights = run.framework.category_weights or {}
    category_scores: dict[str, dict] = {}
    total_weight = sum(category_weights.get(c.category_type.value, c.weight) for c in categories)

    for cat in categories:
        cat_weight = category_weights.get(cat.category_type.value, cat.weight)
        scores = category_map.get(cat.id, [])
        if not scores:
            category_scores[cat.category_type.value] = {
                "inherent": 0.0, "residual": 0.0, "rating": "low",
                "scored_factors": 0, "total_factors": 0,
            }
            continue

        total_factor_weight = sum(fs.factor_weight_override or 1.0 for fs in scores)
        cat_inherent = sum(
            (fs.inherent_risk_score or 0) * (fs.factor_weight_override or 1.0)
            for fs in scores
        ) / max(total_factor_weight, 1)
        cat_residual = sum(
            (fs.override_residual_score if fs.score_override else fs.residual_risk_score or 0)
            * (fs.factor_weight_override or 1.0)
            for fs in scores
        ) / max(total_factor_weight, 1)

        category_scores[cat.category_type.value] = {
            "inherent": round(cat_inherent, 2),
            "residual": round(cat_residual, 2),
            "rating": risk_rating(cat_residual),
            "scored_factors": sum(1 for fs in scores if fs.likelihood and fs.consequence),
            "total_factors": len(scores),
            "weight": cat_weight,
        }

    # Overall weighted
    if total_weight == 0:
        return {"category_scores": category_scores, "overall_inherent": 0.0, "overall_residual": 0.0}

    overall_inherent = sum(
        category_scores.get(cat.category_type.value, {}).get("inherent", 0.0)
        * category_weights.get(cat.category_type.value, cat.weight)
        for cat in categories
    ) / total_weight

    overall_residual = sum(
        category_scores.get(cat.category_type.value, {}).get("residual", 0.0)
        * category_weights.get(cat.category_type.value, cat.weight)
        for cat in categories
    ) / total_weight

    return {
        "category_scores": category_scores,
        "overall_inherent": round(overall_inherent, 2),
        "overall_residual": round(overall_residual, 2),
    }


# ── Framework ─────────────────────────────────────────────────────────────────

@router.get("/framework")
def get_framework(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    fw = _get_framework(org_id_for(current_user), db)
    categories = db.query(RiskCategory).filter(
        RiskCategory.framework_id == fw.id,
        RiskCategory.is_active == True,
    ).order_by(RiskCategory.sort_order).all()

    return {
        "id": fw.id,
        "name": fw.name,
        "industry": fw.industry,
        "category_weights": fw.category_weights,
        "governance_disclaimer": DISCLAIMER,
        "categories": [
            {
                "id": c.id,
                "type": c.category_type.value,
                "name": c.name,
                "description": c.description,
                "weight": fw.category_weights.get(c.category_type.value, c.weight),
                "factor_count": db.query(RiskFactor).filter(
                    RiskFactor.category_id == c.id,
                    RiskFactor.is_active == True,
                ).count(),
            }
            for c in categories
        ],
        "created_at": fw.created_at,
    }


@router.patch("/framework/weights")
def update_category_weights(
    weights: dict,
    current_user: User = Depends(require_mlro_or_above),
    db: Session = Depends(get_db),
):
    """Update category weights. Values must be > 0; platform will normalise to sum = 1."""
    fw = _get_framework(org_id_for(current_user), db)
    valid_types = {t.value for t in RiskCategoryType}
    for k in weights:
        if k not in valid_types:
            raise HTTPException(422, f"Unknown category type: '{k}'")
        if weights[k] < 0:
            raise HTTPException(422, f"Weight for '{k}' must be >= 0")

    total = sum(weights.values())
    if total == 0:
        raise HTTPException(422, "At least one weight must be > 0")

    # Normalise
    fw.category_weights = {k: round(v / total, 4) for k, v in weights.items()}
    db.commit()
    return {"category_weights": fw.category_weights}


# ── Risk Factors ──────────────────────────────────────────────────────────────

@router.get("/framework/categories/{category_id}/factors")
def list_factors(
    category_id: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    oid = org_id_for(current_user)
    fw = _get_framework(oid, db)
    cat = db.query(RiskCategory).filter(
        RiskCategory.id == category_id,
        RiskCategory.framework_id == fw.id,
    ).first()
    if not cat:
        raise HTTPException(404, "Category not found")

    factors = db.query(RiskFactor).filter(
        RiskFactor.category_id == category_id,
        RiskFactor.is_active == True,
    ).order_by(RiskFactor.sort_order).all()

    return [
        {
            "id": f.id,
            "factor_ref": f.factor_ref,
            "name": f.name,
            "description": f.description,
            "rationale": f.rationale,
            "is_mandatory": f.is_mandatory,
            "suggested_likelihood": f.suggested_likelihood,
            "suggested_consequence": f.suggested_consequence,
            "suggested_control_effectiveness": f.suggested_control_effectiveness,
            "mitigation_examples": f.mitigation_examples,
            "regulatory_references": f.regulatory_references,
        }
        for f in factors
    ]


@router.post("/framework/categories/{category_id}/factors")
def add_custom_factor(
    category_id: str,
    name: str,
    description: Optional[str] = None,
    rationale: Optional[str] = None,
    current_user: User = Depends(require_compliance_or_above),
    db: Session = Depends(get_db),
):
    oid = org_id_for(current_user)
    fw = _get_framework(oid, db)
    cat = db.query(RiskCategory).filter(
        RiskCategory.id == category_id,
        RiskCategory.framework_id == fw.id,
    ).first()
    if not cat:
        raise HTTPException(404, "Category not found")

    count = db.query(RiskFactor).filter(RiskFactor.category_id == category_id).count()
    factor = RiskFactor(
        category_id=category_id,
        org_id=oid,
        factor_ref=f"{cat.category_type.value[:2].upper()}-C{str(count + 1).zfill(3)}",
        name=name,
        description=description,
        rationale=rationale,
        created_by=current_user.id,
    )
    db.add(factor)
    db.commit()
    db.refresh(factor)
    return factor


# ── Assessment Runs ───────────────────────────────────────────────────────────

@router.post("/assessments", status_code=201)
def create_assessment(
    title: str,
    assessment_date: date,
    trigger: str = "annual",
    assessment_period_start: Optional[date] = None,
    assessment_period_end: Optional[date] = None,
    current_user: User = Depends(require_compliance_or_above),
    db: Session = Depends(get_db),
):
    oid = org_id_for(current_user)
    fw = _get_framework(oid, db)

    run = RiskAssessmentRun(
        framework_id=fw.id,
        org_id=oid,
        title=title,
        assessment_date=assessment_date,
        assessment_period_start=assessment_period_start,
        assessment_period_end=assessment_period_end,
        status=AssessmentStatus.draft,
        trigger=trigger,
        conducted_by=current_user.id,
    )
    db.add(run)
    db.flush()

    # Pre-populate blank factor score records for all active factors
    categories = db.query(RiskCategory).filter(
        RiskCategory.framework_id == fw.id,
        RiskCategory.is_active == True,
    ).all()
    for cat in categories:
        factors = db.query(RiskFactor).filter(
            RiskFactor.category_id == cat.id,
            RiskFactor.is_active == True,
        ).all()
        for factor in factors:
            db.add(RiskFactorScore(
                assessment_id=run.id,
                factor_id=factor.id,
                org_id=oid,
            ))

    db.add(AuditLog(
        event_type=AuditEventType.risk_score_changed,
        org_id=oid,
        actor_id=current_user.id,
        action="risk.assessment.create",
        object_type="RiskAssessmentRun",
        object_id=run.id,
        new_value={"title": title, "trigger": trigger},
    ))
    db.commit()
    db.refresh(run)
    log.info("Assessment run created: %s org=%s", run.id, oid)
    return {"id": run.id, "title": run.title, "status": run.status, "disclaimer": DISCLAIMER}


@router.get("/assessments")
def list_assessments(
    status: Optional[AssessmentStatus] = Query(None),
    pagination: Pagination = Depends(),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    oid = org_id_for(current_user)
    q = db.query(RiskAssessmentRun).filter(RiskAssessmentRun.org_id == oid)
    if status:
        q = q.filter(RiskAssessmentRun.status == status)
    runs = pagination.apply(q.order_by(RiskAssessmentRun.assessment_date.desc())).all()
    return [
        {
            "id": r.id, "title": r.title, "status": r.status,
            "assessment_date": r.assessment_date, "trigger": r.trigger,
            "overall_residual_rating": r.overall_residual_rating,
            "overall_residual_risk_score": r.overall_residual_risk_score,
            "approved_by": r.approved_by, "approved_at": r.approved_at,
        }
        for r in runs
    ]


@router.get("/assessments/{run_id}")
def get_assessment(
    run_id: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    run = _get_run(run_id, org_id_for(current_user), db)
    scores = _calculate_run_scores(run, db)
    return {
        "id": run.id,
        "title": run.title,
        "status": run.status,
        "assessment_date": run.assessment_date,
        "trigger": run.trigger,
        "overall_inherent_risk_score": run.overall_inherent_risk_score,
        "overall_residual_risk_score": run.overall_residual_risk_score,
        "overall_inherent_rating": run.overall_inherent_rating,
        "overall_residual_rating": run.overall_residual_rating,
        "category_scores": run.category_scores or scores["category_scores"],
        "executive_summary": run.executive_summary,
        "key_findings": run.key_findings,
        "recommendations": run.recommendations,
        "action_items": run.action_items,
        "conducted_by": run.conducted_by,
        "reviewed_by": run.reviewed_by,
        "approved_by": run.approved_by,
        "approved_at": run.approved_at,
        "disclaimer": DISCLAIMER,
        "disclaimer_acknowledged": run.disclaimer_acknowledged,
    }


# ── Factor Scoring ─────────────────────────────────────────────────────────────

@router.get("/assessments/{run_id}/factors")
def list_factor_scores(
    run_id: str,
    category_type: Optional[str] = Query(None),
    unscored_only: bool = Query(False),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    run = _get_run(run_id, org_id_for(current_user), db)
    q = db.query(RiskFactorScore).filter(RiskFactorScore.assessment_id == run_id)

    if category_type or unscored_only:
        factor_ids = [fs.factor_id for fs in q.all()]
        factor_q = db.query(RiskFactor).filter(RiskFactor.id.in_(factor_ids))
        if category_type:
            cat_ids = [c.id for c in db.query(RiskCategory).filter(
                RiskCategory.framework_id == run.framework_id,
                RiskCategory.category_type == category_type,
            ).all()]
            factor_q = factor_q.filter(RiskFactor.category_id.in_(cat_ids))
        valid_factor_ids = {f.id for f in factor_q.all()}
        q = q.filter(RiskFactorScore.factor_id.in_(valid_factor_ids))

    if unscored_only:
        q = q.filter(RiskFactorScore.likelihood == None)

    scores = q.all()
    result = []
    for fs in scores:
        factor = db.query(RiskFactor).filter(RiskFactor.id == fs.factor_id).first()
        cat = db.query(RiskCategory).filter(RiskCategory.id == factor.category_id).first() if factor else None
        result.append({
            "factor_score_id": fs.id,
            "factor_id": fs.factor_id,
            "factor_ref": factor.factor_ref if factor else None,
            "factor_name": factor.name if factor else None,
            "category": cat.category_type.value if cat else None,
            "category_name": cat.name if cat else None,
            "is_mandatory": factor.is_mandatory if factor else False,
            "suggested_likelihood": factor.suggested_likelihood if factor else None,
            "suggested_consequence": factor.suggested_consequence if factor else None,
            "suggested_control_effectiveness": factor.suggested_control_effectiveness if factor else None,
            "likelihood": fs.likelihood,
            "consequence": fs.consequence,
            "control_effectiveness": fs.control_effectiveness,
            "inherent_risk_score": fs.inherent_risk_score,
            "residual_risk_score": fs.residual_risk_score,
            "inherent_rating": fs.inherent_rating,
            "residual_rating": fs.residual_rating,
            "score_override": fs.score_override,
            "override_residual_score": fs.override_residual_score,
            "override_justification": fs.override_justification,
            "comments": fs.comments,
            "scored_by": fs.scored_by,
            "scored_at": fs.scored_at,
        })
    return result


@router.patch("/assessments/{run_id}/factors/{factor_score_id}")
def score_factor(
    run_id: str,
    factor_score_id: str,
    likelihood: Optional[int] = Query(None, ge=1, le=5),
    consequence: Optional[int] = Query(None, ge=1, le=5),
    control_effectiveness: Optional[int] = Query(None, ge=1, le=5),
    comments: Optional[str] = None,
    override_residual_score: Optional[float] = Query(None, ge=0, le=25),
    override_justification: Optional[str] = None,
    current_user: User = Depends(require_analyst_or_above),
    db: Session = Depends(get_db),
):
    """
    Score a risk factor. Platform calculates inherent and residual from L/C/CE.
    Users may override the residual with a mandatory justification comment.
    Every change creates an immutable RiskScoreHistory record.
    """
    run = _get_run(run_id, org_id_for(current_user), db)
    if run.status not in (AssessmentStatus.draft, AssessmentStatus.in_progress):
        raise HTTPException(422, f"Cannot score factors on a '{run.status.value}' assessment")

    fs = db.query(RiskFactorScore).filter(
        RiskFactorScore.id == factor_score_id,
        RiskFactorScore.assessment_id == run_id,
    ).first()
    if not fs:
        raise HTTPException(404, "Factor score record not found")

    # Capture previous for history
    prev = {
        "likelihood": fs.likelihood, "consequence": fs.consequence,
        "control_effectiveness": fs.control_effectiveness,
        "residual_risk_score": fs.residual_risk_score,
    }

    if likelihood is not None:
        fs.likelihood = likelihood
    if consequence is not None:
        fs.consequence = consequence
    if control_effectiveness is not None:
        fs.control_effectiveness = control_effectiveness
    if comments is not None:
        fs.comments = comments

    # Calculate scores if L and C are present
    if fs.likelihood and fs.consequence:
        inh = inherent_risk(fs.likelihood, fs.consequence)
        fs.inherent_risk_score = inh
        fs.inherent_rating = risk_rating(inh)

        if fs.control_effectiveness:
            res = residual_risk(inh, fs.control_effectiveness)
            fs.residual_risk_score = res
            fs.residual_rating = risk_rating(res)

    # Handle override
    if override_residual_score is not None:
        if not override_justification:
            raise HTTPException(422, "override_justification is required when overriding residual score")
        fs.score_override = True
        fs.override_residual_score = override_residual_score
        fs.override_justification = override_justification
        fs.residual_rating = risk_rating(override_residual_score)

    fs.scored_by = current_user.id
    fs.scored_at = datetime.now(timezone.utc)

    # Immutable history record
    if any(v != prev.get(k) for k, v in {
        "likelihood": fs.likelihood, "consequence": fs.consequence,
        "control_effectiveness": fs.control_effectiveness,
        "residual_risk_score": fs.residual_risk_score,
    }.items()):
        db.add(RiskScoreHistory(
            factor_score_id=fs.id,
            org_id=run.org_id,
            assessment_id=run_id,
            factor_id=fs.factor_id,
            previous_likelihood=prev["likelihood"],
            previous_consequence=prev["consequence"],
            previous_control_effectiveness=prev["control_effectiveness"],
            previous_residual_score=prev["residual_risk_score"],
            new_likelihood=fs.likelihood,
            new_consequence=fs.consequence,
            new_control_effectiveness=fs.control_effectiveness,
            new_residual_score=fs.residual_risk_score,
            change_reason=comments,
            changed_by=current_user.id,
        ))

    if run.status == AssessmentStatus.draft:
        run.status = AssessmentStatus.in_progress

    db.commit()
    db.refresh(fs)
    return {
        "factor_score_id": fs.id,
        "likelihood": fs.likelihood,
        "consequence": fs.consequence,
        "control_effectiveness": fs.control_effectiveness,
        "inherent_risk_score": fs.inherent_risk_score,
        "inherent_rating": fs.inherent_rating,
        "residual_risk_score": fs.override_residual_score if fs.score_override else fs.residual_risk_score,
        "residual_rating": fs.residual_rating,
        "score_override": fs.score_override,
        "disclaimer": DISCLAIMER,
    }


# ── Recalculate ────────────────────────────────────────────────────────────────

@router.post("/assessments/{run_id}/calculate")
def recalculate_scores(
    run_id: str,
    current_user: User = Depends(require_analyst_or_above),
    db: Session = Depends(get_db),
):
    """Recalculate and persist all category and overall scores from current factor scores."""
    run = _get_run(run_id, org_id_for(current_user), db)
    scores = _calculate_run_scores(run, db)

    run.category_scores = scores["category_scores"]
    run.overall_inherent_risk_score = scores["overall_inherent"]
    run.overall_residual_risk_score = scores["overall_residual"]
    run.overall_inherent_rating = risk_rating(scores["overall_inherent"])
    run.overall_residual_rating = risk_rating(scores["overall_residual"])

    db.commit()
    return {
        "overall_inherent_risk_score": run.overall_inherent_risk_score,
        "overall_residual_risk_score": run.overall_residual_risk_score,
        "overall_inherent_rating": run.overall_inherent_rating,
        "overall_residual_rating": run.overall_residual_rating,
        "category_scores": run.category_scores,
        "disclaimer": DISCLAIMER,
    }


# ── Narrative ──────────────────────────────────────────────────────────────────

@router.patch("/assessments/{run_id}/narrative")
def update_narrative(
    run_id: str,
    executive_summary: Optional[str] = None,
    key_findings: Optional[str] = None,
    recommendations: Optional[str] = None,
    action_items: Optional[List[dict]] = None,
    current_user: User = Depends(require_compliance_or_above),
    db: Session = Depends(get_db),
):
    run = _get_run(run_id, org_id_for(current_user), db)
    if run.status not in (AssessmentStatus.draft, AssessmentStatus.in_progress):
        raise HTTPException(422, f"Cannot edit narrative on a '{run.status.value}' assessment")
    if executive_summary is not None:
        run.executive_summary = executive_summary
    if key_findings is not None:
        run.key_findings = key_findings
    if recommendations is not None:
        run.recommendations = recommendations
    if action_items is not None:
        run.action_items = action_items
    db.commit()
    return {"status": "updated"}


# ── Mitigations ────────────────────────────────────────────────────────────────

@router.post("/assessments/{run_id}/mitigations", status_code=201)
def add_mitigation(
    run_id: str,
    risk_description: str,
    mitigation_action: str,
    owner_id: str,
    due_date: date,
    factor_score_id: Optional[str] = None,
    current_user: User = Depends(require_compliance_or_above),
    db: Session = Depends(get_db),
):
    run = _get_run(run_id, org_id_for(current_user), db)
    mit = RiskMitigation(
        assessment_id=run_id,
        factor_score_id=factor_score_id,
        org_id=run.org_id,
        risk_description=risk_description,
        mitigation_action=mitigation_action,
        owner=owner_id,
        due_date=due_date,
        status=MitigationStatus.not_started,
        created_by=current_user.id,
    )
    db.add(mit)
    db.commit()
    db.refresh(mit)
    return mit


@router.get("/assessments/{run_id}/mitigations")
def list_mitigations(
    run_id: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    run = _get_run(run_id, org_id_for(current_user), db)
    return run.mitigations


@router.patch("/assessments/{run_id}/mitigations/{mit_id}")
def update_mitigation(
    run_id: str,
    mit_id: str,
    status: Optional[MitigationStatus] = None,
    completion_notes: Optional[str] = None,
    current_user: User = Depends(require_compliance_or_above),
    db: Session = Depends(get_db),
):
    run = _get_run(run_id, org_id_for(current_user), db)
    mit = db.query(RiskMitigation).filter(
        RiskMitigation.id == mit_id,
        RiskMitigation.assessment_id == run_id,
    ).first()
    if not mit:
        raise HTTPException(404, "Mitigation not found")
    if status:
        mit.status = status
    if completion_notes:
        mit.completion_notes = completion_notes
    if status == MitigationStatus.completed:
        mit.completed_at = datetime.now(timezone.utc)
    db.commit()
    db.refresh(mit)
    return mit


# ── Workflow ───────────────────────────────────────────────────────────────────

@router.post("/assessments/{run_id}/submit")
def submit_assessment(
    run_id: str,
    current_user: User = Depends(require_compliance_or_above),
    db: Session = Depends(get_db),
):
    """Submit completed assessment for MLRO review."""
    run = _get_run(run_id, org_id_for(current_user), db)
    if run.status != AssessmentStatus.in_progress:
        raise HTTPException(422, f"Assessment must be 'in_progress' to submit; current: '{run.status.value}'")

    # Validate all mandatory factors are scored
    fw = run.framework
    unscored_mandatory = []
    for cat in fw.categories:
        for factor in cat.factors:
            if factor.is_mandatory and factor.is_active:
                fs = db.query(RiskFactorScore).filter(
                    RiskFactorScore.assessment_id == run_id,
                    RiskFactorScore.factor_id == factor.id,
                ).first()
                if not fs or fs.likelihood is None or fs.consequence is None:
                    unscored_mandatory.append(f"{factor.factor_ref} — {factor.name}")

    if unscored_mandatory:
        raise HTTPException(
            422,
            f"Cannot submit: {len(unscored_mandatory)} mandatory factor(s) not scored: "
            f"{', '.join(unscored_mandatory[:5])}"
            + (" (and more)" if len(unscored_mandatory) > 5 else "")
        )

    # Final calculation before submit
    scores = _calculate_run_scores(run, db)
    run.category_scores = scores["category_scores"]
    run.overall_inherent_risk_score = scores["overall_inherent"]
    run.overall_residual_risk_score = scores["overall_residual"]
    run.overall_inherent_rating = risk_rating(scores["overall_inherent"])
    run.overall_residual_rating = risk_rating(scores["overall_residual"])
    run.status = AssessmentStatus.completed
    run.reviewed_by = current_user.id

    db.add(AuditLog(
        event_type=AuditEventType.risk_score_changed,
        org_id=run.org_id,
        actor_id=current_user.id,
        action="risk.assessment.submit",
        object_type="RiskAssessmentRun",
        object_id=run_id,
        new_value={
            "overall_residual": run.overall_residual_risk_score,
            "rating": run.overall_residual_rating,
        },
    ))
    db.commit()
    return {
        "status": run.status,
        "overall_residual_risk_score": run.overall_residual_risk_score,
        "overall_residual_rating": run.overall_residual_rating,
        "disclaimer": DISCLAIMER,
    }


@router.post("/assessments/{run_id}/approve")
def approve_assessment(
    run_id: str,
    disclaimer_acknowledged: bool,
    next_review_date: Optional[date] = None,
    current_user: User = Depends(require_mlro_or_above),
    db: Session = Depends(get_db),
):
    """MLRO/Admin approves the assessment. Disclaimer must be explicitly acknowledged."""
    run = _get_run(run_id, org_id_for(current_user), db)
    if run.status != AssessmentStatus.completed:
        raise HTTPException(422, f"Assessment must be 'completed' to approve; current: '{run.status.value}'")
    if not disclaimer_acknowledged:
        raise HTTPException(
            422,
            "Approver must explicitly acknowledge the governance disclaimer before approving"
        )

    run.status = AssessmentStatus.approved
    run.approved_by = current_user.id
    run.approved_at = datetime.now(timezone.utc)
    run.disclaimer_acknowledged = True
    run.disclaimer_acknowledged_by = current_user.id
    run.disclaimer_acknowledged_at = datetime.now(timezone.utc)
    if next_review_date:
        run.next_review_date = next_review_date

    db.add(AuditLog(
        event_type=AuditEventType.risk_score_changed,
        org_id=run.org_id,
        actor_id=current_user.id,
        action="risk.assessment.approve",
        object_type="RiskAssessmentRun",
        object_id=run_id,
        new_value={"approved_by": current_user.id, "disclaimer_acknowledged": True},
    ))
    db.commit()
    return {
        "status": run.status,
        "approved_by": run.approved_by,
        "approved_at": run.approved_at,
        "next_review_date": run.next_review_date,
        "overall_residual_rating": run.overall_residual_rating,
        "disclaimer": DISCLAIMER,
    }


# ── Score history (immutable audit) ───────────────────────────────────────────

@router.get("/assessments/{run_id}/factors/{factor_score_id}/history")
def get_score_history(
    run_id: str,
    factor_score_id: str,
    current_user: User = Depends(require_compliance_or_above),
    db: Session = Depends(get_db),
):
    _get_run(run_id, org_id_for(current_user), db)
    history = db.query(RiskScoreHistory).filter(
        RiskScoreHistory.factor_score_id == factor_score_id
    ).order_by(RiskScoreHistory.changed_at.asc()).all()
    return history


# ── Library (read-only templates) ─────────────────────────────────────────────

@router.get("/library")
def list_library_factors(
    industry: Optional[str] = Query(None),
    category_type: Optional[str] = Query(None),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    from app.models.risk_engine import RiskLibraryFactor
    q = db.query(RiskLibraryFactor)
    if industry:
        q = q.filter(RiskLibraryFactor.industry.in_([industry, "all"]))
    if category_type:
        q = q.filter(RiskLibraryFactor.category_type == category_type)
    return q.order_by(RiskLibraryFactor.category_type, RiskLibraryFactor.sort_order).all()
