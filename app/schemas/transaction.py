"""Pydantic schemas for Transaction and related models."""
from datetime import date, datetime, timezone
from typing import Any, Optional

from pydantic import BaseModel, Field, field_validator

from app.models.transaction import (
    CryptoNetwork,
    DeliveryChannel,
    PaymentMethod,
    TransactionDirection,
    TransactionStatus,
    TransactionType,
)


# ── Crypto Detail ──────────────────────────────────────────────────────────────

class CryptoDetailCreate(BaseModel):
    network: CryptoNetwork
    asset: str
    token_contract: Optional[str] = None
    source_wallet: Optional[str] = None
    destination_wallet: Optional[str] = None
    transaction_hash: Optional[str] = None
    source_wallet_type: Optional[str] = None      # self_hosted | exchange | unknown
    destination_wallet_type: Optional[str] = None


class CryptoDetailOut(BaseModel):
    id: str
    network: CryptoNetwork
    asset: str
    source_wallet: Optional[str] = None
    destination_wallet: Optional[str] = None
    transaction_hash: Optional[str] = None
    block_number: Optional[int] = None
    block_timestamp: Optional[datetime] = None
    confirmations: Optional[int] = None
    source_wallet_type: Optional[str] = None
    destination_wallet_type: Optional[str] = None
    source_wallet_risk_score: Optional[float] = None
    source_wallet_risk_category: Optional[str] = None
    destination_wallet_risk_score: Optional[float] = None
    destination_wallet_risk_category: Optional[str] = None
    sanctioned_exposure_pct: float = 0.0
    darknet_exposure_pct: float = 0.0
    mixer_exposure_pct: float = 0.0
    high_risk_exchange_pct: float = 0.0
    scam_exposure_pct: float = 0.0
    provider: Optional[str] = None
    screened_at: Optional[datetime] = None

    class Config:
        from_attributes = True


# ── Transaction ────────────────────────────────────────────────────────────────

class TransactionCreate(BaseModel):
    transaction_ref: str = Field(..., max_length=50)
    customer_id: str
    customer_type: Optional[str] = None

    transaction_type: TransactionType
    direction: TransactionDirection
    payment_method: PaymentMethod
    delivery_channel: Optional[DeliveryChannel] = None

    currency: str = Field("AUD", max_length=3)
    amount: float
    amount_aud: Optional[float] = None
    exchange_rate: Optional[float] = None
    foreign_currency: Optional[str] = Field(None, max_length=3)
    foreign_amount: Optional[float] = None

    purpose: Optional[str] = Field(None, max_length=500)
    description: Optional[str] = None
    reference: Optional[str] = Field(None, max_length=255)
    customer_reference: Optional[str] = Field(None, max_length=255)

    # Source
    source_account_name: Optional[str] = Field(None, max_length=255)
    source_account_number: Optional[str] = Field(None, max_length=50)
    source_bsb: Optional[str] = Field(None, max_length=10)
    source_bank_name: Optional[str] = Field(None, max_length=255)
    source_bank_bic: Optional[str] = Field(None, max_length=11)
    source_iban: Optional[str] = Field(None, max_length=34)
    source_country: Optional[str] = Field(None, max_length=2)

    # Destination
    destination_account_name: Optional[str] = Field(None, max_length=255)
    destination_account_number: Optional[str] = Field(None, max_length=50)
    destination_bsb: Optional[str] = Field(None, max_length=10)
    destination_bank_name: Optional[str] = Field(None, max_length=255)
    destination_bank_bic: Optional[str] = Field(None, max_length=11)
    destination_iban: Optional[str] = Field(None, max_length=34)
    destination_country: Optional[str] = Field(None, max_length=2)

    country_origin: Optional[str] = Field(None, max_length=2)
    country_destination: Optional[str] = Field(None, max_length=2)
    is_cross_border: bool = False

    merchant_name: Optional[str] = Field(None, max_length=255)
    merchant_category_code: Optional[str] = Field(None, max_length=10)
    counterparty_name: Optional[str] = Field(None, max_length=255)
    counterparty_type: Optional[str] = Field(None, max_length=50)

    transaction_date: datetime
    value_date: Optional[date] = None

    crypto_detail: Optional[CryptoDetailCreate] = None

    @field_validator("transaction_date", mode="before")
    @classmethod
    def ensure_tz_aware(cls, v: Any) -> datetime:
        if isinstance(v, datetime) and v.tzinfo is None:
            return v.replace(tzinfo=timezone.utc)
        return v


class TransactionUpdate(BaseModel):
    """Only non-risk, non-scoring fields may be updated after creation."""
    purpose: Optional[str] = Field(None, max_length=500)
    description: Optional[str] = None
    reference: Optional[str] = Field(None, max_length=255)
    status: Optional[TransactionStatus] = None


class TransactionOut(BaseModel):
    id: str
    transaction_ref: str
    org_id: str
    customer_id: str
    transaction_type: TransactionType
    direction: TransactionDirection
    payment_method: PaymentMethod
    delivery_channel: Optional[DeliveryChannel] = None
    status: TransactionStatus

    currency: str
    amount: float
    amount_aud: Optional[float] = None
    exchange_rate: Optional[float] = None
    foreign_currency: Optional[str] = None
    foreign_amount: Optional[float] = None

    purpose: Optional[str] = None
    description: Optional[str] = None
    reference: Optional[str] = None

    source_account_name: Optional[str] = None
    source_country: Optional[str] = None
    destination_account_name: Optional[str] = None
    destination_country: Optional[str] = None
    is_cross_border: bool

    counterparty_name: Optional[str] = None
    counterparty_type: Optional[str] = None

    is_near_threshold: bool
    is_round_number: bool
    is_structuring_suspect: bool
    is_cash_intensive: bool

    risk_score: float
    behaviour_score: float
    geo_risk_score: float
    alerts_generated: int
    rules_matched: list[str]
    behaviour_signals: dict[str, Any]

    transaction_date: datetime
    value_date: Optional[date] = None
    created_at: datetime
    updated_at: Optional[datetime] = None

    crypto_detail: Optional[CryptoDetailOut] = None

    class Config:
        from_attributes = True


class TransactionListOut(BaseModel):
    id: str
    transaction_ref: str
    customer_id: str
    transaction_type: TransactionType
    direction: TransactionDirection
    payment_method: PaymentMethod
    status: TransactionStatus
    currency: str
    amount: float
    amount_aud: Optional[float] = None
    is_cross_border: bool
    risk_score: float
    alerts_generated: int
    transaction_date: datetime

    class Config:
        from_attributes = True
