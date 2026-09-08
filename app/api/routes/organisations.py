"""
Phase B — Organisation, membership, and role/permission management API.
"""

from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.api.routes.auth import _current_user
from app.db.database import get_db
from app.models.organisation import (
    MembershipStatus,
    Organisation,
    OrganisationUser,
    Permission,
    Role,
)
from app.models.user import User
from app.schemas.aml_program import (
    AMLProgramResponse,
    AMLProgramVersionDetailResponse,
    AMLProgramVersionListResponse,
    AMLProgramVersionResponse,
    ExportRequest,
    ProgramHealthResponse,
)
from app.schemas.organisation import (
    MemberAdd,
    MemberResponse,
    MemberUpdate,
    OrganisationCreate,
    OrganisationResponse,
    OrganisationUpdate,
    PermissionResponse,
    RoleResponse,
)
from app.schemas.risk_assessment import (
    AccountabilityAckRequest,
    AccountabilityAckResponse,
    RiskAssessmentResponse,
)
from app.services import (
    aml_program_service,
    audit_service,
    billing_service,
    program_retention_service,
    risk_assessment_service,
)
from app.services.auth_service import get_user_by_email
from app.services.org_service import (
    SYSTEM_ROLE_TEMPLATES,
    add_user_to_organisation,
    create_organisation,
    get_membership,
    get_system_role,
    get_user_organisations,
    has_org_permission,
)

router = APIRouter(prefix="/organisations", tags=["Organisations"])


def _get_org_or_404(db: Session, org_id: str) -> Organisation:
    org = db.query(Organisation).filter(Organisation.id == org_id).first()
    if not org:
        raise HTTPException(404, "Organisation not found")
    return org


def _require_member(db: Session, org: Organisation, user: User) -> OrganisationUser:
    if user.is_super_admin:
        return None
    membership = get_membership(db, org.id, user.id)
    if not membership or membership.status != MembershipStatus.active:
        raise HTTPException(403, "Not a member of this organisation")
    return membership


def _require_permission(db: Session, org: Organisation, user: User, permission: str):
    if not has_org_permission(db, user, org.id, permission):
        raise HTTPException(403, f"Requires permission: {permission}")


def _role_key_for(role: Role) -> str:
    if role.role_id.startswith("ROLE-SYS-"):
        return role.role_id.removeprefix("ROLE-SYS-").lower()
    return role.role_id


# ── Organisations ────────────────────────────────────────────────────────────


@router.post("", response_model=OrganisationResponse, status_code=201)
def create(
    payload: OrganisationCreate,
    current_user: User = Depends(_current_user),
    db: Session = Depends(get_db),
):
    org = create_organisation(
        db, payload.name, current_user, industry_id=payload.industry_id
    )
    return org


@router.get("", response_model=list[OrganisationResponse])
def list_mine(
    current_user: User = Depends(_current_user), db: Session = Depends(get_db)
):
    if current_user.is_super_admin:
        return db.query(Organisation).all()
    return get_user_organisations(db, current_user)


@router.get("/{org_id}", response_model=OrganisationResponse)
def get_one(
    org_id: str,
    current_user: User = Depends(_current_user),
    db: Session = Depends(get_db),
):
    org = _get_org_or_404(db, org_id)
    _require_member(db, org, current_user)
    return org


@router.patch("/{org_id}", response_model=OrganisationResponse)
def update(
    org_id: str,
    payload: OrganisationUpdate,
    current_user: User = Depends(_current_user),
    db: Session = Depends(get_db),
):
    org = _get_org_or_404(db, org_id)
    _require_permission(db, org, current_user, "org:manage")
    updates = payload.model_dump(exclude_unset=True)
    before = {field: getattr(org, field) for field in updates}
    for field, val in updates.items():
        setattr(org, field, val)
    db.commit()
    db.refresh(org)
    if updates:
        audit_service.log_action(
            db,
            action="policy_updated",
            entity_type="organisation",
            entity_id=org.id,
            actor=current_user.email,
            actor_role=current_user.role.value if current_user.role else None,
            industry_id=org.industry_id,
            organisation_id=org.id,
            before_state=before,
            after_state=updates,
        )
    return org


# ── AML/CTF Program (Phase C self-service sign-up) ─────────────────────────────


def _program_response(db: Session, program) -> AMLProgramResponse:
    items = aml_program_service.get_program_items(db, program)
    plan = billing_service.current_plan(
        db, program.industry_id, program.organisation_id
    )
    full_enabled = billing_service.is_feature_enabled(db, plan, "full_aml_program")
    if full_enabled:
        return AMLProgramResponse(
            program_id=program.program_id,
            industry_id=program.industry_id,
            risk_profile=program.risk_profile,
            status=program.status,
            version=program.version,
            generated_at=program.generated_at,
            items=items,
        )
    return AMLProgramResponse(
        program_id=program.program_id,
        industry_id=program.industry_id,
        risk_profile=program.risk_profile,
        status=program.status,
        version=program.version,
        generated_at=program.generated_at,
        items=aml_program_service.to_preview_items(items),
        is_preview=True,
        total_items=len(items),
    )


@router.post(
    "/{org_id}/aml-program/generate", response_model=AMLProgramResponse, status_code=201
)
def generate_aml_program(
    org_id: str,
    current_user: User = Depends(_current_user),
    db: Session = Depends(get_db),
):
    org = _get_org_or_404(db, org_id)
    _require_permission(db, org, current_user, "org:manage")
    try:
        program = aml_program_service.generate_program(db, org)
    except ValueError as e:
        raise HTTPException(400, str(e))
    return _program_response(db, program)


@router.get("/{org_id}/aml-program", response_model=AMLProgramResponse)
def get_aml_program(
    org_id: str,
    current_user: User = Depends(_current_user),
    db: Session = Depends(get_db),
):
    org = _get_org_or_404(db, org_id)
    _require_member(db, org, current_user)
    program = aml_program_service.get_program(db, org)
    if not program:
        raise HTTPException(404, "No AML program generated yet")
    return _program_response(db, program)


# ── Retention — version history, export, verification, health ──────────────


@router.get(
    "/{org_id}/aml-program/versions", response_model=AMLProgramVersionListResponse
)
def list_aml_program_versions(
    org_id: str,
    current_user: User = Depends(_current_user),
    db: Session = Depends(get_db),
):
    """Full version history for active subscribers; lapsed/canceled
    organisations see only the latest version's metadata."""
    org = _get_org_or_404(db, org_id)
    _require_permission(db, org, current_user, "org:manage")
    program = aml_program_service.get_program(db, org)
    if not program:
        raise HTTPException(404, "No AML program generated yet")

    versions = aml_program_service.list_versions(db, program)
    full_history = billing_service.is_active_subscriber(db, org.industry_id, org.id)
    if not full_history:
        versions = program_retention_service.latest_only(versions)

    return AMLProgramVersionListResponse(
        versions=[
            AMLProgramVersionResponse(
                version=v.version,
                generated_at=v.generated_at,
                item_count=v.item_count,
                content_hash=v.content_hash,
                qr_token=v.qr_token,
                is_current=(v.version == program.version),
            )
            for v in versions
        ],
        full_history_available=full_history,
    )


@router.get(
    "/{org_id}/aml-program/versions/{version}",
    response_model=AMLProgramVersionDetailResponse,
)
def get_aml_program_version(
    org_id: str,
    version: int,
    current_user: User = Depends(_current_user),
    db: Session = Depends(get_db),
):
    """Retrieve a specific version's full content. For active subscribers
    this is unrestricted; for lapsed organisations, retrieving anything
    other than the latest version goes through the throttled retention
    process (8-hour cooldown, capped at 3 lifetime retrievals)."""
    org = _get_org_or_404(db, org_id)
    _require_permission(db, org, current_user, "org:manage")
    program = aml_program_service.get_program(db, org)
    if not program:
        raise HTTPException(404, "No AML program generated yet")

    full_history = billing_service.is_active_subscriber(db, org.industry_id, org.id)
    if full_history or version == program.version:
        snapshot = aml_program_service.get_version(db, program, version)
        if not snapshot:
            raise HTTPException(404, "Version not found")
    else:
        try:
            snapshot = program_retention_service.request_old_version(
                db, org, program, version, current_user.email
            )
        except ValueError as e:
            raise HTTPException(404, str(e))
        except PermissionError as e:
            raise HTTPException(429, str(e))

    return AMLProgramVersionDetailResponse(
        version=snapshot.version,
        generated_at=snapshot.generated_at,
        item_count=snapshot.item_count,
        content_hash=snapshot.content_hash,
        qr_token=snapshot.qr_token,
        items=snapshot.items_snapshot,
    )


@router.post("/{org_id}/aml-program/export")
def export_aml_program(
    org_id: str,
    payload: ExportRequest,
    current_user: User = Depends(_current_user),
    db: Session = Depends(get_db),
):
    """Export the current AML program. Every export is logged with the
    requester's stated reason — if a customer can't produce this trail on
    request, that's itself a compliance gap they have to explain."""
    org = _get_org_or_404(db, org_id)
    _require_permission(db, org, current_user, "org:manage")
    if not payload.reason or not payload.reason.strip():
        raise HTTPException(400, "An export reason is required")

    program = aml_program_service.get_program(db, org)
    if not program:
        raise HTTPException(404, "No AML program generated yet")

    response = _program_response(db, program)

    audit_service.log_action(
        db,
        action="aml_program_exported",
        entity_type="aml_program",
        entity_id=program.program_id,
        actor=current_user.email,
        actor_role=current_user.role.value if current_user.role else None,
        industry_id=org.industry_id,
        organisation_id=org.id,
        notes=payload.reason,
        after_state={"version": program.version, "is_preview": response.is_preview},
    )
    return response


@router.get("/{org_id}/aml-program/health", response_model=ProgramHealthResponse)
def get_aml_program_health(
    org_id: str,
    current_user: User = Depends(_current_user),
    db: Session = Depends(get_db),
):
    """'Rev up' nudge — compares the live program against what the current
    template would generate, surfacing improvements available since the
    program was last regenerated."""
    org = _get_org_or_404(db, org_id)
    _require_member(db, org, current_user)
    program = aml_program_service.get_program(db, org)
    if not program:
        raise HTTPException(404, "No AML program generated yet")
    return ProgramHealthResponse(**aml_program_service.compute_health(db, program))


# ── Risk Assessment (Phase I onboarding) ────────────────────────────────────


def _risk_assessment_response(
    db: Session, org, assessment: dict
) -> RiskAssessmentResponse:
    plan = billing_service.current_plan(db, org.industry_id, org.id)
    full_enabled = billing_service.is_feature_enabled(db, plan, "full_risk_assessment")
    if full_enabled:
        return RiskAssessmentResponse(
            **assessment, generated_at=org.risk_assessment_generated_at
        )
    factors = assessment["factors"]
    return RiskAssessmentResponse(
        **{
            **assessment,
            "factors": risk_assessment_service.to_preview_factors(factors),
        },
        generated_at=org.risk_assessment_generated_at,
        is_preview=True,
        total_factors=len(factors),
    )


@router.post(
    "/{org_id}/risk-assessment/generate",
    response_model=RiskAssessmentResponse,
    status_code=201,
)
def generate_risk_assessment(
    org_id: str,
    current_user: User = Depends(_current_user),
    db: Session = Depends(get_db),
):
    org = _get_org_or_404(db, org_id)
    _require_permission(db, org, current_user, "org:manage")
    try:
        assessment = risk_assessment_service.generate_risk_assessment(db, org)
    except ValueError as e:
        raise HTTPException(400, str(e))
    return _risk_assessment_response(db, org, assessment)


@router.get("/{org_id}/risk-assessment", response_model=RiskAssessmentResponse)
def get_risk_assessment(
    org_id: str,
    current_user: User = Depends(_current_user),
    db: Session = Depends(get_db),
):
    org = _get_org_or_404(db, org_id)
    _require_member(db, org, current_user)
    assessment = risk_assessment_service.get_risk_assessment(org)
    if not assessment:
        raise HTTPException(404, "No risk assessment generated yet")
    return _risk_assessment_response(db, org, assessment)


RETENTION_TERMS_VERSION = "2026-06-18"


@router.post(
    "/{org_id}/aml-accountability/ack", response_model=AccountabilityAckResponse
)
def acknowledge_aml_accountability(
    org_id: str,
    payload: AccountabilityAckRequest,
    current_user: User = Depends(_current_user),
    db: Session = Depends(get_db),
):
    """The industry owner explicitly accepts accountability for the
    organisation's own AML/CTF program, and the retention/IP terms of use
    (Verigo owns the template engine and retains a permanent copy for
    record-keeping; the org gets a revocable license to its generated
    instance) — a single checkbox covers both, required to complete
    onboarding."""
    org = _get_org_or_404(db, org_id)
    _require_permission(db, org, current_user, "org:manage")
    if not payload.acknowledged:
        raise HTTPException(400, "Acknowledgement must be accepted to proceed")

    retention_accepted = (
        payload.retention_terms_accepted
        if payload.retention_terms_accepted is not None
        else payload.acknowledged
    )

    org.aml_accountability_ack = True
    org.aml_accountability_ack_at = datetime.now(timezone.utc)
    org.aml_accountability_ack_by = current_user.email
    org.retention_terms_accepted = retention_accepted
    org.retention_terms_accepted_at = (
        datetime.now(timezone.utc) if retention_accepted else None
    )
    org.retention_terms_accepted_by = current_user.email if retention_accepted else None
    org.retention_terms_version = (
        RETENTION_TERMS_VERSION if retention_accepted else None
    )
    db.commit()
    db.refresh(org)

    audit_service.log_action(
        db,
        action="aml_accountability_acknowledged",
        entity_type="organisation",
        entity_id=org.id,
        actor=current_user.email,
        actor_role=current_user.role.value if current_user.role else None,
        industry_id=org.industry_id,
        organisation_id=org.id,
        after_state={
            "aml_accountability_ack": True,
            "retention_terms_accepted": retention_accepted,
            "retention_terms_version": org.retention_terms_version,
        },
    )
    return AccountabilityAckResponse(
        aml_accountability_ack=org.aml_accountability_ack,
        aml_accountability_ack_at=org.aml_accountability_ack_at,
        aml_accountability_ack_by=org.aml_accountability_ack_by,
        retention_terms_accepted=org.retention_terms_accepted,
        retention_terms_accepted_at=org.retention_terms_accepted_at,
        retention_terms_version=org.retention_terms_version,
    )


# ── Members ──────────────────────────────────────────────────────────────────


def _member_response(db: Session, m: OrganisationUser) -> MemberResponse:
    user = db.query(User).filter(User.id == m.user_id).first()
    role = db.query(Role).filter(Role.id == m.role_id).first()
    return MemberResponse(
        user_id=user.id,
        email=user.email,
        full_name=user.full_name,
        role_key=_role_key_for(role),
        role_name=role.name,
        status=m.status,
        created_at=m.created_at,
    )


@router.get("/{org_id}/members", response_model=list[MemberResponse])
def list_members(
    org_id: str,
    current_user: User = Depends(_current_user),
    db: Session = Depends(get_db),
):
    org = _get_org_or_404(db, org_id)
    _require_member(db, org, current_user)
    members = (
        db.query(OrganisationUser)
        .filter(OrganisationUser.organisation_id == org.id)
        .all()
    )
    if not members:
        return []

    # Batch-load users/roles instead of two queries per member (N+1).
    user_ids = {m.user_id for m in members}
    role_ids = {m.role_id for m in members}
    users_by_id = {u.id: u for u in db.query(User).filter(User.id.in_(user_ids)).all()}
    roles_by_id = {r.id: r for r in db.query(Role).filter(Role.id.in_(role_ids)).all()}

    return [
        MemberResponse(
            user_id=users_by_id[m.user_id].id,
            email=users_by_id[m.user_id].email,
            full_name=users_by_id[m.user_id].full_name,
            role_key=_role_key_for(roles_by_id[m.role_id]),
            role_name=roles_by_id[m.role_id].name,
            status=m.status,
            created_at=m.created_at,
        )
        for m in members
    ]


@router.post("/{org_id}/members", response_model=MemberResponse, status_code=201)
def add_member(
    org_id: str,
    payload: MemberAdd,
    current_user: User = Depends(_current_user),
    db: Session = Depends(get_db),
):
    org = _get_org_or_404(db, org_id)
    _require_permission(db, org, current_user, "org:manage")
    target = get_user_by_email(db, payload.email)
    if not target:
        raise HTTPException(404, "No user with that email")
    if not get_system_role(db, payload.role_key):
        raise HTTPException(400, f"Unknown role: {payload.role_key}")
    membership = add_user_to_organisation(db, org, target, role_key=payload.role_key)
    return _member_response(db, membership)


@router.patch("/{org_id}/members/{user_id}", response_model=MemberResponse)
def update_member(
    org_id: str,
    user_id: str,
    payload: MemberUpdate,
    current_user: User = Depends(_current_user),
    db: Session = Depends(get_db),
):
    org = _get_org_or_404(db, org_id)
    _require_permission(db, org, current_user, "org:manage")
    target = db.query(User).filter(User.id == user_id).first()
    if not target:
        raise HTTPException(404, "User not found")
    membership = get_membership(db, org.id, target.id)
    if not membership:
        raise HTTPException(404, "User is not a member of this organisation")

    if payload.role_key:
        role = get_system_role(db, payload.role_key)
        if not role:
            raise HTTPException(400, f"Unknown role: {payload.role_key}")
        membership.role_id = role.id
    if payload.status:
        membership.status = payload.status
    db.commit()
    db.refresh(membership)
    return _member_response(db, membership)


@router.delete("/{org_id}/members/{user_id}", status_code=204)
def remove_member(
    org_id: str,
    user_id: str,
    current_user: User = Depends(_current_user),
    db: Session = Depends(get_db),
):
    org = _get_org_or_404(db, org_id)
    _require_permission(db, org, current_user, "org:manage")
    target = db.query(User).filter(User.id == user_id).first()
    if not target:
        raise HTTPException(404, "User not found")
    membership = get_membership(db, org.id, target.id)
    if not membership:
        raise HTTPException(404, "User is not a member of this organisation")
    db.delete(membership)
    db.commit()


# ── Roles & permissions ─────────────────────────────────────────────────────


@router.get("/{org_id}/roles", response_model=list[RoleResponse])
def list_roles(
    org_id: str,
    current_user: User = Depends(_current_user),
    db: Session = Depends(get_db),
):
    org = _get_org_or_404(db, org_id)
    _require_member(db, org, current_user)
    roles = (
        db.query(Role)
        .filter((Role.organisation_id.is_(None)) | (Role.organisation_id == org.id))
        .all()
    )
    return [
        RoleResponse(
            role_id=_role_key_for(r),
            name=r.name,
            description=r.description,
            is_system=r.is_system,
            organisation_id=r.organisation_id,
            permissions=sorted(p.code for p in r.permissions),
        )
        for r in roles
    ]


@router.get("/roles/templates", response_model=list[str])
def list_role_templates():
    return list(SYSTEM_ROLE_TEMPLATES.keys())


@router.get("/permissions/catalog", response_model=list[PermissionResponse])
def list_permissions(db: Session = Depends(get_db)):
    return db.query(Permission).order_by(Permission.code).all()
