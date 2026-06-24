"""
Governance Policy API — full lifecycle management.

Lifecycle:    draft → internal_review → compliance_review → pending_approval
              → published → periodic_review → superseded | archived

Version control: every publish creates an immutable PolicyVersion snapshot.
Audit trail:     every status transition creates an immutable PolicyWorkflowEvent.
"""

import html
import logging
from datetime import date, datetime, timezone
from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from fastapi.responses import HTMLResponse
from sqlalchemy.orm import Session

from app.api.deps import (
    Pagination,
    get_current_user,
    org_id_for,
    require_compliance_or_above,
)
from app.db.database import get_db
from app.models.audit_log import AuditLog
from app.models.governance import (
    ALLOWED_TRANSITIONS,
    POLICY_NUMBER_PREFIX,
    Policy,
    PolicyAttestation,
    PolicyLifecycleStatus,
    PolicyReviewReminder,
    PolicyType,
    PolicyVersion,
    PolicyWorkflowEvent,
    ReminderType,
)
from app.models.user import User
from app.schemas.governance import (
    AttestationCreate,
    AttestationResponse,
    PolicyCreate,
    PolicyResponse,
    PolicyUpdate,
    PolicyVersionResponse,
    PolicyWorkflowAction,
)

log = logging.getLogger("verigo.api.governance.policies")
router = APIRouter(prefix="/governance/policies", tags=["Governance — Policies"])

DISCLAIMER = (
    "This platform provides governance and compliance management tools only. "
    "All AML/CTF decisions, policies, controls, ratings, assessments, and "
    "conclusions remain the responsibility of the reporting entity."
)


def _get_policy(policy_id: str, org_id: str, db: Session) -> Policy:
    p = db.query(Policy).filter(Policy.id == policy_id, Policy.org_id == org_id).first()
    if not p:
        raise HTTPException(404, "Policy not found")
    return p


def _next_policy_number(policy_type: PolicyType, org_id: str, db: Session) -> str:
    prefix = POLICY_NUMBER_PREFIX.get(policy_type, "GOV")
    count = (
        db.query(Policy)
        .filter(
            Policy.org_id == org_id,
            Policy.policy_type == policy_type,
        )
        .count()
    )
    return f"{prefix}-{str(count + 1).zfill(3)}"


def _create_workflow_event(
    policy: Policy,
    from_status: PolicyLifecycleStatus,
    to_status: PolicyLifecycleStatus,
    action: str,
    actor_id: str,
    comments: Optional[str],
    db: Session,
) -> None:
    db.add(
        PolicyWorkflowEvent(
            policy_id=policy.id,
            org_id=policy.org_id,
            from_status=from_status,
            to_status=to_status,
            action=action,
            actor_id=actor_id,
            comments=comments,
            version_at_event=policy.version_string,
            occurred_at=datetime.now(timezone.utc),
        )
    )


def _create_version_snapshot(
    policy: Policy,
    change_type: str,
    change_summary: Optional[str],
    actor_id: str,
    db: Session,
) -> None:
    db.add(
        PolicyVersion(
            policy_id=policy.id,
            org_id=policy.org_id,
            version_major=policy.version_major,
            version_minor=policy.version_minor,
            version_label=policy.version_string,
            title=policy.title,
            content=policy.content,
            summary=policy.summary,
            scope=policy.scope,
            attachments=policy.attachments or [],
            approved_by=policy.approver,
            approved_at=datetime.now(timezone.utc),
            effective_date=policy.effective_date,
            review_due_date=policy.review_due_date,
            change_type=change_type,
            change_summary=change_summary,
            created_by=actor_id,
        )
    )


def _schedule_reminders(policy: Policy, db: Session) -> None:
    """Create review reminder records for 60/30/14/7 days before review_due_date."""
    if not policy.review_due_date:
        return
    from datetime import timedelta

    for reminder_type, days_before in [
        (ReminderType.sixty_day, 60),
        (ReminderType.thirty_day, 30),
        (ReminderType.fourteen_day, 14),
        (ReminderType.seven_day, 7),
    ]:
        scheduled = policy.review_due_date - timedelta(days=days_before)
        if scheduled >= date.today():
            db.add(
                PolicyReviewReminder(
                    policy_id=policy.id,
                    org_id=policy.org_id,
                    reminder_type=reminder_type,
                    scheduled_date=scheduled,
                    review_due_date=policy.review_due_date,
                    recipient_ids=[
                        p
                        for p in [
                            policy.document_owner,
                            policy.compliance_reviewer,
                            policy.approver,
                        ]
                        if p
                    ],
                )
            )


# ── CRUD ──────────────────────────────────────────────────────────────────────


@router.post("", response_model=PolicyResponse, status_code=201)
def create_policy(
    payload: PolicyCreate,
    current_user: User = Depends(require_compliance_or_above),
    db: Session = Depends(get_db),
):
    oid = org_id_for(current_user)
    sol = (
        db.query(
            __import__("app.models.aml_solution", fromlist=["AMLSolution"]).AMLSolution
        )
        .filter_by(org_id=oid)
        .first()
    )
    if not sol:
        raise HTTPException(404, "AML Solution not found — complete onboarding first")

    policy = Policy(
        org_id=oid,
        solution_id=sol.id,
        policy_number=_next_policy_number(payload.policy_type, oid, db),
        title=payload.title,
        policy_type=payload.policy_type,
        policy_category=payload.policy_category,
        business_unit=payload.business_unit,
        content=payload.content,
        summary=payload.summary,
        scope=payload.scope,
        review_due_date=payload.review_due_date,
        effective_date=payload.effective_date,
        document_owner=payload.document_owner,
        compliance_reviewer=payload.compliance_reviewer,
        approver=payload.approver,
        regulatory_references=payload.regulatory_references,
        requires_attestation=payload.requires_attestation,
        attestation_due_days=payload.attestation_due_days,
        annual_attestation=payload.annual_attestation,
        attachments=payload.attachments,
        status=PolicyLifecycleStatus.draft,
        version_major=1,
        version_minor=0,
        created_by=current_user.id,
    )
    db.add(policy)
    db.flush()

    _create_workflow_event(
        policy,
        PolicyLifecycleStatus.draft,
        PolicyLifecycleStatus.draft,
        "created",
        current_user.id,
        None,
        db,
    )
    db.commit()
    db.refresh(policy)
    log.info("Policy created: %s org=%s", policy.policy_number, oid)
    return policy


@router.get("", response_model=List[PolicyResponse])
def list_policies(
    status: Optional[PolicyLifecycleStatus] = Query(None),
    policy_type: Optional[PolicyType] = Query(None),
    due_for_review: bool = Query(
        False, description="Only policies with review_due_date within 30 days"
    ),
    pagination: Pagination = Depends(),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    oid = org_id_for(current_user)
    q = db.query(Policy).filter(Policy.org_id == oid)
    if status:
        q = q.filter(Policy.status == status)
    if policy_type:
        q = q.filter(Policy.policy_type == policy_type)
    if due_for_review:
        from datetime import timedelta

        cutoff = date.today() + timedelta(days=30)
        q = q.filter(
            Policy.review_due_date <= cutoff,
            Policy.status == PolicyLifecycleStatus.published,
        )
    return pagination.apply(q.order_by(Policy.review_due_date)).all()


@router.get("/{policy_id}", response_model=PolicyResponse)
def get_policy(
    policy_id: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    return _get_policy(policy_id, org_id_for(current_user), db)


@router.patch("/{policy_id}", response_model=PolicyResponse)
def update_policy(
    policy_id: str,
    payload: PolicyUpdate,
    current_user: User = Depends(require_compliance_or_above),
    db: Session = Depends(get_db),
):
    policy = _get_policy(policy_id, org_id_for(current_user), db)

    if policy.status == PolicyLifecycleStatus.archived:
        raise HTTPException(422, "Archived policies cannot be edited")

    for field, value in payload.model_dump(exclude_none=True).items():
        setattr(policy, field, value)

    db.add(
        AuditLog(
            org_id=policy.org_id,
            actor_id=current_user.id,
            action="governance.policy.update",
            entity_type="Policy",
            entity_id=policy.id,
            detail={
                "fields_updated": list(payload.model_dump(exclude_none=True).keys())
            },
        )
    )
    db.commit()
    db.refresh(policy)
    return policy


# ── Workflow transitions ───────────────────────────────────────────────────────


@router.post("/{policy_id}/workflow", response_model=PolicyResponse)
def policy_workflow_action(
    policy_id: str,
    payload: PolicyWorkflowAction,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """
    Execute a workflow action on a policy.
    Validates the transition is allowed, enforces role gates, and creates:
      - PolicyWorkflowEvent (immutable audit trail)
      - PolicyVersion snapshot (on publish)
      - Review reminders (on publish)
    """
    policy = _get_policy(policy_id, org_id_for(current_user), db)
    from_status = policy.status

    ACTION_TO_STATUS = {
        "submit_for_review": PolicyLifecycleStatus.internal_review,
        "submit_for_compliance": PolicyLifecycleStatus.compliance_review,
        "submit_for_approval": PolicyLifecycleStatus.pending_approval,
        "request_changes": PolicyLifecycleStatus.internal_review,
        "publish": PolicyLifecycleStatus.published,
        "trigger_periodic_review": PolicyLifecycleStatus.periodic_review,
        "supersede": PolicyLifecycleStatus.superseded,
        "archive": PolicyLifecycleStatus.archived,
    }

    to_status = ACTION_TO_STATUS.get(payload.action)
    if not to_status:
        raise HTTPException(422, f"Unknown action: '{payload.action}'")

    allowed = ALLOWED_TRANSITIONS.get(from_status, [])
    if to_status not in allowed:
        raise HTTPException(
            422, f"Cannot move from '{from_status.value}' to '{to_status.value}'"
        )

    # Role gates for privileged transitions
    if payload.action == "publish":
        if current_user.role.value not in ("admin", "mlro"):
            raise HTTPException(403, "Only MLRO or Admin can publish policies")
        # Increment minor version on publish
        policy.version_minor += 1
        policy.approval_date = date.today()
        policy.approver = current_user.id
        if not policy.effective_date:
            policy.effective_date = date.today()
        _create_version_snapshot(
            policy,
            change_type=payload.change_type or "minor",
            change_summary=payload.change_summary,
            actor_id=current_user.id,
            db=db,
        )
        _schedule_reminders(policy, db)

    elif payload.action == "submit_for_approval":
        if current_user.role.value not in ("admin", "mlro", "compliance"):
            raise HTTPException(
                403, "Compliance role or above required to submit for approval"
            )

    policy.status = to_status
    _create_workflow_event(
        policy,
        from_status,
        to_status,
        payload.action,
        current_user.id,
        payload.comments,
        db,
    )
    db.add(
        AuditLog(
            org_id=policy.org_id,
            actor_id=current_user.id,
            action=f"governance.policy.{payload.action}",
            entity_type="Policy",
            entity_id=policy.id,
            detail={"from": from_status.value, "to": to_status.value},
        )
    )
    db.commit()
    db.refresh(policy)
    return policy


# ── Version history ───────────────────────────────────────────────────────────


@router.get("/{policy_id}/versions", response_model=List[PolicyVersionResponse])
def list_policy_versions(
    policy_id: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    _get_policy(policy_id, org_id_for(current_user), db)
    return (
        db.query(PolicyVersion)
        .filter(PolicyVersion.policy_id == policy_id)
        .order_by(PolicyVersion.created_at.desc())
        .all()
    )


# ── PDF / print export ─────────────────────────────────────────────────────────


@router.get(
    "/{policy_id}/export-html",
    response_class=HTMLResponse,
    summary="Export policy as print-ready HTML (browser print-to-PDF)",
)
def export_policy_html(
    policy_id: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    policy = _get_policy(policy_id, org_id_for(current_user), db)

    def esc(v) -> str:
        return html.escape(str(v)) if v else "—"

    refs_html = "".join(
        f"<li>{esc(r)}</li>" for r in (policy.regulatory_references or [])
    )
    return HTMLResponse(
        content=f"""<!DOCTYPE html>
<html><head><meta charset="utf-8"><title>{esc(policy.title)}</title>
<style>
body {{ font-family: Georgia, serif; max-width: 820px; margin: 40px auto; color: #1a1a1a; }}
h1 {{ font-size: 22px; border-bottom: 2px solid #333; padding-bottom: 8px; }}
.meta {{ font-size: 13px; color: #555; margin-bottom: 24px; }}
.meta span {{ margin-right: 18px; }}
.section-title {{ font-size: 14px; font-weight: bold; text-transform: uppercase; margin-top: 24px; color: #333; }}
.content {{ white-space: pre-wrap; font-size: 14px; line-height: 1.6; }}
.disclaimer {{ margin-top: 40px; font-size: 11px; color: #777; border-top: 1px solid #ccc; padding-top: 10px; }}
</style></head>
<body>
<h1>{esc(policy.title)}</h1>
<div class="meta">
<span><strong>Policy No:</strong> {esc(policy.policy_number)}</span>
<span><strong>Version:</strong> {esc(policy.version_string)}</span>
<span><strong>Status:</strong> {esc(policy.status.value)}</span>
<span><strong>Effective:</strong> {esc(policy.effective_date)}</span>
<span><strong>Review due:</strong> {esc(policy.review_due_date)}</span>
</div>
<div class="section-title">Summary</div>
<div class="content">{esc(policy.summary)}</div>
<div class="section-title">Scope</div>
<div class="content">{esc(policy.scope)}</div>
<div class="section-title">Policy Content</div>
<div class="content">{esc(policy.content)}</div>
<div class="section-title">Regulatory References</div>
<ul>{refs_html or "<li>—</li>"}</ul>
<div class="disclaimer">
This document is generated from VeriGo's governance register and reflects the policy
content as recorded at export time. All AML/CTF policy decisions remain the responsibility
of the reporting entity.
</div>
</body></html>"""
    )


# ── Workflow audit trail ──────────────────────────────────────────────────────


@router.get("/{policy_id}/audit", response_model=List[dict])
def get_policy_audit(
    policy_id: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    _get_policy(policy_id, org_id_for(current_user), db)
    events = (
        db.query(PolicyWorkflowEvent)
        .filter(PolicyWorkflowEvent.policy_id == policy_id)
        .order_by(PolicyWorkflowEvent.occurred_at.asc())
        .all()
    )
    return [
        {
            "action": e.action,
            "from_status": e.from_status.value,
            "to_status": e.to_status.value,
            "actor_id": e.actor_id,
            "comments": e.comments,
            "version": e.version_at_event,
            "occurred_at": e.occurred_at.isoformat(),
        }
        for e in events
    ]


# ── Attestations ──────────────────────────────────────────────────────────────


@router.post("/{policy_id}/attest", response_model=AttestationResponse, status_code=201)
def attest_policy(
    policy_id: str,
    payload: AttestationCreate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    policy = _get_policy(policy_id, org_id_for(current_user), db)
    if policy.status != PolicyLifecycleStatus.published:
        raise HTTPException(422, "Can only attest to published policies")

    existing = (
        db.query(PolicyAttestation)
        .filter(
            PolicyAttestation.policy_id == policy_id,
            PolicyAttestation.user_id == current_user.id,
            PolicyAttestation.attestation_type == payload.attestation_type,
            PolicyAttestation.policy_version == policy.version_string,
        )
        .first()
    )
    if existing:
        raise HTTPException(409, "You have already attested to this version")

    from datetime import timedelta

    attestation = PolicyAttestation(
        policy_id=policy_id,
        org_id=policy.org_id,
        user_id=current_user.id,
        attestation_type=payload.attestation_type,
        policy_version=policy.version_string,
        attestation_statement=(
            f"I confirm I have read and understood the {policy.title} "
            f"v{policy.version_string} effective {policy.effective_date}."
        ),
        attested_at=datetime.now(timezone.utc),
        due_date=date.today() + timedelta(days=policy.attestation_due_days),
        is_overdue=False,
        comments=payload.comments,
    )
    db.add(attestation)
    db.commit()
    db.refresh(attestation)
    return attestation


@router.get("/{policy_id}/attestations", response_model=List[AttestationResponse])
def list_attestations(
    policy_id: str,
    current_user: User = Depends(require_compliance_or_above),
    db: Session = Depends(get_db),
):
    _get_policy(policy_id, org_id_for(current_user), db)
    return (
        db.query(PolicyAttestation)
        .filter(PolicyAttestation.policy_id == policy_id)
        .order_by(PolicyAttestation.attested_at.desc())
        .all()
    )
