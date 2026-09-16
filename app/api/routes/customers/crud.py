"""
Customers — core Customer CRUD lifecycle. Part of the customers route
package; see __init__.py for the combined router.
"""

from datetime import date
from typing import List, Optional

from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException, Query
from sqlalchemy.orm import Session

from app.api.deps import (
    Pagination,
    org_id_for,
    require_analyst_or_above,
    require_compliance_or_above,
)
from app.db.database import get_db
from app.models.audit_log import AuditEventType, AuditLog
from app.models.customer import (
    CDDLevel,
    Customer,
    CustomerOnboardingChecklist,
    CustomerStatus,
    RiskLevel,
)
from app.models.screening import ScreeningRecord, ScreeningStatus
from app.models.user import User
from app.schemas.customer import (
    CustomerCreate,
    CustomerResponse,
    CustomerStatusUpdate,
    CustomerUpdate,
)
from app.services import billing_service
from app.services.api_key_service import dispatch_event_background
from app.worker import add_background_task

from ._shared import (
    _create_checklist,
    _get_customer,
    _next_customer_ref,
    _record_risk_history,
    log,
)

router = APIRouter()

# ScreeningRecord statuses that represent an unresolved hit — must block activation.
_SCREENING_BLOCKING_STATUSES = {
    ScreeningStatus.potential_match,
    ScreeningStatus.confirmed_match,
    ScreeningStatus.requires_edd,
}


@router.post("", response_model=CustomerResponse, status_code=201)
def create_customer(
    payload: CustomerCreate,
    background_tasks: BackgroundTasks,
    current_user: User = Depends(require_analyst_or_above),
    db: Session = Depends(get_db),
):
    oid = org_id_for(current_user)
    billing_service.enforce_customer_limit(db, oid)

    customer = Customer(
        org_id=oid,
        customer_ref=_next_customer_ref(oid, db),
        customer_type=payload.customer_type,
        full_name=payload.full_name,
        date_of_birth=payload.date_of_birth,
        country_of_birth=payload.country_of_birth,
        nationality=payload.nationality,
        dual_nationality=payload.dual_nationality,
        country_of_residence=payload.country_of_residence,
        occupation=payload.occupation,
        employer_name=payload.employer_name,
        employer_address=payload.employer_address,
        tax_residency_country=payload.tax_residency_country,
        tax_identification_number=payload.tax_identification_number,
        fatca_applicable=payload.fatca_applicable,
        crs_applicable=payload.crs_applicable,
        email=str(payload.email) if payload.email else None,
        phone=payload.phone,
        address_line1=payload.address_line1,
        address_line2=payload.address_line2,
        city=payload.city,
        state=payload.state,
        postcode=payload.postcode,
        country=payload.country,
        mail_same_as_residential=payload.mail_same_as_residential,
        mail_address_line1=payload.mail_address_line1,
        mail_city=payload.mail_city,
        mail_state=payload.mail_state,
        mail_postcode=payload.mail_postcode,
        source_of_funds=payload.source_of_funds,
        source_of_wealth=payload.source_of_wealth,
        onboarding_channel=payload.onboarding_channel,
        introduced_by=payload.introduced_by,
        relationship_manager=payload.relationship_manager,
        is_reporting_group_member=payload.is_reporting_group_member,
        onboarded_by=current_user.id,
        status=CustomerStatus.draft,
        cdd_level=CDDLevel.standard,
        risk_level=RiskLevel.low,
        risk_score=0.0,
    )
    db.add(customer)
    db.flush()
    _create_checklist(customer, db)
    _record_risk_history(customer, "onboarding", current_user.id, db)

    db.add(
        AuditLog(
            org_id=oid,
            actor_id=current_user.id,
            event_type=AuditEventType.customer_created,
            action="customer.create",
            object_type="Customer",
            object_id=customer.id,
            new_value={
                "customer_ref": customer.customer_ref,
                "type": payload.customer_type.value,
            },
        )
    )
    db.commit()
    db.refresh(customer)

    from app.models.automation_rule import RuleEventType
    from app.services.automation_engine import (
        customer_context,
        evaluate_automation_rules,
    )

    evaluate_automation_rules(
        db,
        RuleEventType.customer_created,
        oid,
        "customer",
        customer.id,
        customer_context(customer),
        triggered_by=current_user.id,
    )

    add_background_task(
        background_tasks,
        dispatch_event_background,
        "customer.created",
        {
            "customer_id": customer.id,
            "customer_ref": customer.customer_ref,
            "customer_type": payload.customer_type.value,
            "full_name": customer.full_name,
        },
        oid,
    )

    log.info("Customer created: %s org=%s", customer.customer_ref, oid)
    return customer


@router.get("", response_model=List[CustomerResponse])
def list_customers(
    status: Optional[CustomerStatus] = Query(None),
    search: Optional[str] = Query(
        None,
        description="Match against name or customer reference — bypasses the default draft/edd_required exclusion so pickers (e.g. ECDD) can find any applicant",
    ),
    risk_level: Optional[RiskLevel] = Query(None),
    customer_type: Optional[str] = Query(None),
    cdd_level: Optional[CDDLevel] = Query(None),
    is_pep: Optional[bool] = Query(None),
    due_for_review: bool = Query(False, description="next_review_date within 30 days"),
    pagination: Pagination = Depends(),
    current_user: User = Depends(require_analyst_or_above),
    db: Session = Depends(get_db),
):
    oid = org_id_for(current_user)
    q = db.query(Customer).filter(Customer.org_id == oid)
    if status:
        q = q.filter(Customer.status == status)
    elif not search:
        # Customers list = applicants who have passed KYC. Draft (not yet
        # screened) and edd_required (under enhanced review) stay out of the
        # default view until a reviewer clears them; pass an explicit
        # ?status= to see them.
        q = q.filter(
            Customer.status.notin_([CustomerStatus.draft, CustomerStatus.edd_required])
        )
    if search:
        like = f"%{search.strip()}%"
        q = q.filter(
            (Customer.full_name.ilike(like)) | (Customer.customer_ref.ilike(like))
        )
    if risk_level:
        q = q.filter(Customer.risk_level == risk_level)
    if customer_type:
        q = q.filter(Customer.customer_type == customer_type)
    if cdd_level:
        q = q.filter(Customer.cdd_level == cdd_level)
    if is_pep is not None:
        q = q.filter(Customer.is_pep == is_pep)
    if due_for_review:
        from datetime import timedelta

        cutoff = date.today() + timedelta(days=30)
        q = q.filter(
            Customer.next_review_date <= cutoff,
            Customer.status == CustomerStatus.active,
        )
    return pagination.apply(q.order_by(Customer.created_at.desc())).all()


@router.get("/{customer_id}", response_model=CustomerResponse)
def get_customer(
    customer_id: str,
    current_user: User = Depends(require_analyst_or_above),
    db: Session = Depends(get_db),
):
    return _get_customer(customer_id, org_id_for(current_user), db)


@router.patch("/{customer_id}", response_model=CustomerResponse)
def update_customer(
    customer_id: str,
    payload: CustomerUpdate,
    current_user: User = Depends(require_analyst_or_above),
    db: Session = Depends(get_db),
):
    customer = _get_customer(customer_id, org_id_for(current_user), db)

    if customer.status in (CustomerStatus.rejected, CustomerStatus.closed):
        raise HTTPException(422, f"Cannot edit a {customer.status.value} customer")

    for field, value in payload.model_dump(exclude_none=True).items():
        setattr(customer, field, value)

    db.add(
        AuditLog(
            org_id=customer.org_id,
            actor_id=current_user.id,
            event_type=AuditEventType.customer_updated,
            action="customer.update",
            object_type="Customer",
            object_id=customer.id,
            new_value={"fields": list(payload.model_dump(exclude_none=True).keys())},
        )
    )
    db.commit()
    db.refresh(customer)
    return customer


@router.post("/{customer_id}/status", response_model=CustomerResponse)
def update_customer_status(
    customer_id: str,
    payload: CustomerStatusUpdate,
    current_user: User = Depends(require_compliance_or_above),
    db: Session = Depends(get_db),
):
    customer = _get_customer(customer_id, org_id_for(current_user), db)

    # Enforce screening gate before activating. Fails closed: a missing checklist
    # row is treated as incomplete, not as "nothing to check" (a prior bug here let
    # activation through unconditionally if no checklist row existed for the
    # customer).
    if payload.status == CustomerStatus.active:
        chk = (
            db.query(CustomerOnboardingChecklist)
            .filter(CustomerOnboardingChecklist.customer_id == customer_id)
            .first()
        )
        if not chk or not (
            chk.pep_screened
            and chk.sanctions_screened
            and chk.identity_document_verified
        ):
            raise HTTPException(
                422,
                "Cannot activate: PEP screening, sanctions screening, and identity verification must be complete",
            )

        # Defense in depth: block activation if any screening record is sitting in
        # an unresolved hit state, independent of the checklist flags above.
        unresolved = (
            db.query(ScreeningRecord)
            .filter(
                ScreeningRecord.customer_id == customer_id,
                ScreeningRecord.status.in_(_SCREENING_BLOCKING_STATUSES),
            )
            .first()
        )
        if unresolved:
            raise HTTPException(
                422,
                "Cannot activate: customer has an unresolved screening match",
            )

    # EDD gate: enhanced CDD requires senior approval. Same fail-closed rule.
    if (
        customer.cdd_level == CDDLevel.enhanced
        and payload.status == CustomerStatus.active
    ):
        chk = (
            db.query(CustomerOnboardingChecklist)
            .filter(CustomerOnboardingChecklist.customer_id == customer_id)
            .first()
        )
        if not chk or not chk.edd_senior_approval_obtained:
            raise HTTPException(
                422, "EDD customers require senior approval before activation"
            )

    old_status = customer.status
    customer.status = payload.status

    db.add(
        AuditLog(
            org_id=customer.org_id,
            actor_id=current_user.id,
            event_type=AuditEventType.customer_status_changed,
            action="customer.status_change",
            object_type="Customer",
            object_id=customer.id,
            old_value={"status": old_status.value},
            new_value={"status": payload.status.value, "reason": payload.reason},
        )
    )
    db.commit()
    db.refresh(customer)
    return customer
