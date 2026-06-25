"""
Bulk Customer Import Service — CSV and Excel upload processing.

Fields aligned with AUSTRAC IFTI-DRA ordering customer (sender) and
beneficiary customer (recipient) field specifications, plus core CDD fields.

IFTI-DRA field mapping:
  Ordering customer (sender)  → oc_* fields
  Beneficiary customer        → bc_* fields

Supports:
  - CSV (.csv) — UTF-8 or Latin-1 encoded
  - Excel (.xlsx) — first sheet used

Column mapping is alias-tolerant (accepts common header variations).
Required: at least one of email or full_name must be present per row.

DISCLAIMER: Imported customers are created in DRAFT status.
AML/CTF CDD obligations must be completed before onboarding is finalised.
All compliance decisions remain with the reporting entity.
"""

import csv
import io

# ── Importable field definitions ──────────────────────────────────────────────
# (canonical_name, aliases, required, example_individual, example_business, help)

IMPORT_FIELDS = [
    # ── Core Identity ─────────────────────────────────────────────────────────
    (
        "customer_type",
        ["customer_type", "type", "entity_type"],
        False,
        "individual",
        "business",
        "individual | business | trust | partnership | government | other",
    ),
    (
        "full_name",
        [
            "full_name",
            "name",
            "fullname",
            "customer_name",
            "applicant_name",
            "oc_full_name",
            "ordering_customer_name",
            "sender_name",
        ],
        False,
        "Jane Smith",
        "Acme Pty Ltd",
        "Full legal name. Aligns with IFTI-DRA orderingCustomer.name / transferor.name.",
    ),
    (
        "first_name",
        ["first_name", "firstname", "given_name", "given_names"],
        False,
        "Jane",
        "",
        "Individual: given name(s). Combined with last_name to form full_name if full_name not provided.",
    ),
    (
        "last_name",
        ["last_name", "lastname", "surname", "family_name"],
        False,
        "Smith",
        "",
        "Individual: family name.",
    ),
    (
        "other_name",
        ["other_name", "alias", "also_known_as", "trading_name", "oc_other_name"],
        False,
        "",
        "Acme Trading",
        "Alias, trading name, or other name. Aligns with IFTI-DRA orderingCustomer.otherName.",
    ),
    (
        "email",
        [
            "email",
            "email_address",
            "e-mail",
            "applicant_email",
            "contact_email",
            "oc_email",
            "sender_email",
        ],
        False,
        "jane@example.com",
        "accounts@acme.com.au",
        "Primary email address. Aligns with IFTI-DRA orderingCustomer.email.",
    ),
    (
        "phone",
        [
            "phone",
            "mobile",
            "phone_number",
            "mobile_number",
            "contact_number",
            "telephone",
            "oc_phone",
            "sender_phone",
        ],
        False,
        "+61400000001",
        "+61299990001",
        "E.164 format preferred (+61400000001). Aligns with IFTI-DRA orderingCustomer.phone.",
    ),
    (
        "date_of_birth",
        ["date_of_birth", "dob", "birth_date", "birthdate", "oc_dob", "sender_dob"],
        False,
        "1985-06-15",
        "",
        "Individual only. Format: YYYY-MM-DD. Aligns with IFTI-DRA orderingCustomer.dateOfBirth.",
    ),
    (
        "occupation",
        [
            "occupation",
            "job_title",
            "profession",
            "employment",
            "oc_occupation",
            "sender_occupation",
        ],
        False,
        "Accountant",
        "",
        "Current occupation or profession. Aligns with IFTI-DRA orderingCustomer.occupation.",
    ),
    (
        "employer_name",
        [
            "employer_name",
            "employer",
            "company",
            "business_name",
            "organisation",
            "organization",
            "oc_business_name",
        ],
        False,
        "BDO Australia",
        "Acme Pty Ltd",
        "Employer or operating business name.",
    ),
    # ── Identity Documents (IFTI-DRA id1 / id2) ───────────────────────────────
    (
        "id1_type",
        ["id1_type", "id_type", "identity_doc_type", "oc_id1_type", "document_type"],
        False,
        "Australian Driver Licence",
        "",
        "Primary identity document type. E.g. 'Australian Driver Licence', 'Passport'. "
        "Aligns with IFTI-DRA orderingCustomer.id1Type.",
    ),
    (
        "id1_number",
        ["id1_number", "id_number", "document_number", "oc_id1_number"],
        False,
        "12345678",
        "",
        "Primary identity document number. Aligns with IFTI-DRA orderingCustomer.id1Number.",
    ),
    (
        "id1_issuer",
        [
            "id1_issuer",
            "id_issuer",
            "issuing_authority",
            "oc_id1_issuer",
            "document_issuer",
        ],
        False,
        "VIC",
        "",
        "Issuing authority (state/country). Aligns with IFTI-DRA orderingCustomer.id1Issuer.",
    ),
    (
        "id2_type",
        ["id2_type", "second_id_type", "oc_id2_type"],
        False,
        "",
        "",
        "Secondary identity document type (optional).",
    ),
    (
        "id2_number",
        ["id2_number", "second_id_number", "oc_id2_number"],
        False,
        "",
        "",
        "Secondary identity document number (optional).",
    ),
    (
        "id2_issuer",
        ["id2_issuer", "second_id_issuer", "oc_id2_issuer"],
        False,
        "",
        "",
        "Secondary identity document issuer (optional).",
    ),
    # ── Tax / Registration (IFTI-DRA abn / acn / arbn) ────────────────────────
    (
        "tax_identification_number",
        ["tax_identification_number", "tin", "tfn", "tax_id", "oc_electronic_source"],
        False,
        "123456789",
        "",
        "Individual TFN. Note: do not store TFN in plain text in production systems.",
    ),
    (
        "abn",
        ["abn", "australian_business_number", "oc_abn", "bc_abn"],
        False,
        "",
        "12345678901",
        "Business: 11-digit Australian Business Number. Aligns with IFTI-DRA abn.",
    ),
    (
        "acn",
        ["acn", "australian_company_number", "oc_acn", "bc_acn"],
        False,
        "",
        "123456789",
        "Business: 9-digit Australian Company Number. Aligns with IFTI-DRA acn.",
    ),
    (
        "business_structure",
        [
            "business_structure",
            "entity_structure",
            "oc_business_structure",
            "bc_business_structure",
        ],
        False,
        "",
        "Proprietary Company",
        "Business: legal structure. E.g. 'Proprietary Company', 'Trust', 'Partnership'. "
        "Aligns with IFTI-DRA businessStructure.",
    ),
    # ── Residential / Registered Address (IFTI-DRA orderingCustomer address) ──
    (
        "address_line1",
        [
            "address_line1",
            "address",
            "street_address",
            "street",
            "addr1",
            "oc_address",
            "sender_address",
            "residential_address",
        ],
        False,
        "123 Collins Street",
        "Level 5, 1 Market Street",
        "Street address line 1. Aligns with IFTI-DRA orderingCustomer.address.",
    ),
    (
        "address_line2",
        ["address_line2", "address2", "addr2"],
        False,
        "",
        "Sydney CBD",
        "Address line 2 (suite, floor, suburb).",
    ),
    (
        "city",
        ["city", "town", "locality", "suburb", "oc_city", "sender_city"],
        False,
        "Melbourne",
        "Sydney",
        "City / suburb. Aligns with IFTI-DRA orderingCustomer.city.",
    ),
    (
        "state",
        ["state", "province", "region", "oc_state"],
        False,
        "VIC",
        "NSW",
        "State/territory: NSW, VIC, QLD, WA, SA, TAS, ACT, NT",
    ),
    (
        "postcode",
        ["postcode", "postal_code", "zip", "zip_code", "oc_postcode"],
        False,
        "3000",
        "2000",
        "Postcode. Aligns with IFTI-DRA orderingCustomer.postcode.",
    ),
    (
        "country",
        ["country", "address_country", "oc_country", "sender_country"],
        False,
        "AU",
        "AU",
        "ISO 3166-1 alpha-2. Defaults to AU. Aligns with IFTI-DRA orderingCustomer.country.",
    ),
    # ── Postal Address (IFTI-DRA postalAddress) ───────────────────────────────
    (
        "mail_address_line1",
        [
            "mail_address_line1",
            "postal_address",
            "mailing_address",
            "oc_postal_address",
        ],
        False,
        "",
        "",
        "Postal address if different from residential. Aligns with IFTI-DRA orderingCustomer.postalAddress.",
    ),
    (
        "mail_city",
        ["mail_city", "postal_city", "mailing_city", "oc_postal_city"],
        False,
        "",
        "",
        "Postal city.",
    ),
    (
        "mail_state",
        ["mail_state", "postal_state", "mailing_state", "oc_postal_state"],
        False,
        "",
        "",
        "Postal state.",
    ),
    (
        "mail_postcode",
        ["mail_postcode", "postal_postcode", "mailing_postcode", "oc_postal_postcode"],
        False,
        "",
        "",
        "Postal postcode.",
    ),
    (
        "mail_country",
        ["mail_country", "postal_country", "mailing_country", "oc_postal_country"],
        False,
        "",
        "",
        "Postal country (ISO 3166-1 alpha-2).",
    ),
    # ── Residency / Nationality ───────────────────────────────────────────────
    (
        "nationality",
        ["nationality", "citizenship", "country_of_citizenship"],
        False,
        "AU",
        "",
        "Primary nationality (ISO 3166-1 alpha-2). E.g. AU, US, GB, NZ",
    ),
    (
        "country_of_birth",
        ["country_of_birth", "birth_country", "birthplace_country"],
        False,
        "AU",
        "",
        "Country of birth (ISO 3166-1 alpha-2).",
    ),
    (
        "country_of_residence",
        ["country_of_residence", "residence_country"],
        False,
        "AU",
        "AU",
        "Country of tax/legal residence (ISO 3166-1 alpha-2). Defaults to AU.",
    ),
    (
        "tax_residency_country",
        ["tax_residency_country", "tax_country", "tax_residence"],
        False,
        "AU",
        "AU",
        "Country where customer is tax resident (ISO 3166-1 alpha-2).",
    ),
    # ── Beneficiary / Recipient Details (IFTI-DRA transferee / bc_*) ──────────
    (
        "bc_full_name",
        [
            "bc_full_name",
            "beneficiary_name",
            "recipient_name",
            "transferee_name",
            "payee_name",
        ],
        False,
        "",
        "ABC Beneficiary Ltd",
        "Beneficiary (recipient) full name. Aligns with IFTI-DRA transferee.name / bc_full_name.",
    ),
    (
        "bc_business_name",
        ["bc_business_name", "beneficiary_business", "recipient_business"],
        False,
        "",
        "ABC International",
        "Beneficiary business name. Aligns with IFTI-DRA transferee.businessName.",
    ),
    (
        "bc_dob",
        ["bc_dob", "beneficiary_dob", "recipient_dob"],
        False,
        "",
        "",
        "Beneficiary date of birth if individual (YYYY-MM-DD).",
    ),
    (
        "bc_address",
        ["bc_address", "beneficiary_address", "recipient_address"],
        False,
        "",
        "10 Beneficiary Lane",
        "Beneficiary street address. Aligns with IFTI-DRA transferee.address.",
    ),
    (
        "bc_city",
        ["bc_city", "beneficiary_city", "recipient_city"],
        False,
        "",
        "Auckland",
        "Beneficiary city. Aligns with IFTI-DRA transferee.city.",
    ),
    (
        "bc_country",
        ["bc_country", "beneficiary_country", "recipient_country"],
        False,
        "",
        "NZ",
        "Beneficiary country (ISO 3166-1 alpha-2). Aligns with IFTI-DRA transferee.country.",
    ),
    (
        "bc_phone",
        ["bc_phone", "beneficiary_phone", "recipient_phone"],
        False,
        "",
        "+6499990001",
        "Beneficiary phone. Aligns with IFTI-DRA transferee.phone.",
    ),
    (
        "bc_email",
        ["bc_email", "beneficiary_email", "recipient_email"],
        False,
        "",
        "info@abc.co.nz",
        "Beneficiary email. Aligns with IFTI-DRA transferee.email.",
    ),
    (
        "bc_account_number",
        [
            "bc_account_number",
            "beneficiary_account",
            "recipient_account",
            "payee_account",
        ],
        False,
        "",
        "00123456",
        "Beneficiary account number. Aligns with IFTI-DRA transferee.accountNumber.",
    ),
    (
        "bc_institution_name",
        ["bc_institution_name", "beneficiary_bank", "recipient_bank", "payee_bank"],
        False,
        "",
        "ANZ Bank New Zealand",
        "Beneficiary financial institution name. Aligns with IFTI-DRA beneficiaryInstn.name (MANDATORY for IFTI).",
    ),
    (
        "bc_institution_country",
        [
            "bc_institution_country",
            "beneficiary_bank_country",
            "recipient_bank_country",
        ],
        False,
        "",
        "NZ",
        "Beneficiary institution country (ISO 3166-1 alpha-2). Aligns with IFTI-DRA beneficiaryInstn.country.",
    ),
    # ── Source of Funds / Wealth ──────────────────────────────────────────────
    (
        "source_of_funds",
        ["source_of_funds", "sof", "funds_source", "source_funds"],
        False,
        "Employment income",
        "Business revenue",
        "Source of funds for this customer relationship. Required for CDD.",
    ),
    (
        "source_of_wealth",
        ["source_of_wealth", "sow", "wealth_source"],
        False,
        "Savings and investments",
        "Business ownership",
        "PEP / high-risk: description of accumulated wealth source.",
    ),
    # ── Onboarding / Risk ─────────────────────────────────────────────────────
    (
        "onboarding_channel",
        ["onboarding_channel", "channel", "onboard_channel"],
        False,
        "online",
        "branch",
        "online | mobile_app | branch | agent | telephone | api | third_party",
    ),
    (
        "risk_level",
        ["risk_level", "risk", "initial_risk"],
        False,
        "low",
        "medium",
        "low | medium | high | critical. Platform will recalculate from CDD data.",
    ),
]

# Quick lookup: alias → canonical name
_ALIAS_MAP: dict[str, str] = {}
for _canonical, _aliases, *_ in IMPORT_FIELDS:
    for _alias in _aliases:
        _ALIAS_MAP[_alias] = _canonical


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
    # Synthesise full_name from first+last if not present
    if "full_name" not in out:
        fname = out.pop("first_name", "")
        lname = out.pop("last_name", "")
        if fname or lname:
            out["full_name"] = f"{fname} {lname}".strip()
    return out


def _validate_row(row: dict, row_num: int) -> list[str]:
    """Return list of validation errors for a row (empty = valid)."""
    errors = []
    if not row.get("full_name") and not row.get("email"):
        errors.append(f"Row {row_num}: must have at least 'full_name' or 'email'")

    for dob_field in ("date_of_birth", "bc_dob"):
        dob = row.get(dob_field, "").strip()
        if dob:
            try:
                parts = dob.split("-")
                if len(parts) != 3 or not all(p.isdigit() for p in parts):
                    raise ValueError
                from datetime import date

                date(int(parts[0]), int(parts[1]), int(parts[2]))
            except (ValueError, AttributeError):
                errors.append(f"Row {row_num}: {dob_field} '{dob}' must be YYYY-MM-DD")

    ctype = row.get("customer_type", "individual").lower()
    valid_types = {
        "individual",
        "business",
        "trust",
        "partnership",
        "government",
        "other",
    }
    if ctype and ctype not in valid_types:
        errors.append(
            f"Row {row_num}: customer_type '{ctype}' not valid — use: {', '.join(sorted(valid_types))}"
        )

    risk = row.get("risk_level", "").lower()
    if risk and risk not in {"low", "medium", "high", "critical"}:
        errors.append(
            f"Row {row_num}: risk_level '{risk}' not valid — use: low, medium, high, critical"
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
    rows, warnings, errors = [], [], []
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
    rows, warnings, errors = [], [], []

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
    Fields aligned with AUSTRAC IFTI-DRA ordering customer and beneficiary specifications.

    Rows:
      Row 1: Column headers
      Row 2: Field descriptions (# prefix — skipped on import)
      Row 3: Individual sender example
      Row 4: Business example with beneficiary fields populated
    """
    output = io.StringIO()
    writer = csv.writer(output, lineterminator="\r\n")

    headers = [f[0] for f in IMPORT_FIELDS]
    writer.writerow(headers)

    descriptions = [f"# {f[5]}" for f in IMPORT_FIELDS]
    writer.writerow(descriptions)

    individual_row = [f[3] for f in IMPORT_FIELDS]
    writer.writerow(individual_row)

    business_row = [f[4] for f in IMPORT_FIELDS]
    writer.writerow(business_row)

    return output.getvalue().encode("utf-8-sig")  # BOM for Excel compatibility


def get_template_field_guide() -> list[dict]:
    """Return structured field guide for API documentation."""
    return [
        {
            "field": f[0],
            "required": f[2],
            "example_individual": f[3],
            "example_business": f[4],
            "description": f[5],
            "accepted_aliases": f[1],
        }
        for f in IMPORT_FIELDS
    ]
