import enum

from sqlalchemy import Column, DateTime, Enum, Float, ForeignKey, Integer, String, Text
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func

from app.db.database import Base


class KYCStatus(str, enum.Enum):
    pending = "pending"
    document_submitted = "document_submitted"
    under_review = "under_review"
    identity_verified = "identity_verified"
    approved = "approved"
    rejected = "rejected"
    requires_ecdd = "requires_ecdd"


class DocumentType(str, enum.Enum):
    passport = "passport"
    national_id = "national_id"
    driving_license = "driving_license"
    utility_bill = "utility_bill"
    bank_statement = "bank_statement"
    tax_return = "tax_return"
    selfie = "selfie"


class KYCRecord(Base):
    __tablename__ = "kyc_records"

    id = Column(Integer, primary_key=True, index=True)
    kyc_id = Column(String(50), unique=True, index=True, nullable=False)
    customer_id = Column(Integer, ForeignKey("customers.id"), nullable=False)
    status = Column(Enum(KYCStatus), default=KYCStatus.pending)
    identity_score = Column(Float, default=0.0)
    document_score = Column(Float, default=0.0)
    sanctions_checked = Column(Integer, default=0)
    sanctions_match = Column(Integer, default=0)
    reviewer_id = Column(String(100))
    reviewer_notes = Column(Text)
    rejection_reason = Column(Text)
    submitted_at = Column(DateTime(timezone=True))
    reviewed_at = Column(DateTime(timezone=True))
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())

    customer = relationship("Customer", back_populates="kyc_records")
    documents = relationship("KYCDocument", back_populates="kyc_record")


class KYCDocument(Base):
    __tablename__ = "kyc_documents"

    id = Column(Integer, primary_key=True, index=True)
    kyc_record_id = Column(Integer, ForeignKey("kyc_records.id"), nullable=False)
    document_type = Column(Enum(DocumentType), nullable=False)
    file_name = Column(String(500), nullable=False)
    file_path = Column(String(1000))
    extracted_name = Column(String(200))
    extracted_dob = Column(String(20))
    extracted_id_number = Column(String(100))
    extracted_expiry = Column(String(20))
    verification_result = Column(String(50))
    confidence_score = Column(Float, default=0.0)
    uploaded_at = Column(DateTime(timezone=True), server_default=func.now())

    kyc_record = relationship("KYCRecord", back_populates="documents")
