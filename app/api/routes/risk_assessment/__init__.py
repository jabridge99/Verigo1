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

Split into framework.py / assessments.py / library.py, composed here into one
router under the original /risk prefix — main.py's import site
(`from app.api.routes.risk_assessment import router`) needed no change.
"""

from fastapi import APIRouter

from app.api.routes.risk_assessment import assessments, framework, library

router = APIRouter(prefix="/risk", tags=["Risk Assessment"])
router.include_router(framework.router)
router.include_router(assessments.router)
router.include_router(library.router)
