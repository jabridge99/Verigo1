"""
Customers — bulk CSV/Excel import. Part of the customers route package;
see __init__.py for the combined router.
"""

from fastapi import APIRouter, Depends, File, HTTPException, UploadFile
from sqlalchemy.orm import Session

from app.api.deps import (
    org_id_for,
    require_analyst_or_above,
    require_compliance_or_above,
)
from app.db.database import get_db
from app.models.customer import Customer, CustomerStatus
from app.models.user import User
from app.services import billing_service

from ._shared import _create_checklist, _next_customer_ref, log

router = APIRouter()


@router.get("/import/template")
def download_import_template(
    current_user: User = Depends(require_analyst_or_above),
):
    """
    Download the customer bulk import CSV template.

    The template contains:
      - Row 1: Column headers (canonical field names)
      - Row 2: Field descriptions (prefixed with # — skipped on import)
      - Row 3: Individual customer example
      - Row 4: Business customer example

    All # prefixed rows are ignored during import.
    Column headers are alias-tolerant — common variations accepted.

    After filling in the template, upload via:
      POST /api/v1/customers/import/upload

    DISCLAIMER: Imported customers are created in DRAFT status.
    CDD must be completed before the customer can be activated.
    """
    from fastapi.responses import Response

    from app.services.bulk_import import generate_csv_template

    content = generate_csv_template()
    return Response(
        content=content,
        media_type="text/csv",
        headers={
            "Content-Disposition": 'attachment; filename="verigo_customer_import_template.csv"'
        },
    )


@router.get("/import/field-guide")
def import_field_guide(
    current_user: User = Depends(require_analyst_or_above),
):
    """
    Returns the full field guide for the customer import template.
    Includes accepted aliases, examples, and field descriptions.
    """
    from app.services.bulk_import import get_template_field_guide

    return {
        "total_fields": len(get_template_field_guide()),
        "fields": get_template_field_guide(),
        "notes": [
            "Rows prefixed with # in any column are treated as comments and skipped",
            "customer_type defaults to 'individual' if blank",
            "country and country_of_residence default to 'AU' if blank",
            "All imported customers are created in DRAFT status — CDD must be completed",
            "Duplicate emails within the same organisation are skipped with a warning",
            "Column headers are alias-tolerant — see 'accepted_aliases' for each field",
        ],
    }


@router.post("/import/upload")
async def bulk_import_customers(
    file: UploadFile = File(
        ..., description="CSV or Excel (.xlsx) customer import file"
    ),
    current_user: User = Depends(require_compliance_or_above),
    db: Session = Depends(get_db),
):
    """
    Bulk import customers from a CSV or Excel (.xlsx) file.

    Accepted formats:
      - text/csv — UTF-8 or Latin-1 encoded
      - application/vnd.openxmlformats-officedocument.spreadsheetml.sheet (.xlsx)
      - application/octet-stream (auto-detected by extension)

    Processing:
      1. Parse file → validate each row
      2. Skip rows with validation errors (reported in 'errors')
      3. Skip duplicate emails within this organisation (reported in 'skipped')
      4. Create Customer records in DRAFT status
      5. Return import summary with created IDs

    All created customers:
      - Status: draft (CDD not yet completed)
      - Requires CDD/KYC completion before activation
      - Triggers no automatic screening (screening must be initiated manually)

    DISCLAIMER: Bulk import creates customer records only.
    CDD, KYC verification, and sanctions screening must be completed
    before onboarding is finalised. All compliance decisions remain
    with the reporting entity.
    """
    from app.models.customer import CustomerType, OnboardingChannel, RiskLevel
    from app.services.bulk_import import parse_csv, parse_excel

    if file is None:
        raise HTTPException(
            422,
            "No file uploaded. Provide a CSV or Excel file as multipart form-data field 'file'.",
        )

    filename = file.filename or ""
    content = await file.read()

    if not content:
        raise HTTPException(422, "Uploaded file is empty")

    # Parse by file type
    ext = filename.lower().rsplit(".", 1)[-1] if "." in filename else ""
    content_type = file.content_type or ""

    if ext in ("xlsx", "xls") or "spreadsheet" in content_type:
        try:
            rows, warnings, errors = parse_excel(content)
        except ImportError:
            raise HTTPException(
                500, "Excel support requires openpyxl — contact your administrator"
            )
    elif ext == "csv" or "csv" in content_type or "text" in content_type:
        rows, warnings, errors = parse_csv(content)
    else:
        # Try CSV as fallback
        rows, warnings, errors = parse_csv(content)

    if not rows and errors:
        return {
            "status": "failed",
            "message": "No valid rows found in file",
            "errors": errors,
            "warnings": warnings,
            "created": 0,
            "skipped": 0,
        }

    org_id = org_id_for(current_user)
    created = []
    skipped = []
    remaining_capacity = billing_service.remaining_customer_capacity(db, org_id)

    for i, row in enumerate(rows):
        full_name = row.get("full_name", "").strip()
        email = row.get("email", "").strip().lower() or None

        if not full_name:
            errors.append(f"Row {i + 2}: full_name is required")
            continue

        if remaining_capacity is not None and remaining_capacity <= 0:
            skipped.append(
                {
                    "full_name": full_name,
                    "email": email,
                    "reason": "Your plan's customer limit has been reached. "
                    "Upgrade your plan to import more customers.",
                }
            )
            continue

        # Duplicate email check within org
        if email:
            existing = db.query(Customer).filter_by(org_id=org_id, email=email).first()
            if existing:
                skipped.append(
                    {
                        "full_name": full_name,
                        "email": email,
                        "reason": f"Email already exists (customer: {existing.customer_ref})",
                    }
                )
                continue

        # Resolve enums safely
        raw_type = row.get("customer_type", "individual").lower().strip()
        try:
            ctype = CustomerType(raw_type)
        except ValueError:
            ctype = CustomerType.individual

        raw_channel = row.get("onboarding_channel", "online").lower().strip()
        try:
            channel = OnboardingChannel(raw_channel)
        except ValueError:
            channel = OnboardingChannel.online

        raw_risk = row.get("risk_level", "low").lower().strip()
        try:
            risk = RiskLevel(raw_risk)
        except ValueError:
            risk = RiskLevel.low

        # Date of birth
        dob = None
        dob_str = row.get("date_of_birth", "").strip()
        if dob_str:
            try:
                from datetime import date as _date

                parts = dob_str.split("-")
                dob = _date(int(parts[0]), int(parts[1]), int(parts[2]))
            except Exception:
                warnings.append(
                    f"Row {i + 2}: date_of_birth '{dob_str}' could not be parsed — skipped"
                )

        customer_ref = _next_customer_ref(org_id, db)

        customer = Customer(
            customer_ref=customer_ref,
            org_id=org_id,
            customer_type=ctype,
            status=CustomerStatus.draft,
            full_name=full_name,
            email=email,
            phone=row.get("phone") or None,
            date_of_birth=dob,
            nationality=row.get("nationality", "").upper() or None,
            country_of_birth=row.get("country_of_birth", "").upper() or None,
            country_of_residence=row.get("country_of_residence", "AU").upper() or "AU",
            occupation=row.get("occupation") or None,
            employer_name=row.get("employer_name") or None,
            tax_identification_number=row.get("tax_identification_number") or None,
            tax_residency_country=row.get("tax_residency_country", "AU").upper()
            or "AU",
            address_line1=row.get("address_line1") or None,
            address_line2=row.get("address_line2") or None,
            city=row.get("city") or None,
            state=row.get("state") or None,
            postcode=row.get("postcode") or None,
            country=row.get("country", "AU").upper() or "AU",
            source_of_funds=row.get("source_of_funds") or None,
            source_of_wealth=row.get("source_of_wealth") or None,
            onboarding_channel=channel,
            risk_level=risk,
            onboarded_by=current_user.id,
        )
        db.add(customer)
        db.flush()

        # Create onboarding checklist
        _create_checklist(customer, db)

        created.append(
            {
                "customer_ref": customer_ref,
                "full_name": full_name,
                "email": email,
                "customer_type": ctype.value,
                "status": "draft",
            }
        )
        if remaining_capacity is not None:
            remaining_capacity -= 1

    db.commit()

    log.info(
        "bulk_import.complete org=%s created=%d skipped=%d errors=%d by=%s",
        org_id,
        len(created),
        len(skipped),
        len(errors),
        current_user.id,
    )

    return {
        "status": "complete",
        "file": filename,
        "rows_parsed": len(rows),
        "created": len(created),
        "skipped": len(skipped),
        "error_count": len(errors),
        "created_customers": created,
        "skipped_rows": skipped,
        "errors": errors,
        "warnings": warnings,
        "next_steps": [
            "Review each imported customer record",
            "Complete CDD: upload identity documents and verify",
            "Run sanctions and PEP screening",
            "Update customer status to 'active' once CDD is complete",
        ],
        "disclaimer": (
            "All imported customers are in DRAFT status. "
            "CDD verification and sanctions screening must be completed "
            "before customers can be activated. "
            "All compliance decisions remain with the reporting entity."
        ),
    }
