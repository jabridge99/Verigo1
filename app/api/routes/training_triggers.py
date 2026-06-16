"""
Phase — Risk-Triggered Training & Regulatory Event Trigger System

Two sub-systems:
  1. Trigger Rules  — org-configurable rules that fire training on risk events
  2. Regulatory Updates — platform-level AUSTRAC/FATF guidance that broadcasts
                          training assignments to all affected organisations

AUSTRAC obligation basis: AML/CTF Act s.36 — reporting entities must ensure
staff have appropriate AML/CTF knowledge and training.
"""
from datetime import date
from typing import Optional, List
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app.api.deps import (
    get_current_user, require_mlro_or_above, require_compliance_or_above,
    require_analyst_or_above, get_db,
)
from app.models.user import User, UserRole
from app.models.training_trigger import (
    TrainingTriggerRule, TrainingTriggerLog, RegulatoryUpdateEvent,
    AssessmentOutcomeFlag,
    TriggerEventType, TriggerTargetType, TriggerStatus,
    RegulatoryUpdateStatus, IssuingBody, AssessmentFlagStatus,
)
from app.services import risk_triggered_training_service

router = APIRouter(prefix="/training-triggers", tags=["Training — Risk Triggers & Regulatory Events"])


# ══════════════════════════════════════════════════════════════════════════════
# SCHEMAS
# ══════════════════════════════════════════════════════════════════════════════

class CreateTriggerRuleRequest(BaseModel):
    name: str
    description: Optional[str] = None
    event_type: TriggerEventType
    condition_filter: dict = {}
    course_id: str
    target_type: TriggerTargetType
    target_roles: List[str] = []
    specific_user_ids: List[str] = []
    due_days: int = 14
    priority: str = "normal"
    notes_template: Optional[str] = None
    cooldown_days: int = 90
    override_system: bool = False
    regulatory_basis: Optional[str] = None


class UpdateTriggerRuleRequest(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    condition_filter: Optional[dict] = None
    target_type: Optional[TriggerTargetType] = None
    target_roles: Optional[List[str]] = None
    due_days: Optional[int] = None
    priority: Optional[str] = None
    cooldown_days: Optional[int] = None
    status: Optional[TriggerStatus] = None
    override_system: Optional[bool] = None


class ManualFireRequest(BaseModel):
    entity_type: str
    entity_id: str
    entity_snapshot: dict = {}
    handled_by_user_id: Optional[str] = None


class CreateRegulatoryUpdateRequest(BaseModel):
    event_ref: str
    title: str
    issuing_body: IssuingBody
    summary: str
    key_changes: List[str] = []
    full_text_url: Optional[str] = None
    effective_date: Optional[date] = None
    compliance_deadline: Optional[date] = None
    affected_industries: List[str] = []
    affected_roles: List[str] = []
    linked_course_id: Optional[str] = None
    auto_assign_training: bool = True
    is_urgent: bool = False
    tags: List[str] = []


class UpdateRegulatoryUpdateRequest(BaseModel):
    title: Optional[str] = None
    summary: Optional[str] = None
    key_changes: Optional[List[str]] = None
    affected_industries: Optional[List[str]] = None
    affected_roles: Optional[List[str]] = None
    linked_course_id: Optional[str] = None
    compliance_deadline: Optional[date] = None
    is_urgent: Optional[bool] = None
    tags: Optional[List[str]] = None


class ReviewAssessmentFlagRequest(BaseModel):
    requires_oversight: bool
    oversight_note: Optional[str] = None
    review_notes: Optional[str] = None


# ══════════════════════════════════════════════════════════════════════════════
# TRIGGER RULES
# ══════════════════════════════════════════════════════════════════════════════

@router.post("/rules", summary="Create a training trigger rule")
def create_rule(
    body: CreateTriggerRuleRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_mlro_or_above),
):
    from app.models.governance_training import TrainingCourse
    course = db.query(TrainingCourse).filter_by(id=body.course_id, org_id=current_user.org_id).first()
    if not course:
        raise HTTPException(404, "Training course not found in your organisation")

    rule = TrainingTriggerRule(
        org_id=current_user.org_id,
        name=body.name,
        description=body.description,
        event_type=body.event_type,
        condition_filter=body.condition_filter,
        course_id=body.course_id,
        target_type=body.target_type,
        target_roles=body.target_roles,
        specific_user_ids=body.specific_user_ids,
        due_days=body.due_days,
        priority=body.priority,
        notes_template=body.notes_template,
        cooldown_days=body.cooldown_days,
        override_system=body.override_system,
        regulatory_basis=body.regulatory_basis,
        is_system=False,
        created_by=current_user.id,
    )
    db.add(rule)
    db.commit()
    db.refresh(rule)
    return _rule_to_dict(rule)


@router.get("/rules", summary="List trigger rules for this organisation")
def list_rules(
    event_type: Optional[TriggerEventType] = None,
    status: Optional[TriggerStatus] = None,
    include_system: bool = True,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_compliance_or_above),
):
    q = db.query(TrainingTriggerRule).filter(
        TrainingTriggerRule.org_id == current_user.org_id,
    )
    if event_type:
        q = q.filter(TrainingTriggerRule.event_type == event_type)
    if status:
        q = q.filter(TrainingTriggerRule.status == status)
    rules = q.order_by(TrainingTriggerRule.event_type).all()

    if include_system:
        sys_q = db.query(TrainingTriggerRule).filter(
            TrainingTriggerRule.org_id.is_(None),
            TrainingTriggerRule.is_system == True,
            TrainingTriggerRule.status == TriggerStatus.active,
        )
        if event_type:
            sys_q = sys_q.filter(TrainingTriggerRule.event_type == event_type)
        rules = rules + sys_q.all()

    return [_rule_to_dict(r) for r in rules]


@router.get("/rules/{rule_id}", summary="Get a trigger rule")
def get_rule(
    rule_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_compliance_or_above),
):
    rule = _get_rule(db, rule_id, current_user.org_id)
    log_count = db.query(TrainingTriggerLog).filter_by(rule_id=rule_id).count()
    result = _rule_to_dict(rule)
    result["times_fired"] = log_count
    return result


@router.patch("/rules/{rule_id}", summary="Update a trigger rule")
def update_rule(
    rule_id: str,
    body: UpdateTriggerRuleRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_mlro_or_above),
):
    rule = _get_rule(db, rule_id, current_user.org_id)
    if rule.is_system and rule.org_id is None:
        raise HTTPException(422, "Cannot edit system rules — create an org-level override instead")

    for field, value in body.model_dump(exclude_none=True).items():
        setattr(rule, field, value)
    db.commit()
    db.refresh(rule)
    return _rule_to_dict(rule)


@router.delete("/rules/{rule_id}", summary="Deactivate a trigger rule")
def deactivate_rule(
    rule_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_mlro_or_above),
):
    rule = _get_rule(db, rule_id, current_user.org_id)
    if rule.is_system and rule.org_id is None:
        raise HTTPException(422, "Cannot delete system rules")
    rule.status = TriggerStatus.archived
    db.commit()
    return {"archived": True, "rule_id": rule_id}


@router.post("/rules/{rule_id}/fire", summary="Manually fire a trigger rule")
def manual_fire(
    rule_id: str,
    body: ManualFireRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_mlro_or_above),
):
    rule = _get_rule(db, rule_id, current_user.org_id)
    if rule.status != TriggerStatus.active:
        raise HTTPException(422, "Rule is not active")

    result = risk_triggered_training_service.evaluate_risk_event(
        db=db,
        event_type=rule.event_type,
        org_id=current_user.org_id,
        entity_type=body.entity_type,
        entity_id=body.entity_id,
        entity_snapshot=body.entity_snapshot,
        handled_by_user_id=body.handled_by_user_id,
        fired_by=current_user.id,
    )
    return result


# ══════════════════════════════════════════════════════════════════════════════
# TRIGGER LOGS
# ══════════════════════════════════════════════════════════════════════════════

@router.get("/logs", summary="Audit log of all training triggers that fired for this org")
def list_trigger_logs(
    event_type: Optional[TriggerEventType] = None,
    entity_type: Optional[str] = None,
    limit: int = 50,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_compliance_or_above),
):
    q = db.query(TrainingTriggerLog).filter_by(org_id=current_user.org_id)
    if event_type:
        q = q.filter(TrainingTriggerLog.event_type == event_type)
    if entity_type:
        q = q.filter(TrainingTriggerLog.entity_type == entity_type)
    logs = q.order_by(TrainingTriggerLog.fired_at.desc()).limit(limit).all()
    return [
        {
            "id": l.id,
            "rule_id": l.rule_id,
            "event_type": l.event_type,
            "entity_type": l.entity_type,
            "entity_id": l.entity_id,
            "assignments_created": l.assignments_created,
            "users_assigned": l.users_assigned,
            "skipped_users": l.skipped_users,
            "fired_at": l.fired_at.isoformat() if l.fired_at else None,
            "fired_by": l.fired_by,
        }
        for l in logs
    ]


# ══════════════════════════════════════════════════════════════════════════════
# REGULATORY UPDATE EVENTS
# ══════════════════════════════════════════════════════════════════════════════

@router.post("/regulatory-updates", summary="Create a regulatory update event (platform admin or MLRO)")
def create_regulatory_update(
    body: CreateRegulatoryUpdateRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_mlro_or_above),
):
    existing = db.query(RegulatoryUpdateEvent).filter_by(event_ref=body.event_ref).first()
    if existing:
        raise HTTPException(409, f"Event ref '{body.event_ref}' already exists")

    update = RegulatoryUpdateEvent(
        event_ref=body.event_ref,
        title=body.title,
        issuing_body=body.issuing_body,
        summary=body.summary,
        key_changes=body.key_changes,
        full_text_url=body.full_text_url,
        effective_date=body.effective_date,
        compliance_deadline=body.compliance_deadline,
        affected_industries=body.affected_industries,
        affected_roles=body.affected_roles,
        linked_course_id=body.linked_course_id,
        auto_assign_training=body.auto_assign_training,
        is_urgent=body.is_urgent,
        tags=body.tags,
        created_by=current_user.id,
    )
    db.add(update)
    db.commit()
    db.refresh(update)
    return _update_to_dict(update)


@router.get("/regulatory-updates", summary="List regulatory update events")
def list_regulatory_updates(
    status: Optional[RegulatoryUpdateStatus] = None,
    issuing_body: Optional[IssuingBody] = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_analyst_or_above),
):
    q = db.query(RegulatoryUpdateEvent)
    if status:
        q = q.filter(RegulatoryUpdateEvent.status == status)
    if issuing_body:
        q = q.filter(RegulatoryUpdateEvent.issuing_body == issuing_body)
    updates = q.order_by(RegulatoryUpdateEvent.created_at.desc()).limit(100).all()
    return [_update_to_dict(u) for u in updates]


@router.get("/regulatory-updates/{update_id}", summary="Get a regulatory update event")
def get_regulatory_update(
    update_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_analyst_or_above),
):
    update = db.query(RegulatoryUpdateEvent).filter_by(id=update_id).first()
    if not update:
        raise HTTPException(404, "Regulatory update not found")
    result = _update_to_dict(update)
    # Show how many orgs from this org's group were affected (if any)
    logs = db.query(TrainingTriggerLog).filter_by(
        org_id=current_user.org_id,
        regulatory_update_id=update_id,
    ).all()
    result["org_training_triggered"] = len(logs) > 0
    result["org_assignments_created"] = sum(l.assignments_created for l in logs)
    return result


@router.patch("/regulatory-updates/{update_id}", summary="Update a draft regulatory event")
def update_regulatory_update(
    update_id: str,
    body: UpdateRegulatoryUpdateRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_mlro_or_above),
):
    update = db.query(RegulatoryUpdateEvent).filter_by(id=update_id).first()
    if not update:
        raise HTTPException(404, "Regulatory update not found")
    if update.status != RegulatoryUpdateStatus.draft:
        raise HTTPException(422, "Only draft events can be edited")

    for field, value in body.model_dump(exclude_none=True).items():
        setattr(update, field, value)
    db.commit()
    db.refresh(update)
    return _update_to_dict(update)


@router.post("/regulatory-updates/{update_id}/publish",
             summary="Publish a regulatory update — broadcasts training to all affected organisations")
def publish_regulatory_update(
    update_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_mlro_or_above),
):
    return risk_triggered_training_service.publish_regulatory_update(
        db=db,
        update_id=update_id,
        published_by=current_user.id,
    )


@router.post("/regulatory-updates/{update_id}/archive", summary="Archive a regulatory update event")
def archive_regulatory_update(
    update_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_mlro_or_above),
):
    update = db.query(RegulatoryUpdateEvent).filter_by(id=update_id).first()
    if not update:
        raise HTTPException(404, "Regulatory update not found")
    update.status = RegulatoryUpdateStatus.archived
    db.commit()
    return {"archived": True, "update_id": update_id}


# ══════════════════════════════════════════════════════════════════════════════
# ASSESSMENT OUTCOME FLAGS
# ══════════════════════════════════════════════════════════════════════════════

@router.get("/assessment-flags", summary="List open assessment outcome flags for this org")
def list_assessment_flags(
    status: Optional[AssessmentFlagStatus] = None,
    user_id: Optional[str] = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_compliance_or_above),
):
    q = db.query(AssessmentOutcomeFlag).filter_by(org_id=current_user.org_id)
    if status:
        q = q.filter(AssessmentOutcomeFlag.status == status)
    if user_id:
        q = q.filter(AssessmentOutcomeFlag.user_id == user_id)
    flags = q.order_by(AssessmentOutcomeFlag.created_at.desc()).limit(100).all()
    return [_flag_to_dict(f) for f in flags]


@router.get("/assessment-flags/{flag_id}", summary="Get an assessment outcome flag")
def get_assessment_flag(
    flag_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_compliance_or_above),
):
    flag = db.query(AssessmentOutcomeFlag).filter_by(
        id=flag_id, org_id=current_user.org_id
    ).first()
    if not flag:
        raise HTTPException(404, "Assessment flag not found")
    return _flag_to_dict(flag)


@router.post("/assessment-flags/{flag_id}/review",
             summary="MLRO reviews an assessment outcome flag")
def review_assessment_flag(
    flag_id: str,
    body: ReviewAssessmentFlagRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_mlro_or_above),
):
    from datetime import datetime, timezone
    flag = db.query(AssessmentOutcomeFlag).filter_by(
        id=flag_id, org_id=current_user.org_id
    ).first()
    if not flag:
        raise HTTPException(404, "Assessment flag not found")

    flag.requires_oversight = body.requires_oversight
    flag.oversight_note = body.oversight_note
    flag.review_notes = body.review_notes
    flag.reviewed_by = current_user.id
    flag.reviewed_at = datetime.now(timezone.utc)
    flag.status = AssessmentFlagStatus.reviewed
    db.commit()
    db.refresh(flag)
    return _flag_to_dict(flag)


@router.post("/assessment-flags/{flag_id}/clear",
             summary="Clear an assessment flag once training is completed satisfactorily")
def clear_assessment_flag(
    flag_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_mlro_or_above),
):
    from datetime import datetime, timezone
    flag = db.query(AssessmentOutcomeFlag).filter_by(
        id=flag_id, org_id=current_user.org_id
    ).first()
    if not flag:
        raise HTTPException(404, "Assessment flag not found")
    flag.status = AssessmentFlagStatus.cleared
    flag.cleared_at = datetime.now(timezone.utc)
    flag.requires_oversight = False
    db.commit()
    return {"cleared": True, "flag_id": flag_id}


# ══════════════════════════════════════════════════════════════════════════════
# TRAINING GAP REPORT & ANALYTICS
# ══════════════════════════════════════════════════════════════════════════════

@router.get("/gap-report", summary="Training gap report — mandatory training vs risk decision activity")
def training_gap_report(
    db: Session = Depends(get_db),
    current_user: User = Depends(require_compliance_or_above),
):
    return risk_triggered_training_service.get_training_gap_report(db, current_user.org_id)


@router.get("/enums/values", summary="Enum values for dropdowns")
def get_enums():
    return {
        "trigger_event_types": [e.value for e in TriggerEventType],
        "trigger_target_types": [e.value for e in TriggerTargetType],
        "trigger_statuses": [e.value for e in TriggerStatus],
        "regulatory_update_statuses": [e.value for e in RegulatoryUpdateStatus],
        "issuing_bodies": [e.value for e in IssuingBody],
        "assessment_flag_statuses": [e.value for e in AssessmentFlagStatus],
    }


# ══════════════════════════════════════════════════════════════════════════════
# HELPERS
# ══════════════════════════════════════════════════════════════════════════════

def _get_rule(db: Session, rule_id: str, org_id: str) -> TrainingTriggerRule:
    rule = db.query(TrainingTriggerRule).filter(
        TrainingTriggerRule.id == rule_id,
        TrainingTriggerRule.org_id.in_([org_id, None]),
    ).first()
    if not rule:
        raise HTTPException(404, "Trigger rule not found")
    return rule


def _rule_to_dict(rule: TrainingTriggerRule) -> dict:
    return {
        "id": rule.id,
        "org_id": rule.org_id,
        "name": rule.name,
        "description": rule.description,
        "event_type": rule.event_type,
        "status": rule.status,
        "condition_filter": rule.condition_filter,
        "course_id": rule.course_id,
        "course_name": rule.course.name if rule.course else None,
        "target_type": rule.target_type,
        "target_roles": rule.target_roles,
        "due_days": rule.due_days,
        "priority": rule.priority,
        "cooldown_days": rule.cooldown_days,
        "is_system": rule.is_system,
        "override_system": rule.override_system,
        "regulatory_basis": rule.regulatory_basis,
        "created_at": rule.created_at.isoformat() if rule.created_at else None,
    }


def _update_to_dict(update: RegulatoryUpdateEvent) -> dict:
    return {
        "id": update.id,
        "event_ref": update.event_ref,
        "title": update.title,
        "issuing_body": update.issuing_body,
        "summary": update.summary,
        "key_changes": update.key_changes,
        "full_text_url": update.full_text_url,
        "effective_date": update.effective_date.isoformat() if update.effective_date else None,
        "compliance_deadline": update.compliance_deadline.isoformat() if update.compliance_deadline else None,
        "affected_industries": update.affected_industries,
        "affected_roles": update.affected_roles,
        "linked_course_id": update.linked_course_id,
        "auto_assign_training": update.auto_assign_training,
        "is_urgent": update.is_urgent,
        "status": update.status,
        "published_at": update.published_at.isoformat() if update.published_at else None,
        "orgs_notified": update.orgs_notified,
        "assignments_created": update.assignments_created,
        "tags": update.tags,
        "created_at": update.created_at.isoformat() if update.created_at else None,
    }


def _flag_to_dict(flag: AssessmentOutcomeFlag) -> dict:
    return {
        "id": flag.id,
        "user_id": flag.user_id,
        "course_id": flag.course_id,
        "course_name": flag.course_name,
        "score": flag.score,
        "pass_mark": flag.pass_mark,
        "attempt_number": flag.attempt_number,
        "decision_summary": flag.decision_summary,
        "requires_oversight": flag.requires_oversight,
        "oversight_note": flag.oversight_note,
        "status": flag.status,
        "reviewed_by": flag.reviewed_by,
        "reviewed_at": flag.reviewed_at.isoformat() if flag.reviewed_at else None,
        "review_notes": flag.review_notes,
        "cleared_at": flag.cleared_at.isoformat() if flag.cleared_at else None,
        "created_at": flag.created_at.isoformat() if flag.created_at else None,
    }
