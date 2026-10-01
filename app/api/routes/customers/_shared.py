"""
Shared helpers for the customers route package (crud.py, kyc_identity.py,
kyb_business.py, contact_verification.py, customer_screening.py,
compliance_status.py, reviews_notes.py, workspace.py, override.py,
bulk_import.py) — split out of what was a single 2377-line
app/api/routes/customers.py.
"""

import logging
from datetime import date, datetime, timezone
from typing import Optional

from fastapi import HTTPException
from sqlalchemy.orm import Session

from app.models.customer import (
    Customer,
    CustomerOnboardingChecklist,
    CustomerRiskScoreHistory,
)
from app.services.risk_engine import inherent_risk, residual_risk

log = logging.getLogger("verigo.api.customers")


def _get_customer(customer_id: str, org_id: str, db: Session) -> Customer:
    c = (
        db.query(Customer)
        .filter(
            Customer.id == customer_id,
            Customer.org_id == org_id,
        )
        .first()
    )
    if not c:
        raise HTTPException(404, "Customer not found")
    return c


def _next_customer_ref(org_id: str, db: Session) -> str:
    year = date.today().year
    count = db.query(Customer).filter(Customer.org_id == org_id).count()
    return f"KYC-{year}-{str(count + 1).zfill(5)}"


def _create_checklist(customer: Customer, db: Session) -> CustomerOnboardingChecklist:
    chk = CustomerOnboardingChecklist(
        customer_id=customer.id,
        org_id=customer.org_id,
    )
    db.add(chk)
    return chk


def _update_checklist_flag(
    customer: Customer, flag: str, value: bool, db: Session
) -> None:
    chk = (
        db.query(CustomerOnboardingChecklist)
        .filter(CustomerOnboardingChecklist.customer_id == customer.id)
        .first()
    )
    if chk:
        setattr(chk, flag, value)
        _check_checklist_complete(chk, customer, db)


def _check_checklist_complete(
    chk: CustomerOnboardingChecklist, customer: Customer, db: Session
) -> None:
    required = ["identity_document_verified", "pep_screened", "sanctions_screened"]
    if customer.customer_type.value in (
        "company",
        "trust",
        "partnership",
        "association",
    ):
        required += ["ubo_identified", "ubo_screened"]
    is_complete = all(getattr(chk, f) for f in required)
    if is_complete and not chk.is_complete:
        chk.is_complete = True
        chk.completed_at = datetime.now(timezone.utc)
    elif not is_complete and chk.is_complete:
        # A previously-clear flag (e.g. screening) was reset — re-block activation.
        chk.is_complete = False
        chk.completed_at = None


def _record_risk_history(
    customer: Customer,
    trigger: str,
    actor_id: str,
    db: Session,
    notes: Optional[str] = None,
    scoring_factors: Optional[dict] = None,
    likelihood: Optional[int] = None,
    consequence: Optional[int] = None,
    control_effectiveness: Optional[int] = None,
) -> None:
    inherent_score = residual_score = None
    if likelihood and consequence:
        inherent_score = inherent_risk(likelihood, consequence)
        if control_effectiveness:
            residual_score = residual_risk(inherent_score, control_effectiveness)

    db.add(
        CustomerRiskScoreHistory(
            customer_id=customer.id,
            org_id=customer.org_id,
            risk_score=customer.risk_score,
            risk_level=customer.risk_level,
            cdd_level=customer.cdd_level,
            scoring_factors=scoring_factors,
            inherent_score=inherent_score,
            residual_score=residual_score,
            control_effectiveness_score=control_effectiveness,
            trigger=trigger,
            triggered_by=actor_id,
            notes=notes,
        )
    )
