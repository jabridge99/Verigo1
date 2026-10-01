"""
Smoke tests for a recurring bug class found via mypy triage: several
services and routes referenced enum *members that don't exist* on the
enum they imported (e.g. `AlertStatus.open` on app.models.monitoring's
AlertStatus, which only has generated/assigned/under_review/escalated/
dismissed/resolved/smr_candidate -- "open" is a member of the unrelated
app.models.screening.AlertStatus). Evaluating a nonexistent enum member
raises AttributeError immediately.

The most severe instance: app/services/notification_scheduler.py's
check_smr_deadlines/check_ifti_deadlines/check_ttr_deadlines used
`ReportStatus.pending_review`, which doesn't exist (real members: draft,
under_review, approved, submitted, acknowledged, rejected). Each function
wraps its body in `except Exception: log.error(...); return 0`, so the
AttributeError was silently swallowed on every call -- meaning the
AUSTRAC-mandated SMR/IFTI/TTR filing-deadline reminder emails have never
actually fired, for any organisation, ever. Fixed by using
ReportStatus.under_review (matching the already-correct
_pending_report_statuses() convention in app/api/routes/dashboard.py).
"""

from datetime import date, timedelta

from app.models.report import SMRReport
from tests.conftest import _make_org


def _make_smr(db, org, matter_date):
    smr = SMRReport(
        org_id=org.id,
        matter_date=matter_date,
        suspicion_grounds="Unusual structuring pattern observed.",
    )
    db.add(smr)
    db.commit()
    db.refresh(smr)
    return smr


def test_check_smr_deadlines_does_not_silently_fail(db, caplog):
    from app.services import notification_scheduler as sched

    org = _make_org(db)
    _make_smr(db, org, matter_date=date.today() - timedelta(days=1))

    with caplog.at_level("ERROR", logger="tvg.scheduler"):
        result = sched.check_smr_deadlines(db)

    assert isinstance(result, int)
    assert "SMR deadline check failed" not in caplog.text


def test_check_ifti_deadlines_does_not_silently_fail(db, caplog):
    from app.services import notification_scheduler as sched

    with caplog.at_level("ERROR", logger="tvg.scheduler"):
        result = sched.check_ifti_deadlines(db)

    assert isinstance(result, int)
    assert "IFTI deadline check failed" not in caplog.text


def test_check_ttr_deadlines_does_not_silently_fail(db, caplog):
    from app.services import notification_scheduler as sched

    with caplog.at_level("ERROR", logger="tvg.scheduler"):
        result = sched.check_ttr_deadlines(db)

    assert isinstance(result, int)
    assert "TTR deadline check failed" not in caplog.text


def test_check_independent_review_due_does_not_crash(db):
    # NOTE: this function has a second, separate, pre-existing bug beyond the
    # ReviewStatus.cancelled enum typo fixed here -- it filters on
    # IndependentReview.target_completion, a column that does not exist
    # anywhere on that model (see app/models/independent_review.py). That
    # means this check has never worked, and fixing it needs a real design
    # decision (what date should drive "review due" notifications -- there's
    # no per-review target/planned-completion field in the current schema)
    # rather than a mechanical enum-name fix, so it's flagged in
    # PARKING_LOT.md instead of guessed at here. Still wrapped in the
    # existing try/except, so it degrades to logging + returning 0 rather
    # than crashing the caller.
    from app.services import notification_scheduler as sched

    result = sched.check_independent_review_due(db)
    assert isinstance(result, int)


def test_board_reporting_customer_section_does_not_crash(db):
    from app.services.board_reporting_service import _customers_section

    org = _make_org(db)
    today = date.today()
    result = _customers_section(db, org.id, today - timedelta(days=30), today)
    assert result["edd_customers"] == 0


def test_board_reporting_alerts_section_does_not_crash(db):
    from app.services.board_reporting_service import _alerts_section

    org = _make_org(db)
    today = date.today()
    result = _alerts_section(db, org.id, today - timedelta(days=30), today)
    assert result["open_alerts"] == 0


def test_board_reporting_policies_section_does_not_crash(db):
    from app.services.board_reporting_service import _policies_section

    org = _make_org(db)
    today = date.today()
    result = _policies_section(db, org.id, today - timedelta(days=30), today)
    assert isinstance(result, dict)


def test_reporting_group_dashboard_does_not_crash(db):
    from app.services.reporting_group_service import create_group, get_group_dashboard

    org = _make_org(db)
    group = create_group(
        db,
        name="Test Group",
        group_type="holding_company",
        holding_org_id=org.id,
        austrac_group_id=None,
        shared_aml_program_id=None,
        created_by="usr_test",
    )
    result = get_group_dashboard(db, group.id, org.id)
    assert result["open_cases"] == 0
    assert result["open_alerts"] == 0


def test_benchmark_snapshot_metrics_does_not_crash(db):
    from app.services.benchmark_service import _compute_org_metrics

    org = _make_org(db)
    today = date.today()
    result = _compute_org_metrics(db, org.id, today - timedelta(days=7), today)
    assert isinstance(result, dict)
