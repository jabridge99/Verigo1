"""
Screening — per-customer screening summary, identity-verification score and
decision. Part of the screening route package; see __init__.py for the
combined router.
"""

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.api.deps import (
    org_id_for,
    require_analyst_or_above,
    require_compliance_or_above,
)
from app.db.database import get_db
from app.models.customer import CustomerStatus
from app.models.onboarding import OnboardingSession, SessionStatus
from app.models.screening import (
    AdverseMediaResult,
    AlertStatus,
    CryptoWalletScreening,
    ScreeningAlert,
    ScreeningRecord,
)
from app.models.user import User
from app.services.identity_composite_score import compute_identity_score

from ._shared import DISCLAIMER, _alert_dict, _log, _record_dict, _resolve_customer

router = APIRouter()


@router.get("/customers/{customer_id}/summary")
def customer_screening_summary(
    customer_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_analyst_or_above),
):
    """
    Full screening summary for a customer across all screening types.
    Shows most recent record per type plus open alerts.
    """
    org_id = org_id_for(current_user)
    _resolve_customer(customer_id, org_id, db)

    records = (
        db.query(ScreeningRecord)
        .filter(
            ScreeningRecord.org_id == org_id,
            ScreeningRecord.customer_id == customer_id,
        )
        .order_by(ScreeningRecord.screened_at.desc())
        .all()
    )

    latest_by_type: dict = {}
    for r in records:
        if r.screening_type.value not in latest_by_type:
            latest_by_type[r.screening_type.value] = _record_dict(r)

    open_alerts = (
        db.query(ScreeningAlert)
        .filter(
            ScreeningAlert.org_id == org_id,
            ScreeningAlert.customer_id == customer_id,
            ScreeningAlert.status.in_(
                [AlertStatus.open, AlertStatus.under_review, AlertStatus.escalated]
            ),
        )
        .all()
    )

    wallets = (
        db.query(CryptoWalletScreening)
        .filter(
            CryptoWalletScreening.org_id == org_id,
            CryptoWalletScreening.customer_id == customer_id,
        )
        .count()
    )

    media = (
        db.query(AdverseMediaResult)
        .filter(
            AdverseMediaResult.org_id == org_id,
            AdverseMediaResult.customer_id == customer_id,
            AdverseMediaResult.is_false_positive == False,
        )
        .count()
    )

    return {
        "customer_id": customer_id,
        "total_screenings": len(records),
        "latest_by_type": latest_by_type,
        "open_alerts": [_alert_dict(a) for a in open_alerts],
        "open_alert_count": len(open_alerts),
        "crypto_wallet_screenings": wallets,
        "confirmed_adverse_media": media,
        "overall_clear": len(open_alerts) == 0 and media == 0,
        "disclaimer": DISCLAIMER,
    }


@router.get("/customers/{customer_id}/identity-score")
def customer_identity_score(
    customer_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_analyst_or_above),
):
    """
    Composite identity-verification score (Australia "100-point ID check" style):
    even-weighted across OCR, manual review, PEP, sanctions, adverse media and
    company/UBO screening, with a Pass / ECDD-required / Fail decision.
    """
    org_id = org_id_for(current_user)
    customer = _resolve_customer(customer_id, org_id, db)

    return compute_identity_score(
        db,
        customer_id,
        is_business=getattr(customer, "customer_type", None) == "company",
    )


@router.post("/customers/{customer_id}/identity-score/decide")
def decide_customer_identity_score(
    customer_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_compliance_or_above),
):
    """
    Applies the composite identity-verification decision to the customer's
    KYC status: pass -> active, ecdd_required -> edd_required, fail -> rejected.
    This is the point at which a draft applicant becomes (or doesn't become)
    a real customer for the purposes of the Customers list.
    """
    org_id = org_id_for(current_user)
    customer = _resolve_customer(customer_id, org_id, db)

    result = compute_identity_score(
        db,
        customer_id,
        is_business=getattr(customer, "customer_type", None) == "company",
    )

    decision_to_status = {
        "pass": CustomerStatus.active,
        "ecdd_required": CustomerStatus.edd_required,
        "fail": CustomerStatus.rejected,
    }
    customer.status = decision_to_status[result["decision"]]
    db.add(customer)

    session = (
        db.query(OnboardingSession)
        .filter(OnboardingSession.customer_id == customer_id)
        .first()
    )
    if session:
        session.status = {
            "pass": SessionStatus.completed,
            "ecdd_required": SessionStatus.verification_pending,
            "fail": SessionStatus.rejected,
        }[result["decision"]]
        db.add(session)

    db.commit()
    result["customer_status"] = customer.status.value
    _log(
        db,
        current_user,
        org_id,
        "customer",
        customer.id,
        action="identity_score_decided",
        after_state={
            "decision": result["decision"],
            "customer_status": customer.status.value,
        },
    )
    return result
