"""
Public AML program verification — no auth. A QR code stamped on every
generated program/version links here so an auditor or regulator can confirm
a printed/exported program is authentic and check whether it has since been
superseded, without exposing any of the actual program content.
"""

import io

from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import StreamingResponse
from sqlalchemy.orm import Session

from app.db.database import get_db
from app.models.aml_program import AMLProgram
from app.schemas.aml_program import VerificationResponse
from app.services import aml_program_service

router = APIRouter(prefix="/verify", tags=["Verification"])


def _verification_response(db: Session, version) -> VerificationResponse:
    program = db.query(AMLProgram).filter(AMLProgram.id == version.program_id).first()
    return VerificationResponse(
        program_id=program.program_id if program else None,
        version=version.version,
        generated_at=version.generated_at,
        content_hash=version.content_hash,
        item_count=version.item_count,
        is_current=bool(program and program.version == version.version),
    )


@router.get("/aml-program/{qr_token}", response_model=VerificationResponse)
def verify_aml_program(qr_token: str, db: Session = Depends(get_db)):
    version = aml_program_service.get_version_by_qr_token(db, qr_token)
    if not version:
        raise HTTPException(404, "Unknown or invalid verification token")
    return _verification_response(db, version)


@router.get("/aml-program/{qr_token}/qr.png")
def verify_aml_program_qr_image(qr_token: str, db: Session = Depends(get_db)):
    import qrcode

    from app.config import settings

    version = aml_program_service.get_version_by_qr_token(db, qr_token)
    if not version:
        raise HTTPException(404, "Unknown or invalid verification token")

    verify_url = f"{settings.app_url}/verify/aml-program/{qr_token}"
    img = qrcode.make(verify_url)
    buf = io.BytesIO()
    img.save(buf, format="PNG")
    buf.seek(0)
    return StreamingResponse(buf, media_type="image/png")
