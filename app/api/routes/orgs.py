"""
Organisation API — onboarding wizard, CRUD, and AML Solution seeding.

Step 1-4 of the user journey:
  POST /orgs/onboard  — full wizard: create Org + User + AML Solution in one transaction
  POST /orgs          — create org only (admin)
  GET  /orgs/me       — current user's org
  PATCH /orgs/me      — update org details
  GET  /orgs/:id      — admin: any org
"""

import logging
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session

from app.api.deps import (
    Pagination,
    get_current_user,
    org_id_for,
    require_admin,
    require_compliance_or_above,
)
from app.db.database import get_db
from app.models.organisation import (
    CUSTOM_PACKAGE_INDUSTRIES,
    Organisation,
    OrganisationStatus,
)
from app.models.user import User, UserRole, UserStatus
from app.schemas.org import OrgOnboardRequest, OrgResponse, OrgUpdate
from app.services.auth_service import hash_password

log = logging.getLogger("verigo.api.orgs")
router = APIRouter(prefix="/orgs", tags=["Organisations"])


# ── Onboarding wizard (Steps 1-4) ─────────────────────────────────────────────


@router.post("/onboard", status_code=201, summary="Full signup wizard (Steps 1-4)")
def onboard(payload: OrgOnboardRequest, db: Session = Depends(get_db)):
    """
    Creates Organisation + admin User + AML Solution in a single transaction.
    Called from the self-serve signup flow.

    Custom-package industries (banking, casinos, etc.) are rejected here
    — the frontend should redirect them before this endpoint is called.
    """

    if payload.industry_type in CUSTOM_PACKAGE_INDUSTRIES:
        raise HTTPException(
            status_code=422,
            detail=(
                f"Industry '{payload.industry_type.value}' requires a custom package. "
                "Please contact Verigo sales."
            ),
        )

    if payload.abn:
        existing = (
            db.query(Organisation).filter(Organisation.abn == payload.abn).first()
        )
        if existing:
            raise HTTPException(400, "An organisation with this ABN already exists")

    if db.query(User).filter(User.email == payload.admin_email).first():
        raise HTTPException(400, "Email already registered")

    # ── Create Organisation ───────────────────────────────────────────────────
    org = Organisation(
        name=payload.name,
        trading_name=payload.trading_name,
        abn=payload.abn,
        acn=payload.acn,
        industry_type=payload.industry_type,
        contact_email=str(payload.contact_email),
        address_line1=payload.address_line1,
        city=payload.city,
        state=payload.state,
        postcode=payload.postcode,
        status=OrganisationStatus.active,
    )
    db.add(org)
    db.flush()

    # ── Create admin User ─────────────────────────────────────────────────────
    admin = User(
        email=str(payload.admin_email),
        full_name=payload.admin_full_name,
        hashed_password=hash_password(payload.admin_password),
        role=UserRole.admin,
        status=UserStatus.active,
        org_id=org.id,
    )
    db.add(admin)
    db.flush()

    # ── Seed AML Solution (Steps 5-9 templates) ───────────────────────────────
    from app.templates.aml.factory import seed_aml_solution
    from app.templates.risk.factory import seed_risk_framework

    solution = seed_aml_solution(
        db=db,
        org=org,
        created_by=admin.id,
        risk_level=payload.risk_level,
    )
    db.flush()

    seed_risk_framework(
        db=db,
        org=org,
        solution_id=solution.id,
        created_by=admin.id,
    )

    db.commit()

    log.info(
        "Onboarded org=%s industry=%s risk=%s admin=%s",
        org.id,
        org.industry_type.value,
        payload.risk_level,
        admin.id,
    )

    return {
        "org_id": org.id,
        "solution_id": solution.id,
        "admin_user_id": admin.id,
        "industry_type": org.industry_type.value,
        "risk_level": payload.risk_level,
        "message": "Organisation onboarded. Proceed to login to complete program setup.",
    }


# ── Current user's org ────────────────────────────────────────────────────────


@router.get("/me", response_model=OrgResponse)
def get_my_org(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    org = (
        db.query(Organisation)
        .filter(Organisation.id == org_id_for(current_user))
        .first()
    )
    if not org:
        raise HTTPException(404, "Organisation not found")
    return org


@router.patch("/me", response_model=OrgResponse)
def update_my_org(
    payload: OrgUpdate,
    current_user: User = Depends(require_compliance_or_above),
    db: Session = Depends(get_db),
):
    org = (
        db.query(Organisation)
        .filter(Organisation.id == org_id_for(current_user))
        .first()
    )
    if not org:
        raise HTTPException(404, "Organisation not found")

    for field, value in payload.model_dump(exclude_none=True).items():
        setattr(org, field, value)

    db.commit()
    db.refresh(org)
    return org


# ── Admin: any org ────────────────────────────────────────────────────────────


@router.get("", response_model=list[OrgResponse])
def list_orgs(
    status: Optional[OrganisationStatus] = Query(None),
    industry_type: Optional[str] = Query(None),
    pagination: Pagination = Depends(),
    current_user: User = Depends(require_admin),
    db: Session = Depends(get_db),
):
    q = db.query(Organisation)
    if status:
        q = q.filter(Organisation.status == status)
    if industry_type:
        q = q.filter(Organisation.industry_type == industry_type)
    return pagination.apply(q.order_by(Organisation.created_at.desc())).all()


@router.get("/{org_id}", response_model=OrgResponse)
def get_org(
    org_id: str,
    current_user: User = Depends(require_admin),
    db: Session = Depends(get_db),
):
    org = db.query(Organisation).filter(Organisation.id == org_id).first()
    if not org:
        raise HTTPException(404, "Organisation not found")
    return org


@router.patch("/{org_id}/status")
def set_org_status(
    org_id: str,
    status: OrganisationStatus,
    current_user: User = Depends(require_admin),
    db: Session = Depends(get_db),
):
    org = db.query(Organisation).filter(Organisation.id == org_id).first()
    if not org:
        raise HTTPException(404, "Organisation not found")
    org.status = status
    db.commit()
    return {"org_id": org_id, "status": status}
