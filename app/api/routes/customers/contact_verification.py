"""
Customers — phone and email OTP verification. Part of the customers route
package; see __init__.py for the combined router.
"""

from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.api.deps import get_current_user, org_id_for, require_analyst_or_above
from app.db.database import get_db
from app.models.kyc import (
    CustomerEmailVerification,
    CustomerPhoneVerification,
    VerificationResult,
)
from app.models.user import User
from app.schemas.customer import (
    EmailVerificationCreate,
    EmailVerificationResponse,
    PhoneVerificationCreate,
    PhoneVerificationResponse,
)

from ._shared import _get_customer, _update_checklist_flag

router = APIRouter()


# ── Phone Verification ─────────────────────────────────────────────────────────


@router.post(
    "/{customer_id}/phone-verification",
    response_model=PhoneVerificationResponse,
    status_code=201,
)
def create_phone_verification(
    customer_id: str,
    payload: PhoneVerificationCreate,
    current_user: User = Depends(require_analyst_or_above),
    db: Session = Depends(get_db),
):
    customer = _get_customer(customer_id, org_id_for(current_user), db)
    rec = CustomerPhoneVerification(
        customer_id=customer.id,
        org_id=customer.org_id,
        phone_number=payload.phone_number,
        otp_sent=True,
        otp_sent_at=datetime.now(timezone.utc),
    )
    db.add(rec)
    db.commit()
    db.refresh(rec)
    return rec


@router.post(
    "/{customer_id}/phone-verification/{verification_id}/confirm",
    response_model=PhoneVerificationResponse,
)
def confirm_phone_otp(
    customer_id: str,
    verification_id: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Mark OTP as verified (OTP logic handled by frontend/SMS provider)."""
    customer = _get_customer(customer_id, org_id_for(current_user), db)
    rec = (
        db.query(CustomerPhoneVerification)
        .filter(
            CustomerPhoneVerification.id == verification_id,
            CustomerPhoneVerification.customer_id == customer_id,
        )
        .first()
    )
    if not rec:
        raise HTTPException(404, "Phone verification record not found")
    rec.otp_verified = True
    rec.otp_verified_at = datetime.now(timezone.utc)
    rec.verification_result = VerificationResult.pass_
    rec.verified_at = datetime.now(timezone.utc)
    _update_checklist_flag(customer, "phone_verified", True, db)
    db.commit()
    db.refresh(rec)
    return rec


# ── Email Verification ─────────────────────────────────────────────────────────


@router.post(
    "/{customer_id}/email-verification",
    response_model=EmailVerificationResponse,
    status_code=201,
)
def create_email_verification(
    customer_id: str,
    payload: EmailVerificationCreate,
    current_user: User = Depends(require_analyst_or_above),
    db: Session = Depends(get_db),
):
    customer = _get_customer(customer_id, org_id_for(current_user), db)
    from app.models.kyc import CustomerEmailVerification as EV

    rec = EV(
        customer_id=customer.id,
        org_id=customer.org_id,
        email_address=str(payload.email_address),
        domain=str(payload.email_address).split("@")[-1],
        token_sent=True,
        token_sent_at=datetime.now(timezone.utc),
    )
    db.add(rec)
    db.commit()
    db.refresh(rec)
    return rec


@router.post(
    "/{customer_id}/email-verification/{verification_id}/confirm",
    response_model=EmailVerificationResponse,
)
def confirm_email_token(
    customer_id: str,
    verification_id: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    customer = _get_customer(customer_id, org_id_for(current_user), db)
    rec = (
        db.query(CustomerEmailVerification)
        .filter(
            CustomerEmailVerification.id == verification_id,
            CustomerEmailVerification.customer_id == customer_id,
        )
        .first()
    )
    if not rec:
        raise HTTPException(404, "Email verification record not found")
    rec.token_verified = True
    rec.token_verified_at = datetime.now(timezone.utc)
    rec.verification_result = VerificationResult.pass_
    rec.verified_at = datetime.now(timezone.utc)
    _update_checklist_flag(customer, "email_verified", True, db)
    db.commit()
    db.refresh(rec)
    return rec
