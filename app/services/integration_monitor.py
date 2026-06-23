"""
Integration credential/OAuth-token expiry monitoring.

Scans OrgIntegration rows for credential_expires_at / oauth_expires_at within
30 days, raises a deduplicated Notification, and creates/updates a
Compliance Calendar entry so the expiry shows up alongside every other
compliance obligation. Intended to be run by a scheduled job per org (and is
also exposed as a manual trigger via POST /integrations/expiry-check).
"""

from __future__ import annotations

from datetime import datetime, timedelta, timezone
from uuid import uuid4

from sqlalchemy.orm import Session

from app.models.compliance_calendar import CalendarItemStatus, CalendarItemType, ComplianceCalendarItem
from app.models.connector import ConnectorCredential
from app.models.integration import (
    LEGACY_CONNECTOR_SLUG_ALIASES,
    IntegrationHealthStatus,
    IntegrationProvider,
    OrgIntegration,
)
from app.models.notification import Notification, NotificationPriority, NotificationType
from app.services.connector_service import _decrypt
from app.services.crypto import encrypt_credentials

EXPIRY_HORIZON_DAYS = 30


def run_expiry_check(db: Session, org_id: str) -> dict:
    now = datetime.now(timezone.utc)
    horizon = now + timedelta(days=EXPIRY_HORIZON_DAYS)

    integrations = (
        db.query(OrgIntegration)
        .filter(OrgIntegration.org_id == org_id, OrgIntegration.is_enabled == True)
        .all()
    )
    providers = {
        p.id: p
        for p in db.query(IntegrationProvider)
        .filter(IntegrationProvider.id.in_([i.provider_id for i in integrations]))
        .all()
    }

    flagged = []
    for i in integrations:
        for label, exp in (
            ("API key", i.credential_expires_at),
            ("OAuth token", i.oauth_expires_at),
        ):
            if not exp or exp > horizon:
                continue
            provider = providers.get(i.provider_id)
            provider_name = provider.name if provider else i.provider_slug
            dedupe_key = f"integration_credential_expiring:{i.id}:{label}:{exp.date()}"

            existing = (
                db.query(Notification).filter(Notification.dedupe_key == dedupe_key).first()
            )
            if not existing:
                db.add(
                    Notification(
                        notif_id=f"notif_{uuid4().hex[:12]}",
                        notif_type=NotificationType.integration_credential_expiring,
                        priority=NotificationPriority.high,
                        title=f"{provider_name} {label} expiring soon",
                        body=(
                            f"The {label} for {provider_name} expires on "
                            f"{exp.date().isoformat()}. Rotate it before it lapses."
                        ),
                        link="/api-integrations",
                        entity_type="org_integration",
                        entity_id=i.id,
                        dedupe_key=dedupe_key,
                    )
                )

            cal_item = (
                db.query(ComplianceCalendarItem)
                .filter(
                    ComplianceCalendarItem.org_id == org_id,
                    ComplianceCalendarItem.integration_id == i.id,
                    ComplianceCalendarItem.item_type == CalendarItemType.credential_expiry,
                    ComplianceCalendarItem.status.in_(
                        [CalendarItemStatus.scheduled, CalendarItemStatus.overdue]
                    ),
                )
                .first()
            )
            if cal_item:
                cal_item.due_date = exp.date()
                cal_item.is_overdue = exp <= now
            else:
                db.add(
                    ComplianceCalendarItem(
                        org_id=org_id,
                        item_type=CalendarItemType.credential_expiry,
                        title=f"{provider_name} {label} expiry",
                        description=f"{label} for {provider_name} integration expires.",
                        integration_id=i.id,
                        due_date=exp.date(),
                        is_overdue=exp <= now,
                    )
                )

            flagged.append({"provider_slug": i.provider_slug, "credential_type": label, "expires_at": exp})

    db.commit()
    return {"checked": len(integrations), "flagged": flagged}


def migrate_legacy_connectors(db: Session, org_id: str) -> dict:
    """
    One-time consolidation: copy each org's ConnectorCredential rows
    (app/models/connector.py — the legacy bring-your-own-credentials store)
    into OrgIntegration so the Integrations Hub becomes the single source
    of truth. Source rows are left untouched (read-only thereafter); this
    is additive and safe to re-run.
    """
    legacy_rows = (
        db.query(ConnectorCredential)
        .filter(ConnectorCredential.organisation_id == org_id)
        .all()
    )

    migrated, skipped = [], []
    for row in legacy_rows:
        slug = LEGACY_CONNECTOR_SLUG_ALIASES.get(row.provider.value, row.provider.value)
        provider = (
            db.query(IntegrationProvider).filter(IntegrationProvider.slug == slug).first()
        )
        if not provider:
            skipped.append({"credential_id": row.credential_id, "reason": f"no catalog match for '{slug}'"})
            continue

        existing = (
            db.query(OrgIntegration)
            .filter(OrgIntegration.org_id == org_id, OrgIntegration.provider_id == provider.id)
            .first()
        )
        if existing and existing.credentials_encrypted:
            skipped.append({"credential_id": row.credential_id, "reason": "already configured in Hub"})
            continue

        try:
            decrypted = _decrypt(row.encrypted_credentials)
        except Exception:
            skipped.append({"credential_id": row.credential_id, "reason": "could not decrypt legacy credential"})
            continue

        if existing:
            existing.credentials_encrypted = encrypt_credentials(decrypted)
            existing.is_enabled = row.status.value == "active"
            target = existing
        else:
            target = OrgIntegration(
                org_id=org_id,
                provider_id=provider.id,
                provider_slug=slug,
                is_enabled=row.status.value == "active",
                credentials_encrypted=encrypt_credentials(decrypted),
                health_status=IntegrationHealthStatus.unknown,
                enabled_by=row.created_by,
            )
            db.add(target)
        migrated.append({"credential_id": row.credential_id, "provider_slug": slug})

    db.commit()
    return {"migrated": migrated, "skipped": skipped}
