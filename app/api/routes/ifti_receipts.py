"""
IFTI Receipt API — generate and manage immutable customer receipts.

Receipts are issued at the time of the IFTI instruction and cannot be
modified. Corrections void the original and issue a new receipt with
a supersedes_id reference chain.

SHA-256 audit hash supports integrity verification at any future point.

DISCLAIMER: These receipts are compliance workflow documents only.
They do not constitute reports to AUSTRAC or any regulator.
"""
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session

from app.api.deps import (
    Pagination,
    get_current_user,
    org_id_for,
    require_analyst_or_above,
    require_compliance_or_above,
)
from app.db.database import get_db
from app.models.ifti_receipt import IFTIReceipt, ReceiptStatus
from app.models.report import IFTIReport
from app.models.transaction import Transaction
from app.models.user import User
from app.services.ifti_receipt_service import (
    generate_ifti_receipt,
    supersede_receipt,
    verify_receipt_hash,
)

router = APIRouter(prefix="/ifti-receipts", tags=["IFTI Receipts"])


def _get_receipt_or_404(receipt_id: str, org_id: str, db: Session) -> IFTIReceipt:
    r = db.query(IFTIReceipt).filter(
        IFTIReceipt.id == receipt_id, IFTIReceipt.org_id == org_id
    ).first()
    if not r:
        raise HTTPException(404, "IFTI receipt not found.")
    return r


@router.get("")
def list_receipts(
    transaction_id: Optional[str] = Query(None),
    status: Optional[ReceiptStatus] = Query(None),
    pagination: Pagination = Depends(),
    db: Session = Depends(get_db),
    current_user: User = Depends(require_analyst_or_above),
):
    org_id = org_id_for(current_user)
    q = db.query(IFTIReceipt).filter(IFTIReceipt.org_id == org_id)
    if transaction_id:
        q = q.filter(IFTIReceipt.transaction_id == transaction_id)
    if status:
        q = q.filter(IFTIReceipt.status == status)
    q = q.order_by(IFTIReceipt.created_at.desc())
    return [_receipt_dict(r) for r in pagination.apply(q).all()]


@router.get("/by-transaction/{txn_id}")
def get_receipts_for_transaction(
    txn_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_analyst_or_above),
):
    org_id = org_id_for(current_user)
    receipts = db.query(IFTIReceipt).filter(
        IFTIReceipt.org_id == org_id,
        IFTIReceipt.transaction_id == txn_id,
    ).order_by(IFTIReceipt.created_at.desc()).all()
    return [_receipt_dict(r) for r in receipts]


@router.post("/generate/{txn_id}", status_code=status.HTTP_201_CREATED)
def generate_receipt(
    txn_id: str,
    ifti_report_id: Optional[str] = Query(None),
    processor_name: Optional[str] = None,
    processor_abn: Optional[str] = None,
    processor_austrac_id: Optional[str] = None,
    processor_address: Optional[str] = None,
    processor_contact: Optional[str] = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_compliance_or_above),
):
    """
    Generate an immutable IFTI receipt for a cross-border transaction.
    The audit hash is computed and stored at generation time.
    """
    org_id = org_id_for(current_user)
    txn = db.query(Transaction).filter(
        Transaction.id == txn_id, Transaction.org_id == org_id
    ).first()
    if not txn:
        raise HTTPException(404, "Transaction not found.")
    if not txn.is_cross_border:
        raise HTTPException(422, "IFTI receipts are for cross-border transactions only.")

    ifti_report = None
    if ifti_report_id:
        ifti_report = db.query(IFTIReport).filter(
            IFTIReport.id == ifti_report_id, IFTIReport.org_id == org_id
        ).first()
        if not ifti_report:
            raise HTTPException(404, "IFTI report not found.")

    receipt = generate_ifti_receipt(
        txn=txn,
        ifti_report=ifti_report,
        generated_by=current_user.id,
        db=db,
        processor_name=processor_name,
        processor_abn=processor_abn,
        processor_austrac_id=processor_austrac_id,
        processor_address=processor_address,
        processor_contact=processor_contact,
    )
    return _receipt_dict(receipt)


@router.get("/{receipt_id}")
def get_receipt(
    receipt_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_analyst_or_above),
):
    return _receipt_dict(_get_receipt_or_404(receipt_id, org_id_for(current_user), db))


@router.get("/{receipt_id}/audit-verify")
def verify_receipt_integrity(
    receipt_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_analyst_or_above),
):
    """
    Recompute the SHA-256 audit hash and compare against the stored value.
    Returns whether the receipt content has been tampered with since issuance.
    """
    r = _get_receipt_or_404(receipt_id, org_id_for(current_user), db)
    is_valid = verify_receipt_hash(r)
    return {
        "receipt_id": receipt_id,
        "receipt_ref": r.receipt_ref,
        "stored_hash": r.audit_hash,
        "integrity_verified": is_valid,
        "status": r.status.value,
        "generated_by": r.generated_by,
        "created_at": r.created_at,
    }


@router.post("/{receipt_id}/supersede", status_code=status.HTTP_201_CREATED)
def supersede_existing_receipt(
    receipt_id: str,
    txn_id: str,
    void_reason: str,
    ifti_report_id: Optional[str] = Query(None),
    processor_name: Optional[str] = None,
    processor_abn: Optional[str] = None,
    processor_austrac_id: Optional[str] = None,
    processor_address: Optional[str] = None,
    processor_contact: Optional[str] = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_compliance_or_above),
):
    """
    Void the original receipt and issue a corrected one.
    The original is marked voided with a reason; the new receipt references it via supersedes_id.
    """
    org_id = org_id_for(current_user)
    _get_receipt_or_404(receipt_id, org_id, db)  # ensure belongs to org

    txn = db.query(Transaction).filter(
        Transaction.id == txn_id, Transaction.org_id == org_id
    ).first()
    if not txn:
        raise HTTPException(404, "Transaction not found.")

    ifti_report = None
    if ifti_report_id:
        ifti_report = db.query(IFTIReport).filter(
            IFTIReport.id == ifti_report_id, IFTIReport.org_id == org_id
        ).first()

    try:
        new_receipt = supersede_receipt(
            original_id=receipt_id,
            txn=txn,
            ifti_report=ifti_report,
            generated_by=current_user.id,
            void_reason=void_reason,
            db=db,
            processor_name=processor_name,
            processor_abn=processor_abn,
            processor_austrac_id=processor_austrac_id,
            processor_address=processor_address,
            processor_contact=processor_contact,
        )
    except ValueError as e:
        raise HTTPException(409, str(e))

    return _receipt_dict(new_receipt)


def _receipt_dict(r: IFTIReceipt) -> dict:
    return {
        "id": r.id,
        "receipt_ref": r.receipt_ref,
        "version": r.version,
        "status": r.status.value if r.status else None,
        "transaction_id": r.transaction_id,
        "ifti_report_id": r.ifti_report_id,
        "transfer_date": r.transfer_date,
        "direction": r.direction,
        "total_amount": r.total_amount,
        "currency": r.currency,
        "amount_aud": r.amount_aud,
        "exchange_rate": r.exchange_rate,
        "transfer_reference": r.transfer_reference,
        "sender_name": r.sender_name,
        "sender_country": r.sender_country,
        "beneficiary_name": r.beneficiary_name,
        "beneficiary_country": r.beneficiary_country,
        "processor_name": r.processor_name,
        "processor_abn": r.processor_abn,
        "audit_hash": r.audit_hash,
        "generated_by": r.generated_by,
        "supersedes_id": r.supersedes_id,
        "created_at": r.created_at,
        "compliance_footer": r.compliance_footer,
        "risk_disclaimer": r.risk_disclaimer,
    }
