"""
Screening — org-wide health dashboard, aggregating across records, alerts,
crypto wallets and adverse media. Part of the screening route package; see
__init__.py for the combined router.
"""

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.api.deps import org_id_for, require_analyst_or_above
from app.db.database import get_db
from app.models.screening import (
    AdverseMediaResult,
    AlertSeverity,
    AlertStatus,
    CryptoWalletScreening,
    ScreeningAlert,
    ScreeningRecord,
    ScreeningStatus,
    WalletRiskCategory,
)
from app.models.user import User

from ._shared import DISCLAIMER

router = APIRouter()


@router.get("/dashboard")
def screening_dashboard(
    db: Session = Depends(get_db),
    current_user: User = Depends(require_analyst_or_above),
):
    """Screening health summary for the org."""
    org_id = org_id_for(current_user)

    total = db.query(ScreeningRecord).filter(ScreeningRecord.org_id == org_id).count()
    pending = (
        db.query(ScreeningRecord)
        .filter(
            ScreeningRecord.org_id == org_id,
            ScreeningRecord.status == ScreeningStatus.pending,
        )
        .count()
    )
    potential_matches = (
        db.query(ScreeningRecord)
        .filter(
            ScreeningRecord.org_id == org_id,
            ScreeningRecord.status == ScreeningStatus.potential_match,
        )
        .count()
    )
    confirmed_matches = (
        db.query(ScreeningRecord)
        .filter(
            ScreeningRecord.org_id == org_id,
            ScreeningRecord.status == ScreeningStatus.confirmed_match,
        )
        .count()
    )

    # Alerts
    open_alerts = (
        db.query(ScreeningAlert)
        .filter(
            ScreeningAlert.org_id == org_id,
            ScreeningAlert.status == AlertStatus.open,
        )
        .count()
    )
    critical_alerts = (
        db.query(ScreeningAlert)
        .filter(
            ScreeningAlert.org_id == org_id,
            ScreeningAlert.status == AlertStatus.open,
            ScreeningAlert.severity == AlertSeverity.critical,
        )
        .count()
    )
    escalated_alerts = (
        db.query(ScreeningAlert)
        .filter(
            ScreeningAlert.org_id == org_id,
            ScreeningAlert.status == AlertStatus.escalated,
        )
        .count()
    )

    # Crypto
    crypto_high_risk = (
        db.query(CryptoWalletScreening)
        .filter(
            CryptoWalletScreening.org_id == org_id,
            CryptoWalletScreening.risk_category.in_(
                [
                    WalletRiskCategory.high_risk,
                    WalletRiskCategory.sanctioned,
                    WalletRiskCategory.darknet,
                    WalletRiskCategory.mixer,
                ]
            ),
        )
        .count()
    )

    # Adverse media
    open_media = (
        db.query(AdverseMediaResult)
        .filter(
            AdverseMediaResult.org_id == org_id,
            AdverseMediaResult.review_status == AlertStatus.open,
        )
        .count()
    )

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
