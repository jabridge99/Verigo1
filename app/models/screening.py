"""
Screening Records — unified pluggable architecture for all screening types.

Design principle: one ScreeningRecord table for all types (PEP, sanctions, watchlist,
adverse media, regulatory). Vendor-specific data lives in provider_raw_response JSON.
This allows adding new providers or screening types without schema changes.

Crypto wallet screening is separate (blockchain-specific fields).
Adverse media has its own table (article-level detail).
"""
import enum
from uuid import uuid4

from sqlalchemy import Boolean, Column, DateTime, Enum, Float, ForeignKey, JSON, String, Text, func
from sqlalchemy.orm import relationship

from app.db.database import Base


# ── Enums ─────────────────────────────────────────────────────────────────────

class ScreeningType(str, enum.Enum):
    pep             = "pep"
    sanctions       = "sanctions"
    watchlist       = "watchlist"
    adverse_media   = "adverse_media"
    regulatory      = "regulatory"          # AUSTRAC, ASIC, APRA enforcement lists
    law_enforcement = "law_enforcement"
    ubo_pep         = "ubo_pep"
    ubo_sanctions   = "ubo_sanctions"
    ubo_adverse     = "ubo_adverse"


class ScreeningStatus(str, enum.Enum):
    pending             = "pending"
    in_progress         = "in_progress"
    clear               = "clear"
    potential_match     = "potential_match"
    confirmed_match     = "confirmed_match"
    false_positive      = "false_positive"
    requires_edd        = "requires_edd"


class ScreeningProvider(str, enum.Enum):
    internal            = "internal"
    open_sanctions      = "open_sanctions"      # OpenSanctions (open source)
    dfat                = "dfat"                # DFAT Australia
    ofac                = "ofac"                # US OFAC
    un_sanctions        = "un_sanctions"
    eu_sanctions        = "eu_sanctions"
    uk_sanctions        = "uk_sanctions"
    comply_advantage    = "comply_advantage"
    refinitiv           = "refinitiv"           # World-Check
    dow_jones           = "dow_jones"
    lexis_nexis         = "lexis_nexis"
    frankieone          = "frankieone"
    sumsub              = "sumsub"
    other               = "other"


class ScreeningEntityType(str, enum.Enum):
    customer            = "customer"
    beneficial_owner    = "beneficial_owner"
    business            = "business"


class AlertSeverity(str, enum.Enum):
    low         = "low"
    medium      = "medium"
    high        = "high"
    critical    = "critical"


class AlertStatus(str, enum.Enum):
    open            = "open"
    under_review    = "under_review"
    dismissed       = "dismissed"       # false positive confirmed
    escalated       = "escalated"       # sent to MLRO
    smr_filed       = "smr_filed"
    closed          = "closed"


# ── Unified Screening Record ───────────────────────────────────────────────────

class ScreeningRecord(Base):
    """
    One record per screening run per entity per type.
    Append-only — never update after creation; create a new record on re-screen.
    """
    __tablename__ = "screening_records"

    id = Column(String, primary_key=True, default=lambda: f"scr_{uuid4().hex[:12]}")
    org_id = Column(String, ForeignKey("organisations.id", ondelete="CASCADE"), nullable=False, index=True)
    customer_id = Column(String, ForeignKey("customers.id", ondelete="CASCADE"), nullable=False, index=True)

    # What was screened
    screening_type = Column(Enum(ScreeningType), nullable=False, index=True)
    entity_type = Column(Enum(ScreeningEntityType), nullable=False)
    entity_id = Column(String, nullable=False)          # customer.id or beneficial_owner.id
    entity_name = Column(String(255))                   # name as searched
    entity_dob = Column(String(20))                     # DOB as searched (YYYY-MM-DD)
    entity_nationality = Column(String(2))
    lists_checked = Column(JSON)                        # list of list names checked

    # Provider
    provider = Column(Enum(ScreeningProvider), nullable=False, default=ScreeningProvider.internal)
    provider_reference = Column(String(255))            # provider's transaction/request ID

    # Result
    status = Column(Enum(ScreeningStatus), default=ScreeningStatus.pending, nullable=False, index=True)
    match_count = Column(Float, default=0)
    match_score = Column(Float)                         # 0–100 fuzzy match confidence
    match_details = Column(JSON)                        # structured match data
    provider_raw_response = Column(Text)                # full JSON from provider

    # PEP-specific
    pep_category = Column(String(100))
    pep_country = Column(String(2))
    pep_position = Column(String(255))

    # Review
    reviewed_by = Column(String)
    reviewed_at = Column(DateTime(timezone=True))
    reviewer_notes = Column(Text)
    is_false_positive = Column(Boolean, default=False)

    triggered_by = Column(String)                       # user_id or "system"
    screened_at = Column(DateTime(timezone=True), server_default=func.now())
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    customer = relationship("Customer", back_populates="screening_records")
    alerts = relationship("ScreeningAlert", back_populates="screening_record", cascade="all, delete-orphan")


# ── Screening Alerts ───────────────────────────────────────────────────────────

class ScreeningAlert(Base):
    """
    Raised when a screening result requires human review.
    Must be actioned before customer status can progress.
    """
    __tablename__ = "screening_alerts"

    id = Column(String, primary_key=True, default=lambda: f"alert_{uuid4().hex[:10]}")
    org_id = Column(String, ForeignKey("organisations.id", ondelete="CASCADE"), nullable=False, index=True)
    screening_record_id = Column(String, ForeignKey("screening_records.id", ondelete="CASCADE"), nullable=False, index=True)
    customer_id = Column(String, ForeignKey("customers.id"), nullable=False, index=True)

    severity = Column(Enum(AlertSeverity), nullable=False)
    status = Column(Enum(AlertStatus), default=AlertStatus.open, nullable=False, index=True)
    alert_type = Column(String(100))        # pep_match | sanctions_hit | adverse_media | etc.
    summary = Column(Text, nullable=False)

    assigned_to = Column(String)            # user_id of reviewer
    assigned_at = Column(DateTime(timezone=True))
    resolved_by = Column(String)
    resolved_at = Column(DateTime(timezone=True))
    resolution_notes = Column(Text)

    escalated_to = Column(String)           # user_id of MLRO
    escalated_at = Column(DateTime(timezone=True))

    created_at = Column(DateTime(timezone=True), server_default=func.now())

    screening_record = relationship("ScreeningRecord", back_populates="alerts")


# ── Crypto Wallet Screening ────────────────────────────────────────────────────

class CryptoNetwork(str, enum.Enum):
    bitcoin     = "bitcoin"
    ethereum    = "ethereum"
    solana      = "solana"
    tron        = "tron"
    usdt_erc20  = "usdt_erc20"
    usdt_trc20  = "usdt_trc20"
    usdc        = "usdc"
    bnb         = "bnb"
    polygon     = "polygon"
    other       = "other"


class WalletRiskCategory(str, enum.Enum):
    clear           = "clear"
    low_risk        = "low_risk"
    medium_risk     = "medium_risk"
    high_risk       = "high_risk"
    sanctioned      = "sanctioned"
    darknet         = "darknet"
    mixer           = "mixer"
    scam            = "scam"
    exchange        = "exchange"        # known exchange (may be fine)


class CryptoProvider(str, enum.Enum):
    internal    = "internal"
    chainalysis = "chainalysis"
    trm_labs    = "trm_labs"
    elliptic    = "elliptic"
    other       = "other"


class CryptoWalletScreening(Base):
    __tablename__ = "crypto_wallet_screenings"

    id = Column(String, primary_key=True, default=lambda: f"cws_{uuid4().hex[:12]}")
    org_id = Column(String, ForeignKey("organisations.id", ondelete="CASCADE"), nullable=False, index=True)
    customer_id = Column(String, ForeignKey("customers.id", ondelete="CASCADE"), nullable=False, index=True)

    wallet_address = Column(String(255), nullable=False, index=True)
    network = Column(Enum(CryptoNetwork), nullable=False)
    wallet_label = Column(String(255))          # human label (e.g. "customer's ETH wallet")

    provider = Column(Enum(CryptoProvider), nullable=False)
    provider_reference = Column(String(255))

    # Risk results
    risk_score = Column(Float)                  # 0–100
    risk_category = Column(Enum(WalletRiskCategory))
    risk_details = Column(JSON)

    # Exposure flags
    sanctioned_exposure_pct = Column(Float, default=0.0)
    darknet_exposure_pct = Column(Float, default=0.0)
    mixer_exposure_pct = Column(Float, default=0.0)
    high_risk_exchange_pct = Column(Float, default=0.0)
    scam_exposure_pct = Column(Float, default=0.0)

    # Transaction summary
    total_received_usd = Column(Float)
    total_sent_usd = Column(Float)
    first_seen = Column(DateTime(timezone=True))
    last_seen = Column(DateTime(timezone=True))

    provider_raw_response = Column(Text)

    status = Column(Enum(ScreeningStatus), default=ScreeningStatus.pending)
    reviewed_by = Column(String)
    reviewed_at = Column(DateTime(timezone=True))
    reviewer_notes = Column(Text)

    triggered_by = Column(String)
    screened_at = Column(DateTime(timezone=True), server_default=func.now())
    created_at = Column(DateTime(timezone=True), server_default=func.now())


# ── Adverse Media ──────────────────────────────────────────────────────────────

class AdverseMediaCategory(str, enum.Enum):
    regulatory_action   = "regulatory_action"
    enforcement_action  = "enforcement_action"
    court_proceeding    = "court_proceeding"
    financial_crime     = "financial_crime"
    fraud               = "fraud"
    corruption          = "corruption"
    terrorism           = "terrorism"
    drug_trafficking    = "drug_trafficking"
    human_trafficking   = "human_trafficking"
    environmental       = "environmental"
    reputational        = "reputational"
    other               = "other"


class AdverseMediaResult(Base):
    __tablename__ = "adverse_media_results"

    id = Column(String, primary_key=True, default=lambda: f"adm_{uuid4().hex[:12]}")
    org_id = Column(String, ForeignKey("organisations.id", ondelete="CASCADE"), nullable=False, index=True)
    customer_id = Column(String, ForeignKey("customers.id", ondelete="CASCADE"), nullable=False, index=True)
    screening_record_id = Column(String, ForeignKey("screening_records.id"), nullable=True)

    category = Column(Enum(AdverseMediaCategory), nullable=False)
    headline = Column(String(1000))
    source_name = Column(String(255))
    source_url = Column(String(2000))
    publication_date = Column(DateTime(timezone=True))
    jurisdiction = Column(String(2))

    match_confidence = Column(Float)            # 0–100
    is_confirmed_match = Column(Boolean, default=False)
    is_false_positive = Column(Boolean, default=False)

    review_status = Column(Enum(AlertStatus), default=AlertStatus.open)
    reviewed_by = Column(String)
    reviewed_at = Column(DateTime(timezone=True))
    reviewer_notes = Column(Text)

    provider = Column(Enum(ScreeningProvider), default=ScreeningProvider.internal)
    provider_raw_response = Column(Text)

    created_at = Column(DateTime(timezone=True), server_default=func.now())
