"""
P54: real coverage for app/services/automation_engine.py (14% covered before
this file existed) -- the automation rule engine wired into 6+ core route
files (transactions, customers, customer_workflow, screening, kyc,
independent_review), firing on nearly every core workflow action, yet with
no dedicated tests at all.

Two layers, matching how the module is actually used:
  1. Request-level: create a real rule via POST /rule-builder/rules, trigger
     it via a real workflow action (POST /transactions/), and verify the
     real side effect happened (a Task/Case/Alert row, not just a 200).
  2. Direct service-level for the condition evaluator (a pure function worth
     exercising per-operator) and the action dispatch table (each action
     type's real DB side effect), since not every action type has a event
     that reaches it in one HTTP round trip.
"""

import uuid
from datetime import datetime, timezone
from unittest.mock import patch

import pytest

from app.models.automation_rule import (
    AutomationRule,
    AutomationRuleExecution,
    AutomationRuleStatus,
    RuleActionType,
    RuleEventType,
)
from app.models.case import Case, CaseSeverity, CaseStatus, CaseType
from app.models.customer import Customer, CustomerType, RiskLevel
from app.models.monitoring import TransactionAlert
from app.models.task import Task, TaskType
from app.models.transaction import Transaction
from app.models.user import User, UserRole
from app.services.automation_engine import (
    customer_context,
    evaluate_automation_rules,
    evaluate_condition_groups,
    transaction_context,
)
from tests.conftest import _auth, _make_user


def _customer(db, org_id, **overrides):
    defaults = dict(
        customer_ref=f"CUST-{uuid.uuid4().hex[:8]}",
        org_id=org_id,
        customer_type=CustomerType.individual,
        full_name="Jane Doe",
        risk_level=RiskLevel.medium,
    )
    defaults.update(overrides)
    customer = Customer(**defaults)
    db.add(customer)
    db.commit()
    db.refresh(customer)
    return customer


def _transaction(db, org_id, customer_id, **overrides):
    defaults = dict(
        id=f"txn_{uuid.uuid4().hex[:12]}",
        org_id=org_id,
        transaction_ref=f"TXN-{uuid.uuid4().hex[:8]}",
        customer_id=customer_id,
        transaction_type="transfer",
        direction="outgoing",
        payment_method="bank_transfer",
        amount=1000.0,
        currency="AUD",
        transaction_date=datetime(2026, 6, 1, 10, 0, 0, tzinfo=timezone.utc),
    )
    defaults.update(overrides)
    txn = Transaction(**defaults)
    db.add(txn)
    db.commit()
    db.refresh(txn)
    return txn


def _rule(db, org_id, event_type, actions, condition_groups=None, status=None, **overrides):
    rule = AutomationRule(
        id=f"ar_{uuid.uuid4().hex[:10]}",
        org_id=org_id,
        name=overrides.pop("name", "Test Rule"),
        event_type=event_type,
        status=status or AutomationRuleStatus.active,
        condition_groups=condition_groups or [],
        actions=actions,
        **overrides,
    )
    db.add(rule)
    db.commit()
    db.refresh(rule)
    return rule


# ── Condition evaluator (pure function, exercised per operator) ────────────────


class TestEvaluateConditionGroups:
    def test_no_groups_never_matches(self):
        assert evaluate_condition_groups({"a": 1}, []) is None

    def test_group_with_no_conditions_always_matches(self):
        assert evaluate_condition_groups({}, [{"conditions": []}]) == 0

    @pytest.mark.parametrize(
        "operator,field_value,cond_value,expected",
        [
            ("eq", "high", "high", True),
            ("eq", "low", "high", False),
            ("ne", "low", "high", True),
            ("gt", 100, 50, True),
            ("gt", 50, 100, False),
            ("gte", 100, 100, True),
            ("lt", 50, 100, True),
            ("lte", 100, 100, True),
            ("contains", "cross-border payment", "cross-border", True),
            ("starts_with", "PP12345", "PP", True),
            ("is_true", True, None, True),
            ("is_false", False, None, True),
            ("is_null", None, None, True),
        ],
    )
    def test_operators(self, operator, field_value, cond_value, expected):
        context = {"field": field_value}
        groups = [
            {"conditions": [{"field": "field", "operator": operator, "value": cond_value}]}
        ]
        matched = evaluate_condition_groups(context, groups) is not None
        assert matched is expected

    def test_in_and_not_in(self):
        context = {"country": "KP"}
        assert (
            evaluate_condition_groups(
                context, [{"conditions": [{"field": "country", "operator": "in", "value": ["KP", "IR"]}]}]
            )
            == 0
        )
        assert (
            evaluate_condition_groups(
                context,
                [{"conditions": [{"field": "country", "operator": "not_in", "value": ["AU", "NZ"]}]}],
            )
            == 0
        )

    def test_between(self):
        context = {"amount": 7500}
        groups = [
            {"conditions": [{"field": "amount", "operator": "between", "value": [1000, 10000]}]}
        ]
        assert evaluate_condition_groups(context, groups) == 0

    def test_dotted_field_path_resolves_through_nested_dict(self):
        context = {"transaction": {"amount_aud": 15000}}
        groups = [
            {"conditions": [{"field": "transaction.amount_aud", "operator": "gt", "value": 10000}]}
        ]
        assert evaluate_condition_groups(context, groups) == 0

    def test_missing_field_resolves_to_none_and_fails_comparisons_safely(self):
        groups = [
            {"conditions": [{"field": "nonexistent.path", "operator": "eq", "value": "x"}]}
        ]
        assert evaluate_condition_groups({}, groups) is None

    def test_negate_on_leaf_condition(self):
        context = {"status": "closed"}
        groups = [
            {
                "conditions": [
                    {"field": "status", "operator": "eq", "value": "closed", "negate": True}
                ]
            }
        ]
        assert evaluate_condition_groups(context, groups) is None

    def test_negate_on_whole_group(self):
        context = {"status": "closed"}
        groups = [
            {
                "negate": True,
                "conditions": [{"field": "status", "operator": "eq", "value": "closed"}],
            }
        ]
        assert evaluate_condition_groups(context, groups) is None

    def test_and_logic_requires_all_conditions(self):
        context = {"amount": 15000, "country": "AU"}
        groups = [
            {
                "logic": "AND",
                "conditions": [
                    {"field": "amount", "operator": "gt", "value": 10000},
                    {"field": "country", "operator": "eq", "value": "KP"},
                ],
            }
        ]
        assert evaluate_condition_groups(context, groups) is None

    def test_or_logic_requires_any_condition(self):
        context = {"amount": 15000, "country": "AU"}
        groups = [
            {
                "logic": "OR",
                "conditions": [
                    {"field": "amount", "operator": "gt", "value": 10000},
                    {"field": "country", "operator": "eq", "value": "KP"},
                ],
            }
        ]
        assert evaluate_condition_groups(context, groups) == 0

    def test_top_level_groups_are_ored_together(self):
        context = {"amount": 500}
        groups = [
            {"conditions": [{"field": "amount", "operator": "gt", "value": 10000}]},
            {"conditions": [{"field": "amount", "operator": "lt", "value": 1000}]},
        ]
        # First group doesn't match, second does -- returns the matching index.
        assert evaluate_condition_groups(context, groups) == 1

    def test_nested_sub_groups(self):
        context = {"amount": 15000, "country": "KP"}
        groups = [
            {
                "logic": "AND",
                "conditions": [{"field": "amount", "operator": "gt", "value": 10000}],
                "groups": [
                    {
                        "logic": "OR",
                        "conditions": [
                            {"field": "country", "operator": "eq", "value": "KP"},
                            {"field": "country", "operator": "eq", "value": "IR"},
                        ],
                    }
                ],
            }
        ]
        assert evaluate_condition_groups(context, groups) == 0


class TestContextBuilders:
    def test_customer_context_uses_enum_values_not_raw_enums(self, db):
        org = _make_user(db, UserRole.admin).org_id
        customer = _customer(db, org, risk_level=RiskLevel.high)
        ctx = customer_context(customer)
        assert ctx["customer"]["risk_level"] == "high"

    def test_transaction_context_falls_back_to_amount_when_amount_aud_unset(self, db):
        org = _make_user(db, UserRole.admin).org_id
        customer = _customer(db, org)
        txn = _transaction(db, org, customer.id, amount=2500.0, amount_aud=None)
        ctx = transaction_context(txn)
        assert ctx["transaction"]["amount_aud"] == 2500.0


# ── Engine entry point: request-level, through the real API ────────────────────


def test_matching_rule_executes_its_action_via_real_transaction_creation(
    client, db, admin_user
):
    """A rule created via the real Rule Builder API fires when a real
    transaction is created through the real API, and its action's real
    side effect (a Task row) actually happens -- not just a 200 status."""
    headers = _auth(admin_user)

    rule_resp = client.post(
        "/api/v1/rule-builder/rules",
        json={
            "name": "High value transfer review",
            "event_type": "transaction_created",
            "condition_groups": [
                {
                    "conditions": [
                        {"field": "transaction.amount_aud", "operator": "gt", "value": 5000}
                    ]
                }
            ],
            "actions": [
                {
                    "action_type": "create_task",
                    "params": {"title": "Review high value transfer"},
                }
            ],
        },
        headers=headers,
    )
    assert rule_resp.status_code == 201, rule_resp.text
    rule_id = rule_resp.json()["id"]

    customer = client.post(
        "/api/v1/customers/",
        json={
            "full_name": "High Value Customer",
            "email": f"hv-{uuid.uuid4().hex[:6]}@example.com",
            "phone": "+61400000097",
            "date_of_birth": "1990-01-01",
            "nationality": "AU",
            "country_of_residence": "AU",
            "id_number": "PP77777777",
            "id_type": "passport",
            "address": "1 High St, Sydney NSW 2000",
            "industry": "banking",
        },
        headers=headers,
    )
    assert customer.status_code == 201, customer.text
    customer_id = customer.json()["id"]

    ref = f"TXN-HV-{uuid.uuid4().hex[:8]}"
    txn = client.post(
        "/api/v1/transactions/",
        json={
            "transaction_ref": ref,
            "reference": ref,
            "customer_id": customer_id,
            "transaction_type": "transfer",
            "direction": "outgoing",
            "payment_method": "bank_transfer",
            "amount": 15000.00,
            "currency": "AUD",
            "transaction_date": "2026-06-01T10:00:00",
        },
        headers=headers,
    )
    assert txn.status_code == 201, txn.text

    task = (
        db.query(Task)
        .filter(Task.org_id == admin_user.org_id, Task.title == "Review high value transfer")
        .first()
    )
    assert task is not None

    executions = client.get(
        f"/api/v1/rule-builder/rules/{rule_id}/executions", headers=headers
    )
    assert executions.status_code == 200, executions.text
    exec_rows = executions.json()["items"] if isinstance(executions.json(), dict) else executions.json()
    assert any(e.get("conditions_matched") for e in exec_rows)


def test_non_matching_rule_does_not_execute_its_action(client, db, admin_user):
    headers = _auth(admin_user)

    rule_resp = client.post(
        "/api/v1/rule-builder/rules",
        json={
            "name": "Never matches",
            "event_type": "transaction_created",
            "condition_groups": [
                {
                    "conditions": [
                        {"field": "transaction.amount_aud", "operator": "gt", "value": 999999}
                    ]
                }
            ],
            "actions": [
                {"action_type": "create_task", "params": {"title": "Should never be created"}}
            ],
        },
        headers=headers,
    )
    assert rule_resp.status_code == 201, rule_resp.text

    customer = client.post(
        "/api/v1/customers/",
        json={
            "full_name": "Low Value Customer",
            "email": f"lv-{uuid.uuid4().hex[:6]}@example.com",
            "phone": "+61400000096",
            "date_of_birth": "1990-01-01",
            "nationality": "AU",
            "country_of_residence": "AU",
            "id_number": "PP88888888",
            "id_type": "passport",
            "address": "1 Low St, Sydney NSW 2000",
            "industry": "banking",
        },
        headers=headers,
    )
    customer_id = customer.json()["id"]

    ref = f"TXN-LV-{uuid.uuid4().hex[:8]}"
    resp = client.post(
        "/api/v1/transactions/",
        json={
            "transaction_ref": ref,
            "reference": ref,
            "customer_id": customer_id,
            "transaction_type": "transfer",
            "direction": "outgoing",
            "payment_method": "bank_transfer",
            "amount": 50.00,
            "currency": "AUD",
            "transaction_date": "2026-06-01T10:00:00",
        },
        headers=headers,
    )
    assert resp.status_code == 201, resp.text

    assert (
        db.query(Task)
        .filter(Task.org_id == admin_user.org_id, Task.title == "Should never be created")
        .first()
        is None
    )


def test_shadow_mode_rule_logs_but_does_not_execute(client, db, admin_user):
    """status='testing' rules evaluate conditions and log what WOULD have
    happened, but never actually run the action -- confirmed by checking the
    real DB, not just the execution log's own self-report."""
    headers = _auth(admin_user)

    rule_resp = client.post(
        "/api/v1/rule-builder/rules",
        json={
            "name": "Shadow mode rule",
            "event_type": "transaction_created",
            "condition_groups": [
                {"conditions": [{"field": "transaction.amount_aud", "operator": "gt", "value": 100}]}
            ],
            "actions": [
                {"action_type": "create_task", "params": {"title": "Shadow task"}}
            ],
        },
        headers=headers,
    )
    rule_id = rule_resp.json()["id"]

    patch_resp = client.patch(
        f"/api/v1/rule-builder/rules/{rule_id}",
        json={"status": "testing"},
        headers=headers,
    )
    assert patch_resp.status_code == 200, patch_resp.text
    assert patch_resp.json()["status"] == "testing"

    customer = client.post(
        "/api/v1/customers/",
        json={
            "full_name": "Shadow Customer",
            "email": f"sh-{uuid.uuid4().hex[:6]}@example.com",
            "phone": "+61400000095",
            "date_of_birth": "1990-01-01",
            "nationality": "AU",
            "country_of_residence": "AU",
            "id_number": "PP99999999",
            "id_type": "passport",
            "address": "1 Shadow St, Sydney NSW 2000",
            "industry": "banking",
        },
        headers=headers,
    )
    customer_id = customer.json()["id"]

    ref = f"TXN-SH-{uuid.uuid4().hex[:8]}"
    resp = client.post(
        "/api/v1/transactions/",
        json={
            "transaction_ref": ref,
            "reference": ref,
            "customer_id": customer_id,
            "transaction_type": "transfer",
            "direction": "outgoing",
            "payment_method": "bank_transfer",
            "amount": 5000.00,
            "currency": "AUD",
            "transaction_date": "2026-06-01T10:00:00",
        },
        headers=headers,
    )
    assert resp.status_code == 201, resp.text

    assert (
        db.query(Task)
        .filter(Task.org_id == admin_user.org_id, Task.title == "Shadow task")
        .first()
        is None
    )

    execution = (
        db.query(AutomationRuleExecution)
        .filter(AutomationRuleExecution.rule_id == rule_id)
        .first()
    )
    assert execution is not None
    assert execution.is_shadow_mode is True
    assert execution.conditions_matched is True
    assert execution.actions_executed[0]["result"] == "would_execute_shadow_mode"


# ── Action dispatch table: direct service-level, one real DB side effect each ──


class TestActionHandlers:
    def test_create_alert_action(self, db):
        org = _make_user(db, UserRole.admin).org_id
        customer = _customer(db, org)
        txn = _transaction(db, org, customer.id)
        rule = _rule(
            db,
            org,
            RuleEventType.transaction_created,
            actions=[{"action_type": "create_alert", "params": {"severity": "high"}}],
            condition_groups=[{"conditions": []}],
        )
        results = evaluate_automation_rules(
            db,
            RuleEventType.transaction_created,
            org,
            "transaction",
            txn.id,
            transaction_context(txn),
        )
        assert len(results) == 1
        assert results[0]["actions_executed"][0]["result"] == "created"
        alert = db.query(TransactionAlert).filter(TransactionAlert.org_id == org).first()
        assert alert is not None
        assert alert.severity.value == "high"

    def test_create_case_action(self, db):
        org = _make_user(db, UserRole.admin).org_id
        customer = _customer(db, org)
        rule = _rule(
            db,
            org,
            RuleEventType.customer_created,
            actions=[{"action_type": "create_case", "params": {"case_type": "edd_review"}}],
            condition_groups=[{"conditions": []}],
        )
        evaluate_automation_rules(
            db,
            RuleEventType.customer_created,
            org,
            "customer",
            customer.id,
            customer_context(customer),
        )
        case = db.query(Case).filter(Case.org_id == org).first()
        assert case is not None
        assert case.customer_id == customer.id
        assert case.case_type == CaseType.edd_review

    def test_set_risk_level_action(self, db):
        org = _make_user(db, UserRole.admin).org_id
        customer = _customer(db, org, risk_level=RiskLevel.low)
        rule = _rule(
            db,
            org,
            RuleEventType.customer_risk_changed,
            actions=[{"action_type": "set_risk_level", "params": {"risk_level": "high"}}],
            condition_groups=[{"conditions": []}],
        )
        evaluate_automation_rules(
            db,
            RuleEventType.customer_risk_changed,
            org,
            "customer",
            customer.id,
            customer_context(customer),
        )
        db.refresh(customer)
        assert customer.risk_level == RiskLevel.high

    def test_flag_smr_candidate_action(self, db):
        org = _make_user(db, UserRole.admin).org_id
        case = Case(
            id=f"case_{uuid.uuid4().hex[:12]}",
            case_ref=f"CASE-{uuid.uuid4().hex[:8]}",
            org_id=org,
            case_type=CaseType.other,
            severity=CaseSeverity.medium,
            status=CaseStatus.open,
            title="Test case",
            created_by="someone",
        )
        db.add(case)
        db.commit()
        db.refresh(case)

        rule = _rule(
            db,
            org,
            RuleEventType.case_updated,
            actions=[{"action_type": "flag_smr_candidate"}],
            condition_groups=[{"conditions": []}],
        )
        evaluate_automation_rules(
            db, RuleEventType.case_updated, org, "case", case.id, {}
        )
        db.refresh(case)
        assert case.is_smr_candidate is True

    def test_create_task_action_uses_other_task_type_for_unmapped_action_names(self, db):
        """create_task/request_document aren't real TaskType enum values --
        the handler's ValueError fallback always maps them to TaskType.other.
        Documents the actual current behaviour rather than an assumption."""
        org = _make_user(db, UserRole.admin).org_id
        customer = _customer(db, org)
        rule = _rule(
            db,
            org,
            RuleEventType.customer_created,
            actions=[{"action_type": "request_document", "params": {"title": "Send ID"}}],
            condition_groups=[{"conditions": []}],
        )
        evaluate_automation_rules(
            db,
            RuleEventType.customer_created,
            org,
            "customer",
            customer.id,
            customer_context(customer),
        )
        task = db.query(Task).filter(Task.org_id == org).first()
        assert task is not None
        assert task.task_type == TaskType.other
        assert task.title == "Send ID"

    def test_escalate_action_notifies_matching_role_recipients(self, db):
        org = _make_user(db, UserRole.admin).org_id  # admin is itself an escalate_mlro recipient
        _make_user(db, UserRole.mlro, industry_id=org)
        _make_user(db, UserRole.viewer, industry_id=org)  # should not be notified

        rule = _rule(
            db,
            org,
            RuleEventType.alert_generated,
            actions=[{"action_type": "escalate_mlro", "params": {"reason": "High risk match"}}],
            condition_groups=[{"conditions": []}],
        )
        results = evaluate_automation_rules(
            db, RuleEventType.alert_generated, org, None, None, {}
        )
        assert results[0]["actions_executed"][0]["result"] == "notified"
        # role_map["escalate_mlro"] = [mlro, admin] -- both the org's admin
        # (created as a side effect of _make_user) and the mlro user are
        # notified; the viewer is not.
        assert results[0]["actions_executed"][0]["recipients"] == 2

    def test_send_email_action_without_recipient_is_a_noop(self, db):
        org = _make_user(db, UserRole.admin).org_id
        rule = _rule(
            db,
            org,
            RuleEventType.manual_trigger,
            actions=[{"action_type": "send_email", "params": {}}],
            condition_groups=[{"conditions": []}],
        )
        results = evaluate_automation_rules(
            db, RuleEventType.manual_trigger, org, None, None, {}
        )
        assert results[0]["actions_executed"][0]["result"] == "not_applicable"

    def test_send_email_action_with_recipient_sends(self, db):
        org = _make_user(db, UserRole.admin).org_id
        rule = _rule(
            db,
            org,
            RuleEventType.manual_trigger,
            actions=[
                {
                    "action_type": "send_email",
                    "params": {"recipient": "ops@example.com", "subject": "Alert"},
                }
            ],
            condition_groups=[{"conditions": []}],
        )
        results = evaluate_automation_rules(
            db, RuleEventType.manual_trigger, org, None, None, {}
        )
        assert results[0]["actions_executed"][0]["result"] == "sent"

    def test_webhook_action_posts_to_configured_url(self, db):
        org = _make_user(db, UserRole.admin).org_id
        rule = _rule(
            db,
            org,
            RuleEventType.manual_trigger,
            actions=[
                {
                    "action_type": "trigger_webhook",
                    "params": {"url": "https://example.com/hook"},
                }
            ],
            condition_groups=[{"conditions": []}],
        )
        with patch("httpx.request") as mock_request:
            mock_request.return_value.status_code = 200
            results = evaluate_automation_rules(
                db, RuleEventType.manual_trigger, org, "transaction", "txn_1", {}
            )
        assert results[0]["actions_executed"][0]["result"] == "sent"
        assert results[0]["actions_executed"][0]["status_code"] == 200
        mock_request.assert_called_once()

    def test_webhook_action_without_url_is_a_noop(self, db):
        org = _make_user(db, UserRole.admin).org_id
        rule = _rule(
            db,
            org,
            RuleEventType.manual_trigger,
            actions=[{"action_type": "trigger_webhook", "params": {}}],
            condition_groups=[{"conditions": []}],
        )
        results = evaluate_automation_rules(
            db, RuleEventType.manual_trigger, org, None, None, {}
        )
        assert results[0]["actions_executed"][0]["result"] == "not_applicable"

    def test_manual_action_required_actions_report_but_never_execute(self, db):
        org = _make_user(db, UserRole.admin).org_id
        rule = _rule(
            db,
            org,
            RuleEventType.manual_trigger,
            actions=[{"action_type": "post_to_slack", "params": {}}],
            condition_groups=[{"conditions": []}],
        )
        results = evaluate_automation_rules(
            db, RuleEventType.manual_trigger, org, None, None, {}
        )
        assert results[0]["actions_executed"][0]["result"] == "manual_action_required"

    def test_schedule_review_action_creates_calendar_item_for_customer(self, db):
        org = _make_user(db, UserRole.admin).org_id
        customer = _customer(db, org, risk_level=RiskLevel.high)
        rule = _rule(
            db,
            org,
            RuleEventType.customer_risk_changed,
            actions=[{"action_type": "schedule_review", "params": {}}],
            condition_groups=[{"conditions": []}],
        )
        results = evaluate_automation_rules(
            db,
            RuleEventType.customer_risk_changed,
            org,
            "customer",
            customer.id,
            customer_context(customer),
        )
        assert results[0]["actions_executed"][0]["result"] == "created"

    def test_schedule_review_action_is_a_noop_without_a_real_customer(self, db):
        org = _make_user(db, UserRole.admin).org_id
        rule = _rule(
            db,
            org,
            RuleEventType.customer_risk_changed,
            actions=[{"action_type": "schedule_review", "params": {}}],
            condition_groups=[{"conditions": []}],
        )
        results = evaluate_automation_rules(
            db,
            RuleEventType.customer_risk_changed,
            org,
            "customer",
            "cust_does_not_exist",
            {},
        )
        assert results[0]["actions_executed"][0]["result"] == "not_applicable"

    def test_create_calendar_item_action(self, db):
        org = _make_user(db, UserRole.admin).org_id
        rule = _rule(
            db,
            org,
            RuleEventType.compliance_item_due,
            actions=[
                {
                    "action_type": "create_calendar_item",
                    "params": {"item_type": "policy_review", "title": "Annual policy review"},
                }
            ],
            condition_groups=[{"conditions": []}],
        )
        results = evaluate_automation_rules(
            db, RuleEventType.compliance_item_due, org, None, None, {}
        )
        assert results[0]["actions_executed"][0]["result"] == "created"

    def test_webhook_action_records_http_error(self, db):
        import httpx

        org = _make_user(db, UserRole.admin).org_id
        rule = _rule(
            db,
            org,
            RuleEventType.manual_trigger,
            actions=[
                {"action_type": "trigger_webhook", "params": {"url": "https://example.com/hook"}}
            ],
            condition_groups=[{"conditions": []}],
        )
        with patch("httpx.request", side_effect=httpx.ConnectTimeout("timed out")):
            results = evaluate_automation_rules(
                db, RuleEventType.manual_trigger, org, None, None, {}
            )
        assert results[0]["actions_executed"][0]["result"] == "error"

    def test_action_exception_is_caught_and_recorded_not_raised(self, db):
        """_execute_action must never crash rule evaluation -- a malformed
        params dict for create_alert (invalid enum value) is recorded as an
        error result, not propagated as an exception."""
        org = _make_user(db, UserRole.admin).org_id
        customer = _customer(db, org)
        txn = _transaction(db, org, customer.id)
        rule = _rule(
            db,
            org,
            RuleEventType.transaction_created,
            actions=[
                {
                    "action_type": "create_alert",
                    "params": {"severity": "not-a-real-severity"},
                }
            ],
            condition_groups=[{"conditions": []}],
        )
        results = evaluate_automation_rules(
            db,
            RuleEventType.transaction_created,
            org,
            "transaction",
            txn.id,
            transaction_context(txn),
        )
        assert results[0]["actions_executed"][0]["result"] == "error"

    def test_inactive_rules_are_not_evaluated(self, db):
        org = _make_user(db, UserRole.admin).org_id
        customer = _customer(db, org)
        rule = _rule(
            db,
            org,
            RuleEventType.customer_created,
            actions=[{"action_type": "create_case"}],
            condition_groups=[{"conditions": []}],
            status=AutomationRuleStatus.inactive,
        )
        results = evaluate_automation_rules(
            db,
            RuleEventType.customer_created,
            org,
            "customer",
            customer.id,
            customer_context(customer),
        )
        assert results == []
        assert db.query(Case).filter(Case.org_id == org).count() == 0

    def test_execution_log_written_even_when_no_rule_matches(self, db):
        org = _make_user(db, UserRole.admin).org_id
        customer = _customer(db, org)
        rule = _rule(
            db,
            org,
            RuleEventType.customer_created,
            actions=[{"action_type": "create_case"}],
            condition_groups=[
                {"conditions": [{"field": "customer.risk_level", "operator": "eq", "value": "critical"}]}
            ],
        )
        results = evaluate_automation_rules(
            db,
            RuleEventType.customer_created,
            org,
            "customer",
            customer.id,
            customer_context(customer),
        )
        assert results == []
        execution = (
            db.query(AutomationRuleExecution)
            .filter(AutomationRuleExecution.rule_id == rule.id)
            .first()
        )
        assert execution is not None
        assert execution.conditions_matched is False

    def test_trigger_count_increments_on_match(self, db):
        org = _make_user(db, UserRole.admin).org_id
        customer = _customer(db, org)
        rule = _rule(
            db,
            org,
            RuleEventType.customer_created,
            actions=[{"action_type": "create_case"}],
            condition_groups=[{"conditions": []}],
        )
        assert rule.trigger_count in (0, None)
        evaluate_automation_rules(
            db,
            RuleEventType.customer_created,
            org,
            "customer",
            customer.id,
            customer_context(customer),
        )
        db.refresh(rule)
        assert rule.trigger_count == 1
