import enum
from uuid import uuid4
from sqlalchemy import Column, String, Enum, Boolean, DateTime, ForeignKey, func
from sqlalchemy.orm import relationship
from app.db.database import Base


class ReportingGroupStatus(str, enum.Enum):
    active = "active"
    suspended = "suspended"
    dissolved = "dissolved"


class GroupType(str, enum.Enum):
    holding_company = "holding_company"
    partnership = "partnership"
    franchise = "franchise"
    cooperative = "cooperative"


class GroupMemberRole(str, enum.Enum):
    holding_company = "holding_company"
    subsidiary = "subsidiary"
    branch = "branch"
    business_unit = "business_unit"


class ReportingGroup(Base):
    __tablename__ = "reporting_groups"

    id = Column(String, primary_key=True, default=lambda: f"rg_{uuid4().hex[:12]}")
    name = Column(String(255), nullable=False)
    status = Column(Enum(ReportingGroupStatus), default=ReportingGroupStatus.active, nullable=False)
    group_type = Column(Enum(GroupType), default=GroupType.holding_company, nullable=False)
    holding_org_id = Column(String, ForeignKey("organisations.id"), nullable=False, index=True)
    shared_aml_program_id = Column(String, nullable=True)
    austrac_group_id = Column(String(50), nullable=True)
    created_by = Column(String, nullable=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())

    members = relationship("ReportingGroupMember", back_populates="group", cascade="all, delete-orphan")
    holding_org = relationship("Organisation", foreign_keys=[holding_org_id])


class ReportingGroupMember(Base):
    __tablename__ = "reporting_group_members"

    id = Column(String, primary_key=True, default=lambda: f"rgm_{uuid4().hex[:12]}")
    group_id = Column(String, ForeignKey("reporting_groups.id", ondelete="CASCADE"), nullable=False, index=True)
    org_id = Column(String, ForeignKey("organisations.id", ondelete="CASCADE"), nullable=False, index=True)
    member_role = Column(Enum(GroupMemberRole), default=GroupMemberRole.subsidiary, nullable=False)
    jurisdiction = Column(String(2), nullable=True)
    joined_at = Column(DateTime(timezone=True), server_default=func.now())
    left_at = Column(DateTime(timezone=True), nullable=True)
    is_active = Column(Boolean, default=True, nullable=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    group = relationship("ReportingGroup", back_populates="members")
    org = relationship("Organisation", foreign_keys=[org_id])
