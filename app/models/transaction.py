"""
Transaction model — bank-grade AML/CTF transaction register.

Supports: remittance, FX, crypto/VASP, card, cash, stored value,
          cross-border transfers, agent-initiated, digital wallets.

Design rules:
  - UUID primary keys (portable, no integer leakage)
  - org_id on every record (strict tenant isolation)
  - Crypto details in separate child table (avoids nullable column sprawl)
  - Behaviour signals stored per transaction (set by monitoring engine)
  - risk_score and behaviour_score are CALCULATED — never user-settable via API
  - Immutable after status = completed (audit trail integrity)

DISCLAIMER: Platform stores and processes transaction data as a tool only.
Determining whether a transaction is suspicious, criminal, or reportable
remains the sole responsibility of the reporting entity.
"""

import enum
from uuid import uuid4

from sqlalchemy import (
    JSON,
    Boolean,
    Column,
    Date,
    DateTime,
    Enum,
    Float,
    ForeignKey,
    Integer,
    String,
    Text,
    func,
)
from sqlalchemy.orm import relationship

from app.db.database import Base

# ── Enums ─────────────────────────────────────────────────────────────────────


class TransactionDirection(str, enum.Enum):
    incoming = "incoming"  # funds received by the customer
    outgoing = "outgoing"  # funds sent by the customer
    internal = "internal"  # between two accounts of the same customer


class TransactionType(str, enum.Enum):
    deposit = "deposit"
    withdrawal = "withdrawal"
    transfer = "transfer"
    payment = "payment"
    exchange = "exchange"  # FX conversion
    remittance = "remittance"
    crypto_purchase = "crypto_purchase"
    crypto_sale = "crypto_sale"
    crypto_transfer = "crypto_transfer"
    loan_disbursement = "loan_disbursement"
    loan_repayment = "loan_repayment"
    real_estate_settlement = "real_estate_settlement"
    trust_distribution = "trust_distribution"
    other = "other"


class PaymentMethod(str, enum.Enum):
    bank_transfer = "bank_transfer"
    cash = "cash"
    crypto = "crypto"
    card = "card"
    cheque = "cheque"
    stored_value = "stored_value"
    digital_wallet = "digital_wallet"
    third_party_payment = "third_party_payment"
    cross_border_transfer = "cross_border_transfer"
    direct_debit = "direct_debit"
    eft = "eft"
    bpay = "bpay"
    npp = "npp"  # New Payments Platform (Australia)
    rtgs = "rtgs"  # real-time gross settlement
    swift = "swift"
    other = "other"


class TransactionStatus(str, enum.Enum):
    pending = "pending"
    processing = "processing"
    completed = "completed"
    flagged = "flagged"  # monitoring flag; not blocked
    blocked = "blocked"  # held pending review
    under_review = "under_review"
    cleared = "cleared"  # reviewed and cleared
    reversed = "reversed"
    failed = "failed"


class DeliveryChannel(str, enum.Enum):
    online = "online"
    mobile_app = "mobile_app"
    branch = "branch"
    atm = "atm"
    agent = "agent"
    telephone = "telephone"
    api = "api"  # B2B API integration
    third_party = "third_party"
    unattended = "unattended"


class CryptoNetwork(str, enum.Enum):
    bitcoin = "bitcoin"
    ethereum = "ethereum"
    solana = "solana"
    tron = "tron"
    usdt_erc20 = "usdt_erc20"
    usdt_trc20 = "usdt_trc20"
    usdc = "usdc"
    bnb = "bnb"
    polygon = "polygon"
    other = "other"


# ── Transaction ────────────────────────────────────────────────────────────────


class Transaction(Base):
    __tablename__ = "transactions"

    id = Column(String, primary_key=True, default=lambda: f"txn_{uuid4().hex[:12]}")
    transaction_ref = Column(String(50), unique=True, nullable=False, index=True)
    org_id = Column(
        String,
        ForeignKey("organisations.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    customer_id = Column(String, ForeignKey("customers.id"), nullable=False, index=True)
    customer_type = Column(String(50))  # snapshot of customer type at time of txn

    # ── Classification ────────────────────────────────────────────────────────
    transaction_type = Column(Enum(TransactionType), nullable=False)
    direction = Column(Enum(TransactionDirection), nullable=False, index=True)
    payment_method = Column(Enum(PaymentMethod), nullable=False)
    delivery_channel = Column(Enum(DeliveryChannel))
    status = Column(
        Enum(TransactionStatus),
        default=TransactionStatus.pending,
        nullable=False,
        index=True,
    )

    # ── Value ─────────────────────────────────────────────────────────────────
    currency = Column(String(3), default="AUD", nullable=False)
    amount = Column(Float, nullable=False)
    amount_aud = Column(Float)  # AUD equivalent at time of transaction
    exchange_rate = Column(Float)  # rate used for conversion
    foreign_currency = Column(String(3))  # original currency if FX conversion
    foreign_amount = Column(Float)

    # ── Purpose & Narrative ───────────────────────────────────────────────────
    purpose = Column(String(500))
    description = Column(Text)
    reference = Column(String(255))
    customer_reference = Column(String(255))  # customer-provided reference

    # ── Source (sending side) ─────────────────────────────────────────────────
    source_account_name = Column(String(255))
    source_account_number = Column(String(50))
    source_bsb = Column(String(10))
    source_bank_name = Column(String(255))
    source_bank_bic = Column(String(11))  # SWIFT BIC
    source_iban = Column(String(34))
    source_country = Column(String(2), index=True)

    # ── Destination (receiving side) ──────────────────────────────────────────
    destination_account_name = Column(String(255))
    destination_account_number = Column(String(50))
    destination_bsb = Column(String(10))
    destination_bank_name = Column(String(255))
    destination_bank_bic = Column(String(11))
    destination_iban = Column(String(34))
    destination_country = Column(String(2), index=True)

    # ── Geography ─────────────────────────────────────────────────────────────
    country_origin = Column(String(2))  # where funds originate
    country_destination = Column(String(2))  # where funds are going
    is_cross_border = Column(Boolean, default=False, index=True)

    # ── Merchant / Counterparty ───────────────────────────────────────────────
    merchant_name = Column(String(255))
    merchant_category_code = Column(String(10))  # MCC for card transactions
    counterparty_name = Column(String(255))
    counterparty_type = Column(String(50))  # individual | business | government

    # ── AML-specific enrichment flags ─────────────────────────────────────────
    is_near_threshold = Column(
        Boolean, default=False
    )  # within 10% of reporting threshold
    is_round_number = Column(Boolean, default=False)  # structuring indicator
    is_structuring_suspect = Column(Boolean, default=False)  # multi-txn pattern
    is_cash_intensive = Column(Boolean, default=False)

    # ── Risk (set by monitoring engine — never user-settable) ─────────────────
    risk_score = Column(Float, default=0.0, index=True)
    behaviour_score = Column(Float, default=0.0)  # behaviour anomaly score
    geo_risk_score = Column(Float, default=0.0)
    alerts_generated = Column(Integer, default=0)
    rules_matched = Column(JSON, default=list)  # [rule_id, ...]
    behaviour_signals = Column(JSON, default=dict)  # signal breakdown

    # ── Metadata ──────────────────────────────────────────────────────────────
    transaction_date = Column(DateTime(timezone=True), nullable=False, index=True)
    value_date = Column(Date)  # effective/settlement date
    processing_date = Column(DateTime(timezone=True))
    created_by = Column(String)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())

    # ── Relationships ─────────────────────────────────────────────────────────
    customer = relationship("Customer", back_populates="transactions")
    organisation = relationship("Organisation", back_populates="transactions")
    crypto_detail = relationship(
        "TransactionCryptoDetail",
        back_populates="transaction",
        uselist=False,
        cascade="all, delete-orphan",
    )
    alerts = relationship(
        "TransactionAlert", back_populates="transaction", cascade="all, delete-orphan"
    )
    case_links = relationship("CaseAlert", back_populates="transaction")


# ── Crypto Transaction Detail ──────────────────────────────────────────────────


class TransactionCryptoDetail(Base):
    """
    Crypto-specific fields for digital asset transactions.
    Stored separately to avoid nullable column sprawl on the main table.
    """

    __tablename__ = "transaction_crypto_details"

    id = Column(String, primary_key=True, default=lambda: f"cdet_{uuid4().hex[:10]}")
    transaction_id = Column(
        String,
        ForeignKey("transactions.id", ondelete="CASCADE"),
        nullable=False,
        unique=True,
        index=True,
    )
    org_id = Column(String, nullable=False)

    network = Column(Enum(CryptoNetwork), nullable=False)
    asset = Column(String(20))  # BTC, ETH, USDT, SOL, etc.
    token_contract = Column(String(255))  # ERC-20 / TRC-20 contract address

    source_wallet = Column(String(255), index=True)
    destination_wallet = Column(String(255), index=True)
    transaction_hash = Column(String(255), unique=True, index=True)
    block_number = Column(Integer)
    block_timestamp = Column(DateTime(timezone=True))
    confirmations = Column(Integer)

    # Self-hosted vs exchange wallet flags
    source_wallet_type = Column(String(50))  # self_hosted | exchange | unknown
    destination_wallet_type = Column(String(50))

    # Wallet screening results (set by screening engine)
    source_wallet_risk_score = Column(Float)
    source_wallet_risk_category = Column(String(50))
    destination_wallet_risk_score = Column(Float)
    destination_wallet_risk_category = Column(String(50))

    # Exposure flags (set by Chainalysis / TRM / Elliptic)
    sanctioned_exposure_pct = Column(Float, default=0.0)
    darknet_exposure_pct = Column(Float, default=0.0)
    mixer_exposure_pct = Column(Float, default=0.0)
    high_risk_exchange_pct = Column(Float, default=0.0)
    scam_exposure_pct = Column(Float, default=0.0)

    provider = Column(String(50))  # chainalysis | trm_labs | elliptic
    provider_raw_response = Column(Text)  # full JSON response

    screened_at = Column(DateTime(timezone=True))
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    transaction = relationship("Transaction", back_populates="crypto_detail")


# ── Customer Behaviour Profile ─────────────────────────────────────────────────


class CustomerBehaviourProfile(Base):
    """
    Rolling baseline for a customer's transaction behaviour.
    Updated by the monitoring engine after each transaction batch.
    Used by rules engine to detect deviations from normal patterns.
    """

    __tablename__ = "customer_behaviour_profiles"

    id = Column(String, primary_key=True, default=lambda: f"bp_{uuid4().hex[:12]}")
    customer_id = Column(
        String,
        ForeignKey("customers.id", ondelete="CASCADE"),
        nullable=False,
        unique=True,
        index=True,
    )
    org_id = Column(String, nullable=False, index=True)

    # ── Activity baselines ─────────────────────────────────────────────────────
    avg_txn_per_day = Column(Float, default=0.0)
    avg_txn_per_week = Column(Float, default=0.0)
    avg_txn_per_month = Column(Float, default=0.0)
    avg_txn_amount_aud = Column(Float, default=0.0)
    max_txn_amount_aud = Column(Float, default=0.0)
    total_volume_30d_aud = Column(Float, default=0.0)
    total_volume_90d_aud = Column(Float, default=0.0)
    total_txn_count_30d = Column(Integer, default=0)
    total_txn_count_90d = Column(Integer, default=0)

    # ── Countries ─────────────────────────────────────────────────────────────
    usual_source_countries = Column(JSON, default=list)  # ISO codes
    usual_destination_countries = Column(JSON, default=list)
    high_risk_country_count = Column(
        Integer, default=0
    )  # transactions to/from high-risk

    # ── Channels ──────────────────────────────────────────────────────────────
    usual_channels = Column(JSON, default=list)
    usual_payment_methods = Column(JSON, default=list)

    # ── Dormancy ──────────────────────────────────────────────────────────────
    last_transaction_date = Column(DateTime(timezone=True))
    is_dormant = Column(Boolean, default=False)  # no txns > 90 days
    dormancy_reactivated = Column(Boolean, default=False)  # recently reactivated

    # ── Velocity flags ────────────────────────────────────────────────────────
    peak_daily_txn_count = Column(Integer, default=0)
    peak_daily_volume_aud = Column(Float, default=0.0)

    # ── Profile metadata ──────────────────────────────────────────────────────
    observation_start_date = Column(Date)
    last_calculated_at = Column(DateTime(timezone=True))
    txn_count_total = Column(Integer, default=0)

    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())
