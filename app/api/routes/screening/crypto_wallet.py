"""
Screening — crypto wallet screening. Part of the screening route package;
see __init__.py for the combined router.
"""

from uuid import uuid4

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.api.deps import (
    org_id_for,
    require_analyst_or_above,
    require_compliance_or_above,
)
from app.config import settings
from app.db.database import get_db
from app.integrations.base import ProviderRejectedError, ProviderUnavailableError
from app.integrations.crypto import get_provider as get_crypto_provider
from app.models.screening import (
    CryptoProvider,
    CryptoWalletScreening,
    ScreeningStatus,
    WalletRiskCategory,
)
from app.models.user import User
from app.schemas.screening import WalletScreeningRequest
from app.services import billing_service as billing_svc

from ._shared import DISCLAIMER, _log, _resolve_customer

router = APIRouter()


@router.post("/crypto-wallet", status_code=201)
async def screen_crypto_wallet(
    payload: WalletScreeningRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_compliance_or_above),
):
    """
    Screen a crypto wallet address for sanctions/risk exposure.

    Routes to the configured CRYPTO_PROVIDER. Default ("internal", or
    unset) is OFAC's self-hosted sanctioned-address list (free, no API
    key) — direct OFAC-only address matches, no cluster-level risk
    scoring or exposure percentages. Chainalysis's free sanctions-only
    oracle and paid providers (Elliptic, TRM Labs — enterprise add-on
    required) are also available. Falls back to simulation mode only if
    CRYPTO_PROVIDER is explicitly set to a provider not yet implemented.

    DISCLAIMER: Wallet risk scores are data inputs only.
    The platform does not make compliance determinations about crypto transactions.
    """
    org_id = org_id_for(current_user)
    _resolve_customer(payload.customer_id, org_id, db)

    configured_provider = getattr(settings, "crypto_provider", "internal")
    addon_key = billing_svc.addon_for_provider(configured_provider)
    if addon_key and not billing_svc.has_addon(db, org_id, addon_key):
        raise HTTPException(
            402,
            {
                "error": "enterprise_addon_required",
                "message": (
                    f"'{configured_provider}' wallet screening requires the "
                    f"{billing_svc.ADDON_CATALOGUE[addon_key]['name']} add-on."
                ),
                "addon_key": addon_key.value,
                "purchase_url": "/api/v1/billing/addons/{}/purchase".format(
                    addon_key.value
                ),
            },
        )

    try:
        provider = get_crypto_provider()
    except (NotImplementedError, ProviderUnavailableError):
        provider = None

    if provider is not None:
        try:
            result = await provider.screen_address(
                payload.wallet_address, payload.network.value
            )
        except ProviderRejectedError as exc:
            raise HTTPException(502, str(exc))
        risk_category = (
            WalletRiskCategory.sanctioned
            if result.is_sanctioned
            else WalletRiskCategory.clear
        )
        screening = CryptoWalletScreening(
            id=f"cws_{uuid4().hex[:12]}",
            org_id=org_id,
            customer_id=payload.customer_id,
            wallet_address=payload.wallet_address,
            network=payload.network,
            wallet_label=payload.wallet_label,
            provider=CryptoProvider(provider.name),
            provider_reference=f"{provider.name.upper()}-{uuid4().hex[:8]}",
            risk_score=100.0 if result.is_sanctioned else 0.0,
            risk_category=risk_category,
            risk_details={
                "identifications": [
                    {
                        "category": i.category,
                        "name": i.name,
                        "description": i.description,
                        "url": i.url,
                    }
                    for i in result.identifications
                ]
            },
            sanctioned_exposure_pct=100.0 if result.is_sanctioned else 0.0,
            darknet_exposure_pct=0.0,
            mixer_exposure_pct=0.0,
            high_risk_exchange_pct=0.0,
            scam_exposure_pct=0.0,
            provider_raw_response=str(result.raw),
            status=ScreeningStatus.potential_match
            if result.is_sanctioned
            else ScreeningStatus.clear,
            triggered_by=current_user.id,
        )
    else:
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
            risk_details={"note": "Simulation only — no CRYPTO_PROVIDER configured."},
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
    _log(
        db,
        current_user,
        org_id,
        "crypto_wallet_screening",
        screening.id,
        action="crypto_wallet_screened",
        after_state={
            "customer_id": payload.customer_id,
            "network": screening.network.value,
            "risk_category": screening.risk_category.value,
            "status": screening.status.value,
        },
    )

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
    screenings = (
        db.query(CryptoWalletScreening)
        .filter(
            CryptoWalletScreening.org_id == org_id,
            CryptoWalletScreening.customer_id == customer_id,
        )
        .order_by(CryptoWalletScreening.screened_at.desc())
        .all()
    )

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
