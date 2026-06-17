"""
Customer Portal Service — Phase 10

Enables secure, token-based self-service onboarding portals.
Customers can upload KYC documents and complete CDD/EDD questionnaires
without staff involvement.

Security design:
  - Raw token is returned ONCE at invitation time (never stored)
  - Only the SHA-256 hash is stored in the DB
  - Tokens expire (default 7 days)
  - All portal access is logged (IP, timestamp)
"""
from __future__ import annotations

import hashlib
import secrets
from datetime import datetime, timedelta, timezone
from typing import Optional

from fastapi import HTTPException
from sqlalchemy.orm import Session

from app.models.customer_portal import (
    CustomerPortalSession, CustomerPortalDocument, CustomerPortalQuestionnaireResponse,
    PortalSessionStatus, PortalDocumentStatus,
)
from app.models.customer import Customer, CustomerStatus


def _hash_token(raw_token: str) -> str:
    return hashlib.sha256(raw_token.encode()).hexdigest()


def create_portal_session(
    db: Session,
    customer_id: str,
    org_id: str,
    invited_by: str,
    portal_type: str,
    required_documents: list[str],
    required_sections: list[str],
    expiry_days: int = 7,
) -> tuple[CustomerPortalSession, str]:
    customer = db.query(Customer).filter_by(id=customer_id, org_id=org_id).first()
    if not customer:
        raise HTTPException(404, "Customer not found")

    raw_token = secrets.token_urlsafe(32)
    token_hash = _hash_token(raw_token)

    expires_at = datetime.now(timezone.utc) + timedelta(days=expiry_days)

    session = CustomerPortalSession(
        token_hash=token_hash,
        customer_id=customer_id,
        org_id=org_id,
        invited_by=invited_by,
        portal_type=portal_type,
        required_documents=required_documents,
        required_questionnaire_sections=required_sections,
        customer_email=customer.email or "",
        customer_name=customer.full_name or "",
        expires_at=expires_at,
    )
    db.add(session)
    db.commit()
    db.refresh(session)
    return session, raw_token


def validate_portal_token(db: Session, raw_token: str, client_ip: Optional[str] = None) -> CustomerPortalSession:
    token_hash = _hash_token(raw_token)
    session = db.query(CustomerPortalSession).filter_by(token_hash=token_hash).first()

    if not session:
        raise HTTPException(401, "Invalid or expired portal link")

    if session.status in (PortalSessionStatus.expired, PortalSessionStatus.cancelled):
        raise HTTPException(401, "This portal link has expired or been cancelled")

    if session.status == PortalSessionStatus.submitted:
        raise HTTPException(410, "This portal submission has already been completed")

    now = datetime.now(timezone.utc)
    if session.expires_at.replace(tzinfo=timezone.utc) < now:
        session.status = PortalSessionStatus.expired
        db.commit()
        raise HTTPException(401, "This portal link has expired")

    # Update activity
    session.last_activity_at = now
    if client_ip:
        session.ip_address = client_ip
    if session.status == PortalSessionStatus.pending:
        session.status = PortalSessionStatus.in_progress
    db.commit()
    db.refresh(session)
    return session


def get_portal_state(db: Session, session: CustomerPortalSession) -> dict:
    docs = db.query(CustomerPortalDocument).filter_by(session_id=session.id).all()
    responses = db.query(CustomerPortalQuestionnaireResponse).filter_by(session_id=session.id).all()

    uploaded_categories = {d.document_category for d in docs if d.status != PortalDocumentStatus.pending}
    required_docs = session.required_documents or []
    required_sections = session.required_questionnaire_sections or []
    completed_sections = {r.section_key for r in responses if r.completed}

    docs_complete = all(c in uploaded_categories for c in required_docs)
    sections_complete = all(s in completed_sections for s in required_sections)
    total_steps = len(required_docs) + len(required_sections)
    completed_steps = len(uploaded_categories.intersection(required_docs)) + len(completed_sections.intersection(required_sections))
    progress_pct = int((completed_steps / total_steps * 100) if total_steps else 100)

    return {
        "session_id": session.id,
        "status": session.status,
        "portal_type": session.portal_type,
        "customer_name": session.customer_name,
        "expires_at": session.expires_at.isoformat(),
        "progress_percent": progress_pct,
        "documents_complete": docs_complete,
        "questionnaire_complete": sections_complete,
        "ready_to_submit": docs_complete and sections_complete,
        "required_documents": required_docs,
        "required_sections": required_sections,
        "documents": [
            {
                "id": d.id,
                "category": d.document_category,
                "status": d.status,
                "uploaded_at": d.uploaded_at.isoformat() if d.uploaded_at else None,
                "rejection_reason": d.rejection_reason,
            }
            for d in docs
        ],
        "questionnaire_sections": [
            {
                "section_key": r.section_key,
                "completed": r.completed,
                "submitted_at": r.submitted_at.isoformat() if r.submitted_at else None,
            }
            for r in responses
        ],
    }


async def upload_portal_document(
    db: Session,
    session: CustomerPortalSession,
    document_category: str,
    filename: str,
    file_content: bytes,
    mime_type: str,
) -> CustomerPortalDocument:
    if document_category not in (session.required_documents or []):
        raise HTTPException(422, f"Document category '{document_category}' is not required for this portal session")

    from app.models.document import DocumentCategory
    from app.services import document_service

    try:
        doc_category = DocumentCategory(document_category)
    except ValueError:
        doc_category = DocumentCategory.other

    stored_doc = await document_service.create_document(
        db,
        filename=filename,
        content=file_content,
        mime_type=mime_type,
        uploaded_by=session.customer_id,
        industry_id=session.org_id,
        category=doc_category,
        entity_type="CustomerPortalSession",
        entity_id=session.id,
        sha256_hash=hashlib.sha256(file_content).hexdigest(),
    )

    existing = db.query(CustomerPortalDocument).filter_by(
        session_id=session.id, document_category=document_category
    ).first()

    now = datetime.now(timezone.utc)

    if existing:
        existing.status = PortalDocumentStatus.uploaded
        existing.uploaded_at = now
        existing.rejection_reason = None
        existing.document_id = stored_doc.doc_id
        db.commit()
        db.refresh(existing)
        return existing

    doc_record = CustomerPortalDocument(
        session_id=session.id,
        customer_id=session.customer_id,
        org_id=session.org_id,
        document_category=document_category,
        document_id=stored_doc.doc_id,
        status=PortalDocumentStatus.uploaded,
        uploaded_at=now,
    )
    db.add(doc_record)
    db.commit()
    db.refresh(doc_record)
    return doc_record


def save_questionnaire_response(
    db: Session,
    session: CustomerPortalSession,
    section_key: str,
    responses: dict,
    mark_complete: bool = False,
) -> CustomerPortalQuestionnaireResponse:
    existing = db.query(CustomerPortalQuestionnaireResponse).filter_by(
        session_id=session.id, section_key=section_key
    ).first()

    now = datetime.now(timezone.utc)

    if existing:
        existing.responses = responses
        if mark_complete:
            existing.completed = True
            existing.submitted_at = now
        db.commit()
        db.refresh(existing)
        return existing

    record = CustomerPortalQuestionnaireResponse(
        session_id=session.id,
        customer_id=session.customer_id,
        org_id=session.org_id,
        section_key=section_key,
        responses=responses,
        completed=mark_complete,
        submitted_at=now if mark_complete else None,
    )
    db.add(record)
    db.commit()
    db.refresh(record)
    return record


def submit_portal_session(db: Session, session: CustomerPortalSession) -> dict:
    state = get_portal_state(db, session)
    if not state["ready_to_submit"]:
        raise HTTPException(422, "Portal submission incomplete — please upload all required documents and complete all questionnaire sections")

    session.status = PortalSessionStatus.submitted
    session.submitted_at = datetime.now(timezone.utc)

    customer = db.query(Customer).filter_by(id=session.customer_id).first()
    if customer and customer.status == CustomerStatus.draft:
        customer.status = CustomerStatus.pending
    db.commit()

    return {
        "submitted": True,
        "session_id": session.id,
        "customer_id": session.customer_id,
        "submitted_at": session.submitted_at.isoformat(),
        "message": "Your information has been submitted. Our team will review your documents and contact you if anything further is required.",
    }


def staff_review_document(
    db: Session,
    session_id: str,
    doc_id: str,
    org_id: str,
    reviewer_user_id: str,
    accepted: bool,
    rejection_reason: Optional[str] = None,
) -> CustomerPortalDocument:
    doc = db.query(CustomerPortalDocument).filter_by(id=doc_id, session_id=session_id).first()
    if not doc:
        raise HTTPException(404, "Document not found")
    if doc.org_id != org_id:
        raise HTTPException(403, "Access denied")

    doc.status = PortalDocumentStatus.accepted if accepted else PortalDocumentStatus.rejected
    doc.reviewed_by = reviewer_user_id
    doc.reviewed_at = datetime.now(timezone.utc)
    doc.rejection_reason = rejection_reason if not accepted else None
    db.commit()
    db.refresh(doc)
    return doc


def expire_stale_sessions(db: Session) -> int:
    now = datetime.now(timezone.utc)
    stale = db.query(CustomerPortalSession).filter(
        CustomerPortalSession.expires_at < now,
        CustomerPortalSession.status.in_([PortalSessionStatus.pending, PortalSessionStatus.in_progress]),
    ).all()
    for s in stale:
        s.status = PortalSessionStatus.expired
    db.commit()
    return len(stale)
