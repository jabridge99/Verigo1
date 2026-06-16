"""
Screening Hub — Phase 5.

Unified workflow for sanctions, PEP, watchlist, adverse media, and crypto wallet screening.

Roles:
  GET (records, alerts, dashboard)  — analyst+
  Create screening / review alerts  — compliance+
  Escalate to MLRO                  — compliance+
  Bulk batch screen                 — compliance+

Design:
  ScreeningRecord is append-only — re-screening creates a new record.
  ScreeningAlert is mutable (status transitions only).
  Crypto wallet screening is a separate endpoint (blockchain-specific data).
  Adverse media results have article-level detail.

DISCLAIMER: Screening results are data inputs to the compliance workflow.
The platform does not determine whether a match constitutes a sanctions violation
or regulatory breach. All decisions remain with the reporting entity.
"""
from datetime import datetime, timezone
from typing import List, Optional
from uuid import uuid4

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session

from app.api.deps import (
    Pagination,
    org_id_for,
    require_analyst_or_above,
    require_compliance_or_above,
    require_mlro_or_above,
)
from app.db.database import get_db
from app.models.customer import Customer
from app.models.screening import (
    AdverseMediaCategory,
    AdverseMediaResult,
    AlertSeverity,
    AlertStatus,
    CryptoNetwork,
    CryptoProvider,
    CryptoWalletScreening,
    ScreeningAlert,
    ScreeningEntityType,
    ScreeningProvider,
    ScreeningRecord,
    ScreeningStatus,
    ScreeningType,
    WalletRiskCategory,
)
from app.models.user import User

router = APIRouter(prefix="/screening", tags=["Screening Hub"])

DISCLAIMER = (
    "Screening results are data inputs to the compliance workflow only. "
    "The platform does not determine whether a match constitutes a sanctions violation, "
    "PEP risk, or any regulatory breach. All decisions remain with the reporting entity."
)


# ── Schemas ───────────────────────────────────────────────────────────────────

class ScreeningRunRequest(BaseModel):
    customer_id: str
    screening_types: List[ScreeningType] = Field(
        ..., description="One or more screening types to run"
    )
    entity_type: ScreeningEntityType = ScreeningEntityType.customer
    entity_id: Optional[str] = None      # defaults to customer_id
    entity_name: Optional[str] = None    # override — uses customer name if omitted
    entity_dob: Optional[str] = None
    entity_nationality: Optional[str] = None
    provider: ScreeningProvider = ScreeningProvider.internal
    notes: Optional[str] = None


class BatchScreeningRequest(BaseModel):
    customer_ids: List[str] = Field(..., min_items=1, max_items=50)
    screening_types: List[ScreeningType]
    provider: ScreeningProvider = ScreeningProvider.internal


class AlertReviewRequest(BaseModel):
    action: str = Field(
        ...,
        description="One of: dismiss (false positive), confirm, escalate, close"
    )
    notes: str = Field(..., min_length=10, description="Resolution notes required")
    assigned_to: Optional[str] = None


class WalletScreeningRequest(BaseModel):
    customer_id: str
    wallet_address: str = Field(..., min_length=10)
    network: CryptoNetwork
    wallet_label: Optional[str] = None
    provider: CryptoProvider = CryptoProvider.internal


class AdverseMediaRequest(BaseModel):
    customer_id: str
    headline: str = Field(..., max_length=1000)
    category: AdverseMediaCategory
    source_name: Optional[str] = None
    source_url: Optional[str] = Field(None, max_length=2000)
    publication_date: Optional[datetime] = None
    jurisdiction: Optional[str] = Field(None, max_length=2)
    match_confidence: Optional[float] = Field(None, ge=0, le=100)
    provider_raw_response: Optional[str] = None


# ── Helpers ───────────────────────────────────────────────────────────────────

def _record_dict(r: ScreeningRecord) -> dict:
    return {
        "id": r.id,
        "customer_id": r.customer_id,
        "screening_type": r.screening_type.value,
        "entity_type": r.entity_type.value,
        "entity_id": r.entity_id,
        "entity_name": r.entity_name,
        "provider": r.provider.value,
        "status": r.status.value,
        "match_count": r.match_count,
        "match_score": r.match_score,
        "match_details": r.match_details,
        "pep_category": r.pep_category,
        "pep_country": r.pep_country,
        "pep_position": r.pep_position,
        "is_false_positive": r.is_false_positive,
        "reviewed_by": r.reviewed_by,
        "reviewed_at": r.reviewed_at,
        "reviewer_notes": r.reviewer_notes,
        "triggered_by": r.triggered_by,
        "screened_at": r.screened_at,
        "alerts": [_alert_dict(a) for a in (r.alerts or [])],
    }


def _alert_dict(a: ScreeningAlert) -> dict:
    return {
        "id": a.id,
        "screening_record_id": a.screening_record_id,
        "customer_id": a.customer_id,
        "severity": a.severity.value,
        "status": a.status.value,
        "alert_type": a.alert_type,
        "summary": a.summary,
        "assigned_to": a.assigned_to,
        "assigned_at": a.assigned_at,
        "resolved_by": a.resolved_by,
        "resolved_at": a.resolved_at,
        "resolution_notes": a.resolution_notes,
        "escalated_to": a.escalated_to,
        "escalated_at": a.escalated_at,
        "created_at": a.created_at,
    }


def _resolve_customer(customer_id: str, org_id: str, db: Session) -> Customer:
    customer = db.query(Customer).filter(
        Customer.id == customer_id,
        Customer.org_id == org_id,
    ).first()
    if not customer:
        raise HTTPException(404, f"Customer '{customer_id}' not found.")
    return customer


def _simulate_screening(
    screening_type: ScreeningType,
    entity_name: str,
    provider: ScreeningProvider,
) -> dict:
    """
    Placeholder — production integrates with the selected provider via Integration Hub.
    Returns a structured result with status and match details.
    """
    return {
        "status": ScreeningStatus.clear,
        "match_count": 0,
        "match_score": None,
        "match_details": None,
        "provider_reference": f"SIM-{uuid4().hex[:8].upper()}",
        "note": "Simulation only — wire to Integration Hub for live provider calls.",
    }


def _severity_for_type(screening_type: ScreeningType, match_count: int) -> AlertSeverity:
    if screening_type == ScreeningType.sanctions:
        return AlertSeverity.critical
    if screening_type in (ScreeningType.pep, ScreeningType.ubo_pep):
        return AlertSeverity.high
    if screening_type == ScreeningType.adverse_media:
        return AlertSeverity.medium
    return AlertSeverity.medium


# ── Screening Records ─────────────────────────────────────────────────────────

@router.post("/run", status_code=201)
def run_screening(
    payload: ScreeningRunRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_compliance_or_above),
):
    """
    Run one or more screening types for a customer.

    Each type creates a separate ScreeningRecord (append-only).
    Matches above threshold automatically raise ScreeningAlerts.

    In production, routes to the enabled Integration Hub provider for this category.
    Currently runs in simulation mode — results are placeholders.

    DISCLAIMER: Screening results are not compliance determinations.
    """
    org_id = org_id_for(current_user)
    customer = _resolve_customer(payload.customer_id, org_id, db)

    entity_id = payload.entity_id or customer.id
    entity_name = payload.entity_name or getattr(customer, "full_name", None) or customer.id

    created_records = []
    for stype in payload.screening_types:
        result = _simulate_screening(stype, entity_name, payload.provider)

        record = ScreeningRecord(
            id=f"scr_{uuid4().hex[:12]}",
            org_id=org_id,
            customer_id=customer.id,
            screening_type=stype,
            entity_type=payload.entity_type,
            entity_id=entity_id,
            entity_name=entity_name,
            entity_dob=payload.entity_dob,
            entity_nationality=payload.entity_nationality,
            provider=payload.provider,
            provider_reference=result.get("provider_reference"),
            status=result["status"],
            match_count=result.get("match_count", 0),
            match_score=result.get("match_score"),
            match_details=result.get("match_details"),
            triggered_by=current_user.id,
        )
        db.add(record)
        db.flush()

        # Raise alert on any match
        if result["match_count"] > 0 or result["status"] == ScreeningStatus.potential_match:
            alert = ScreeningAlert(
                id=f"alert_{uuid4().hex[:10]}",
                org_id=org_id,
                screening_record_id=record.id,
                customer_id=customer.id,
                severity=_severity_for_type(stype, result["match_count"]),
                status=AlertStatus.open,
                alert_type=stype.value,
                summary=(
                    f"{stype.value.upper()} screening: {result['match_count']} "
                    f"potential match(es) found for '{entity_name}'. "
                    "Review required before proceeding."
                ),
            )
            db.add(alert)

        created_records.append(record)

    db.commit()
    for r in created_records:
        db.refresh(r)

    return {
        "records_created": len(created_records),
        "records": [_record_dict(r) for r in created_records],
        "disclaimer": DISCLAIMER,
    }


@router.get("")
def list_screening_records(
    customer_id: Optional[str] = Query(None),
    screening_type: Optional[ScreeningType] = Query(None),
    status: Optional[ScreeningStatus] = Query(None),
    has_alerts: Optional[bool] = Query(None),
    db: Session = Depends(get_db),
    current_user: User = Depends(require_analyst_or_above),
    page: Pagination = Depends(),
):
    """List screening records for this org with optional filters."""
    org_id = org_id_for(current_user)
    q = db.query(ScreeningRecord).filter(ScreeningRecord.org_id == org_id)

    if customer_id:
        q = q.filter(ScreeningRecord.customer_id == customer_id)
    if screening_type:
        q = q.filter(ScreeningRecord.screening_type == screening_type)
    if status:
        q = q.filter(ScreeningRecord.status == status)

    records = q.order_by(ScreeningRecord.screened_at.desc()).offset(page.offset).limit(page.limit).all()

    if has_alerts is not None:
        if has_alerts:
            records = [r for r in records if r.alerts]
        else:
            records = [r for r in records if not r.alerts]

    return {
        "records": [_record_dict(r) for r in records],
        "count": len(records),
        "disclaimer": DISCLAIMER,
    }


@router.get("/dashboard")
def screening_dashboard(
    db: Session = Depends(get_db),
    current_user: User = Depends(require_analyst_or_above),
):
    """Screening health summary for the org."""
    org_id = org_id_for(current_user)

    total = db.query(ScreeningRecord).filter(ScreeningRecord.org_id == org_id).count()
    pending = db.query(ScreeningRecord).filter(
        ScreeningRecord.org_id == org_id,
        ScreeningRecord.status == ScreeningStatus.pending,
    ).count()
    potential_matches = db.query(ScreeningRecord).filter(
        ScreeningRecord.org_id == org_id,
        ScreeningRecord.status == ScreeningStatus.potential_match,
    ).count()
    confirmed_matches = db.query(ScreeningRecord).filter(
        ScreeningRecord.org_id == org_id,
        ScreeningRecord.status == ScreeningStatus.confirmed_match,
    ).count()

    # Alerts
    open_alerts = db.query(ScreeningAlert).filter(
        ScreeningAlert.org_id == org_id,
        ScreeningAlert.status == AlertStatus.open,
    ).count()
    critical_alerts = db.query(ScreeningAlert).filter(
        ScreeningAlert.org_id == org_id,
        ScreeningAlert.status == AlertStatus.open,
        ScreeningAlert.severity == AlertSeverity.critical,
    ).count()
    escalated_alerts = db.query(ScreeningAlert).filter(
        ScreeningAlert.org_id == org_id,
        ScreeningAlert.status == AlertStatus.escalated,
    ).count()

    # Crypto
    crypto_high_risk = db.query(CryptoWalletScreening).filter(
        CryptoWalletScreening.org_id == org_id,
        CryptoWalletScreening.risk_category.in_([
            WalletRiskCategory.high_risk,
            WalletRiskCategory.sanctioned,
            WalletRiskCategory.darknet,
            WalletRiskCategory.mixer,
        ]),
    ).count()

    # Adverse media
    open_media = db.query(AdverseMediaResult).filter(
        AdverseMediaResult.org_id == org_id,
        AdverseMediaResult.review_status == AlertStatus.open,
    ).count()

    def _light(count, warn, danger):
        if count >= danger:
            return "red"
        if count >= warn:
            return "amber"
        return "green"

    return {
        "records": {
            "total": total,
            "pending": pending,
            "potential_matches": potential_matches,
            "confirmed_matches": confirmed_matches,
        },
        "alerts": {
            "open": open_alerts,
            "critical": critical_alerts,
            "escalated": escalated_alerts,
            "traffic_light": _light(open_alerts, 5, 15),
        },
        "crypto_wallets": {
            "high_risk_count": crypto_high_risk,
            "traffic_light": _light(crypto_high_risk, 1, 5),
        },
        "adverse_media": {
            "open_reviews": open_media,
            "traffic_light": _light(open_media, 3, 10),
        },
        "disclaimer": DISCLAIMER,
    }


@router.get("/alerts")
def list_alerts(
    status: Optional[AlertStatus] = Query(None),
    severity: Optional[AlertSeverity] = Query(None),
    customer_id: Optional[str] = Query(None),
    db: Session = Depends(get_db),
    current_user: User = Depends(require_analyst_or_above),
    page: Pagination = Depends(),
):
    """List all screening alerts for this org."""
    org_id = org_id_for(current_user)
    q = db.query(ScreeningAlert).filter(ScreeningAlert.org_id == org_id)
    if status:
        q = q.filter(ScreeningAlert.status == status)
    if severity:
        q = q.filter(ScreeningAlert.severity == severity)
    if customer_id:
        q = q.filter(ScreeningAlert.customer_id == customer_id)

    alerts = q.order_by(ScreeningAlert.created_at.desc()).offset(page.offset).limit(page.limit).all()
    return {"alerts": [_alert_dict(a) for a in alerts], "count": len(alerts)}


@router.get("/{record_id}")
def get_screening_record(
    record_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_analyst_or_above),
):
    """Get a specific screening record with its alerts."""
    org_id = org_id_for(current_user)
    record = db.query(ScreeningRecord).filter(
        ScreeningRecord.id == record_id,
        ScreeningRecord.org_id == org_id,
    ).first()
    if not record:
        raise HTTPException(404, "Screening record not found.")
    return _record_dict(record)


@router.post("/{record_id}/re-screen", status_code=201)
def re_screen(
    record_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_compliance_or_above),
):
    """
    Trigger a new screening run based on an existing record.
    Creates a fresh ScreeningRecord — previous records are preserved (append-only audit trail).
    """
    org_id = org_id_for(current_user)
    original = db.query(ScreeningRecord).filter(
        ScreeningRecord.id == record_id,
        ScreeningRecord.org_id == org_id,
    ).first()
    if not original:
        raise HTTPException(404, "Screening record not found.")

    result = _simulate_screening(original.screening_type, original.entity_name or "", original.provider)

    new_record = ScreeningRecord(
        id=f"scr_{uuid4().hex[:12]}",
        org_id=org_id,
        customer_id=original.customer_id,
        screening_type=original.screening_type,
        entity_type=original.entity_type,
        entity_id=original.entity_id,
        entity_name=original.entity_name,
        entity_dob=original.entity_dob,
        entity_nationality=original.entity_nationality,
        provider=original.provider,
        provider_reference=result.get("provider_reference"),
        status=result["status"],
        match_count=result.get("match_count", 0),
        match_score=result.get("match_score"),
        match_details=result.get("match_details"),
        triggered_by=current_user.id,
    )
    db.add(new_record)
    db.commit()
    db.refresh(new_record)
    return {
        "message": "Re-screening record created.",
        "record": _record_dict(new_record),
        "disclaimer": DISCLAIMER,
    }


# ── Alert Management ──────────────────────────────────────────────────────────

@router.post("/alerts/{alert_id}/review")
def review_alert(
    alert_id: str,
    payload: AlertReviewRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_compliance_or_above),
):
    """
    Action a screening alert.

    Actions:
      dismiss   — mark as false positive; requires notes
      confirm   — confirm the match; triggers EDD consideration
      escalate  — send to MLRO for further review
      close     — close without action (requires notes explaining why)

    DISCLAIMER: The platform does not determine whether a match requires regulatory action.
    All decisions remain with the reporting entity.
    """
    org_id = org_id_for(current_user)
    alert = db.query(ScreeningAlert).filter(
        ScreeningAlert.id == alert_id,
        ScreeningAlert.org_id == org_id,
    ).first()
    if not alert:
        raise HTTPException(404, "Alert not found.")

    if alert.status in (AlertStatus.dismissed, AlertStatus.closed):
        raise HTTPException(409, f"Alert is already {alert.status.value}.")

    now = datetime.now(timezone.utc)
    action = payload.action.lower()

    if action == "dismiss":
        alert.status = AlertStatus.dismissed
        alert.resolved_by = current_user.id
        alert.resolved_at = now
        alert.resolution_notes = payload.notes
        # Mark screening record as false positive
        record = db.query(ScreeningRecord).filter(
            ScreeningRecord.id == alert.screening_record_id
        ).first()
        if record:
            record.is_false_positive = True
            record.status = ScreeningStatus.false_positive
            record.reviewed_by = current_user.id
            record.reviewed_at = now
            record.reviewer_notes = payload.notes

    elif action == "confirm":
        alert.status = AlertStatus.under_review
        alert.resolved_by = current_user.id
        alert.resolution_notes = payload.notes
        record = db.query(ScreeningRecord).filter(
            ScreeningRecord.id == alert.screening_record_id
        ).first()
        if record:
            record.status = ScreeningStatus.confirmed_match
            record.reviewed_by = current_user.id
            record.reviewed_at = now
            record.reviewer_notes = payload.notes

    elif action == "escalate":
        alert.status = AlertStatus.escalated
        alert.escalated_to = payload.assigned_to
        alert.escalated_at = now
        alert.resolution_notes = payload.notes

    elif action == "close":
        alert.status = AlertStatus.closed
        alert.resolved_by = current_user.id
        alert.resolved_at = now
        alert.resolution_notes = payload.notes

    else:
        raise HTTPException(400, f"Unknown action '{action}'. Use: dismiss, confirm, escalate, close.")

    if payload.assigned_to and action != "escalate":
        alert.assigned_to = payload.assigned_to
        alert.assigned_at = now

    db.commit()
    db.refresh(alert)
    return {
        "alert": _alert_dict(alert),
        "disclaimer": DISCLAIMER,
    }


@router.post("/alerts/{alert_id}/assign")
def assign_alert(
    alert_id: str,
    assigned_to: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_compliance_or_above),
):
    """Assign a screening alert to a reviewer."""
    org_id = org_id_for(current_user)
    alert = db.query(ScreeningAlert).filter(
        ScreeningAlert.id == alert_id,
        ScreeningAlert.org_id == org_id,
    ).first()
    if not alert:
        raise HTTPException(404, "Alert not found.")
    alert.assigned_to = assigned_to
    alert.assigned_at = datetime.now(timezone.utc)
    db.commit()
    db.refresh(alert)
    return _alert_dict(alert)


# ── Batch Screening ───────────────────────────────────────────────────────────

@router.post("/batch", status_code=202)
def batch_screen(
    payload: BatchScreeningRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_compliance_or_above),
):
    """
    Queue batch screening for up to 50 customers.

    Each customer × each screening type = one ScreeningRecord.
    Returns summary; in production this dispatches to a background task queue.
    Currently runs synchronously (small batches only in demo mode).

    DISCLAIMER: Screening results are not compliance determinations.
    """
    org_id = org_id_for(current_user)

    customers = db.query(Customer).filter(
        Customer.id.in_(payload.customer_ids),
        Customer.org_id == org_id,
    ).all()

    found_ids = {c.id for c in customers}
    missing = [cid for cid in payload.customer_ids if cid not in found_ids]

    records_created = 0
    for customer in customers:
        entity_name = getattr(customer, "full_name", None) or customer.id
        for stype in payload.screening_types:
            result = _simulate_screening(stype, entity_name, payload.provider)
            record = ScreeningRecord(
                id=f"scr_{uuid4().hex[:12]}",
                org_id=org_id,
                customer_id=customer.id,
                screening_type=stype,
                entity_type=ScreeningEntityType.customer,
                entity_id=customer.id,
                entity_name=entity_name,
                provider=payload.provider,
                provider_reference=result.get("provider_reference"),
                status=result["status"],
                match_count=result.get("match_count", 0),
                match_score=result.get("match_score"),
                match_details=result.get("match_details"),
                triggered_by=current_user.id,
            )
            db.add(record)
            records_created += 1

    db.commit()
    return {
        "customers_screened": len(customers),
        "records_created": records_created,
        "screening_types": [t.value for t in payload.screening_types],
        "missing_customer_ids": missing,
        "disclaimer": DISCLAIMER,
    }


# ── Crypto Wallet Screening ───────────────────────────────────────────────────

@router.post("/crypto-wallet", status_code=201)
def screen_crypto_wallet(
    payload: WalletScreeningRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_compliance_or_above),
):
    """
    Screen a crypto wallet address for risk indicators.

    In production, routes to Chainalysis / TRM Labs / Elliptic via Integration Hub.
    Currently runs in simulation mode — results are placeholders.

    DISCLAIMER: Wallet risk scores are data inputs only.
    The platform does not make compliance determinations about crypto transactions.
    """
    org_id = org_id_for(current_user)
    _resolve_customer(payload.customer_id, org_id, db)

    screening = CryptoWalletScreening(
        id=f"cws_{uuid4().hex[:12]}",
        org_id=org_id,
        customer_id=payload.customer_id,
        wallet_address=payload.wallet_address,
        network=payload.network,
        wallet_label=payload.wallet_label,
        provider=payload.provider,
        provider_reference=f"SIM-{uuid4().hex[:8].upper()}",
        risk_score=None,
        risk_category=WalletRiskCategory.clear,
        risk_details={"note": "Simulation only — wire to provider via Integration Hub."},
        sanctioned_exposure_pct=0.0,
        darknet_exposure_pct=0.0,
        mixer_exposure_pct=0.0,
        high_risk_exchange_pct=0.0,
        scam_exposure_pct=0.0,
        status=ScreeningStatus.clear,
        triggered_by=current_user.id,
    )
    db.add(screening)
    db.commit()
    db.refresh(screening)

    return {
        "id": screening.id,
        "wallet_address": screening.wallet_address,
        "network": screening.network.value,
        "risk_score": screening.risk_score,
        "risk_category": screening.risk_category.value,
        "risk_details": screening.risk_details,
        "sanctioned_exposure_pct": screening.sanctioned_exposure_pct,
        "darknet_exposure_pct": screening.darknet_exposure_pct,
        "mixer_exposure_pct": screening.mixer_exposure_pct,
        "status": screening.status.value,
        "screened_at": screening.screened_at,
        "disclaimer": DISCLAIMER,
    }


@router.get("/crypto-wallet/{customer_id}")
def list_wallet_screenings(
    customer_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_analyst_or_above),
):
    """List all wallet screenings for a customer."""
    org_id = org_id_for(current_user)
    screenings = db.query(CryptoWalletScreening).filter(
        CryptoWalletScreening.org_id == org_id,
        CryptoWalletScreening.customer_id == customer_id,
    ).order_by(CryptoWalletScreening.screened_at.desc()).all()

    return [
        {
            "id": s.id,
            "wallet_address": s.wallet_address,
            "network": s.network.value,
            "wallet_label": s.wallet_label,
            "risk_score": s.risk_score,
            "risk_category": s.risk_category.value if s.risk_category else None,
            "sanctioned_exposure_pct": s.sanctioned_exposure_pct,
            "darknet_exposure_pct": s.darknet_exposure_pct,
            "mixer_exposure_pct": s.mixer_exposure_pct,
            "status": s.status.value,
            "reviewed_by": s.reviewed_by,
            "screened_at": s.screened_at,
        }
        for s in screenings
    ]


# ── Adverse Media ─────────────────────────────────────────────────────────────

@router.post("/adverse-media", status_code=201)
def record_adverse_media(
    payload: AdverseMediaRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_compliance_or_above),
):
    """
    Record an adverse media finding for a customer.

    Typically called by an integration (ComplyAdvantage, LexisNexis, etc.)
    or entered manually by a compliance analyst after media review.

    DISCLAIMER: Adverse media is a data input. The platform does not assess
    whether media constitutes evidence of financial crime.
    """
    org_id = org_id_for(current_user)
    _resolve_customer(payload.customer_id, org_id, db)

    result = AdverseMediaResult(
        id=f"adm_{uuid4().hex[:12]}",
        org_id=org_id,
        customer_id=payload.customer_id,
        category=payload.category,
        headline=payload.headline,
        source_name=payload.source_name,
        source_url=payload.source_url,
        publication_date=payload.publication_date,
        jurisdiction=payload.jurisdiction,
        match_confidence=payload.match_confidence,
        review_status=AlertStatus.open,
        provider_raw_response=payload.provider_raw_response,
    )
    db.add(result)
    db.commit()
    db.refresh(result)

    return {
        "id": result.id,
        "customer_id": result.customer_id,
        "category": result.category.value,
        "headline": result.headline,
        "source_name": result.source_name,
        "match_confidence": result.match_confidence,
        "review_status": result.review_status.value,
        "created_at": result.created_at,
        "disclaimer": DISCLAIMER,
    }


@router.get("/adverse-media/{customer_id}")
def list_adverse_media(
    customer_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_analyst_or_above),
):
    """List all adverse media results for a customer."""
    org_id = org_id_for(current_user)
    results = db.query(AdverseMediaResult).filter(
        AdverseMediaResult.org_id == org_id,
        AdverseMediaResult.customer_id == customer_id,
    ).order_by(AdverseMediaResult.created_at.desc()).all()

    return [
        {
            "id": r.id,
            "category": r.category.value,
            "headline": r.headline,
            "source_name": r.source_name,
            "publication_date": r.publication_date,
            "jurisdiction": r.jurisdiction,
            "match_confidence": r.match_confidence,
            "is_confirmed_match": r.is_confirmed_match,
            "is_false_positive": r.is_false_positive,
            "review_status": r.review_status.value,
            "reviewed_by": r.reviewed_by,
            "reviewed_at": r.reviewed_at,
            "created_at": r.created_at,
        }
        for r in results
    ]


@router.post("/adverse-media/{result_id}/review")
def review_adverse_media(
    result_id: str,
    action: str = Query(..., description="confirm or dismiss"),
    notes: str = Query(..., min_length=10),
    db: Session = Depends(get_db),
    current_user: User = Depends(require_compliance_or_above),
):
    """Review an adverse media result — confirm the match or dismiss as false positive."""
    org_id = org_id_for(current_user)
    result = db.query(AdverseMediaResult).filter(
        AdverseMediaResult.id == result_id,
        AdverseMediaResult.org_id == org_id,
    ).first()
    if not result:
        raise HTTPException(404, "Adverse media result not found.")

    if action == "confirm":
        result.is_confirmed_match = True
        result.review_status = AlertStatus.under_review
    elif action == "dismiss":
        result.is_false_positive = True
        result.review_status = AlertStatus.dismissed
    else:
        raise HTTPException(400, "Action must be 'confirm' or 'dismiss'.")

    result.reviewed_by = current_user.id
    result.reviewed_at = datetime.now(timezone.utc)
    result.reviewer_notes = notes

    db.commit()
    db.refresh(result)
    return {
        "id": result.id,
        "is_confirmed_match": result.is_confirmed_match,
        "is_false_positive": result.is_false_positive,
        "review_status": result.review_status.value,
        "reviewed_by": result.reviewed_by,
        "disclaimer": DISCLAIMER,
    }


# ── Customer Screening Summary ────────────────────────────────────────────────

@router.get("/customers/{customer_id}/summary")
def customer_screening_summary(
    customer_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_analyst_or_above),
):
    """
    Full screening summary for a customer across all screening types.
    Shows most recent record per type plus open alerts.
    """
    org_id = org_id_for(current_user)
    _resolve_customer(customer_id, org_id, db)

    records = db.query(ScreeningRecord).filter(
        ScreeningRecord.org_id == org_id,
        ScreeningRecord.customer_id == customer_id,
    ).order_by(ScreeningRecord.screened_at.desc()).all()

    latest_by_type: dict = {}
    for r in records:
        if r.screening_type.value not in latest_by_type:
            latest_by_type[r.screening_type.value] = _record_dict(r)

    open_alerts = db.query(ScreeningAlert).filter(
        ScreeningAlert.org_id == org_id,
        ScreeningAlert.customer_id == customer_id,
        ScreeningAlert.status.in_([AlertStatus.open, AlertStatus.under_review, AlertStatus.escalated]),
    ).all()

    wallets = db.query(CryptoWalletScreening).filter(
        CryptoWalletScreening.org_id == org_id,
        CryptoWalletScreening.customer_id == customer_id,
    ).count()

    media = db.query(AdverseMediaResult).filter(
        AdverseMediaResult.org_id == org_id,
        AdverseMediaResult.customer_id == customer_id,
        AdverseMediaResult.is_false_positive == False,
    ).count()

    return {
        "customer_id": customer_id,
        "total_screenings": len(records),
        "latest_by_type": latest_by_type,
        "open_alerts": [_alert_dict(a) for a in open_alerts],
        "open_alert_count": len(open_alerts),
        "crypto_wallet_screenings": wallets,
        "confirmed_adverse_media": media,
        "overall_clear": len(open_alerts) == 0 and media == 0,
        "disclaimer": DISCLAIMER,
    }
