"""
Transaction Receipt & Summary — structured output for reporting and audit.

Every transaction can be rendered as a machine-readable receipt that carries
all fields needed for AUSTRAC reporting (TTR, IFTI, SMR supplementary data).

Receipt includes:
  - Transaction identity and classification
  - AML enrichment flags
  - Linked alerts (with scores and categories)
  - Linked cases (case_ref, status, SMR indicators)
  - Crypto detail (if applicable)
  - Customer snapshot at time of receipt generation
  - Monitoring signals summary
  - Reporting metadata block (for downstream AUSTRAC report population)

DISCLAIMER: This receipt is a structured data export for compliance workflow
support only. It does not constitute a report to AUSTRAC or any other regulator.
"""
from datetime import date, datetime, timezone
from typing import Any, Optional

from pydantic import BaseModel, Field

from app.models.monitoring import AlertCategory, AlertSeverity, AlertStatus
from app.models.transaction import PaymentMethod, TransactionDirection, TransactionType


class ReceiptAlertSummary(BaseModel):
    alert_id: str
    alert_ref: str
    category: AlertCategory
    severity: AlertSeverity
    status: AlertStatus
    alert_score: float
    title: str
    is_smr_candidate: bool
    trigger_date: datetime

    class Config:
        from_attributes = True


class ReceiptCaseSummary(BaseModel):
    case_id: str
    case_ref: str
    case_type: str
    status: str
    severity: str
    is_smr_candidate: bool
    smr_lodged: bool
    smr_reference: Optional[str] = None

    class Config:
        from_attributes = True


class ReceiptCryptoSummary(BaseModel):
    network: str
    asset: str
    source_wallet: Optional[str] = None
    destination_wallet: Optional[str] = None
    transaction_hash: Optional[str] = None
    source_wallet_risk_score: Optional[float] = None
    destination_wallet_risk_score: Optional[float] = None
    sanctioned_exposure_pct: float
    darknet_exposure_pct: float
    mixer_exposure_pct: float
    high_risk_exchange_pct: float
    scam_exposure_pct: float
    provider: Optional[str] = None
    screened_at: Optional[datetime] = None

    class Config:
        from_attributes = True


class ReceiptCustomerSnapshot(BaseModel):
    customer_id: str
    customer_ref: str
    full_name: str
    customer_type: Optional[str] = None
    risk_level: Optional[str] = None
    risk_score: Optional[float] = None
    cdd_level: Optional[str] = None
    is_pep: bool
    country_of_residence: Optional[str] = None
    nationality: Optional[str] = None


class AUSTRACReportingBlock(BaseModel):
    """
    Pre-populated fields for AUSTRAC report forms.
    Populated from transaction data — entity must verify before lodging.

    DISCLAIMER: These fields are populated to support workflow only.
    The reporting entity bears sole responsibility for the accuracy and
    completeness of any report submitted to AUSTRAC.
    """
    # TTR (Threshold Transaction Report) indicators
    is_ttr_reportable: bool = Field(
        description="True if amount_aud >= AUD 10,000 — TTR may be required"
    )
    ttr_threshold_aud: float = 10_000.0

    # IFTI (International Funds Transfer Instruction) indicators
    is_ifti_reportable: bool = Field(
        description="True if cross-border and involves transfer of value"
    )

    # Near-threshold structuring indicator
    is_near_threshold: bool
    is_structuring_suspect: bool

    # Geographic risk indicators
    high_risk_countries_involved: list[str]
    fatf_blacklist_countries: list[str]
    sanctioned_countries: list[str]

    # SMR indicators
    has_open_smr_candidate_alert: bool
    has_lodged_smr: bool
    smr_references: list[str]

    # Reporting fields
    reporting_entity_note: str = (
        "Review all fields before lodging any report. "
        "This block is auto-populated from system data and requires human verification."
    )


class TransactionReceipt(BaseModel):
    """
    Complete transaction receipt for compliance workflow and reporting support.
    Suitable for printing, PDF export, and downstream reporting population.
    """
    # ── Receipt metadata ────────────────────────────────────────────────────────
    receipt_generated_at: datetime
    receipt_generated_by: str    # user_id
    receipt_version: str = "1.0"
    disclaimer: str = (
        "This receipt is a structured compliance workflow document. "
        "It does not constitute a report to AUSTRAC or any regulator. "
        "Decisions to lodge Threshold Transaction Reports, International Funds Transfer "
        "Instructions, or Suspicious Matter Reports remain entirely with the reporting entity."
    )

    # ── Transaction identity ────────────────────────────────────────────────────
    transaction_id: str
    transaction_ref: str
    org_id: str
    transaction_date: datetime
    value_date: Optional[date] = None

    # ── Classification ──────────────────────────────────────────────────────────
    transaction_type: TransactionType
    direction: TransactionDirection
    payment_method: PaymentMethod
    delivery_channel: Optional[str] = None
    status: str

    # ── Value ───────────────────────────────────────────────────────────────────
    currency: str
    amount: float
    amount_aud: Optional[float] = None
    exchange_rate: Optional[float] = None
    foreign_currency: Optional[str] = None
    foreign_amount: Optional[float] = None

    # ── Purpose ─────────────────────────────────────────────────────────────────
    purpose: Optional[str] = None
    description: Optional[str] = None
    reference: Optional[str] = None
    customer_reference: Optional[str] = None

    # ── Source ──────────────────────────────────────────────────────────────────
    source_account_name: Optional[str] = None
    source_account_number: Optional[str] = None
    source_bsb: Optional[str] = None
    source_bank_name: Optional[str] = None
    source_bank_bic: Optional[str] = None
    source_iban: Optional[str] = None
    source_country: Optional[str] = None

    # ── Destination ─────────────────────────────────────────────────────────────
    destination_account_name: Optional[str] = None
    destination_account_number: Optional[str] = None
    destination_bsb: Optional[str] = None
    destination_bank_name: Optional[str] = None
    destination_bank_bic: Optional[str] = None
    destination_iban: Optional[str] = None
    destination_country: Optional[str] = None

    # ── Geography ───────────────────────────────────────────────────────────────
    country_origin: Optional[str] = None
    country_destination: Optional[str] = None
    is_cross_border: bool

    # ── Counterparty ────────────────────────────────────────────────────────────
    counterparty_name: Optional[str] = None
    counterparty_type: Optional[str] = None
    merchant_name: Optional[str] = None
    merchant_category_code: Optional[str] = None

    # ── AML flags ───────────────────────────────────────────────────────────────
    is_near_threshold: bool
    is_round_number: bool
    is_structuring_suspect: bool
    is_cash_intensive: bool

    # ── Risk scores (engine-computed) ────────────────────────────────────────────
    risk_score: float
    behaviour_score: float
    geo_risk_score: float
    alerts_generated: int
    rules_matched: list[str]
    behaviour_signals: dict[str, Any]

    # ── Customer snapshot ────────────────────────────────────────────────────────
    customer: ReceiptCustomerSnapshot

    # ── Linked alerts ────────────────────────────────────────────────────────────
    alerts: list[ReceiptAlertSummary] = []

    # ── Linked cases ────────────────────────────────────────────────────────────
    cases: list[ReceiptCaseSummary] = []

    # ── Crypto detail ────────────────────────────────────────────────────────────
    crypto_detail: Optional[ReceiptCryptoSummary] = None

    # ── AUSTRAC reporting block ──────────────────────────────────────────────────
    austrac_reporting: AUSTRACReportingBlock


def build_receipt(
    txn,
    customer,
    alerts: list,
    cases: list,
    generated_by: str,
) -> TransactionReceipt:
    """
    Assemble a TransactionReceipt from ORM objects.
    Called by GET /transactions/{id}/receipt.
    """
    from app.services.monitoring_engine import FATF_BLACKLIST, SANCTIONED_COUNTRIES

    TTR_THRESHOLD = 10_000.0
    amount_aud = txn.amount_aud or txn.amount

    countries_involved = {
        c for c in [
            txn.source_country, txn.destination_country,
            txn.country_origin, txn.country_destination,
        ] if c
    }

    fatf_blacklist_hits = [c for c in countries_involved if c.upper() in FATF_BLACKLIST]
    sanctioned_hits = [c for c in countries_involved if c.upper() in SANCTIONED_COUNTRIES]
    high_risk = list(set(fatf_blacklist_hits + sanctioned_hits))

    smr_references = [
        c.smr_reference for c in cases
        if getattr(c, "smr_reference", None)
    ]
    has_open_smr_alert = any(getattr(a, "is_smr_candidate", False) for a in alerts)
    has_lodged_smr = any(getattr(c, "smr_lodged", False) for c in cases)

    alert_summaries = [
        ReceiptAlertSummary(
            alert_id=a.id,
            alert_ref=a.alert_ref,
            category=a.category,
            severity=a.severity,
            status=a.status,
            alert_score=a.alert_score,
            title=a.title,
            is_smr_candidate=a.is_smr_candidate,
            trigger_date=a.trigger_date,
        )
        for a in alerts
    ]

    case_summaries = [
        ReceiptCaseSummary(
            case_id=c.id,
            case_ref=c.case_ref,
            case_type=c.case_type.value,
            status=c.status.value,
            severity=c.severity.value,
            is_smr_candidate=c.is_smr_candidate,
            smr_lodged=c.smr_lodged,
            smr_reference=c.smr_reference,
        )
        for c in cases
    ]

    crypto_summary = None
    if txn.crypto_detail:
        d = txn.crypto_detail
        crypto_summary = ReceiptCryptoSummary(
            network=d.network.value,
            asset=d.asset,
            source_wallet=d.source_wallet,
            destination_wallet=d.destination_wallet,
            transaction_hash=d.transaction_hash,
            source_wallet_risk_score=d.source_wallet_risk_score,
            destination_wallet_risk_score=d.destination_wallet_risk_score,
            sanctioned_exposure_pct=d.sanctioned_exposure_pct or 0,
            darknet_exposure_pct=d.darknet_exposure_pct or 0,
            mixer_exposure_pct=d.mixer_exposure_pct or 0,
            high_risk_exchange_pct=d.high_risk_exchange_pct or 0,
            scam_exposure_pct=d.scam_exposure_pct or 0,
            provider=d.provider,
            screened_at=d.screened_at,
        )

    customer_snapshot = ReceiptCustomerSnapshot(
        customer_id=customer.id,
        customer_ref=getattr(customer, "customer_ref", customer.id),
        full_name=getattr(customer, "full_name", ""),
        customer_type=getattr(customer, "customer_type", {}).value
            if hasattr(getattr(customer, "customer_type", None), "value")
            else str(getattr(customer, "customer_type", "")),
        risk_level=getattr(customer, "risk_level", {}).value
            if hasattr(getattr(customer, "risk_level", None), "value")
            else getattr(customer, "risk_level", None),
        risk_score=getattr(customer, "risk_score", None),
        cdd_level=getattr(customer, "cdd_level", {}).value
            if hasattr(getattr(customer, "cdd_level", None), "value")
            else getattr(customer, "cdd_level", None),
        is_pep=bool(getattr(customer, "is_pep", False)),
        country_of_residence=getattr(customer, "country_of_residence", None),
        nationality=getattr(customer, "nationality", None),
    )

    reporting_block = AUSTRACReportingBlock(
        is_ttr_reportable=amount_aud >= TTR_THRESHOLD,
        ttr_threshold_aud=TTR_THRESHOLD,
        is_ifti_reportable=bool(txn.is_cross_border),
        is_near_threshold=bool(txn.is_near_threshold),
        is_structuring_suspect=bool(txn.is_structuring_suspect),
        high_risk_countries_involved=high_risk,
        fatf_blacklist_countries=fatf_blacklist_hits,
        sanctioned_countries=sanctioned_hits,
        has_open_smr_candidate_alert=has_open_smr_alert,
        has_lodged_smr=has_lodged_smr,
        smr_references=smr_references,
    )

    return TransactionReceipt(
        receipt_generated_at=datetime.now(timezone.utc),
        receipt_generated_by=generated_by,
        transaction_id=txn.id,
        transaction_ref=txn.transaction_ref,
        org_id=txn.org_id,
        transaction_date=txn.transaction_date,
        value_date=txn.value_date,
        transaction_type=txn.transaction_type,
        direction=txn.direction,
        payment_method=txn.payment_method,
        delivery_channel=txn.delivery_channel.value if txn.delivery_channel else None,
        status=txn.status.value,
        currency=txn.currency,
        amount=txn.amount,
        amount_aud=txn.amount_aud,
        exchange_rate=txn.exchange_rate,
        foreign_currency=txn.foreign_currency,
        foreign_amount=txn.foreign_amount,
        purpose=txn.purpose,
        description=txn.description,
        reference=txn.reference,
        customer_reference=txn.customer_reference,
        source_account_name=txn.source_account_name,
        source_account_number=txn.source_account_number,
        source_bsb=txn.source_bsb,
        source_bank_name=txn.source_bank_name,
        source_bank_bic=txn.source_bank_bic,
        source_iban=txn.source_iban,
        source_country=txn.source_country,
        destination_account_name=txn.destination_account_name,
        destination_account_number=txn.destination_account_number,
        destination_bsb=txn.destination_bsb,
        destination_bank_name=txn.destination_bank_name,
        destination_bank_bic=txn.destination_bank_bic,
        destination_iban=txn.destination_iban,
        destination_country=txn.destination_country,
        country_origin=txn.country_origin,
        country_destination=txn.country_destination,
        is_cross_border=txn.is_cross_border,
        counterparty_name=txn.counterparty_name,
        counterparty_type=txn.counterparty_type,
        merchant_name=txn.merchant_name,
        merchant_category_code=txn.merchant_category_code,
        is_near_threshold=bool(txn.is_near_threshold),
        is_round_number=bool(txn.is_round_number),
        is_structuring_suspect=bool(txn.is_structuring_suspect),
        is_cash_intensive=bool(txn.is_cash_intensive),
        risk_score=txn.risk_score or 0,
        behaviour_score=txn.behaviour_score or 0,
        geo_risk_score=txn.geo_risk_score or 0,
        alerts_generated=txn.alerts_generated or 0,
        rules_matched=txn.rules_matched or [],
        behaviour_signals=txn.behaviour_signals or {},
        customer=customer_snapshot,
        alerts=alert_summaries,
        cases=case_summaries,
        crypto_detail=crypto_summary,
        austrac_reporting=reporting_block,
    )
