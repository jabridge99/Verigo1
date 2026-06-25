"""
AUSTRAC Regulatory Reporting Service.

Generates draft IFTI, TTR, and SMR reports from transaction/case data.
All generated drafts require human review and approval before submission.

Statutory deadlines (AML/CTF Act 2006):
  TTR  — 10 business days (~14 calendar) from transaction date
  IFTI — 10 business days (~14 calendar) from instruction date
  SMR  — 3 business days (~4 calendar) from forming suspicion
          24 hours if terrorism-financing related

Reference format: ENTITY-REPORTTYPE-DIRECTION-YYYYMMDD-SEQUENCE
Example: PSPE-IFTI-I-20260615-0001

DISCLAIMER: This service populates draft reports as a compliance workflow tool only.
All decisions to lodge reports with AUSTRAC remain with the reporting entity.
"""

from datetime import date, datetime, timedelta, timezone
from typing import Optional
from uuid import uuid4

from sqlalchemy.orm import Session

from app.models.case import Case
from app.models.customer import Customer
from app.models.organisation import Organisation
from app.models.report import (
    FilingRegisterEntry,
    IFTIDirection,
    IFTIReport,
    ReportPriority,
    ReportStatus,
    ReportType,
    SMRReport,
    TTRReport,
)
from app.models.transaction import Transaction

TTR_DEADLINE_DAYS = 14  # 10 business ≈ 14 calendar
IFTI_DEADLINE_DAYS = 14
SMR_DEADLINE_DAYS = 4  # 3 business ≈ 4 calendar
SMR_TERRORISM_DEADLINE_HOURS = 24
TTR_THRESHOLD_AUD = 10_000.0
_FALLBACK_ENTITY_CODE = "PSPE"


def _org_code(db: Session, org_id: str) -> str:
    """Resolve AUSTRAC entity code from the Organisation record; fall back to PSPE."""
    org = db.query(Organisation).filter(Organisation.id == org_id).first()
    if org and getattr(org, "austrac_id", None):
        # Use first 8 chars of AUSTRAC ID as a safe reference prefix
        return org.austrac_id[:8].upper().replace(" ", "")
    return _FALLBACK_ENTITY_CODE


def _customer_abn(customer: Customer) -> Optional[str]:
    """
    ABN lives on BusinessDetail for companies/trusts, not on Customer directly.
    Returns None gracefully for individual customers.
    """
    bd = getattr(customer, "business_detail", None)
    if bd:
        return getattr(bd, "abn", None)
    return None


def _next_report_ref(
    db: Session, org_code: str, report_type: str, direction: str = ""
) -> str:
    """
    Generate ENTITY-REPORTTYPE-DIRECTION-YYYYMMDD-SEQUENCE reference.
    Uses uuid suffix for collision safety — no DB lock required.
    """
    today = datetime.now(timezone.utc).strftime("%Y%m%d")
    direction_part = f"-{direction}" if direction else ""
    seq = uuid4().hex[:4].upper()
    return f"{org_code}-{report_type}{direction_part}-{today}-{seq}"


def _due_date_from_today(days: int) -> date:
    return (datetime.now(timezone.utc) + timedelta(days=days)).date()


def _priority_from_due(due: date, is_terrorism: bool = False) -> ReportPriority:
    if is_terrorism:
        return ReportPriority.urgent
    days_left = (due - datetime.now(timezone.utc).date()).days
    if days_left <= 1:
        return ReportPriority.urgent
    if days_left <= 3:
        return ReportPriority.high
    if days_left <= 7:
        return ReportPriority.normal
    return ReportPriority.low


# ── IFTI generation ──────────────────────────────────────────────────────────


def generate_ifti_from_transaction(
    txn: Transaction,
    customer: Customer,
    db: Session,
    prepared_by: str,
    org_code: Optional[str] = None,
) -> IFTIReport:
    """
    Populate a draft IFTIReport from transaction data.
    Returns unsaved ORM object — caller must db.add() and db.commit().
    """
    resolved_code = org_code or _org_code(db, txn.org_id)
    direction = (
        IFTIDirection.incoming
        if txn.direction.value == "incoming"
        else IFTIDirection.outgoing
    )
    dir_code = "I" if direction == IFTIDirection.incoming else "O"
    report_ref = _next_report_ref(db, resolved_code, "IFTI", dir_code)
    due = _due_date_from_today(IFTI_DEADLINE_DAYS)

    amount_aud = txn.amount_aud or txn.amount

    report = IFTIReport(
        org_id=txn.org_id,
        customer_id=customer.id,
        transaction_id=txn.id,
        report_ref=report_ref,
        direction=direction,
        status=ReportStatus.draft,
        priority=_priority_from_due(due),
        date_received=txn.transaction_date.date()
        if isinstance(txn.transaction_date, datetime)
        else txn.transaction_date,
        total_amount=txn.amount,
        currency=txn.currency,
        amount_aud=amount_aud,
        exchange_rate=txn.exchange_rate,
        transfer_reference=txn.reference,
        # Ordering Customer from customer record
        oc_name=customer.full_name,
        oc_dob=getattr(customer, "date_of_birth", None),
        oc_address=getattr(customer, "address_line1", None),
        oc_city=getattr(customer, "city", None),
        oc_state=getattr(customer, "state", None),
        oc_postcode=getattr(customer, "postcode", None),
        oc_country=getattr(customer, "country_of_residence", None),
        oc_phone=getattr(customer, "phone", None),
        oc_email=getattr(customer, "email", None),
        oc_occupation=getattr(customer, "occupation", None),
        oc_abn=_customer_abn(customer),
        oc_account_number=txn.source_account_number,
        # Beneficiary from transaction destination fields
        bc_name=txn.destination_account_name,
        bc_account_number=txn.destination_account_number,
        bc_institution_name=txn.destination_bank_name,
        bc_institution_country=txn.destination_country,
        bc_swift_bic=txn.destination_bank_bic,
        bc_iban=txn.destination_iban,
        bc_country=txn.destination_country,
        reason_for_transfer=txn.purpose,
        due_date=due,
        prepared_by=prepared_by,
    )
    return report


# ── TTR generation ───────────────────────────────────────────────────────────


def generate_ttr_from_transaction(
    txn: Transaction,
    customer: Customer,
    db: Session,
    prepared_by: str,
    org_code: Optional[str] = None,
) -> TTRReport:
    """
    Populate a draft TTRReport from transaction data.
    Returns unsaved ORM object — caller must db.add() and db.commit().
    """
    report_ref = _next_report_ref(db, org_code or _org_code(db, txn.org_id), "TTR")
    due = _due_date_from_today(TTR_DEADLINE_DAYS)
    amount_aud = txn.amount_aud or txn.amount

    txn_date = (
        txn.transaction_date.date()
        if isinstance(txn.transaction_date, datetime)
        else txn.transaction_date
    )

    report = TTRReport(
        org_id=txn.org_id,
        customer_id=customer.id,
        transaction_id=txn.id,
        report_ref=report_ref,
        status=ReportStatus.draft,
        priority=_priority_from_due(due),
        transaction_date=txn_date,
        total_amount=amount_aud,
        currency="AUD",
        transaction_type=txn.payment_method.value,
        customer_name=customer.full_name,
        customer_dob=getattr(customer, "date_of_birth", None),
        customer_address=getattr(customer, "address_line1", None),
        customer_occupation=getattr(customer, "occupation", None),
        customer_abn=_customer_abn(customer),
        account_name=txn.source_account_name or txn.destination_account_name,
        account_number=txn.source_account_number or txn.destination_account_number,
        account_bsb=txn.source_bsb or txn.destination_bsb,
        branch_name=txn.source_bank_name,
        due_date=due,
        prepared_by=prepared_by,
    )
    return report


# ── SMR generation ───────────────────────────────────────────────────────────


def generate_smr_from_case(
    case: Case,
    customer: Customer,
    db: Session,
    prepared_by: str,
    suspicion_grounds: str,
    is_terrorism_related: bool = False,
    org_code: Optional[str] = None,
) -> SMRReport:
    """
    Populate a draft SMRReport from a case.
    Returns unsaved ORM object — caller must db.add() and db.commit().

    DISCLAIMER: Grounds for suspicion and the decision to lodge must be
    supplied by the reporting entity. This function pre-populates fields only.
    """
    report_ref = _next_report_ref(db, org_code or _org_code(db, case.org_id), "SMR")
    deadline_days = 1 if is_terrorism_related else SMR_DEADLINE_DAYS
    due = _due_date_from_today(deadline_days)
    priority = (
        ReportPriority.urgent if is_terrorism_related else _priority_from_due(due)
    )

    # Bug fix: Case model has created_at, not opened_at
    case_date = getattr(case, "created_at", None) or datetime.now(timezone.utc)
    matter_date = case_date.date() if isinstance(case_date, datetime) else date.today()

    report = SMRReport(
        org_id=case.org_id,
        customer_id=customer.id,
        case_id=case.id,
        report_ref=report_ref,
        status=ReportStatus.draft,
        priority=priority,
        matter_date=matter_date,
        suspicion_grounds=suspicion_grounds,
        is_terrorism_related=is_terrorism_related,
        subject_name=customer.full_name,
        subject_dob=getattr(customer, "date_of_birth", None),
        subject_address=getattr(customer, "address_line1", None),
        subject_occupation=getattr(customer, "occupation", None),
        subject_abn=_customer_abn(customer),
        due_date=due,
        prepared_by=prepared_by,
    )
    return report


# ── Filing register ──────────────────────────────────────────────────────────


def register_submission(
    db: Session,
    org_id: str,
    report_type: ReportType,
    report_id: str,
    report_ref: str,
    submitted_by: str,
    austrac_submission_ref: Optional[str] = None,
    amount_aud: Optional[float] = None,
    notes: Optional[str] = None,
) -> FilingRegisterEntry:
    """
    Create an immutable FilingRegisterEntry recording that this org marked a
    report as submitted in its local compliance register. This does NOT
    transmit anything to AUSTRAC — no real AUSTRAC provider is wired into the
    submit endpoints (see app/integrations/austrac/, currently unused beyond
    a stub). Callers must treat austrac_submission_ref as self-reported, not
    as confirmation of receipt by AUSTRAC.
    """
    entry = FilingRegisterEntry(
        org_id=org_id,
        report_type=report_type,
        report_id=report_id,
        report_ref=report_ref,
        austrac_submission_ref=austrac_submission_ref,
        submitted_by=submitted_by,
        submitted_at=datetime.now(timezone.utc),
        amount_aud=amount_aud,
        status="submitted",
        notes=notes,
    )
    db.add(entry)
    db.commit()
    db.refresh(entry)
    return entry


# ── Summary ──────────────────────────────────────────────────────────────────


def reporting_summary(db: Session, org_id: str) -> dict:
    """Aggregate counts for the reports dashboard."""
    from sqlalchemy import func

    def _count_by_status(model):
        rows = (
            db.query(model.status, func.count(model.id))
            .filter(model.org_id == org_id)
            .group_by(model.status)
            .all()
        )
        return {str(s): c for s, c in rows}

    ifti_counts = _count_by_status(IFTIReport)
    ttr_counts = _count_by_status(TTRReport)
    smr_counts = _count_by_status(SMRReport)

    today = datetime.now(timezone.utc).date()

    def _overdue(model):
        return (
            db.query(func.count(model.id))
            .filter(
                model.org_id == org_id,
                model.due_date < today,
                model.status.notin_(
                    [ReportStatus.submitted, ReportStatus.acknowledged]
                ),
            )
            .scalar()
        )

    filing_count = (
        db.query(func.count(FilingRegisterEntry.id))
        .filter(FilingRegisterEntry.org_id == org_id)
        .scalar()
    )

    return {
        "ifti": ifti_counts,
        "ttr": ttr_counts,
        "smr": smr_counts,
        "overdue": {
            "ifti": _overdue(IFTIReport),
            "ttr": _overdue(TTRReport),
            "smr": _overdue(SMRReport),
        },
        "total_filed": filing_count,
    }
