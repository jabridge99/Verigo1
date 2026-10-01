"""
P54: real coverage for app/services/risk_triggered_training_service.py
(11% covered before this file existed) -- the risk-event -> training
feedback loop. Its main entry point, evaluate_risk_event(), is called
directly by other services (customer/transaction/case escalation flows)
rather than through its own HTTP route, so most tests here call the
service functions directly; the one real HTTP surface it has --
app/api/routes/training_triggers.py's "/rules/{id}/fire" and
"/regulatory-updates/{id}/publish" endpoints -- is exercised through the
real API to prove the wiring, not just the service logic in isolation.

Highest-risk parts, and what these tests are organised around:
  - condition matching (_conditions_match) and target resolution
    (_resolve_target_users) -- wrong logic here silently assigns training
    to the wrong staff, or to nobody, with no error to surface it
  - the system-rule override logic in evaluate_risk_event: an org rule
    with override_system=True must suppress the platform default rule,
    not fire alongside it
  - cooldown suppression (_is_in_cooldown) -- must not re-assign the same
    course to the same user inside the cooldown window
  - regulatory update publish's industry/role targeting and cross-org
    tenant isolation
  - the assessment-flag oversight escalation rule (2nd+ failed attempt
    requires MLRO oversight)
  - the training gap report's risk_level rule and cross-org isolation
"""

import uuid
from datetime import date, datetime, timedelta, timezone

from app.models.aml_solution import AMLSolution
from app.models.case import Case, CaseSeverity, CaseStatus, CaseType
from app.models.customer import Customer, CustomerStatus, CustomerType, RiskLevel
from app.models.governance_training import (
    AssignmentTrigger,
    GovernanceTrainingRecord,
    TrainingAssignment,
    TrainingCourse,
    TrainingStatus,
    TrainingType,
)
from app.models.monitoring import AlertCategory, AlertSeverity, AlertStatus, AlertType, TransactionAlert
from app.models.organisation import IndustryType, Organisation
from app.models.training_trigger import (
    AssessmentFlagStatus,
    AssessmentOutcomeFlag,
    IssuingBody,
    RegulatoryUpdateEvent,
    TrainingTriggerLog,
    TrainingTriggerRule,
    TriggerEventType,
    TriggerStatus,
    TriggerTargetType,
)
from app.models.transaction import Transaction, TransactionType
from app.services import risk_triggered_training_service as svc
from tests.conftest import UserRole, _auth, _make_org, _make_user

BASE = "/api/v1/training-triggers"


# ══════════════════════════════════════════════════════════════════════════════
# HELPERS
# ══════════════════════════════════════════════════════════════════════════════


def _solution(db, org_id):
    s = AMLSolution(org_id=org_id, created_by="someone")
    db.add(s)
    db.commit()
    db.refresh(s)
    return s


def _setup(db):
    """A real org with an AML solution and a full role cast, all sharing
    one org so target-resolution and tenant-isolation rules are actually
    exercised."""
    admin = _make_user(db, UserRole.admin)
    org_id = admin.org_id
    _solution(db, org_id)
    compliance = _make_user(db, UserRole.compliance, industry_id=org_id)
    analyst = _make_user(db, UserRole.analyst, industry_id=org_id)
    mlro = _make_user(db, UserRole.mlro, industry_id=org_id)
    return admin, compliance, analyst, mlro


def _course(db, org_id, **overrides):
    solution = db.query(AMLSolution).filter_by(org_id=org_id).first()
    defaults = dict(
        id=f"tc_{uuid.uuid4().hex[:12]}",
        org_id=org_id,
        solution_id=solution.id if solution else None,
        course_code=f"TRN-{uuid.uuid4().hex[:6].upper()}",
        name="Test Course",
        training_type=TrainingType.edd_training,
        is_custom=True,
        is_active=True,
        max_attempts=3,
    )
    defaults.update(overrides)
    c = TrainingCourse(**defaults)
    db.add(c)
    db.commit()
    db.refresh(c)
    return c


def _rule(db, org_id, course_id, event_type, **overrides):
    defaults = dict(
        id=f"ttr_{uuid.uuid4().hex[:12]}",
        org_id=org_id,
        name="Test Rule",
        event_type=event_type,
        condition_filter={},
        course_id=course_id,
        target_type=TriggerTargetType.handled_analyst,
        due_days=14,
        priority="normal",
        cooldown_days=90,
        is_system=False,
        override_system=False,
        created_by="someone",
    )
    defaults.update(overrides)
    r = TrainingTriggerRule(**defaults)
    db.add(r)
    db.commit()
    db.refresh(r)
    return r


def _record(db, org_id, course_id, user_id, **overrides):
    solution = db.query(AMLSolution).filter_by(org_id=org_id).first()
    defaults = dict(
        id=f"gtr_{uuid.uuid4().hex[:12]}",
        org_id=org_id,
        solution_id=solution.id,
        course_id=course_id,
        user_id=user_id,
        assigned_date=date.today(),
        due_date=date.today() + timedelta(days=30),
        status=TrainingStatus.assigned,
    )
    defaults.update(overrides)
    r = GovernanceTrainingRecord(**defaults)
    db.add(r)
    db.commit()
    db.refresh(r)
    return r


def _customer(db, org_id, **overrides):
    defaults = dict(
        customer_ref=f"CUST-{uuid.uuid4().hex[:8]}",
        org_id=org_id,
        customer_type=CustomerType.individual,
        full_name="Test Customer",
        risk_level=RiskLevel.low,
        status=CustomerStatus.active,
    )
    defaults.update(overrides)
    c = Customer(**defaults)
    db.add(c)
    db.commit()
    db.refresh(c)
    return c


def _txn(db, org_id, customer_id, **overrides):
    defaults = dict(
        id=f"txn_{uuid.uuid4().hex[:12]}",
        org_id=org_id,
        transaction_ref=f"TXN-{uuid.uuid4().hex[:8]}",
        customer_id=customer_id,
        transaction_type=TransactionType.transfer,
        direction="outgoing",
        payment_method="bank_transfer",
        amount=1000.0,
        amount_aud=1000.0,
        currency="AUD",
        transaction_date=datetime.now(timezone.utc),
    )
    defaults.update(overrides)
    t = Transaction(**defaults)
    db.add(t)
    db.commit()
    return t


def _alert(db, org_id, customer_id, **overrides):
    if "transaction_id" not in overrides:
        overrides["transaction_id"] = _txn(db, org_id, customer_id).id
    defaults = dict(
        id=f"alrt_{uuid.uuid4().hex[:10]}",
        alert_ref=f"ALRT-{uuid.uuid4().hex[:8]}",
        org_id=org_id,
        customer_id=customer_id,
        alert_type=AlertType.rule_triggered,
        category=AlertCategory.custom,
        severity=AlertSeverity.medium,
        status=AlertStatus.generated,
        title="Test alert",
        trigger_date=datetime.now(timezone.utc),
    )
    defaults.update(overrides)
    a = TransactionAlert(**defaults)
    db.add(a)
    db.commit()
    return a


def _case(db, org_id, **overrides):
    defaults = dict(
        id=f"case_{uuid.uuid4().hex[:12]}",
        case_ref=f"CASE-{uuid.uuid4().hex[:8]}",
        org_id=org_id,
        case_type=CaseType.other,
        severity=CaseSeverity.medium,
        status=CaseStatus.open,
        title="Test case",
        created_by="someone",
        created_at=datetime.now(timezone.utc),
    )
    defaults.update(overrides)
    c = Case(**defaults)
    db.add(c)
    db.commit()
    return c


# ══════════════════════════════════════════════════════════════════════════════
# CONDITION MATCHING
# ══════════════════════════════════════════════════════════════════════════════


class TestConditionsMatch:
    def test_empty_filter_matches_everything(self):
        assert svc._conditions_match({}, {}) is True
        assert svc._conditions_match({}, {"risk_level": "low"}) is True

    def test_list_condition_matches_when_value_in_list(self):
        assert (
            svc._conditions_match({"risk_level": ["high", "critical"]}, {"risk_level": "high"})
            is True
        )

    def test_list_condition_fails_when_value_not_in_list(self):
        assert (
            svc._conditions_match({"risk_level": ["high", "critical"]}, {"risk_level": "low"})
            is False
        )

    def test_bool_condition_matches_exactly(self):
        assert svc._conditions_match({"is_pep": True}, {"is_pep": True}) is True
        assert svc._conditions_match({"is_pep": True}, {"is_pep": False}) is False

    def test_threshold_condition_is_greater_than_or_equal(self):
        assert svc._conditions_match({"amount_aud_gte": 50000}, {"amount_aud_gte": 50000}) is True
        assert svc._conditions_match({"amount_aud_gte": 50000}, {"amount_aud_gte": 75000}) is True
        assert svc._conditions_match({"amount_aud_gte": 50000}, {"amount_aud_gte": 49999}) is False

    def test_threshold_condition_non_numeric_actual_fails_closed(self):
        assert (
            svc._conditions_match({"amount_aud_gte": 50000}, {"amount_aud_gte": "lots"}) is False
        )

    def test_equality_condition_for_plain_strings(self):
        assert svc._conditions_match({"industry": "remittance"}, {"industry": "remittance"}) is True
        assert svc._conditions_match({"industry": "remittance"}, {"industry": "vasp"}) is False

    def test_missing_key_in_snapshot_fails_the_condition(self):
        assert svc._conditions_match({"is_pep": True}, {}) is False

    def test_multiple_conditions_are_and_ed(self):
        cf = {"risk_level": ["high"], "is_pep": True}
        assert svc._conditions_match(cf, {"risk_level": "high", "is_pep": True}) is True
        assert svc._conditions_match(cf, {"risk_level": "high", "is_pep": False}) is False


# ══════════════════════════════════════════════════════════════════════════════
# TARGET RESOLUTION
# ══════════════════════════════════════════════════════════════════════════════


class TestResolveTargetUsers:
    def test_handled_analyst_returns_only_that_user(self, db):
        admin, compliance, analyst, mlro = _setup(db)
        course = _course(db, admin.org_id)
        rule = _rule(
            db, admin.org_id, course.id, TriggerEventType.edd_escalation,
            target_type=TriggerTargetType.handled_analyst,
        )
        result = svc._resolve_target_users(db, rule, admin.org_id, analyst.id)
        assert [u.id for u in result] == [analyst.id]

    def test_handled_analyst_returns_empty_without_handled_by_id(self, db):
        admin, *_ = _setup(db)
        course = _course(db, admin.org_id)
        rule = _rule(
            db, admin.org_id, course.id, TriggerEventType.edd_escalation,
            target_type=TriggerTargetType.handled_analyst,
        )
        assert svc._resolve_target_users(db, rule, admin.org_id, None) == []

    def test_handled_analyst_from_another_org_is_ignored(self, db):
        admin, *_ = _setup(db)
        other_org = _make_org(db)
        other_user = _make_user(db, UserRole.analyst, industry_id=other_org.id)
        course = _course(db, admin.org_id)
        rule = _rule(
            db, admin.org_id, course.id, TriggerEventType.edd_escalation,
            target_type=TriggerTargetType.handled_analyst,
        )
        assert svc._resolve_target_users(db, rule, admin.org_id, other_user.id) == []

    def test_all_role_returns_only_matching_role(self, db):
        admin, compliance, analyst, mlro = _setup(db)
        course = _course(db, admin.org_id)
        rule = _rule(
            db, admin.org_id, course.id, TriggerEventType.crypto_mixer_exposure,
            target_type=TriggerTargetType.all_role, target_roles=["analyst"],
        )
        result = svc._resolve_target_users(db, rule, admin.org_id, None)
        assert {u.id for u in result} == {analyst.id}

    def test_all_role_with_no_roles_configured_returns_empty(self, db):
        admin, *_ = _setup(db)
        course = _course(db, admin.org_id)
        rule = _rule(
            db, admin.org_id, course.id, TriggerEventType.crypto_mixer_exposure,
            target_type=TriggerTargetType.all_role, target_roles=[],
        )
        assert svc._resolve_target_users(db, rule, admin.org_id, None) == []

    def test_all_staff_excludes_other_orgs(self, db):
        admin, compliance, analyst, mlro = _setup(db)
        other_org = _make_org(db)
        _make_user(db, UserRole.analyst, industry_id=other_org.id)
        course = _course(db, admin.org_id)
        rule = _rule(
            db, admin.org_id, course.id, TriggerEventType.training_overdue,
            target_type=TriggerTargetType.all_staff,
        )
        result = svc._resolve_target_users(db, rule, admin.org_id, None)
        assert {u.id for u in result} == {admin.id, compliance.id, analyst.id, mlro.id}

    def test_specific_users_filters_to_the_listed_ids_within_org(self, db):
        admin, compliance, analyst, mlro = _setup(db)
        other_org = _make_org(db)
        other_user = _make_user(db, UserRole.analyst, industry_id=other_org.id)
        course = _course(db, admin.org_id)
        rule = _rule(
            db, admin.org_id, course.id, TriggerEventType.policy_update,
            target_type=TriggerTargetType.specific_users,
            specific_user_ids=[analyst.id, mlro.id, other_user.id],
        )
        result = svc._resolve_target_users(db, rule, admin.org_id, None)
        # other_user's id is listed but belongs to a different org -- excluded.
        assert {u.id for u in result} == {analyst.id, mlro.id}

    def test_mlro_only_excludes_compliance_and_analyst(self, db):
        admin, compliance, analyst, mlro = _setup(db)
        course = _course(db, admin.org_id)
        rule = _rule(
            db, admin.org_id, course.id, TriggerEventType.sanctions_match,
            target_type=TriggerTargetType.mlro_only,
        )
        result = svc._resolve_target_users(db, rule, admin.org_id, None)
        assert {u.id for u in result} == {admin.id, mlro.id}

    def test_compliance_team_includes_admin_mlro_compliance_not_analyst(self, db):
        admin, compliance, analyst, mlro = _setup(db)
        course = _course(db, admin.org_id)
        rule = _rule(
            db, admin.org_id, course.id, TriggerEventType.sanctions_match,
            target_type=TriggerTargetType.compliance_team,
        )
        result = svc._resolve_target_users(db, rule, admin.org_id, None)
        assert {u.id for u in result} == {admin.id, mlro.id, compliance.id}


# ══════════════════════════════════════════════════════════════════════════════
# COOLDOWN
# ══════════════════════════════════════════════════════════════════════════════


class TestCooldown:
    def test_no_recent_record_is_not_in_cooldown(self, db):
        admin, compliance, analyst, mlro = _setup(db)
        course = _course(db, admin.org_id)
        assert svc._is_in_cooldown(db, analyst.id, course.id, 90) is False

    def test_recent_record_within_cooldown_blocks(self, db):
        admin, compliance, analyst, mlro = _setup(db)
        course = _course(db, admin.org_id)
        _record(
            db, admin.org_id, course.id, analyst.id,
            created_at=datetime.now(timezone.utc) - timedelta(days=10),
        )
        assert svc._is_in_cooldown(db, analyst.id, course.id, 90) is True

    def test_record_older_than_cooldown_does_not_block(self, db):
        admin, compliance, analyst, mlro = _setup(db)
        course = _course(db, admin.org_id)
        _record(
            db, admin.org_id, course.id, analyst.id,
            created_at=datetime.now(timezone.utc) - timedelta(days=100),
        )
        assert svc._is_in_cooldown(db, analyst.id, course.id, 90) is False

    def test_zero_cooldown_never_blocks(self, db):
        admin, compliance, analyst, mlro = _setup(db)
        course = _course(db, admin.org_id)
        _record(db, admin.org_id, course.id, analyst.id, created_at=datetime.now(timezone.utc))
        assert svc._is_in_cooldown(db, analyst.id, course.id, 0) is False

    def test_cooldown_is_scoped_per_course(self, db):
        admin, compliance, analyst, mlro = _setup(db)
        course_a = _course(db, admin.org_id, training_type=TrainingType.edd_training)
        course_b = _course(db, admin.org_id, training_type=TrainingType.pep_training)
        _record(db, admin.org_id, course_a.id, analyst.id, created_at=datetime.now(timezone.utc))
        assert svc._is_in_cooldown(db, analyst.id, course_b.id, 90) is False


# ══════════════════════════════════════════════════════════════════════════════
# EVENT -> ASSIGNMENT TRIGGER MAPPING
# ══════════════════════════════════════════════════════════════════════════════


class TestEventToAssignmentTrigger:
    def test_mapped_events(self):
        assert svc._event_to_assignment_trigger(TriggerEventType.smr_filed) == AssignmentTrigger.incident
        assert (
            svc._event_to_assignment_trigger(TriggerEventType.regulatory_update)
            == AssignmentTrigger.regulatory_change
        )
        assert (
            svc._event_to_assignment_trigger(TriggerEventType.policy_update)
            == AssignmentTrigger.policy_update
        )
        assert (
            svc._event_to_assignment_trigger(TriggerEventType.independent_review_finding)
            == AssignmentTrigger.incident
        )

    def test_unmapped_event_defaults_to_incident(self):
        assert (
            svc._event_to_assignment_trigger(TriggerEventType.edd_escalation)
            == AssignmentTrigger.incident
        )


# ══════════════════════════════════════════════════════════════════════════════
# evaluate_risk_event() -- the main entry point
# ══════════════════════════════════════════════════════════════════════════════


class TestEvaluateRiskEvent:
    def test_no_matching_rules_returns_zero(self, db):
        admin, *_ = _setup(db)
        result = svc.evaluate_risk_event(
            db, TriggerEventType.edd_escalation, admin.org_id,
            entity_type="customer", entity_id="cust_1", entity_snapshot={},
        )
        assert result == {
            "event_type": TriggerEventType.edd_escalation,
            "rules_matched": 0,
            "assignments_created": 0,
        }

    def test_matching_org_rule_creates_assignment_and_log(self, db):
        admin, compliance, analyst, mlro = _setup(db)
        course = _course(db, admin.org_id)
        _rule(
            db, admin.org_id, course.id, TriggerEventType.edd_escalation,
            target_type=TriggerTargetType.handled_analyst,
        )

        result = svc.evaluate_risk_event(
            db, TriggerEventType.edd_escalation, admin.org_id,
            entity_type="customer", entity_id="cust_1", entity_snapshot={},
            handled_by_user_id=analyst.id,
        )
        assert result["rules_matched"] == 1
        assert result["assignments_created"] == 1

        record = (
            db.query(GovernanceTrainingRecord)
            .filter_by(org_id=admin.org_id, course_id=course.id, user_id=analyst.id)
            .first()
        )
        assert record is not None
        assert record.status == TrainingStatus.assigned

        log = db.query(TrainingTriggerLog).filter_by(org_id=admin.org_id).first()
        assert log.assignments_created == 1
        assert log.users_assigned == [analyst.id]
        assert log.skipped_users == []

    def test_condition_filter_mismatch_skips_the_rule(self, db):
        admin, compliance, analyst, mlro = _setup(db)
        course = _course(db, admin.org_id)
        _rule(
            db, admin.org_id, course.id, TriggerEventType.critical_alert,
            target_type=TriggerTargetType.handled_analyst,
            condition_filter={"alert_severity": ["critical"]},
        )

        result = svc.evaluate_risk_event(
            db, TriggerEventType.critical_alert, admin.org_id,
            entity_type="alert", entity_id="al_1",
            entity_snapshot={"alert_severity": "medium"},
            handled_by_user_id=analyst.id,
        )
        assert result["rules_matched"] == 0
        assert result["assignments_created"] == 0

    def test_no_target_users_resolved_skips_the_rule_without_a_log(self, db):
        admin, *_ = _setup(db)
        course = _course(db, admin.org_id)
        _rule(
            db, admin.org_id, course.id, TriggerEventType.edd_escalation,
            target_type=TriggerTargetType.handled_analyst,
        )
        # No handled_by_user_id -> _resolve_target_users returns [].
        result = svc.evaluate_risk_event(
            db, TriggerEventType.edd_escalation, admin.org_id,
            entity_type="customer", entity_id="cust_1", entity_snapshot={},
        )
        assert result["rules_matched"] == 0
        assert db.query(TrainingTriggerLog).count() == 0

    def test_cooldown_suppresses_second_assignment_within_window(self, db):
        admin, compliance, analyst, mlro = _setup(db)
        course = _course(db, admin.org_id)
        _rule(
            db, admin.org_id, course.id, TriggerEventType.edd_escalation,
            target_type=TriggerTargetType.handled_analyst, cooldown_days=90,
        )

        svc.evaluate_risk_event(
            db, TriggerEventType.edd_escalation, admin.org_id,
            entity_type="customer", entity_id="cust_1", entity_snapshot={},
            handled_by_user_id=analyst.id,
        )
        second = svc.evaluate_risk_event(
            db, TriggerEventType.edd_escalation, admin.org_id,
            entity_type="customer", entity_id="cust_2", entity_snapshot={},
            handled_by_user_id=analyst.id,
        )
        assert second["assignments_created"] == 0
        log = db.query(TrainingTriggerLog).filter_by(entity_id="cust_2").first()
        assert log.skipped_users == [analyst.id]

        # The assignment row itself still records how many were *actually*
        # assigned after cooldown skips, not the target list size.
        assignments = (
            db.query(TrainingAssignment).filter_by(org_id=admin.org_id, course_id=course.id).all()
        )
        assert sorted(a.total_assigned for a in assignments) == [0, 1]

    def test_no_aml_solution_skips_assignment_entirely(self, db):
        # An org with users and a course but (unusually) no AMLSolution row.
        admin = _make_user(db, UserRole.admin)
        analyst = _make_user(db, UserRole.analyst, industry_id=admin.org_id)
        course = TrainingCourse(
            id=f"tc_{uuid.uuid4().hex[:12]}",
            org_id=admin.org_id,
            solution_id=None,
            course_code="TRN-X",
            name="No Solution Course",
            training_type=TrainingType.edd_training,
            is_custom=True,
        )
        db.add(course)
        db.commit()
        _rule(
            db, admin.org_id, course.id, TriggerEventType.edd_escalation,
            target_type=TriggerTargetType.handled_analyst,
        )

        result = svc.evaluate_risk_event(
            db, TriggerEventType.edd_escalation, admin.org_id,
            entity_type="customer", entity_id="cust_1", entity_snapshot={},
            handled_by_user_id=analyst.id,
        )
        assert result["assignments_created"] == 0
        assert db.query(GovernanceTrainingRecord).count() == 0

    def test_global_system_rule_fires_when_org_has_no_override(self, db):
        admin, compliance, analyst, mlro = _setup(db)
        course = _course(db, admin.org_id)
        global_rule = _rule(
            db, None, course.id, TriggerEventType.pep_detected,
            target_type=TriggerTargetType.handled_analyst,
            is_system=True, created_by="platform",
        )
        result = svc.evaluate_risk_event(
            db, TriggerEventType.pep_detected, admin.org_id,
            entity_type="customer", entity_id="cust_1", entity_snapshot={},
            handled_by_user_id=analyst.id,
        )
        assert result["rules_matched"] == 1
        log = db.query(TrainingTriggerLog).filter_by(org_id=admin.org_id).first()
        assert log.rule_id == global_rule.id

    def test_org_override_rule_suppresses_the_global_system_rule(self, db):
        admin, compliance, analyst, mlro = _setup(db)
        global_course = _course(db, admin.org_id, name="Global course")
        org_course = _course(db, admin.org_id, name="Org override course")
        _rule(
            db, None, global_course.id, TriggerEventType.pep_detected,
            target_type=TriggerTargetType.handled_analyst,
            is_system=True, created_by="platform",
        )
        _rule(
            db, admin.org_id, org_course.id, TriggerEventType.pep_detected,
            target_type=TriggerTargetType.handled_analyst,
            override_system=True,
        )

        result = svc.evaluate_risk_event(
            db, TriggerEventType.pep_detected, admin.org_id,
            entity_type="customer", entity_id="cust_1", entity_snapshot={},
            handled_by_user_id=analyst.id,
        )
        # Only the org's own rule fires -- the global rule is suppressed.
        assert result["rules_matched"] == 1
        record = db.query(GovernanceTrainingRecord).filter_by(org_id=admin.org_id).first()
        assert record.course_id == org_course.id

    def test_org_rule_without_override_adds_to_the_global_rule(self, db):
        admin, compliance, analyst, mlro = _setup(db)
        global_course = _course(db, admin.org_id, name="Global course")
        org_course = _course(db, admin.org_id, name="Org extra course")
        _rule(
            db, None, global_course.id, TriggerEventType.pep_detected,
            target_type=TriggerTargetType.handled_analyst,
            is_system=True, created_by="platform",
        )
        _rule(
            db, admin.org_id, org_course.id, TriggerEventType.pep_detected,
            target_type=TriggerTargetType.handled_analyst,
            override_system=False,
        )

        result = svc.evaluate_risk_event(
            db, TriggerEventType.pep_detected, admin.org_id,
            entity_type="customer", entity_id="cust_1", entity_snapshot={},
            handled_by_user_id=analyst.id,
        )
        assert result["rules_matched"] == 2
        assert result["assignments_created"] == 2

    def test_another_orgs_rules_never_fire_for_this_org(self, db):
        admin, compliance, analyst, mlro = _setup(db)
        other_admin = _make_user(db, UserRole.admin)
        _solution(db, other_admin.org_id)
        other_course = _course(db, other_admin.org_id)
        _rule(
            db, other_admin.org_id, other_course.id, TriggerEventType.edd_escalation,
            target_type=TriggerTargetType.handled_analyst,
        )

        result = svc.evaluate_risk_event(
            db, TriggerEventType.edd_escalation, admin.org_id,
            entity_type="customer", entity_id="cust_1", entity_snapshot={},
            handled_by_user_id=analyst.id,
        )
        assert result["rules_matched"] == 0


# ══════════════════════════════════════════════════════════════════════════════
# MANUAL FIRE (HTTP) -- proves the real route wiring
# ══════════════════════════════════════════════════════════════════════════════


class TestManualFireEndpoint:
    def test_manual_fire_requires_mlro_or_above(self, client, db):
        admin, compliance, analyst, mlro = _setup(db)
        course = _course(db, admin.org_id)
        rule = _rule(
            db, admin.org_id, course.id, TriggerEventType.edd_escalation,
            target_type=TriggerTargetType.handled_analyst, created_by=admin.id,
        )
        resp = client.post(
            f"{BASE}/rules/{rule.id}/fire",
            json={"entity_type": "customer", "entity_id": "cust_1", "handled_by_user_id": analyst.id},
            headers=_auth(analyst),
        )
        assert resp.status_code == 403

    def test_manual_fire_creates_assignment_through_the_real_route(self, client, db):
        admin, compliance, analyst, mlro = _setup(db)
        course = _course(db, admin.org_id)
        rule = _rule(
            db, admin.org_id, course.id, TriggerEventType.edd_escalation,
            target_type=TriggerTargetType.handled_analyst, created_by=admin.id,
        )
        resp = client.post(
            f"{BASE}/rules/{rule.id}/fire",
            json={"entity_type": "customer", "entity_id": "cust_1", "handled_by_user_id": analyst.id},
            headers=_auth(mlro),
        )
        assert resp.status_code == 200, resp.text
        assert resp.json()["assignments_created"] == 1

    def test_manual_fire_rejects_inactive_rule(self, client, db):
        admin, compliance, analyst, mlro = _setup(db)
        course = _course(db, admin.org_id)
        rule = _rule(
            db, admin.org_id, course.id, TriggerEventType.edd_escalation,
            target_type=TriggerTargetType.handled_analyst, created_by=admin.id,
            status=TriggerStatus.inactive,
        )
        resp = client.post(
            f"{BASE}/rules/{rule.id}/fire",
            json={"entity_type": "customer", "entity_id": "cust_1"},
            headers=_auth(mlro),
        )
        assert resp.status_code == 422

    def test_manual_fire_rejects_rule_from_another_org(self, client, db):
        admin, compliance, analyst, mlro = _setup(db)
        other_admin = _make_user(db, UserRole.admin)
        _solution(db, other_admin.org_id)
        other_course = _course(db, other_admin.org_id)
        other_rule = _rule(
            db, other_admin.org_id, other_course.id, TriggerEventType.edd_escalation,
            target_type=TriggerTargetType.handled_analyst, created_by=other_admin.id,
        )
        resp = client.post(
            f"{BASE}/rules/{other_rule.id}/fire",
            json={"entity_type": "customer", "entity_id": "cust_1"},
            headers=_auth(mlro),
        )
        assert resp.status_code == 404


# ══════════════════════════════════════════════════════════════════════════════
# TRIGGER RULE CRUD (HTTP)
# ══════════════════════════════════════════════════════════════════════════════


class TestTriggerRuleCrud:
    def test_create_rule_requires_course_in_own_org(self, client, db):
        admin, compliance, analyst, mlro = _setup(db)
        other_admin = _make_user(db, UserRole.admin)
        _solution(db, other_admin.org_id)
        other_course = _course(db, other_admin.org_id)

        resp = client.post(
            f"{BASE}/rules",
            json={
                "name": "x", "event_type": "edd_escalation", "course_id": other_course.id,
                "target_type": "handled_analyst",
            },
            headers=_auth(mlro),
        )
        assert resp.status_code == 404

    def test_create_and_get_rule_round_trips(self, client, db):
        admin, compliance, analyst, mlro = _setup(db)
        course = _course(db, admin.org_id)
        create_resp = client.post(
            f"{BASE}/rules",
            json={
                "name": "Custom EDD rule", "event_type": "edd_escalation", "course_id": course.id,
                "target_type": "handled_analyst", "due_days": 21,
            },
            headers=_auth(mlro),
        )
        assert create_resp.status_code == 200, create_resp.text
        rule_id = create_resp.json()["id"]

        get_resp = client.get(f"{BASE}/rules/{rule_id}", headers=_auth(compliance))
        assert get_resp.json()["due_days"] == 21
        assert get_resp.json()["times_fired"] == 0

    def test_list_rules_can_include_or_exclude_system_rules(self, client, db):
        admin, compliance, analyst, mlro = _setup(db)
        course = _course(db, admin.org_id)
        _rule(
            db, None, course.id, TriggerEventType.pep_detected,
            target_type=TriggerTargetType.handled_analyst, is_system=True, created_by="platform",
        )

        resp = client.get(f"{BASE}/rules", headers=_auth(compliance))
        assert any(r["is_system"] for r in resp.json())

        resp2 = client.get(f"{BASE}/rules?include_system=false", headers=_auth(compliance))
        assert not any(r["is_system"] for r in resp2.json())

    def test_cannot_edit_a_global_system_rule(self, client, db):
        admin, compliance, analyst, mlro = _setup(db)
        course = _course(db, admin.org_id)
        rule = _rule(
            db, None, course.id, TriggerEventType.pep_detected,
            target_type=TriggerTargetType.handled_analyst, is_system=True, created_by="platform",
        )
        resp = client.patch(f"{BASE}/rules/{rule.id}", json={"due_days": 1}, headers=_auth(mlro))
        assert resp.status_code == 422

    def test_cannot_delete_a_global_system_rule(self, client, db):
        admin, compliance, analyst, mlro = _setup(db)
        course = _course(db, admin.org_id)
        rule = _rule(
            db, None, course.id, TriggerEventType.pep_detected,
            target_type=TriggerTargetType.handled_analyst, is_system=True, created_by="platform",
        )
        resp = client.delete(f"{BASE}/rules/{rule.id}", headers=_auth(mlro))
        assert resp.status_code == 422

    def test_deactivate_an_org_rule_archives_it(self, client, db):
        admin, compliance, analyst, mlro = _setup(db)
        course = _course(db, admin.org_id)
        rule = _rule(
            db, admin.org_id, course.id, TriggerEventType.edd_escalation,
            target_type=TriggerTargetType.handled_analyst, created_by=admin.id,
        )
        resp = client.delete(f"{BASE}/rules/{rule.id}", headers=_auth(mlro))
        assert resp.status_code == 200
        db.expire_all()
        refreshed = db.query(TrainingTriggerRule).filter_by(id=rule.id).first()
        assert refreshed.status == TriggerStatus.archived


# ══════════════════════════════════════════════════════════════════════════════
# TRIGGER LOGS (HTTP)
# ══════════════════════════════════════════════════════════════════════════════


class TestTriggerLogsEndpoint:
    def test_logs_are_filterable_and_scoped_to_org(self, client, db):
        admin, compliance, analyst, mlro = _setup(db)
        course = _course(db, admin.org_id)
        _rule(
            db, admin.org_id, course.id, TriggerEventType.edd_escalation,
            target_type=TriggerTargetType.handled_analyst, created_by=admin.id,
        )
        svc.evaluate_risk_event(
            db, TriggerEventType.edd_escalation, admin.org_id,
            entity_type="customer", entity_id="cust_1", entity_snapshot={},
            handled_by_user_id=analyst.id,
        )

        other_admin = _make_user(db, UserRole.admin)
        _solution(db, other_admin.org_id)
        other_course = _course(db, other_admin.org_id)
        _rule(
            db, other_admin.org_id, other_course.id, TriggerEventType.edd_escalation,
            target_type=TriggerTargetType.all_staff, created_by=other_admin.id,
        )
        svc.evaluate_risk_event(
            db, TriggerEventType.edd_escalation, other_admin.org_id,
            entity_type="customer", entity_id="cust_2", entity_snapshot={},
        )

        resp = client.get(f"{BASE}/logs", headers=_auth(compliance))
        assert resp.status_code == 200
        logs = resp.json()
        assert len(logs) == 1
        assert logs[0]["entity_id"] == "cust_1"


# ══════════════════════════════════════════════════════════════════════════════
# REGULATORY UPDATE PUBLISH (HTTP)
# ══════════════════════════════════════════════════════════════════════════════


class TestPublishRegulatoryUpdate:
    def _payload(self, **overrides):
        payload = dict(
            event_ref=f"AUSTRAC-{uuid.uuid4().hex[:8]}",
            title="Updated Travel Rule Guidance",
            issuing_body="austrac",
            summary="AUSTRAC has updated travel rule thresholds.",
            affected_industries=["remittance"],
            affected_roles=["analyst"],
        )
        payload.update(overrides)
        return payload

    def test_publish_assigns_training_only_to_matching_industry_and_role(self, client, db):
        admin, compliance, analyst, mlro = _setup(db)
        _course(db, admin.org_id, training_type=TrainingType.annual_aml_refresher, is_active=True)

        # A different org, in a different industry, that would also match
        # if industry filtering were broken.
        other_org = Organisation(
            name=f"Other Org {uuid.uuid4().hex[:6]}", industry_type=IndustryType.vasp
        )
        db.add(other_org)
        db.commit()
        db.refresh(other_org)
        _make_user(db, UserRole.analyst, industry_id=other_org.id)
        _solution(db, other_org.id)
        _course(db, other_org.id, training_type=TrainingType.annual_aml_refresher, is_active=True)

        create_resp = client.post(f"{BASE}/regulatory-updates", json=self._payload(), headers=_auth(mlro))
        assert create_resp.status_code == 200, create_resp.text
        update_id = create_resp.json()["id"]

        publish_resp = client.post(f"{BASE}/regulatory-updates/{update_id}/publish", headers=_auth(mlro))
        assert publish_resp.status_code == 200, publish_resp.text
        body = publish_resp.json()
        assert body["orgs_notified"] == 1
        assert body["assignments_created"] == 1  # only the analyst role matches

        record = db.query(GovernanceTrainingRecord).filter_by(org_id=admin.org_id).first()
        assert record.user_id == analyst.id
        assert db.query(GovernanceTrainingRecord).filter_by(org_id=other_org.id).count() == 0

    def test_urgent_update_shortens_due_days_to_seven(self, client, db):
        admin, compliance, analyst, mlro = _setup(db)
        _course(db, admin.org_id, training_type=TrainingType.annual_aml_refresher, is_active=True)

        create_resp = client.post(
            f"{BASE}/regulatory-updates",
            json=self._payload(is_urgent=True, affected_roles=[]),
            headers=_auth(mlro),
        )
        update_id = create_resp.json()["id"]
        client.post(f"{BASE}/regulatory-updates/{update_id}/publish", headers=_auth(mlro))

        record = db.query(GovernanceTrainingRecord).filter_by(org_id=admin.org_id).first()
        assert (record.due_date - record.assigned_date).days == 7

    def test_no_affected_industries_or_roles_means_everyone(self, client, db):
        admin, compliance, analyst, mlro = _setup(db)
        _course(db, admin.org_id, training_type=TrainingType.annual_aml_refresher, is_active=True)

        create_resp = client.post(
            f"{BASE}/regulatory-updates",
            json=self._payload(affected_industries=[], affected_roles=[]),
            headers=_auth(mlro),
        )
        update_id = create_resp.json()["id"]
        publish_resp = client.post(f"{BASE}/regulatory-updates/{update_id}/publish", headers=_auth(mlro))
        assert publish_resp.json()["assignments_created"] == 4  # admin, compliance, analyst, mlro

    def test_publishing_twice_is_rejected(self, client, db):
        admin, compliance, analyst, mlro = _setup(db)
        _course(db, admin.org_id, training_type=TrainingType.annual_aml_refresher, is_active=True)
        create_resp = client.post(f"{BASE}/regulatory-updates", json=self._payload(), headers=_auth(mlro))
        update_id = create_resp.json()["id"]
        client.post(f"{BASE}/regulatory-updates/{update_id}/publish", headers=_auth(mlro))
        second = client.post(f"{BASE}/regulatory-updates/{update_id}/publish", headers=_auth(mlro))
        assert second.status_code == 422

    def test_duplicate_event_ref_is_rejected(self, client, db):
        admin, compliance, analyst, mlro = _setup(db)
        payload = self._payload()
        first = client.post(f"{BASE}/regulatory-updates", json=payload, headers=_auth(mlro))
        assert first.status_code == 200
        second = client.post(f"{BASE}/regulatory-updates", json=payload, headers=_auth(mlro))
        assert second.status_code == 409

    def test_org_without_a_matching_course_is_skipped(self, client, db):
        admin, compliance, analyst, mlro = _setup(db)
        # No annual_aml_refresher course seeded, and no linked_course_id.
        create_resp = client.post(f"{BASE}/regulatory-updates", json=self._payload(), headers=_auth(mlro))
        update_id = create_resp.json()["id"]
        publish_resp = client.post(f"{BASE}/regulatory-updates/{update_id}/publish", headers=_auth(mlro))
        body = publish_resp.json()
        assert body["orgs_notified"] == 0
        assert body["assignments_created"] == 0


# ══════════════════════════════════════════════════════════════════════════════
# _resolve_course_for_update
# ══════════════════════════════════════════════════════════════════════════════


class TestResolveCourseForUpdate:
    def test_no_linked_course_falls_back_to_annual_refresher(self, db):
        admin, *_ = _setup(db)
        refresher = _course(
            db, admin.org_id, training_type=TrainingType.annual_aml_refresher, is_active=True
        )
        update = RegulatoryUpdateEvent(
            event_ref=f"REF-{uuid.uuid4().hex[:6]}", title="t", issuing_body=IssuingBody.austrac,
            summary="s", created_by=admin.id,
        )
        db.add(update)
        db.commit()
        db.refresh(update)
        result = svc._resolve_course_for_update(db, update, admin.org_id)
        assert result.id == refresher.id

    def test_linked_course_prefers_the_target_orgs_own_course_of_the_same_type(self, db):
        admin, *_ = _setup(db)
        source_admin = _make_user(db, UserRole.admin)
        _solution(db, source_admin.org_id)
        source_course = _course(db, source_admin.org_id, training_type=TrainingType.pep_training)
        target_local_course = _course(
            db, admin.org_id, training_type=TrainingType.pep_training, is_active=True
        )

        update = RegulatoryUpdateEvent(
            event_ref=f"REF-{uuid.uuid4().hex[:6]}", title="t", issuing_body=IssuingBody.austrac,
            summary="s", created_by=admin.id, linked_course_id=source_course.id,
        )
        db.add(update)
        db.commit()
        db.refresh(update)

        result = svc._resolve_course_for_update(db, update, admin.org_id)
        assert result.id == target_local_course.id

    def test_linked_course_falls_back_to_itself_when_target_org_has_none(self, db):
        admin, *_ = _setup(db)
        source_admin = _make_user(db, UserRole.admin)
        _solution(db, source_admin.org_id)
        source_course = _course(db, source_admin.org_id, training_type=TrainingType.pep_training)

        update = RegulatoryUpdateEvent(
            event_ref=f"REF-{uuid.uuid4().hex[:6]}", title="t", issuing_body=IssuingBody.austrac,
            summary="s", created_by=admin.id, linked_course_id=source_course.id,
        )
        db.add(update)
        db.commit()
        db.refresh(update)

        result = svc._resolve_course_for_update(db, update, admin.org_id)
        assert result.id == source_course.id


# ══════════════════════════════════════════════════════════════════════════════
# ASSESSMENT OUTCOME FLAGS
# ══════════════════════════════════════════════════════════════════════════════


class TestCreateAssessmentFlag:
    def test_first_failed_attempt_does_not_require_oversight(self, db):
        admin, compliance, analyst, mlro = _setup(db)
        course = _course(db, admin.org_id)
        record = _record(db, admin.org_id, course.id, analyst.id)
        flag = svc.create_assessment_flag(
            db, training_record_id=record.id, org_id=admin.org_id, user_id=analyst.id,
            course_id=course.id, course_name=course.name, score=55.0, pass_mark=80.0,
            attempt_number=1,
        )
        assert flag.requires_oversight is False
        assert flag.status == AssessmentFlagStatus.open

    def test_second_failed_attempt_requires_oversight(self, db):
        admin, compliance, analyst, mlro = _setup(db)
        course = _course(db, admin.org_id)
        record = _record(db, admin.org_id, course.id, analyst.id)
        flag = svc.create_assessment_flag(
            db, training_record_id=record.id, org_id=admin.org_id, user_id=analyst.id,
            course_id=course.id, course_name=course.name, score=55.0, pass_mark=80.0,
            attempt_number=2,
        )
        assert flag.requires_oversight is True

    def test_decision_summary_counts_org_wide_txns_and_user_scoped_alerts_and_cases(self, db):
        admin, compliance, analyst, mlro = _setup(db)
        course = _course(db, admin.org_id)
        record = _record(db, admin.org_id, course.id, analyst.id)
        customer = _customer(db, admin.org_id)
        txn1 = _txn(db, admin.org_id, customer.id)
        txn2 = _txn(db, admin.org_id, customer.id)
        _alert(db, admin.org_id, customer.id, assigned_to=analyst.id, transaction_id=txn1.id)
        _alert(db, admin.org_id, customer.id, assigned_to=compliance.id, transaction_id=txn2.id)
        _case(db, admin.org_id, assigned_to=analyst.id)
        _case(db, admin.org_id, assigned_to=compliance.id)

        flag = svc.create_assessment_flag(
            db, training_record_id=record.id, org_id=admin.org_id, user_id=analyst.id,
            course_id=course.id, course_name=course.name, score=55.0, pass_mark=80.0,
            attempt_number=1,
        )
        # Transactions aren't attributed to a specific analyst in this model,
        # so the count is org-wide; alerts/cases ARE scoped to this user.
        assert flag.decision_summary["transactions_in_last_30d"] == 2
        assert flag.decision_summary["alerts_assigned_in_last_30d"] == 1
        assert flag.decision_summary["cases_assigned_in_last_30d"] == 1

    def test_activity_outside_the_30_day_window_is_not_counted(self, db):
        admin, compliance, analyst, mlro = _setup(db)
        course = _course(db, admin.org_id)
        record = _record(db, admin.org_id, course.id, analyst.id)
        customer = _customer(db, admin.org_id)
        old = datetime.now(timezone.utc) - timedelta(days=45)
        old_txn = _txn(db, admin.org_id, customer.id, created_at=old)
        _alert(
            db, admin.org_id, customer.id, assigned_to=analyst.id, created_at=old,
            transaction_id=old_txn.id,
        )
        _case(db, admin.org_id, assigned_to=analyst.id, created_at=old)

        flag = svc.create_assessment_flag(
            db, training_record_id=record.id, org_id=admin.org_id, user_id=analyst.id,
            course_id=course.id, course_name=course.name, score=55.0, pass_mark=80.0,
            attempt_number=1,
        )
        assert flag.decision_summary["transactions_in_last_30d"] == 0
        assert flag.decision_summary["alerts_assigned_in_last_30d"] == 0
        assert flag.decision_summary["cases_assigned_in_last_30d"] == 0


class TestAssessmentFlagReviewAndClear:
    def _flag(self, db, admin, analyst, course, record, attempt_number=2):
        return svc.create_assessment_flag(
            db, training_record_id=record.id, org_id=admin.org_id, user_id=analyst.id,
            course_id=course.id, course_name=course.name, score=40.0, pass_mark=80.0,
            attempt_number=attempt_number,
        )

    def test_list_and_filter_assessment_flags(self, client, db):
        admin, compliance, analyst, mlro = _setup(db)
        course = _course(db, admin.org_id)
        record = _record(db, admin.org_id, course.id, analyst.id)
        flag = self._flag(db, admin, analyst, course, record)

        resp = client.get(f"{BASE}/assessment-flags", headers=_auth(compliance))
        assert resp.status_code == 200
        assert any(f["id"] == flag.id for f in resp.json())

        resp2 = client.get(f"{BASE}/assessment-flags?status=cleared", headers=_auth(compliance))
        assert resp2.json() == []

    def test_review_sets_oversight_and_status(self, client, db):
        admin, compliance, analyst, mlro = _setup(db)
        course = _course(db, admin.org_id)
        record = _record(db, admin.org_id, course.id, analyst.id)
        flag = self._flag(db, admin, analyst, course, record)

        resp = client.post(
            f"{BASE}/assessment-flags/{flag.id}/review",
            json={"requires_oversight": True, "oversight_note": "co-sign required"},
            headers=_auth(mlro),
        )
        assert resp.status_code == 200, resp.text
        body = resp.json()
        assert body["status"] == "reviewed"
        assert body["requires_oversight"] is True
        assert body["reviewed_by"] == mlro.id

    def test_review_requires_mlro(self, client, db):
        admin, compliance, analyst, mlro = _setup(db)
        course = _course(db, admin.org_id)
        record = _record(db, admin.org_id, course.id, analyst.id)
        flag = self._flag(db, admin, analyst, course, record)
        resp = client.post(
            f"{BASE}/assessment-flags/{flag.id}/review",
            json={"requires_oversight": True},
            headers=_auth(compliance),
        )
        assert resp.status_code == 403

    def test_clear_resets_oversight_and_status(self, client, db):
        admin, compliance, analyst, mlro = _setup(db)
        course = _course(db, admin.org_id)
        record = _record(db, admin.org_id, course.id, analyst.id)
        flag = self._flag(db, admin, analyst, course, record)

        resp = client.post(f"{BASE}/assessment-flags/{flag.id}/clear", headers=_auth(mlro))
        assert resp.status_code == 200, resp.text
        db.expire_all()
        refreshed = db.query(AssessmentOutcomeFlag).filter_by(id=flag.id).first()
        assert refreshed.status == AssessmentFlagStatus.cleared
        assert refreshed.requires_oversight is False

    def test_flag_from_another_org_is_not_visible(self, client, db):
        admin, compliance, analyst, mlro = _setup(db)
        other_admin = _make_user(db, UserRole.admin)
        _solution(db, other_admin.org_id)
        other_analyst = _make_user(db, UserRole.analyst, industry_id=other_admin.org_id)
        other_course = _course(db, other_admin.org_id)
        other_record = _record(db, other_admin.org_id, other_course.id, other_analyst.id)
        other_flag = svc.create_assessment_flag(
            db, training_record_id=other_record.id, org_id=other_admin.org_id,
            user_id=other_analyst.id, course_id=other_course.id, course_name=other_course.name,
            score=40.0, pass_mark=80.0, attempt_number=1,
        )
        resp = client.get(f"{BASE}/assessment-flags/{other_flag.id}", headers=_auth(compliance))
        assert resp.status_code == 404


# ══════════════════════════════════════════════════════════════════════════════
# ORG SEEDING
# ══════════════════════════════════════════════════════════════════════════════


class TestSeedDefaultTriggerRules:
    def test_seeds_a_rule_for_each_matching_course(self, db):
        admin = _make_user(db, UserRole.admin)
        solution = _solution(db, admin.org_id)
        _course(db, admin.org_id, training_type=TrainingType.edd_training)
        _course(db, admin.org_id, training_type=TrainingType.smr_training)

        seeded = svc.seed_default_trigger_rules(db, admin.org_id, solution.id, admin.id)
        assert seeded == 2
        rules = db.query(TrainingTriggerRule).filter_by(org_id=admin.org_id).all()
        assert {r.event_type for r in rules} == {
            TriggerEventType.edd_escalation,
            TriggerEventType.smr_filed,
        }
        assert all(r.is_system for r in rules)

    def test_skips_rules_with_no_matching_course(self, db):
        admin = _make_user(db, UserRole.admin)
        solution = _solution(db, admin.org_id)
        seeded = svc.seed_default_trigger_rules(db, admin.org_id, solution.id, admin.id)
        assert seeded == 0
        assert db.query(TrainingTriggerRule).filter_by(org_id=admin.org_id).count() == 0

    def test_is_idempotent(self, db):
        admin = _make_user(db, UserRole.admin)
        solution = _solution(db, admin.org_id)
        _course(db, admin.org_id, training_type=TrainingType.edd_training)

        first = svc.seed_default_trigger_rules(db, admin.org_id, solution.id, admin.id)
        second = svc.seed_default_trigger_rules(db, admin.org_id, solution.id, admin.id)
        assert first == 1
        assert second == 0
        assert db.query(TrainingTriggerRule).filter_by(org_id=admin.org_id).count() == 1


# ══════════════════════════════════════════════════════════════════════════════
# TRAINING GAP REPORT (HTTP)
# ══════════════════════════════════════════════════════════════════════════════


class TestTrainingGapReport:
    def test_missing_mandatory_course_is_a_medium_risk_gap(self, client, db):
        admin, compliance, analyst, mlro = _setup(db)
        mandatory = _course(db, admin.org_id, is_mandatory=True, is_active=True)
        _course(db, admin.org_id, is_mandatory=False, is_active=True)  # not mandatory, ignored
        _course(db, admin.org_id, is_mandatory=True, is_active=False)  # inactive, ignored

        resp = client.get(f"{BASE}/gap-report", headers=_auth(compliance))
        assert resp.status_code == 200, resp.text
        body = resp.json()
        gap = next(g for g in body["staff_gaps"] if g["user_id"] == analyst.id)
        assert gap["gap_count"] == 1
        assert gap["risk_level"] == "medium"
        assert gap["missing_mandatory_courses"][0]["course_id"] == mandatory.id

    def test_overdue_missing_course_is_a_high_risk_gap(self, client, db):
        admin, compliance, analyst, mlro = _setup(db)
        mandatory = _course(db, admin.org_id, is_mandatory=True, is_active=True)
        _record(
            db, admin.org_id, mandatory.id, analyst.id, status=TrainingStatus.overdue,
            due_date=date.today() - timedelta(days=5),
        )

        resp = client.get(f"{BASE}/gap-report", headers=_auth(compliance))
        gap = next(g for g in resp.json()["staff_gaps"] if g["user_id"] == analyst.id)
        assert gap["missing_mandatory_courses"][0]["is_overdue"] is True
        assert gap["risk_level"] == "high"

    def test_completed_course_is_not_a_gap(self, client, db):
        admin, compliance, analyst, mlro = _setup(db)
        mandatory = _course(db, admin.org_id, is_mandatory=True, is_active=True)
        _record(
            db, admin.org_id, mandatory.id, analyst.id, status=TrainingStatus.completed,
            completion_date=date.today(),
        )

        resp = client.get(f"{BASE}/gap-report", headers=_auth(compliance))
        user_ids_with_gaps = {g["user_id"] for g in resp.json()["staff_gaps"]}
        assert analyst.id not in user_ids_with_gaps

    def test_open_assessment_flag_alone_puts_the_user_in_the_report_as_high_risk(self, client, db):
        admin, compliance, analyst, mlro = _setup(db)
        course = _course(db, admin.org_id)  # not mandatory -> zero course gaps
        record = _record(db, admin.org_id, course.id, analyst.id)
        svc.create_assessment_flag(
            db, training_record_id=record.id, org_id=admin.org_id, user_id=analyst.id,
            course_id=course.id, course_name=course.name, score=40.0, pass_mark=80.0,
            attempt_number=1,
        )
        resp = client.get(f"{BASE}/gap-report", headers=_auth(compliance))
        gap = next(g for g in resp.json()["staff_gaps"] if g["user_id"] == analyst.id)
        assert gap["gap_count"] == 0
        assert gap["open_assessment_flags"] == 1
        assert gap["risk_level"] == "high"

    def test_other_orgs_staff_and_courses_are_excluded(self, client, db):
        admin, compliance, analyst, mlro = _setup(db)
        other_admin = _make_user(db, UserRole.admin)
        _solution(db, other_admin.org_id)
        _course(db, other_admin.org_id, is_mandatory=True, is_active=True)

        resp = client.get(f"{BASE}/gap-report", headers=_auth(compliance))
        body = resp.json()
        assert body["summary"]["total_active_staff"] == 4  # only this org's 4 users
        assert other_admin.id not in {g["user_id"] for g in body["staff_gaps"]}

    def test_gap_rate_pct_formula(self, client, db):
        admin, compliance, analyst, mlro = _setup(db)
        _course(db, admin.org_id, is_mandatory=True, is_active=True)
        # Nobody has completed it -> all 4 active staff have exactly this 1 gap.
        resp = client.get(f"{BASE}/gap-report", headers=_auth(compliance))
        body = resp.json()
        assert body["summary"]["staff_with_gaps"] == 4
        assert body["summary"]["total_active_staff"] == 4
        assert body["summary"]["gap_rate_pct"] == 100.0
        assert body["summary"]["total_training_gaps"] == 4
