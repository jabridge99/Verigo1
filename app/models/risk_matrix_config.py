"""
Risk Matrix Configuration Models — Phase 2.

Supports per-org customisation of the AML/CTF risk matrix:
  - Add / remove / reweight risk factors
  - Configure risk profile thresholds (low/medium/high/critical)
  - Industry-specific defaults with full restore capability
  - Immutable audit trail of all changes (version snapshots)

DISCLAIMER: Risk matrix configuration supports compliance workflow only.
Risk ratings and scoring remain the responsibility of the reporting entity.
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
    Integer,
    String,
    Text,
    UniqueConstraint,
    func,
)

from app.db.database import Base

# ── Enums ──────────────────────────────────────────────────────────────────────


class RiskFactorCategory(str, enum.Enum):
    customer = "customer"
    geographic = "geographic"
    product = "product"
    transaction = "transaction"
    behaviour = "behaviour"
    crypto = "crypto"
    professional_service = "professional_service"
    delivery_channel = "delivery_channel"
    custom = "custom"


class RiskLevel(str, enum.Enum):
    low = "low"
    medium = "medium"
    high = "high"
    critical = "critical"


# ── System Default Factors (Seeded at org creation) ───────────────────────────

SYSTEM_RISK_FACTORS: dict[str, list[dict]] = {
    "customer": [
        {
            "key": "pep_status",
            "label": "Politically Exposed Person",
            "weight": 0.25,
            "description": "Customer or beneficial owner is a PEP",
        },
        {
            "key": "high_risk_rating",
            "label": "High Customer Risk Rating",
            "weight": 0.20,
            "description": "Customer has existing high/critical risk profile",
        },
        {
            "key": "adverse_media",
            "label": "Adverse Media Presence",
            "weight": 0.15,
            "description": "Customer appears in adverse media screening",
        },
        {
            "key": "entity_complexity",
            "label": "Complex Entity Structure",
            "weight": 0.15,
            "description": "Multiple layers of ownership or control",
        },
        {
            "key": "non_face_to_face",
            "label": "Non-Face-to-Face Onboarding",
            "weight": 0.10,
            "description": "Customer onboarded digitally or through introducer",
        },
        {
            "key": "new_customer",
            "label": "New Customer Relationship",
            "weight": 0.10,
            "description": "Relationship established within the last 90 days",
        },
        {
            "key": "customer_type",
            "label": "Business Entity Type",
            "weight": 0.05,
            "description": "Corporate, trust or association (vs individual)",
        },
    ],
    "geographic": [
        {
            "key": "fatf_blacklist",
            "label": "FATF Call-to-Action Jurisdiction",
            "weight": 0.35,
            "description": "Transaction or customer linked to FATF blacklist country",
        },
        {
            "key": "sanctioned_country",
            "label": "Sanctioned Jurisdiction",
            "weight": 0.30,
            "description": "Transaction to/from UN/DFAT sanctioned country",
        },
        {
            "key": "fatf_greylist",
            "label": "FATF Greylist Jurisdiction",
            "weight": 0.20,
            "description": "Transaction or customer linked to FATF greylist country",
        },
        {
            "key": "cross_border",
            "label": "Cross-Border Transaction",
            "weight": 0.10,
            "description": "Transaction crosses national borders",
        },
        {
            "key": "high_risk_region",
            "label": "AUSTRAC High-Risk Region",
            "weight": 0.05,
            "description": "Jurisdiction on AUSTRAC watch list",
        },
    ],
    "product": [
        {
            "key": "crypto",
            "label": "Cryptocurrency Transaction",
            "weight": 0.30,
            "description": "Purchase, transfer or receipt of cryptocurrency",
        },
        {
            "key": "remittance",
            "label": "International Remittance",
            "weight": 0.25,
            "description": "Cross-border money transfer or remittance",
        },
        {
            "key": "cash",
            "label": "Cash Transaction",
            "weight": 0.20,
            "description": "Physical cash deposit or withdrawal",
        },
        {
            "key": "real_estate",
            "label": "Real Estate Settlement",
            "weight": 0.15,
            "description": "Property purchase or settlement",
        },
        {
            "key": "prepaid_card",
            "label": "Prepaid or Anonymous Instrument",
            "weight": 0.10,
            "description": "Prepaid card, money order or bearer instrument",
        },
    ],
    "transaction": [
        {
            "key": "structuring",
            "label": "Structuring Indicators",
            "weight": 0.35,
            "description": "Patterns suggesting deliberate threshold avoidance",
        },
        {
            "key": "near_threshold",
            "label": "Near-Threshold Amount",
            "weight": 0.25,
            "description": "Transaction within 10% of AUD 10,000 TTR threshold",
        },
        {
            "key": "high_value",
            "label": "High-Value Transaction",
            "weight": 0.20,
            "description": "Single transaction above AUD 50,000",
        },
        {
            "key": "round_number",
            "label": "Unusual Round Number",
            "weight": 0.10,
            "description": "Suspiciously round amount (e.g. exactly AUD 9,000)",
        },
        {
            "key": "rapid_succession",
            "label": "Rapid Successive Transactions",
            "weight": 0.10,
            "description": "Multiple transactions within a short time window",
        },
    ],
    "behaviour": [
        {
            "key": "occupation_mismatch",
            "label": "Occupation/Income Mismatch",
            "weight": 0.30,
            "description": "Transaction inconsistent with declared occupation",
        },
        {
            "key": "dormant_reactivation",
            "label": "Dormant Account Reactivation",
            "weight": 0.25,
            "description": "Account inactive for 90+ days suddenly becomes active",
        },
        {
            "key": "unusual_channel",
            "label": "Unusual Payment Channel",
            "weight": 0.20,
            "description": "Payment method inconsistent with customer's usual behaviour",
        },
        {
            "key": "new_country",
            "label": "New Geographic Footprint",
            "weight": 0.15,
            "description": "Transaction to/from country not in customer's profile",
        },
        {
            "key": "velocity_breach",
            "label": "Transaction Velocity Anomaly",
            "weight": 0.10,
            "description": "Transaction rate exceeds established baseline",
        },
    ],
    "crypto": [
        {
            "key": "mixer_exposure",
            "label": "Cryptocurrency Mixer Exposure",
            "weight": 0.35,
            "description": "Funds linked to tumbling or mixing services",
        },
        {
            "key": "darknet_exposure",
            "label": "Darknet Market Exposure",
            "weight": 0.30,
            "description": "Funds linked to known darknet markets",
        },
        {
            "key": "sanctioned_wallet",
            "label": "Sanctioned Wallet Address",
            "weight": 0.25,
            "description": "Direct or indirect exposure to sanctioned addresses",
        },
        {
            "key": "defi_bridge",
            "label": "Cross-Chain Bridge / DeFi Protocol",
            "weight": 0.10,
            "description": "Funds routed through unregulated cross-chain bridges",
        },
    ],
    "delivery_channel": [
        {
            "key": "online_digital",
            "label": "Online / Digital Channel",
            "weight": 0.30,
            "description": "Transaction initiated via website or mobile app",
        },
        {
            "key": "third_party",
            "label": "Third-Party / Agent Channel",
            "weight": 0.35,
            "description": "Transaction via unregulated third-party or agent",
        },
        {
            "key": "atm",
            "label": "ATM or Unattended Terminal",
            "weight": 0.20,
            "description": "Transaction through ATM or kiosk",
        },
        {
            "key": "branch",
            "label": "Branch / In-Person",
            "weight": 0.15,
            "description": "Transaction conducted in person at a branch",
        },
    ],
    "professional_service": [
        {
            "key": "trust_account",
            "label": "Trust Account Involvement",
            "weight": 0.30,
            "description": "Funds pass through professional trust account",
        },
        {
            "key": "sof_unverified",
            "label": "Source of Funds Unverified",
            "weight": 0.25,
            "description": "SOF assessment not completed or evidence insufficient",
        },
        {
            "key": "sow_inconsistent",
            "label": "Source of Wealth Inconsistency",
            "weight": 0.25,
            "description": "SOW profile inconsistent or narrative not provided",
        },
        {
            "key": "third_party_payment",
            "label": "Third-Party Payment",
            "weight": 0.20,
            "description": "Funds received from unrelated third party",
        },
    ],
}

# ── Default risk profile thresholds ───────────────────────────────────────────

DEFAULT_RISK_PROFILES: list[dict] = [
    {
        "risk_level": "low",
        "score_min": 0.0,
        "score_max": 25.0,
        "review_frequency_months": 36,
        "edd_required": False,
        "enhanced_monitoring": False,
        "description": "Standard CDD. Periodic review every 3 years.",
    },
    {
        "risk_level": "medium",
        "score_min": 25.01,
        "score_max": 50.0,
        "review_frequency_months": 24,
        "edd_required": False,
        "enhanced_monitoring": True,
        "description": "Standard CDD with enhanced monitoring. Review every 2 years.",
    },
    {
        "risk_level": "high",
        "score_min": 50.01,
        "score_max": 75.0,
        "review_frequency_months": 12,
        "edd_required": True,
        "enhanced_monitoring": True,
        "description": "Enhanced Due Diligence required. Annual review.",
    },
    {
        "risk_level": "critical",
        "score_min": 75.01,
        "score_max": 100.0,
        "review_frequency_months": 6,
        "edd_required": True,
        "enhanced_monitoring": True,
        "description": "Maximum EDD. 6-monthly review. Senior approval required.",
    },
]


# ── Models ─────────────────────────────────────────────────────────────────────


class OrgRiskFactor(Base):
    """
    Customisable risk factor for this org.
    System factors (is_system=True) cannot be deleted but can be disabled/reweighted.
    Custom factors (is_system=False) can be added/removed by the org.
    """

    __tablename__ = "org_risk_factors"
    __table_args__ = (
        UniqueConstraint("org_id", "factor_key", name="uq_org_factor_key"),
    )

    id = Column(String, primary_key=True, default=lambda: f"orf_{uuid4().hex[:10]}")
    org_id = Column(
        String,
        ForeignKey("organisations.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    category = Column(Enum(RiskFactorCategory), nullable=False, index=True)
    factor_key = Column(String(100), nullable=False)  # e.g. "pep_status"
    label = Column(String(255), nullable=False)
    description = Column(Text)

    weight = Column(Float, nullable=False, default=0.10)  # 0.0–1.0
    is_active = Column(Boolean, default=True, nullable=False)
    is_system = Column(
        Boolean, default=False, nullable=False
    )  # VeriGo-seeded, cannot delete

    # Display order within category
    display_order = Column(Integer, default=0)

    # Threshold for this factor to trigger (used in scoring engine)
    trigger_threshold = Column(Float)  # e.g. amount > trigger_threshold

    created_by = Column(String)
    updated_by = Column(String)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())


class OrgRiskProfile(Base):
    """
    Risk profile thresholds: score ranges that map to low/medium/high/critical.
    Orgs can adjust score_min/max, review_frequency, and EDD requirements.
    """

    __tablename__ = "org_risk_profiles"
    __table_args__ = (
        UniqueConstraint("org_id", "risk_level", name="uq_org_risk_level"),
    )

    id = Column(String, primary_key=True, default=lambda: f"orp_{uuid4().hex[:10]}")
    org_id = Column(
        String,
        ForeignKey("organisations.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    risk_level = Column(Enum(RiskLevel), nullable=False)

    score_min = Column(Float, nullable=False)  # Inclusive
    score_max = Column(Float, nullable=False)  # Inclusive

    review_frequency_months = Column(Integer, nullable=False, default=24)
    edd_required = Column(Boolean, default=False)
    enhanced_monitoring = Column(Boolean, default=False)
    senior_approval_required = Column(Boolean, default=False)

    description = Column(Text)

    updated_by = Column(String)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())


class OrgRiskMatrixVersion(Base):
    """
    Immutable audit snapshot of the risk matrix at a point in time.
    Created on every change to OrgRiskFactor or OrgRiskProfile.
    Supports restore-to-version and audit trail requirements.
    """

    __tablename__ = "org_risk_matrix_versions"

    id = Column(String, primary_key=True, default=lambda: f"rmv_{uuid4().hex[:12]}")
    org_id = Column(
        String,
        ForeignKey("organisations.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    version_number = Column(Integer, nullable=False)
    change_type = Column(String(50))  # factor_added | factor_updated | factor_deleted
    # profile_updated | weights_rebalanced | restored_defaults
    change_summary = Column(String(500))  # human-readable description

    factors_snapshot = Column(
        JSON, nullable=False
    )  # full serialised OrgRiskFactor list
    profiles_snapshot = Column(
        JSON, nullable=False
    )  # full serialised OrgRiskProfile list

    changed_by = Column(String, nullable=False)
    change_reason = Column(Text)
    previous_value = Column(JSON)  # the specific field(s) that changed
    new_value = Column(JSON)

    created_at = Column(DateTime(timezone=True), server_default=func.now())
    # Immutable: no updated_at
