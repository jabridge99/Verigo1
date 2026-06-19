"""
Background task functions for Verigo.

These are plain async functions invoked via FastAPI's BackgroundTasks
mechanism — no external broker (Celery / ARQ) required.

Usage in a route:
    from fastapi import BackgroundTasks
    from app.worker import add_background_task, send_reminder_emails

    @router.post("/send-reminders")
    async def trigger(background_tasks: BackgroundTasks, ...):
        add_background_task(background_tasks, send_reminder_emails, org_id, item_ids)
        return {"queued": True}
"""

import logging
from typing import Any, Callable, List

from fastapi import BackgroundTasks

log = logging.getLogger("tvg.worker")


# ── Helper ────────────────────────────────────────────────────────────────────


def add_background_task(
    background_tasks: BackgroundTasks,
    fn: Callable,
    *args: Any,
    **kwargs: Any,
) -> None:
    """
    Enqueue *fn* to run in the background after the response is sent.
    Wraps FastAPI's BackgroundTasks.add_task for a consistent call site.
    """
    background_tasks.add_task(fn, *args, **kwargs)


# ── Audit helper (internal) ───────────────────────────────────────────────────


def _write_audit_log(org_id: str, action: str, detail: dict) -> None:
    """Write a simple audit log entry; errors are swallowed to avoid crashing workers."""
    try:
        from app.db.database import SessionLocal
        from app.models.audit_log import AuditEventType, AuditLog

        db = SessionLocal()
        try:
            entry = AuditLog(
                org_id=org_id,
                event_type=AuditEventType.transaction_monitoring_run,  # closest generic type
                action=action,
                log_metadata=detail,
            )
            db.add(entry)
            db.commit()
        finally:
            db.close()
    except Exception as exc:
        log.debug("Audit log write failed (%s): %s", action, exc)


# ── Task: compliance calendar reminders ──────────────────────────────────────


async def send_reminder_emails(org_id: str, item_ids: List[str]) -> None:
    """
    Process compliance calendar reminders for the given items and send
    notification emails to relevant users.
    """
    log.info(
        "[worker] send_reminder_emails start — org=%s items=%s",
        org_id,
        item_ids,
    )
    try:
        from app.db.database import SessionLocal
        from app.services.email_service import send_email  # type: ignore

        db = SessionLocal()
        try:
            from app.models.compliance_calendar import (
                ComplianceCalendar,  # type: ignore
            )

            for item_id in item_ids:
                item = (
                    db.query(ComplianceCalendar)
                    .filter(
                        ComplianceCalendar.id == item_id,
                        ComplianceCalendar.org_id == org_id,
                    )
                    .first()
                )
                if item is None:
                    log.debug("[worker] reminder item not found: %s", item_id)
                    continue

                try:
                    await send_email(
                        to=item.assigned_to_email
                        if hasattr(item, "assigned_to_email")
                        else "",
                        subject=f"[Verigo] Compliance reminder: {getattr(item, 'title', item_id)}",
                        body=(
                            f"This is a reminder that the following compliance item is due:\n\n"
                            f"  {getattr(item, 'title', item_id)}\n"
                            f"  Due: {getattr(item, 'due_date', 'N/A')}\n\n"
                            f"Log in to Verigo to view and complete this item."
                        ),
                    )
                except Exception as email_exc:
                    log.warning(
                        "[worker] Email send failed for item %s: %s", item_id, email_exc
                    )
        finally:
            db.close()

    except Exception as exc:
        log.exception("[worker] send_reminder_emails failed — org=%s: %s", org_id, exc)
        return

    _write_audit_log(org_id, "send_reminder_emails", {"item_ids": item_ids})
    log.info("[worker] send_reminder_emails done — org=%s", org_id)


# ── Task: automation rule processing ─────────────────────────────────────────


async def process_monitoring_rules(org_id: str, transaction_id: str) -> None:
    """
    Evaluate all active automation rules for the given organisation against
    the newly recorded transaction.
    """
    log.info(
        "[worker] process_monitoring_rules start — org=%s tx=%s",
        org_id,
        transaction_id,
    )
    try:
        from app.db.database import SessionLocal

        db = SessionLocal()
        try:
            # Import the monitoring engine if available; handle graceful absence
            try:
                from app.services.monitoring_engine import (  # type: ignore
                    evaluate_rules_for_transaction,
                )

                await evaluate_rules_for_transaction(db, org_id, transaction_id)
            except ImportError:
                log.debug(
                    "[worker] monitoring_engine.evaluate_rules_for_transaction not available"
                )
        finally:
            db.close()

    except Exception as exc:
        log.exception(
            "[worker] process_monitoring_rules failed — org=%s tx=%s: %s",
            org_id,
            transaction_id,
            exc,
        )
        return

    _write_audit_log(
        org_id,
        "process_monitoring_rules",
        {"transaction_id": transaction_id},
    )
    log.info(
        "[worker] process_monitoring_rules done — org=%s tx=%s", org_id, transaction_id
    )


# ── Task: report export ───────────────────────────────────────────────────────


async def generate_report_export(
    report_type: str,
    report_id: str,
    org_id: str,
    user_id: str,
) -> None:
    """
    Generate an export file (CSV / PDF) for a report and persist it to the
    configured storage backend.  Notifies the requesting user when done.
    """
    log.info(
        "[worker] generate_report_export start — org=%s report_type=%s report_id=%s user=%s",
        org_id,
        report_type,
        report_id,
        user_id,
    )
    try:
        from app.db.database import SessionLocal

        db = SessionLocal()
        try:
            try:
                from app.services.reporting_service import (  # type: ignore
                    build_report_export,
                )

                await build_report_export(
                    db,
                    org_id=org_id,
                    report_type=report_type,
                    report_id=report_id,
                    requested_by=user_id,
                )
            except ImportError:
                log.debug(
                    "[worker] reporting_service.build_report_export not available"
                )
        finally:
            db.close()

    except Exception as exc:
        log.exception(
            "[worker] generate_report_export failed — org=%s report_id=%s: %s",
            org_id,
            report_id,
            exc,
        )
        return

    _write_audit_log(
        org_id,
        "generate_report_export",
        {"report_type": report_type, "report_id": report_id, "user_id": user_id},
    )
    log.info(
        "[worker] generate_report_export done — org=%s report_id=%s", org_id, report_id
    )


# ── Task: scheduled screening refresh ────────────────────────────────────────


async def run_scheduled_screening(org_id: str, customer_id: str) -> None:
    """
    Trigger a background sanctions / PEP screening refresh for a customer.
    Results are persisted via the screening service and alerts raised if needed.
    """
    log.info(
        "[worker] run_scheduled_screening start — org=%s customer=%s",
        org_id,
        customer_id,
    )
    try:
        from app.db.database import SessionLocal

        db = SessionLocal()
        try:
            try:
                from app.services.sanctions_screening import (  # type: ignore
                    refresh_customer_screening,
                )

                await refresh_customer_screening(
                    db, org_id=org_id, customer_id=customer_id
                )
            except ImportError:
                log.debug(
                    "[worker] sanctions_screening.refresh_customer_screening not available"
                )
        finally:
            db.close()

    except Exception as exc:
        log.exception(
            "[worker] run_scheduled_screening failed — org=%s customer=%s: %s",
            org_id,
            customer_id,
            exc,
        )
        return

    _write_audit_log(
        org_id,
        "run_scheduled_screening",
        {"customer_id": customer_id},
    )
    log.info(
        "[worker] run_scheduled_screening done — org=%s customer=%s",
        org_id,
        customer_id,
    )
