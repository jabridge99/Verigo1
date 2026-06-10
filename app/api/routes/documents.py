"""
Document storage endpoints — upload, list, download, update, archive, delete.
"""

from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Query, Form
from fastapi.responses import FileResponse
from sqlalchemy.orm import Session
from typing import List, Optional

from app.db.database import get_db
from app.schemas.document import DocumentResponse, DocumentUpdate
from app.services import document_service as svc
from app.services.document_service import ALLOWED_MIME, MAX_SIZE
from app.api.routes.auth import _current_user
from app.models.user import User
from app.models.document import DocumentCategory

router = APIRouter(prefix="/documents", tags=["documents"])


def _scope(current_user: User) -> Optional[str]:
    return None if current_user.role == "admin" else current_user.industry_id


@router.post("", response_model=DocumentResponse, status_code=201)
async def upload_document(
    file: UploadFile = File(...),
    category: DocumentCategory = Form(DocumentCategory.other),
    description: Optional[str] = Form(None),
    entity_type: Optional[str] = Form(None),
    entity_id: Optional[str] = Form(None),
    db: Session = Depends(get_db),
    current_user: User = Depends(_current_user),
):
    content = await file.read()
    if len(content) > MAX_SIZE:
        raise HTTPException(413, f"File exceeds {MAX_SIZE // (1024*1024)} MB limit")
    mime = file.content_type or "application/octet-stream"
    if mime not in ALLOWED_MIME:
        raise HTTPException(415, f"Unsupported file type: {mime}")

    return svc.create_document(
        db,
        filename=file.filename or "upload",
        content=content,
        mime_type=mime,
        uploaded_by=current_user.user_id,
        industry_id=current_user.industry_id,
        category=category,
        description=description,
        entity_type=entity_type,
        entity_id=entity_id,
    )


@router.get("", response_model=List[DocumentResponse])
def list_documents(
    category: Optional[DocumentCategory] = Query(None),
    entity_type: Optional[str] = Query(None),
    entity_id: Optional[str] = Query(None),
    limit: int = Query(50, ge=1, le=200),
    offset: int = Query(0, ge=0),
    db: Session = Depends(get_db),
    current_user: User = Depends(_current_user),
):
    return svc.list_documents(
        db,
        industry_id=_scope(current_user),
        category=category,
        entity_type=entity_type,
        entity_id=entity_id,
        limit=limit,
        offset=offset,
    )


@router.get("/stats")
def document_stats(
    db: Session = Depends(get_db),
    current_user: User = Depends(_current_user),
):
    return svc.document_stats(db, _scope(current_user))


@router.get("/{doc_id}", response_model=DocumentResponse)
def get_document(
    doc_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(_current_user),
):
    doc = svc.get_document(db, doc_id)
    if not doc:
        raise HTTPException(404, "Document not found")
    if _scope(current_user) and doc.industry_id != current_user.industry_id:
        raise HTTPException(403, "Access denied")
    return doc


@router.get("/{doc_id}/download")
def download_document(
    doc_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(_current_user),
):
    doc = svc.get_document(db, doc_id)
    if not doc:
        raise HTTPException(404, "Document not found")
    if _scope(current_user) and doc.industry_id != current_user.industry_id:
        raise HTTPException(403, "Access denied")
    path = svc.get_file_path(doc)
    if not path.exists():
        raise HTTPException(404, "File not found on storage")
    return FileResponse(
        path=str(path),
        filename=doc.filename,
        media_type=doc.mime_type or "application/octet-stream",
    )


@router.patch("/{doc_id}", response_model=DocumentResponse)
def update_document(
    doc_id: str,
    data: DocumentUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(_current_user),
):
    doc = svc.update_document(db, doc_id, data, _scope(current_user))
    if not doc:
        raise HTTPException(404, "Document not found")
    return doc


@router.post("/{doc_id}/archive", response_model=DocumentResponse)
def archive_document(
    doc_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(_current_user),
):
    doc = svc.archive_document(db, doc_id, _scope(current_user))
    if not doc:
        raise HTTPException(404, "Document not found")
    return doc


@router.delete("/{doc_id}", status_code=204)
def delete_document(
    doc_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(_current_user),
):
    if current_user.role not in ("admin", "mlro"):
        raise HTTPException(403, "Insufficient permissions")
    if not svc.delete_document(db, doc_id, _scope(current_user)):
        raise HTTPException(404, "Document not found")
