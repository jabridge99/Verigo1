"""
Phase 10 — Customer Portal (Public-facing)

Token-based public endpoints. No JWT auth required.
Customers access via a unique one-time link: /portal/{token}

Security:
  - Token validated on every request via get_portal_session dependency
  - Session expires after configured TTL (default 7 days)
  - Submitted sessions return 410 Gone
  - IP address logged on every access
"""

from fastapi import APIRouter, Depends, File, HTTPException, Request, UploadFile
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app.api.deps import get_db
from app.models.customer_portal import CustomerPortalSession
from app.services import customer_portal_service

router = APIRouter(prefix="/portal", tags=["Customer Portal (Public)"])


# ── Token dependency ──────────────────────────────────────────────────────────


def get_portal_session(
    token: str,
    request: Request,
    db: Session = Depends(get_db),
) -> CustomerPortalSession:
    client_ip = request.client.host if request.client else None
    return customer_portal_service.validate_portal_token(db, token, client_ip)


# ── Schemas ───────────────────────────────────────────────────────────────────


class QuestionnaireResponseRequest(BaseModel):
    responses: dict
    mark_complete: bool = False


# ── Routes ────────────────────────────────────────────────────────────────────


@router.get(
    "/{token}", summary="Get portal state — documents needed, progress, sections"
)
def get_portal_state(
    session: CustomerPortalSession = Depends(get_portal_session),
    db: Session = Depends(get_db),
):
    return customer_portal_service.get_portal_state(db, session)


@router.post(
    "/{token}/documents",
    summary="Upload a document (passport, licence, SOF, SOW, trust deed)",
)
async def upload_document(
    token: str,
    category: str,
    file: UploadFile = File(...),
    request: Request = None,
    db: Session = Depends(get_db),
):
    client_ip = request.client.host if request and request.client else None
    session = customer_portal_service.validate_portal_token(db, token, client_ip)

    allowed_mime_types = {
        "image/jpeg",
        "image/png",
        "image/webp",
        "application/pdf",
        "image/heic",
        "image/heif",
    }
    if file.content_type not in allowed_mime_types:
        raise HTTPException(
            415,
            f"File type '{file.content_type}' is not accepted. Please upload a PDF or image.",
        )

    max_size_bytes = 10 * 1024 * 1024  # 10 MB
    content = await file.read()
    if len(content) > max_size_bytes:
        raise HTTPException(413, "File exceeds the 10 MB size limit")

    doc = await customer_portal_service.upload_portal_document(
        db=db,
        session=session,
        document_category=category,
        filename=file.filename or "upload",
        file_content=content,
        mime_type=file.content_type,
    )
    return {
        "id": doc.id,
        "category": doc.document_category,
        "status": doc.status,
        "uploaded_at": doc.uploaded_at.isoformat() if doc.uploaded_at else None,
        "message": "Document uploaded successfully. Our team will review it shortly.",
    }


@router.get(
    "/{token}/documents", summary="List documents uploaded in this portal session"
)
def list_documents(
    session: CustomerPortalSession = Depends(get_portal_session),
    db: Session = Depends(get_db),
):
    from app.models.customer_portal import CustomerPortalDocument

    docs = db.query(CustomerPortalDocument).filter_by(session_id=session.id).all()
    return [
        {
            "id": d.id,
            "category": d.document_category,
            "status": d.status,
            "uploaded_at": d.uploaded_at.isoformat() if d.uploaded_at else None,
            "rejection_reason": d.rejection_reason,
        }
        for d in docs
    ]


@router.post(
    "/{token}/questionnaire/{section_key}",
    summary="Submit or update a questionnaire section",
)
def submit_questionnaire_section(
    token: str,
    section_key: str,
    body: QuestionnaireResponseRequest,
    request: Request = None,
    db: Session = Depends(get_db),
):
    client_ip = request.client.host if request and request.client else None
    session = customer_portal_service.validate_portal_token(db, token, client_ip)

    if section_key not in (session.required_questionnaire_sections or []):
        raise HTTPException(
            422, f"Section '{section_key}' is not required for this portal session"
        )

    response = customer_portal_service.save_questionnaire_response(
        db=db,
        session=session,
        section_key=section_key,
        responses=body.responses,
        mark_complete=body.mark_complete,
    )
    return {
        "id": response.id,
        "section_key": response.section_key,
        "completed": response.completed,
        "submitted_at": response.submitted_at.isoformat()
        if response.submitted_at
        else None,
    }


@router.get(
    "/{token}/questionnaire", summary="Get questionnaire sections and completion status"
)
def get_questionnaire(
    session: CustomerPortalSession = Depends(get_portal_session),
    db: Session = Depends(get_db),
):
    from app.models.customer_portal import CustomerPortalQuestionnaireResponse

    responses = (
        db.query(CustomerPortalQuestionnaireResponse)
        .filter_by(session_id=session.id)
        .all()
    )
    required = session.required_questionnaire_sections or []
    completed_keys = {r.section_key for r in responses if r.completed}
    return {
        "required_sections": required,
        "completed_sections": list(completed_keys),
        "all_complete": all(s in completed_keys for s in required),
        "sections": [
            {
                "section_key": r.section_key,
                "completed": r.completed,
                "submitted_at": r.submitted_at.isoformat() if r.submitted_at else None,
            }
            for r in responses
        ],
    }


@router.post("/{token}/submit", summary="Finalise and submit the portal session")
def submit_portal(
    token: str,
    request: Request = None,
    db: Session = Depends(get_db),
):
    client_ip = request.client.host if request and request.client else None
    session = customer_portal_service.validate_portal_token(db, token, client_ip)
    return customer_portal_service.submit_portal_session(db, session)
