"""
Mitigation Library — reusable mitigation catalogue.

Distinct from RiskMitigation (app.models.risk_engine), which is a per-assessment
-run instance of a mitigation action ("do X by date Y"). MitigationLibraryItem is
the reusable, governed catalogue entry that RiskMitigation and GovernanceControl
rows may reference, so mitigation descriptions/weightings are defined once and
reused across orgs/industries rather than retyped as free text each time.

System-seeded rows (org_id is null) are read-only platform defaults, mirroring
the RiskLibraryFactor pattern in risk_engine.py. Org rows (org_id set) are
custom additions/overrides.
"""

import enum
from uuid import uuid4

from sqlalchemy import (
    JSON,
    Boolean,
    Column,
    DateTime,
    Enum,
    Float,
    ForeignKey,
    String,
    Text,
    func,
)
from sqlalchemy.orm import relationship

from app.db.database import Base
from app.models.governance_controls import ControlEffectiveness


class MitigationCategory(str, enum.Enum):
    identity_verification = "identity_verification"
    document_review = "document_review"
    screening = "screening"
    source_of_funds = "source_of_funds"
    source_of_wealth = "source_of_wealth"
    beneficial_ownership = "beneficial_ownership"
    enhanced_due_diligence = "enhanced_due_diligence"
    governance_approval = "governance_approval"
    ongoing_monitoring = "ongoing_monitoring"
    other = "other"


class MitigationLibraryItem(Base):
    __tablename__ = "mitigation_library_items"

    id = Column(String, primary_key=True, default=lambda: f"mli_{uuid4().hex[:12]}")
    org_id = Column(
        String, ForeignKey("organisations.id", ondelete="CASCADE"), nullable=True, index=True
    )  # null = system-seeded, read-only platform default

    name = Column(String(255), nullable=False)
    description = Column(Text)
    category = Column(Enum(MitigationCategory), default=MitigationCategory.other)

    # Numeric weighting (0-1) used when combining multiple applied mitigations
    # into a control-effectiveness adjustment. Does not itself set a rating.
    control_weighting = Column(Float, default=0.1)
    effectiveness_rating = Column(
        Enum(ControlEffectiveness), default=ControlEffectiveness.not_tested
    )

    applicable_industries = Column(JSON, default=list)  # [IndustryType.value, ...]
    risk_categories = Column(JSON, default=list)  # [RiskCategoryType.value / ControlRiskArea.value, ...]

    is_system = Column(Boolean, default=False)  # platform-seeded; orgs may not delete
    is_active = Column(Boolean, default=True)

    created_by = Column(String)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())
