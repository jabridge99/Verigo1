import enum
from uuid import uuid4
from sqlalchemy import Column, String, Enum, DateTime, Text, ForeignKey, func, Float
from sqlalchemy.orm import relationship
from app.db.database import Base


class ProgramStatus(str, enum.Enum):
    draft = "draft"
    active = "active"
    under_review = "under_review"
    superseded = "superseded"


class RiskAppetite(str, enum.Enum):
    low = "low"
    medium = "medium"
    high = "high"


class AssessmentStatus(str, enum.Enum):
    draft = "draft"
    in_progress = "in_progress"
    completed = "completed"
    approved = "approved"


class AMLProgram(Base):
    __tablename__ = "aml_programs"

    id = Column(String, primary_key=True, default=lambda: f"aml_{uuid4().hex[:12]}")
    org_id = Column(String, ForeignKey("organisations.id", ondelete="CASCADE"), nullable=False, index=True)
    version = Column(String(20), nullable=False, default="1.0")
    status = Column(Enum(ProgramStatus), default=ProgramStatus.draft, nullable=False)
    risk_appetite = Column(Enum(RiskAppetite), default=RiskAppetite.medium)
    effective_date = Column(DateTime(timezone=True))
    review_due_date = Column(DateTime(timezone=True))
    last_reviewed_at = Column(DateTime(timezone=True))
    reviewed_by = Column(String)
    approved_by = Column(String)
    approved_at = Column(DateTime(timezone=True))
    objectives = Column(Text)
    scope = Column(Text)
    policies_summary = Column(Text)
    created_by = Column(String, nullable=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())

    organisation = relationship("Organisation", back_populates="aml_programs")
    risk_assessments = relationship("RiskAssessment", back_populates="aml_program")


class RiskAssessment(Base):
    __tablename__ = "risk_assessments"

    id = Column(String, primary_key=True, default=lambda: f"ra_{uuid4().hex[:12]}")
    org_id = Column(String, ForeignKey("organisations.id", ondelete="CASCADE"), nullable=False, index=True)
    aml_program_id = Column(String, ForeignKey("aml_programs.id"), nullable=True, index=True)
    title = Column(String(255), nullable=False)
    assessment_date = Column(DateTime(timezone=True), nullable=False)
    status = Column(Enum(AssessmentStatus), default=AssessmentStatus.draft, nullable=False)
    inherent_risk_score = Column(Float)
    control_effectiveness_score = Column(Float)
    residual_risk_score = Column(Float)
    customer_risk_rating = Column(String(20))
    product_risk_rating = Column(String(20))
    channel_risk_rating = Column(String(20))
    geography_risk_rating = Column(String(20))
    findings = Column(Text)
    recommendations = Column(Text)
    action_items = Column(Text)
    next_review_date = Column(DateTime(timezone=True))
    conducted_by = Column(String)
    approved_by = Column(String)
    approved_at = Column(DateTime(timezone=True))
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())

    aml_program = relationship("AMLProgram", back_populates="risk_assessments")
