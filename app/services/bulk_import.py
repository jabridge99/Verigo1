"""
Bulk Customer Import Service — CSV and Excel upload processing.

Supports:
  - CSV (.csv) — UTF-8 or Latin-1 encoded
  - Excel (.xlsx) — first sheet used

Column mapping is alias-tolerant (accepts common header variations).
Required field: email OR (first_name + last_name) — at least one must be present.
customer_type defaults to "individual" if not provided.

Template includes all importable fields for individual and business customers.

DISCLAIMER: Imported customers are created in DRAFT status.
AML/CTF CDD obligations must be completed before onboarding is finalised.
All compliance decisions remain with the reporting entity.
"""
import csv
import io
from typing import Optional

# ── Importable field definitions ──────────────────────────────────────────────
# (canonical_name, aliases, required, example_individual, example_business, help)

IMPORT_FIELDS = [
    # Identity
    ("customer_type",       ["customer_type", "type", "entity_type"],
     False, "individual", "business",
     "individual | business | trust | partnership | government | other"),

    ("full_name",           ["full_name", "name", "fullname", "customer_name", "applicant_name"],
     False, "Jane Smith", "Acme Pty Ltd",
     "Full legal name. For individuals use first + last name. For business use registered name."),

    ("first_name",          ["first_name", "firstname", "given_name", "given_names"],
     False, "Jane", "",
     "Individual: given name(s). Leave blank for business customers."),

    ("last_name",           ["last_name", "lastname", "surname", "family_name"],
     False, "Smith", "",
     "Individual: family name. Leave blank for business customers."),

    ("email",               ["email", "email_address", "e-mail", "applicant_email", "contact_email"],
     False, "jane@example.com", "accounts@acme.com.au",
     "Primary email address. Used for notifications and identity."),

    ("phone",               ["phone", "mobile", "phone_number", "mobile_number", "contact_number", "telephone"],
     False, "+61400000001", "+61299990001",
     "E.164 format preferred: +61400000001"),

    ("date_of_birth",       ["date_of_birth", "dob", "birth_date", "birthdate"],
     False, "1985-06-15", "",
     "Individual only. Format: YYYY-MM-DD"),

    ("nationality",         ["nationality", "citizenship", "country_of_citizenship"],
     False, "AU", "",
     "ISO 3166-1 alpha-2 country code. E.g. AU, US, GB, NZ"),

    ("country_of_birth",    ["country_of_birth", "birth_country", "birthplace_country"],
     False, "AU", "",
     "ISO 3166-1 alpha-2 country code."),

    ("country_of_residence", ["country_of_residence", "residence_country", "country_residence"],
     False, "AU", "",
     "ISO 3166-1 alpha-2 country code. Defaults to AU if blank."),

    ("occupation",          ["occupation", "job_title", "profession", "employment"],
     False, "Accountant", "",
     "Individual: current occupation or profession."),

    ("employer_name",       ["employer_name", "employer", "company", "business_name", "organisation", "organization"],
     False, "BDO Australia", "Acme Pty Ltd",
     "Employer or operating business name."),

    ("tax_identification_number", ["tax_identification_number", "tin", "tfn", "abn", "acn", "tax_id"],
     False, "123456789", "12345678901",
     "TFN for individuals, ABN/ACN for businesses."),

    ("tax_residency_country", ["tax_residency_country", "tax_country", "tax_residence"],
     False, "AU", "AU",
     "ISO 3166-1 alpha-2. Country where customer is tax resident."),

    # Address
    ("address_line1",       ["address_line1", "address", "street_address", "street", "addr1"],
     False, "123 Collins Street", "Level 5, 1 Market Street",
     "Residential or registered address line 1."),

    ("address_line2",       ["address_line2", "address2", "addr2", "suburb"],
     False, "", "Sydney",
     "Address line 2 (apartment, suite, suburb)."),

    ("city",                ["city", "town", "locality", "suburb_city"],
     False, "Melbourne", "Sydney",
     "City or suburb."),

    ("state",               ["state", "province", "region"],
     False, "VIC", "NSW",
     "Australian state/territory abbreviation: NSW, VIC, QLD, WA, SA, TAS, ACT, NT"),

    ("postcode",            ["postcode", "postal_code", "zip", "zip_code"],
     False, "3000", "2000",
     "Postcode."),

    ("country",             ["country", "address_country"],
     False, "AU", "AU",
     "ISO 3166-1 alpha-2. Defaults to AU."),

    # Source of Funds
    ("source_of_funds",     ["source_of_funds", "sof", "funds_source", "source_funds"],
     False, "Employment income", "Business revenue",
     "Brief description of the source of funds for this customer relationship."),

    ("source_of_wealth",    ["source_of_wealth", "sow", "wealth_source", "source_wealth"],
     False, "Savings and investments", "Business ownership",
     "PEP and high-risk customers: description of accumulated wealth source."),

    # Risk / onboarding
    ("onboarding_channel",  ["onboarding_channel", "channel", "onboard_channel"],
     False, "online", "branch",
     "online | mobile_app | branch | agent | telephone | api | third_party"),

    ("risk_level",          ["risk_level", "risk", "initial_risk"],
     False, "low", "medium",
     "low | medium | high | critical. Platform will recalculate — this is the initial assignment."),

    # Business-specific
    ("business_registration_number", ["business_registration_number", "abn", "acn", "registration_number", "company_number"],
     False, "", "12345678901",
     "Business only: ABN (11 digits) or ACN (9 digits)."),

    ("industry_type",       ["industry_type", "industry", "business_type", "sector"],
     False, "", "retail",
     "Business only: industry classification."),
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
    # Carry through unmapped but preserve canonical fields only
    return out


def _validate_row(row: dict, row_num: int) -> list[str]:
    """Return list of validation errors for a row (empty = valid)."""
    errors = []
    if not row.get("full_name") and not row.get("email"):
        errors.append(f"Row {row_num}: must have at least 'full_name' or 'email'")

    dob = row.get("date_of_birth")
    if dob:
        try:
            from datetime import date
            parts = dob.split("-")
            if len(parts) != 3:
                raise ValueError
            date(int(parts[0]), int(parts[1]), int(parts[2]))
        except (ValueError, AttributeError):
            errors.append(f"Row {row_num}: date_of_birth '{dob}' must be YYYY-MM-DD")

    ctype = row.get("customer_type", "individual").lower()
    valid_types = {"individual", "business", "trust", "partnership", "government", "other"}
    if ctype and ctype not in valid_types:
        errors.append(f"Row {row_num}: customer_type '{ctype}' not valid — use: {', '.join(sorted(valid_types))}")

    risk = row.get("risk_level", "").lower()
    if risk and risk not in {"low", "medium", "high", "critical"}:
        errors.append(f"Row {row_num}: risk_level '{risk}' not valid — use: low, medium, high, critical")

    return errors


def parse_csv(content: bytes, encoding: str = "utf-8-sig") -> tuple[list[dict], list[str], list[str]]:
    """
    Parse CSV bytes into a list of mapped row dicts.

    Returns:
        (rows, warnings, errors)
        rows     — valid rows ready for import
        warnings — non-fatal issues (rows still included)
        errors   — fatal row errors (rows excluded)
    """
    try:
        text = content.decode(encoding)
    except UnicodeDecodeError:
        text = content.decode("latin-1")

    reader = csv.DictReader(io.StringIO(text))
    rows, warnings, errors = [], [], []

    for i, raw_row in enumerate(reader, start=2):
        # Skip blank rows
        if not any(str(v or "").strip() for v in raw_row.values()):
            continue
        # Skip template example rows
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
    """
    Parse Excel (.xlsx) bytes into a list of mapped row dicts.

    Returns:
        (rows, warnings, errors)
    """
    try:
        import openpyxl
    except ImportError:
        raise ImportError("openpyxl is required for Excel import: pip install openpyxl")

    wb = openpyxl.load_workbook(io.BytesIO(content), read_only=True, data_only=True)
    ws = wb.active
    rows_data = list(ws.iter_rows(values_only=True))

    if not rows_data:
        return [], [], ["File is empty"]

    # Find header row (first non-empty row)
    header_row_idx = 0
    for idx, row in enumerate(rows_data):
        if any(cell is not None for cell in row):
            header_row_idx = idx
            break

    headers = [str(h or "").strip() for h in rows_data[header_row_idx]]
    rows, warnings, errors = [], [], []

    for i, row in enumerate(rows_data[header_row_idx + 1:], start=header_row_idx + 2):
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
    Includes a header row, a column description row (prefixed with #),
    an individual example, and a business example.
    """
    output = io.StringIO()
    writer = csv.writer(output, lineterminator="\r\n")

    headers = [f[0] for f in IMPORT_FIELDS]
    writer.writerow(headers)

    # Description row (# prefix signals it will be skipped on import)
    descriptions = [f"# {f[5]}" for f in IMPORT_FIELDS]
    writer.writerow(descriptions)

    # Individual example
    individual_row = [f[3] for f in IMPORT_FIELDS]
    writer.writerow(individual_row)

    # Business example
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
