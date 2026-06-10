"""
Bulk import service — parses CSV and Excel uploads into row dicts.
"""

import csv
import io

COLUMN_MAP = {
    "name":          ["name", "full_name", "fullname", "applicant_name", "customer_name"],
    "email":         ["email", "email_address", "e-mail", "applicant_email"],
    "phone":         ["phone", "mobile", "phone_number", "mobile_number", "contact_number"],
    "company":       ["company", "business_name", "organisation", "organization", "employer"],
    "customer_type": ["customer_type", "type", "entity_type"],
    "first_name":    ["first_name", "firstname", "given_name"],
    "last_name":     ["last_name", "lastname", "surname", "family_name"],
}


def _normalise_header(header):
    return header.strip().lower().replace(" ", "_").replace("-", "_")


def _map_row(raw_row):
    normalised = {_normalise_header(k): v for k, v in raw_row.items()}
    out = {}
    for canonical, aliases in COLUMN_MAP.items():
        for alias in aliases:
            if alias in normalised and normalised[alias].strip():
                out[canonical] = normalised[alias].strip()
                break
    if "name" not in out:
        fname = out.pop("first_name", "")
        lname = out.pop("last_name", "")
        if fname or lname:
            out["name"] = f"{fname} {lname}".strip()
    return out


def parse_csv(content, encoding="utf-8-sig"):
    try:
        text = content.decode(encoding)
    except UnicodeDecodeError:
        text = content.decode("latin-1")
    reader = csv.DictReader(io.StringIO(text))
    rows, warnings = [], []
    for i, raw_row in enumerate(reader, start=2):
        if not any(v.strip() for v in raw_row.values()):
            continue
        mapped = _map_row(raw_row)
        if not mapped.get("email"):
            warnings.append(f"Row {i}: missing email — skipped")
            continue
        rows.append(mapped)
    return rows, warnings


def parse_excel(content):
    try:
        import openpyxl
    except ImportError:
        raise ImportError("openpyxl is required for Excel import: pip install openpyxl")
    import io as _io
    wb = openpyxl.load_workbook(_io.BytesIO(content), read_only=True, data_only=True)
    ws = wb.active
    rows_data = list(ws.iter_rows(values_only=True))
    if not rows_data:
        return [], []
    headers = [str(h or "").strip() for h in rows_data[0]]
    result, warnings = [], []
    for i, row in enumerate(rows_data[1:], start=2):
        raw = {headers[j]: str(v or "").strip() for j, v in enumerate(row) if j < len(headers)}
        if not any(raw.values()):
            continue
        mapped = _map_row(raw)
        if not mapped.get("email"):
            warnings.append(f"Row {i}: missing email — skipped")
            continue
        result.append(mapped)
    return result, warnings


def generate_csv_template():
    return (
        "name,email,phone,company,customer_type\n"
        "Jane Smith,jane@example.com,+61400000001,,individual\n"
        "Acme Pty Ltd,accounts@acme.com.au,+61299990001,Acme Pty Ltd,business\n"
    )
