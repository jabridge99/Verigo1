"""
Data Retention Service.

Provides:
- Policy CRUD (per-tenant or global)
- Deletion eligibility check for any entity
- Legal hold management
- Scheduled purge job (call from a cron / APScheduler task)

AUSTRAC AML/CTF Act 2006 defaults:
  - Customer / KYC records: 7 years from last transaction date
  - Transaction records: 7 years
  - ECDD subjects (high-risk/PEP): 10 years
  - Audit logs: 7 years (compliance with Record-keeping Rule 2007)
"""

from __future__ import annotations

import logging
import uuid
from datetime import datetime, timedelta, timezone
from typing import Optional

from sqlalchemy.orm import Session

from app.models.retention import EntityScope, LegalHold, RetentionPolicy

log = logging.getLogger("tvg.retention")

AUSTRAC_DEFAULTS: dict[EntityScope, int] = {
    EntityScope.customer: 7,
    EntityScope.kyc_record: 7,
    EntityScope.document: 7,
    EntityScope.transaction: 7,
    EntityScope.audit_log: 7,
    EntityScope.report: 7,
}


# ── Policy CRUD ───────────────────────────────────────────────────────────────


def get_policy(
    db: Session,
    entity_scope: EntityScope,
    industry_id: Optional[str] = None,
) -> RetentionPolicy:
    """Return the most-specific policy: tenant > global > AUSTRAC default (synthetic)."""
    if industry_id:
        p = (
            db.query(RetentionPolicy)
            .filter(
                RetentionPolicy.entity_scope == entity_scope,
                RetentionPolicy.industry_id == industry_id,
            )
            .first()
        )
        if p:
            return p
    # Global default
    p = (
        db.query(RetentionPolicy)
        .filter(
            RetentionPolicy.entity_scope == entity_scope,
            RetentionPolicy.industry_id is None,
        )
        .first()
    )
    if p:
        return p
    # Synthetic AUSTRAC default — not persisted
    return RetentionPolicy(
        policy_id="BUILTIN",
        entity_scope=entity_scope,
        retention_years=AUSTRAC_DEFAULTS.get(entity_scope, 7),
        legal_hold=False,
        notes="AUSTRAC statutory minimum (7 years)",
    )


def upsert_policy(
    db: Session,
    entity_scope: EntityScope,
    retention_years: int,
    industry_id: Optional[str] = None,
    legal_hold: bool = False,
    notes: Optional[str] = None,
    created_by: Optional[str] = None,
) -> RetentionPolicy:
    if retention_years < 0:
        raise ValueError("retention_years must be >= 0 (0 = indefinite)")

    p = (
        db.query(RetentionPolicy)
        .filter(
            RetentionPolicy.entity_scope == entity_scope,
            RetentionPolicy.industry_id == industry_id,
        )
        .first()
    )

    if p:
        p.retention_years = retention_years
        p.legal_hold = legal_hold
        if notes is not None:
            p.notes = notes
    else:
        p = RetentionPolicy(
            policy_id=f"RET-{uuid.uuid4().hex[:10].upper()}",
            industry_id=industry_id,
            entity_scope=entity_scope,
            retention_years=retention_years,
            legal_hold=legal_hold,
            notes=notes,
            created_by=created_by,
        )
        db.add(p)
    db.commit()
    db.refresh(p)
    return p


def list_policies(
    db: Session, industry_id: Optional[str] = None
) -> list[RetentionPolicy]:
    q = db.query(RetentionPolicy).filter(
        (RetentionPolicy.industry_id == industry_id)
        | (RetentionPolicy.industry_id is None)
    )
    return q.order_by(RetentionPolicy.entity_scope).all()


# ── Legal Hold ────────────────────────────────────────────────────────────────


def place_legal_hold(
    db: Session,
    entity_scope: EntityScope,
    entity_id: str,
    reason: str,
    held_by: str,
    industry_id: Optional[str] = None,
) -> LegalHold:
    hold = LegalHold(
        hold_id=f"HOLD-{uuid.uuid4().hex[:10].upper()}",
        industry_id=industry_id,
        entity_scope=entity_scope,
        entity_id=entity_id,
        reason=reason,
        held_by=held_by,
        active=True,
    )
    db.add(hold)
    db.commit()
    db.refresh(hold)
    log.info(
        "Legal hold placed: %s on %s/%s by %s",
        hold.hold_id,
        entity_scope,
        entity_id,
        held_by,
    )
    return hold


def release_legal_hold(
    db: Session,
    hold_id: str,
    released_by: str,
    industry_id: Optional[str] = None,
) -> LegalHold:
    hold = db.query(LegalHold).filter(LegalHold.hold_id == hold_id).first()
    if not hold:
        raise ValueError("Legal hold not found")
    if industry_id and hold.industry_id != industry_id:
        raise PermissionError("Cross-tenant hold access denied")
    hold.active = False
    hold.released_at = datetime.now(timezone.utc)
    hold.released_by = released_by
    db.commit()
    db.refresh(hold)
    return hold


def has_active_hold(db: Session, entity_scope: EntityScope, entity_id: str) -> bool:
    return (
        db.query(LegalHold)
        .filter(
            LegalHold.entity_scope == entity_scope,
            LegalHold.entity_id == entity_id,
            LegalHold.active,
        )
        .count()
        > 0
    )


# ── Deletion Eligibility ──────────────────────────────────────────────────────


def is_deletion_eligible(
    db: Session,
    entity_scope: EntityScope,
    entity_id: str,
    created_at: datetime,
    industry_id: Optional[str] = None,
    pep_or_high_risk: bool = False,
) -> dict:
    """
    Return eligibility metadata. Does NOT delete — callers decide what to do.

    Returns:
        eligible: bool
        reason: str
        retention_years: int
        eligible_after: datetime
    """
    if has_active_hold(db, entity_scope, entity_id):
        return {
            "eligible": False,
            "reason": "Active legal hold",
            "retention_years": None,
            "eligible_after": None,
        }

    policy = get_policy(db, entity_scope, industry_id)
    years = policy.retention_years

    # ECDD/PEP uplift: 10 years minimum
    if pep_or_high_risk and years < 10:
        years = 10

    if years == 0:
        return {
            "eligible": False,
            "reason": "Indefinite retention policy",
            "retention_years": 0,
            "eligible_after": None,
        }

    cutoff = created_at.replace(tzinfo=timezone.utc) + timedelta(days=years * 365)
    now = datetime.now(timezone.utc)
    eligible = now >= cutoff

    return {
        "eligible": eligible,
        "reason": "Retention period expired"
        if eligible
        else f"Retention period of {years} years not yet elapsed",
        "retention_years": years,
        "eligible_after": cutoff.isoformat(),
    }


# ── Scheduled purge report (dry-run only — no auto-delete) ───────────────────


def generate_purge_report(db: Session, industry_id: Optional[str] = None) -> dict:
    """
    Identify records past their retention window.
    Returns a summary for compliance review — does NOT delete anything.
    """
    from app.models.customer import Customer
    from app.models.kyc import KYCRecord

    now = datetime.now(timezone.utc)
    report: dict = {
        "generated_at": now.isoformat(),
        "industry_id": industry_id,
        "items": [],
    }

    def _cutoff(scope: EntityScope, pep: bool = False) -> datetime:
        p = get_policy(db, scope, industry_id)
        years = max(p.retention_years, 10 if pep else 0)
        return now - timedelta(days=years * 365)

    # Customers
    cutoff = _cutoff(EntityScope.customer)
    q = db.query(Customer).filter(Customer.created_at < cutoff)
    if industry_id:
        q = q.filter(Customer.industry_id == industry_id)
    for c in q.all():
        if not has_active_hold(db, EntityScope.customer, c.customer_id):
            report["items"].append(
                {
                    "scope": "customer",
                    "id": c.customer_id,
                    "created_at": c.created_at.isoformat() if c.created_at else None,
                    "action": "eligible_for_deletion",
                }
            )

    # KYC Records
    cutoff = _cutoff(EntityScope.kyc_record)
    for k in db.query(KYCRecord).filter(KYCRecord.created_at < cutoff).all():
        if not has_active_hold(db, EntityScope.kyc_record, k.kyc_id):
            report["items"].append(
                {
                    "scope": "kyc_record",
                    "id": k.kyc_id,
                    "created_at": k.created_at.isoformat() if k.created_at else None,
                    "action": "eligible_for_deletion",
                }
            )

    report["total_eligible"] = len(report["items"])
    return report
