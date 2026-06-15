"""
KYC Verification Records — individual verification steps per customer.

Each verification type is its own table with a full audit trail.
Results are never overwritten — new records are created on re-verification.
"""
import enum
from uuid import uuid4

from sqlalchemy import Boolean, Column, Date, DateTime, Enum, Float, ForeignKey, String, Text, func
from sqlalchemy.orm import relationship

from app.db.database import Base


# ── Shared enums ───────────────────────────────────────────────────────────────

class VerificationResult(str, enum.Enum):
    pass_     = "pass"
    fail      = "fail"
    refer     = "refer"     # manual review required
    not_performed = "not_performed"


class VerificationSource(str, enum.Enum):
    self_uploaded   = "self_uploaded"
    camera_capture  = "camera_capture"
    mobile_upload   = "mobile_upload"
    desktop_upload  = "desktop_upload"
    biometric       = "biometric"
    third_party     = "third_party"     # provider API (Sumsub, FrankieOne, etc.)
    manual          = "manual"          # staff manually verified


class VerificationProvider(str, enum.Enum):
    internal        = "internal"
    sumsub          = "sumsub"
    frankieone      = "frankieone"
    trulioo         = "trulioo"
    shufti_pro      = "shufti_pro"
    onfido          = "onfido"
    jumio           = "jumio"
    other           = "other"


# ── Identity Documents ─────────────────────────────────────────────────────────

class IdentityDocumentType(str, enum.Enum):
    passport        = "passport"
    drivers_licence = "drivers_licence"
    national_id     = "national_id"
    proof_of_age    = "proof_of_age"
    medicare        = "medicare"        # supplementary only; not primary ID
    other           = "other"


class CustomerIdentityDocument(Base):
    __tablename__ = "customer_identity_documents"

    id = Column(String, primary_key=True, default=lambda: f"doc_{uuid4().hex[:12]}")
    customer_id = Column(String, ForeignKey("customers.id", ondelete="CASCADE"), nullable=False, index=True)
    org_id = Column(String, nullable=False, index=True)

    document_type = Column(Enum(IdentityDocumentType), nullable=False)
    document_number = Column(String(100))
    issuing_country = Column(String(2))
    issuing_state = Column(String(50))      # for Australian driver licences
    issue_date = Column(Date)
    expiry_date = Column(Date)

    # Extracted / OCR data
    extracted_name = Column(String(255))
    extracted_dob = Column(Date)
    extracted_mrz = Column(String(500))     # machine-readable zone (passport)

    # File references (cloud storage keys, not raw paths)
    document_ref_front = Column(String(500))
    document_ref_back = Column(String(500))

    # Verification outcome
    verification_result = Column(Enum(VerificationResult))
    verification_source = Column(Enum(VerificationSource))
    verification_provider = Column(Enum(VerificationProvider), default=VerificationProvider.internal)
    confidence_score = Column(Float)
    is_primary = Column(Boolean, default=True)  # primary vs supplementary document
    is_current = Column(Boolean, default=True)  # most recent for this type

    # Verification detail
    verification_notes = Column(Text)
    provider_reference = Column(String(255))    # provider's own transaction ID
    provider_raw_response = Column(String)      # JSON stored as text (large)

    verified_by = Column(String)                # user_id or "provider"
    verified_at = Column(DateTime(timezone=True))
    uploaded_by = Column(String)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    customer = relationship("Customer", back_populates="identity_documents")

    from sqlalchemy.orm import relationship


# ── Selfie / Liveness Verification ────────────────────────────────────────────

class LivenessCheckType(str, enum.Enum):
    passive     = "passive"     # passive liveness (no movement required)
    active      = "active"      # active challenge (blink, turn head)
    video       = "video"       # video-based liveness


class CustomerSelfieVerification(Base):
    __tablename__ = "customer_selfie_verifications"

    id = Column(String, primary_key=True, default=lambda: f"selfie_{uuid4().hex[:10]}")
    customer_id = Column(String, ForeignKey("customers.id", ondelete="CASCADE"), nullable=False, index=True)
    org_id = Column(String, nullable=False, index=True)
    identity_document_id = Column(String, ForeignKey("customer_identity_documents.id"), nullable=True)

    selfie_ref = Column(String(500))            # cloud storage key
    liveness_check_type = Column(Enum(LivenessCheckType))
    liveness_result = Column(Enum(VerificationResult))
    liveness_score = Column(Float)              # 0.0–1.0

    face_match_result = Column(Enum(VerificationResult))
    face_match_score = Column(Float)            # 0.0–1.0
    face_match_document_id = Column(String)     # which identity doc was matched against

    provider = Column(Enum(VerificationProvider), default=VerificationProvider.internal)
    provider_reference = Column(String(255))
    provider_raw_response = Column(String)

    verification_result = Column(Enum(VerificationResult))
    verified_at = Column(DateTime(timezone=True))
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    customer = relationship("Customer", back_populates="selfie_verifications")

    from sqlalchemy.orm import relationship


# ── Address Verification ───────────────────────────────────────────────────────

class AddressDocumentType(str, enum.Enum):
    utility_bill        = "utility_bill"
    bank_statement      = "bank_statement"
    government_letter   = "government_letter"
    rental_agreement    = "rental_agreement"
    electoral_roll      = "electoral_roll"
    tax_assessment      = "tax_assessment"
    other               = "other"


class CustomerAddressVerification(Base):
    __tablename__ = "customer_address_verifications"

    id = Column(String, primary_key=True, default=lambda: f"adrv_{uuid4().hex[:10]}")
    customer_id = Column(String, ForeignKey("customers.id", ondelete="CASCADE"), nullable=False, index=True)
    org_id = Column(String, nullable=False, index=True)

    document_type = Column(Enum(AddressDocumentType), nullable=False)
    document_ref = Column(String(500))          # cloud storage key
    document_date = Column(Date)                # date on the document (must be < 3 months)
    issuer = Column(String(255))                # e.g. "AGL Energy", "Commonwealth Bank"

    # Address extracted from document
    extracted_address_line1 = Column(String(255))
    extracted_city = Column(String(100))
    extracted_state = Column(String(50))
    extracted_postcode = Column(String(10))
    extracted_country = Column(String(2))

    address_match_result = Column(Enum(VerificationResult))
    verification_result = Column(Enum(VerificationResult))
    verification_notes = Column(Text)

    provider = Column(Enum(VerificationProvider), default=VerificationProvider.internal)
    verified_by = Column(String)
    verified_at = Column(DateTime(timezone=True))
    uploaded_by = Column(String)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    customer = relationship("Customer", back_populates="address_verifications")

    from sqlalchemy.orm import relationship


# ── Phone Verification ─────────────────────────────────────────────────────────

class CustomerPhoneVerification(Base):
    __tablename__ = "customer_phone_verifications"

    id = Column(String, primary_key=True, default=lambda: f"phv_{uuid4().hex[:10]}")
    customer_id = Column(String, ForeignKey("customers.id", ondelete="CASCADE"), nullable=False, index=True)
    org_id = Column(String, nullable=False, index=True)

    phone_number = Column(String(50), nullable=False)
    country_code = Column(String(5))
    carrier_name = Column(String(100))
    carrier_type = Column(String(50))           # mobile | landline | voip
    line_type = Column(String(50))

    otp_sent = Column(Boolean, default=False)
    otp_verified = Column(Boolean, default=False)
    otp_sent_at = Column(DateTime(timezone=True))
    otp_verified_at = Column(DateTime(timezone=True))

    verification_result = Column(Enum(VerificationResult))
    provider = Column(Enum(VerificationProvider), default=VerificationProvider.internal)
    provider_reference = Column(String(255))

    verified_at = Column(DateTime(timezone=True))
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    customer = relationship("Customer", back_populates="phone_verifications")

    from sqlalchemy.orm import relationship


# ── Email Verification ─────────────────────────────────────────────────────────

class CustomerEmailVerification(Base):
    __tablename__ = "customer_email_verifications"

    id = Column(String, primary_key=True, default=lambda: f"emv_{uuid4().hex[:10]}")
    customer_id = Column(String, ForeignKey("customers.id", ondelete="CASCADE"), nullable=False, index=True)
    org_id = Column(String, nullable=False, index=True)

    email_address = Column(String(255), nullable=False)
    domain = Column(String(255))
    is_disposable = Column(Boolean, default=False)
    is_free_provider = Column(Boolean, default=False)   # gmail/hotmail risk flag
    mx_valid = Column(Boolean)

    token_sent = Column(Boolean, default=False)
    token_verified = Column(Boolean, default=False)
    token_sent_at = Column(DateTime(timezone=True))
    token_verified_at = Column(DateTime(timezone=True))

    verification_result = Column(Enum(VerificationResult))
    verified_at = Column(DateTime(timezone=True))
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    customer = relationship("Customer", back_populates="email_verifications")

    from sqlalchemy.orm import relationship
