"""
Bulk Transaction Import — CSV and Excel upload parsing (P27).

Mirrors app/services/bulk_import.py's customer-import pattern: pure
parsing here (no DB access), row validation, and a downloadable
template. The route (app/api/routes/transactions.py) resolves each
parsed row's customer_ref to a real Customer, creates the Transaction,
and runs it through the same monitoring/automation pipeline as a
manually-entered transaction.

Supports:
  - CSV (.csv) — UTF-8 or Latin-1 encoded
  - Excel (.xlsx) — first sheet used

Column mapping is alias-tolerant (accepts common header variations).
Required per row: transaction_ref, customer_ref, transaction_type,
direction, payment_method, amount, transaction_date.

DISCLAIMER: Imported transactions are run through the same monitoring
engine as manually-entered ones. Alerts generated are indicators for
human review only — no alert or import outcome constitutes a finding
of suspicious activity. All regulatory decisions remain with the
reporting entity.
"""

import csv
import io
from datetime import datetime

from app.models.transaction import (
    PaymentMethod,
    TransactionDirection,
    TransactionType,
)

# ── Importable field definitions ──────────────────────────────────────────────
# (canonical_name, aliases, required, example_domestic, example_cross_border, help)

IMPORT_FIELDS = [
    (
        "transaction_ref",
        ["transaction_ref", "txn_ref", "reference_id", "transaction_id", "ref"],
        True,
        "TXN-2026-000123",
        "TXN-2026-000124",
        "Unique reference for this transaction. Re-uploading the same "
        "transaction_ref is a safe no-op (skipped, not duplicated) — "
        "use this for idempotent retries of a failed batch.",
    ),
    (
        "customer_ref",
        ["customer_ref", "customer_code", "client_ref", "client_code"],
        True,
        "CUST-000045",
        "CUST-000046",
        "The platform's customer_ref for an existing customer (see "
        "GET /customers/). The customer must already exist — this "
        "endpoint does not create customers.",
    ),
    (
        "transaction_type",
        ["transaction_type", "type", "txn_type"],
        True,
        "transfer",
        "remittance",
        "One of: " + ", ".join(e.value for e in TransactionType),
    ),
    (
        "direction",
        ["direction", "txn_direction"],
        True,
        "outgoing",
        "outgoing",
        "One of: " + ", ".join(e.value for e in TransactionDirection),
    ),
    (
        "payment_method",
        ["payment_method", "method"],
        True,
        "bank_transfer",
        "swift",
        "One of: " + ", ".join(e.value for e in PaymentMethod),
    ),
    (
        "delivery_channel",
        ["delivery_channel", "channel"],
        False,
        "online",
        "branch",
        "online | mobile_app | branch | atm | agent | telephone | api | "
        "third_party | unattended",
    ),
    (
        "currency",
        ["currency", "ccy"],
        False,
        "AUD",
        "USD",
        "ISO 4217 currency code. Defaults to AUD.",
    ),
    (
        "amount",
        ["amount", "value", "txn_amount"],
        True,
        "5000.00",
        "120000.00",
        "Transaction amount in the given currency.",
    ),
    (
        "amount_aud",
        ["amount_aud", "aud_amount", "amount_in_aud"],
        False,
        "5000.00",
        "182400.00",
        "AUD-equivalent amount, if currency is not AUD. Computed by the "
        "platform's own FX rate if left blank and currency is foreign.",
    ),
    (
        "transaction_date",
        ["transaction_date", "date", "txn_date", "value_date_time"],
        True,
        "2026-06-01T10:00:00",
        "2026-06-02T14:30:00",
        "When the transaction occurred. ISO 8601 (YYYY-MM-DD or YYYY-MM-DDTHH:MM:SS).",
    ),
    (
        "purpose",
        ["purpose", "txn_purpose"],
        False,
        "Family support",
        "Trade payment",
        "Stated purpose of the transaction.",
    ),
    (
        "description",
        ["description", "narrative", "memo"],
        False,
        "Monthly transfer",
        "Invoice #4471 payment",
        "Free-text description.",
    ),
    (
        "reference",
        ["reference", "payment_reference", "bank_reference"],
        False,
        "REF001",
        "REF002",
        "Payment/bank reference shown on statements.",
    ),
    (
        "customer_reference",
        ["customer_reference", "customer_provided_ref"],
        False,
        "",
        "",
        "Customer-provided reference/note (distinct from customer_ref, "
        "which identifies the customer record).",
    ),
    (
        "source_account_name",
        ["source_account_name", "sender_account_name"],
        False,
        "Jane Smith",
        "Acme Pty Ltd",
        "Name on the source account.",
    ),
    (
        "source_account_number",
        ["source_account_number", "sender_account_number"],
        False,
        "12345678",
        "87654321",
        "Source account number.",
    ),
    (
        "source_bsb",
        ["source_bsb", "sender_bsb"],
        False,
        "062-000",
        "",
        "Source BSB (Australian accounts).",
    ),
    (
        "source_bank_name",
        ["source_bank_name", "sender_bank"],
        False,
        "Test Bank",
        "Acme Bank AU",
        "Source financial institution name.",
    ),
    (
        "source_country",
        ["source_country", "sender_country"],
        False,
        "AU",
        "AU",
        "ISO 3166-1 alpha-2 source country.",
    ),
    (
        "destination_account_name",
        ["destination_account_name", "beneficiary_account_name", "recipient_name"],
        False,
        "John Doe",
        "ABC Beneficiary Ltd",
        "Name on the destination account.",
    ),
    (
        "destination_account_number",
        ["destination_account_number", "beneficiary_account_number"],
        False,
        "999888777",
        "00123456",
        "Destination account number.",
    ),
    (
        "destination_bsb",
        ["destination_bsb", "beneficiary_bsb"],
        False,
        "063-000",
        "",
        "Destination BSB (Australian accounts).",
    ),
    (
        "destination_bank_name",
        ["destination_bank_name", "beneficiary_bank"],
        False,
        "Other Bank",
        "ANZ Bank New Zealand",
        "Destination financial institution name.",
    ),
    (
        "destination_country",
        ["destination_country", "beneficiary_country"],
        False,
        "AU",
        "NZ",
        "ISO 3166-1 alpha-2 destination country.",
    ),
    (
        "is_cross_border",
        ["is_cross_border", "cross_border"],
        False,
        "false",
        "true",
        "true/false. Whether funds cross an international border.",
    ),
    (
        "merchant_name",
        ["merchant_name", "merchant"],
        False,
        "",
        "",
        "Merchant name (card transactions).",
    ),
    (
        "counterparty_name",
        ["counterparty_name", "counterparty"],
        False,
        "John Doe",
        "ABC Beneficiary Ltd",
        "Counterparty name, if not captured via destination_account_name.",
    ),
    (
        "counterparty_type",
        ["counterparty_type"],
        False,
        "individual",
        "business",
        "individual | business | government",
    ),
]

_ALIAS_MAP: dict[str, str] = {}
for _canonical, _aliases, *_ in IMPORT_FIELDS:
    for _alias in _aliases:
        _ALIAS_MAP[_alias] = _canonical

_VALID_TRANSACTION_TYPES = {e.value for e in TransactionType}
_VALID_DIRECTIONS = {e.value for e in TransactionDirection}
_VALID_PAYMENT_METHODS = {e.value for e in PaymentMethod}


def _normalise_header(h: str) -> str:
    return h.strip().lower().replace(" ", "_").replace("-", "_").replace(".", "_")


def _map_row(raw_row: dict) -> dict:
    """Map a raw CSV/Excel row dict to canonical field names."""
    normalised = {_normalise_header(k): v for k, v in raw_row.items()}
    out = {}
    for norm_key, value in normalised.items():
        canonical = _ALIAS_MAP.get(norm_key)
        if canonical and canonical not in out:
            val = str(value or "").strip()
            if val:
                out[canonical] = val
    return out


def parse_transaction_datetime(value: str) -> datetime:
    """Parse an ISO 8601 date or datetime string. Raises ValueError if
    unparseable."""
    v = value.strip()
    try:
        return datetime.fromisoformat(v)
    except ValueError:
        # Try common date-only variants fromisoformat doesn't accept on
        # older Python (e.g. "01/06/2026" is intentionally NOT accepted --
        # ambiguous day/month ordering is exactly the kind of silent
        # misparse this import should refuse rather than guess at).
        raise ValueError(f"'{value}' is not a valid ISO 8601 date/datetime")


def _validate_row(row: dict, row_num: int) -> list[str]:
    """Return list of validation errors for a row (empty = valid)."""
    errors = []

    if not row.get("transaction_ref"):
        errors.append(f"Row {row_num}: transaction_ref is required")
    if not row.get("customer_ref"):
        errors.append(f"Row {row_num}: customer_ref is required")

    ttype = row.get("transaction_type", "").lower()
    if ttype not in _VALID_TRANSACTION_TYPES:
        errors.append(
            f"Row {row_num}: transaction_type '{ttype}' not valid — "
            f"use: {', '.join(sorted(_VALID_TRANSACTION_TYPES))}"
        )

    direction = row.get("direction", "").lower()
    if direction not in _VALID_DIRECTIONS:
        errors.append(
            f"Row {row_num}: direction '{direction}' not valid — "
            f"use: {', '.join(sorted(_VALID_DIRECTIONS))}"
        )

    method = row.get("payment_method", "").lower()
    if method not in _VALID_PAYMENT_METHODS:
        errors.append(
            f"Row {row_num}: payment_method '{method}' not valid — "
            f"use: {', '.join(sorted(_VALID_PAYMENT_METHODS))}"
        )

    amount = row.get("amount", "").strip()
    if not amount:
        errors.append(f"Row {row_num}: amount is required")
    else:
        try:
            float(amount)
        except ValueError:
            errors.append(f"Row {row_num}: amount '{amount}' must be numeric")

    tdate = row.get("transaction_date", "").strip()
    if not tdate:
        errors.append(f"Row {row_num}: transaction_date is required")
    else:
        try:
            parse_transaction_datetime(tdate)
        except ValueError:
            errors.append(
                f"Row {row_num}: transaction_date '{tdate}' could not be "
                "parsed — use YYYY-MM-DD or ISO 8601"
            )

    return errors


def parse_csv(
    content: bytes, encoding: str = "utf-8-sig"
) -> tuple[list[dict], list[str], list[str]]:
    """Parse CSV bytes. Returns (rows, warnings, errors)."""
    try:
        text = content.decode(encoding)
    except UnicodeDecodeError:
        text = content.decode("latin-1")

    reader = csv.DictReader(io.StringIO(text))
    rows: list[dict] = []
    warnings: list[str] = []
    errors: list[str] = []
    for i, raw_row in enumerate(reader, start=2):
        if not any(str(v or "").strip() for v in raw_row.values()):
            continue
        if any(str(v or "").strip().startswith("#") for v in raw_row.values()):
            continue
        mapped = _map_row(raw_row)
        row_errors = _validate_row(mapped, i)
        if row_errors:
            errors.extend(row_errors)
            continue
        rows.append(mapped)
    return rows, warnings, errors


def parse_excel(content: bytes) -> tuple[list[dict], list[str], list[str]]:
    """Parse Excel (.xlsx) bytes. Returns (rows, warnings, errors)."""
    try:
        import openpyxl
    except ImportError:
        raise ImportError("openpyxl is required for Excel import: pip install openpyxl")

    wb = openpyxl.load_workbook(io.BytesIO(content), read_only=True, data_only=True)
    ws = wb.active
    rows_data = list(ws.iter_rows(values_only=True))
    if not rows_data:
        return [], [], ["File is empty"]

    header_row_idx = next(
        (i for i, r in enumerate(rows_data) if any(c is not None for c in r)), 0
    )
    headers = [str(h or "").strip() for h in rows_data[header_row_idx]]
    rows: list[dict] = []
    warnings: list[str] = []
    errors: list[str] = []

    for i, row in enumerate(rows_data[header_row_idx + 1 :], start=header_row_idx + 2):
        raw = {
            headers[j]: str(v or "").strip()
            for j, v in enumerate(row)
            if j < len(headers)
        }
        if not any(raw.values()):
            continue
        if any(str(v or "").startswith("#") for v in raw.values()):
            continue
        mapped = _map_row(raw)
        row_errors = _validate_row(mapped, i)
        if row_errors:
            errors.extend(row_errors)
            continue
        rows.append(mapped)
    return rows, warnings, errors


def generate_csv_template() -> bytes:
    """
    Generate a downloadable CSV template with all importable fields.

    Rows:
      Row 1: Column headers
      Row 2: Field descriptions (# prefix — skipped on import)
      Row 3: Domestic transfer example
      Row 4: Cross-border transfer example
    """
    output = io.StringIO()
    writer = csv.writer(output, lineterminator="\r\n")

    headers = [f[0] for f in IMPORT_FIELDS]
    writer.writerow(headers)

    descriptions = [f"# {f[5]}" for f in IMPORT_FIELDS]
    writer.writerow(descriptions)

    domestic_row = [f[3] for f in IMPORT_FIELDS]
    writer.writerow(domestic_row)

    cross_border_row = [f[4] for f in IMPORT_FIELDS]
    writer.writerow(cross_border_row)

    return output.getvalue().encode("utf-8-sig")  # BOM for Excel compatibility


def get_template_field_guide() -> list[dict]:
    """Return structured field guide for API documentation."""
    return [
        {
            "field": f[0],
            "required": f[2],
            "example_domestic": f[3],
            "example_cross_border": f[4],
            "description": f[5],
            "accepted_aliases": f[1],
        }
        for f in IMPORT_FIELDS
    ]
