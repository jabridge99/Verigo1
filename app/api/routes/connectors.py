"""
Connector Marketplace API.
Tenant admins manage external provider credentials here.
Plain credentials are NEVER returned by any GET endpoint — only hints and metadata.
"""

from datetime import datetime
from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app.api.routes.auth import _require_roles
from app.db.database import get_db
from app.models.connector import ConnectorProvider, ConnectorStatus
from app.models.user import User, UserRole
from app.services.connector_service import (
    create_credential,
    delete_credential,
    get_credentials,
    test_credential,
    update_credential,
)

router = APIRouter(prefix="/connectors", tags=["Connector Marketplace"])


# ── Schemas ───────────────────────────────────────────────────────────────────


class ConnectorCreate(BaseModel):
    provider: ConnectorProvider
    credentials: dict  # plaintext — accepted once, immediately encrypted
    label: Optional[str] = None
    is_default: bool = False


class ConnectorUpdate(BaseModel):
    credentials: Optional[dict] = None
    label: Optional[str] = None
    is_default: Optional[bool] = None


class ConnectorResponse(BaseModel):
    credential_id: str
    industry_id: str
    provider: ConnectorProvider
    label: Optional[str]
    key_hint: Optional[str]
    status: ConnectorStatus
    is_default: bool
    last_tested_at: Optional[datetime]
    last_error: Optional[str]
    created_at: Optional[datetime]

    class Config:
        from_attributes = True


# ── Endpoints ─────────────────────────────────────────────────────────────────


@router.get("/providers")
def list_providers():
    """Return all supported provider names and categories."""
    return {
        "identity_verification": ["greenid", "sumsub", "trulioo", "jumio", "onfido"],
        "aml_sanctions": ["complyadvantage", "lexisnexis", "dowjones", "worldcheck"],
        "business_verification": ["creditorwatch", "equifax_au"],
        "address": ["loqate", "google_maps"],
        "communications": ["sendgrid", "twilio"],
    }


@router.get("/", response_model=List[ConnectorResponse])
def list_connectors(
    provider: Optional[ConnectorProvider] = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(
        _require_roles(UserRole.admin, UserRole.mlro, UserRole.compliance)
    ),
):
    industry_id = (
        current_user.org_id
        if current_user.role != UserRole.admin
        else current_user.org_id
    )


@router.post("/", response_model=ConnectorResponse, status_code=201)
def add_connector(
    payload: ConnectorCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(_require_roles(UserRole.admin, UserRole.mlro)),
):
    if not payload.credentials:
        raise HTTPException(400, "credentials must not be empty")
    cred = create_credential(
        db,
        industry_id=current_user.org_id,
        provider=payload.provider,
        credentials=payload.credentials,
        label=payload.label,
        created_by=current_user.id,
    )
    if payload.is_default:
        from app.services.connector_service import update_credential as uc

        uc(db, cred.credential_id, current_user.org_id, is_default=True)
        db.refresh(cred)
    return cred


@router.patch("/{credential_id}", response_model=ConnectorResponse)
def update_connector(
    credential_id: str,
    payload: ConnectorUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(_require_roles(UserRole.admin, UserRole.mlro)),
):
    try:
        return update_credential(
            db,
            credential_id,
            current_user.org_id,
            credentials=payload.credentials,
            label=payload.label,
            is_default=payload.is_default,
            organisation_id=current_user.primary_organisation_id,
        )
    except ValueError as e:
        raise HTTPException(404, str(e))


@router.delete("/{credential_id}", status_code=204)
def remove_connector(
    credential_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(_require_roles(UserRole.admin, UserRole.mlro)),
):
    delete_credential(db, credential_id, current_user.org_id)


@router.post("/{credential_id}/test")
def test_connector(
    credential_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(_require_roles(UserRole.admin, UserRole.mlro)),
):
    try:
        return test_credential(db, credential_id, current_user.org_id)
    except ValueError as e:
        raise HTTPException(404, str(e))
