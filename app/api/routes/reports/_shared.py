"""
Shared helpers for the reports route package (ttr.py, smr.py,
filing_register.py, ecdd.py, summary.py) — split out of what was a single
1497-line app/api/routes/reports.py.
"""

from typing import Optional

from fastapi import HTTPException
from sqlalchemy.orm import Session

from app.models.report import ReportStatus
from app.models.user import User
from app.services import audit_service


def _log(
    db: Session,
    current_user: User,
    org_id: str,
    entity_type: str,
    entity_id: str,
    action: str,
    after_state: Optional[dict] = None,
    notes: Optional[str] = None,
) -> None:
    """
    Regulatory-report audit trail. Stage 10 explicitly requires every report
    to record who created it, when, what changed, and who approved it -- most
    of that maker-checker chain (draft, review, approve, MLRO sign-off,
    acknowledge, reject, redraft) was previously unaudited; only the final
    "submit" step was. See docs/regulatory-reporting.md.
    """
    audit_service.log_action(
        db,
        action=action,
        entity_type=entity_type,
        entity_id=entity_id,
        actor=current_user.email,
        actor_role=current_user.role.value if current_user.role else None,
        organisation_id=org_id,
        after_state=after_state,
        notes=notes,
    )


def _assert_editable(report, label: str):
    if report.status not in (ReportStatus.draft, ReportStatus.under_review):
        raise HTTPException(
            409, f"{label} cannot be edited in status: {report.status.value}"
        )


def _assert_maker_checker(report, approver_id: str):
    if report.reviewed_by and report.reviewed_by == approver_id:
        raise HTTPException(
            403, "Maker-checker violation: approver cannot be the same as reviewer."
        )
