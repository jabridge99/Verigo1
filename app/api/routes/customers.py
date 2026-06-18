"""
Customers API — SECURITY HARDENED.
Fixes: authentication required on all endpoints, RBAC on sensitive actions,
tenant isolation enforced, risk_score/risk_level/is_pep non-user-updatable,
status changes restricted to privileged roles.
"""

import uuid
from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session

from app.api.routes.auth import _current_user, _require_roles
from app.db.database import get_db
from app.models.customer import Customer, CustomerStatus
from app.models.user import User, UserRole
from app.schemas.customer import CustomerCreate, CustomerResponse, CustomerUpdate
from app.services import audit_service
from app.services.risk_scoring import score_customer, score_to_level
from app.services.sanctions_screening import screen_name
from app.services.tenant_scope import assert_tenant, scope_fields, scope_query

_RISK_FIELDS = {"risk_score", "risk_level", "status"}


def _log_customer_action(db, current_user, customer, action, before=None, after=None):
    audit_service.log_action(
        db,
        action=action,
        entity_type="customer",
        entity_id=customer.customer_id,
        actor=current_user.email,
        actor_role=current_user.role.value if current_user.role else None,
        industry_id=customer.industry_id,
        organisation_id=customer.organisation_id,
        before_state=before,
        after_state=after,
    )

router = APIRouter(prefix="/customers", tags=["Customers"])

# Fields that only compliance/admin/mlro may set
_PRIVILEGED_FIELDS = {"status", "risk_score", "risk_level", "is_pep"}
_PRIVILEGED_ROLES = {UserRole.admin, UserRole.mlro, UserRole.compliance}


def _assert_tenant(current_user: User, customer: Customer):
    assert_tenant(current_user, customer.organisation_id, customer.industry_id)


@router.post("/", response_model=CustomerResponse, status_code=201)
def onboard_customer(
    payload: CustomerCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(
        _require_roles(
            UserRole.admin, UserRole.mlro, UserRole.compliance, UserRole.analyst
        )
    ),
):
    existing = db.query(Customer).filter(Customer.email == payload.email).first()
    if existing:
        raise HTTPException(400, "Customer with this email already exists")

    customer = Customer(
        customer_id=f"CUST-{uuid.uuid4().hex[:10].upper()}",
        **scope_fields(current_user),
        **payload.model_dump(),
    )
    sanctions = screen_name(payload.full_name)
    if sanctions["match_found"]:
        customer.status = CustomerStatus.suspended
        customer.risk_score = 100.0
        customer.risk_level = "critical"
    else:
        risk_score = score_customer(customer)
        customer.risk_score = risk_score
        customer.risk_level = score_to_level(risk_score)
        customer.status = CustomerStatus.pending
    db.add(customer)
    db.commit()
    db.refresh(customer)
    _log_customer_action(
        db,
        current_user,
        customer,
        "customer_created",
        after={"status": customer.status, "risk_level": customer.risk_level},
    )
    return customer


@router.get("/", response_model=List[CustomerResponse])
def list_customers(
    skip: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=500),
    status: Optional[str] = None,
    risk_level: Optional[str] = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(_current_user),
):
    query = scope_query(db.query(Customer), Customer, current_user)
    if status:
        query = query.filter(Customer.status == status)
    if risk_level:
        query = query.filter(Customer.risk_level == risk_level)
    return query.offset(skip).limit(limit).all()


@router.get("/{customer_id}", response_model=CustomerResponse)
def get_customer(
    customer_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(_current_user),
):
    customer = db.query(Customer).filter(Customer.customer_id == customer_id).first()
    if not customer:
        raise HTTPException(404, "Customer not found")
    _assert_tenant(current_user, customer)
    return customer


@router.patch("/{customer_id}", response_model=CustomerResponse)
def update_customer(
    customer_id: str,
    payload: CustomerUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(_current_user),
):
    customer = db.query(Customer).filter(Customer.customer_id == customer_id).first()
    if not customer:
        raise HTTPException(404, "Customer not found")
    _assert_tenant(current_user, customer)

    updates = payload.model_dump(exclude_none=True)

    # Prevent unprivileged users from changing status or risk fields
    attempted_privileged = set(updates.keys()) & _PRIVILEGED_FIELDS
    if attempted_privileged and current_user.role not in _PRIVILEGED_ROLES:
        raise HTTPException(
            403, f"Insufficient role to update: {', '.join(attempted_privileged)}"
        )

    risk_fields_changed = set(updates.keys()) & _RISK_FIELDS
    before = {f: getattr(customer, f) for f in risk_fields_changed} if risk_fields_changed else None

    for field, value in updates.items():
        setattr(customer, field, value)
    db.commit()
    db.refresh(customer)

    if risk_fields_changed:
        _log_customer_action(
            db,
            current_user,
            customer,
            "risk_matrix_changed",
            before=before,
            after={f: getattr(customer, f) for f in risk_fields_changed},
        )
    return customer


@router.post("/{customer_id}/rescore")
def rescore_customer(
    customer_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(
        _require_roles(UserRole.admin, UserRole.mlro, UserRole.compliance)
    ),
):
    """Re-run risk scoring and sanctions check for a customer."""
    customer = db.query(Customer).filter(Customer.customer_id == customer_id).first()
    if not customer:
        raise HTTPException(404, "Customer not found")
    _assert_tenant(current_user, customer)

    before = {
        "status": customer.status,
        "risk_score": customer.risk_score,
        "risk_level": customer.risk_level,
    }

    sanctions = screen_name(customer.full_name)
    if sanctions["match_found"]:
        customer.status = CustomerStatus.suspended
        customer.risk_score = 100.0
        customer.risk_level = "critical"
    else:
        risk_score = score_customer(customer)
        customer.risk_score = risk_score
        customer.risk_level = score_to_level(risk_score)
    db.commit()
    db.refresh(customer)
    _log_customer_action(
        db,
        current_user,
        customer,
        "risk_matrix_changed",
        before=before,
        after={
            "status": customer.status,
            "risk_score": customer.risk_score,
            "risk_level": customer.risk_level,
        },
    )
    return {
        "customer_id": customer.customer_id,
        "risk_score": customer.risk_score,
        "risk_level": customer.risk_level,
        "status": customer.status,
        "sanctions_match": sanctions["match_found"],
    }
