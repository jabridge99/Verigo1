import enum
from uuid import uuid4
from sqlalchemy import Column, String, Enum, DateTime, Float, Text, JSON, Date, ForeignKey, func
from sqlalchemy.orm import relationship
from app.db.database import Base


class ReportStatus(str, enum.Enum):
    draft = "draft"
    under_review = "under_review"
    approved = "approved"
    submitted = "submitted"
    acknowledged = "acknowledged"
    rejected = "rejected"


class IFTIDirection(str, enum.Enum):
    incoming = "incoming"
    outgoing = "outgoing"


class IFTIReport(Base):
    """AUSTRAC International Funds Transfer Instruction report."""
    __tablename__ = "ifti_reports"

    id = Column(String, primary_key=True, default=lambda: f"ifti_{uuid4().hex[:12]}")
    org_id = Column(String, ForeignKey("organisations.id"), nullable=False, index=True)
    customer_id = Column(String, ForeignKey("customers.id"), nullable=True, index=True)
    transaction_id = Column(String, ForeignKey("transactions.id"), nullable=True)

    direction = Column(Enum(IFTIDirection), nullable=False)
    status = Column(Enum(ReportStatus), default=ReportStatus.draft, nullable=False)

    # Core transfer details
    date_received = Column(Date, nullable=False)
    date_available = Column(Date)
    total_amount = Column(Float, nullable=False)
    currency = Column(String(3), nullable=False, default="AUD")
    transfer_type = Column(String(50))
    transfer_reference = Column(String(100))

    # Ordering Customer (OC)
    oc_name = Column(String(255))
    oc_dob = Column(Date)
    oc_address = Column(String(500))
    oc_postal_address = Column(String(500))
    oc_contact = Column(String(255))
    oc_occupation = Column(String(255))
    oc_abn = Column(String(11))
    oc_account_number = Column(String(50))
    oc_business_structure = Column(String(50))
    oc_id1_type = Column(String(50))
    oc_id1_number = Column(String(50))
    oc_id1_country = Column(String(2))
    oc_id2_type = Column(String(50))
    oc_id2_number = Column(String(50))
    oc_id2_country = Column(String(2))
    oc_electronic_source = Column(String(255))

    # Beneficiary Customer (BC)
    bc_name = Column(String(255))
    bc_dob = Column(Date)
    bc_business_name = Column(String(255))
    bc_address = Column(String(500))
    bc_postal_address = Column(String(500))
    bc_account_number = Column(String(50))
    bc_institution_name = Column(String(255))
    bc_institution_country = Column(String(2))
    bc_swift_bic = Column(String(11))

    reason_for_transfer = Column(String(500))

    # Reporter (the regulated entity submitting)
    reporter_name = Column(String(255))
    reporter_abn = Column(String(11))
    reporter_austrac_id = Column(String(50))
    reporter_contact = Column(String(255))

    # Workflow
    prepared_by = Column(String)
    reviewed_by = Column(String)
    approved_by = Column(String)
    approved_at = Column(DateTime(timezone=True))
    submitted_at = Column(DateTime(timezone=True))
    submission_reference = Column(String(100))

    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())

    customer = relationship("Customer")


class TTRReport(Base):
    """Threshold Transaction Report — cash transactions >= $10,000 AUD."""
    __tablename__ = "ttr_reports"

    id = Column(String, primary_key=True, default=lambda: f"ttr_{uuid4().hex[:12]}")
    org_id = Column(String, ForeignKey("organisations.id"), nullable=False, index=True)
    customer_id = Column(String, ForeignKey("customers.id"), nullable=True, index=True)
    transaction_id = Column(String, ForeignKey("transactions.id"), nullable=True)

    status = Column(Enum(ReportStatus), default=ReportStatus.draft, nullable=False)

    transaction_date = Column(Date, nullable=False)
    total_amount = Column(Float, nullable=False)
    currency = Column(String(3), default="AUD")
    transaction_type = Column(String(50))

    customer_name = Column(String(255))
    customer_dob = Column(Date)
    customer_address = Column(String(500))
    customer_occupation = Column(String(255))
    customer_id_type = Column(String(50))
    customer_id_number = Column(String(50))

    branch_name = Column(String(255))
    branch_address = Column(String(500))

    summary = Column(Text)
    due_date = Column(Date)  # 15 business days from transaction date

    prepared_by = Column(String)
    reviewed_by = Column(String)
    approved_by = Column(String)
    approved_at = Column(DateTime(timezone=True))
    submitted_at = Column(DateTime(timezone=True))
    submission_reference = Column(String(100))

    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())

    customer = relationship("Customer")


class SMRReport(Base):
    """Suspicious Matter Report."""
    __tablename__ = "smr_reports"

    id = Column(String, primary_key=True, default=lambda: f"smr_{uuid4().hex[:12]}")
    org_id = Column(String, ForeignKey("organisations.id"), nullable=False, index=True)
    customer_id = Column(String, ForeignKey("customers.id"), nullable=True, index=True)
    case_id = Column(String, ForeignKey("cases.id"), nullable=True, index=True)

    status = Column(Enum(ReportStatus), default=ReportStatus.draft, nullable=False)

    matter_date = Column(Date, nullable=False)
    suspicion_grounds = Column(Text, nullable=False)
    transaction_ids = Column(JSON, default=list)
    total_amount = Column(Float)
    currency = Column(String(3), default="AUD")

    subject_name = Column(String(255))
    subject_dob = Column(Date)
    subject_address = Column(String(500))
    subject_occupation = Column(String(255))

    narrative = Column(Text)  # MLRO sign-off narrative
    due_date = Column(Date)   # typically 3 business days for proceeds of crime

    prepared_by = Column(String)
    reviewed_by = Column(String)
    mlro_sign_off = Column(String)   # MLRO user id
    mlro_signed_at = Column(DateTime(timezone=True))
    submitted_at = Column(DateTime(timezone=True))
    submission_reference = Column(String(100))

    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())

    customer = relationship("Customer")
    case = relationship("Case")
