"""
Document storage service — delegates actual file I/O to the pluggable
StorageProvider (local disk in dev, Supabase/S3/Azure/GCS in production —
see app.services.storage.factory). Document.stored_name holds the
storage-backend key, not a filesystem path.
"""

import uuid
from typing import List, Optional

from sqlalchemy import desc
from sqlalchemy.orm import Session

from app.models.document import Document, DocumentCategory, DocumentStatus
from app.schemas.document import DocumentUpdate
from app.services.storage.factory import get_storage_provider

# 50 MB upload limit
MAX_SIZE = 50 * 1024 * 1024

ALLOWED_MIME = {
    "application/pdf",
    "image/jpeg",
    "image/png",
    "image/webp",
    "image/gif",
    "application/msword",
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    "application/vnd.ms-excel",
    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    "text/plain",
    "text/csv",
}


def _doc_id() -> str:
    return f"DOC-{uuid.uuid4().hex[:12].upper()}"


def _storage_key(industry_id: Optional[str], original_name: str) -> str:
    from pathlib import PurePosixPath

    ext = PurePosixPath(original_name).suffix.lower()
    prefix = industry_id or "unscoped"
    return f"{prefix}/{uuid.uuid4().hex}{ext}"


async def save_file(content: bytes, original_name: str, mime_type: str, industry_id: Optional[str] = None) -> tuple[str, int]:
    key = _storage_key(industry_id, original_name)
    provider = get_storage_provider()
    obj = await provider.upload(key, content, content_type=mime_type)
    return key, obj.size


async def create_document(
    db: Session,
    filename: str,
    content: bytes,
    mime_type: str,
    uploaded_by: str,
    industry_id: Optional[str],
    category: DocumentCategory = DocumentCategory.other,
    description: Optional[str] = None,
    entity_type: Optional[str] = None,
    entity_id: Optional[str] = None,
    sha256_hash: Optional[str] = None,
    retention_category: Optional[str] = None,
) -> Document:
    stored_name, size = await save_file(content, filename, mime_type, industry_id)
    doc = Document(
        doc_id=_doc_id(),
        filename=filename,
        stored_name=stored_name,
        mime_type=mime_type,
        size_bytes=size,
        category=category,
        description=description,
        entity_type=entity_type,
        entity_id=entity_id,
        uploaded_by=uploaded_by,
        industry_id=industry_id,
        sha256_hash=sha256_hash,
        retention_category=retention_category,
    )
    db.add(doc)
    db.commit()
    db.refresh(doc)
    return doc


def list_documents(
    db: Session,
    industry_id: Optional[str] = None,
    category: Optional[DocumentCategory] = None,
    entity_type: Optional[str] = None,
    entity_id: Optional[str] = None,
    uploaded_by: Optional[str] = None,
    limit: int = 50,
    offset: int = 0,
) -> List[Document]:
    q = db.query(Document).filter(Document.status == DocumentStatus.active)
    if industry_id:
        q = q.filter(Document.industry_id == industry_id)
    if category:
        q = q.filter(Document.category == category)
    if entity_type:
        q = q.filter(Document.entity_type == entity_type)
    if entity_id:
        q = q.filter(Document.entity_id == entity_id)
    if uploaded_by:
        q = q.filter(Document.uploaded_by == uploaded_by)
    return q.order_by(desc(Document.created_at)).offset(offset).limit(limit).all()


def get_document(db: Session, doc_id: str) -> Optional[Document]:
    return (
        db.query(Document)
        .filter(
            Document.doc_id == doc_id,
            Document.status != DocumentStatus.deleted,
        )
        .first()
    )


async def get_file_bytes(doc: Document) -> bytes:
    provider = get_storage_provider()
    return await provider.download(doc.stored_name)


async def file_exists(doc: Document) -> bool:
    provider = get_storage_provider()
    return await provider.exists(doc.stored_name)


def update_document(
    db: Session, doc_id: str, data: DocumentUpdate, industry_id: Optional[str]
) -> Optional[Document]:
    q = db.query(Document).filter(
        Document.doc_id == doc_id, Document.status == DocumentStatus.active
    )
    if industry_id:
        q = q.filter(Document.industry_id == industry_id)
    doc = q.first()
    if not doc:
        return None
    for field, val in data.model_dump(exclude_unset=True).items():
        setattr(doc, field, val)
    db.commit()
    db.refresh(doc)
    return doc


def archive_document(
    db: Session, doc_id: str, industry_id: Optional[str]
) -> Optional[Document]:
    q = db.query(Document).filter(
        Document.doc_id == doc_id, Document.status == DocumentStatus.active
    )
    if industry_id:
        q = q.filter(Document.industry_id == industry_id)
    doc = q.first()
    if not doc:
        return None
    doc.status = DocumentStatus.archived
    db.commit()
    db.refresh(doc)
    return doc


async def delete_document(db: Session, doc_id: str, industry_id: Optional[str]) -> bool:
    q = db.query(Document).filter(Document.doc_id == doc_id)
    if industry_id:
        q = q.filter(Document.industry_id == industry_id)
    doc = q.first()
    if not doc:
        return False
    # Soft delete — remove object from storage backend, mark deleted
    provider = get_storage_provider()
    try:
        await provider.delete(doc.stored_name)
    except Exception:
        pass  # object may already be gone — don't block the soft-delete
    doc.status = DocumentStatus.deleted
    db.commit()
    return True


def document_stats(db: Session, industry_id: Optional[str] = None) -> dict:
    q = db.query(Document).filter(Document.status == DocumentStatus.active)
    if industry_id:
        q = q.filter(Document.industry_id == industry_id)
    total = q.count()
    total_bytes = sum(d.size_bytes or 0 for d in q.all())
    by_category: dict = {}
    for cat in DocumentCategory:
        by_category[cat.value] = q.filter(Document.category == cat).count()
    return {"total": total, "total_bytes": total_bytes, "by_category": by_category}
