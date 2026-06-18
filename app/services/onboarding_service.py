"""
Onboarding Autopilot service.
"""

import secrets
import uuid
from datetime import datetime, timedelta, timezone

from app.models.customer import Customer, CustomerStatus
from app.models.onboarding import (
    CustomerType,
    ImportBatch,
    ImportSource,
    OnboardingAuditLog,
    OnboardingSession,
    SessionStatus,
)
from app.services.risk_scoring import score_customer, score_to_level
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


def submit_onboarding(db, session, ip_address=None):
    if session.status == SessionStatus.completed:
        return {"status": "already_completed", "customer_id": session.customer_id}
    data = session.collected_data or {}
    session.status = SessionStatus.verification_pending
    _log(
        db,
        session,
        "submitted",
        {"documents_uploaded": session.documents_uploaded, "completion_pct": 100},
        actor="applicant",
        ip_address=ip_address,
    )
    sanctions = screen_name(session.applicant_name)
    _log(
        db,
        session,
        "screening_run",
        {
            "sanctions_match": sanctions["match_found"],
            "lists_checked": sanctions["watchlists_checked"],
        },
    )
    session.sanctions_match = sanctions["match_found"]
    customer = Customer(
        customer_id=f"CUST-{uuid.uuid4().hex[:10].upper()}",
        full_name=session.applicant_name,
        date_of_birth=data.get("date_of_birth", ""),
        nationality=data.get("nationality", ""),
        country_of_residence=data.get("country_of_residence", "AU"),
        id_number=data.get("id_number", ""),
        id_type=data.get("id_type", "passport"),
        address=data.get("address", ""),
        email=session.applicant_email,
        phone=session.applicant_phone or data.get("phone", ""),
        industry=session.industry_id.replace("-", "_").split("_")[0],
        occupation=data.get("occupation"),
        source_of_funds=data.get("source_of_funds"),
        status=CustomerStatus.suspended
        if sanctions["match_found"]
        else CustomerStatus.kyc_in_progress,
        is_pep=1 if data.get("is_pep") else 0,
    )
    risk_score = score_customer(customer)
    customer.risk_score = risk_score
    customer.risk_level = score_to_level(risk_score)
    db.add(customer)
    db.flush()
    # KYC verification is now tracked per-document via CustomerIdentityDocument /
    # CustomerSelfieVerification etc. (see app.models.kyc) rather than a single
    # KYCRecord — Customer.status above already reflects the kyc_in_progress /
    # suspended outcome of this sanctions check.
    session.status = (
        SessionStatus.rejected if sanctions["match_found"] else SessionStatus.completed
    )
    session.customer_id = customer.customer_id
    session.kyc_id = f"KYC-{uuid.uuid4().hex[:10].upper()}"
    session.risk_score = risk_score
    session.risk_level = score_to_level(risk_score)
    session.completion_pct = 100.0
    session.completed_at = datetime.now(timezone.utc)
    _log(
        db,
        session,
        "completed" if not sanctions["match_found"] else "rejected",
        {
            "customer_id": customer.customer_id,
            "kyc_id": session.kyc_id,
            "risk_score": risk_score,
            "risk_level": score_to_level(risk_score),
            "sanctions_match": sanctions["match_found"],
        },
    )
    db.commit()
    return {
        "status": session.status,
        "customer_id": customer.customer_id,
        "kyc_id": session.kyc_id,
        "risk_score": risk_score,
        "risk_level": score_to_level(risk_score),
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
