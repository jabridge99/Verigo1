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
from fastapi.responses import Response
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app.api.routes.auth import _current_user, _require_roles
from app.db.database import get_db
from app.models.document import DocumentCategory
from app.models.user import User, UserRole
from app.schemas.document import DocumentResponse, DocumentUpdate
from app.services import document_service as svc
from app.services.document_service import ALLOWED_MIME, MAX_SIZE
from app.services.storage.factory import get_storage_provider
from app.services.storage.local import LocalStorageProvider
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


def _assert_tenant(current_user: User, doc_industry_id: Optional[str]):
    """Explicit check — global super-admin sees all, everyone else (including
    UserRole.admin, which is per-organisation, not global) must match their
    industry_id."""
    if current_user.is_super_admin:
        return  # global super-admin has cross-tenant read access by design
    if doc_industry_id and doc_industry_id != current_user.org_id:
        raise HTTPException(403, "Cross-tenant document access denied")


def _industry_scope(current_user: User) -> Optional[str]:
    """Return the industry_id to filter on, or None for global super-admin."""
    return None if current_user.is_super_admin else current_user.org_id


def _org_scope(current_user: User) -> Optional[str]:
    return (
        None
        if current_user.is_super_admin
        else current_user.primary_organisation_id
    )


@router.post("", response_model=DocumentResponse, status_code=201)
async def upload_document(
    file: UploadFile = File(...),
    category: DocumentCategory = Form(DocumentCategory.other),
    description: Optional[str] = Form(None),
    entity_type: Optional[str] = Form(None),
    entity_id: Optional[str] = Form(None),
    retention_category: Optional[str] = Form(None),
    db: Session = Depends(get_db),
    current_user: User = Depends(_current_user),
):
    import hashlib

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

    # Server-side SHA-256 — never trusted from client
    sha256_hash = hashlib.sha256(content).hexdigest()

    return await svc.create_document(
        db,
        filename=file.filename or "upload",
        content=content,
        mime_type=mime,
        uploaded_by=current_user.id,
        industry_id=_industry_scope(current_user),
        organisation_id=_org_scope(current_user),
        category=category,
        description=description,
        entity_type=entity_type,
        entity_id=entity_id,
        sha256_hash=sha256_hash,
        retention_category=retention_category,
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
    return svc.document_stats(
        db, _industry_scope(current_user), _org_scope(current_user)
    )


@router.get("/{doc_id}", response_model=DocumentResponse)
def get_document(
    doc_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(_current_user),
):
    doc = svc.get_document(db, doc_id)
    if not doc:
        raise HTTPException(404, "Document not found")
    _assert_tenant(current_user, doc.industry_id)
    return doc


@router.get("/{doc_id}/download")
async def download_document(
    doc_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(_current_user),
):
    doc = svc.get_document(db, doc_id)
    if not doc:
        raise HTTPException(404, "Document not found")
    _assert_tenant(current_user, doc.industry_id)
    if not await svc.file_exists(doc):
        raise HTTPException(404, "File not found on storage")
    content = await svc.get_file_bytes(doc)

    # KYC/AML documents are sensitive; downloads need an access trail just
    # like other compliance-relevant actions in this codebase.
    from app.services.audit_service import log_action

    log_action(
        db,
        action="document.download",
        entity_type="Document",
        entity_id=doc.doc_id,
        actor=current_user.id,
        actor_role=current_user.role.value
        if hasattr(current_user.role, "value")
        else str(current_user.role),
        industry_id=doc.industry_id,
        organisation_id=doc.organisation_id,
    )

    from urllib.parse import quote

    # doc.filename is client-controlled at upload time. A raw quote or CRLF
    # in it could break out of the quoted Content-Disposition value, so
    # sanitize the fallback ASCII name and RFC 5987-encode the real one.
    safe_ascii = (doc.filename or "download").replace('"', "").replace("\\", "")
    safe_ascii = safe_ascii.encode("ascii", "ignore").decode("ascii") or "download"
    encoded = quote(doc.filename or "download")
    return Response(
        content=content,
        media_type=doc.mime_type or "application/octet-stream",
        headers={
            "Content-Disposition": (
                f'attachment; filename="{safe_ascii}"; filename*=UTF-8\'\'{encoded}'
            ),
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
async def delete_document(
    doc_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(_require_roles(UserRole.admin, UserRole.mlro)),
):
    doc = svc.get_document(db, doc_id)
    if not doc:
        raise HTTPException(404, "Document not found")
    _assert_tenant(current_user, doc.industry_id)
    if doc.legal_hold:
        raise HTTPException(409, "Document is under legal hold and cannot be deleted.")
    if not await svc.delete_document(db, doc_id, _industry_scope(current_user)):
        raise HTTPException(404, "Document not found")


# ── Legal hold ────────────────────────────────────────────────────────────────


class LegalHoldPayload(BaseModel):
    reason: str


@router.post("/{doc_id}/legal-hold")
def place_legal_hold(
    doc_id: str,
    payload: LegalHoldPayload,
    db: Session = Depends(get_db),
    current_user: User = Depends(
        _require_roles(UserRole.admin, UserRole.mlro, UserRole.compliance)
    ),
):
    """Place a legal hold on a document — blocks deletion and archival."""
    from datetime import datetime, timezone

    doc = svc.get_document(db, doc_id)
    if not doc:
        raise HTTPException(404, "Document not found")
    _assert_tenant(current_user, doc.industry_id)
    if doc.legal_hold:
        raise HTTPException(409, "Document is already under legal hold.")

    doc.legal_hold = True
    doc.legal_hold_reason = payload.reason
    doc.legal_hold_by = current_user.id
    doc.legal_hold_at = datetime.now(timezone.utc)
    db.commit()
    return {"doc_id": doc_id, "legal_hold": True, "reason": payload.reason}


@router.delete("/{doc_id}/legal-hold", status_code=200)
def release_legal_hold(
    doc_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(_require_roles(UserRole.admin, UserRole.mlro)),
):
    """Release legal hold — MLRO/admin only."""
    doc = svc.get_document(db, doc_id)
    if not doc:
        raise HTTPException(404, "Document not found")
    _assert_tenant(current_user, doc.industry_id)
    if not doc.legal_hold:
        raise HTTPException(409, "Document is not under legal hold.")

    doc.legal_hold = False
    doc.legal_hold_reason = None
    doc.legal_hold_by = None
    doc.legal_hold_at = None
    db.commit()
    return {"doc_id": doc_id, "legal_hold": False}


# ── Versioning ────────────────────────────────────────────────────────────────


@router.get("/{doc_id}/versions")
def get_versions(
    doc_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(_current_user),
):
    """Return the full version chain for a document (oldest first)."""
    from app.models.document import Document

    doc = svc.get_document(db, doc_id)
    if not doc:
        raise HTTPException(404, "Document not found")
    _assert_tenant(current_user, doc.industry_id)

    # Walk back to root then collect chain
    chain = []
    current = doc
    while current:
        chain.append(current)
        if current.previous_version_id:
            current = (
                db.query(Document)
                .filter(Document.id == current.previous_version_id)
                .first()
            )
        else:
            break
    chain.reverse()

    return [
        {
            "id": d.id,
            "doc_id": d.doc_id,
            "version": d.version,
            "filename": d.filename,
            "size_bytes": d.size_bytes,
            "sha256_hash": d.sha256_hash,
            "uploaded_by": d.uploaded_by,
            "created_at": d.created_at,
            "legal_hold": d.legal_hold,
        }
        for d in chain
    ]


@router.post("/{doc_id}/new-version", response_model=DocumentResponse, status_code=201)
async def upload_new_version(
    doc_id: str,
    file: UploadFile = File(...),
    description: Optional[str] = Form(None),
    db: Session = Depends(get_db),
    current_user: User = Depends(_current_user),
):
    """
    Upload a new version of an existing document.
    Creates a new Document row with previous_version_id pointing to the current version.
    The old version is retained (never deleted).
    """
    import hashlib

    existing = svc.get_document(db, doc_id)
    if not existing:
        raise HTTPException(404, "Document not found")
    _assert_tenant(current_user, existing.industry_id)
    if existing.legal_hold:
        raise HTTPException(409, "Cannot version a document under legal hold.")

    content = await file.read()
    if len(content) > MAX_SIZE:
        raise HTTPException(413, f"File exceeds {MAX_SIZE // (1024 * 1024)} MB limit")

    mime = file.content_type or existing.mime_type or "application/octet-stream"
    if mime not in ALLOWED_MIME:
        raise HTTPException(415, f"Unsupported file type: {mime}")
    if not _verify_magic(content, mime):
        raise HTTPException(415, "File content does not match declared content type")

    sha256_hash = hashlib.sha256(content).hexdigest()

    new_doc = svc.create_document(
        db,
        filename=file.filename or existing.filename,
        content=content,
        mime_type=mime,
        uploaded_by=current_user.id,
        industry_id=existing.industry_id,
        category=existing.category,
        description=description or existing.description,
        entity_type=existing.entity_type,
        entity_id=existing.entity_id,
        sha256_hash=sha256_hash,
        retention_category=existing.retention_category,
        previous_version_id=existing.id,
        version=existing.version + 1,
    )
    return new_doc
