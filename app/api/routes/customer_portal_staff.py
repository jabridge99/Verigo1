"""
Phase 10 — Customer Portal (Staff-side)

Staff create portal sessions, monitor progress, and review uploaded documents.
All routes require standard JWT authentication.
"""

from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app.api.deps import (
    get_db,
    require_analyst_or_above,
    require_compliance_or_above,
)
from app.models.customer_portal import (
    CustomerPortalDocument,
    CustomerPortalSession,
    PortalSessionStatus,
    PortalType,
)
from app.models.user import User
from app.services import customer_portal_service

router = APIRouter(prefix="/customer-portal", tags=["Customer Portal (Staff)"])


# ── Schemas ───────────────────────────────────────────────────────────────────


class CreatePortalSessionRequest(BaseModel):
    customer_id: str
    portal_type: PortalType = PortalType.cdd
    required_documents: List[str] = ["passport", "proof_of_address"]
    required_questionnaire_sections: List[str] = ["cdd_personal"]
    expiry_days: int = 7


class ReviewDocumentRequest(BaseModel):
    accepted: bool
    rejection_reason: Optional[str] = None


# ── Routes ────────────────────────────────────────────────────────────────────


@router.post(
    "/sessions", summary="Create a customer portal session and return the portal URL"
)
def create_session(
    body: CreatePortalSessionRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_compliance_or_above),
):
    session, raw_token = customer_portal_service.create_portal_session(
        db=db,
        customer_id=body.customer_id,
        org_id=current_user.org_id,
        invited_by=current_user.id,
        portal_type=body.portal_type,
        required_documents=body.required_documents,
        required_sections=body.required_questionnaire_sections,
        expiry_days=body.expiry_days,
    )
    portal_url = f"/portal/{raw_token}"
    return {
        "session_id": session.id,
        "customer_id": session.customer_id,
        "portal_type": session.portal_type,
        "portal_url": portal_url,
        "raw_token": raw_token,
        "expires_at": session.expires_at.isoformat(),
        "status": session.status,
        "note": "Share the portal_url with the customer. The raw_token is shown once only.",
    }


@router.get("/sessions", summary="List portal sessions for this org")
def list_sessions(
    status: Optional[PortalSessionStatus] = None,
    customer_id: Optional[str] = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_analyst_or_above),
):
    q = db.query(CustomerPortalSession).filter_by(org_id=current_user.org_id)
    if status:
        q = q.filter(CustomerPortalSession.status == status)
    if customer_id:
        q = q.filter(CustomerPortalSession.customer_id == customer_id)
    sessions = q.order_by(CustomerPortalSession.created_at.desc()).limit(100).all()
    return [
        {
            "id": s.id,
            "customer_id": s.customer_id,
            "customer_name": s.customer_name,
            "customer_email": s.customer_email,
            "portal_type": s.portal_type,
            "status": s.status,
            "expires_at": s.expires_at.isoformat() if s.expires_at else None,
            "submitted_at": s.submitted_at.isoformat() if s.submitted_at else None,
            "last_activity_at": s.last_activity_at.isoformat()
            if s.last_activity_at
            else None,
        }
        for s in sessions
    ]


@router.get("/sessions/{session_id}", summary="Get portal session detail")
def get_session(
    session_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_analyst_or_above),
):
    session = (
        db.query(CustomerPortalSession)
        .filter_by(id=session_id, org_id=current_user.org_id)
        .first()
    )
    if not session:
        raise HTTPException(404, "Portal session not found")
    return customer_portal_service.get_portal_state(db, session)


@router.delete("/sessions/{session_id}", summary="Cancel a pending portal session")
def cancel_session(
    session_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_compliance_or_above),
):
    session = (
        db.query(CustomerPortalSession)
        .filter_by(id=session_id, org_id=current_user.org_id)
        .first()
    )
    if not session:
        raise HTTPException(404, "Portal session not found")
    if session.status not in (
        PortalSessionStatus.pending,
        PortalSessionStatus.in_progress,
    ):
        raise HTTPException(
            422, f"Cannot cancel a session with status '{session.status}'"
        )
    session.status = PortalSessionStatus.cancelled
    db.commit()
    return {"cancelled": True, "session_id": session_id}


@router.post(
    "/sessions/{session_id}/resend", summary="Regenerate token and resend portal link"
)
def resend_session(
    session_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_compliance_or_above),
):
    import hashlib
    import secrets
    from datetime import datetime, timedelta, timezone

    session = (
        db.query(CustomerPortalSession)
        .filter_by(id=session_id, org_id=current_user.org_id)
        .first()
    )
    if not session:
        raise HTTPException(404, "Portal session not found")
    if session.status == PortalSessionStatus.submitted:
        raise HTTPException(422, "Cannot resend a submitted session")

    raw_token = secrets.token_urlsafe(32)
    session.token_hash = hashlib.sha256(raw_token.encode()).hexdigest()
    session.status = PortalSessionStatus.pending
    session.expires_at = datetime.now(timezone.utc) + timedelta(days=7)
    db.commit()

    return {
        "session_id": session_id,
        "portal_url": f"/portal/{raw_token}",
        "raw_token": raw_token,
        "new_expires_at": session.expires_at.isoformat(),
        "note": "New token generated. Share the new portal_url with the customer.",
    }


@router.get(
    "/sessions/{session_id}/documents", summary="List documents uploaded for a session"
)
def list_session_documents(
    session_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_analyst_or_above),
):
    session = (
        db.query(CustomerPortalSession)
        .filter_by(id=session_id, org_id=current_user.org_id)
        .first()
    )
    if not session:
        raise HTTPException(404, "Portal session not found")
    docs = db.query(CustomerPortalDocument).filter_by(session_id=session_id).all()
    return [
        {
            "id": d.id,
            "document_category": d.document_category,
            "status": d.status,
            "document_id": d.document_id,
            "uploaded_at": d.uploaded_at.isoformat() if d.uploaded_at else None,
            "reviewed_by": d.reviewed_by,
            "reviewed_at": d.reviewed_at.isoformat() if d.reviewed_at else None,
            "rejection_reason": d.rejection_reason,
        }
        for d in docs
    ]


@router.post(
    "/sessions/{session_id}/documents/{doc_id}/review",
    summary="Accept or reject an uploaded document",
)
def review_document(
    session_id: str,
    doc_id: str,
    body: ReviewDocumentRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_compliance_or_above),
):
    if not body.accepted and not body.rejection_reason:
        raise HTTPException(
            422, "rejection_reason is required when rejecting a document"
        )
    doc = customer_portal_service.staff_review_document(
        db=db,
        session_id=session_id,
        doc_id=doc_id,
        org_id=current_user.org_id,
        reviewer_user_id=current_user.id,
        accepted=body.accepted,
        rejection_reason=body.rejection_reason,
    )
    return {
        "id": doc.id,
        "status": doc.status,
        "reviewed_by": doc.reviewed_by,
        "reviewed_at": doc.reviewed_at.isoformat() if doc.reviewed_at else None,
        "rejection_reason": doc.rejection_reason,
    }


@router.get(
    "/sessions/{session_id}/questionnaire",
    summary="View questionnaire responses submitted by the customer",
)
def get_questionnaire_responses(
    session_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_analyst_or_above),
):
    from app.models.customer_portal import CustomerPortalQuestionnaireResponse

    session = (
        db.query(CustomerPortalSession)
        .filter_by(id=session_id, org_id=current_user.org_id)
        .first()
    )
    if not session:
        raise HTTPException(404, "Portal session not found")
    responses = (
        db.query(CustomerPortalQuestionnaireResponse)
        .filter_by(session_id=session_id)
        .all()
    )
    return [
        {
            "id": r.id,
            "section_key": r.section_key,
            "responses": r.responses,
            "completed": r.completed,
            "submitted_at": r.submitted_at.isoformat() if r.submitted_at else None,
        }
        for r in responses
    ]
