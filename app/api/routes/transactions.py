"""
Transaction API — bank-grade AML/CTF transaction register.

Roles:
  POST /transactions — analyst+
  GET  /transactions — analyst+
  GET  /transactions/{id} — analyst+
  PATCH /transactions/{id} — compliance+
  POST /transactions/{id}/run-monitoring — compliance+
  GET  /transactions/{id}/receipt — analyst+  (full receipt for reporting)
  GET  /transactions/{id}/summary — analyst+  (lightweight summary)
  POST /transactions/batch — analyst+  (programmatic/API-key batch ingestion, P27)
  GET  /transactions/import/template — analyst+
  GET  /transactions/import/field-guide — analyst+
  POST /transactions/import/upload — compliance+  (CSV/Excel batch ingestion, P27)

P27 note: a single transaction can already be pushed programmatically
today via POST /transactions with an X-API-Key header (app/api/deps.py's
get_current_user accepts either a user JWT or an org API key) — the gap
this file's batch/import endpoints close is the lack of any *batch* path,
which is what a real core-banking/payments feed or a one-off bulk upload
actually needs. A true inbound webhook receiver (a third-party system
pushing to VeriGo on its own schedule, vs. VeriGo's existing outbound
webhooks in app/api/routes/webhooks.py) and a per-vendor core-banking
connector remain out of scope here — see PARKING_LOT.md, P27.
"""

import logging
from datetime import datetime, timezone
from typing import Optional
from uuid import uuid4

from fastapi import APIRouter, Depends, File, HTTPException, Query, UploadFile, status
from pydantic import ValidationError
from sqlalchemy.orm import Session

from app.api.deps import (
    Pagination,
    org_id_for,
    require_analyst_or_above,
    require_compliance_or_above,
)
from app.db.database import get_db
from app.models.case import Case, CaseAlert
from app.models.customer import Customer
from app.models.monitoring import TransactionAlert
from app.models.regulatory_recommendation import (
    RecommendationStatus,
    RegulatoryRecommendation,
)
from app.models.risk_matrix import (
    OrgApprovalQuestion,
    OrgMonitoringConfig,
    TransactionQuestionResponse,
)
from app.models.transaction import (
    Transaction,
    TransactionCryptoDetail,
    TransactionStatus,
)
from app.models.user import User
from app.schemas.risk_matrix import AnswerQuestionsRequest, QuestionAnswerItem
from app.schemas.transaction import (
    TransactionBatchItem,
    TransactionBatchRequest,
    TransactionCreate,
    TransactionListOut,
    TransactionOut,
    TransactionUpdate,
)
from app.schemas.transaction_receipt import TransactionReceipt, build_receipt
from app.services.audit_service import log_action
from app.services.monitoring_engine import run_monitoring
from app.services.risk_engine import TTR_CTR_THRESHOLD_AUD
from app.services.risk_matrix_service import (
    compute_final_approval_score,
    compute_question_score,
)

router = APIRouter(prefix="/transactions", tags=["Transactions"])
log = logging.getLogger("verigo.api.transactions")


def _get_transaction_or_404(txn_id: str, org_id: str, db: Session) -> Transaction:
    txn = (
        db.query(Transaction)
        .filter(
            Transaction.id == txn_id,
            Transaction.org_id == org_id,
        )
        .first()
    )
    if not txn:
        raise HTTPException(status_code=404, detail="Transaction not found.")
    return txn


@router.post("", response_model=TransactionOut, status_code=status.HTTP_201_CREATED)
def create_transaction(
    payload: TransactionCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_analyst_or_above),
):
    """Record a new transaction. Automatically runs the monitoring engine against it."""
    org_id = org_id_for(current_user)

    # Verify customer belongs to org
    customer = (
        db.query(Customer)
        .filter(
            Customer.id == payload.customer_id,
            Customer.org_id == org_id,
        )
        .first()
    )
    if not customer:
        raise HTTPException(status_code=404, detail="Customer not found.")

    # Check for duplicate ref
    existing = (
        db.query(Transaction)
        .filter(
            Transaction.transaction_ref == payload.transaction_ref,
            Transaction.org_id == org_id,
        )
        .first()
    )
    if existing:
        raise HTTPException(
            status_code=409, detail="Transaction reference already exists."
        )

    txn = Transaction(
        id=f"txn_{uuid4().hex[:12]}",
        org_id=org_id,
        created_by=current_user.id,
        **payload.model_dump(exclude={"crypto_detail"}),
    )
    db.add(txn)

    if payload.crypto_detail:
        crypto = TransactionCryptoDetail(
            id=f"cdet_{uuid4().hex[:10]}",
            transaction_id=txn.id,
            org_id=org_id,
            **payload.crypto_detail.model_dump(),
        )
        db.add(crypto)

    db.commit()
    db.refresh(txn)

    from app.models.automation_rule import RuleEventType
    from app.services.automation_engine import (
        evaluate_automation_rules,
        transaction_context,
    )

    evaluate_automation_rules(
        db,
        RuleEventType.transaction_created,
        org_id,
        "transaction",
        txn.id,
        transaction_context(txn),
        triggered_by=current_user.id,
    )

    # Real monitoring pipeline (MonitoringRule + behaviour-signal scoring --
    # distinct from the automation rules above). Was never actually called
    # here despite this route's own /run-monitoring sibling endpoint
    # docstring claiming it happens "automatically...in production" --
    # every transaction sat unscored unless something separately called
    # that endpoint afterward.
    run_monitoring(txn, customer, db)
    db.commit()

    log_action(
        db,
        action="transaction_recorded",
        entity_type="transaction",
        entity_id=txn.id,
        actor=current_user.email,
        actor_role=current_user.role.value if current_user.role else None,
        organisation_id=org_id,
        after_state={
            "transaction_ref": txn.transaction_ref,
            "amount": str(txn.amount),
            "currency": txn.currency,
            "customer_id": txn.customer_id,
        },
    )

    return txn


# ── Batch / bulk ingestion (P27) ────────────────────────────────────────────


def _ingest_batch_item(
    db: Session,
    org_id: str,
    item: TransactionBatchItem,
    current_user: User,
    seen_refs: set,
) -> dict:
    """
    Create one Transaction from a batch/import row, running it through the
    same monitoring + automation pipeline as POST /transactions so an
    ingested transaction is treated identically to a manually-entered one.

    Never raises for expected failure modes (missing customer, duplicate
    ref) -- returns a dict with outcome in {"created","skipped","error"}
    so the caller can process every row in a batch even when some fail
    (partial-failure semantics), and so the same transaction_ref can be
    re-submitted safely after a failed/partial batch (idempotent retry).
    """
    ref = item.transaction_ref

    if ref in seen_refs:
        return {
            "outcome": "skipped",
            "transaction_ref": ref,
            "reason": "Duplicate transaction_ref within this batch",
        }

    customer = None
    if item.customer_id:
        customer = (
            db.query(Customer)
            .filter(Customer.id == item.customer_id, Customer.org_id == org_id)
            .first()
        )
    if not customer and item.customer_ref:
        customer = (
            db.query(Customer)
            .filter(
                Customer.customer_ref == item.customer_ref, Customer.org_id == org_id
            )
            .first()
        )
    if not customer:
        identifier = item.customer_id or item.customer_ref or "(none given)"
        return {
            "outcome": "error",
            "transaction_ref": ref,
            "reason": f"Customer '{identifier}' not found in this organisation",
        }

    existing = (
        db.query(Transaction)
        .filter(Transaction.transaction_ref == ref, Transaction.org_id == org_id)
        .first()
    )
    if existing:
        seen_refs.add(ref)
        return {
            "outcome": "skipped",
            "transaction_ref": ref,
            "reason": f"Transaction reference already exists (id: {existing.id})",
        }

    payload_dict = item.model_dump(
        exclude={"crypto_detail", "customer_ref", "customer_id"}
    )
    txn = Transaction(
        id=f"txn_{uuid4().hex[:12]}",
        org_id=org_id,
        customer_id=customer.id,
        created_by=current_user.id,
        **payload_dict,
    )
    db.add(txn)

    if item.crypto_detail:
        crypto = TransactionCryptoDetail(
            id=f"cdet_{uuid4().hex[:10]}",
            transaction_id=txn.id,
            org_id=org_id,
            **item.crypto_detail.model_dump(),
        )
        db.add(crypto)

    db.flush()
    seen_refs.add(ref)

    from app.models.automation_rule import RuleEventType
    from app.services.automation_engine import (
        evaluate_automation_rules,
        transaction_context,
    )

    evaluate_automation_rules(
        db,
        RuleEventType.transaction_created,
        org_id,
        "transaction",
        txn.id,
        transaction_context(txn),
        triggered_by=current_user.id,
    )

    alerts = run_monitoring(txn, customer, db)

    log_action(
        db,
        action="transaction_recorded",
        entity_type="transaction",
        entity_id=txn.id,
        actor=current_user.email,
        actor_role=current_user.role.value if current_user.role else None,
        organisation_id=org_id,
        after_state={
            "transaction_ref": txn.transaction_ref,
            "amount": str(txn.amount),
            "currency": txn.currency,
            "customer_id": txn.customer_id,
            "ingested_via": "batch",
        },
    )

    return {
        "outcome": "created",
        "transaction_ref": ref,
        "transaction_id": txn.id,
        "customer_id": customer.id,
        "alerts_generated": len(alerts),
    }


_INGEST_DISCLAIMER = (
    "Ingested transactions are run through the same monitoring engine as "
    "manually-entered ones. Alerts generated are indicators for human "
    "review only. No alert or import outcome constitutes a finding of "
    "suspicious activity or criminal conduct. All regulatory decisions "
    "remain with the reporting entity."
)


@router.post("/batch", status_code=status.HTTP_200_OK)
def batch_create_transactions(
    payload: TransactionBatchRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_analyst_or_above),
):
    """
    Programmatic bulk transaction ingestion — up to 500 transactions per
    call. Intended for a core-banking/payments feed or any system pushing
    transaction volume into VeriGo on a schedule (authenticate with an
    org API key via the X-API-Key header, or a user JWT).

    Each item identifies its customer via customer_id or customer_ref
    (the customer must already exist — this endpoint does not create
    customers). Re-submitting a transaction_ref that already exists is a
    safe no-op (reported under 'skipped'), so a failed or partial batch
    can be safely retried in full.

    One bad row (unknown customer, duplicate ref) never aborts the whole
    batch — every row is attempted and reported individually.
    """
    org_id = org_id_for(current_user)
    seen_refs: set = set()
    created, skipped, errors = [], [], []

    for item in payload.transactions:
        result = _ingest_batch_item(db, org_id, item, current_user, seen_refs)
        if result["outcome"] == "created":
            created.append(result)
        elif result["outcome"] == "skipped":
            skipped.append(result)
        else:
            errors.append(result)

    db.commit()

    return {
        "status": "complete",
        "submitted": len(payload.transactions),
        "created": len(created),
        "skipped": len(skipped),
        "errors": len(errors),
        "created_transactions": created,
        "skipped_transactions": skipped,
        "error_transactions": errors,
        "disclaimer": _INGEST_DISCLAIMER,
    }


@router.get("/import/template")
def download_transaction_import_template(
    current_user: User = Depends(require_analyst_or_above),
):
    """
    Download the transaction bulk import CSV template.

    The template contains:
      - Row 1: Column headers (canonical field names)
      - Row 2: Field descriptions (prefixed with # — skipped on import)
      - Row 3: Domestic transfer example
      - Row 4: Cross-border transfer example

    All # prefixed rows are ignored during import. Column headers are
    alias-tolerant — common variations accepted.

    After filling in the template, upload via:
      POST /api/v1/transactions/import/upload

    Every row's customer_ref must match an existing customer's
    customer_ref (see GET /customers/) — this template does not create
    customers.
    """
    from fastapi.responses import Response

    from app.services.transaction_bulk_import import generate_csv_template

    content = generate_csv_template()
    return Response(
        content=content,
        media_type="text/csv",
        headers={
            "Content-Disposition": 'attachment; filename="verigo_transaction_import_template.csv"'
        },
    )


@router.get("/import/field-guide")
def transaction_import_field_guide(
    current_user: User = Depends(require_analyst_or_above),
):
    """
    Returns the full field guide for the transaction import template.
    Includes accepted aliases, examples, and field descriptions.
    """
    from app.services.transaction_bulk_import import get_template_field_guide

    return {
        "total_fields": len(get_template_field_guide()),
        "fields": get_template_field_guide(),
        "notes": [
            "Rows prefixed with # in any column are treated as comments and skipped",
            "customer_ref must match an existing customer — this import does not create customers",
            "Re-uploading a file containing a transaction_ref already imported is a safe no-op "
            "(that row is skipped, not duplicated) — safe to retry a failed or partial upload",
            "Every created transaction is run through the same monitoring engine as a "
            "manually-entered one",
            "Column headers are alias-tolerant — see 'accepted_aliases' for each field",
        ],
    }


@router.post("/import/upload")
async def bulk_import_transactions(
    file: UploadFile = File(
        ..., description="CSV or Excel (.xlsx) transaction import file"
    ),
    current_user: User = Depends(require_compliance_or_above),
    db: Session = Depends(get_db),
):
    """
    Bulk import transactions from a CSV or Excel (.xlsx) file — for a
    one-off upload (e.g. a bank statement export) rather than a
    programmatic feed (see POST /transactions/batch for that).

    Accepted formats:
      - text/csv — UTF-8 or Latin-1 encoded
      - application/vnd.openxmlformats-officedocument.spreadsheetml.sheet (.xlsx)
      - application/octet-stream (auto-detected by extension)

    Processing:
      1. Parse file → validate each row (required fields, valid enum
         values, parseable amount/date)
      2. Resolve each row's customer_ref against an existing customer
      3. Skip rows whose transaction_ref already exists (safe retry)
      4. Create Transaction records and run the monitoring engine
      5. Return import summary with created/skipped/error detail

    DISCLAIMER: Imported transactions are run through the same monitoring
    engine as manually-entered ones. Alerts generated are indicators for
    human review only. All regulatory decisions remain with the
    reporting entity.
    """
    from app.services.transaction_bulk_import import parse_csv, parse_excel

    if file is None:
        raise HTTPException(
            422,
            "No file uploaded. Provide a CSV or Excel file as multipart form-data field 'file'.",
        )

    filename = file.filename or ""
    content = await file.read()

    if not content:
        raise HTTPException(422, "Uploaded file is empty")

    ext = filename.lower().rsplit(".", 1)[-1] if "." in filename else ""
    content_type = file.content_type or ""

    if ext in ("xlsx", "xls") or "spreadsheet" in content_type:
        try:
            rows, warnings, parse_errors = parse_excel(content)
        except ImportError:
            raise HTTPException(
                500, "Excel support requires openpyxl — contact your administrator"
            )
    elif ext == "csv" or "csv" in content_type or "text" in content_type:
        rows, warnings, parse_errors = parse_csv(content)
    else:
        rows, warnings, parse_errors = parse_csv(content)

    if not rows and parse_errors:
        return {
            "status": "failed",
            "message": "No valid rows found in file",
            "errors": parse_errors,
            "warnings": warnings,
            "created": 0,
            "skipped": 0,
        }

    org_id = org_id_for(current_user)
    seen_refs: set = set()
    created, skipped, errors = [], [], []

    for i, row in enumerate(rows):
        try:
            kwargs: dict = {
                "transaction_ref": row.get("transaction_ref"),
                "customer_ref": row.get("customer_ref"),
                "transaction_type": row.get("transaction_type", "").lower(),
                "direction": row.get("direction", "").lower(),
                "payment_method": row.get("payment_method", "").lower(),
                "amount": float(row.get("amount", 0) or 0),
                "transaction_date": row.get("transaction_date"),
            }
            if row.get("delivery_channel"):
                kwargs["delivery_channel"] = row["delivery_channel"].lower()
            if row.get("currency"):
                kwargs["currency"] = row["currency"].upper()
            if row.get("amount_aud"):
                kwargs["amount_aud"] = float(row["amount_aud"])
            if row.get("is_cross_border"):
                kwargs["is_cross_border"] = row["is_cross_border"].strip().lower() in (
                    "true",
                    "1",
                    "yes",
                    "y",
                )
            if row.get("source_country"):
                kwargs["source_country"] = row["source_country"].upper()
            if row.get("destination_country"):
                kwargs["destination_country"] = row["destination_country"].upper()
            for field in (
                "purpose",
                "description",
                "reference",
                "customer_reference",
                "source_account_name",
                "source_account_number",
                "source_bsb",
                "source_bank_name",
                "destination_account_name",
                "destination_account_number",
                "destination_bsb",
                "destination_bank_name",
                "merchant_name",
                "counterparty_name",
                "counterparty_type",
            ):
                if row.get(field):
                    kwargs[field] = row[field]

            item = TransactionBatchItem(**kwargs)
        except ValidationError as e:
            errors.append(
                f"Row {i + 2}: {row.get('transaction_ref', '(no ref)')}: {e.errors()[0]['msg']}"
            )
            continue

        result = _ingest_batch_item(db, org_id, item, current_user, seen_refs)
        if result["outcome"] == "created":
            created.append(result)
        elif result["outcome"] == "skipped":
            skipped.append(result)
        else:
            errors.append(f"Row {i + 2}: {result['reason']}")

    db.commit()

    all_errors = parse_errors + errors

    log.info(
        "transaction_bulk_import.complete org=%s created=%d skipped=%d errors=%d by=%s",
        org_id,
        len(created),
        len(skipped),
        len(all_errors),
        current_user.id,
    )

    return {
        "status": "complete",
        "file": filename,
        "rows_parsed": len(rows),
        "created": len(created),
        "skipped": len(skipped),
        "error_count": len(all_errors),
        "created_transactions": created,
        "skipped_rows": skipped,
        "errors": all_errors,
        "warnings": warnings,
        "disclaimer": _INGEST_DISCLAIMER,
    }


@router.get("", response_model=list[TransactionListOut])
def list_transactions(
    customer_id: Optional[str] = Query(None),
    status: Optional[TransactionStatus] = Query(None),
    is_cross_border: Optional[bool] = Query(None),
    min_amount_aud: Optional[float] = Query(None),
    from_date: Optional[datetime] = Query(None),
    to_date: Optional[datetime] = Query(None),
    pagination: Pagination = Depends(),
    db: Session = Depends(get_db),
    current_user: User = Depends(require_analyst_or_above),
):
    org_id = org_id_for(current_user)
    q = db.query(Transaction).filter(Transaction.org_id == org_id)

    if customer_id:
        q = q.filter(Transaction.customer_id == customer_id)
    if status:
        q = q.filter(Transaction.status == status)
    if is_cross_border is not None:
        q = q.filter(Transaction.is_cross_border == is_cross_border)
    if min_amount_aud is not None:
        q = q.filter(Transaction.amount_aud >= min_amount_aud)
    if from_date:
        q = q.filter(Transaction.transaction_date >= from_date)
    if to_date:
        q = q.filter(Transaction.transaction_date <= to_date)

    q = q.order_by(Transaction.transaction_date.desc())
    return pagination.apply(q).all()


@router.get("/{txn_id}", response_model=TransactionOut)
def get_transaction(
    txn_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_analyst_or_above),
):
    return _get_transaction_or_404(txn_id, org_id_for(current_user), db)


@router.patch("/{txn_id}", response_model=TransactionOut)
def update_transaction(
    txn_id: str,
    payload: TransactionUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_compliance_or_above),
):
    """Update non-risk fields. Risk fields are engine-only and cannot be patched."""
    org_id = org_id_for(current_user)
    txn = _get_transaction_or_404(txn_id, org_id, db)

    if txn.status == TransactionStatus.completed:
        raise HTTPException(
            status_code=409,
            detail="Completed transactions are immutable.",
        )

    changed_fields = payload.model_dump(exclude_none=True)
    for k, v in changed_fields.items():
        setattr(txn, k, v)

    txn.updated_at = datetime.now(timezone.utc)
    db.commit()
    db.refresh(txn)
    log_action(
        db,
        action="transaction_updated",
        entity_type="transaction",
        entity_id=txn.id,
        actor=current_user.email,
        actor_role=current_user.role.value if current_user.role else None,
        organisation_id=org_id,
        after_state={k: str(v) for k, v in changed_fields.items()},
    )
    return txn


@router.post("/{txn_id}/run-monitoring", status_code=status.HTTP_200_OK)
def run_monitoring_on_transaction(
    txn_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_compliance_or_above),
):
    """
    Manually trigger the monitoring engine against a specific transaction.
    This runs automatically on transaction creation (POST /transactions);
    this endpoint supports re-evaluation and backfill use cases (e.g. after
    a rule is edited, or for transactions imported before this existed).

    DISCLAIMER: Alerts generated are indicators for human review only.
    """
    org_id = org_id_for(current_user)
    txn = _get_transaction_or_404(txn_id, org_id, db)

    customer = (
        db.query(Customer)
        .filter(
            Customer.id == txn.customer_id,
            Customer.org_id == org_id,
        )
        .first()
    )
    if not customer:
        raise HTTPException(status_code=404, detail="Customer not found.")

    alerts = run_monitoring(txn, customer, db)
    db.commit()

    return {
        "transaction_id": txn_id,
        "alerts_generated": len(alerts),
        "alert_ids": [a.id for a in alerts],
        "disclaimer": (
            "Alerts are generated for human review only. "
            "No alert constitutes a finding of suspicious activity or criminal conduct."
        ),
    }


@router.get("/{txn_id}/receipt", response_model=TransactionReceipt)
def get_transaction_receipt(
    txn_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_analyst_or_above),
):
    """
    Full transaction receipt — includes all AML flags, linked alerts, linked cases,
    crypto screening detail, customer snapshot, and the AUSTRAC reporting block.

    Use this endpoint to:
    - Print or export a transaction record for compliance files
    - Pre-populate AUSTRAC report forms (TTR, IFTI, SMR supplementary)
    - Attach to case files as evidence

    DISCLAIMER: This receipt is a structured compliance workflow document.
    It does not constitute a report to AUSTRAC or any regulator.
    """
    org_id = org_id_for(current_user)
    txn = _get_transaction_or_404(txn_id, org_id, db)

    customer = (
        db.query(Customer)
        .filter(
            Customer.id == txn.customer_id,
            Customer.org_id == org_id,
        )
        .first()
    )
    if not customer:
        raise HTTPException(status_code=404, detail="Customer not found.")

    # Load all alerts linked to this transaction
    alerts = (
        db.query(TransactionAlert)
        .filter(
            TransactionAlert.transaction_id == txn_id,
            TransactionAlert.org_id == org_id,
        )
        .order_by(TransactionAlert.trigger_date.desc())
        .all()
    )

    # Load all cases linked via CaseAlert
    case_ids = (
        db.query(CaseAlert.case_id)
        .filter(
            CaseAlert.transaction_id == txn_id,
        )
        .distinct()
        .all()
    )
    case_ids_list = [r[0] for r in case_ids]

    # Also get cases linked via alert
    alert_ids = [a.id for a in alerts]
    if alert_ids:
        alert_case_ids = (
            db.query(CaseAlert.case_id)
            .filter(
                CaseAlert.alert_id.in_(alert_ids),
            )
            .distinct()
            .all()
        )
        case_ids_list = list(set(case_ids_list + [r[0] for r in alert_case_ids]))

    cases = []
    if case_ids_list:
        cases = (
            db.query(Case)
            .filter(
                Case.id.in_(case_ids_list),
                Case.org_id == org_id,
            )
            .all()
        )

    return build_receipt(txn, customer, alerts, cases, generated_by=current_user.id)


@router.get("/{txn_id}/summary")
def get_transaction_summary(
    txn_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_analyst_or_above),
):
    """
    Lightweight transaction summary — key fields, AML flags, and alert/case counts.
    Suitable for display in dashboards and list views.
    """
    org_id = org_id_for(current_user)
    txn = _get_transaction_or_404(txn_id, org_id, db)

    alert_count = (
        db.query(TransactionAlert)
        .filter(
            TransactionAlert.transaction_id == txn_id,
            TransactionAlert.org_id == org_id,
        )
        .count()
    )

    open_alert_count = (
        db.query(TransactionAlert)
        .filter(
            TransactionAlert.transaction_id == txn_id,
            TransactionAlert.org_id == org_id,
            TransactionAlert.status.notin_(["dismissed", "resolved"]),
        )
        .count()
    )

    smr_candidate_count = (
        db.query(TransactionAlert)
        .filter(
            TransactionAlert.transaction_id == txn_id,
            TransactionAlert.org_id == org_id,
            TransactionAlert.is_smr_candidate == True,
        )
        .count()
    )

    amount_aud = txn.amount_aud or txn.amount
    TTR_THRESHOLD = TTR_CTR_THRESHOLD_AUD

    return {
        "transaction_id": txn.id,
        "transaction_ref": txn.transaction_ref,
        "transaction_date": txn.transaction_date,
        "transaction_type": txn.transaction_type.value,
        "direction": txn.direction.value,
        "payment_method": txn.payment_method.value,
        "status": txn.status.value,
        "currency": txn.currency,
        "amount": txn.amount,
        "amount_aud": amount_aud,
        "is_cross_border": txn.is_cross_border,
        "source_country": txn.source_country,
        "destination_country": txn.destination_country,
        "counterparty_name": txn.counterparty_name,
        "aml_flags": {
            "is_near_threshold": txn.is_near_threshold,
            "is_round_number": txn.is_round_number,
            "is_structuring_suspect": txn.is_structuring_suspect,
            "is_cash_intensive": txn.is_cash_intensive,
            "is_ttr_reportable": amount_aud >= TTR_THRESHOLD,
            "is_ifti_reportable": txn.is_cross_border,
        },
        "risk_score": txn.risk_score,
        "behaviour_score": txn.behaviour_score,
        "alert_count": alert_count,
        "open_alert_count": open_alert_count,
        "smr_candidate_count": smr_candidate_count,
        "customer_id": txn.customer_id,
        "disclaimer": (
            "This summary is for compliance workflow support only. "
            "It does not constitute a report to AUSTRAC or any regulator."
        ),
    }


@router.get("/{txn_id}/recommendations")
def get_transaction_recommendations(
    txn_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_analyst_or_above),
):
    """
    Regulatory decision support recommendations for this transaction.
    Generated automatically after monitoring runs — surfaces what the compliance
    officer should consider next based on transaction signals, customer risk,
    and alert outputs.

    DISCLAIMER: Recommendations are compliance workflow guidance only.
    The reporting entity bears sole responsibility for all regulatory decisions.
    """
    org_id = org_id_for(current_user)
    _get_transaction_or_404(txn_id, org_id, db)  # 404 if not found or wrong org

    recs = (
        db.query(RegulatoryRecommendation)
        .filter(
            RegulatoryRecommendation.transaction_id == txn_id,
            RegulatoryRecommendation.org_id == org_id,
        )
        .order_by(RegulatoryRecommendation.created_at.desc())
        .all()
    )

    return {
        "transaction_id": txn_id,
        "recommendation_count": len(recs),
        "pending_count": sum(
            1 for r in recs if r.status == RecommendationStatus.pending
        ),
        "recommendations": [
            {
                "id": r.id,
                "recommendation_type": r.recommendation_type.value,
                "priority": r.priority.value,
                "status": r.status.value,
                "title": r.title,
                "recommendation_text": r.recommendation_text,
                "regulatory_basis": r.regulatory_basis,
                "rationale": r.rationale,
                "alert_id": r.alert_id,
                "actioned_by": r.actioned_by,
                "actioned_at": r.actioned_at,
                "created_at": r.created_at,
            }
            for r in recs
        ],
        "disclaimer": (
            "Recommendations are compliance workflow guidance only. "
            "The reporting entity bears sole responsibility for all regulatory decisions."
        ),
    }


# ── Pre-Approval Question Checklist ───────────────────────────────────────────


@router.get("/{txn_id}/approval-checklist")
def get_approval_checklist(
    txn_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_compliance_or_above),
):
    """
    Return the org's pre-approval checklist questions and any existing answers
    for this transaction, plus the computed final approval score.

    The checklist is answered before approving/resolving a transaction.
    The question_score contributes custom_question_weight % of the final score.

    DISCLAIMER: Approval scores support the compliance workflow only.
    All regulatory decisions remain with the reporting entity.
    """
    org_id = org_id_for(current_user)
    txn = _get_transaction_or_404(txn_id, org_id, db)

    questions = (
        db.query(OrgApprovalQuestion)
        .filter(
            OrgApprovalQuestion.org_id == org_id,
            OrgApprovalQuestion.is_active == True,
        )
        .order_by(OrgApprovalQuestion.question_order)
        .all()
    )

    responses = (
        db.query(TransactionQuestionResponse)
        .filter(
            TransactionQuestionResponse.transaction_id == txn_id,
            TransactionQuestionResponse.org_id == org_id,
        )
        .all()
    )
    response_map = {r.question_id: r for r in responses}

    config = (
        db.query(OrgMonitoringConfig)
        .filter(OrgMonitoringConfig.org_id == org_id)
        .first()
    )
    q_weight = getattr(config, "custom_question_weight", 0.20) if config else 0.20

    # Get the latest alert score for this transaction
    from app.models.monitoring import TransactionAlert

    latest_alert = (
        db.query(TransactionAlert)
        .filter(
            TransactionAlert.transaction_id == txn_id,
            TransactionAlert.org_id == org_id,
        )
        .order_by(TransactionAlert.trigger_date.desc())
        .first()
    )
    base_alert_score = (latest_alert.alert_score if latest_alert else 0.0) or 0.0
    risk_matrix_score = (
        getattr(latest_alert, "risk_matrix_score", None) if latest_alert else None
    )
    risk_matrix_level = (
        getattr(latest_alert, "risk_matrix_level", None) if latest_alert else None
    )

    question_score = compute_question_score(responses) if responses else None
    final_score, score_detail = compute_final_approval_score(
        base_alert_score, question_score, q_weight
    )

    items = []
    for q in questions:
        r = response_map.get(q.id)
        items.append(
            {
                "question_id": q.id,
                "question_order": q.question_order,
                "question_text": q.question_text,
                "help_text": q.help_text,
                "industry_context": q.industry_context,
                "is_required": q.is_required,
                "compliant_answer": q.compliant_answer.value
                if q.compliant_answer
                else "yes",
                "answer": r.answer.value if r else None,
                "notes": r.notes if r else None,
                "answered_by": r.answered_by if r else None,
                "answered_at": r.answered_at if r else None,
            }
        )

    return {
        "transaction_id": txn_id,
        "questions_configured": len(questions),
        "questions_answered": len([i for i in items if i["answer"] is not None]),
        "checklist_complete": len(questions) > 0
        and all(i["answer"] is not None for i in items if i["is_required"]),
        "base_alert_score": base_alert_score,
        "risk_matrix_score": risk_matrix_score,
        "risk_matrix_level": risk_matrix_level,
        "question_score": question_score,
        "custom_question_weight": q_weight,
        "final_approval_score": final_score,
        "score_detail": score_detail,
        "questions": items,
        "disclaimer": (
            "Approval scores support the compliance workflow only. "
            "All regulatory decisions remain with the reporting entity."
        ),
    }


@router.post("/{txn_id}/answer-questions", status_code=200)
def answer_approval_questions(
    txn_id: str,
    payload: AnswerQuestionsRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_compliance_or_above),
):
    """
    Submit or update answers to the pre-approval checklist questions.

    Each answer is upserted (existing answer updated if already submitted).
    After all required questions are answered, the final_approval_score is
    computed and stored on the most recent alert for this transaction.

    Answer semantics:
      yes             — compliant (lower risk contribution)
      no              — non-compliant (flags a concern, higher risk)
      not_applicable  — excluded from score calculation

    DISCLAIMER: Answers are compliance workflow records only.
    """
    org_id = org_id_for(current_user)
    _get_transaction_or_404(txn_id, org_id, db)

    # Validate all question IDs belong to this org
    question_ids = [a.question_id for a in payload.answers]
    valid_questions = (
        db.query(OrgApprovalQuestion)
        .filter(
            OrgApprovalQuestion.id.in_(question_ids),
            OrgApprovalQuestion.org_id == org_id,
            OrgApprovalQuestion.is_active == True,
        )
        .all()
    )
    valid_ids = {q.id for q in valid_questions}
    invalid = [qid for qid in question_ids if qid not in valid_ids]
    if invalid:
        raise HTTPException(400, f"Unknown or inactive question IDs: {invalid}")

    now = datetime.now(timezone.utc)
    saved = []
    for item in payload.answers:
        existing = (
            db.query(TransactionQuestionResponse)
            .filter(
                TransactionQuestionResponse.transaction_id == txn_id,
                TransactionQuestionResponse.question_id == item.question_id,
            )
            .first()
        )
        if existing:
            existing.answer = item.answer
            existing.notes = item.notes
            existing.answered_by = current_user.id
            existing.answered_at = now
            saved.append(existing)
        else:
            r = TransactionQuestionResponse(
                id=f"tqr_{uuid4().hex[:10]}",
                transaction_id=txn_id,
                question_id=item.question_id,
                org_id=org_id,
                answer=item.answer,
                notes=item.notes,
                answered_by=current_user.id,
                answered_at=now,
            )
            db.add(r)
            saved.append(r)

    db.flush()

    # Recompute final approval score and persist to the latest alert
    all_responses = (
        db.query(TransactionQuestionResponse)
        .filter(
            TransactionQuestionResponse.transaction_id == txn_id,
            TransactionQuestionResponse.org_id == org_id,
        )
        .all()
    )
    config = (
        db.query(OrgMonitoringConfig)
        .filter(OrgMonitoringConfig.org_id == org_id)
        .first()
    )
    q_weight = getattr(config, "custom_question_weight", 0.20) if config else 0.20

    from app.models.monitoring import TransactionAlert

    latest_alert = (
        db.query(TransactionAlert)
        .filter(
            TransactionAlert.transaction_id == txn_id,
            TransactionAlert.org_id == org_id,
        )
        .order_by(TransactionAlert.trigger_date.desc())
        .first()
    )

    question_score = compute_question_score(all_responses)
    base_alert_score = (latest_alert.alert_score if latest_alert else 0.0) or 0.0
    final_score, score_detail = compute_final_approval_score(
        base_alert_score, question_score, q_weight
    )

    if latest_alert:
        latest_alert.question_score = question_score
        latest_alert.final_approval_score = final_score
        latest_alert.approval_score_detail = score_detail

    db.commit()

    return {
        "transaction_id": txn_id,
        "answers_submitted": len(saved),
        "question_score": question_score,
        "base_alert_score": base_alert_score,
        "final_approval_score": final_score,
        "score_detail": score_detail,
        "disclaimer": (
            "Approval scores support the compliance workflow only. "
            "All regulatory decisions remain with the reporting entity."
        ),
    }


# ── Live Decision Support Panel ───────────────────────────────────────────────


@router.get("/{txn_id}/live-panel")
def get_live_decision_panel(
    txn_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_analyst_or_above),
):
    """
    Real-time decision support panel for a transaction.

    Computes weighted risk scores from the org's OrgRiskFactor configuration
    and evaluates AUSTRAC regulatory obligation indicators in real time.

    Answers: "What should the compliance officer consider next?"

    Use cases:
      - Display alongside the transaction entry screen
      - Show before approving / releasing a transaction
      - Refresh after adding evidence or answering questions

    Risk dimensions:
      customer | geographic | product | transaction | behaviour | crypto

    Regulatory indicators (never auto-submitted):
      Potential IFTI | Potential TTR | Potential SMR | Potential EDD
      Source of Funds request | Customer Review

    DISCLAIMER: This panel is decision support guidance only.
    All compliance decisions remain with the reporting entity.
    """
    from app.models.organisation import Organisation
    from app.models.transaction import CustomerBehaviourProfile
    from app.services.decision_support_service import build_live_panel

    org_id = org_id_for(current_user)
    txn = _get_transaction_or_404(txn_id, org_id, db)

    customer = db.query(Customer).filter_by(id=txn.customer_id, org_id=org_id).first()
    if not customer:
        raise HTTPException(404, "Customer not found for this transaction")

    org = db.query(Organisation).filter_by(id=org_id).first()

    crypto_detail = (
        db.query(TransactionCryptoDetail).filter_by(transaction_id=txn_id).first()
    )
    behaviour_profile = (
        db.query(CustomerBehaviourProfile)
        .filter_by(customer_id=txn.customer_id, org_id=org_id)
        .first()
    )

    # Get latest alert score for this transaction
    latest_alert = (
        db.query(TransactionAlert)
        .filter_by(transaction_id=txn_id, org_id=org_id)
        .order_by(TransactionAlert.trigger_date.desc())
        .first()
    )
    alert_score = float(latest_alert.alert_score or 0) if latest_alert else 0.0
    alert_breakdown = (latest_alert.score_breakdown or {}) if latest_alert else {}

    panel = build_live_panel(
        db=db,
        org_id=org_id,
        transaction=txn,
        customer=customer,
        org=org,
        crypto_detail=crypto_detail,
        behaviour_profile=behaviour_profile,
        alert_score=alert_score,
        alert_breakdown=alert_breakdown,
    )

    # Enrich with transaction and customer context
    panel["transaction_context"] = {
        "transaction_ref": txn.transaction_ref,
        "amount": txn.amount,
        "amount_aud": txn.amount_aud,
        "currency": txn.currency,
        "transaction_type": txn.transaction_type.value
        if txn.transaction_type
        else None,
        "payment_method": txn.payment_method.value if txn.payment_method else None,
        "direction": txn.direction.value if txn.direction else None,
        "source_country": txn.source_country,
        "destination_country": txn.destination_country,
        "is_cross_border": txn.is_cross_border,
        "is_near_threshold": txn.is_near_threshold,
        "is_structuring_suspect": txn.is_structuring_suspect,
        "transaction_date": txn.transaction_date.isoformat()
        if txn.transaction_date
        else None,
    }
    panel["customer_context"] = {
        "customer_id": customer.id,
        "risk_level": customer.risk_level.value if customer.risk_level else None,
        "is_pep": customer.is_pep,
        "is_sanctions_match": customer.is_sanctions_match,
        "cdd_level": customer.cdd_level.value if customer.cdd_level else None,
    }
    if latest_alert:
        panel["latest_alert"] = {
            "alert_id": latest_alert.id,
            "alert_ref": latest_alert.alert_ref,
            "severity": latest_alert.severity.value if latest_alert.severity else None,
            "status": latest_alert.status.value if latest_alert.status else None,
            "alert_score": latest_alert.alert_score,
        }

    return panel


# ── Draft Report Prefill ──────────────────────────────────────────────────────


@router.get("/{txn_id}/draft-report-prefill/{report_type}")
def get_draft_report_prefill(
    txn_id: str,
    report_type: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_compliance_or_above),
):
    """
    Pre-populate a draft regulatory report from transaction data.

    report_type: "ifti" | "ttr" | "smr"

    The system pre-fills available fields — the compliance officer must:
      1. Review and edit all pre-filled data
      2. Obtain MLRO sign-off (SMR)
      3. Make the final lodgement decision

    The system NEVER submits reports automatically.

    DISCLAIMER: Pre-filled data is a workflow assistance tool.
    The reporting entity bears sole responsibility for the accuracy of
    all reports lodged with AUSTRAC. This system does not make
    regulatory determinations.
    """
    from app.models.organisation import Organisation
    from app.services.regulatory_decision_service import (
        evaluate_transaction,
        prefill_ifti_data,
        prefill_smr_data,
        prefill_ttr_data,
    )

    if report_type not in ("ifti", "ttr", "smr"):
        raise HTTPException(422, "report_type must be one of: ifti, ttr, smr")

    org_id = org_id_for(current_user)
    txn = _get_transaction_or_404(txn_id, org_id, db)

    customer = db.query(Customer).filter_by(id=txn.customer_id, org_id=org_id).first()
    if not customer:
        raise HTTPException(404, "Customer not found")

    org = db.query(Organisation).filter_by(id=org_id).first()
    crypto_detail = (
        db.query(TransactionCryptoDetail).filter_by(transaction_id=txn_id).first()
    )

    latest_alert = (
        db.query(TransactionAlert)
        .filter_by(transaction_id=txn_id, org_id=org_id)
        .order_by(TransactionAlert.trigger_date.desc())
        .first()
    )
    alert_score = float(latest_alert.alert_score or 0) if latest_alert else 0.0

    if report_type == "ifti":
        prefill = prefill_ifti_data(txn, customer, org)
    elif report_type == "ttr":
        prefill = prefill_ttr_data(txn, customer, org)
    else:
        # SMR — include indicator analysis
        reg_result = evaluate_transaction(
            transaction=txn,
            customer=customer,
            org=org,
            alert_score=alert_score,
            crypto_detail=crypto_detail,
        )
        prefill = prefill_smr_data(txn, customer, org, reg_result.indicators)

    prefill["transaction_id"] = txn_id
    prefill["transaction_ref"] = txn.transaction_ref
    prefill["customer_id"] = str(customer.id)
    prefill["report_type"] = report_type
    prefill["next_step"] = (
        f"Create a draft {report_type.upper()} report and link this transaction"
    )

    return prefill


# ── Questionnaire template management ─────────────────────────────────────────


@router.post("/questionnaire/seed-industry-template")
def seed_industry_questionnaire(
    industry: str,
    template_keys: Optional[list[str]] = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_compliance_or_above),
):
    """
    Seed FATF-aligned pre-approval questionnaire templates for this organisation's industry.

    Available templates:
      fatf_general_v1   — General FATF R.10/12/13 questions (all industries)
      remittance_v1     — FATF R.14/16 remittance-specific
      crypto_v1         — FATF VA Guidance 2021 crypto/VASP
      legal_trust_v1    — FATF R.22/23 legal and trust accounts
      real_estate_v1    — FATF R.22 real estate
      psp_v1            — Payment service provider

    Questions are seeded as system questions (is_system=True) — editable and
    deactivatable by the organisation without developer involvement.

    No developer involvement required after initial setup.

    DISCLAIMER: Templates are compliance workflow prompts.
    All decisions remain with the reporting entity.
    """
    from app.services.questionnaire_seed_service import (
        get_available_templates,
        seed_questionnaire_for_org,
    )

    org_id = org_id_for(current_user)

    result = seed_questionnaire_for_org(
        db=db,
        org_id=org_id,
        industry=industry,
        created_by=current_user.id,
        template_keys=template_keys,
        skip_if_exists=False,  # Allow re-seeding with override
    )
    return {
        **result,
        "available_templates": get_available_templates(),
        "disclaimer": (
            "Seeded questions are compliance workflow prompts. "
            "All decisions remain with the reporting entity."
        ),
    }


@router.get("/questionnaire/templates")
def list_questionnaire_templates(
    current_user: User = Depends(require_analyst_or_above),
):
    """
    List all available FATF-based questionnaire templates with question counts and categories.
    """
    from app.services.questionnaire_seed_service import get_available_templates

    return {
        "templates": get_available_templates(),
        "industry_template_map": {
            "remittance": ["fatf_general_v1", "remittance_v1"],
            "cryptocurrency": ["fatf_general_v1", "crypto_v1"],
            "payment_service_provider": ["fatf_general_v1", "psp_v1"],
            "legal": ["fatf_general_v1", "legal_trust_v1"],
            "real_estate": ["fatf_general_v1", "real_estate_v1"],
            "general": ["fatf_general_v1"],
        },
    }
