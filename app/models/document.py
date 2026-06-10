from sqlalchemy import Column, String, Integer, BigInteger, Boolean, DateTime, Enum, Text
from sqlalchemy.sql import func
import enum
from app.db.database import Base


class DocumentCategory(str, enum.Enum):
    kyc            = "kyc"            # ID documents, proof of address
    aml            = "aml"            # AML assessment records
    report         = "report"         # AUSTRAC report attachments
    case           = "case"           # MLRO case evidence
    ecdd           = "ecdd"           # Enhanced due diligence
    contract       = "contract"       # Customer agreements
    policy         = "policy"         # Internal compliance policies
    correspondence = "correspondence" # Regulator correspondence
    other          = "other"


class DocumentStatus(str, enum.Enum):
    active   = "active"
    archived = "archived"
    deleted  = "deleted"


class Document(Base):
    __tablename__ = "documents"

    id            = Column(Integer, primary_key=True, index=True)
    doc_id        = Column(String(60), unique=True, index=True, nullable=False)
    filename      = Column(String(500), nullable=False)       # original filename
    stored_name   = Column(String(500), nullable=False)       # UUID-based stored path
    mime_type     = Column(String(200))
    size_bytes    = Column(BigInteger, default=0)
    category      = Column(Enum(DocumentCategory), default=DocumentCategory.other)
    description   = Column(Text)

    # Entity association (polymorphic)
    entity_type   = Column(String(50))   # customer | kyc | report | case
    entity_id     = Column(String(100))

    # Ownership
    uploaded_by   = Column(String(60), nullable=False)   # user_id
    industry_id   = Column(String(100))

    status        = Column(Enum(DocumentStatus), default=DocumentStatus.active)
    created_at    = Column(DateTime(timezone=True), server_default=func.now())
    updated_at    = Column(DateTime(timezone=True), onupdate=func.now())
