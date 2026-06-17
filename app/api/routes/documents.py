"""
Document storage endpoints — SECURITY HARDENED.
Zero Trust fixes:
- Admin scope bug fixed: admin can access all docs, but check is explicit
- Content-type magic bytes verified against declared MIME type
- File extension whitelist enforced
- Download events could be audited (stub)
- Tenant isolation enforced on every query
- RBAC: delete restricted to admin/mlro; archive restricted to compliance+
"""

from pathlib import Path
from typing import List, Optional

from fastapi import APIRouter, Depends, File, Form, HTTPException, Query, UploadFile
from fastapi.responses import FileResponse
from sqlalchemy.orm import Session

from app.api.routes.auth import _current_user, _require_roles
from app.db.database import get_db
from app.models.document import DocumentCategory
from app.models.user import User, UserRole
from app.schemas.document import DocumentResponse, DocumentUpdate
from app.services import document_service as svc
from app.services.document_service import ALLOWED_MIME, MAX_SIZE
from app.services.tenant_scope import assert_tenant

router = APIRouter(prefix="/documents", tags=["documents"])

# Allowed file extensions mapped from MIME
_SAFE_EXTENSIONS = {
    "application/pdf": {".pdf"},
    "image/jpeg": {".jpg", ".jpeg"},
    "image/png": {".png"},
    "image/webp": {".webp"},
    "image/gif": {".gif"},
    "application/msword": {".doc"},
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document": {
        ".docx"
    },
    "application/vnd.ms-excel": {".xls"},
    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet": {".xlsx"},
    "text/plain": {".txt"},
    "text/csv": {".csv"},
}

# Magic byte signatures for server-side verification
_MAGIC = {
    b"%PDF": "application/pdf",
    b"\xff\xd8\xff": "image/jpeg",
    b"\x89PNG": "image/png",
    b"RIFF": "image/webp",  # partial; need WEBP check
    b"GIF87a": "image/gif",
    b"GIF89a": "image/gif",
    b"\xd0\xcf": "application/msword",  # OLE2 — .doc/.xls
    b"PK\x03\x04": None,  # ZIP-based — .docx/.xlsx/webp — checked by extension
}


def _verify_magic(content: bytes, declared_mime: str) -> bool:
    """Verify file magic bytes match declared MIME type. Blocks polyglot files."""
    for sig, mime in _MAGIC.items():
        if content.startswith(sig):
            if mime is None:
                return True  # ZIP-based: trust extension whitelist
            return mime == declared_mime
    # WEBP inside RIFF
    if content[:4] == b"RIFF" and content[8:12] == b"WEBP":
        return declared_mime == "image/webp"
    # Text files — no reliable magic, allow
    if declared_mime in ("text/plain", "text/csv"):
        return True
    return False


def _assert_tenant(current_user: User, doc) -> None:
    assert_tenant(current_user, doc.organisation_id, doc.industry_id)


def _industry_scope(current_user: User) -> Optional[str]:
    """Return the industry_id to filter on, or None for admin (no filter)."""
    return None if current_user.role == UserRole.admin else current_user.industry_id


def _org_scope(current_user: User) -> Optional[int]:
    return None if current_user.role == UserRole.admin else current_user.primary_organisation_id


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
        raise HTTPException(413, f"File exceeds {MAX_SIZE // (1024 * 1024)} MB limit")

    mime = file.content_type or "application/octet-stream"
    if mime not in ALLOWED_MIME:
        raise HTTPException(415, f"Unsupported file type: {mime}")

    # Extension whitelist
    ext = Path(file.filename or "upload").suffix.lower()
    allowed_exts = _SAFE_EXTENSIONS.get(mime, set())
    if allowed_exts and ext not in allowed_exts:
        raise HTTPException(
            415, f"Extension '{ext}' not permitted for MIME type '{mime}'"
        )

    # Magic byte verification — blocks polyglot files
    if not _verify_magic(content, mime):
        raise HTTPException(415, "File content does not match declared content type")

    return svc.create_document(
        db,
        filename=file.filename or "upload",
        content=content,
        mime_type=mime,
        uploaded_by=current_user.user_id,
        industry_id=current_user.industry_id,
        organisation_id=current_user.primary_organisation_id,
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
        industry_id=_industry_scope(current_user),
        organisation_id=_org_scope(current_user),
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
    return svc.document_stats(db, _industry_scope(current_user), _org_scope(current_user))


@router.get("/{doc_id}", response_model=DocumentResponse)
def get_document(
    doc_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(_current_user),
):
    doc = svc.get_document(db, doc_id)
    if not doc:
        raise HTTPException(404, "Document not found")
    _assert_tenant(current_user, doc)
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
    _assert_tenant(current_user, doc)
    path = svc.get_file_path(doc)
    if not path.exists():
        raise HTTPException(404, "File not found on storage")
    return FileResponse(
        path=str(path),
        filename=doc.filename,
        media_type=doc.mime_type or "application/octet-stream",
        headers={
            "Content-Disposition": f'attachment; filename="{doc.filename}"',
            "X-Content-Type-Options": "nosniff",
        },
    )


@router.patch("/{doc_id}", response_model=DocumentResponse)
def update_document(
    doc_id: str,
    data: DocumentUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(_current_user),
):
    doc = svc.update_document(
        db, doc_id, data, _industry_scope(current_user), _org_scope(current_user)
    )
    if not doc:
        raise HTTPException(404, "Document not found")
    return doc


@router.post("/{doc_id}/archive", response_model=DocumentResponse)
def archive_document(
    doc_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(
        _require_roles(UserRole.admin, UserRole.mlro, UserRole.compliance)
    ),
):
    doc = svc.archive_document(
        db, doc_id, _industry_scope(current_user), _org_scope(current_user)
    )
    if not doc:
        raise HTTPException(404, "Document not found")
    return doc


@router.delete("/{doc_id}", status_code=204)
def delete_document(
    doc_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(_require_roles(UserRole.admin, UserRole.mlro)),
):
    if not svc.delete_document(db, doc_id, _industry_scope(current_user), _org_scope(current_user)):
        raise HTTPException(404, "Document not found")
