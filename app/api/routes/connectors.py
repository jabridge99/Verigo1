"""
Connector Marketplace API — DEPRECATED, superseded by the Integrations Hub
(/api/v1/integrations). Kept read/delete-only so existing credentials keep
working; new connections must go through the Hub, which has OAuth, health/
usage monitoring, credential-expiry alerting, and a richer provider catalog.
Use POST /api/v1/integrations/migrate-legacy-connectors to copy existing
rows into the Hub.
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


@router.post("/", status_code=410)
def add_connector(payload: ConnectorCreate):
    """Deprecated — use POST /api/v1/integrations/{slug}/enable instead."""
    raise HTTPException(
        410,
        "This connector store is deprecated. Configure providers via the "
        "Integrations Hub: POST /api/v1/integrations/{slug}/enable.",
    )


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
