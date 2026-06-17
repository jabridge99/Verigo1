"""
Document storage service — local filesystem with configurable base directory.
Files are stored under DOCUMENT_STORE_PATH (default: ./uploads).
"""

import os
import uuid
from pathlib import Path
from typing import List, Optional

from sqlalchemy import desc, or_
from sqlalchemy.orm import Session, Query

from app.models.document import Document, DocumentCategory, DocumentStatus
from app.schemas.document import DocumentUpdate

STORE_PATH = Path(os.getenv("DOCUMENT_STORE_PATH", "./uploads"))
STORE_PATH.mkdir(parents=True, exist_ok=True)

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


def save_file(content: bytes, original_name: str) -> tuple[str, int]:
    ext = Path(original_name).suffix.lower()
    stored = f"{uuid.uuid4().hex}{ext}"
    dest = STORE_PATH / stored
    dest.write_bytes(content)
    return stored, len(content)


def create_document(
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
    stored_name, size = save_file(content, filename)
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


def get_file_path(doc: Document) -> Path:
    return STORE_PATH / doc.stored_name


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


def delete_document(
    db: Session, doc_id: str, industry_id: Optional[str], organisation_id: Optional[int] = None
) -> bool:
    q = db.query(Document).filter(Document.doc_id == doc_id)
    q = _scope(q, industry_id, organisation_id)
    doc = q.first()
    if not doc:
        return False
    # Soft delete — remove file from disk, mark deleted
    fp = get_file_path(doc)
    if fp.exists():
        fp.unlink(missing_ok=True)
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
