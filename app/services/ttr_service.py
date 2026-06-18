"""
TTR (Threshold Transaction Report) Industry Service.

Handles AUSTRAC-format auto-population, CSV export, and API payload building
for all four TTR industry categories:

  FBS — Financial and Bullion Services  (schema: TTR-FBS-3-0.xsd)
  GS  — Gambling Services               (schema: TTR-GS-2-0.xsd)
  ISI — Investment/Super/Insurance      (schema: TTR-ISI-2-0.xsd)
  MSB — Money Services Business         (schema: TTR-MSB-2-0.xsd)

Field names, enumerations, and element codes match AUSTRAC XML schemas
published at austrac.gov.au (TTR-FBS30, TTR-GS20, TTR-ISI20, TTR-MSB20).

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

# ── Date / amount formatting ──────────────────────────────────────────────────


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


# ── DesignatedSvc enumerations per industry ───────────────────────────────────
#
# Source: AUSTRAC TTR XML schemas (Section 9 — DesignatedSvc simple type)
# These are the ONLY valid values for <designatedSvc> in each industry's XML.
# Compliance officers must choose the correct code before lodgement.

DESIGNATED_SVC_FBS = {
    "ACC_DEP": "Account/deposit taking services",
    "BULSER": "Bullion dealing services",
    "BUS_LOAN": "Loan services",
    "BUS_RSA": "Retirement savings accounts (RSA)",
    "CHQACCSS": "Chequebook access facilities",
    "CRDACCSS": "Debit card access facilities",
    "CUR_EXCH": "Currency exchange services",
    "CUST_DEP": "Custodial/depository services",
    "DCE": "Digital currency exchange services",
    "DEBTINST": "Debt instruments",
    "FIN_EFT": "Electronic funds transfers (EFT)",
    "LEASING": "Lease/hire purchase services",
    "LIFE_INS": "Life insurance services",
    "PAYORDRS": "Money/postal orders",
    "PAYROLL": "Payroll services",
    "PENSIONS": "Pensions/annuity services",
    "RS": "Remittance services (money transfers)",
    "SECURITY": "Securities market/investment services",
    "SUPERANN": "Superannuation/approved deposit funds",
    "TRAVLCHQ": "Traveller's cheque exchange services",
    "VALCARDS": "Stored value cards",
}

DESIGNATED_SVC_GS = {
    "BET_ACC": "Betting accounts",
    "GAMCHSKL": "Games of chance or skill",
    "GAM_BETT": "Gambling and betting services",
    "GAM_EXCH": "Chips/currency exchange services",
    "GAM_MACH": "Gaming machines",
    "VALCARDS": "Stored value cards",
}

DESIGNATED_SVC_ISI = {
    "CUST_DEP": "Custodial/depository services",
    "FHSA": "First home saver accounts",
    "LIFE_INS": "Life insurance services",
    "PENSIONS": "Pensions/annuity services",
    "BUS_RSA": "Retirement savings accounts (RSA)",
    "SECURITY": "Securities market/investment services",
    "SUPERANN": "Superannuation/approved deposit funds",
}

DESIGNATED_SVC_MSB = {
    "COLL_CUR": "Cash carrying/payroll services",
    "CUR_EXCH": "Currency exchange services",
    "LEASING": "Lease/hire purchase services",
    "BUS_LOAN": "Loan services",
    "PAYORDRS": "Money/postal orders",
    "RS": "Remittance services",
    "TRAVLCHQ": "Traveller's cheque exchange services",
    "VALCARDS": "Stored value cards",
}

DESIGNATED_SVC_BY_INDUSTRY = {
    TTRIndustryType.FBS: DESIGNATED_SVC_FBS,
    TTRIndustryType.GS: DESIGNATED_SVC_GS,
    TTRIndustryType.ISI: DESIGNATED_SVC_ISI,
    TTRIndustryType.MSB: DESIGNATED_SVC_MSB,
}

# BusinessStructure enum (AUSTRAC schema 9.13/9.11/9.13/9.13)
BUSINESS_STRUCTURE_CODES = {
    "A": "Association",
    "C": "Company",
    "G": "Government Body",
    "P": "Partnership",
    "R": "Registered body",
    "T": "Trust",
}

# TransactionMethod enum (AUSTRAC schema — methodOfConductingTxn)
TRANSACTION_METHOD_CODES = [
    "ARMOURED_CAR_SERVICE",
    "ATM_DEPOSIT",
    "NIGHT_QUICK_DEPOSIT",
]

# IdType enum (AUSTRAC schema 9.23/9.21/9.23/9.23)
ID_TYPE_CODES = {
    "A": "Bank account",
    "C": "Credit/debit card",
    "D": "Driver's licence",
    "P": "Passport",
    "T": "Telephone/fax number",
    "ARNU": "Alien registration number",
    "CUST": "Customer account/ID",
    "BENE": "Benefits card/ID",
    "BCNO": "Birth certificate",
    "BUSR": "Business registration/licence",
    "EMID": "Employee number",
    "EMPL": "Employer number",
    "IDNT": "Identity card/national identity number",
    "MEMB": "Membership ID",
    "PHOT": "Photo ID",
    "SECU": "Security ID",
    "SOSE": "Social security ID",
    "STUD": "Student ID",
    "TXID": "Tax number/ID",
}

# MSB AccountType enum (AUSTRAC schema 9.5)
MSB_ACCOUNT_TYPE_CODES = {
    "FCUR": "Foreign currency account",
    "REMIT": "Remittance account",
    "VALCARD": "Stored value card account",
}


# ── Industry-specific auto-population ─────────────────────────────────────────


def build_industry_detail(txn, customer, industry_type: TTRIndustryType) -> dict:
    """
    Build the industry_detail JSON for a TTR draft from transaction
    and customer metadata. Returns a dict matching the AUSTRAC XML schema.

    All values are pre-filled where data is available — blanks indicate
    fields the compliance officer must complete before lodgement.
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
    FBS — Financial and Bullion Services (TTR-FBS-3-0.xsd).

    Key mandatory additions vs base TTR:
      designatedSvc (MANDATORY) — select from DESIGNATED_SVC_FBS
      methodOfConductingTxn (MANDATORY) — how the transaction was conducted
      individualConductingTxn (MANDATORY) — who conducted it physically

    FBS-specific: includes email, digitalCurrencyWallet, deviceIdentifier
    on customer; full denomination breakdown; BSB is optional on account.
    """
    currency = getattr(txn, "currency", "AUD") or "AUD"
    is_foreign = currency.upper() != "AUD"

    return {
        "_schema": "FBS",
        "_schema_version": "3.0",
        # ── MANDATORY: must be set before lodgement ───────────────────────
        # Select from DESIGNATED_SVC_FBS keys (e.g. "ACC_DEP", "RS", "DCE")
        "designated_svc": None,
        # How the transaction was physically conducted.
        # Valid: ARMOURED_CAR_SERVICE | ATM_DEPOSIT | NIGHT_QUICK_DEPOSIT | other (free text)
        "method_of_conducting_txn": None,
        "method_other_description": None,  # free text if method not in standard list
        # Person who physically conducted the transaction (may differ from customer)
        "individual_conducting_txn_same_as_customer": True,  # set False if different person
        "individual_conducting_txn_full_name": None,  # only if not same as customer
        "individual_conducting_txn_dob": None,
        "individual_conducting_txn_address": None,
        "individual_conducting_txn_suburb": None,
        "individual_conducting_txn_state": None,
        "individual_conducting_txn_postcode": None,
        "individual_conducting_txn_country": None,
        "individual_conducting_txn_phone": None,
        "individual_conducting_txn_id_type": None,  # use ID_TYPE_CODES keys
        "individual_conducting_txn_id_number": None,
        # ── Customer supplementary ─────────────────────────────────────────
        # Address split per AUSTRAC schema (addr + suburb + state + postcode + country)
        "customer_suburb": getattr(customer, "suburb", None)
        or getattr(customer, "city", None),
        "customer_state": getattr(customer, "state", None),
        "customer_postcode": getattr(customer, "postcode", None),
        "customer_country": getattr(customer, "country_of_residence", "AU") or "AU",
        "customer_email": getattr(customer, "email", None),  # FBS-only field
        "customer_business_struct": None,  # use BUSINESS_STRUCTURE_CODES keys
        "customer_id_type_code": None,  # use ID_TYPE_CODES keys (e.g. "D", "P")
        "customer_id_issuer": None,  # issuer name (e.g. "VicRoads")
        "customer_id_country": None,  # ISO 3166 country of ID issue
        "customer_ind_occ_type": None,  # M=ANZSIC | O=ASCO | S=ASCO-II | description
        "customer_ind_occ_code": None,  # 4-digit ANZSIC/ASCO code
        "customer_ind_occ_description": None,  # free-text occupation (maxLength 150)
        "customer_digital_currency_wallet": None,  # FBS-only: wallet address
        # ── Transaction / Cash ─────────────────────────────────────────────
        # Cash direction
        "cash_type": _infer_cash_type(txn),
        # cash_deposit | cash_withdrawal | cash_purchase | cash_refund | cash_exchange
        # Money received (cash in) — amounts in AUD
        "money_received_aud_cash": _fmt_amount(
            getattr(txn, "amount_aud", None) or getattr(txn, "amount", None)
        )
        if _infer_cash_type(txn) in ("cash_deposit", "cash_exchange")
        else None,
        "money_received_foreign_currency_code": currency if is_foreign else None,
        "money_received_foreign_amount": _fmt_amount(getattr(txn, "amount", None))
        if is_foreign
        else None,
        # Non-cash received (AUSTRAC element codes — fai/iti/dti/chi/bci etc.)
        # fai = foreign agent incoming | iti = international transfer in | dti = domestic transfer in
        # chi = cheque in | bci = bank cheque in | bdi = bank draft in | tci = traveller's cheque in
        # moi = money order in | ldi = lease/deposit in | ndi = not otherwise included
        # bpi = BPAY in | dfi = direct funds in | sei = security/equity in | bui = bullion in
        # svi = stored value in | oti = other in
        "non_cash_received_fai": None,  # foreign agent incoming (amount AUD)
        "non_cash_received_iti": None,  # international transfer in
        "non_cash_received_dti": None,  # domestic transfer in
        "non_cash_received_chi": None,  # cheque in
        "non_cash_received_bci": None,  # bank cheque in
        "non_cash_received_bdi": None,  # bank draft in
        "non_cash_received_tci": None,  # traveller's cheque in
        "non_cash_received_moi": None,  # money order in
        "non_cash_received_bui": None,  # bullion in (AUD)
        "non_cash_received_svi": None,  # stored value card in
        "non_cash_received_oti_desc": None,  # other in — description
        "non_cash_received_oti_amount": None,  # other in — amount AUD
        # Money provided (cash out) — same element codes with suffix 'o'
        "money_provided_aud_cash": _fmt_amount(
            getattr(txn, "amount_aud", None) or getattr(txn, "amount", None)
        )
        if _infer_cash_type(txn) in ("cash_withdrawal", "cash_exchange")
        else None,
        "non_cash_provided_fao": None,  # foreign agent outgoing
        "non_cash_provided_ito": None,  # international transfer out
        "non_cash_provided_dto": None,  # domestic transfer out
        "non_cash_provided_buo": None,  # bullion out
        "non_cash_provided_sto": None,  # settlement out
        "non_cash_provided_oto_desc": None,
        "non_cash_provided_oto_amount": None,
        # ── Account (AccountOptBSB — BSB is optional for FBS) ─────────────
        "account_title": getattr(txn, "source_account_name", None)
        or getattr(txn, "destination_account_name", None),
        "account_bsb": getattr(txn, "source_bsb", None)
        or getattr(txn, "destination_bsb", None),
        "account_number": getattr(txn, "source_account_number", None)
        or getattr(txn, "destination_account_number", None),
        # Foreign currency (only if non-AUD transaction)
        "is_foreign_currency": is_foreign,
        "foreign_currency_code": currency if is_foreign else None,
        "exchange_rate": _fmt_amount(getattr(txn, "exchange_rate", None)),
        # Bullion-specific (blank unless BULSER designated service)
        "bullion_type": None,  # gold | silver | platinum | palladium | other
        "bullion_weight_grams": None,
        "bullion_purity": None,
        "bullion_spot_price_aud": None,
        # Service channel / device identifier
        "service_channel": getattr(txn, "delivery_channel", None),
        "device_type": None,  # ATM | EFTPOS | self_service | other
        "device_identifier": None,
        # Structured transaction flag (must be manually assessed — never auto-set)
        "is_structured_transaction": False,
        "structuring_notes": None,
    }


def _gs_detail(txn, customer) -> dict:
    """
    GS — Gambling Services (TTR-GS-2-0.xsd).

    Key mandatory additions vs base TTR:
      designatedSvc (MANDATORY) — select from DESIGNATED_SVC_GS
      methodOfConductingTxn (MANDATORY)
      individualConductingTxn (MANDATORY)

    GS-specific: cashContra element for simultaneous chip/cash exchange;
    gaming-specific non-cash codes (gci/egi/oci/cri/wti);
    no BSB on account (AccountNoBSB); no email on customer.
    """
    return {
        "_schema": "GS",
        "_schema_version": "2.0",
        # ── MANDATORY ─────────────────────────────────────────────────────
        # Select from DESIGNATED_SVC_GS keys (e.g. "GAM_BETT", "GAM_EXCH")
        "designated_svc": None,
        # How conducted: ARMOURED_CAR_SERVICE | ATM_DEPOSIT | NIGHT_QUICK_DEPOSIT | other
        "method_of_conducting_txn": None,
        "method_other_description": None,
        "individual_conducting_txn_same_as_customer": True,
        "individual_conducting_txn_full_name": None,
        "individual_conducting_txn_dob": None,
        "individual_conducting_txn_address": None,
        "individual_conducting_txn_suburb": None,
        "individual_conducting_txn_state": None,
        "individual_conducting_txn_postcode": None,
        "individual_conducting_txn_country": None,
        "individual_conducting_txn_phone": None,
        "individual_conducting_txn_id_type": None,
        "individual_conducting_txn_id_number": None,
        # ── Customer supplementary ─────────────────────────────────────────
        "customer_suburb": getattr(customer, "suburb", None)
        or getattr(customer, "city", None),
        "customer_state": getattr(customer, "state", None),
        "customer_postcode": getattr(customer, "postcode", None),
        "customer_country": getattr(customer, "country_of_residence", "AU") or "AU",
        # Note: GS schema does NOT include email or digitalCurrencyWallet
        "customer_business_struct": None,
        "customer_id_type_code": None,
        "customer_id_issuer": None,
        "customer_id_country": None,
        "customer_ind_occ_description": None,  # maxLength 150
        # ── Venue ──────────────────────────────────────────────────────────
        "venue_name": None,
        "venue_address": None,
        "venue_suburb": None,
        "venue_state": None,
        "venue_postcode": None,
        "gaming_licence_number": None,
        "gaming_area": None,  # Main Floor | VIP Room | Sports Bar | etc.
        # ── Patron ────────────────────────────────────────────────────────
        "patron_id": getattr(customer, "external_ref", None),
        "patron_membership_number": None,
        "patron_vip_status": None,
        # ── Transaction — cash received / provided ─────────────────────────
        # GS uses EITHER moneyReceived OR moneyProvided (choice), not both.
        # cashContra = simultaneous cash exchange (cash in + chips out at same time)
        "gambling_txn_direction": _infer_gambling_direction(txn),
        # money_received | money_provided
        # Cash amounts
        "cash_aud_received": None,  # AUD cash received from patron
        "cash_aud_provided": None,  # AUD cash paid to patron
        # cashContra amounts (GS-only — used for GAM_EXCH service type)
        "cash_contra_aud_received": None,  # cash received contra (simultaneous exchange)
        "cash_contra_aud_provided": None,  # cash provided contra
        # Non-cash received (GS-specific AUSTRAC element codes):
        # fai = foreign agent incoming
        # gci = gaming chips in | egi = e-gaming currency in | oci = other chips/tokens in
        # cri = credit/debit card in | wti = winnings tokens in
        # tci = traveller's cheque in | chi = cheque in | bci = bank cheque in | bdi = bank draft in
        # svi = stored value card in | oti = other in
        "non_cash_received_fai": None,
        "non_cash_received_gci": None,  # gaming chips in (amount AUD)
        "non_cash_received_egi": None,  # e-gaming currency in
        "non_cash_received_oci": None,  # other chips/tokens in
        "non_cash_received_cri": None,  # credit card in
        "non_cash_received_wti": None,  # winnings tokens in
        "non_cash_received_svi": None,  # stored value card in
        "non_cash_received_oti_desc": None,
        "non_cash_received_oti_amount": None,
        # Non-cash provided (GS):
        # fao = foreign agent out | ito = international transfer out | gco = gaming chips out
        # bio = betting in out | bpo = bonus payout | mro = manual refund out | cho = cheque out
        # sio = stored value issued | sto = security transaction out | oto = other out
        "non_cash_provided_fao": None,
        "non_cash_provided_ito": None,
        "non_cash_provided_gco": None,  # gaming chips out
        "non_cash_provided_bio": None,  # betting payout out
        "non_cash_provided_bpo": None,  # bonus payout
        "non_cash_provided_mro": None,  # manual refund
        "non_cash_provided_cho": None,  # cheque out
        "non_cash_provided_sio": None,  # stored value issued
        "non_cash_provided_oto_desc": None,
        "non_cash_provided_oto_amount": None,
        # ── Account (AccountNoBSB — NO BSB field in GS schema) ────────────
        "account_title": None,  # account title/name (maxLength 140)
        "account_number": None,  # account number (maxLength 34) — no BSB
        # ── Game details ──────────────────────────────────────────────────
        "game_type": None,
        # table_games | electronic_gaming_machines | sports_betting | keno | lottery | other
        "table_number": None,
        "machine_number": None,
        "chip_denomination": None,  # denomination of chips/tokens (AUD)
        "chip_count": None,
        # Multiple transactions indicator
        "is_multiple_transactions": False,
        "multiple_transaction_notes": None,
    }


def _isi_detail(txn, customer) -> dict:
    """
    ISI — Investment / Superannuation / Insurance (TTR-ISI-2-0.xsd).

    Key mandatory additions vs base TTR:
      designatedSvc (MANDATORY) — select from DESIGNATED_SVC_ISI
      methodOfConductingTxn (MANDATORY)
      individualConductingTxn (MANDATORY)

    ISI-specific: ECurrency non-cash type; AccountNoBSB (no BSB);
    no email on customer.
    """
    return {
        "_schema": "ISI",
        "_schema_version": "2.0",
        # ── MANDATORY ─────────────────────────────────────────────────────
        # Select from DESIGNATED_SVC_ISI keys (e.g. "SUPERANN", "LIFE_INS")
        "designated_svc": None,
        "method_of_conducting_txn": None,
        "method_other_description": None,
        "individual_conducting_txn_same_as_customer": True,
        "individual_conducting_txn_full_name": None,
        "individual_conducting_txn_dob": None,
        "individual_conducting_txn_address": None,
        "individual_conducting_txn_suburb": None,
        "individual_conducting_txn_state": None,
        "individual_conducting_txn_postcode": None,
        "individual_conducting_txn_country": None,
        "individual_conducting_txn_phone": None,
        "individual_conducting_txn_id_type": None,
        "individual_conducting_txn_id_number": None,
        # ── Customer supplementary ─────────────────────────────────────────
        "customer_suburb": getattr(customer, "suburb", None)
        or getattr(customer, "city", None),
        "customer_state": getattr(customer, "state", None),
        "customer_postcode": getattr(customer, "postcode", None),
        "customer_country": getattr(customer, "country_of_residence", "AU") or "AU",
        "customer_business_struct": None,
        "customer_id_type_code": None,
        "customer_id_issuer": None,
        "customer_id_country": None,
        "customer_ind_occ_description": None,
        # ── Product / Fund details ─────────────────────────────────────────
        "policy_number": getattr(txn, "reference_number", None),
        "account_reference": getattr(txn, "source_account_number", None),
        "fund_name": None,
        "trustee_name": None,
        "trustee_abn": None,
        "product_provider_name": None,
        "product_provider_abn": None,
        # ── Transaction purpose ────────────────────────────────────────────
        "contribution_type": None,
        # voluntary_contribution | employer_contribution | rollover | premium_payment |
        # benefit_payment | withdrawal | surrender | claim_payout | other
        "investment_type": _infer_investment_type(txn),
        "financial_year": _current_financial_year(),
        # ── Non-cash received (ISI-specific AUSTRAC codes) ─────────────────
        # fai = foreign agent incoming | dti = domestic transfer in
        # chi = cheque in | bci = bank cheque in | bdi = bank draft in
        # bpi = BPAY in | dfi = direct funds in (dividends/income)
        # sei = security/equity exchange in | eci = e-currency in | oti = other in
        "non_cash_received_fai": None,
        "non_cash_received_dti": None,
        "non_cash_received_chi": None,
        "non_cash_received_bci": None,
        "non_cash_received_bdi": None,
        "non_cash_received_bpi": None,  # BPAY in
        "non_cash_received_dfi": None,  # dividend/fund income in
        "non_cash_received_sei": None,  # security/equity exchange in
        "non_cash_received_eci_description": None,  # e-currency description
        "non_cash_received_eci_amount": None,  # e-currency amount AUD
        "non_cash_received_oti_desc": None,
        "non_cash_received_oti_amount": None,
        # Non-cash provided (ISI):
        # fao | dto | cho | cpo (capital payout) | dfo | seo (security/equity out)
        # eco (e-currency out) | fco (fund credit out) | oto
        "non_cash_provided_fao": None,
        "non_cash_provided_dto": None,
        "non_cash_provided_cho": None,
        "non_cash_provided_cpo": None,  # capital payout
        "non_cash_provided_dfo": None,  # direct funds out
        "non_cash_provided_seo": None,  # security/equity out
        "non_cash_provided_eco_description": None,
        "non_cash_provided_eco_amount": None,
        "non_cash_provided_fco": None,  # fund credit out
        "non_cash_provided_oto_desc": None,
        "non_cash_provided_oto_amount": None,
        # ── Account (AccountNoBSB — no BSB in ISI schema) ─────────────────
        "account_title": None,
        "account_number": None,
        # ── Beneficiary ───────────────────────────────────────────────────
        "beneficiary_name": None,
        "beneficiary_dob": None,
        "beneficiary_relationship": None,
        # ── Adviser ───────────────────────────────────────────────────────
        "financial_adviser_name": None,
        "financial_adviser_afsl": None,
        # ── Rollover details (SUPERANN/BUS_RSA) ───────────────────────────
        "rollover_from_fund": None,
        "rollover_from_abn": None,
        # ── Tax ───────────────────────────────────────────────────────────
        "tax_file_number_provided": False,
        "concessional_contribution": False,
    }


def _msb_detail(txn, customer) -> dict:
    """
    MSB — Money Services Business (TTR-MSB-2-0.xsd).

    Key mandatory additions vs base TTR:
      designatedSvc (MANDATORY) — select from DESIGNATED_SVC_MSB
      methodOfConductingTxn (MANDATORY)
      individualConductingTxn (MANDATORY)

    MSB-specific: remittance corridor; sender/receiver details; agent chain;
    AccountType restricted to FCUR | REMIT | VALCARD.
    """
    currency = getattr(txn, "currency", "AUD") or "AUD"
    destination_country = getattr(txn, "destination_country", None)
    source_country = getattr(txn, "source_country", None)

    return {
        "_schema": "MSB",
        "_schema_version": "2.0",
        # ── MANDATORY ─────────────────────────────────────────────────────
        # Select from DESIGNATED_SVC_MSB keys (e.g. "RS", "CUR_EXCH")
        "designated_svc": None,
        "method_of_conducting_txn": None,
        "method_other_description": None,
        "individual_conducting_txn_same_as_customer": True,
        "individual_conducting_txn_full_name": None,
        "individual_conducting_txn_dob": None,
        "individual_conducting_txn_address": None,
        "individual_conducting_txn_suburb": None,
        "individual_conducting_txn_state": None,
        "individual_conducting_txn_postcode": None,
        "individual_conducting_txn_country": None,
        "individual_conducting_txn_phone": None,
        "individual_conducting_txn_id_type": None,
        "individual_conducting_txn_id_number": None,
        # ── Customer (sender) supplementary ───────────────────────────────
        "customer_suburb": getattr(customer, "suburb", None)
        or getattr(customer, "city", None),
        "customer_state": getattr(customer, "state", None),
        "customer_postcode": getattr(customer, "postcode", None),
        "customer_country": getattr(customer, "country_of_residence", "AU") or "AU",
        "customer_business_struct": None,
        "customer_id_type_code": None,
        "customer_id_issuer": None,
        "customer_id_country": None,
        "customer_ind_occ_description": None,
        # ── Remittance corridor ────────────────────────────────────────────
        "remittance_direction": _infer_remittance_direction(txn),
        # send | receive | exchange
        "send_country": source_country or "AU",
        "receive_country": destination_country,
        "send_currency": "AUD",
        "receive_currency": currency if currency != "AUD" else None,
        "exchange_rate_applied": _fmt_amount(getattr(txn, "exchange_rate", None)),
        "amount_send_aud": _fmt_amount(
            getattr(txn, "amount_aud", None) or getattr(txn, "amount", None)
        ),
        "amount_receive_foreign": _fmt_amount(getattr(txn, "amount", None))
        if currency != "AUD"
        else None,
        "fee_aud": None,
        # ── Settlement ────────────────────────────────────────────────────
        "settlement_method": None,
        # bank_transfer | cash_pickup | mobile_wallet | crypto | cheque | other
        "settlement_date": _fmt_date(getattr(txn, "transaction_date", None)),
        # ── Sender (customer) identity ────────────────────────────────────
        "sender_name": getattr(customer, "full_name", None),
        "sender_dob": _fmt_date(getattr(customer, "date_of_birth", None)),
        "sender_address": getattr(customer, "address_line1", None),
        "sender_suburb": getattr(customer, "suburb", None)
        or getattr(customer, "city", None),
        "sender_state": getattr(customer, "state", None),
        "sender_postcode": getattr(customer, "postcode", None),
        "sender_country": getattr(customer, "country_of_residence", "AU"),
        "sender_phone": getattr(customer, "phone", None),
        "sender_id_type": None,  # use ID_TYPE_CODES keys
        "sender_id_number": None,
        "sender_id_country": None,
        # ── Receiver (beneficiary) ────────────────────────────────────────
        "receiver_name": getattr(txn, "destination_account_name", None),
        "receiver_address": None,
        "receiver_suburb": None,
        "receiver_country": destination_country,
        "receiver_phone": None,
        "receiver_dob": None,
        # ── Receiver account (MSB AccountType: FCUR | REMIT | VALCARD) ────
        "receiver_account_title": getattr(txn, "destination_account_name", None),
        "receiver_account_number": getattr(txn, "destination_account_number", None),
        "receiver_account_type": None,  # use MSB_ACCOUNT_TYPE_CODES keys
        # ── Non-cash received (MSB codes) ─────────────────────────────────
        # MSB: cheque | moneyOrder | travellersCheque | remittance | eCurrency
        #      storedValueCard | otherNonCash
        "non_cash_received_cheque_amount": None,
        "non_cash_received_cheque_drawer": None,
        "non_cash_received_cheque_payee": None,
        "non_cash_received_money_order": None,
        "non_cash_received_travellers_cheque": None,
        "non_cash_received_remittance": None,
        "non_cash_received_stored_value_card": None,
        "non_cash_received_ecurrency_desc": None,
        "non_cash_received_ecurrency_amount": None,
        "non_cash_received_other_desc": None,  # maxLength 30
        "non_cash_received_other_amount": None,
        # Non-cash provided (same types)
        "non_cash_provided_cheque_amount": None,
        "non_cash_provided_cheque_drawer": None,
        "non_cash_provided_cheque_payee": None,
        "non_cash_provided_money_order": None,
        "non_cash_provided_travellers_cheque": None,
        "non_cash_provided_remittance": None,
        "non_cash_provided_stored_value_card": None,
        "non_cash_provided_ecurrency_desc": None,
        "non_cash_provided_ecurrency_amount": None,
        "non_cash_provided_other_desc": None,
        "non_cash_provided_other_amount": None,
        # ── Agent chain (sub-agent / network member) ──────────────────────
        "agent_name": None,
        "agent_austrac_id": None,
        "agent_abn": None,
        "agent_address": None,
        # Relationship between sender and receiver
        "sender_receiver_relationship": None,
        # Tipping-off flag (must never be auto-set)
        "tipping_off_risk": False,
        "tipping_off_notes": None,
    }


# ── Inference helpers ─────────────────────────────────────────────────────────


def _infer_cash_type(txn) -> Optional[str]:
    direction = getattr(txn, "direction", None)
    payment_method = getattr(txn, "payment_method", None)
    pm = (
        payment_method.value
        if hasattr(payment_method, "value")
        else str(payment_method or "")
    )
    if "deposit" in pm.lower() or direction == "credit":
        return "cash_deposit"
    if "withdrawal" in pm.lower() or direction == "debit":
        return "cash_withdrawal"
    if "purchase" in pm.lower():
        return "cash_purchase"
    return None


def _infer_gambling_direction(txn) -> Optional[str]:
    direction = getattr(txn, "direction", None)
    if direction == "credit":
        return "money_received"
    if direction == "debit":
        return "money_provided"
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
#
# AUSTRAC TTR CSV column specifications per industry type.
# Common columns are shared across all industries.
# Industry-specific columns follow per AUSTRAC TTR XML schema field names.
#
# NOTE: The official AUSTRAC batch submission format is XML (XSD-validated).
# This CSV is provided as a drafting/review aid and internal record.

_COMMON_COLUMNS = [
    # Report metadata
    "report_ref",
    "industry_type",
    "status",
    "due_date",
    "prepared_by",
    # Transaction
    "transaction_date",
    "total_amount_aud",
    "transaction_type",
    "currency",
    # Customer (core)
    "customer_name",
    "customer_dob",
    "customer_address",
    "customer_suburb",
    "customer_state",
    "customer_postcode",
    "customer_country",
    "customer_occupation",
    "customer_abn",
    "customer_id_type",
    "customer_id_number",
    # Branch / service point
    "branch_name",
    "branch_address",
    "branch_bsb",
    # Account
    "account_name",
    "account_number",
    "account_bsb",
    # Third party
    "third_party_name",
    "third_party_relationship",
    # Reporter
    "reporter_name",
    "reporter_abn",
    "reporter_austrac_id",
]

_INDUSTRY_EXTRA_COLUMNS: dict[TTRIndustryType, list[str]] = {
    TTRIndustryType.FBS: [
        # Mandatory AUSTRAC XML fields
        "designated_svc",
        "method_of_conducting_txn",
        "method_other_description",
        "individual_conducting_txn_same_as_customer",
        "individual_conducting_txn_full_name",
        "individual_conducting_txn_dob",
        "individual_conducting_txn_id_type",
        "individual_conducting_txn_id_number",
        # Customer supplementary
        "customer_email",
        "customer_business_struct",
        "customer_id_type_code",
        "customer_id_issuer",
        "customer_id_country",
        "customer_ind_occ_type",
        "customer_ind_occ_code",
        "customer_ind_occ_description",
        # Cash
        "cash_type",
        "money_received_aud_cash",
        "money_received_foreign_currency_code",
        "money_received_foreign_amount",
        # Non-cash received
        "non_cash_received_fai",
        "non_cash_received_iti",
        "non_cash_received_dti",
        "non_cash_received_chi",
        "non_cash_received_bci",
        "non_cash_received_bdi",
        "non_cash_received_tci",
        "non_cash_received_moi",
        "non_cash_received_bui",
        "non_cash_received_svi",
        "non_cash_received_oti_desc",
        "non_cash_received_oti_amount",
        # Non-cash provided
        "money_provided_aud_cash",
        "non_cash_provided_fao",
        "non_cash_provided_ito",
        "non_cash_provided_dto",
        "non_cash_provided_buo",
        "non_cash_provided_sto",
        "non_cash_provided_oto_desc",
        "non_cash_provided_oto_amount",
        # Account
        "account_title",
        "account_bsb",
        # FX / Bullion
        "is_foreign_currency",
        "foreign_currency_code",
        "exchange_rate",
        "bullion_type",
        "bullion_weight_grams",
        "bullion_purity",
        "bullion_spot_price_aud",
        # Other
        "service_channel",
        "is_structured_transaction",
        "structuring_notes",
    ],
    TTRIndustryType.GS: [
        "designated_svc",
        "method_of_conducting_txn",
        "method_other_description",
        "individual_conducting_txn_same_as_customer",
        "individual_conducting_txn_full_name",
        "individual_conducting_txn_dob",
        "individual_conducting_txn_id_type",
        "individual_conducting_txn_id_number",
        "customer_business_struct",
        "customer_id_type_code",
        "customer_id_issuer",
        "customer_id_country",
        "customer_ind_occ_description",
        "venue_name",
        "venue_address",
        "venue_suburb",
        "venue_state",
        "venue_postcode",
        "gaming_licence_number",
        "gaming_area",
        "patron_id",
        "patron_membership_number",
        "gambling_txn_direction",
        "cash_aud_received",
        "cash_aud_provided",
        "cash_contra_aud_received",
        "cash_contra_aud_provided",
        "non_cash_received_fai",
        "non_cash_received_gci",
        "non_cash_received_egi",
        "non_cash_received_oci",
        "non_cash_received_cri",
        "non_cash_received_wti",
        "non_cash_received_svi",
        "non_cash_received_oti_desc",
        "non_cash_received_oti_amount",
        "non_cash_provided_fao",
        "non_cash_provided_ito",
        "non_cash_provided_gco",
        "non_cash_provided_bio",
        "non_cash_provided_bpo",
        "non_cash_provided_mro",
        "non_cash_provided_cho",
        "non_cash_provided_sio",
        "non_cash_provided_oto_desc",
        "non_cash_provided_oto_amount",
        "account_title",
        "account_number",
        "game_type",
        "table_number",
        "machine_number",
        "chip_denomination",
        "chip_count",
        "is_multiple_transactions",
        "multiple_transaction_notes",
    ],
    TTRIndustryType.ISI: [
        "designated_svc",
        "method_of_conducting_txn",
        "method_other_description",
        "individual_conducting_txn_same_as_customer",
        "individual_conducting_txn_full_name",
        "individual_conducting_txn_dob",
        "individual_conducting_txn_id_type",
        "individual_conducting_txn_id_number",
        "customer_business_struct",
        "customer_id_type_code",
        "customer_id_issuer",
        "customer_id_country",
        "customer_ind_occ_description",
        "policy_number",
        "account_reference",
        "fund_name",
        "trustee_name",
        "trustee_abn",
        "product_provider_name",
        "product_provider_abn",
        "contribution_type",
        "investment_type",
        "financial_year",
        "non_cash_received_fai",
        "non_cash_received_dti",
        "non_cash_received_chi",
        "non_cash_received_bci",
        "non_cash_received_bdi",
        "non_cash_received_bpi",
        "non_cash_received_dfi",
        "non_cash_received_sei",
        "non_cash_received_eci_description",
        "non_cash_received_eci_amount",
        "non_cash_received_oti_desc",
        "non_cash_received_oti_amount",
        "non_cash_provided_fao",
        "non_cash_provided_dto",
        "non_cash_provided_cho",
        "non_cash_provided_cpo",
        "non_cash_provided_dfo",
        "non_cash_provided_seo",
        "non_cash_provided_eco_description",
        "non_cash_provided_eco_amount",
        "non_cash_provided_fco",
        "non_cash_provided_oto_desc",
        "non_cash_provided_oto_amount",
        "account_title",
        "account_number",
        "beneficiary_name",
        "beneficiary_dob",
        "beneficiary_relationship",
        "financial_adviser_name",
        "financial_adviser_afsl",
        "rollover_from_fund",
        "rollover_from_abn",
        "tax_file_number_provided",
        "concessional_contribution",
    ],
    TTRIndustryType.MSB: [
        "designated_svc",
        "method_of_conducting_txn",
        "method_other_description",
        "individual_conducting_txn_same_as_customer",
        "individual_conducting_txn_full_name",
        "individual_conducting_txn_dob",
        "individual_conducting_txn_id_type",
        "individual_conducting_txn_id_number",
        "customer_business_struct",
        "customer_id_type_code",
        "customer_id_issuer",
        "customer_id_country",
        "customer_ind_occ_description",
        "remittance_direction",
        "send_country",
        "receive_country",
        "send_currency",
        "receive_currency",
        "exchange_rate_applied",
        "amount_send_aud",
        "amount_receive_foreign",
        "fee_aud",
        "settlement_method",
        "settlement_date",
        "sender_name",
        "sender_dob",
        "sender_address",
        "sender_suburb",
        "sender_state",
        "sender_postcode",
        "sender_country",
        "sender_phone",
        "sender_id_type",
        "sender_id_number",
        "sender_id_country",
        "receiver_name",
        "receiver_address",
        "receiver_suburb",
        "receiver_country",
        "receiver_phone",
        "receiver_dob",
        "receiver_account_title",
        "receiver_account_number",
        "receiver_account_type",
        "non_cash_received_cheque_amount",
        "non_cash_received_cheque_drawer",
        "non_cash_received_money_order",
        "non_cash_received_travellers_cheque",
        "non_cash_received_remittance",
        "non_cash_received_stored_value_card",
        "non_cash_received_ecurrency_desc",
        "non_cash_received_ecurrency_amount",
        "non_cash_received_other_desc",
        "non_cash_received_other_amount",
        "non_cash_provided_cheque_amount",
        "non_cash_provided_cheque_drawer",
        "non_cash_provided_money_order",
        "non_cash_provided_travellers_cheque",
        "non_cash_provided_remittance",
        "non_cash_provided_stored_value_card",
        "non_cash_provided_ecurrency_desc",
        "non_cash_provided_ecurrency_amount",
        "non_cash_provided_other_desc",
        "non_cash_provided_other_amount",
        "agent_name",
        "agent_austrac_id",
        "agent_abn",
        "sender_receiver_relationship",
    ],
}


def generate_ttr_csv(report: TTRReport) -> str:
    """
    Generate AUSTRAC-format CSV for a TTR report.

    Returns a UTF-8 string with:
      Row 1 — column headers
      Row 2 — report data
      Row 3 — disclaimer

    Columns: common AUSTRAC TTR fields + industry-specific fields.
    All non-cash element codes match AUSTRAC XML schema element names.

    NOTE: Official AUSTRAC submission format is XML (XSD-validated).
    This CSV is a drafting aid — review all values before lodgement.
    """
    industry = report.industry_type
    extra_cols = _INDUSTRY_EXTRA_COLUMNS.get(industry, []) if industry else []
    columns = _COMMON_COLUMNS + extra_cols

    detail = report.industry_detail or {}

    row: dict[str, str] = {
        "report_ref": report.report_ref or "",
        "industry_type": industry.value if industry else "",
        "status": report.status.value if report.status else "",
        "due_date": _fmt_date(report.due_date),
        "prepared_by": report.prepared_by or "",
        "transaction_date": _fmt_date(report.transaction_date),
        "total_amount_aud": _fmt_amount(report.total_amount),
        "transaction_type": report.transaction_type or "",
        "currency": report.currency or "AUD",
        "customer_name": report.customer_name or "",
        "customer_dob": _fmt_date(report.customer_dob),
        "customer_address": report.customer_address or "",
        "customer_suburb": detail.get("customer_suburb") or "",
        "customer_state": detail.get("customer_state") or "",
        "customer_postcode": detail.get("customer_postcode") or "",
        "customer_country": detail.get("customer_country") or "",
        "customer_occupation": report.customer_occupation or "",
        "customer_abn": report.customer_abn or "",
        "customer_id_type": report.customer_id_type or "",
        "customer_id_number": report.customer_id_number or "",
        "branch_name": report.branch_name or "",
        "branch_address": report.branch_address or "",
        "branch_bsb": report.branch_bsb or "",
        "account_name": report.account_name or "",
        "account_number": report.account_number or "",
        "account_bsb": report.account_bsb or "",
        "third_party_name": report.third_party_name or "",
        "third_party_relationship": report.third_party_relationship or "",
        "reporter_name": report.reporter_name or "",
        "reporter_abn": report.reporter_abn or "",
        "reporter_austrac_id": report.reporter_austrac_id or "",
    }

    for col in extra_cols:
        val = detail.get(col)
        if val is None:
            row[col] = ""
        elif isinstance(val, bool):
            row[col] = "Y" if val else "N"
        elif isinstance(val, dict):
            row[col] = ""
        else:
            row[col] = str(val)

    output = io.StringIO()
    writer = csv.DictWriter(
        output,
        fieldnames=columns,
        extrasaction="ignore",
        lineterminator="\r\n",
    )
    writer.writeheader()
    writer.writerow(row)

    output.write(
        "\r\n"
        "# DISCLAIMER: This CSV is a drafting aid only. "
        "All values must be verified by the reporting entity before lodgement. "
        "Official AUSTRAC submission format is XML (XSD-validated). "
        "The reporting entity is solely responsible for accuracy and lodgement deadlines.\r\n"
    )

    return output.getvalue()


# ── AUSTRAC XML Submission Payload Builder ────────────────────────────────────


def build_austrac_submission_payload(report: TTRReport) -> dict:
    """
    Build the AUSTRAC Connect API v2 submission payload in XML-schema-aligned
    JSON structure. Maps our field names to AUSTRAC XML element names.

    NOTE: AUSTRAC Connect API access requires accreditation and a signed
    Data Exchange Agreement. This returns the structured payload for review.
    Actual HTTP submission requires live OAuth 2.0 credentials.

    XML schema namespaces:
      FBS: http://austrac.gov.au/schema/reporting/TTR-FBS-3-0
      GS:  http://austrac.gov.au/schema/reporting/TTR-GS-2-0
      ISI: http://austrac.gov.au/schema/reporting/TTR-ISI-2-0
      MSB: http://austrac.gov.au/schema/reporting/TTR-MSB-2-0

    DISCLAIMER: Platform does not submit automatically. All lodgement
    decisions and timing remain with the reporting entity.
    """
    industry = report.industry_type
    detail = report.industry_detail or {}

    schema_namespace = {
        TTRIndustryType.FBS: "http://austrac.gov.au/schema/reporting/TTR-FBS-3-0",
        TTRIndustryType.GS: "http://austrac.gov.au/schema/reporting/TTR-GS-2-0",
        TTRIndustryType.ISI: "http://austrac.gov.au/schema/reporting/TTR-ISI-2-0",
        TTRIndustryType.MSB: "http://austrac.gov.au/schema/reporting/TTR-MSB-2-0",
    }.get(industry, "")

    payload = {
        "_namespace": schema_namespace,
        "_schema_version": detail.get("_schema_version"),
        "reNumber": report.reporter_austrac_id,  # max 7 digits, [0-9]{1,7}
        "reportCount": 1,
        "report": {
            "header": {
                "txnRefNo": report.report_ref,  # maxLength 40
                "reportingBranch": {
                    "branchId": report.branch_bsb,
                    "name": report.branch_name,  # maxLength 120
                    "address": {
                        "addr": report.branch_address,
                        "suburb": None,  # required — set from org config
                        "state": None,
                        "postcode": None,
                        # no country in AddressNoCountry (reporting branch is Australian)
                    },
                },
            },
            "customer": {
                "fullName": report.customer_name,  # maxLength 140
                "mainAddress": {
                    "addr": report.customer_address,
                    "suburb": detail.get("customer_suburb"),
                    "state": detail.get("customer_state"),
                    "postcode": detail.get("customer_postcode"),
                    "country": detail.get("customer_country", "Australia"),
                },
                "dob": _fmt_date(report.customer_dob),
                "abn": report.customer_abn,
                "businessStruct": detail.get("customer_business_struct"),
                "identification": {
                    "type": detail.get("customer_id_type_code")
                    or report.customer_id_type,
                    "number": report.customer_id_number,  # maxLength 20
                    "issuer": detail.get("customer_id_issuer"),  # maxLength 100
                    "country": detail.get("customer_id_country"),
                }
                if report.customer_id_number
                else None,
                "indOcc": {
                    "description": detail.get("customer_ind_occ_description"),
                }
                if detail.get("customer_ind_occ_description")
                else None,
                "account": {
                    "title": report.account_name,  # maxLength 140
                    "number": report.account_number,  # maxLength 34
                    "bsb": report.account_bsb,  # FBS only — optional
                }
                if report.account_number
                else None,
            },
            "individualConductingTxn": {
                "sameAsCustomer": detail.get(
                    "individual_conducting_txn_same_as_customer", True
                ),
                "fullName": detail.get("individual_conducting_txn_full_name"),
                "dob": detail.get("individual_conducting_txn_dob"),
                "phone": detail.get("individual_conducting_txn_phone"),
                "identification": {
                    "type": detail.get("individual_conducting_txn_id_type"),
                    "number": detail.get("individual_conducting_txn_id_number"),
                }
                if detail.get("individual_conducting_txn_id_number")
                else None,
                "mainAddress": {
                    "addr": detail.get("individual_conducting_txn_address"),
                    "suburb": detail.get("individual_conducting_txn_suburb"),
                    "state": detail.get("individual_conducting_txn_state"),
                    "postcode": detail.get("individual_conducting_txn_postcode"),
                    "country": detail.get("individual_conducting_txn_country"),
                }
                if detail.get("individual_conducting_txn_address")
                else None,
            },
            "methodOfConductingTxn": {
                "method": detail.get("method_of_conducting_txn"),
                "otherMethod": detail.get("method_other_description"),
            },
            "transaction": {
                "txnDate": _fmt_date(report.transaction_date),
                "totalAmount": {
                    "currency": "AUD",
                    "amount": _fmt_amount(report.total_amount),
                },
                "designatedSvc": detail.get("designated_svc"),
                "moneyReceived": _build_money_section(
                    "received", report, detail, industry
                ),
                "moneyProvided": _build_money_section(
                    "provided", report, detail, industry
                ),
            },
        },
        "_submissionNote": (
            "PLACEHOLDER — Live submission requires AUSTRAC Connect API credentials "
            "and a signed Data Exchange Agreement. Contact AUSTRAC for accreditation."
        ),
    }
    return payload


def _build_money_section(
    direction: str, report: TTRReport, detail: dict, industry
) -> dict:
    """Build moneyReceived or moneyProvided section per AUSTRAC XML schema."""
    suffix_i = "received" if direction == "received" else "provided"
    suffix_nc = "received" if direction == "received" else "provided"

    cash_key = (
        f"money_{suffix_i}_aud_cash"
        if direction == "received"
        else f"money_{suffix_nc}_aud_cash"
    )
    if industry == TTRIndustryType.GS:
        cash_key = f"cash_aud_{suffix_i}"

    return {
        "cash": {
            "ausCash": {
                "currency": "AUD",
                "amount": detail.get(cash_key),
            },
            "foreignCash": {
                "currency": detail.get("receive_currency")
                or detail.get("money_received_foreign_currency_code"),
                "amount": detail.get("amount_receive_foreign")
                or detail.get("money_received_foreign_amount"),
            }
            if detail.get("money_received_foreign_currency_code")
            or detail.get("receive_currency")
            else None,
        }
        if detail.get(cash_key)
        else None,
    }
