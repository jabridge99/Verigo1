"""
IFTI Receipt Service — generate, hash, and supersede customer receipts.

Receipts are immutable. SHA-256 audit_hash is computed over the canonical
content fields to support integrity verification at any future point.
"""

import hashlib
import json
from datetime import datetime, timezone
from typing import Optional
from uuid import uuid4

from sqlalchemy.orm import Session

from app.models.ifti_receipt import IFTIReceipt, ReceiptStatus
from app.models.report import IFTIReport
from app.models.transaction import Transaction

ENTITY_CODE = "PSPE"

COMPLIANCE_FOOTER = (
    "This receipt is issued by a reporting entity under the Anti-Money Laundering "
    "and Counter-Terrorism Financing Act 2006 (Cth). International funds transfers "
    "may be subject to AUSTRAC reporting obligations. This receipt does not constitute "
    "financial advice."
)

RISK_DISCLAIMER = (
    "This document is a compliance workflow record only. It does not constitute a "
    "report to AUSTRAC or any other regulator. All regulatory reporting decisions "
    "remain with the reporting entity."
)


def _next_receipt_ref(org_code: str) -> str:
    today = datetime.now(timezone.utc).strftime("%Y%m%d")
    seq = uuid4().hex[:4].upper()
    return f"{org_code}-RCPT-{today}-{seq}"


def _compute_audit_hash(receipt: IFTIReceipt) -> str:
    """
    SHA-256 over the canonical JSON of content fields.
    Field set is fixed — do not add optional fields here as it would break
    hash verification for previously-issued receipts.
    """
    canonical = {
        "receipt_ref": receipt.receipt_ref,
        "transfer_date": str(receipt.transfer_date),
        "direction": receipt.direction,
        "total_amount": receipt.total_amount,
        "currency": receipt.currency,
        "amount_aud": receipt.amount_aud,
        "exchange_rate": receipt.exchange_rate,
        "transfer_reference": receipt.transfer_reference,
        "sender_name": receipt.sender_name,
        "sender_account_number": receipt.sender_account_number,
        "sender_bank_name": receipt.sender_bank_name,
        "sender_country": receipt.sender_country,
        "beneficiary_name": receipt.beneficiary_name,
        "beneficiary_account_number": receipt.beneficiary_account_number,
        "beneficiary_bank_name": receipt.beneficiary_bank_name,
        "beneficiary_country": receipt.beneficiary_country,
        "processor_name": receipt.processor_name,
        "processor_abn": receipt.processor_abn,
    }
    payload = json.dumps(canonical, sort_keys=True, ensure_ascii=True)
    return hashlib.sha256(payload.encode("utf-8")).hexdigest()


def generate_ifti_receipt(
    txn: Transaction,
    ifti_report: Optional[IFTIReport],
    generated_by: str,
    db: Session,
    org_code: str = ENTITY_CODE,
    processor_name: Optional[str] = None,
    processor_abn: Optional[str] = None,
    processor_austrac_id: Optional[str] = None,
    processor_address: Optional[str] = None,
    processor_contact: Optional[str] = None,
) -> IFTIReceipt:
    """
    Generate an immutable IFTI receipt from a transaction (and optionally an IFTI report).
    Commits to DB and returns the saved receipt.
    """
    receipt_ref = _next_receipt_ref(org_code)

    txn_date = (
        txn.transaction_date.date()
        if isinstance(txn.transaction_date, datetime)
        else txn.transaction_date
    )
    direction = (
        txn.direction.value if hasattr(txn.direction, "value") else txn.direction
    )

    receipt = IFTIReceipt(
        org_id=txn.org_id,
        ifti_report_id=ifti_report.id if ifti_report else None,
        transaction_id=txn.id,
        receipt_ref=receipt_ref,
        status=ReceiptStatus.active,
        transfer_date=txn_date,
        direction=direction,
        total_amount=txn.amount,
        currency=txn.currency,
        amount_aud=txn.amount_aud,
        exchange_rate=txn.exchange_rate,
        transfer_reference=txn.reference,
        sender_name=txn.source_account_name,
        sender_account_number=txn.source_account_number,
        sender_bank_name=txn.source_bank_name,
        sender_swift_bic=txn.source_bank_bic,
        sender_iban=txn.source_iban,
        sender_country=txn.source_country,
        beneficiary_name=txn.destination_account_name,
        beneficiary_account_number=txn.destination_account_number,
        beneficiary_bank_name=txn.destination_bank_name,
        beneficiary_swift_bic=txn.destination_bank_bic,
        beneficiary_iban=txn.destination_iban,
        beneficiary_country=txn.destination_country,
        processor_name=processor_name,
        processor_abn=processor_abn,
        processor_austrac_id=processor_austrac_id,
        processor_address=processor_address,
        processor_contact=processor_contact,
        compliance_footer=COMPLIANCE_FOOTER,
        risk_disclaimer=RISK_DISCLAIMER,
        generated_by=generated_by,
    )

    # Compute hash before saving
    receipt.audit_hash = _compute_audit_hash(receipt)

    db.add(receipt)
    db.commit()
    db.refresh(receipt)
    return receipt


def supersede_receipt(
    original_id: str,
    txn: Transaction,
    ifti_report: Optional[IFTIReport],
    generated_by: str,
    void_reason: str,
    db: Session,
    org_code: str = ENTITY_CODE,
    **processor_kwargs,
) -> IFTIReceipt:
    """
    Void the original receipt and issue a corrected one.
    Returns the new (corrected) receipt.
    """
    original = db.query(IFTIReceipt).filter(IFTIReceipt.id == original_id).first()
    if not original:
        raise ValueError(f"Receipt {original_id} not found")
    if original.status != ReceiptStatus.active:
        raise ValueError(f"Receipt {original_id} is already {original.status.value}")

    original.status = ReceiptStatus.voided
    original.voided_at = datetime.now(timezone.utc)
    original.voided_by = generated_by
    original.void_reason = void_reason
    db.add(original)

    new_receipt = generate_ifti_receipt(
        txn=txn,
        ifti_report=ifti_report,
        generated_by=generated_by,
        db=db,
        org_code=org_code,
        **processor_kwargs,
    )
    new_receipt.supersedes_id = original_id
    new_receipt.version = _bump_version(original.version)
    db.add(new_receipt)
    db.commit()
    db.refresh(new_receipt)
    return new_receipt


def verify_receipt_hash(receipt: IFTIReceipt) -> bool:
    """Recompute and compare the audit hash for integrity verification."""
    expected = _compute_audit_hash(receipt)
    return receipt.audit_hash == expected


def _bump_version(version: str) -> str:
    try:
        major, minor = version.split(".")
        return f"{major}.{int(minor) + 1}"
    except Exception:
        return "1.1"
