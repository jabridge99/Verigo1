"""
P54: real coverage for app/api/routes/governance/training.py (31% covered,
342 of 495 statements missed before this file existed) -- the single
largest raw coverage gap in the codebase. Manages staff AML/CTF training
obligations aligned to AUSTRAC AML/CTF Rules 2025 / FATF R.18.

The highest-risk part of this module is its CALCULATED status state
machine (_compute_status): a training record's status is never set
directly by the caller, it's derived from completion_date/expiry_date/
due_date/started_at/is_exempt -- exactly the kind of derived-state logic
that silently drifts from its own documented rules if untested. These
tests drive every real lifecycle transition (start -> complete -> exempt
-> revoke -> retake -> renew) through the real API and check the
resulting status against the module's own documented state table, not
just that each call returns 200.
"""

import uuid
from datetime import date, datetime, timedelta, timezone

from app.models.aml_solution import AMLSolution
from app.models.governance_training import (
    AssignmentTrigger,
    GovernanceTrainingRecord,
    TrainingAssignment,
    TrainingCourse,
    TrainingStatus,
    TrainingType,
)
from tests.conftest import UserRole, _auth, _make_org, _make_user


def _solution(db, org_id):
    s = AMLSolution(org_id=org_id, created_by="someone")
    db.add(s)
    db.commit()
    db.refresh(s)
    return s


def _setup(db):
    """A real org with an AML solution and a full role cast, all sharing
    one org so record-ownership/visibility rules are actually exercised."""
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
        solution_id=solution.id,
        course_code=f"TRN-{uuid.uuid4().hex[:6].upper()}",
        name="Test Course",
        training_type=TrainingType.aml_induction,
        is_custom=True,
        max_attempts=3,
    )
    defaults.update(overrides)
    c = TrainingCourse(**defaults)
    db.add(c)
    db.commit()
    db.refresh(c)
    return c


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


BASE = "/api/v1/governance/training"


class TestCourseCatalogue:
    def test_seed_standard_courses_is_idempotent(self, client, db):
        admin, *_ = _setup(db)
        headers = _auth(admin)

        first = client.post(f"{BASE}/courses/seed", headers=headers)
        assert first.status_code == 201, first.text
        assert first.json()["seeded"] > 0

        second = client.post(f"{BASE}/courses/seed", headers=headers)
        assert second.json()["seeded"] == 0
        assert second.json()["already_existed"] == first.json()["seeded"]

    def test_seed_industry_pack_for_one_industry(self, client, db):
        admin, *_ = _setup(db)
        headers = _auth(admin)
        resp = client.post(f"{BASE}/courses/seed-industry-pack?industry=remittance", headers=headers)
        assert resp.status_code == 201, resp.text
        assert resp.json()["packs_seeded"] == ["remittance"]
        assert resp.json()["seeded"] > 0

    def test_seed_industry_pack_rejects_unknown_industry(self, client, db):
        admin, *_ = _setup(db)
        resp = client.post(
            f"{BASE}/courses/seed-industry-pack?industry=not_a_real_industry",
            headers=_auth(admin),
        )
        assert resp.status_code == 404

    def test_create_list_get_custom_course(self, client, db):
        admin, *_ = _setup(db)
        headers = _auth(admin)
        create = client.post(
            f"{BASE}/courses",
            json={
                "course_code": "TRN-CUSTOM-1",
                "name": "Custom Fraud Awareness",
                "training_type": "custom",
                "is_mandatory": True,
            },
            headers=headers,
        )
        assert create.status_code == 201, create.text
        course_id = create.json()["id"]
        assert create.json()["is_custom"] is True

        dup = client.post(
            f"{BASE}/courses",
            json={"course_code": "TRN-CUSTOM-1", "name": "Dup", "training_type": "custom"},
            headers=headers,
        )
        assert dup.status_code == 409

        listed = client.get(f"{BASE}/courses", headers=headers)
        assert any(c["id"] == course_id for c in listed.json()["courses"])

        got = client.get(f"{BASE}/courses/{course_id}", headers=headers)
        assert got.status_code == 200
        assert got.json()["name"] == "Custom Fraud Awareness"

    def test_standard_course_can_only_toggle_is_active(self, client, db):
        admin, *_ = _setup(db)
        headers = _auth(admin)
        client.post(f"{BASE}/courses/seed", headers=headers)
        standard = client.get(f"{BASE}/courses?is_custom=false", headers=headers).json()["courses"][0]

        blocked = client.patch(
            f"{BASE}/courses/{standard['id']}", json={"name": "Renamed"}, headers=headers
        )
        assert blocked.status_code == 409

        toggled = client.patch(
            f"{BASE}/courses/{standard['id']}", json={"is_active": False}, headers=headers
        )
        assert toggled.status_code == 200
        assert toggled.json()["is_active"] is False

    def test_custom_course_can_be_updated_and_soft_deleted(self, client, db):
        admin, *_ = _setup(db)
        headers = _auth(admin)
        course = _course(db, admin.org_id)

        updated = client.patch(
            f"{BASE}/courses/{course.id}", json={"name": "Updated Name"}, headers=headers
        )
        assert updated.status_code == 200
        assert updated.json()["name"] == "Updated Name"

        deleted = client.delete(f"{BASE}/courses/{course.id}", headers=headers)
        assert deleted.status_code == 204
        db.expire_all()
        assert db.query(TrainingCourse).filter_by(id=course.id).first().is_active is False

    def test_standard_course_cannot_be_deleted(self, client, db):
        admin, *_ = _setup(db)
        course = _course(db, admin.org_id, is_custom=False)
        resp = client.delete(f"{BASE}/courses/{course.id}", headers=_auth(admin))
        assert resp.status_code == 409

    def test_analyst_cannot_create_a_course(self, client, db):
        _, _, analyst, _ = _setup(db)
        resp = client.post(
            f"{BASE}/courses",
            json={"course_code": "X", "name": "X", "training_type": "custom"},
            headers=_auth(analyst),
        )
        assert resp.status_code == 403


class TestAssignments:
    def test_bulk_assign_creates_one_record_per_user_and_skips_duplicates(self, client, db):
        admin, compliance, analyst, _ = _setup(db)
        course = _course(db, admin.org_id)

        resp = client.post(
            f"{BASE}/assignments",
            json={
                "course_id": course.id,
                "user_ids": [analyst.id, compliance.id],
                "due_date": (date.today() + timedelta(days=14)).isoformat(),
            },
            headers=_auth(compliance),
        )
        assert resp.status_code == 201, resp.text
        assert resp.json()["records_created"] == 2
        assert resp.json()["assignment"]["total_assigned"] == 2

        # Re-assigning the same course to the same user (still assigned/
        # not completed) must not create a duplicate live record.
        again = client.post(
            f"{BASE}/assignments",
            json={
                "course_id": course.id,
                "user_ids": [analyst.id],
                "due_date": (date.today() + timedelta(days=14)).isoformat(),
            },
            headers=_auth(compliance),
        )
        assert again.json()["records_created"] == 0

    def test_cannot_assign_an_inactive_course(self, client, db):
        admin, compliance, analyst, _ = _setup(db)
        course = _course(db, admin.org_id, is_active=False)
        resp = client.post(
            f"{BASE}/assignments",
            json={
                "course_id": course.id,
                "user_ids": [analyst.id],
                "due_date": (date.today() + timedelta(days=14)).isoformat(),
            },
            headers=_auth(compliance),
        )
        assert resp.status_code == 409

    def test_get_assignment_with_records(self, client, db):
        admin, compliance, analyst, _ = _setup(db)
        course = _course(db, admin.org_id)
        created = client.post(
            f"{BASE}/assignments",
            json={
                "course_id": course.id,
                "user_ids": [analyst.id],
                "due_date": (date.today() + timedelta(days=14)).isoformat(),
            },
            headers=_auth(compliance),
        ).json()

        resp = client.get(
            f"{BASE}/assignments/{created['assignment']['id']}?include_records=true",
            headers=_auth(compliance),
        )
        assert resp.status_code == 200
        assert len(resp.json()["records"]) == 1

    def test_analyst_cannot_create_assignments(self, client, db):
        admin, _, analyst, _ = _setup(db)
        course = _course(db, admin.org_id)
        resp = client.post(
            f"{BASE}/assignments",
            json={
                "course_id": course.id,
                "user_ids": [analyst.id],
                "due_date": (date.today() + timedelta(days=14)).isoformat(),
            },
            headers=_auth(analyst),
        )
        assert resp.status_code == 403


class TestRecordLifecycleStatusStateMachine:
    """Drives every real transition and checks the resulting status
    against the module's own documented calculation rules."""

    def test_newly_created_record_with_future_due_date_is_assigned(self, client, db):
        admin, compliance, analyst, _ = _setup(db)
        course = _course(db, admin.org_id)
        resp = client.post(
            f"{BASE}/records",
            json={
                "course_id": course.id,
                "user_id": analyst.id,
                "assigned_date": date.today().isoformat(),
                "due_date": (date.today() + timedelta(days=30)).isoformat(),
            },
            headers=_auth(compliance),
        )
        assert resp.status_code == 201, resp.text
        assert resp.json()["status"] == "assigned"

    def test_record_past_due_with_no_completion_is_overdue(self, client, db):
        admin, compliance, analyst, _ = _setup(db)
        course = _course(db, admin.org_id)
        record = _record(
            db, admin.org_id, course.id, analyst.id,
            due_date=date.today() - timedelta(days=1),
        )
        resp = client.get(f"{BASE}/records/{record.id}", headers=_auth(compliance))
        assert resp.status_code == 200
        assert resp.json()["status"] == "overdue"

    def test_start_marks_in_progress(self, client, db):
        admin, compliance, analyst, _ = _setup(db)
        course = _course(db, admin.org_id)
        record = _record(db, admin.org_id, course.id, analyst.id)

        resp = client.post(f"{BASE}/records/{record.id}/start", headers=_auth(analyst))
        assert resp.status_code == 200, resp.text
        assert resp.json()["status"] == "in_progress"
        assert resp.json()["started_at"] is not None

    def test_cannot_start_an_exempt_record(self, client, db):
        admin, compliance, analyst, _ = _setup(db)
        course = _course(db, admin.org_id)
        record = _record(db, admin.org_id, course.id, analyst.id, is_exempt=True)
        resp = client.post(f"{BASE}/records/{record.id}/start", headers=_auth(analyst))
        assert resp.status_code == 409

    def test_cannot_start_an_already_completed_record(self, client, db):
        admin, compliance, analyst, _ = _setup(db)
        course = _course(db, admin.org_id)
        record = _record(
            db, admin.org_id, course.id, analyst.id,
            completion_date=date.today(), status=TrainingStatus.completed,
        )
        resp = client.post(f"{BASE}/records/{record.id}/start", headers=_auth(analyst))
        assert resp.status_code == 409

    def test_cannot_complete_an_exempt_record(self, client, db):
        admin, compliance, analyst, _ = _setup(db)
        course = _course(db, admin.org_id)
        record = _record(db, admin.org_id, course.id, analyst.id, is_exempt=True)
        resp = client.post(
            f"{BASE}/records/{record.id}/complete",
            json={"completion_date": date.today().isoformat()},
            headers=_auth(compliance),
        )
        assert resp.status_code == 409

    def test_cannot_re_complete_an_already_completed_record(self, client, db):
        admin, compliance, analyst, _ = _setup(db)
        course = _course(db, admin.org_id)
        record = _record(
            db, admin.org_id, course.id, analyst.id,
            completion_date=date.today(), status=TrainingStatus.completed,
        )
        resp = client.post(
            f"{BASE}/records/{record.id}/complete",
            json={"completion_date": date.today().isoformat()},
            headers=_auth(compliance),
        )
        assert resp.status_code == 409

    def test_revoke_exemption_rejected_on_a_non_exempt_record(self, client, db):
        admin, compliance, analyst, _ = _setup(db)
        course = _course(db, admin.org_id)
        record = _record(db, admin.org_id, course.id, analyst.id)
        resp = client.post(f"{BASE}/records/{record.id}/revoke-exemption", headers=_auth(compliance))
        assert resp.status_code == 409

    def test_cannot_retake_an_exempt_record(self, client, db):
        admin, compliance, analyst, _ = _setup(db)
        course = _course(db, admin.org_id)
        record = _record(db, admin.org_id, course.id, analyst.id, is_exempt=True)
        resp = client.post(f"{BASE}/records/{record.id}/retake", headers=_auth(analyst))
        assert resp.status_code == 409

    def test_complete_calculates_pass_fail_and_expiry_from_course(self, client, db):
        admin, compliance, analyst, _ = _setup(db)
        course = _course(db, admin.org_id, has_assessment=True, pass_mark=80.0, expiry_months=12)
        record = _record(db, admin.org_id, course.id, analyst.id)

        passed = client.post(
            f"{BASE}/records/{record.id}/complete",
            json={"completion_date": date.today().isoformat(), "score": 90.0},
            headers=_auth(compliance),
        )
        assert passed.status_code == 200, passed.text
        body = passed.json()
        assert body["status"] == "completed"
        assert body["passed"] is True
        assert body["pass_mark_applied"] == 80.0
        # expiry_date = completion_date + course.expiry_months (relativedelta,
        # so exactly 12 months later, not just "+365 days").
        from dateutil.relativedelta import relativedelta

        assert body["expiry_date"] == (date.today() + relativedelta(months=12)).isoformat()

    def test_complete_below_pass_mark_records_a_fail(self, client, db):
        admin, compliance, analyst, _ = _setup(db)
        course = _course(db, admin.org_id, has_assessment=True, pass_mark=80.0)
        record = _record(db, admin.org_id, course.id, analyst.id)

        resp = client.post(
            f"{BASE}/records/{record.id}/complete",
            json={"completion_date": date.today().isoformat(), "score": 40.0},
            headers=_auth(compliance),
        )
        assert resp.status_code == 200, resp.text
        assert resp.json()["passed"] is False
        # A failed record is still "completed" per _compute_status -- pass/fail
        # doesn't change status, only the retake flow (below) cares about it.
        assert resp.json()["status"] == "completed"

    def test_completed_record_past_its_expiry_reads_back_as_expired(self, client, db):
        admin, compliance, analyst, _ = _setup(db)
        course = _course(db, admin.org_id)
        record = _record(
            db, admin.org_id, course.id, analyst.id,
            completion_date=date.today() - timedelta(days=400),
            expiry_date=date.today() - timedelta(days=1),
            status=TrainingStatus.completed,
        )
        resp = client.get(f"{BASE}/records/{record.id}", headers=_auth(compliance))
        assert resp.json()["status"] == "expired"

    def test_exempt_then_revoke_recomputes_real_status(self, client, db):
        admin, compliance, analyst, _ = _setup(db)
        course = _course(db, admin.org_id)
        record = _record(
            db, admin.org_id, course.id, analyst.id,
            due_date=date.today() - timedelta(days=1),  # would be overdue if not exempt
        )

        exempted = client.post(
            f"{BASE}/records/{record.id}/exempt",
            json={"reason": "Equivalent training completed at prior employer"},
            headers=_auth(compliance),
        )
        assert exempted.status_code == 200, exempted.text
        assert exempted.json()["status"] == "exempt"
        assert exempted.json()["is_exempt"] is True

        revoked = client.post(f"{BASE}/records/{record.id}/revoke-exemption", headers=_auth(compliance))
        assert revoked.status_code == 200, revoked.text
        assert revoked.json()["is_exempt"] is False
        # Back to real status now the exemption is gone -- due_date is in
        # the past, so it's overdue again, not silently "assigned".
        assert revoked.json()["status"] == "overdue"

    def test_cannot_exempt_a_completed_record(self, client, db):
        admin, compliance, analyst, _ = _setup(db)
        course = _course(db, admin.org_id)
        record = _record(
            db, admin.org_id, course.id, analyst.id,
            completion_date=date.today(), status=TrainingStatus.completed,
        )
        resp = client.post(
            f"{BASE}/records/{record.id}/exempt",
            json={"reason": "Should not be allowed on a completed record"},
            headers=_auth(compliance),
        )
        assert resp.status_code == 409

    def test_retake_only_allowed_on_a_failed_attempt_and_resets_fields(self, client, db):
        admin, compliance, analyst, _ = _setup(db)
        course = _course(db, admin.org_id, max_attempts=3)
        record = _record(
            db, admin.org_id, course.id, analyst.id,
            completion_date=date.today(), passed=False, attempt_number=1,
            status=TrainingStatus.completed,
        )

        resp = client.post(f"{BASE}/records/{record.id}/retake", headers=_auth(analyst))
        assert resp.status_code == 200, resp.text
        body = resp.json()
        assert body["attempt_number"] == 2
        assert body["completion_date"] is None
        assert body["passed"] is None
        assert body["status"] == "assigned"  # reset, due_date still in future

    def test_retake_rejected_when_not_a_failed_attempt(self, client, db):
        admin, compliance, analyst, _ = _setup(db)
        course = _course(db, admin.org_id)
        record = _record(
            db, admin.org_id, course.id, analyst.id,
            completion_date=date.today(), passed=True, status=TrainingStatus.completed,
        )
        resp = client.post(f"{BASE}/records/{record.id}/retake", headers=_auth(analyst))
        assert resp.status_code == 409

    def test_retake_rejected_at_max_attempts(self, client, db):
        admin, compliance, analyst, _ = _setup(db)
        course = _course(db, admin.org_id, max_attempts=2)
        record = _record(
            db, admin.org_id, course.id, analyst.id,
            completion_date=date.today(), passed=False, attempt_number=2,
            status=TrainingStatus.completed,
        )
        resp = client.post(f"{BASE}/records/{record.id}/retake", headers=_auth(analyst))
        assert resp.status_code == 409

    def test_renew_creates_a_new_record_linked_to_the_same_course_and_user(self, client, db):
        admin, compliance, analyst, _ = _setup(db)
        course = _course(db, admin.org_id)
        old = _record(
            db, admin.org_id, course.id, analyst.id,
            completion_date=date.today() - timedelta(days=400),
            expiry_date=date.today() - timedelta(days=1),
            status=TrainingStatus.expired,
        )
        new_due = date.today() + timedelta(days=365)
        resp = client.post(
            f"{BASE}/records/{old.id}/renew?due_date={new_due.isoformat()}",
            headers=_auth(compliance),
        )
        assert resp.status_code == 201, resp.text
        body = resp.json()
        assert body["id"] != old.id
        assert body["course_id"] == course.id
        assert body["user_id"] == analyst.id
        assert body["status"] == "assigned"

    def test_renew_rejected_on_a_still_assigned_record(self, client, db):
        admin, compliance, analyst, _ = _setup(db)
        course = _course(db, admin.org_id)
        record = _record(db, admin.org_id, course.id, analyst.id)
        resp = client.post(
            f"{BASE}/records/{record.id}/renew?due_date={(date.today() + timedelta(days=30)).isoformat()}",
            headers=_auth(compliance),
        )
        assert resp.status_code == 409


class TestRecordListFilters:
    def test_status_course_and_training_type_filters(self, client, db):
        admin, compliance, analyst, _ = _setup(db)
        cdd_course = _course(db, admin.org_id, training_type=TrainingType.cdd_training)
        smr_course = _course(db, admin.org_id, training_type=TrainingType.smr_training)
        completed = _record(
            db, admin.org_id, cdd_course.id, analyst.id,
            completion_date=date.today(), status=TrainingStatus.completed,
        )
        _record(db, admin.org_id, smr_course.id, analyst.id, status=TrainingStatus.assigned)

        by_status = client.get(f"{BASE}/records?status=completed", headers=_auth(compliance))
        assert by_status.json()["count"] == 1
        assert by_status.json()["records"][0]["id"] == completed.id

        by_course = client.get(f"{BASE}/records?course_id={cdd_course.id}", headers=_auth(compliance))
        assert by_course.json()["count"] == 1

        by_type = client.get(f"{BASE}/records?training_type=smr_training", headers=_auth(compliance))
        assert by_type.json()["count"] == 1
        assert by_type.json()["records"][0]["course_id"] == smr_course.id

    def test_overdue_only_and_expiring_within_days_filters(self, client, db):
        admin, compliance, analyst, _ = _setup(db)
        course = _course(db, admin.org_id)
        overdue = _record(
            db, admin.org_id, course.id, analyst.id,
            due_date=date.today() - timedelta(days=1), status=TrainingStatus.overdue,
        )
        _record(db, admin.org_id, course.id, compliance.id)  # not overdue, noise
        expiring_soon = _record(
            db, admin.org_id, course.id, compliance.id,
            completion_date=date.today() - timedelta(days=300),
            expiry_date=date.today() + timedelta(days=5),
            status=TrainingStatus.completed,
        )

        overdue_resp = client.get(f"{BASE}/records?overdue_only=true", headers=_auth(compliance))
        assert overdue_resp.json()["count"] == 1
        assert overdue_resp.json()["records"][0]["id"] == overdue.id

        expiring_resp = client.get(f"{BASE}/records?expiring_within_days=10", headers=_auth(compliance))
        assert expiring_resp.json()["count"] == 1
        assert expiring_resp.json()["records"][0]["id"] == expiring_soon.id

    def test_compliance_can_filter_by_user_id(self, client, db):
        admin, compliance, analyst, _ = _setup(db)
        course = _course(db, admin.org_id)
        _record(db, admin.org_id, course.id, analyst.id)
        _record(db, admin.org_id, course.id, compliance.id)

        resp = client.get(f"{BASE}/records?user_id={analyst.id}", headers=_auth(compliance))
        assert resp.json()["count"] == 1
        assert resp.json()["records"][0]["user_id"] == analyst.id


class TestAssignmentFilters:
    def test_list_assignments_filters_by_course_and_trigger(self, client, db):
        admin, compliance, analyst, _ = _setup(db)
        course_a = _course(db, admin.org_id)
        course_b = _course(db, admin.org_id)
        client.post(
            f"{BASE}/assignments",
            json={
                "course_id": course_a.id, "user_ids": [analyst.id],
                "trigger": "onboarding",
                "due_date": (date.today() + timedelta(days=14)).isoformat(),
            },
            headers=_auth(compliance),
        )
        client.post(
            f"{BASE}/assignments",
            json={
                "course_id": course_b.id, "user_ids": [compliance.id],
                "trigger": "annual_cycle",
                "due_date": (date.today() + timedelta(days=14)).isoformat(),
            },
            headers=_auth(compliance),
        )

        by_course = client.get(f"{BASE}/assignments?course_id={course_a.id}", headers=_auth(compliance))
        assert by_course.json()["count"] == 1

        by_trigger = client.get(f"{BASE}/assignments?trigger=annual_cycle", headers=_auth(compliance))
        assert by_trigger.json()["count"] == 1
        assert by_trigger.json()["assignments"][0]["course_id"] == course_b.id


class TestRecordVisibilityAndOwnership:
    def test_analyst_only_sees_their_own_records_in_list(self, client, db):
        admin, compliance, analyst, _ = _setup(db)
        course = _course(db, admin.org_id)
        _record(db, admin.org_id, course.id, analyst.id)
        _record(db, admin.org_id, course.id, compliance.id)

        resp = client.get(f"{BASE}/records", headers=_auth(analyst))
        assert resp.status_code == 200
        assert resp.json()["count"] == 1
        assert resp.json()["records"][0]["user_id"] == analyst.id

    def test_compliance_sees_all_records(self, client, db):
        admin, compliance, analyst, _ = _setup(db)
        course = _course(db, admin.org_id)
        _record(db, admin.org_id, course.id, analyst.id)
        _record(db, admin.org_id, course.id, compliance.id)

        resp = client.get(f"{BASE}/records", headers=_auth(compliance))
        assert resp.json()["count"] == 2

    def test_analyst_cannot_view_another_users_record_directly(self, client, db):
        admin, compliance, analyst, _ = _setup(db)
        course = _course(db, admin.org_id)
        other_record = _record(db, admin.org_id, course.id, compliance.id)

        resp = client.get(f"{BASE}/records/{other_record.id}", headers=_auth(analyst))
        assert resp.status_code == 403

    def test_analyst_cannot_retake_anothers_record(self, client, db):
        admin, compliance, analyst, _ = _setup(db)
        course = _course(db, admin.org_id)
        other_record = _record(
            db, admin.org_id, course.id, compliance.id,
            completion_date=date.today(), passed=False, status=TrainingStatus.completed,
        )
        resp = client.post(f"{BASE}/records/{other_record.id}/retake", headers=_auth(analyst))
        assert resp.status_code == 403


class TestCertificateExport:
    def test_certificate_requires_completed_status(self, client, db):
        admin, compliance, analyst, _ = _setup(db)
        course = _course(db, admin.org_id)
        record = _record(db, admin.org_id, course.id, analyst.id)
        resp = client.get(f"{BASE}/records/{record.id}/certificate-html", headers=_auth(analyst))
        assert resp.status_code == 409

    def test_certificate_export_for_completed_record(self, client, db):
        admin, compliance, analyst, _ = _setup(db)
        course = _course(db, admin.org_id, name="AML Induction")
        record = _record(
            db, admin.org_id, course.id, analyst.id,
            completion_date=date.today(), passed=True, status=TrainingStatus.completed,
            certificate_number="CERT-001",
        )
        resp = client.get(f"{BASE}/records/{record.id}/certificate-html", headers=_auth(analyst))
        assert resp.status_code == 200, resp.text
        assert "AML Induction" in resp.text
        assert "CERT-001" in resp.text


class TestDashboardOverdueExpiringComplianceReport:
    def test_dashboard_metrics_and_traffic_lights_from_real_counts(self, client, db):
        admin, compliance, analyst, mlro = _setup(db)
        other_org_id = _make_org(db).id
        _solution(db, other_org_id)
        course = _course(db, admin.org_id)

        # 1 completed, 1 overdue, 1 exempt, 1 in_progress for this org.
        _record(db, admin.org_id, course.id, analyst.id, completion_date=date.today(), status=TrainingStatus.completed)
        _record(db, admin.org_id, course.id, compliance.id, due_date=date.today() - timedelta(days=1), status=TrainingStatus.overdue)
        _record(db, admin.org_id, course.id, mlro.id, is_exempt=True, status=TrainingStatus.exempt)
        _record(db, admin.org_id, course.id, admin.id, started_at=datetime.now(timezone.utc), status=TrainingStatus.in_progress)
        # Other org noise -- must not affect this org's dashboard.
        other_course = _course(db, other_org_id)
        _record(db, other_org_id, other_course.id, admin.id, status=TrainingStatus.overdue, due_date=date.today() - timedelta(days=1))

        resp = client.get(f"{BASE}/dashboard", headers=_auth(admin))
        assert resp.status_code == 200, resp.text
        body = resp.json()
        assert body["summary"]["total"] == 4
        assert body["summary"]["completed"] == 1
        assert body["summary"]["overdue"] == 1
        assert body["summary"]["exempt"] == 1
        assert body["summary"]["in_progress"] == 1
        # completion_pct = completed / non_exempt * 100 = 1/3*100 = 33.3
        assert body["metrics"]["completion_pct"] == 33.3
        assert body["traffic_lights"]["overdue"] == "red"  # any overdue -> red
        assert body["traffic_lights"]["overall"] == "red"

    def test_overdue_endpoint_lists_only_this_orgs_overdue_records(self, client, db):
        admin, compliance, analyst, _ = _setup(db)
        other_org_id = _make_org(db).id
        _solution(db, other_org_id)
        course = _course(db, admin.org_id)
        other_course = _course(db, other_org_id)

        _record(db, admin.org_id, course.id, analyst.id, due_date=date.today() - timedelta(days=5))
        _record(db, other_org_id, other_course.id, analyst.id, due_date=date.today() - timedelta(days=5))
        # Exempt records must never show as overdue even if past due.
        _record(db, admin.org_id, course.id, compliance.id, due_date=date.today() - timedelta(days=5), is_exempt=True)

        resp = client.get(f"{BASE}/overdue", headers=_auth(compliance))
        assert resp.status_code == 200, resp.text
        assert resp.json()["overdue_count"] == 1

    def test_expiring_endpoint_filters_by_window(self, client, db):
        admin, compliance, analyst, _ = _setup(db)
        course = _course(db, admin.org_id)
        _record(
            db, admin.org_id, course.id, analyst.id,
            completion_date=date.today() - timedelta(days=300),
            expiry_date=date.today() + timedelta(days=10),
            status=TrainingStatus.completed,
        )
        # Outside the 30-day window -- must not be counted.
        _record(
            db, admin.org_id, course.id, compliance.id,
            completion_date=date.today() - timedelta(days=300),
            expiry_date=date.today() + timedelta(days=90),
            status=TrainingStatus.completed,
        )

        resp = client.get(f"{BASE}/expiring?within_days=30", headers=_auth(compliance))
        assert resp.status_code == 200, resp.text
        assert resp.json()["expiring_count"] == 1

    def test_compliance_report_breaks_down_by_training_type(self, client, db):
        admin, compliance, analyst, _ = _setup(db)
        cdd_course = _course(db, admin.org_id, training_type=TrainingType.cdd_training)
        smr_course = _course(db, admin.org_id, training_type=TrainingType.smr_training)

        _record(db, admin.org_id, cdd_course.id, analyst.id, completion_date=date.today(), status=TrainingStatus.completed)
        _record(db, admin.org_id, smr_course.id, compliance.id, due_date=date.today() - timedelta(days=1), status=TrainingStatus.overdue)

        resp = client.get(f"{BASE}/compliance-report", headers=_auth(compliance))
        assert resp.status_code == 200, resp.text
        body = resp.json()
        assert body["overall"]["total_assigned"] == 2
        assert body["overall"]["completed"] == 1
        assert body["overall"]["overdue"] == 1
        by_type = {row["training_type"]: row for row in body["by_training_type"]}
        assert by_type["cdd_training"]["completed"] == 1
        assert by_type["smr_training"]["overdue"] == 1

    def test_viewer_role_is_denied_on_dashboard(self, client, db):
        admin, *_ = _setup(db)
        viewer = _make_user(db, UserRole.viewer, industry_id=admin.org_id)
        resp = client.get(f"{BASE}/dashboard", headers=_auth(viewer))
        assert resp.status_code == 403
