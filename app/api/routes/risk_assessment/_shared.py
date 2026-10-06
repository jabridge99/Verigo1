"""
Shared helpers for the risk_assessment route package (framework.py,
assessments.py, library.py) — split out of what was a single 1213-line
app/api/routes/risk_assessment.py.
"""

from fastapi import HTTPException
from sqlalchemy.orm import Session

from app.api.deps import org_id_for
from app.models.risk_engine import RiskFramework
from app.models.user import User
from app.services import audit_service

DISCLAIMER = (
    "This risk assessment framework is a configurable tool only. Risk ratings, scoring, "
    "assumptions, and conclusions remain the sole responsibility of the reporting entity. "
    "The platform does not determine final risk ratings, provide legal or compliance advice, "
    "or accept liability for risk outcomes."
)


def _get_framework(org_id: str, db: Session) -> RiskFramework:
    fw = db.query(RiskFramework).filter(RiskFramework.org_id == org_id).first()
    if not fw:
        raise HTTPException(404, "Risk framework not found — complete onboarding first")
    return fw


def _log(
    db: Session,
    current_user: User,
    entity_type: str,
    entity_id: str,
    action: str,
    notes: str = None,
) -> None:
    """
    create_assessment()/submit_assessment()/approve_assessment() already write
    directly to AuditLog (app.models.audit_log, merged into GET /audit/ — see
    app/api/routes/audit.py), but framework configuration (category weights,
    custom factors), factor scoring, and the mitigation library had no audit
    coverage of any kind. AuditEventType has no values for those, so this uses
    the free-text audit_service.log_action() path (a second, also-merged
    table) instead of stretching that enum.
    """
    audit_service.log_action(
        db,
        action=action,
        entity_type=entity_type,
        entity_id=entity_id,
        actor=current_user.email,
        actor_role=current_user.role.value if current_user.role else None,
        organisation_id=org_id_for(current_user),
        notes=notes,
    )
