"""
Automation Rule execution engine — Phase 4 (Rule Builder).

Evaluates AutomationRule.condition_groups against an event context and,
when matched, executes AutomationRule.actions. Reuses the same
AND-within-group / OR-across-groups condition pattern already proven in
app/services/monitoring_engine.py, extended with per-condition NOT and
nested sub-groups so the Rule Builder UI can express IF/AND/OR/NOT trees.

DISCLAIMER: The rule engine automates workflow steps only.
The system never automatically approves compliance decisions.
All decisions remain with the reporting entity.
"""

from datetime import date, datetime, timedelta, timezone
from typing import Any, Optional
from uuid import uuid4

from sqlalchemy.orm import Session

from app.models.automation_rule import (
    AutomationRule,
    AutomationRuleExecution,
    AutomationRuleStatus,
    RuleActionType,
    RuleEventType,
)


# ── Condition evaluation (supports IF / AND / OR / NOT / nesting) ──────────────


def _resolve_field(context: dict, field_path: str) -> Any:
    parts = field_path.split(".")
    current: Any = context
    for part in parts:
        if isinstance(current, dict):
            current = current.get(part)
        else:
            current = getattr(current, part, None)
        if current is None:
            return None
    return current


def _evaluate_operator(context: dict, field: str, operator: str, value: Any) -> bool:
    val = _resolve_field(context, field)
    if operator == "eq":
        return str(val) == str(value) if val is not None else False
    if operator == "ne":
        return str(val) != str(value)
    if operator == "gt":
        return float(val or 0) > float(value)
    if operator == "gte":
        return float(val or 0) >= float(value)
    if operator == "lt":
        return float(val or 0) < float(value)
    if operator == "lte":
        return float(val or 0) <= float(value)
    if operator == "in":
        return str(val) in [str(v) for v in (value or [])]
    if operator == "not_in":
        return str(val) not in [str(v) for v in (value or [])]
    if operator == "contains":
        return str(value) in str(val or "")
    if operator == "starts_with":
        return str(val or "").startswith(str(value))
    if operator == "is_true":
        return bool(val)
    if operator == "is_false":
        return not bool(val)
    if operator == "is_null":
        return val is None
    if operator == "between":
        lo, hi = value[0], value[1]
        return float(lo) <= float(val or 0) <= float(hi)
    return False


def _evaluate_leaf(context: dict, condition: dict) -> bool:
    result = _evaluate_operator(
        context, condition.get("field"), condition.get("operator"), condition.get("value")
    )
    return (not result) if condition.get("negate") else result


def _evaluate_group(context: dict, group: dict) -> bool:
    """A group AND's or OR's its conditions and nested sub-groups, with optional NOT on the whole group."""
    logic = (group.get("logic") or "AND").upper()
    leaves = [_evaluate_leaf(context, c) for c in (group.get("conditions") or [])]
    nested = [_evaluate_group(context, g) for g in (group.get("groups") or [])]
    results = leaves + nested

    if not results:
        outcome = True
    elif logic == "OR":
        outcome = any(results)
    else:
        outcome = all(results)

    return (not outcome) if group.get("negate") else outcome


def evaluate_condition_groups(context: dict, condition_groups: list[dict]) -> Optional[int]:
    """
    Top-level groups are OR'd together (same semantic as MonitoringRule).
    Returns the index of the first matching group, or None if no group matched
    (including the case where condition_groups is empty — a rule with no
    conditions never fires; it must explicitly define at least one group).
    """
    for idx, group in enumerate(condition_groups or []):
        if _evaluate_group(context, group):
            return idx
    return None


# ── Action execution ────────────────────────────────────────────────────────────


def _execute_action(
    db: Session,
    action: dict,
    org_id: str,
    entity_type: Optional[str],
    entity_id: Optional[str],
    context: dict,
    actor_id: str,
) -> dict:
    """Execute a single action. Returns a result dict; never raises — failures are recorded."""
    action_type = action.get("action_type")
    params = action.get("params") or {}

    try:
        if action_type == RuleActionType.create_alert.value:
            return _action_create_alert(db, params, org_id, entity_type, entity_id, actor_id)
        if action_type == RuleActionType.create_case.value:
            return _action_create_case(db, params, org_id, entity_type, entity_id, actor_id)
        if action_type in (
            RuleActionType.request_document.value,
            RuleActionType.create_task.value,
        ):
            return _action_create_task(db, params, org_id, entity_type, entity_id, action_type, actor_id)
        if action_type == RuleActionType.assign_user.value:
            return _action_create_task(db, params, org_id, entity_type, entity_id, "internal_review", actor_id, assignment_only=True)
        if action_type == RuleActionType.schedule_review.value:
            return _action_schedule_review(db, params, org_id, entity_type, entity_id)
        if action_type == RuleActionType.create_calendar_item.value:
            return _action_create_calendar_item(db, params, org_id, entity_type, entity_id)
        if action_type == RuleActionType.set_risk_level.value:
            return _action_set_risk_level(db, params, org_id, entity_type, entity_id, actor_id)
        if action_type == RuleActionType.flag_smr_candidate.value:
            return _action_flag_smr_candidate(db, org_id, entity_type, entity_id)
        if action_type in (
            RuleActionType.escalate_compliance.value,
            RuleActionType.escalate_manager.value,
            RuleActionType.escalate_mlro.value,
        ):
            return _action_escalate(db, params, org_id, action_type, entity_type, entity_id)
        if action_type == RuleActionType.send_email.value:
            return _action_send_email(params)
        if action_type in (RuleActionType.trigger_webhook.value, RuleActionType.trigger_api_call.value):
            return _action_webhook(params, entity_type, entity_id)
        if action_type in (
            RuleActionType.send_sms.value,
            RuleActionType.post_to_slack.value,
            RuleActionType.post_to_teams.value,
            RuleActionType.trigger_edd.value,
            RuleActionType.generate_report_draft.value,
        ):
            return {
                "action_type": action_type,
                "result": "manual_action_required",
                "note": "Not auto-executed by the rule engine — requires action in the relevant module.",
            }
    except Exception as exc:  # noqa: BLE001 — action execution must never crash rule evaluation
        return {"action_type": action_type, "result": "error", "error": str(exc)}

    return {"action_type": action_type, "result": "unsupported"}


def _action_create_alert(db, params, org_id, entity_type, entity_id, actor_id) -> dict:
    from app.models.monitoring import AlertCategory, AlertSeverity, AlertStatus, AlertType, TransactionAlert
    from app.models.transaction import Transaction

    if entity_type != "transaction" or not entity_id:
        return {"action_type": "create_alert", "result": "not_applicable", "note": "create_alert requires a transaction entity."}

    txn = db.query(Transaction).filter(Transaction.id == entity_id, Transaction.org_id == org_id).first()
    if not txn:
        return {"action_type": "create_alert", "result": "not_applicable", "note": "Transaction not found."}

    count = db.query(TransactionAlert).filter(TransactionAlert.org_id == org_id).count()
    alert = TransactionAlert(
        id=f"alrt_{uuid4().hex[:10]}",
        alert_ref=f"ALRT-AUTO-{count + 1:06d}",
        org_id=org_id,
        transaction_id=entity_id,
        customer_id=txn.customer_id,
        alert_type=AlertType(params["alert_type"]) if params.get("alert_type") else AlertType.rule_triggered,
        category=AlertCategory(params["category"]) if params.get("category") else AlertCategory.custom,
        severity=AlertSeverity(params.get("severity", "medium")),
        status=AlertStatus.generated,
        alert_score=float(params.get("alert_score", 50)),
        title=params.get("title", "Automation rule alert"),
        rules_matched=[params.get("rule_id")] if params.get("rule_id") else [],
        rule_name=params.get("rule_name"),
    )
    db.add(alert)
    db.commit()
    return {"action_type": "create_alert", "result": "created", "entity_id": alert.id}


def _action_create_case(db, params, org_id, entity_type, entity_id, actor_id) -> dict:
    from app.models.case import Case, CaseSeverity, CaseStatus, CaseType

    customer_id = entity_id if entity_type == "customer" else params.get("customer_id")
    case = Case(
        id=f"case_{uuid4().hex[:12]}",
        case_ref=f"CASE-AUTO-{uuid4().hex[:8].upper()}",
        org_id=org_id,
        customer_id=customer_id,
        case_type=CaseType(params.get("case_type", "other")) if params.get("case_type") else CaseType.other,
        severity=CaseSeverity(params.get("severity", "medium")),
        status=CaseStatus.open,
        title=params.get("title", "Case opened by automation rule"),
        description=params.get("description"),
    )
    db.add(case)
    db.commit()
    return {"action_type": "create_case", "result": "created", "entity_id": case.id}


def _action_create_task(db, params, org_id, entity_type, entity_id, task_type, actor_id, assignment_only=False) -> dict:
    from app.models.task import Task, TaskPriority, TaskType

    try:
        t_type = TaskType(task_type)
    except ValueError:
        t_type = TaskType.other

    due = date.today() + timedelta(days=int(params.get("due_in_days", 7)))
    task = Task(
        id=f"task_{uuid4().hex[:12]}",
        task_ref=f"TASK-AUTO-{uuid4().hex[:8].upper()}",
        org_id=org_id,
        customer_id=entity_id if entity_type == "customer" else params.get("customer_id"),
        case_id=entity_id if entity_type == "case" else params.get("case_id"),
        task_type=t_type,
        priority=TaskPriority(params.get("priority", "normal")),
        title=params.get("title", "Action required" if not assignment_only else "Assigned by automation rule"),
        description=params.get("description") or params.get("note"),
        assigned_to=params.get("user_id"),
        assigned_by="system",
        assigned_at=datetime.now(timezone.utc) if params.get("user_id") else None,
        due_date=due,
        created_by=actor_id,
    )
    db.add(task)
    db.commit()
    return {"action_type": task_type, "result": "created", "entity_id": task.id}


def _action_schedule_review(db, params, org_id, entity_type, entity_id) -> dict:
    from app.models.customer import Customer
    from app.services.compliance_calendar_service import schedule_customer_review

    customer_id = entity_id if entity_type == "customer" else params.get("customer_id")
    customer = db.query(Customer).filter(Customer.id == customer_id, Customer.org_id == org_id).first()
    if not customer:
        return {"action_type": "schedule_review", "result": "not_applicable", "note": "No customer to schedule a review for."}
    item = schedule_customer_review(customer, db, override_months=params.get("months"))
    return {"action_type": "schedule_review", "result": "created", "entity_id": item.id}


def _action_create_calendar_item(db, params, org_id, entity_type, entity_id) -> dict:
    from app.models.compliance_calendar import CalendarItemType
    from app.services.compliance_calendar_service import create_calendar_item

    due = params.get("due_date")
    due_date = date.fromisoformat(due) if due else date.today() + timedelta(days=int(params.get("due_in_days", 14)))
    item = create_calendar_item(
        db=db,
        org_id=org_id,
        item_type=CalendarItemType(params["item_type"]) if params.get("item_type") else CalendarItemType.austrac_obligation,
        title=params.get("title", "Automation rule reminder"),
        due_date=due_date,
        description=params.get("description"),
        customer_id=entity_id if entity_type == "customer" else params.get("customer_id"),
    )
    return {"action_type": "create_calendar_item", "result": "created", "entity_id": item.id}


def _action_set_risk_level(db, params, org_id, entity_type, entity_id, actor_id) -> dict:
    from app.models.customer import Customer, RiskLevel

    if entity_type != "customer" or not entity_id or not params.get("risk_level"):
        return {"action_type": "set_risk_level", "result": "not_applicable"}
    customer = db.query(Customer).filter(Customer.id == entity_id, Customer.org_id == org_id).first()
    if not customer:
        return {"action_type": "set_risk_level", "result": "not_applicable", "note": "Customer not found."}
    customer.risk_level = RiskLevel(params["risk_level"])
    db.commit()
    return {"action_type": "set_risk_level", "result": "applied", "entity_id": customer.id}


def _action_flag_smr_candidate(db, org_id, entity_type, entity_id) -> dict:
    from app.models.case import Case

    if entity_type != "case" or not entity_id:
        return {"action_type": "flag_smr_candidate", "result": "not_applicable", "note": "flag_smr_candidate requires a case entity."}
    case = db.query(Case).filter(Case.id == entity_id, Case.org_id == org_id).first()
    if not case:
        return {"action_type": "flag_smr_candidate", "result": "not_applicable", "note": "Case not found."}
    case.is_smr_candidate = True
    db.commit()
    return {"action_type": "flag_smr_candidate", "result": "applied", "entity_id": case.id}


def _action_escalate(db, params, org_id, action_type, entity_type, entity_id) -> dict:
    from app.models.user import User, UserRole
    from app.services.email.factory import get_email_provider

    role_map = {
        "escalate_compliance": [UserRole.compliance, UserRole.mlro, UserRole.admin],
        "escalate_manager": [UserRole.compliance, UserRole.mlro, UserRole.admin],
        "escalate_mlro": [UserRole.mlro, UserRole.admin],
    }
    recipients = (
        db.query(User)
        .filter(User.org_id == org_id, User.role.in_(role_map.get(action_type, [])))
        .all()
    )
    provider = get_email_provider()
    sent = 0
    subject = params.get("subject", "Automation rule escalation")
    body = params.get("reason", "An automation rule has escalated an item for review.")
    for user in recipients:
        if provider.send(user.email, subject, f"<p>{body}</p>"):
            sent += 1
    return {"action_type": action_type, "result": "notified", "recipients": sent}


def _action_send_email(params) -> dict:
    from app.services.email.factory import get_email_provider

    to = params.get("recipient")
    if not to:
        return {"action_type": "send_email", "result": "not_applicable", "note": "No recipient configured."}
    ok = get_email_provider().send(to, params.get("subject", "Verigo notification"), params.get("body", ""))
    return {"action_type": "send_email", "result": "sent" if ok else "failed"}


def _action_webhook(params, entity_type, entity_id) -> dict:
    import httpx

    url = params.get("url")
    if not url:
        return {"action_type": "trigger_webhook", "result": "not_applicable", "note": "No URL configured."}
    payload = {"entity_type": entity_type, "entity_id": entity_id, **(params.get("payload") or {})}
    try:
        resp = httpx.request(
            params.get("method", "POST"), url, json=payload, headers=params.get("headers") or {}, timeout=5.0
        )
        return {"action_type": "trigger_webhook", "result": "sent", "status_code": resp.status_code}
    except httpx.HTTPError as exc:
        return {"action_type": "trigger_webhook", "result": "error", "error": str(exc)}


# ── Context builders ─────────────────────────────────────────────────────────────


def customer_context(customer) -> dict:
    return {
        "customer": {
            "risk_level": getattr(customer.risk_level, "value", customer.risk_level),
            "risk_score": getattr(customer, "risk_score", 0),
            "is_pep": getattr(customer, "is_pep", False),
            "customer_type": getattr(customer.customer_type, "value", None)
            if hasattr(customer, "customer_type")
            else None,
            "country_of_residence": getattr(customer, "country_of_residence", None),
            "nationality": getattr(customer, "nationality", None),
            "cdd_level": getattr(customer.cdd_level, "value", None)
            if hasattr(customer, "cdd_level")
            else None,
            "status": getattr(customer.status, "value", None) if hasattr(customer, "status") else None,
        }
    }


def transaction_context(transaction) -> dict:
    return {
        "transaction": {
            "amount_aud": transaction.amount_aud or transaction.amount,
            "currency": transaction.currency,
            "transaction_type": getattr(transaction.transaction_type, "value", None),
            "payment_method": getattr(transaction.payment_method, "value", None),
            "is_cross_border": transaction.is_cross_border,
            "source_country": transaction.source_country,
            "destination_country": transaction.destination_country,
        }
    }


# ── Engine entry point ──────────────────────────────────────────────────────────


def evaluate_automation_rules(
    db: Session,
    event_type: RuleEventType,
    org_id: str,
    entity_type: Optional[str] = None,
    entity_id: Optional[str] = None,
    context: Optional[dict] = None,
    triggered_by: str = "system",
) -> list[dict]:
    """
    Evaluate all active/testing AutomationRules for this org+event_type,
    in priority order. Matched rules execute their actions (or, in
    'testing' status, only log what would have executed — shadow mode).

    Always writes an immutable AutomationRuleExecution row, matched or not.
    Returns the list of execution summaries for rules that matched.
    """
    context = context or {}
    rules = (
        db.query(AutomationRule)
        .filter(
            AutomationRule.org_id == org_id,
            AutomationRule.event_type == event_type,
            AutomationRule.status.in_([AutomationRuleStatus.active, AutomationRuleStatus.testing]),
        )
        .order_by(AutomationRule.priority, AutomationRule.created_at)
        .all()
    )

    results = []
    for rule in rules:
        started = datetime.now(timezone.utc)
        matched_idx = evaluate_condition_groups(context, rule.condition_groups or [])
        did_match = matched_idx is not None
        is_shadow = rule.status == AutomationRuleStatus.testing

        actions_executed: list[dict] = []
        if did_match:
            rule.trigger_count = (rule.trigger_count or 0) + 1
            rule.last_triggered_at = started
            for action in rule.actions or []:
                if is_shadow:
                    actions_executed.append({"action_type": action.get("action_type"), "result": "would_execute_shadow_mode"})
                else:
                    actions_executed.append(
                        _execute_action(db, action, org_id, entity_type, entity_id, context, triggered_by)
                    )
            rule.last_executed_at = datetime.now(timezone.utc)

        elapsed_ms = (datetime.now(timezone.utc) - started).total_seconds() * 1000

        exec_log = AutomationRuleExecution(
            id=f"are_{uuid4().hex[:12]}",
            rule_id=rule.id,
            org_id=org_id,
            event_type=event_type.value,
            entity_type=entity_type,
            entity_id=entity_id,
            triggered_by=triggered_by,
            conditions_evaluated=len(rule.condition_groups or []),
            conditions_matched=did_match,
            matched_group_index=matched_idx,
            actions_executed=actions_executed,
            is_shadow_mode=is_shadow,
            execution_time_ms=elapsed_ms,
        )
        db.add(exec_log)

        if did_match:
            from app.models.audit_log import AuditEventType, AuditLog

            db.add(
                AuditLog(
                    org_id=org_id,
                    event_type=AuditEventType.automation_rule_triggered,
                    actor_id=triggered_by if triggered_by != "system" else None,
                    action=f"Automation rule '{rule.name}' triggered by {event_type.value}",
                    object_type="AutomationRule",
                    object_id=rule.id,
                    new_value={"actions_executed": actions_executed, "is_shadow_mode": is_shadow},
                    log_metadata={"entity_type": entity_type, "entity_id": entity_id},
                )
            )

        db.commit()

        if did_match:
            results.append(
                {
                    "rule_id": rule.id,
                    "rule_name": rule.name,
                    "is_shadow_mode": is_shadow,
                    "actions_executed": actions_executed,
                }
            )

    return results
