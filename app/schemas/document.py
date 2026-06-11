from pydantic import BaseModel
from typing import Optional
from datetime import datetime
from app.models.document import DocumentCategory, DocumentStatus


class DocumentResponse(BaseModel):
    id: int
    doc_id: str
    filename: str
    mime_type: Optional[str] = None
    size_bytes: int
    category: DocumentCategory
    description: Optional[str] = None
    entity_type: Optional[str] = None
    entity_id: Optional[str] = None
    uploaded_by: str
    industry_id: Optional[str] = None
    status: DocumentStatus
    created_at: Optional[datetime] = None

    model_config = {"from_attributes": True}


class DocumentUpdate(BaseModel):
    description: Optional[str] = None
    category: Optional[DocumentCategory] = None
    entity_type: Optional[str] = None
    entity_id: Optional[str] = None
