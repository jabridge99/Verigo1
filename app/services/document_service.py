"""
Document storage service — delegates byte storage to the per-tenant
StorageProvider (local/S3/Azure/GCS) resolved via app.services.storage.factory.
The Document row keeps a logical storage key (`stored_name`); only the
factory knows which physical backend that key lives in.
"""

import uuid
from typing import List, Optional

from sqlalchemy import desc, or_
from sqlalchemy.orm import Session, Query

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
    ext = original_name.rsplit(".", 1)[-1] if "." in original_name else ""
    name = f"{uuid.uuid4().hex}.{ext}" if ext else uuid.uuid4().hex
    prefix = industry_id or "shared"
    return f"{prefix}/{name}"


def _scope(q: Query, industry_id: Optional[str], organisation_id: Optional[int]) -> Query:
    if organisation_id:
        return q.filter(
            or_(
                Document.organisation_id == organisation_id,
                (Document.organisation_id.is_(None)) & (Document.industry_id == industry_id),
            )
        )
    if industry_id:
        return q.filter(Document.industry_id == industry_id)
    return q


async def create_document(
    db: Session,
    filename: str,
    content: bytes,
    mime_type: str,
    uploaded_by: str,
    industry_id: Optional[str],
    organisation_id: Optional[int] = None,
    category: DocumentCategory = DocumentCategory.other,
    description: Optional[str] = None,
    entity_type: Optional[str] = None,
    entity_id: Optional[str] = None,
) -> Document:
    key = _storage_key(industry_id, filename)
    provider = get_storage_provider(industry_id)
    await provider.upload(key, content, content_type=mime_type)
    doc = Document(
        doc_id=_doc_id(),
        filename=filename,
        stored_name=key,
        mime_type=mime_type,
        size_bytes=len(content),
        category=category,
        description=description,
        entity_type=entity_type,
        entity_id=entity_id,
        uploaded_by=uploaded_by,
        industry_id=industry_id,
        organisation_id=organisation_id,
    )
    db.add(doc)
    db.commit()
    db.refresh(doc)
    return doc


def list_documents(
    db: Session,
    industry_id: Optional[str] = None,
    organisation_id: Optional[int] = None,
    category: Optional[DocumentCategory] = None,
    entity_type: Optional[str] = None,
    entity_id: Optional[str] = None,
    uploaded_by: Optional[str] = None,
    limit: int = 50,
    offset: int = 0,
) -> List[Document]:
    q = db.query(Document).filter(Document.status == DocumentStatus.active)
    q = _scope(q, industry_id, organisation_id)
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


async def download_bytes(doc: Document) -> bytes:
    provider = get_storage_provider(doc.industry_id)
    return await provider.download(doc.stored_name)


async def get_access_url(doc: Document, expires_in: int = 300) -> str:
    provider = get_storage_provider(doc.industry_id)
    return await provider.get_url(doc.stored_name, expires_in=expires_in)


def update_document(
    db: Session,
    doc_id: str,
    data: DocumentUpdate,
    industry_id: Optional[str],
    organisation_id: Optional[int] = None,
) -> Optional[Document]:
    q = db.query(Document).filter(
        Document.doc_id == doc_id, Document.status == DocumentStatus.active
    )
    q = _scope(q, industry_id, organisation_id)
    doc = q.first()
    if not doc:
        return None
    for field, val in data.model_dump(exclude_unset=True).items():
        setattr(doc, field, val)
    db.commit()
    db.refresh(doc)
    return doc


def archive_document(
    db: Session, doc_id: str, industry_id: Optional[str], organisation_id: Optional[int] = None
) -> Optional[Document]:
    q = db.query(Document).filter(
        Document.doc_id == doc_id, Document.status == DocumentStatus.active
    )
    q = _scope(q, industry_id, organisation_id)
    doc = q.first()
    if not doc:
        return None
    doc.status = DocumentStatus.archived
    db.commit()
    db.refresh(doc)
    return doc


async def delete_document(
    db: Session, doc_id: str, industry_id: Optional[str], organisation_id: Optional[int] = None
) -> bool:
    q = db.query(Document).filter(Document.doc_id == doc_id)
    q = _scope(q, industry_id, organisation_id)
    doc = q.first()
    if not doc:
        return False
    # Soft delete — remove the underlying object, mark the row deleted
    provider = get_storage_provider(doc.industry_id)
    await provider.delete(doc.stored_name)
    doc.status = DocumentStatus.deleted
    db.commit()
    return True


def document_stats(
    db: Session, industry_id: Optional[str] = None, organisation_id: Optional[int] = None
) -> dict:
    q = db.query(Document).filter(Document.status == DocumentStatus.active)
    q = _scope(q, industry_id, organisation_id)
    total = q.count()
    total_bytes = sum(d.size_bytes or 0 for d in q.all())
    by_category: dict = {}
    for cat in DocumentCategory:
        by_category[cat.value] = q.filter(Document.category == cat).count()
    return {"total": total, "total_bytes": total_bytes, "by_category": by_category}
