"""
Reports — reporting summary/dashboard. Part of the reports route package;
see __init__.py for the combined router.
"""

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.api.deps import org_id_for, require_analyst_or_above
from app.db.database import get_db
from app.models.user import User
from app.services.reporting_service import reporting_summary

router = APIRouter()


# ── Summary / Dashboard ───────────────────────────────────────────────────────


@router.get("/summary")
def get_reporting_summary(
    db: Session = Depends(get_db),
    current_user: User = Depends(require_analyst_or_above),
):
    return reporting_summary(db, org_id_for(current_user))
