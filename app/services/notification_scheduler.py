"""
Notification Scheduler — deadline scanner

Scans for approaching regulatory and governance deadlines and fires
notifications via compliance_event_notifier.

Called by:
  POST /api/v1/notifications/run-deadline-check   (admin — triggered by cron/scheduler)

AUSTRAC deadline rules:
  SMR  — must be filed within 3 business days of forming suspicion (s.41)
  IFTI — must be filed within 3 business days of the transfer (s.45)
  TTR  — must be filed within 3 business days of the transaction (s.43)

Governance deadline rules:
  Training overdue   — due_date < today and status in (assigned, in_progress)
  Control test overdue — scheduled_date < today and not completed
  Policy review due  — review_due_date within 30 days
  Independent review due — target_completion within 30 days
"""

from __future__ import annotations

import logging
from datetime import date, datetime, timedelta, timezone

from sqlalchemy.orm import Session

from app.services import compliance_event_notifier as notifier

log = logging.getLogger("tvg.scheduler")


def run_all_deadline_checks(db: Session) -> dict:
    """
    Master entry point — run all deadline checks and return a summary.
    Called by the scheduled endpoint or a background worker.
    """
    results = {}
    results["smr_deadlines"] = check_smr_deadlines(db)
    results["ifti_deadlines"] = check_ifti_deadlines(db)
    results["ttr_deadlines"] = check_ttr_deadlines(db)
    results["training_overdue"] = check_training_overdue(db)
    results["control_test_overdue"] = check_control_test_overdue(db)
    results["policy_review_due"] = check_policy_review_due(db)
    results["ir_review_due"] = check_independent_review_due(db)
    results["customer_review_due"] = check_customer_review_due(db)
    results["checked_at"] = datetime.now(timezone.utc).isoformat()

    total = sum(v for v in results.values() if isinstance(v, int))
    results["total_notifications_sent"] = total
    log.info("Deadline check complete — %d notifications sent", total)
    return results


# ══════════════════════════════════════════════════════════════════════════════
# REGULATORY REPORTING DEADLINES
# ══════════════════════════════════════════════════════════════════════════════


def check_smr_deadlines(db: Session) -> int:
    """
    Fire notifications for SMRs not yet filed where the suspicion date
    means the 3-business-day deadline is approaching (1 day and 3 days warning).
    """
    try:
        from app.models.report import ReportStatus, SMRReport

        today = date.today()
        total = 0

        pending_smrs = (
            db.query(SMRReport)
            .filter(
                SMRReport.status.in_([ReportStatus.draft, ReportStatus.pending_review]),
            )
            .all()
        )

        for smr in pending_smrs:
            # SMR deadline: 3 business days from suspicion_date or created_at
            ref_date = getattr(smr, "suspicion_date", None) or (
                smr.created_at.date() if smr.created_at else today
            )
            deadline = ref_date + timedelta(days=4)  # approximate 3 business days
            days_remaining = (deadline - today).days

            if days_remaining in (1, 3):
                ref = getattr(smr, "report_ref", smr.id)
                total += notifier.notify_smr_deadline(
                    db, smr.org_id, smr.id, ref, days_remaining
                )
        return total
    except Exception as exc:
        log.error("SMR deadline check failed: %s", exc)
        return 0


def check_ifti_deadlines(db: Session) -> int:
    try:
        from app.models.report import IFTIReport, ReportStatus

        today = date.today()
        total = 0

        pending = (
            db.query(IFTIReport)
            .filter(
                IFTIReport.status.in_(
                    [ReportStatus.draft, ReportStatus.pending_review]
                ),
            )
            .all()
        )

        for ifti in pending:
            ref_date = getattr(ifti, "transfer_date", None)
            if not ref_date:
                ref_date = ifti.created_at.date() if ifti.created_at else today
            deadline = ref_date + timedelta(days=4)
            hours_remaining = max(
                0,
                int(
                    (
                        datetime.combine(deadline, datetime.min.time()) - datetime.now()
                    ).total_seconds()
                    / 3600
                ),
            )

            if 0 < hours_remaining <= 48:
                ref = getattr(ifti, "report_ref", ifti.id)
                total += notifier.notify_ifti_deadline(
                    db, ifti.org_id, ifti.id, ref, hours_remaining
                )
        return total
    except Exception as exc:
        log.error("IFTI deadline check failed: %s", exc)
        return 0


def check_ttr_deadlines(db: Session) -> int:
    try:
        from app.models.report import ReportStatus, TTRReport

        today = date.today()
        total = 0

        pending = (
            db.query(TTRReport)
            .filter(
                TTRReport.status.in_([ReportStatus.draft, ReportStatus.pending_review]),
            )
            .all()
        )

        for ttr in pending:
            ref_date = getattr(ttr, "transaction_date", None)
            if not ref_date:
                ref_date = ttr.created_at.date() if ttr.created_at else today
            deadline = ref_date + timedelta(days=4)
            days_remaining = (deadline - today).days

            if days_remaining in (1, 3):
                ref = getattr(ttr, "report_ref", ttr.id)
                total += notifier.notify_ttr_deadline(
                    db, ttr.org_id, ttr.id, ref, days_remaining
                )
        return total
    except Exception as exc:
        log.error("TTR deadline check failed: %s", exc)
        return 0


# ══════════════════════════════════════════════════════════════════════════════
# TRAINING
# ══════════════════════════════════════════════════════════════════════════════


def check_training_overdue(db: Session) -> int:
    try:
        from app.models.governance_training import (
            GovernanceTrainingRecord,
            TrainingStatus,
        )

        today = date.today()
        total = 0
        notified_records = []

        overdue_records = (
            db.query(GovernanceTrainingRecord)
            .filter(
                GovernanceTrainingRecord.due_date < today,
                GovernanceTrainingRecord.status.in_(
                    [TrainingStatus.assigned, TrainingStatus.in_progress]
                ),
            )
            .all()
        )

        for record in overdue_records:
            days_overdue = (today - record.due_date).days
            # Only notify at specific intervals to avoid spam: 1, 7, 14, 30 days
            if days_overdue not in (1, 7, 14, 30):
                continue
            course_name = record.course.name if record.course else "Unknown course"
            notifier.notify_training_overdue(
                db, record.user_id, record.org_id, course_name, days_overdue, record.id
            )
            # Mark as overdue
            record.status = TrainingStatus.overdue
            notified_records.append(record)
            total += 1

        db.commit()

        from app.models.automation_rule import RuleEventType
        from app.services.automation_engine import evaluate_automation_rules

        for record in notified_records:
            evaluate_automation_rules(
                db, RuleEventType.training_expiring, record.org_id, "training_record",
                record.id, {"training": {"status": record.status.value, "user_id": record.user_id}},
                triggered_by="system",
            )

        return total
    except Exception as exc:
        log.error("Training overdue check failed: %s", exc)
        return 0


# ══════════════════════════════════════════════════════════════════════════════
# GOVERNANCE CONTROLS
# ══════════════════════════════════════════════════════════════════════════════


def check_control_test_overdue(db: Session) -> int:
    """
    A control's *next* test is scheduled on GovernanceControl.next_test_date —
    ControlTest rows only record tests already performed (test_date), so there
    is no "scheduled_date" to query there.
    """
    try:
        from app.models.governance_controls import ControlStatus, GovernanceControl

        today = date.today()
        total = 0

        overdue_controls = (
            db.query(GovernanceControl)
            .filter(
                GovernanceControl.next_test_date.isnot(None),
                GovernanceControl.next_test_date < today,
                GovernanceControl.status == ControlStatus.active,
            )
            .all()
        )

        for control in overdue_controls:
            days_overdue = (today - control.next_test_date).days
            if days_overdue not in (1, 7, 14, 30):
                continue
            notifier.notify_control_test_overdue(
                db,
                control.org_id,
                control.id,
                getattr(control, "control_ref", control.id),
                days_overdue,
            )
            total += 1
        return total
    except Exception as exc:
        log.error("Control test overdue check failed: %s", exc)
        return 0


# ══════════════════════════════════════════════════════════════════════════════
# POLICY REVIEW
# ══════════════════════════════════════════════════════════════════════════════


def check_policy_review_due(db: Session) -> int:
    try:
        from app.models.governance import Policy, PolicyLifecycleStatus

        today = date.today()
        in_30_days = today + timedelta(days=30)
        total = 0

        due_policies = (
            db.query(Policy)
            .filter(
                Policy.review_due_date.isnot(None),
                Policy.review_due_date <= in_30_days,
                Policy.review_due_date >= today,
                Policy.status.in_(
                    [
                        PolicyLifecycleStatus.published,
                        PolicyLifecycleStatus.periodic_review,
                    ]
                ),
            )
            .all()
        )

        for policy in due_policies:
            days_remaining = (policy.review_due_date - today).days
            if days_remaining not in (1, 7, 14, 30):
                continue
            notifier.notify_policy_review_due(
                db, policy.org_id, policy.id, policy.title, days_remaining
            )
            total += 1

            from app.models.automation_rule import RuleEventType
            from app.services.automation_engine import evaluate_automation_rules

            evaluate_automation_rules(
                db, RuleEventType.policy_expiring, policy.org_id, "policy", policy.id,
                {"policy": {"title": policy.title, "days_remaining": days_remaining}},
                triggered_by="system",
            )
        return total
    except Exception as exc:
        log.error("Policy review check failed: %s", exc)
        return 0


# ══════════════════════════════════════════════════════════════════════════════
# CUSTOMER PERIODIC REVIEW
# ══════════════════════════════════════════════════════════════════════════════


def check_customer_review_due(db: Session) -> int:
    """
    Fires RuleEventType.customer_review_due for customers whose
    Customer.next_review_date has arrived (<= today). No existing
    notifier covers this — only the automation engine is invoked here.
    """
    try:
        from app.models.automation_rule import RuleEventType
        from app.models.customer import Customer, CustomerStatus
        from app.services.automation_engine import customer_context, evaluate_automation_rules

        today = date.today()
        total = 0

        due_customers = (
            db.query(Customer)
            .filter(
                Customer.next_review_date.isnot(None),
                Customer.next_review_date <= today,
                Customer.status == CustomerStatus.active,
            )
            .all()
        )

        for customer in due_customers:
            days_overdue = (today - customer.next_review_date).days
            # Only fire at specific intervals to avoid re-triggering the rule
            # engine every day for the same overdue customer.
            if days_overdue not in (0, 1, 7, 14, 30):
                continue
            evaluate_automation_rules(
                db, RuleEventType.customer_review_due, customer.org_id, "customer",
                customer.id, customer_context(customer), triggered_by="system",
            )
            total += 1

        return total
    except Exception as exc:
        log.error("Customer review due check failed: %s", exc)
        return 0


# ══════════════════════════════════════════════════════════════════════════════
# INDEPENDENT REVIEW
# ══════════════════════════════════════════════════════════════════════════════


def check_independent_review_due(db: Session) -> int:
    try:
        from app.models.independent_review import IndependentReview, ReviewStatus

        today = date.today()
        in_30_days = today + timedelta(days=30)
        total = 0

        due_reviews = (
            db.query(IndependentReview)
            .filter(
                IndependentReview.target_completion.isnot(None),
                IndependentReview.target_completion <= in_30_days,
                IndependentReview.target_completion >= today,
                IndependentReview.status.notin_(
                    [ReviewStatus.completed, ReviewStatus.cancelled]
                ),
            )
            .all()
        )

        for review in due_reviews:
            days_remaining = (review.target_completion - today).days
            if days_remaining not in (1, 7, 14, 30):
                continue
            notifier.notify_independent_review_due(
                db,
                review.org_id,
                review.id,
                getattr(review, "review_ref", review.id),
                days_remaining,
            )
            total += 1
        return total
    except Exception as exc:
        log.error("IR due check failed: %s", exc)
        return 0
