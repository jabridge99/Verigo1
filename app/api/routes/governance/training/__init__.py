"""
AML/CTF Governance — Training Management API.

Manages staff AML/CTF training obligations aligned with:
  - AUSTRAC AML/CTF Rules 2025 (Part B — staff training)
  - FATF Recommendation 18 (internal controls and training)
  - APRA CPS 230 (workforce capability)

Roles:
  GET (catalogue, own records, dashboard)  — analyst+
  Assign / Mark complete / Exempt          — compliance+
  Create/update courses                    — mlro+
  Seed standard courses                    — admin / mlro

Training record status is CALCULATED (not manually set):
  exempt      → is_exempt = True
  completed   → completion_date set AND (no expiry OR expiry >= today)
  expired     → completion_date set AND expiry_date < today
  overdue     → completion_date null AND due_date < today
  in_progress → completion_date null AND started_at set AND due_date >= today
  assigned    → completion_date null AND started_at null AND due_date >= today

DISCLAIMER: This module is a governance tooling aid only.
Training completion records do not constitute regulatory certification.

Split into courses.py / assignments.py / records.py / dashboard.py, composed
here into one router under the original /governance/training prefix —
main.py's import site (`from app.api.routes.governance.training import
router`) needed no change.
"""

from fastapi import APIRouter

from app.api.routes.governance.training import assignments, courses, dashboard, records

router = APIRouter(prefix="/governance/training", tags=["Governance — Training"])
router.include_router(courses.router)
router.include_router(assignments.router)
router.include_router(records.router)
router.include_router(dashboard.router)
