"""
Integration Hub API — Phase 3.

Centralised marketplace for third-party provider management.

Roles:
  GET (browse catalog, view org integrations) — analyst+
  Enable / Configure / Test                   — compliance+
  Credential rotation                         — compliance+

DISCLAIMER: Integrations provide data to the compliance workflow only.
Results from third-party providers are not compliance determinations.
All decisions remain with the reporting entity.
"""

import secrets
from datetime import datetime, timedelta, timezone
from typing import Optional
from uuid import uuid4

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session

from app.api.deps import (
    org_id_for,
    require_analyst_or_above,
    require_compliance_or_above,
)
from app.db.database import get_db
from app.models.integration import (
    PROVIDER_CATALOG,
    AuthType,
    IntegrationAuditLog,
    IntegrationCategory,
    IntegrationHealthStatus,
    IntegrationProvider,
    IntegrationType,
    OrgIntegration,
)
from app.models.user import User
from app.services.crypto import decrypt_secret, encrypt_credentials, encrypt_secret
from app.services.integration_monitor import migrate_legacy_connectors, run_expiry_check

router = APIRouter(prefix="/integrations", tags=["Integration Hub"])

DISCLAIMER = (
    "Integration data supports compliance workflow only. "
    "Results from third-party providers are not compliance determinations. "
    "All decisions remain with the reporting entity."
)


# ── Schemas ───────────────────────────────────────────────────────────────────


class IntegrationEnable(BaseModel):
    credentials: dict = Field(
        ..., description="Provider credentials (encrypted at rest)"
    )
    config: dict = Field(
        default_factory=dict, description="Non-sensitive configuration"
    )
    credential_expires_at: Optional[datetime] = Field(
        None, description="Vendor-stated API key expiry, if known"
    )


class OAuthCallback(BaseModel):
    code: str
    state: str


class IntegrationUpdate(BaseModel):
    config: Optional[dict] = None


class CredentialRotation(BaseModel):
    new_credentials: dict = Field(
        ..., description="New credentials to replace existing"
    )
    reason: str = Field(..., min_length=5)
    credential_expires_at: Optional[datetime] = None


# ── Seed provider catalog ─────────────────────────────────────────────────────


def _seed_providers(db: Session):
    """Ensure the platform provider catalog is populated (idempotent)."""
    count = db.query(IntegrationProvider).count()
    if count >= len(PROVIDER_CATALOG):
        return
    for p in PROVIDER_CATALOG:
        existing = (
            db.query(IntegrationProvider)
            .filter(IntegrationProvider.slug == p["slug"])
            .first()
        )
        if not existing:
            db.add(
                IntegrationProvider(
                    id=f"prv_{uuid4().hex[:10]}",
                    slug=p["slug"],
                    name=p["name"],
                    category=p["category"],
                    integration_type=p["type"],
                    auth_type=p["auth"],
                    description=p["description"],
                    is_active=True,
                    is_featured=p.get("featured", False),
                )
            )
    db.commit()


def _audit(
    org_id: str,
    integration_id: Optional[str],
    provider_slug: str,
    event_type: str,
    success: bool,
    message: str,
    actor_id: str,
    db: Session,
):
    db.add(
        IntegrationAuditLog(
            id=f"ial_{uuid4().hex[:12]}",
            org_id=org_id,
            integration_id=integration_id,
            provider_slug=provider_slug,
            event_type=event_type,
            success=success,
            message=message,
            actor_id=actor_id,
        )
    )


def _integration_dict(i: OrgIntegration, include_credentials: bool = False) -> dict:
    d = {
        "id": i.id,
        "provider_id": i.provider_id,
        "provider_slug": i.provider_slug,
        "is_enabled": i.is_enabled,
        "config": i.config or {},
        "credentials_configured": bool(i.credentials_encrypted)
        or bool(i.oauth_access_token_encrypted),
        "credential_expires_at": i.credential_expires_at,
        "oauth_connected": bool(i.oauth_access_token_encrypted),
        "oauth_expires_at": i.oauth_expires_at,
        "health_status": i.health_status.value if i.health_status else "unknown",
        "last_tested_at": i.last_tested_at,
        "last_test_result": i.last_test_result,
        "last_test_message": i.last_test_message,
        "last_health_check_at": i.last_health_check_at,
        "consecutive_failures": i.consecutive_failures or 0,
        "usage_count": i.usage_count or 0,
        "last_used_at": i.last_used_at,
        "enabled_by": i.enabled_by,
        "created_at": i.created_at,
        "updated_at": i.updated_at,
    }
    return d


def _provider_dict(
    p: IntegrationProvider, org_integration: Optional[OrgIntegration] = None
) -> dict:
    d = {
        "id": p.id,
        "slug": p.slug,
        "name": p.name,
        "category": p.category.value,
        "integration_type": p.integration_type.value,
        "auth_type": p.auth_type.value,
        "description": p.description,
        "is_active": p.is_active,
        "is_featured": p.is_featured,
        "capabilities": p.capabilities or [],
        "required_credentials": p.required_credentials or [],
        "optional_config": p.optional_config or [],
    }
    if org_integration is not None:
        d["org_integration"] = _integration_dict(org_integration)
    else:
        d["org_integration"] = None
    return d


# ── Provider Catalog ──────────────────────────────────────────────────────────


@router.get("/catalog")
def list_catalog(
    category: Optional[IntegrationCategory] = Query(None),
    integration_type: Optional[IntegrationType] = Query(None),
    search: Optional[str] = Query(None, max_length=100),
    featured_only: bool = Query(False),
    db: Session = Depends(get_db),
    current_user: User = Depends(require_analyst_or_above),
):
    """
    Browse the integration provider catalog.
    Shows all available providers with org-specific configuration status.
    """
    _seed_providers(db)
    org_id = org_id_for(current_user)

    q = db.query(IntegrationProvider).filter(IntegrationProvider.is_active == True)
    if category:
        q = q.filter(IntegrationProvider.category == category)
    if integration_type:
        q = q.filter(IntegrationProvider.integration_type == integration_type)
    if featured_only:
        q = q.filter(IntegrationProvider.is_featured == True)
    if search:
        q = q.filter(IntegrationProvider.name.ilike(f"%{search}%"))

    providers = q.order_by(IntegrationProvider.category, IntegrationProvider.name).all()

    # Fetch org's configurations for these providers
    provider_ids = [p.id for p in providers]
    org_integrations = {
        i.provider_id: i
        for i in db.query(OrgIntegration)
        .filter(
            OrgIntegration.org_id == org_id,
            OrgIntegration.provider_id.in_(provider_ids),
        )
        .all()
    }

    by_category: dict[str, list] = {}
    for p in providers:
        cat = p.category.value
        by_category.setdefault(cat, []).append(
            _provider_dict(p, org_integrations.get(p.id))
        )

    enabled_count = (
        db.query(OrgIntegration)
        .filter(
            OrgIntegration.org_id == org_id,
            OrgIntegration.is_enabled == True,
        )
        .count()
    )

    return {
        "total_providers": len(providers),
        "enabled_count": enabled_count,
        "by_category": by_category,
        "disclaimer": DISCLAIMER,
    }


@router.get("/catalog/{slug}")
def get_provider(
    slug: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_analyst_or_above),
):
    """Get a specific provider and the org's current integration status."""
    _seed_providers(db)
    org_id = org_id_for(current_user)

    provider = (
        db.query(IntegrationProvider).filter(IntegrationProvider.slug == slug).first()
    )
    if not provider:
        raise HTTPException(404, f"Provider '{slug}' not found.")

    org_int = (
        db.query(OrgIntegration)
        .filter(
            OrgIntegration.org_id == org_id,
            OrgIntegration.provider_id == provider.id,
        )
        .first()
    )

    return _provider_dict(provider, org_int)


# ── Org Integration Management ────────────────────────────────────────────────


@router.get("")
def list_org_integrations(
    enabled_only: bool = Query(False),
    category: Optional[IntegrationCategory] = Query(None),
    db: Session = Depends(get_db),
    current_user: User = Depends(require_analyst_or_above),
):
    """List all configured integrations for this org."""
    org_id = org_id_for(current_user)
    q = db.query(OrgIntegration).filter(OrgIntegration.org_id == org_id)
    if enabled_only:
        q = q.filter(OrgIntegration.is_enabled == True)
    integrations = q.all()

    # Enrich with provider name/category
    provider_ids = [i.provider_id for i in integrations]
    providers = {
        p.id: p
        for p in db.query(IntegrationProvider)
        .filter(IntegrationProvider.id.in_(provider_ids))
        .all()
    }

    result = []
    for i in integrations:
        p = providers.get(i.provider_id)
        if category and p and p.category != category:
            continue
        d = _integration_dict(i)
        if p:
            d["provider_name"] = p.name
            d["provider_category"] = p.category.value
            d["provider_type"] = p.integration_type.value
        result.append(d)

    return {"integrations": result, "count": len(result)}


@router.post("/{slug}/enable", status_code=201)
def enable_integration(
    slug: str,
    payload: IntegrationEnable,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_compliance_or_above),
):
    """
    Enable an integration by providing credentials and configuration.

    Credentials are encrypted at the application layer before storage.
    They are never returned in API responses.

    DISCLAIMER: Integrations provide data to the compliance workflow only.
    """
    _seed_providers(db)
    org_id = org_id_for(current_user)

    provider = (
        db.query(IntegrationProvider)
        .filter(
            IntegrationProvider.slug == slug,
            IntegrationProvider.is_active == True,
        )
        .first()
    )
    if not provider:
        raise HTTPException(404, f"Provider '{slug}' not found or not available.")

    existing = (
        db.query(OrgIntegration)
        .filter(
            OrgIntegration.org_id == org_id,
            OrgIntegration.provider_id == provider.id,
        )
        .first()
    )

    encrypted_creds = encrypt_credentials(payload.credentials)

    if existing:
        existing.credentials_encrypted = encrypted_creds
        existing.config = payload.config
        existing.credential_expires_at = payload.credential_expires_at
        existing.is_enabled = True
        existing.enabled_by = current_user.id
        integration = existing
    else:
        integration = OrgIntegration(
            id=f"int_{uuid4().hex[:10]}",
            org_id=org_id,
            provider_id=provider.id,
            provider_slug=slug,
            is_enabled=True,
            credentials_encrypted=encrypted_creds,
            config=payload.config,
            credential_expires_at=payload.credential_expires_at,
            health_status=IntegrationHealthStatus.unknown,
            enabled_by=current_user.id,
        )
        db.add(integration)

    db.flush()
    _audit(
        org_id,
        integration.id,
        slug,
        "enabled",
        True,
        f"Integration enabled by {current_user.id}",
        current_user.id,
        db,
    )
    db.commit()
    db.refresh(integration)
    return _integration_dict(integration)


@router.post("/{slug}/disable")
def disable_integration(
    slug: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_compliance_or_above),
):
    """Disable an integration without removing credentials."""
    org_id = org_id_for(current_user)
    integration = (
        db.query(OrgIntegration)
        .filter(
            OrgIntegration.org_id == org_id,
            OrgIntegration.provider_slug == slug,
        )
        .first()
    )
    if not integration:
        raise HTTPException(404, "Integration not configured.")

    integration.is_enabled = False
    _audit(
        org_id,
        integration.id,
        slug,
        "disabled",
        True,
        f"Disabled by {current_user.id}",
        current_user.id,
        db,
    )
    db.commit()
    return {"slug": slug, "is_enabled": False}


@router.post("/{slug}/test")
def test_connection(
    slug: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_compliance_or_above),
):
    """
    Test the integration connection using stored credentials.

    Returns connection status. In production this would make a live
    test API call to the provider. Currently returns a validated-config response.
    """
    org_id = org_id_for(current_user)
    integration = (
        db.query(OrgIntegration)
        .filter(
            OrgIntegration.org_id == org_id,
            OrgIntegration.provider_slug == slug,
        )
        .first()
    )
    if not integration:
        raise HTTPException(404, "Integration not configured.")
    if not integration.is_enabled:
        raise HTTPException(409, "Integration is disabled. Enable it before testing.")

    now = datetime.now(timezone.utc)
    # Placeholder: in production, call provider health endpoint
    test_passed = bool(integration.credentials_encrypted)
    message = (
        "Connection validated (credentials present)."
        if test_passed
        else "No credentials configured."
    )

    integration.last_tested_at = now
    integration.last_test_result = test_passed
    integration.last_test_message = message
    integration.last_health_check_at = now
    integration.health_status = (
        IntegrationHealthStatus.healthy if test_passed else IntegrationHealthStatus.down
    )
    if test_passed:
        integration.consecutive_failures = 0
    else:
        integration.consecutive_failures = (integration.consecutive_failures or 0) + 1

    _audit(
        org_id,
        integration.id,
        slug,
        "tested",
        test_passed,
        message,
        current_user.id,
        db,
    )
    db.commit()

    return {
        "slug": slug,
        "test_passed": test_passed,
        "message": message,
        "health_status": integration.health_status.value,
        "tested_at": now.isoformat(),
    }


@router.post("/{slug}/rotate-credentials")
def rotate_credentials(
    slug: str,
    payload: CredentialRotation,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_compliance_or_above),
):
    """
    Rotate credentials for an integration (e.g. after API key expiry).
    Old credentials are overwritten. The rotation is audit-logged.
    """
    org_id = org_id_for(current_user)
    integration = (
        db.query(OrgIntegration)
        .filter(
            OrgIntegration.org_id == org_id,
            OrgIntegration.provider_slug == slug,
        )
        .first()
    )
    if not integration:
        raise HTTPException(404, "Integration not configured.")

    integration.credentials_encrypted = encrypt_credentials(payload.new_credentials)
    integration.credential_expires_at = payload.credential_expires_at
    integration.health_status = IntegrationHealthStatus.unknown
    integration.last_tested_at = None

    _audit(
        org_id,
        integration.id,
        slug,
        "rotated",
        True,
        f"Credentials rotated: {payload.reason}",
        current_user.id,
        db,
    )
    db.commit()
    return {"slug": slug, "rotated": True, "reason": payload.reason}


@router.post("/{slug}/oauth/authorize")
def start_oauth(
    slug: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_compliance_or_above),
):
    """
    Begin an OAuth2 connection for a provider whose auth_type is oauth2.
    Returns an authorize_url the frontend redirects the user to. The
    provider redirects back to the frontend, which posts the resulting
    code + state to /oauth/callback.
    """
    _seed_providers(db)
    org_id = org_id_for(current_user)

    provider = (
        db.query(IntegrationProvider)
        .filter(IntegrationProvider.slug == slug, IntegrationProvider.is_active == True)
        .first()
    )
    if not provider:
        raise HTTPException(404, f"Provider '{slug}' not found or not available.")
    if provider.auth_type != AuthType.oauth2:
        raise HTTPException(409, f"Provider '{slug}' does not use OAuth2.")

    state = secrets.token_urlsafe(24)
    integration = (
        db.query(OrgIntegration)
        .filter(
            OrgIntegration.org_id == org_id, OrgIntegration.provider_id == provider.id
        )
        .first()
    )
    if not integration:
        integration = OrgIntegration(
            id=f"int_{uuid4().hex[:10]}",
            org_id=org_id,
            provider_id=provider.id,
            provider_slug=slug,
            is_enabled=False,
            health_status=IntegrationHealthStatus.unknown,
        )
        db.add(integration)
    integration.oauth_state = state
    db.commit()

    # Real implementation would build the provider's actual OAuth2 authorize
    # endpoint (client_id, redirect_uri, scope) from per-provider config.
    authorize_url = f"https://oauth.{slug}.example/authorize?state={state}"
    return {"authorize_url": authorize_url, "state": state}


@router.post("/{slug}/oauth/callback")
def complete_oauth(
    slug: str,
    payload: OAuthCallback,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_compliance_or_above),
):
    """Exchange the OAuth2 code for tokens and enable the integration."""
    org_id = org_id_for(current_user)
    provider = (
        db.query(IntegrationProvider).filter(IntegrationProvider.slug == slug).first()
    )
    if not provider:
        raise HTTPException(404, f"Provider '{slug}' not found.")

    integration = (
        db.query(OrgIntegration)
        .filter(
            OrgIntegration.org_id == org_id, OrgIntegration.provider_id == provider.id
        )
        .first()
    )
    if not integration or not integration.oauth_state:
        raise HTTPException(409, "No OAuth flow in progress for this provider.")
    if integration.oauth_state != payload.state:
        raise HTTPException(400, "Invalid or expired OAuth state.")

    # Real implementation calls the provider's token endpoint with `code`.
    # Mocked here: derive a stand-in token pair from the authorization code.
    now = datetime.now(timezone.utc)
    integration.oauth_access_token_encrypted = encrypt_secret(f"access:{payload.code}")
    integration.oauth_refresh_token_encrypted = encrypt_secret(
        f"refresh:{payload.code}"
    )
    integration.oauth_expires_at = now + timedelta(hours=1)
    integration.oauth_state = None
    integration.is_enabled = True
    integration.enabled_by = current_user.id
    integration.health_status = IntegrationHealthStatus.healthy
    integration.last_tested_at = now
    integration.last_test_result = True
    integration.last_test_message = "OAuth2 connection established."

    _audit(
        org_id,
        integration.id,
        slug,
        "oauth_connected",
        True,
        f"OAuth2 connected by {current_user.id}",
        current_user.id,
        db,
    )
    db.commit()
    db.refresh(integration)
    return _integration_dict(integration)


@router.get("/monitoring")
def monitoring_summary(
    db: Session = Depends(get_db),
    current_user: User = Depends(require_analyst_or_above),
):
    """
    Integration Dashboard data: health, usage, and error rollups across
    every configured integration for this org, plus credentials/tokens
    expiring within 30 days.
    """
    org_id = org_id_for(current_user)
    integrations = (
        db.query(OrgIntegration).filter(OrgIntegration.org_id == org_id).all()
    )
    providers = {
        p.id: p
        for p in db.query(IntegrationProvider)
        .filter(IntegrationProvider.id.in_([i.provider_id for i in integrations]))
        .all()
    }

    now = datetime.now(timezone.utc)
    horizon = now + timedelta(days=30)

    rows = []
    expiring = []
    error_count = 0
    for i in integrations:
        p = providers.get(i.provider_id)
        rows.append(
            {
                "provider_slug": i.provider_slug,
                "provider_name": p.name if p else i.provider_slug,
                "category": p.category.value if p else None,
                "is_enabled": i.is_enabled,
                "health_status": i.health_status.value
                if i.health_status
                else "unknown",
                "consecutive_failures": i.consecutive_failures or 0,
                "usage_count": i.usage_count or 0,
                "last_used_at": i.last_used_at,
            }
        )
        if (
            i.consecutive_failures or 0
        ) > 0 or i.health_status == IntegrationHealthStatus.down:
            error_count += 1
        for label, exp in (
            ("api_key", i.credential_expires_at),
            ("oauth_token", i.oauth_expires_at),
        ):
            if exp and now <= exp <= horizon:
                expiring.append(
                    {
                        "provider_slug": i.provider_slug,
                        "credential_type": label,
                        "expires_at": exp,
                    }
                )

    return {
        "total_integrations": len(integrations),
        "enabled_count": sum(1 for i in integrations if i.is_enabled),
        "healthy_count": sum(
            1
            for i in integrations
            if i.health_status == IntegrationHealthStatus.healthy
        ),
        "degraded_or_down_count": error_count,
        "expiring_within_30_days": expiring,
        "integrations": rows,
    }


@router.post("/expiry-check")
def trigger_expiry_check(
    db: Session = Depends(get_db),
    current_user: User = Depends(require_compliance_or_above),
):
    """
    Manually trigger the credential/OAuth-token expiry scan for this org
    (normally run by a scheduled job). Raises Notifications and creates
    Compliance Calendar entries for anything expiring within 30 days.
    """
    org_id = org_id_for(current_user)
    result = run_expiry_check(db, org_id)
    return result


@router.post("/migrate-legacy-connectors")
def migrate_legacy_connectors_route(
    db: Session = Depends(get_db),
    current_user: User = Depends(require_compliance_or_above),
):
    """
    Consolidation: copy this org's legacy ConnectorCredential rows
    (the old /connectors marketplace) into OrgIntegration. Safe to re-run;
    already-configured providers are skipped. Source rows are left as-is.
    """
    org_id = org_id_for(current_user)
    result = migrate_legacy_connectors(db, org_id)
    _audit(
        org_id,
        None,
        "*",
        "legacy_migration",
        True,
        f"Migrated {len(result['migrated'])} legacy connector(s) by {current_user.id}",
        current_user.id,
        db,
    )
    db.commit()
    return result


@router.get("/audit-log")
def integration_audit_log(
    slug: Optional[str] = Query(None),
    limit: int = Query(default=50, le=200),
    db: Session = Depends(get_db),
    current_user: User = Depends(require_compliance_or_above),
):
    """Return the integration audit log for this org."""
    org_id = org_id_for(current_user)
    q = db.query(IntegrationAuditLog).filter(IntegrationAuditLog.org_id == org_id)
    if slug:
        q = q.filter(IntegrationAuditLog.provider_slug == slug)
    logs = q.order_by(IntegrationAuditLog.created_at.desc()).limit(limit).all()
    return [
        {
            "id": l.id,
            "provider_slug": l.provider_slug,
            "event_type": l.event_type,
            "success": l.success,
            "message": l.message,
            "actor_id": l.actor_id,
            "created_at": l.created_at,
        }
        for l in logs
    ]
