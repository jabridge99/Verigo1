"""
Onboarding Autopilot service.
"""

import secrets
import uuid
from datetime import datetime, timedelta, timezone

from app.models.customer import Customer, CustomerStatus
from app.models.customer import CustomerType as MasterCustomerType
from app.models.onboarding import (
    CustomerType,
    ImportBatch,
    ImportSource,
    OnboardingAuditLog,
    OnboardingSession,
    SessionStatus,
)
from app.models.screening import (
    ScreeningEntityType,
    ScreeningProvider,
    ScreeningRecord,
    ScreeningStatus,
    ScreeningType,
)
from app.services.sanctions_screening import screen_name

INVITE_EXPIRY_DAYS = 7
REMINDER_INTERVALS_HOURS = [24, 72, 168]

ONBOARDING_STEPS = [
    {"step": 0, "name": "Welcome", "description": "Confirm your details"},
    {"step": 1, "name": "Identity", "description": "Upload your ID document"},
    {"step": 2, "name": "Address", "description": "Prove your residential address"},
    {
        "step": 3,
        "name": "Source of Funds",
        "description": "Declare your source of funds",
    },
    {
        "step": 4,
        "name": "Declarations",
        "description": "PEP & beneficial owner declarations",
    },
    {"step": 5, "name": "Review", "description": "Review and submit"},
]


def _log(db, session, event_type, event_data=None, actor="system", ip_address=None):
    db.add(
        OnboardingAuditLog(
            session_id=session.id,
            event_type=event_type,
            event_data=event_data or {},
            actor=actor,
            ip_address=ip_address,
        )
    )


def create_session(
    db,
    *,
    industry_id,
    organisation_id=None,
    applicant_name,
    applicant_email,
    applicant_phone=None,
    applicant_company=None,
    customer_type="individual",
    source="manual",
    created_by=None,
    batch_id=None,
):
    token = secrets.token_urlsafe(32)
    expires = datetime.now(timezone.utc) + timedelta(days=INVITE_EXPIRY_DAYS)
    session = OnboardingSession(
        session_id=f"OBS-{uuid.uuid4().hex[:10].upper()}",
        industry_id=industry_id,
        organisation_id=organisation_id,
        customer_type=CustomerType(customer_type),
        applicant_name=applicant_name,
        applicant_email=applicant_email,
        applicant_phone=applicant_phone,
        applicant_company=applicant_company,
        invite_token=token,
        invite_expires_at=expires,
        source=ImportSource(source),
        created_by=created_by,
        batch_id=batch_id,
        status=SessionStatus.invited,
        total_steps=len(ONBOARDING_STEPS) - 1,
    )
    db.add(session)
    db.flush()
    _log(
        db,
        session,
        "session_created",
        {
            "applicant_email": applicant_email,
            "industry_id": industry_id,
            "source": source,
        },
        actor=created_by or "system",
    )
    _log(
        db,
        session,
        "invite_sent",
        {
            "token_expires": expires.isoformat(),
            "email": applicant_email,
            "method": "email",
        },
    )
    session.invite_sent_at = datetime.now(timezone.utc)

    # Operator-entered applicants (manual/bulk) skip the self-serve portal
    # entirely, so create the draft Customer record up front rather than
    # waiting for submit_onboarding (which only fires off the applicant's
    # own portal submission) — otherwise an ops-entered applicant would have
    # nowhere to attach KYC documents to and would never appear in the app.
    customer = Customer(
        customer_ref=f"CUST-{uuid.uuid4().hex[:10].upper()}",
        org_id=organisation_id,
        customer_type=MasterCustomerType.company
        if CustomerType(customer_type) == CustomerType.business
        else MasterCustomerType.individual,
        status=CustomerStatus.draft,
        full_name=applicant_name,
        email=applicant_email,
        phone=applicant_phone or "",
    )
    db.add(customer)
    db.flush()
    session.customer_id = customer.id
    _log(
        db,
        session,
        "customer_created",
        {"customer_id": customer.id, "source": source},
        actor=created_by or "system",
    )
    return session


def bulk_create_sessions(
    db, rows, industry_id, source, file_name=None, created_by=None, organisation_id=None
):
    batch_id = f"BATCH-{uuid.uuid4().hex[:10].upper()}"
    errors = []
    success = 0
    batch = ImportBatch(
        batch_id=batch_id,
        industry_id=industry_id,
        organisation_id=organisation_id,
        source=ImportSource(source),
        file_name=file_name,
        total_rows=len(rows),
        created_by=created_by,
    )
    db.add(batch)
    db.flush()
    for i, row in enumerate(rows):
        try:
            name = row.get("name") or row.get("full_name") or ""
            email = row.get("email") or ""
            if not name.strip() or not email.strip():
                raise ValueError("name and email are required")
            create_session(
                db,
                industry_id=industry_id,
                organisation_id=organisation_id,
                applicant_name=name.strip(),
                applicant_email=email.strip().lower(),
                applicant_phone=row.get("phone") or row.get("mobile"),
                applicant_company=row.get("company") or row.get("business_name"),
                customer_type=row.get("customer_type", "individual"),
                source=source,
                created_by=created_by,
                batch_id=batch_id,
            )
            success += 1
        except Exception as exc:
            errors.append({"row": i + 1, "data": row, "error": str(exc)})
    batch.success_rows = success
    batch.error_rows = len(errors)
    batch.errors = errors
    return batch


def open_invite(db, token, ip_address=None):
    session = db.query(OnboardingSession).filter_by(invite_token=token).first()
    if not session:
        return None
    if session.status == SessionStatus.invited:
        session.status = SessionStatus.opened
        session.invite_opened_at = datetime.now(timezone.utc)
        _log(db, session, "invite_opened", {}, actor="applicant", ip_address=ip_address)
    return session


def advance_step(db, session, step, step_data, ip_address=None):
    session.current_step = step
    session.status = SessionStatus.in_progress
    session.completion_pct = round((step / session.total_steps) * 100, 1)
    existing = session.collected_data or {}
    existing.update(step_data)
    session.collected_data = existing
    if step_data.get("document_uploaded"):
        session.documents_uploaded = (session.documents_uploaded or 0) + 1
    _log(
        db,
        session,
        "step_completed",
        {
            "step": step,
            "step_name": ONBOARDING_STEPS[step]["name"]
            if step < len(ONBOARDING_STEPS)
            else "unknown",
            "data_keys": list(step_data.keys()),
        },
        actor="applicant",
        ip_address=ip_address,
    )
    return session


def _parse_date(value):
    if not value:
        return None
    try:
        return datetime.strptime(value, "%Y-%m-%d").date()
    except (TypeError, ValueError):
        return None


def submit_onboarding(db, session, ip_address=None):
    """
    Finishes the applicant's self-entry step (Step 1). This does NOT decide
    KYC pass/fail — a Customer record is created in `draft` status as the
    screenable subject, but only Step 3 (document screening / composite
    identity score, see app.services.identity_verification_service) can
    promote it to `active`. Applicants stay out of the Customers list
    (see customers.py list_customers default filter) until that happens.
    """
    if session.customer_id:
        return {"status": "already_completed", "customer_id": session.customer_id}
    data = session.collected_data or {}

    sanctions = screen_name(session.applicant_name)
    session.sanctions_match = sanctions["match_found"]
    _log(
        db,
        session,
        "screening_run",
        {
            "sanctions_match": sanctions["match_found"],
            "lists_checked": sanctions["watchlists_checked"],
        },
    )

    customer = Customer(
        customer_ref=f"CUST-{uuid.uuid4().hex[:10].upper()}",
        org_id=session.organisation_id,
        customer_type=MasterCustomerType.company
        if session.customer_type == CustomerType.business
        else MasterCustomerType.individual,
        status=CustomerStatus.draft,
        full_name=session.applicant_name,
        date_of_birth=_parse_date(data.get("date_of_birth")),
        nationality=(data.get("nationality") or "")[:2],
        country_of_residence=(data.get("country_of_residence") or "AU")[:2],
        email=session.applicant_email,
        phone=session.applicant_phone or data.get("phone", ""),
        occupation=data.get("occupation"),
        source_of_funds=data.get("source_of_funds"),
        is_pep=bool(data.get("is_pep")),
        is_sanctions_match=sanctions["match_found"],
    )
    db.add(customer)
    db.flush()

    # Fold the quick name-screen into the unified ScreeningRecord table so
    # Step 3's composite identity score (which reads ScreeningRecord by type)
    # picks it up as the sanctions category input, instead of being a
    # one-off check that the rest of the pipeline never sees.
    db.add(
        ScreeningRecord(
            org_id=customer.org_id,
            customer_id=customer.id,
            screening_type=ScreeningType.sanctions,
            entity_type=ScreeningEntityType.customer,
            entity_id=customer.id,
            entity_name=customer.full_name,
            provider=ScreeningProvider.internal,
            status=ScreeningStatus.potential_match
            if sanctions["match_found"]
            else ScreeningStatus.clear,
            match_count=1 if sanctions["match_found"] else 0,
            match_score=80.0 if sanctions["match_found"] else 0.0,
            lists_checked=sanctions["watchlists_checked"],
            triggered_by="system",
        )
    )

    session.status = SessionStatus.documents_submitted
    session.customer_id = customer.id
    session.completion_pct = max(session.completion_pct or 0.0, 60.0)
    _log(
        db,
        session,
        "applicant_step_completed",
        {"customer_id": customer.id, "sanctions_match": sanctions["match_found"]},
    )
    db.commit()
    return {
        "status": session.status,
        "customer_id": customer.id,
        "sanctions_match": sanctions["match_found"],
    }


def get_sessions_needing_reminder(db):
    now = datetime.now(timezone.utc)
    pending = (
        db.query(OnboardingSession)
        .filter(
            OnboardingSession.status.in_(
                [SessionStatus.invited, SessionStatus.opened, SessionStatus.in_progress]
            )
        )
        .all()
    )
    due = []
    for s in pending:
        if not s.invite_sent_at:
            continue
        hours_since = (
            now - s.invite_sent_at.replace(tzinfo=timezone.utc)
        ).total_seconds() / 3600
        last_reminder_hours = (
            (now - s.last_reminder_at.replace(tzinfo=timezone.utc)).total_seconds()
            / 3600
            if s.last_reminder_at
            else hours_since
        )
        count = s.reminders_sent or 0
        if count < len(REMINDER_INTERVALS_HOURS):
            threshold = REMINDER_INTERVALS_HOURS[count]
            if hours_since >= threshold and last_reminder_hours >= 24:
                due.append(s)
    return due


def send_reminder(db, session):
    session.reminders_sent = (session.reminders_sent or 0) + 1
    session.last_reminder_at = datetime.now(timezone.utc)
    _log(
        db,
        session,
        "reminder_sent",
        {"reminder_number": session.reminders_sent, "email": session.applicant_email},
    )
    db.commit()
