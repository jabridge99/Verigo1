"""
Analytics endpoints — compliance KPIs and chart data.
"""

from typing import Optional

from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

from app.api.routes.auth import _current_user
from app.db.database import get_db
from app.models.user import User
from app.services import analytics_service as svc

router = APIRouter(prefix="/analytics", tags=["analytics"])


def _industry(current_user: User, override: Optional[str]) -> Optional[str]:
    if current_user.role == "admin" and override:
        return override
    return current_user.org_id


@router.get("/summary")
def summary(
    industry_id: Optional[str] = Query(None),
    db: Session = Depends(get_db),
    current_user: User = Depends(_current_user),
):
    return svc.dashboard_summary(db, _industry(current_user, industry_id))


@router.get("/customers/risk-breakdown")
def customer_risk(
    industry_id: Optional[str] = Query(None),
    db: Session = Depends(get_db),
    current_user: User = Depends(_current_user),
):
    return svc.customer_risk_breakdown(db, _industry(current_user, industry_id))


@router.get("/customers/onboarding-trend")
def onboarding_trend(
    days: int = Query(30, ge=7, le=365),
    industry_id: Optional[str] = Query(None),
    db: Session = Depends(get_db),
    current_user: User = Depends(_current_user),
):
    return svc.customer_onboarding_trend(db, days, _industry(current_user, industry_id))


@router.get("/transactions/volume-trend")
def volume_trend(
    days: int = Query(30, ge=7, le=365),
    industry_id: Optional[str] = Query(None),
    db: Session = Depends(get_db),
    current_user: User = Depends(_current_user),
):
    return svc.transaction_volume_trend(db, days, _industry(current_user, industry_id))


@router.get("/transactions/flagged-stats")
def flagged_stats(
    industry_id: Optional[str] = Query(None),
    db: Session = Depends(get_db),
    current_user: User = Depends(_current_user),
):
    return svc.flagged_transaction_stats(db, _industry(current_user, industry_id))


@router.get("/kyc/status-breakdown")
def kyc_status(
    industry_id: Optional[str] = Query(None),
    db: Session = Depends(get_db),
    current_user: User = Depends(_current_user),
):
    return svc.kyc_status_breakdown(db, _industry(current_user, industry_id))


@router.get("/reports/stats")
def report_stats(
    industry_id: Optional[str] = Query(None),
    db: Session = Depends(get_db),
    current_user: User = Depends(_current_user),
):
    return svc.report_stats(db, _industry(current_user, industry_id))


@router.get("/reports/submission-trend")
def submission_trend(
    days: int = Query(90, ge=7, le=365),
    industry_id: Optional[str] = Query(None),
    db: Session = Depends(get_db),
    current_user: User = Depends(_current_user),
):
    return svc.report_submission_trend(db, days, _industry(current_user, industry_id))


@router.get("/audit/activity-trend")
def audit_trend(
    days: int = Query(30, ge=7, le=365),
    industry_id: Optional[str] = Query(None),
    db: Session = Depends(get_db),
    current_user: User = Depends(_current_user),
):
    return svc.audit_activity_trend(db, days, _industry(current_user, industry_id))
