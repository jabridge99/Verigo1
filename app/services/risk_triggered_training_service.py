"""
Risk-Triggered Training Service

Core feedback loop: risk events → training assignments → competency evidence.

Public API:
  evaluate_risk_event()          — called by other services when a risk event occurs
  publish_regulatory_update()    — broadcasts training to all affected orgs on publish
  seed_default_trigger_rules()   — called at org creation to seed system rules
  create_assessment_flag()       — called when staff fail a training assessment
  get_training_gap_report()      — links training completion to risk decision quality
"""

from __future__ import annotations

import logging
from datetime import date, datetime, timedelta, timezone
from typing import Optional

from fastapi import HTTPException
from sqlalchemy.orm import Session

from app.models.governance_training import (
    AssignmentTrigger,
    GovernanceTrainingRecord,
    TrainingAssignment,
    TrainingCourse,
    TrainingStatus,
    TrainingType,
)
from app.models.organisation import Organisation
from app.models.training_trigger import (
    SYSTEM_TRIGGER_RULES,
    AssessmentFlagStatus,
    AssessmentOutcomeFlag,
    RegulatoryUpdateEvent,
    RegulatoryUpdateStatus,
    TrainingTriggerLog,
    TrainingTriggerRule,
    TriggerEventType,
    TriggerStatus,
    TriggerTargetType,
)
from app.models.user import User, UserRole

log = logging.getLogger("tvg.training_trigger")


# ══════════════════════════════════════════════════════════════════════════════
# MAIN ENTRY POINT — called by other services when a risk event fires
# ══════════════════════════════════════════════════════════════════════════════


def evaluate_risk_event(
    db: Session,
    event_type: TriggerEventType,
    org_id: str,
    entity_type: str,
    entity_id: str,
    entity_snapshot: dict,
    handled_by_user_id: Optional[str] = None,
    fired_by: str = "system",
) -> dict:
    """
    Main entry point. Called by customer_service, transaction_service,
    monitoring_service, case_service, etc. when a risk event occurs.

    Returns summary of assignments created.
    """
    # Load active rules for this org + event type (org rules + unoverridden system rules)
    org_rules = (
        db.query(TrainingTriggerRule)
        .filter(
            TrainingTriggerRule.org_id == org_id,
            TrainingTriggerRule.event_type == event_type,
            TrainingTriggerRule.status == TriggerStatus.active,
        )
        .all()
    )

    # System rules only apply if the org hasn't created an override rule for this event
    org_overrides_event = any(r.override_system for r in org_rules)
    if not org_overrides_event:
        system_rules = (
            db.query(TrainingTriggerRule)
            .filter(
                TrainingTriggerRule.org_id.is_(None),
                TrainingTriggerRule.event_type == event_type,
                TrainingTriggerRule.status == TriggerStatus.active,
                TrainingTriggerRule.is_system == True,
            )
            .all()
        )
        all_rules = org_rules + system_rules
    else:
        all_rules = org_rules

    if not all_rules:
        return {"event_type": event_type, "rules_matched": 0, "assignments_created": 0}

    total_assignments = 0
    logs_created = []

    for rule in all_rules:
        if not _conditions_match(rule.condition_filter or {}, entity_snapshot):
            continue

        target_users = _resolve_target_users(db, rule, org_id, handled_by_user_id)
        if not target_users:
            continue

        assignment_ids, assigned_users, skipped_users = _create_training_records(
            db, rule, target_users, org_id, entity_snapshot, entity_type, entity_id
        )
        total_assignments += len(assignment_ids)

        trigger_log = TrainingTriggerLog(
            rule_id=rule.id,
            org_id=org_id,
            event_type=event_type,
            entity_type=entity_type,
            entity_id=entity_id,
            entity_snapshot=entity_snapshot,
            assignments_created=len(assignment_ids),
            assignment_ids=assignment_ids,
            users_assigned=[u.id for u in assigned_users],
            skipped_users=[u.id for u in skipped_users],
            fired_by=fired_by,
        )
        db.add(trigger_log)
        logs_created.append(trigger_log)

    db.commit()

    log.info(
        "Risk event %s (org=%s, entity=%s/%s) → %d assignments across %d rules",
        event_type,
        org_id,
        entity_type,
        entity_id,
        total_assignments,
        len(logs_created),
    )

    return {
        "event_type": event_type,
        "rules_matched": len(logs_created),
        "assignments_created": total_assignments,
        "entity_id": entity_id,
    }


# ══════════════════════════════════════════════════════════════════════════════
# REGULATORY UPDATE BROADCAST
# ══════════════════════════════════════════════════════════════════════════════


def publish_regulatory_update(
    db: Session,
    update_id: str,
    published_by: str,
) -> dict:
    """
    Publishes a regulatory update event and broadcasts training assignments
    to all affected organisations.

    Called when a platform admin sets status = 'published'.
    """
    update = db.query(RegulatoryUpdateEvent).filter_by(id=update_id).first()
    if not update:
        raise HTTPException(404, "Regulatory update not found")
    if update.status != RegulatoryUpdateStatus.draft:
        raise HTTPException(
            422, f"Cannot publish — current status is '{update.status}'"
        )

    affected_industries = update.affected_industries or []
    affected_roles = update.affected_roles or []
    due_days = 7 if update.is_urgent else 30

    # Find all affected orgs
    org_query = db.query(Organisation).filter(Organisation.status == "active")
    if affected_industries:
        org_query = org_query.filter(
            Organisation.industry_type.in_(affected_industries)
        )
    orgs = org_query.all()

    total_assignments = 0
    orgs_notified = 0

    for org in orgs:
        # Find the right course to assign
        course = _resolve_course_for_update(db, update, org.id)
        if not course:
            continue

        # Find target users
        user_query = db.query(User).filter(
            User.org_id == org.id, User.status == "active"
        )
        if affected_roles:
            user_query = user_query.filter(User.role.in_(affected_roles))
        target_users = user_query.all()
        if not target_users:
            continue

        assignment_ids, assigned_users, skipped = _create_training_records_direct(
            db=db,
            course=course,
            target_users=target_users,
            org_id=org.id,
            due_days=due_days,
            trigger_type=AssignmentTrigger.regulatory_change,
            notes=f"Auto-assigned: {update.title} [{update.event_ref}]",
            cooldown_days=30,
            entity_type="regulatory_update",
            entity_id=update.id,
        )
        total_assignments += len(assignment_ids)

        # Write per-org trigger log
        trigger_log = TrainingTriggerLog(
            rule_id=None,
            org_id=org.id,
            event_type=TriggerEventType.regulatory_update,
            entity_type="regulatory_update",
            entity_id=update.id,
            entity_snapshot={"event_ref": update.event_ref, "title": update.title},
            regulatory_update_id=update.id,
            assignments_created=len(assignment_ids),
            assignment_ids=assignment_ids,
            users_assigned=[u.id for u in assigned_users],
            skipped_users=[u.id for u in skipped],
            fired_by=published_by,
        )
        db.add(trigger_log)
        orgs_notified += 1

    # Mark update as published
    update.status = RegulatoryUpdateStatus.published
    update.published_at = datetime.now(timezone.utc)
    update.published_by = published_by
    update.orgs_notified = orgs_notified
    update.assignments_created = total_assignments
    db.commit()

    log.info(
        "Regulatory update %s published → %d orgs notified, %d assignments created",
        update.event_ref,
        orgs_notified,
        total_assignments,
    )

    return {
        "update_id": update_id,
        "event_ref": update.event_ref,
        "orgs_notified": orgs_notified,
        "assignments_created": total_assignments,
        "published_at": update.published_at.isoformat(),
    }


# ══════════════════════════════════════════════════════════════════════════════
# ASSESSMENT OUTCOME FLAG
# ══════════════════════════════════════════════════════════════════════════════


def create_assessment_flag(
    db: Session,
    training_record_id: str,
    org_id: str,
    user_id: str,
    course_id: str,
    course_name: str,
    score: float,
    pass_mark: float,
    attempt_number: int,
) -> AssessmentOutcomeFlag:
    """
    Called when staff fail a training assessment.
    Links training failure to recent risk decisions by that user.
    """
    from app.models.case import Case
    from app.models.monitoring import TransactionAlert
    from app.models.transaction import Transaction

    cutoff = datetime.now(timezone.utc) - timedelta(days=30)

    # Gather recent risk decisions by this user
    recent_txn_ids = [
        t.id
        for t in db.query(Transaction)
        .filter(
            Transaction.org_id == org_id,
            Transaction.created_at >= cutoff,
        )
        .limit(20)
        .all()
    ]
    recent_alert_count = (
        db.query(TransactionAlert)
        .filter(
            TransactionAlert.org_id == org_id,
            TransactionAlert.assigned_to == user_id,
            TransactionAlert.created_at >= cutoff,
        )
        .count()
    )
    recent_case_count = (
        db.query(Case)
        .filter(
            Case.org_id == org_id,
            Case.assigned_to == user_id,
            Case.created_at >= cutoff,
        )
        .count()
    )

    # Require MLRO oversight if this is the 2nd+ failed attempt
    requires_oversight = attempt_number >= 2

    flag = AssessmentOutcomeFlag(
        org_id=org_id,
        user_id=user_id,
        training_record_id=training_record_id,
        course_id=course_id,
        course_name=course_name,
        score=score,
        pass_mark=pass_mark,
        attempt_number=attempt_number,
        recent_decision_ids=recent_txn_ids[:10],
        decision_summary={
            "transactions_in_last_30d": len(recent_txn_ids),
            "alerts_assigned_in_last_30d": recent_alert_count,
            "cases_assigned_in_last_30d": recent_case_count,
        },
        requires_oversight=requires_oversight,
    )
    db.add(flag)
    db.commit()
    db.refresh(flag)
    return flag


# ══════════════════════════════════════════════════════════════════════════════
# TRAINING GAP REPORT
# ══════════════════════════════════════════════════════════════════════════════


def get_training_gap_report(db: Session, org_id: str) -> dict:
    """
    Cross-references training completion with risk decision activity.
    Identifies staff who are handling risk events without completing
    the required training — the core audit-readiness metric.
    """
    users = db.query(User).filter(User.org_id == org_id, User.status == "active").all()
    courses = (
        db.query(TrainingCourse)
        .filter(
            TrainingCourse.org_id == org_id,
            TrainingCourse.is_mandatory == True,
            TrainingCourse.is_active == True,
        )
        .all()
    )

    gaps = []
    for user in users:
        user_records = (
            db.query(GovernanceTrainingRecord)
            .filter(
                GovernanceTrainingRecord.org_id == org_id,
                GovernanceTrainingRecord.user_id == user.id,
            )
            .all()
        )
        completed_course_ids = {
            r.course_id for r in user_records if r.status == TrainingStatus.completed
        }
        overdue_course_ids = {
            r.course_id
            for r in user_records
            if r.status in (TrainingStatus.overdue, TrainingStatus.expired)
        }

        user_gaps = []
        for course in courses:
            if course.id not in completed_course_ids:
                is_overdue = course.id in overdue_course_ids
                user_gaps.append(
                    {
                        "course_id": course.id,
                        "course_name": course.name,
                        "training_type": course.training_type,
                        "is_overdue": is_overdue,
                        "regulatory_references": course.regulatory_references,
                    }
                )

        open_flags = (
            db.query(AssessmentOutcomeFlag)
            .filter_by(
                org_id=org_id,
                user_id=user.id,
                status=AssessmentFlagStatus.open,
            )
            .count()
        )

        if user_gaps or open_flags:
            gaps.append(
                {
                    "user_id": user.id,
                    "user_name": user.full_name
                    if hasattr(user, "full_name")
                    else user.email,
                    "role": user.role,
                    "missing_mandatory_courses": user_gaps,
                    "open_assessment_flags": open_flags,
                    "gap_count": len(user_gaps),
                    "risk_level": "high"
                    if open_flags > 0 or any(g["is_overdue"] for g in user_gaps)
                    else "medium",
                }
            )

    # Trigger log summary — how many assignments were auto-created this quarter
    quarter_start = date.today().replace(
        month=((date.today().month - 1) // 3) * 3 + 1, day=1
    )
    trigger_logs_this_quarter = (
        db.query(TrainingTriggerLog)
        .filter(
            TrainingTriggerLog.org_id == org_id,
            TrainingTriggerLog.fired_at
            >= datetime.combine(quarter_start, datetime.min.time()),
        )
        .count()
    )

    total_gaps = sum(g["gap_count"] for g in gaps)
    high_risk_staff = [g for g in gaps if g["risk_level"] == "high"]

    return {
        "org_id": org_id,
        "generated_at": datetime.now(timezone.utc).isoformat(),
        "summary": {
            "total_active_staff": len(users),
            "staff_with_gaps": len(gaps),
            "total_training_gaps": total_gaps,
            "high_risk_staff_count": len(high_risk_staff),
            "auto_triggers_this_quarter": trigger_logs_this_quarter,
            "gap_rate_pct": round(len(gaps) / len(users) * 100, 1) if users else 0,
        },
        "staff_gaps": gaps,
        "high_risk_staff": high_risk_staff,
    }


# ══════════════════════════════════════════════════════════════════════════════
# ORG SEEDING — called at org creation
# ══════════════════════════════════════════════════════════════════════════════


def seed_default_trigger_rules(
    db: Session, org_id: str, solution_id: str, created_by: str
) -> int:
    """
    Seeds system-level trigger rules for a new org.
    Matches each SYSTEM_TRIGGER_RULE to the org's seeded TrainingCourse
    by training_type. Skips if no matching course found.
    """
    seeded = 0
    for rule_def in SYSTEM_TRIGGER_RULES:
        course = (
            db.query(TrainingCourse)
            .filter_by(
                org_id=org_id,
            )
            .filter(TrainingCourse.training_type == rule_def["course_training_type"])
            .first()
        )
        if not course:
            continue

        existing = (
            db.query(TrainingTriggerRule)
            .filter_by(
                org_id=org_id,
                event_type=rule_def["event_type"],
                is_system=True,
            )
            .first()
        )
        if existing:
            continue

        rule = TrainingTriggerRule(
            org_id=org_id,
            name=rule_def["name"],
            event_type=rule_def["event_type"],
            condition_filter=rule_def.get("condition_filter", {}),
            course_id=course.id,
            target_type=rule_def["target_type"],
            target_roles=rule_def.get("target_roles", []),
            due_days=rule_def.get("due_days", 14),
            priority=rule_def.get("priority", "normal"),
            cooldown_days=rule_def.get("cooldown_days", 90),
            regulatory_basis=rule_def.get("regulatory_basis"),
            is_system=True,
            created_by=created_by,
        )
        db.add(rule)
        seeded += 1

    db.commit()
    return seeded


# ══════════════════════════════════════════════════════════════════════════════
# INTERNAL HELPERS
# ══════════════════════════════════════════════════════════════════════════════


def _conditions_match(condition_filter: dict, entity_snapshot: dict) -> bool:
    """Returns True if all conditions in the filter match the entity snapshot."""
    for key, expected in condition_filter.items():
        actual = entity_snapshot.get(key)
        if actual is None:
            return False
        if isinstance(expected, list):
            if actual not in expected:
                return False
        elif isinstance(expected, bool):
            if bool(actual) != expected:
                return False
        elif isinstance(expected, (int, float)):
            # Treat as "actual >= expected" for threshold conditions
            try:
                if float(actual) < float(expected):
                    return False
            except (TypeError, ValueError):
                return False
        else:
            if actual != expected:
                return False
    return True


def _resolve_target_users(
    db: Session,
    rule: TrainingTriggerRule,
    org_id: str,
    handled_by_user_id: Optional[str],
) -> list[User]:
    target = rule.target_type

    if target == TriggerTargetType.handled_analyst:
        if not handled_by_user_id:
            return []
        user = (
            db.query(User)
            .filter_by(id=handled_by_user_id, org_id=org_id, status="active")
            .first()
        )
        return [user] if user else []

    if target == TriggerTargetType.all_role:
        roles = rule.target_roles or []
        if not roles:
            return []
        return (
            db.query(User)
            .filter(
                User.org_id == org_id,
                User.status == "active",
                User.role.in_(roles),
            )
            .all()
        )

    if target == TriggerTargetType.all_staff:
        return db.query(User).filter_by(org_id=org_id, status="active").all()

    if target == TriggerTargetType.specific_users:
        ids = rule.specific_user_ids or []
        return (
            db.query(User)
            .filter(
                User.id.in_(ids),
                User.org_id == org_id,
                User.status == "active",
            )
            .all()
        )

    if target == TriggerTargetType.mlro_only:
        return (
            db.query(User)
            .filter(
                User.org_id == org_id,
                User.status == "active",
                User.role.in_([UserRole.admin, UserRole.mlro]),
            )
            .all()
        )

    if target == TriggerTargetType.compliance_team:
        return (
            db.query(User)
            .filter(
                User.org_id == org_id,
                User.status == "active",
                User.role.in_([UserRole.admin, UserRole.mlro, UserRole.compliance]),
            )
            .all()
        )

    return []


def _is_in_cooldown(
    db: Session,
    user_id: str,
    course_id: str,
    cooldown_days: int,
) -> bool:
    if cooldown_days <= 0:
        return False
    cutoff = datetime.now(timezone.utc) - timedelta(days=cooldown_days)
    recent = (
        db.query(GovernanceTrainingRecord)
        .filter(
            GovernanceTrainingRecord.user_id == user_id,
            GovernanceTrainingRecord.course_id == course_id,
            GovernanceTrainingRecord.created_at >= cutoff,
        )
        .first()
    )
    return recent is not None


def _create_training_records(
    db: Session,
    rule: TrainingTriggerRule,
    target_users: list[User],
    org_id: str,
    entity_snapshot: dict,
    entity_type: str,
    entity_id: str,
) -> tuple[list[str], list[User], list[User]]:
    notes = rule.notes_template or f"Auto-assigned by trigger rule: {rule.name}"
    for k, v in (entity_snapshot or {}).items():
        notes = notes.replace(f"{{{k}}}", str(v))

    return _create_training_records_direct(
        db=db,
        course=rule.course,
        target_users=target_users,
        org_id=org_id,
        due_days=rule.due_days,
        trigger_type=_event_to_assignment_trigger(rule.event_type),
        notes=notes,
        cooldown_days=rule.cooldown_days,
        entity_type=entity_type,
        entity_id=entity_id,
    )


def _create_training_records_direct(
    db: Session,
    course: TrainingCourse,
    target_users: list[User],
    org_id: str,
    due_days: int,
    trigger_type: AssignmentTrigger,
    notes: str,
    cooldown_days: int,
    entity_type: str,
    entity_id: str,
) -> tuple[list[str], list[User], list[User]]:
    # Find solution_id (use first AML solution for org)
    from app.models.aml_solution import AMLSolution

    solution = db.query(AMLSolution).filter_by(org_id=org_id).first()
    if not solution:
        return [], [], target_users

    assigned_date = date.today()
    due_date = assigned_date + timedelta(days=due_days)

    assignment = TrainingAssignment(
        org_id=org_id,
        solution_id=solution.id,
        course_id=course.id,
        assigned_to_user_ids=[u.id for u in target_users],
        trigger=trigger_type,
        assigned_date=assigned_date,
        due_date=due_date,
        notes=notes,
        total_assigned=len(target_users),
        assigned_by="system",
    )
    db.add(assignment)
    db.flush()

    assigned_users = []
    skipped_users = []
    record_ids = []

    for user in target_users:
        if _is_in_cooldown(db, user.id, course.id, cooldown_days):
            skipped_users.append(user)
            continue

        record = GovernanceTrainingRecord(
            org_id=org_id,
            solution_id=solution.id,
            course_id=course.id,
            user_id=user.id,
            assignment_id=assignment.id,
            assigned_by="system",
            assigned_date=assigned_date,
            due_date=due_date,
            trigger=trigger_type,
            status=TrainingStatus.assigned,
            notes=notes,
        )
        db.add(record)
        db.flush()
        record_ids.append(record.id)
        assigned_users.append(user)

    assignment.total_assigned = len(assigned_users)
    return record_ids, assigned_users, skipped_users


def _event_to_assignment_trigger(event_type: TriggerEventType) -> AssignmentTrigger:
    mapping = {
        TriggerEventType.smr_filed: AssignmentTrigger.incident,
        TriggerEventType.regulatory_update: AssignmentTrigger.regulatory_change,
        TriggerEventType.policy_update: AssignmentTrigger.policy_update,
        TriggerEventType.independent_review_finding: AssignmentTrigger.incident,
    }
    return mapping.get(event_type, AssignmentTrigger.incident)


def _resolve_course_for_update(
    db: Session,
    update: RegulatoryUpdateEvent,
    org_id: str,
) -> Optional[TrainingCourse]:
    if update.linked_course_id:
        # Try to find an org-local version of this course type
        linked = db.query(TrainingCourse).filter_by(id=update.linked_course_id).first()
        if linked:
            org_course = (
                db.query(TrainingCourse)
                .filter_by(
                    org_id=org_id,
                    training_type=linked.training_type,
                    is_active=True,
                )
                .first()
            )
            return org_course or linked

    # Fall back to annual refresher
    return (
        db.query(TrainingCourse)
        .filter_by(
            org_id=org_id,
            training_type=TrainingType.annual_aml_refresher,
            is_active=True,
        )
        .first()
    )
