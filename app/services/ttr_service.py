"""
TTR (Threshold Transaction Report) Industry Service.

Handles AUSTRAC-format auto-population and CSV export for all four
TTR industry categories:

  FBS — Financial and Bullion Services
  GS  — Gambling Services
  ISI — Investment / Superannuation / Insurance
  MSB — Money Services Business

CSV column headers match AUSTRAC's TTR batch upload specification.
Field order, naming, and date format (DD/MM/YYYY) follow the AUSTRAC
Compliance Reporting Guide (CRG) current at April 2026.

DISCLAIMER: This service auto-populates draft reports from transaction
metadata. All field values must be reviewed and confirmed by the reporting
entity before lodgement. The platform does not submit reports to AUSTRAC
automatically. Lodgement decisions and timing obligations remain with the
reporting entity.

AUSTRAC statutory deadline: 10 business days from the transaction date
(approximately 14 calendar days).
"""
from __future__ import annotations

import csv
import io
from datetime import date, datetime
from typing import Any, Optional

from app.models.report import TTRIndustryType, TTRReport


# ── Date formatting ───────────────────────────────────────────────────────────

def _fmt_date(d: Any) -> str:
    if d is None:
        return ""
    if isinstance(d, datetime):
        d = d.date()
    if isinstance(d, date):
        return d.strftime("%d/%m/%Y")
    return str(d)


def _fmt_amount(v: Any) -> str:
    if v is None:
        return ""
    try:
        return f"{float(v):.2f}"
    except (TypeError, ValueError):
        return str(v)


# ── Industry-specific auto-population ─────────────────────────────────────────

def build_industry_detail(txn, customer, industry_type: TTRIndustryType) -> dict:
    """
    Build the industry_detail JSON for a TTR draft from transaction
    and customer metadata. Returns a dict matching the industry's schema.

    All values are pre-filled where data is available — blanks indicate
    fields that the compliance officer must complete before lodgement.
    """
    if industry_type == TTRIndustryType.FBS:
        return _fbs_detail(txn, customer)
    if industry_type == TTRIndustryType.GS:
        return _gs_detail(txn, customer)
    if industry_type == TTRIndustryType.ISI:
        return _isi_detail(txn, customer)
    if industry_type == TTRIndustryType.MSB:
        return _msb_detail(txn, customer)
    return {}


def _fbs_detail(txn, customer) -> dict:
    """
    FBS — Financial and Bullion Services.

    Mandatory additional fields per AUSTRAC CRG:
      cash_type, denomination_breakdown (strongly recommended),
      foreign_currency details if not AUD.
    """
    currency = getattr(txn, "currency", "AUD") or "AUD"
    is_foreign = currency.upper() != "AUD"

    return {
        "_schema": "FBS",
        "_schema_version": "1.0",
        # Cash type: cash_deposit | cash_withdrawal | cash_purchase | cash_refund | cash_exchange
        "cash_type": _infer_cash_type(txn),
        # Denomination breakdown — must total to transaction amount
        "denomination_breakdown": {
            "note_100": None,
            "note_50": None,
            "note_20": None,
            "note_10": None,
            "note_5": None,
            "coin_2": None,
            "coin_1": None,
            "total_notes": None,
            "total_coin": None,
            "_note": "Enter count of each denomination. Platform cannot auto-populate.",
        },
        # Account details (pre-filled from transaction where available)
        "account_type": getattr(txn, "account_type", None),
        "account_bsb": getattr(txn, "source_bsb", None) or getattr(txn, "destination_bsb", None),
        "account_number": getattr(txn, "source_account_number", None) or getattr(txn, "destination_account_number", None),
        "account_name": getattr(txn, "source_account_name", None) or getattr(txn, "destination_account_name", None),
        # Foreign currency (only if non-AUD)
        "is_foreign_currency": is_foreign,
        "foreign_currency_code": currency if is_foreign else None,
        "foreign_currency_amount": _fmt_amount(getattr(txn, "amount", None)) if is_foreign else None,
        "exchange_rate": _fmt_amount(getattr(txn, "exchange_rate", None)),
        # Bullion-specific (blank unless bullion dealer)
        "bullion_type": None,        # gold | silver | platinum | palladium | other
        "bullion_weight_grams": None,
        "bullion_purity": None,
        "bullion_spot_price_aud": None,
        # Service channel
        "service_channel": getattr(txn, "delivery_channel", None),
        # Structured transaction flag (must be manually assessed)
        "is_structured_transaction": False,
        "structuring_notes": None,
    }


def _gs_detail(txn, customer) -> dict:
    """
    GS — Gambling Services.

    Mandatory additional fields per AUSTRAC CRG:
      venue_name, gaming_licence_number, patron transaction type,
      game type, chip/token details.
    """
    return {
        "_schema": "GS",
        "_schema_version": "1.0",
        # Venue
        "venue_name": None,              # casino / betting agency name
        "venue_address": None,
        "gaming_licence_number": None,   # state gaming licence
        "gaming_area": None,             # e.g. Main Floor, VIP Room
        # Patron
        "patron_id": getattr(customer, "external_ref", None),
        "patron_membership_number": None,
        "patron_vip_status": None,
        # Transaction type
        "gambling_transaction_type": _infer_gambling_type(txn),
        # chip_buy_in | chip_redemption | cash_bet | winnings_payout | atm_withdrawal | other
        "game_type": None,
        # table_games | electronic_gaming_machines | sports_betting | keno | lottery | other
        "table_number": None,
        "machine_number": None,
        # Amounts
        "chip_buy_in_amount": None,
        "chip_redemption_amount": None,
        "cash_bet_amount": None,
        "winnings_paid_amount": None,
        "net_gaming_result": None,
        # Chips/tokens
        "chip_count": None,
        "chip_denomination": None,
        # Multiple transactions indicator
        "is_multiple_transactions": False,
        "multiple_transaction_notes": None,
    }


def _isi_detail(txn, customer) -> dict:
    """
    ISI — Investment / Superannuation / Insurance.

    Mandatory additional fields per AUSTRAC CRG:
      policy/account reference, fund details, contribution type,
      beneficiary details.
    """
    return {
        "_schema": "ISI",
        "_schema_version": "1.0",
        # Product
        "product_type": None,
        # superannuation | managed_investment | life_insurance | general_insurance |
        # annuity | bond | term_deposit | other
        "policy_number": getattr(txn, "reference_number", None),
        "account_reference": getattr(txn, "source_account_number", None),
        "fund_name": None,
        "trustee_name": None,
        "trustee_abn": None,
        "product_provider_name": None,
        "product_provider_abn": None,
        # Transaction purpose
        "contribution_type": None,
        # voluntary_contribution | employer_contribution | rollover | premium_payment |
        # benefit_payment | withdrawal | surrender | claim_payout | other
        "investment_type": _infer_investment_type(txn),
        "financial_year": _current_financial_year(),
        # Beneficiary (if different from customer)
        "beneficiary_name": None,
        "beneficiary_dob": None,
        "beneficiary_relationship": None,
        # Adviser
        "financial_adviser_name": None,
        "financial_adviser_afsl": None,
        # Rollover details (if applicable)
        "rollover_from_fund": None,
        "rollover_from_abn": None,
        # Tax details
        "tax_file_number_provided": False,
        "concessional_contribution": False,
    }


def _msb_detail(txn, customer) -> dict:
    """
    MSB — Money Services Business (remittance / currency exchange).

    Mandatory additional fields per AUSTRAC CRG:
      remittance corridor, exchange rate applied, sender/receiver
      details, settlement method, agent chain.
    """
    currency = getattr(txn, "currency", "AUD") or "AUD"
    destination_country = getattr(txn, "destination_country", None)
    source_country = getattr(txn, "source_country", None)

    return {
        "_schema": "MSB",
        "_schema_version": "1.0",
        # Transaction direction
        "remittance_direction": _infer_remittance_direction(txn),
        # send | receive | exchange
        # Corridor
        "send_country": source_country or "AU",
        "receive_country": destination_country,
        "send_currency": "AUD",
        "receive_currency": currency if currency != "AUD" else None,
        "exchange_rate_applied": _fmt_amount(getattr(txn, "exchange_rate", None)),
        "amount_send_aud": _fmt_amount(getattr(txn, "amount_aud", None) or getattr(txn, "amount", None)),
        "amount_receive_foreign": _fmt_amount(getattr(txn, "amount", None)) if currency != "AUD" else None,
        "fee_aud": None,
        # Settlement
        "settlement_method": None,
        # bank_transfer | cash_pickup | mobile_wallet | crypto | cheque | other
        "settlement_date": _fmt_date(getattr(txn, "transaction_date", None)),
        # Sender (payer)
        "sender_name": getattr(customer, "full_name", None),
        "sender_dob": _fmt_date(getattr(customer, "date_of_birth", None)),
        "sender_address": getattr(customer, "address_line1", None),
        "sender_country": getattr(customer, "country_of_residence", "AU"),
        "sender_phone": getattr(customer, "phone", None),
        "sender_id_type": None,
        "sender_id_number": None,
        "sender_id_country": None,
        # Receiver (beneficiary)
        "receiver_name": getattr(txn, "destination_account_name", None),
        "receiver_address": None,
        "receiver_country": destination_country,
        "receiver_phone": None,
        "receiver_account_number": getattr(txn, "destination_account_number", None),
        "receiver_bank_name": getattr(txn, "destination_bank_name", None),
        "receiver_bank_country": destination_country,
        "receiver_swift_bic": getattr(txn, "destination_swift_bic", None),
        "receiver_iban": getattr(txn, "destination_iban", None),
        # Agent chain (sub-agent if applicable)
        "agent_name": None,
        "agent_austrac_id": None,
        "agent_abn": None,
        "agent_address": None,
        # Relationship between sender and receiver
        "sender_receiver_relationship": None,
        # Tipping-off flag (auto-False — must never auto-flag)
        "tipping_off_risk": False,
        "tipping_off_notes": None,
    }


# ── Inference helpers ─────────────────────────────────────────────────────────

def _infer_cash_type(txn) -> Optional[str]:
    direction = getattr(txn, "direction", None)
    payment_method = getattr(txn, "payment_method", None)
    pm = payment_method.value if hasattr(payment_method, "value") else str(payment_method or "")
    if "deposit" in pm.lower() or direction == "credit":
        return "cash_deposit"
    if "withdrawal" in pm.lower() or direction == "debit":
        return "cash_withdrawal"
    if "purchase" in pm.lower():
        return "cash_purchase"
    return None


def _infer_gambling_type(txn) -> Optional[str]:
    direction = getattr(txn, "direction", None)
    if direction == "credit":
        return "winnings_payout"
    if direction == "debit":
        return "chip_buy_in"
    return None


def _infer_investment_type(txn) -> Optional[str]:
    direction = getattr(txn, "direction", None)
    if direction == "credit":
        return "contribution"
    if direction == "debit":
        return "withdrawal"
    return None


def _infer_remittance_direction(txn) -> Optional[str]:
    direction = getattr(txn, "direction", None)
    if direction == "debit":
        return "send"
    if direction == "credit":
        return "receive"
    return None


def _current_financial_year() -> str:
    today = date.today()
    if today.month >= 7:
        return f"FY{today.year}/{today.year + 1}"
    return f"FY{today.year - 1}/{today.year}"


# ── CSV Export ────────────────────────────────────────────────────────────────

# AUSTRAC TTR CSV column specifications per industry type.
# Column order and names match AUSTRAC Compliance Reporting Guide (CRG) April 2026.

_COMMON_COLUMNS = [
    "report_ref", "industry_type", "transaction_date", "total_amount_aud",
    "transaction_type", "currency",
    "customer_name", "customer_dob", "customer_address", "customer_occupation",
    "customer_id_type", "customer_id_number", "customer_abn",
    "account_name", "account_number", "account_bsb",
    "branch_name", "branch_address", "branch_bsb",
    "third_party_name", "third_party_relationship",
    "reporter_name", "reporter_abn", "reporter_austrac_id",
    "prepared_by", "due_date", "status",
]

_INDUSTRY_EXTRA_COLUMNS: dict[TTRIndustryType, list[str]] = {
    TTRIndustryType.FBS: [
        "cash_type", "account_type", "is_foreign_currency",
        "foreign_currency_code", "foreign_currency_amount", "exchange_rate",
        "bullion_type", "bullion_weight_grams", "bullion_purity", "bullion_spot_price_aud",
        "service_channel", "is_structured_transaction",
    ],
    TTRIndustryType.GS: [
        "venue_name", "venue_address", "gaming_licence_number", "gaming_area",
        "patron_id", "patron_membership_number",
        "gambling_transaction_type", "game_type", "table_number", "machine_number",
        "chip_buy_in_amount", "chip_redemption_amount", "cash_bet_amount",
        "winnings_paid_amount", "net_gaming_result",
    ],
    TTRIndustryType.ISI: [
        "product_type", "policy_number", "account_reference",
        "fund_name", "trustee_name", "trustee_abn",
        "contribution_type", "investment_type", "financial_year",
        "beneficiary_name", "beneficiary_dob", "beneficiary_relationship",
        "financial_adviser_name", "financial_adviser_afsl",
        "rollover_from_fund", "concessional_contribution",
    ],
    TTRIndustryType.MSB: [
        "remittance_direction", "send_country", "receive_country",
        "send_currency", "receive_currency", "exchange_rate_applied",
        "amount_send_aud", "amount_receive_foreign", "fee_aud",
        "settlement_method", "settlement_date",
        "receiver_name", "receiver_address", "receiver_country",
        "receiver_phone", "receiver_account_number", "receiver_bank_name",
        "receiver_swift_bic",
        "agent_name", "agent_austrac_id",
        "sender_receiver_relationship",
    ],
}


def generate_ttr_csv(report: TTRReport) -> str:
    """
    Generate AUSTRAC-format CSV for a TTR report.

    Returns a UTF-8 string with:
      Row 1 — column headers
      Row 2 — report data
      Row 3 — blank disclaimer row

    Columns: common AUSTRAC TTR fields + industry-specific fields
    (only included when industry_type is set).
    """
    industry = report.industry_type
    extra_cols = _INDUSTRY_EXTRA_COLUMNS.get(industry, []) if industry else []
    columns = _COMMON_COLUMNS + extra_cols

    detail = report.industry_detail or {}

    # Build common row values
    row: dict[str, str] = {
        "report_ref": report.report_ref or "",
        "industry_type": industry.value if industry else "",
        "transaction_date": _fmt_date(report.transaction_date),
        "total_amount_aud": _fmt_amount(report.total_amount),
        "transaction_type": report.transaction_type or "",
        "currency": report.currency or "AUD",
        "customer_name": report.customer_name or "",
        "customer_dob": _fmt_date(report.customer_dob),
        "customer_address": report.customer_address or "",
        "customer_occupation": report.customer_occupation or "",
        "customer_id_type": report.customer_id_type or "",
        "customer_id_number": report.customer_id_number or "",
        "customer_abn": report.customer_abn or "",
        "account_name": report.account_name or "",
        "account_number": report.account_number or "",
        "account_bsb": report.account_bsb or "",
        "branch_name": report.branch_name or "",
        "branch_address": report.branch_address or "",
        "branch_bsb": report.branch_bsb or "",
        "third_party_name": report.third_party_name or "",
        "third_party_relationship": report.third_party_relationship or "",
        "reporter_name": report.reporter_name or "",
        "reporter_abn": report.reporter_abn or "",
        "reporter_austrac_id": report.reporter_austrac_id or "",
        "prepared_by": report.prepared_by or "",
        "due_date": _fmt_date(report.due_date),
        "status": report.status.value if report.status else "",
    }

    # Add industry-specific columns from detail JSON
    for col in extra_cols:
        val = detail.get(col)
        if val is None:
            row[col] = ""
        elif isinstance(val, bool):
            row[col] = "Y" if val else "N"
        elif isinstance(val, dict):
            row[col] = ""   # nested dicts not flattened into CSV
        else:
            row[col] = str(val)

    output = io.StringIO()
    writer = csv.DictWriter(
        output,
        fieldnames=columns,
        extrasaction="ignore",
        lineterminator="\r\n",   # AUSTRAC requires CRLF
    )
    writer.writeheader()
    writer.writerow(row)

    # Disclaimer row (AUSTRAC CRG requirement: include reporter declaration)
    output.write(
        "\r\n"
        "# DISCLAIMER: This CSV is generated as a drafting aid only. "
        "All values must be verified by the reporting entity before lodgement. "
        "The reporting entity is solely responsible for the accuracy of AUSTRAC reports "
        "and compliance with all lodgement deadlines.\r\n"
    )

    return output.getvalue()


# ── AUSTRAC API Submission Placeholder ────────────────────────────────────────

def build_austrac_submission_payload(report: TTRReport) -> dict:
    """
    Build the submission payload in AUSTRAC API format.

    NOTE: AUSTRAC Connect API access requires accreditation and a signed
    Data Exchange Agreement. This function returns the structured payload
    that would be sent — actual HTTP submission requires live credentials.

    Production integration: AUSTRAC AUSTR Connect REST API v2
    Authentication: OAuth 2.0 client_credentials
    Endpoint: POST https://connect.austrac.gov.au/api/v2/reports/ttr

    DISCLAIMER: This is a payload builder only. The platform does not
    submit to AUSTRAC automatically. All lodgement decisions and timing
    remain with the reporting entity.
    """
    industry = report.industry_type
    detail = report.industry_detail or {}

    payload = {
        "reportType": "TTR",
        "industryType": industry.value if industry else None,
        "reporterDetails": {
            "reporterName": report.reporter_name,
            "abn": report.reporter_abn,
            "austracId": report.reporter_austrac_id,
        },
        "reportReference": report.report_ref,
        "transactionDate": _fmt_date(report.transaction_date),
        "totalAmountAUD": report.total_amount,
        "transactionType": report.transaction_type,
        "currency": report.currency or "AUD",
        "customer": {
            "name": report.customer_name,
            "dateOfBirth": _fmt_date(report.customer_dob),
            "address": report.customer_address,
            "occupation": report.customer_occupation,
            "idType": report.customer_id_type,
            "idNumber": report.customer_id_number,
            "abn": report.customer_abn,
        },
        "servicePoint": {
            "branchName": report.branch_name,
            "branchAddress": report.branch_address,
            "branchBsb": report.branch_bsb,
            "accountName": report.account_name,
            "accountNumber": report.account_number,
            "accountBsb": report.account_bsb,
        },
        "thirdParty": {
            "name": report.third_party_name,
            "relationship": report.third_party_relationship,
        } if report.third_party_name else None,
        "industrySpecificDetail": {
            k: v for k, v in detail.items()
            if not k.startswith("_")  # exclude schema metadata keys
        },
        "_submissionNote": (
            "PLACEHOLDER — Live submission requires AUSTRAC Connect API credentials "
            "and a signed Data Exchange Agreement. Contact AUSTRAC for accreditation."
        ),
    }
    return payload
