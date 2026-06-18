"""
AUSTRAC Examination Pack — Phase 11

One-click generation of the complete evidence bundle an AUSTRAC examiner
requests on arrival for a s.167 examination (AML/CTF Act 2006).

Sections:
  aml_program, customer_profile, transaction_monitoring,
  smr_register, ifti_register, ttr_register, training_records,
  independent_reviews, policy_register, control_testing, notification_history

Notification: MLRO receives in-app + email notification when pack is ready.
"""

from datetime import date
from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import HTMLResponse, PlainTextResponse
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app.api.deps import (
    get_db,
    require_analyst_or_above,
    require_compliance_or_above,
    require_mlro_or_above,
)
from app.models.examination_pack import (
    EXAMINATION_SECTIONS,
    ExaminationPack,
    ExaminationPackStatus,
)
from app.models.user import User
from app.services import examination_pack_service as svc

router = APIRouter(prefix="/examination-packs", tags=["AUSTRAC Examination Pack"])


# ── Schemas ───────────────────────────────────────────────────────────────────


class GeneratePackRequest(BaseModel):
    period_start: date
    period_end: date
    sections: Optional[List[str]] = None  # null = all sections
    examiner_name: Optional[str] = None
    examiner_agency: str = "AUSTRAC"
    examination_ref: Optional[str] = None  # AUSTRAC's own reference number


class DeliverPackRequest(BaseModel):
    delivery_notes: Optional[str] = None


# ── Routes ────────────────────────────────────────────────────────────────────


@router.post("/", summary="Generate an AUSTRAC examination pack")
def generate_pack(
    body: GeneratePackRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_compliance_or_above),
):
    if body.sections:
        invalid = [s for s in body.sections if s not in EXAMINATION_SECTIONS]
        if invalid:
            raise HTTPException(
                422, f"Unknown sections: {invalid}. Valid: {EXAMINATION_SECTIONS}"
            )

    pack = svc.generate_pack(
        db=db,
        org_id=current_user.org_id,
        period_start=body.period_start,
        period_end=body.period_end,
        sections=body.sections,
        requested_by=current_user.id,
        examiner_name=body.examiner_name,
        examiner_agency=body.examiner_agency,
        examination_ref=body.examination_ref,
    )
    return _pack_to_dict(pack, include_snapshot=False)


@router.get("/", summary="List examination packs for this organisation")
def list_packs(
    status: Optional[ExaminationPackStatus] = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_compliance_or_above),
):
    q = db.query(ExaminationPack).filter_by(org_id=current_user.org_id)
    if status:
        q = q.filter(ExaminationPack.status == status)
    packs = q.order_by(ExaminationPack.created_at.desc()).all()
    return [_pack_to_dict(p, include_snapshot=False) for p in packs]


@router.get("/sections", summary="List all available examination sections")
def list_sections():
    return {
        "sections": EXAMINATION_SECTIONS,
        "descriptions": {
            "aml_program": "AML/CTF program overview, risk assessment status, AML programs",
            "customer_profile": "Customer risk distribution, PEP/sanctions counts, CDD levels",
            "transaction_monitoring": "Monitoring rules, alert volumes, severity distribution",
            "smr_register": "All Suspicious Matter Reports filed in the examination period",
            "ifti_register": "All IFTI-DRA and IFTI-E reports filed in the period",
            "ttr_register": "All Threshold Transaction Reports filed in the period",
            "training_records": "Staff training completion rates, overdue, assessment flags",
            "independent_reviews": "IR engagements, findings by risk rating, remediation status",
            "policy_register": "All AML/CTF policies, version history, attestation rates",
            "control_testing": "Governance control test results, findings, remediation",
            "notification_history": "Evidence that staff were alerted to compliance issues",
        },
    }


@router.get("/{pack_id}", summary="Get examination pack detail and summary metrics")
def get_pack(
    pack_id: str,
    include_snapshot: bool = False,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_analyst_or_above),
):
    pack = _get_pack(db, pack_id, current_user.org_id)
    return _pack_to_dict(pack, include_snapshot=include_snapshot)


@router.get(
    "/{pack_id}/export-html",
    response_class=HTMLResponse,
    summary="Export examination pack as print-ready HTML",
)
def export_html(
    pack_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_compliance_or_above),
):
    pack = _get_pack(db, pack_id, current_user.org_id)
    if pack.status != ExaminationPackStatus.ready:
        raise HTTPException(422, "Pack is not yet ready — wait for status = 'ready'")
    return HTMLResponse(content=svc.export_html(pack))


@router.get(
    "/{pack_id}/export-csv",
    response_class=PlainTextResponse,
    summary="Export examination pack metrics as CSV index",
)
def export_csv(
    pack_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_compliance_or_above),
):
    pack = _get_pack(db, pack_id, current_user.org_id)
    if pack.status != ExaminationPackStatus.ready:
        raise HTTPException(422, "Pack is not yet ready")
    csv_content = svc.export_csv_index(pack)
    return PlainTextResponse(
        content=csv_content,
        headers={"Content-Disposition": f'attachment; filename="{pack.pack_ref}.csv"'},
    )


@router.post("/{pack_id}/deliver", summary="Mark pack as delivered to AUSTRAC examiner")
def deliver_pack(
    pack_id: str,
    body: DeliverPackRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_mlro_or_above),
):
    from datetime import datetime, timezone

    pack = _get_pack(db, pack_id, current_user.org_id)
    if pack.status != ExaminationPackStatus.ready:
        raise HTTPException(
            422, "Only packs with status 'ready' can be marked as delivered"
        )
    pack.status = ExaminationPackStatus.delivered
    pack.delivered_at = datetime.now(timezone.utc)
    pack.delivered_by = current_user.id
    pack.delivery_notes = body.delivery_notes
    db.commit()
    return _pack_to_dict(pack, include_snapshot=False)


@router.post("/{pack_id}/archive", summary="Archive an examination pack")
def archive_pack(
    pack_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_mlro_or_above),
):
    pack = _get_pack(db, pack_id, current_user.org_id)
    if pack.status == ExaminationPackStatus.generating:
        raise HTTPException(422, "Cannot archive a pack that is still generating")
    pack.status = ExaminationPackStatus.archived
    db.commit()
    return {"archived": True, "pack_id": pack_id, "pack_ref": pack.pack_ref}


@router.get("/enums/values", summary="Enum values for dropdowns")
def get_enums():
    return {
        "statuses": [e.value for e in ExaminationPackStatus],
        "sections": EXAMINATION_SECTIONS,
    }


# ── Helpers ───────────────────────────────────────────────────────────────────


def _get_pack(db: Session, pack_id: str, org_id: str) -> ExaminationPack:
    pack = db.query(ExaminationPack).filter_by(id=pack_id, org_id=org_id).first()
    if not pack:
        raise HTTPException(404, "Examination pack not found")
    return pack


def _pack_to_dict(pack: ExaminationPack, include_snapshot: bool = False) -> dict:
    result = {
        "id": pack.id,
        "pack_ref": pack.pack_ref,
        "org_id": pack.org_id,
        "status": pack.status,
        "period_start": pack.period_start.isoformat() if pack.period_start else None,
        "period_end": pack.period_end.isoformat() if pack.period_end else None,
        "sections": pack.sections,
        "examiner_name": pack.examiner_name,
        "examiner_agency": pack.examiner_agency,
        "examination_ref": pack.examination_ref,
        "summary_metrics": pack.summary_metrics,
        "generation_errors": pack.generation_errors,
        "requested_by": pack.requested_by,
        "generated_at": pack.generated_at.isoformat() if pack.generated_at else None,
        "delivered_at": pack.delivered_at.isoformat() if pack.delivered_at else None,
        "delivered_by": pack.delivered_by,
        "delivery_notes": pack.delivery_notes,
        "is_confidential": pack.is_confidential,
        "version": pack.version,
        "created_at": pack.created_at.isoformat() if pack.created_at else None,
    }
    if include_snapshot:
        result["snapshot_data"] = pack.snapshot_data
    return result
