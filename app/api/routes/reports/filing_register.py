"""
Reports — immutable Filing Register. Part of the reports route package;
see __init__.py for the combined router.

Route registration order fix: export_filing_register_csv (a literal path,
/filing-register/export-csv) is registered before get_filing_entry
(/filing-register/{entry_id}) so it isn't shadowed by the path-parameter
route -- routes are matched in declaration order, and the literal path must
come first. The original app/api/routes/reports.py had these in the
opposite order despite a comment saying otherwise, which meant
export-csv was 404ing as "Filing register entry not found." for every
caller. Fixed as part of this split; see PARKING_LOT.md.
"""

from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from fastapi.responses import StreamingResponse
from sqlalchemy.orm import Session

from app.api.deps import (
    Pagination,
    org_id_for,
    require_analyst_or_above,
    require_compliance_or_above,
)
from app.db.database import get_db
from app.models.report import FilingRegisterEntry, ReportType
from app.models.user import User

router = APIRouter()


# ── Filing Register ───────────────────────────────────────────────────────────


@router.get("/filing-register")
def list_filing_register(
    report_type: Optional[ReportType] = Query(None),
    pagination: Pagination = Depends(),
    db: Session = Depends(get_db),
    current_user: User = Depends(require_analyst_or_above),
):
    org_id = org_id_for(current_user)
    q = db.query(FilingRegisterEntry).filter(FilingRegisterEntry.org_id == org_id)
    if report_type:
        q = q.filter(FilingRegisterEntry.report_type == report_type)
    q = q.order_by(FilingRegisterEntry.submitted_at.desc())
    entries = pagination.apply(q).all()
    return [_filing_dict(e) for e in entries]


# IMPORTANT: /filing-register/export-csv must be registered before /filing-register/{entry_id}
@router.get("/filing-register/export-csv")
def export_filing_register_csv(
    report_type: Optional[ReportType] = Query(None),
    db: Session = Depends(get_db),
    current_user: User = Depends(require_compliance_or_above),
):
    """Export the full filing register as CSV — one row per AUSTRAC submission."""
    import csv
    import io

    org_id = org_id_for(current_user)
    q = db.query(FilingRegisterEntry).filter(FilingRegisterEntry.org_id == org_id)
    if report_type:
        q = q.filter(FilingRegisterEntry.report_type == report_type)
    entries = q.order_by(FilingRegisterEntry.submitted_at.desc()).all()

    buf = io.StringIO()
    writer = csv.writer(buf, lineterminator="\r\n")
    writer.writerow(
        [
            "id",
            "report_type",
            "report_ref",
            "report_id",
            "austrac_submission_ref",
            "submitted_by",
            "submitted_at",
            "status",
            "acknowledgement_ref",
            "acknowledgement_at",
            "amount_aud",
            "notes",
            "supersedes_id",
            "created_at",
        ]
    )
    for e in entries:
        writer.writerow(
            [
                e.id,
                e.report_type.value if e.report_type else "",
                e.report_ref or "",
                e.report_id or "",
                e.austrac_submission_ref or "",
                e.submitted_by or "",
                e.submitted_at or "",
                e.status or "",
                e.acknowledgement_ref or "",
                e.acknowledgement_at or "",
                e.amount_aud or "",
                e.notes or "",
                e.supersedes_id or "",
                e.created_at or "",
            ]
        )

    buf.seek(0)
    filename = f"filing-register-{org_id}.csv"
    return StreamingResponse(
        iter([buf.getvalue()]),
        media_type="text/csv",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )


@router.get("/filing-register/{entry_id}")
def get_filing_entry(
    entry_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_analyst_or_above),
):
    org_id = org_id_for(current_user)
    e = (
        db.query(FilingRegisterEntry)
        .filter(
            FilingRegisterEntry.id == entry_id, FilingRegisterEntry.org_id == org_id
        )
        .first()
    )
    if not e:
        raise HTTPException(404, "Filing register entry not found.")
    return _filing_dict(e)


# ── Serialisers ───────────────────────────────────────────────────────────────


def _filing_dict(e: FilingRegisterEntry) -> dict:
    return {
        "id": e.id,
        "report_type": e.report_type.value if e.report_type else None,
        "report_ref": e.report_ref,
        "report_id": e.report_id,
        "austrac_submission_ref": e.austrac_submission_ref,
        "submitted_by": e.submitted_by,
        "submitted_at": e.submitted_at,
        "status": e.status,
        "acknowledgement_ref": e.acknowledgement_ref,
        "acknowledgement_at": e.acknowledgement_at,
        "amount_aud": e.amount_aud,
        "notes": e.notes,
        "supersedes_id": e.supersedes_id,
        "created_at": e.created_at,
    }
