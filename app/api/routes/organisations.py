"""
Phase B — Organisation, membership, and role/permission management API.
"""

import html as html_escape_module
import urllib.parse
from datetime import datetime, timedelta, timezone

from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import HTMLResponse
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
    AMLProgramItemResponse,
    AMLProgramResponse,
    AMLProgramVersionDetailResponse,
    AMLProgramVersionListResponse,
    AMLProgramVersionResponse,
    ExportRequest,
    ProgramHealthResponse,
)
from app.schemas.organisation import (
    IndustrySelectRequest,
    MemberAdd,
    MemberResponse,
    MemberUpdate,
    OrganisationCreate,
    OrganisationResponse,
    OrganisationUpdate,
    PermissionResponse,
    RoleResponse,
    TransferOwnershipRequest,
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
    IndustryLockedError,
    add_user_to_organisation,
    count_active_owners,
    create_organisation,
    get_membership,
    get_system_role,
    get_user_organisations,
    has_org_permission,
)
from app.services.org_service import select_industry as _select_industry_service

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
    billing_service.enforce_org_creation_limit(db, current_user)
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


@router.post("/{org_id}/select-industry", response_model=OrganisationResponse)
def select_industry(
    org_id: str,
    payload: IndustrySelectRequest,
    current_user: User = Depends(_current_user),
    db: Session = Depends(get_db),
):
    """
    Stage 7: let the org actually pick its AUSTRAC industry — every org is
    created as IndustryType.other (nothing upstream of this knows the real
    one), so this re-seeds the AML/CTF Program and Risk Framework from the
    correct industry template. Only allowed before anything's been
    customised (see org_service.select_industry's docstring).
    """
    org = _get_org_or_404(db, org_id)
    _require_permission(db, org, current_user, "org:manage")
    before_industry = org.industry_type
    try:
        _select_industry_service(db, org, payload.industry_type, current_user.id)
    except IndustryLockedError as e:
        raise HTTPException(409, str(e))
    db.commit()
    db.refresh(org)
    if before_industry != org.industry_type:
        audit_service.log_action(
            db,
            action="policy_updated",
            entity_type="organisation",
            entity_id=org.id,
            actor=current_user.email,
            actor_role=current_user.role.value if current_user.role else None,
            industry_id=org.industry_id,
            organisation_id=org.id,
            before_state={"industry_type": before_industry.value},
            after_state={"industry_type": org.industry_type.value},
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
            items=[AMLProgramItemResponse.model_validate(i) for i in items],
        )
    return AMLProgramResponse(
        program_id=program.program_id,
        industry_id=program.industry_id,
        risk_profile=program.risk_profile,
        status=program.status,
        version=program.version,
        generated_at=program.generated_at,
        items=[
            AMLProgramItemResponse.model_validate(i)
            for i in aml_program_service.to_preview_items(items)
        ],
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


_WATERMARK_TEXT = "DRAFT — NOT VALID FOR AUSTRAC PURPOSES"
_UNCONTROLLED_FOOTER = (
    "PRINTED COPY — UNCONTROLLED, NOT VALID FOR REGULATORY PURPOSES; "
    "REFER TO THE PLATFORM FOR THE CURRENT VERSION"
)


@router.get("/{org_id}/aml-program/export-html", response_class=HTMLResponse)
def export_aml_program_html(
    org_id: str,
    reason: str,
    current_user: User = Depends(_current_user),
    db: Session = Depends(get_db),
):
    """
    Document-shaped export of the current AML program, suitable for saving
    or printing to PDF from the browser.

    Document-control policy (decided 2026-09-14, see the Monetisation
    Playbook artifact):
      - Unpaid/preview orgs get a dense, OCR-resistant tiled watermark
        across every page; paid orgs get a clean export.
      - Every export (paid or unpaid) is stamped with a 1-year validity
        date computed from the moment of THIS download, not from when the
        program was generated -- a document that sits unopened on the
        platform stays current, but a copy someone actually took has a
        visible use-by date.
      - Printing is blocked by default via @media print; the one thing
        that still renders on a print attempt is a full-page notice that
        any printed copy is uncontrolled and not valid for regulatory
        purposes, so a printed page can never be mistaken for the
        authoritative, current record.
    """
    org = _get_org_or_404(db, org_id)
    _require_permission(db, org, current_user, "org:manage")
    if not reason or not reason.strip():
        raise HTTPException(400, "An export reason is required")

    program = aml_program_service.get_program(db, org)
    if not program:
        raise HTTPException(404, "No AML program generated yet")

    items = aml_program_service.get_program_items(db, program)
    plan = billing_service.current_plan(
        db, program.industry_id, program.organisation_id
    )
    full_enabled = billing_service.is_feature_enabled(db, plan, "full_aml_program")

    downloaded_at = datetime.now(timezone.utc)
    expires_at = downloaded_at + timedelta(days=365)

    audit_service.log_action(
        db,
        action="aml_program_export_html_downloaded",
        entity_type="aml_program",
        entity_id=program.program_id,
        actor=current_user.email,
        actor_role=current_user.role.value if current_user.role else None,
        industry_id=org.industry_id,
        organisation_id=org.id,
        notes=reason,
        after_state={
            "version": program.version,
            "is_preview": not full_enabled,
            "downloaded_at": downloaded_at.isoformat(),
            "expires_at": expires_at.isoformat(),
        },
    )

    if full_enabled:
        rows = [
            {
                "category": i.category,
                "title": i.title,
                "description": i.description,
                "review_frequency": i.review_frequency,
                "is_required": i.is_required,
                "locked": False,
            }
            for i in items
        ]
    else:
        rows = aml_program_service.to_preview_items(items)

    def _row(item: dict) -> str:
        title = html_escape_module.escape(item["title"] or "")
        if item["locked"]:
            return (
                f'<tr class="locked"><td>{html_escape_module.escape(item["category"])}</td>'
                f'<td colspan="3"><em>{title} — upgrade to unlock this section</em></td></tr>'
            )
        description = html_escape_module.escape(item["description"] or "")
        freq = html_escape_module.escape(item["review_frequency"] or "—")
        required = "Required" if item["is_required"] else "Optional"
        return (
            f"<tr><td>{html_escape_module.escape(item['category'])}</td>"
            f"<td>{title}</td><td>{description}</td><td>{freq}</td><td>{required}</td></tr>"
        )

    rows_html = "".join(_row(r) for r in rows)
    org_name = html_escape_module.escape(org.name or "")

    watermark_html = ""
    if not full_enabled:
        # A small tile, repeated by the browser's own background-repeat
        # rather than one giant overlay -- the tile boundary runs straight
        # through glyph strokes wherever it lands on the underlying text, so
        # a screenshot-then-OCR pass sees the watermark's own strokes
        # interleaved with the page's, not clean isolated text either OCR
        # engine could confidently separate out. Encoded as a data: URI
        # rather than referenced by DOM id (url(#id)) -- the latter is
        # unreliable as a CSS background across browsers for inline SVG.
        tile_svg = (
            '<svg xmlns="http://www.w3.org/2000/svg" width="240" height="100">'
            '<text x="-20" y="55" font-family="monospace" font-size="15" '
            'fill="#b00020" fill-opacity="0.25" '
            f'transform="rotate(-30 120 50)">{_WATERMARK_TEXT}</text>'
            "</svg>"
        )
        tile_data_uri = "data:image/svg+xml," + urllib.parse.quote(tile_svg)
        watermark_html = (
            '<div class="watermark" aria-hidden="true" '
            f"style=\"background-image:url('{tile_data_uri}')\"></div>"
        )

    html = f"""<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>AML/CTF Program — {org_name}</title>
<style>
  * {{ box-sizing: border-box; margin: 0; padding: 0; }}
  body {{ font-family: 'Segoe UI', Arial, sans-serif; font-size: 11pt; color: #1a1a2e; background: #fff; line-height: 1.5; position: relative; }}
  .watermark {{ position: fixed; inset: 0; background-repeat: repeat; pointer-events: none; z-index: 9999; }}
  .cover {{ background: linear-gradient(135deg, #0f3460 0%, #16213e 100%); color: #fff; padding: 48px; }}
  .cover h1 {{ font-size: 22pt; font-weight: 700; margin-bottom: 8px; }}
  .cover .meta {{ font-size: 10pt; opacity: 0.8; margin-top: 10px; }}
  .badge {{ display: inline-block; padding: 2px 10px; border-radius: 3px; font-size: 9pt; font-weight: 700; letter-spacing: 1px; margin-top: 10px; }}
  .badge.draft {{ background: #b00020; color: #fff; }}
  .badge.final {{ background: #16a34a; color: #fff; }}
  .validity {{ font-size: 9.5pt; opacity: 0.85; margin-top: 10px; }}
  .content {{ padding: 32px 48px; }}
  table {{ width: 100%; border-collapse: collapse; margin: 12px 0; font-size: 9.5pt; }}
  th {{ background: #0f3460; color: #fff; padding: 7px 10px; text-align: left; font-weight: 600; }}
  td {{ padding: 6px 10px; border-bottom: 1px solid #e8e8e8; vertical-align: top; }}
  tr.locked td {{ color: #888; background: #f7f7f7; }}
  .disclaimer {{ font-size: 8pt; color: #888; border-top: 1px solid #e0e0e0; padding-top: 12px; margin-top: 40px; font-style: italic; }}

  /* Printing is disabled: on a print attempt, every real section is hidden
     and only a full-page uncontrolled-copy notice renders, so a printed
     page (or "print to PDF") can never carry the actual program content
     or be mistaken for the current, authoritative record. */
  .print-block-notice {{ display: none; }}
  @media print {{
    .watermark, .cover, .content {{ display: none !important; }}
    .print-block-notice {{
      display: block !important;
      padding: 96px 48px;
      font-family: 'Segoe UI', Arial, sans-serif;
      text-align: center;
    }}
    .print-block-notice h1 {{ font-size: 20pt; color: #b00020; margin-bottom: 16px; }}
    .print-block-notice p {{ font-size: 12pt; color: #1a1a2e; }}
  }}
</style>
</head>
<body>
{watermark_html}
<div class="print-block-notice">
  <h1>Printing disabled</h1>
  <p>{_UNCONTROLLED_FOOTER}</p>
  <p>Sign in to the platform to view the current version.</p>
</div>
<div class="cover">
  <span class="badge {"final" if full_enabled else "draft"}">{"CURRENT" if full_enabled else _WATERMARK_TEXT}</span>
  <h1>AML/CTF Program — {org_name}</h1>
  <div class="meta">Version {program.version} &middot; Generated {program.generated_at}</div>
  <div class="validity">This export is valid until {expires_at.date().isoformat()} (1 year from download).
  After this date, re-export from the platform for the current version.</div>
</div>
<div class="content">
  <table>
    <thead><tr><th>Category</th><th>Control</th><th>Description</th><th>Review frequency</th><th>Status</th></tr></thead>
    <tbody>{rows_html}</tbody>
  </table>
  <div class="disclaimer">
    Exported {downloaded_at.date().isoformat()} &middot; This document is a point-in-time export.
    Regenerate from the platform for the current, authoritative version.
  </div>
</div>
</body>
</html>"""
    return HTMLResponse(content=html)


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
    billing_service.enforce_user_limit(db, org.id, org.industry_id)
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

    current_role = db.query(Role).filter(Role.id == membership.role_id).first()
    is_sole_owner = (
        current_role
        and _role_key_for(current_role) == "owner"
        and count_active_owners(db, org.id) <= 1
    )

    if payload.role_key:
        role = get_system_role(db, payload.role_key)
        if not role:
            raise HTTPException(400, f"Unknown role: {payload.role_key}")
        if is_sole_owner and _role_key_for(role) != "owner":
            raise HTTPException(
                409,
                "Cannot change this member's role — they are the "
                "organisation's only owner. Use POST "
                f"/organisations/{org_id}/transfer-ownership to hand "
                "ownership to another member first.",
            )
        membership.role_id = role.id
    if payload.status and payload.status != MembershipStatus.active:
        if is_sole_owner:
            raise HTTPException(
                409,
                "Cannot suspend this member — they are the organisation's "
                "only owner. Use POST "
                f"/organisations/{org_id}/transfer-ownership to hand "
                "ownership to another member first.",
            )
        membership.status = payload.status
    elif payload.status:
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

    role = db.query(Role).filter(Role.id == membership.role_id).first()
    if role and _role_key_for(role) == "owner" and count_active_owners(db, org.id) <= 1:
        raise HTTPException(
            409,
            "Cannot remove this member — they are the organisation's "
            "only owner. Use POST "
            f"/organisations/{org_id}/transfer-ownership to hand "
            "ownership to another member first.",
        )

    db.delete(membership)
    db.commit()


@router.post("/{org_id}/transfer-ownership", response_model=MemberResponse)
def transfer_ownership(
    org_id: str,
    payload: TransferOwnershipRequest,
    current_user: User = Depends(_current_user),
    db: Session = Depends(get_db),
):
    """
    Hand "owner" to another active member of the organisation, demoting the
    caller to "admin" (they keep full org access, just not the sole-owner
    protections below). Only the CURRENT owner may initiate a transfer —
    unlike ordinary role changes, this isn't available to "admin" members
    even though they otherwise hold the same permissions, since ownership
    transfer is a deliberate handover, not routine member management.
    """
    org = _get_org_or_404(db, org_id)
    caller_membership = get_membership(db, org.id, current_user.id)
    if not caller_membership:
        raise HTTPException(403, "Not a member of this organisation")
    caller_role = db.query(Role).filter(Role.id == caller_membership.role_id).first()
    if not current_user.is_super_admin and (
        not caller_role or _role_key_for(caller_role) != "owner"
    ):
        raise HTTPException(403, "Only the current owner can transfer ownership")

    if payload.new_owner_user_id == current_user.id:
        raise HTTPException(400, "You are already the owner")

    new_owner_membership = get_membership(db, org.id, payload.new_owner_user_id)
    if (
        not new_owner_membership
        or new_owner_membership.status != MembershipStatus.active
    ):
        raise HTTPException(
            404, "New owner must be an active member of this organisation"
        )

    owner_role = get_system_role(db, "owner")
    admin_role = get_system_role(db, "admin")
    if not owner_role or not admin_role:
        raise HTTPException(500, "Owner/admin system roles are not seeded")

    new_owner_membership.role_id = owner_role.id
    caller_membership.role_id = admin_role.id
    db.commit()
    db.refresh(new_owner_membership)

    audit_service.log_action(
        db,
        action="organisation_ownership_transferred",
        entity_type="organisation",
        entity_id=org.id,
        actor=current_user.email,
        actor_role=current_user.role.value if current_user.role else None,
        organisation_id=org.id,
        notes=f"Ownership transferred to user_id={payload.new_owner_user_id}",
    )
    return _member_response(db, new_owner_membership)


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
