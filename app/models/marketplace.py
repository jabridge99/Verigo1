"""
Verification Marketplace — a generic, provider-agnostic catalogue and ordering
layer for identity/business/sanctions/adverse-media verification checks.

Deliberately NOT hardcoded to any single vendor (e.g. Sumsub): a
VerificationProvider row describes how a check is performed —
api (automated call-out), manual (human review, no API), or hybrid
(API result + mandatory manual sign-off) — so manual-only orgs are fully
supported per the brief's "Manual/API/Hybrid Verification Workflow" requirement.

Reuses existing primitives rather than duplicating them:
  - Billing: a completed, billable order creates a UsageRecord (app.models.usage)
    — the existing metered-billing pipeline — instead of a new charge model.
  - Result storage: orders link optionally to an existing ScreeningRecord /
    CryptoWalletScreening row (app.models.screening) when the check is a
    screening type; VerificationOrder itself only tracks order lifecycle
    (status, cost, evidence), not verification result schemas.

DISCLAIMER: Verification orders support the compliance workflow only.
All regulatory decisions remain with the reporting entity.
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

from app.db.database import Base


class VerificationIntegrationMode(str, enum.Enum):
    api = "api"  # automated provider API call
    manual = "manual"  # human reviewer only, no third-party API
    hybrid = "hybrid"  # API result plus mandatory manual sign-off


class VerificationCheckType(str, enum.Enum):
    identity_verification = "identity_verification"
    business_verification = "business_verification"
    address_verification = "address_verification"
    sanctions_screening = "sanctions_screening"
    pep_screening = "pep_screening"
    adverse_media = "adverse_media"
    crypto_wallet_screening = "crypto_wallet_screening"
    source_of_funds = "source_of_funds"
    other = "other"


class VerificationOrderStatus(str, enum.Enum):
    pending = "pending"  # created, awaiting provider/reviewer action
    in_progress = "in_progress"
    completed = "completed"  # result recorded, billable if cost > 0
    rejected = "rejected"  # check failed / adverse result
    cancelled = "cancelled"  # not billed


class VerificationProvider(Base):
    """
    Catalogue entry describing one verification provider/check offering.

    org_id NULL = platform-seeded, available to all orgs (e.g. "Manual
    Identity Review"). org_id set = an org-specific provider configuration
    (e.g. a custom-negotiated vendor rate), editable only by that org —
    mirrors the system-vs-custom pattern already used for
    RiskLibraryFactor / MitigationLibraryItem.
    """

    __tablename__ = "verification_providers"

    id = Column(String, primary_key=True, default=lambda: f"vprov_{uuid4().hex[:10]}")
    org_id = Column(
        String, ForeignKey("organisations.id", ondelete="CASCADE"), nullable=True, index=True
    )

    name = Column(String(150), nullable=False)
    description = Column(Text)
    check_type = Column(Enum(VerificationCheckType), nullable=False, index=True)
    integration_mode = Column(
        Enum(VerificationIntegrationMode), nullable=False, default=VerificationIntegrationMode.manual
    )

    # Vendor identifier for api/hybrid modes (e.g. "sumsub", "refinitiv"); null for manual.
    vendor_key = Column(String(50))

    unit_cost_aud = Column(Float, default=0.0, nullable=False)
    markup_pct = Column(Float, default=0.0, nullable=False)

    is_system = Column(Boolean, default=False)
    is_active = Column(Boolean, default=True, nullable=False, index=True)

    created_by = Column(String)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())


class VerificationOrder(Base):
    """
    A single requested verification check against a customer or transaction.

    entity_type/entity_id is a lightweight polymorphic link (no FK — entity
    may be a Customer, Transaction, or BeneficialOwner) so the marketplace
    is not coupled to one entity model. On completion, a billable order
    creates a UsageRecord via app.services.marketplace_service rather than
    tracking its own charge fields.
    """

    __tablename__ = "verification_orders"

    id = Column(String, primary_key=True, default=lambda: f"vord_{uuid4().hex[:10]}")
    org_id = Column(
        String, ForeignKey("organisations.id", ondelete="CASCADE"), nullable=False, index=True
    )
    provider_id = Column(
        String, ForeignKey("verification_providers.id"), nullable=False, index=True
    )

    entity_type = Column(String(30), nullable=False, index=True)  # "customer" | "transaction"
    entity_id = Column(String, nullable=False, index=True)

    status = Column(
        Enum(VerificationOrderStatus), default=VerificationOrderStatus.pending, nullable=False, index=True
    )

    # Optional link to the existing result record once produced (no duplicate
    # result schema — screening results stay in ScreeningRecord et al.).
    screening_record_id = Column(String, ForeignKey("screening_records.id"), nullable=True)

    evidence_url = Column(String(500))  # uploaded manual-review evidence, if any
    result_summary = Column(JSON)  # small free-form outcome notes, not the full result
    usage_record_id = Column(String, ForeignKey("usage_records.id"), nullable=True, index=True)

    requested_by = Column(String, nullable=False)
    reviewed_by = Column(String)  # set when a manual/hybrid reviewer signs off

    created_at = Column(DateTime(timezone=True), server_default=func.now(), index=True)
    completed_at = Column(DateTime(timezone=True))
