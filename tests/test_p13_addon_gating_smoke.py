"""
Stage 13 follow-up: "industry compliance packs as a real, separately-
metered paid feature" (parked in PARKING_LOT.md's Stage 13 entry) is
implemented as add-on gating on the two report types it was scoped to for
this round — the Annual Independent Review (independent_review.py) and
the Quarterly Compliance Report (board_reporting.py's
BoardReportType.quarterly_compliance) — reusing the existing
AddonKey/SubscriptionAddon/has_addon() infrastructure that already gated
enterprise crypto screening, rather than building a new mechanism.
"""

import uuid

from app.models.billing import AddonKey, AddonStatus, SubscriptionAddon
from tests.conftest import _auth


def _grant_addon(db, org_id: str, addon_key: AddonKey) -> None:
    db.add(
        SubscriptionAddon(
            addon_id=f"addon_test_{uuid.uuid4().hex[:10]}",
            org_id=org_id,
            addon_key=addon_key,
            status=AddonStatus.active,
        )
    )
    db.commit()


def test_independent_review_blocked_without_addon(client, compliance_user):
    resp = client.post(
        "/api/v1/independent-reviews",
        headers=_auth(compliance_user),
        json={
            "review_ref": f"IR-{uuid.uuid4().hex[:8]}",
            "review_type": "internal",
            "review_scope": "aml_program",
            "title": "Gated review",
        },
    )
    assert resp.status_code == 402, resp.text


def test_independent_review_allowed_with_addon(client, db, compliance_user):
    _grant_addon(db, compliance_user.org_id, AddonKey.independent_review)
    resp = client.post(
        "/api/v1/independent-reviews",
        headers=_auth(compliance_user),
        json={
            "review_ref": f"IR-{uuid.uuid4().hex[:8]}",
            "review_type": "internal",
            "review_scope": "aml_program",
            "title": "Unlocked review",
        },
    )
    assert resp.status_code == 201, resp.text


def test_quarterly_compliance_report_blocked_without_addon(client, compliance_user):
    from datetime import date, timedelta

    resp = client.post(
        "/api/v1/board-reports",
        headers=_auth(compliance_user),
        json={
            "report_ref": f"CO-Q-{uuid.uuid4().hex[:8]}",
            "report_type": "quarterly_compliance",
            "period": "q1",
            "period_start": str(date.today() - timedelta(days=90)),
            "period_end": str(date.today()),
        },
    )
    assert resp.status_code == 402, resp.text


def test_quarterly_compliance_report_allowed_with_addon(client, db, compliance_user):
    from datetime import date, timedelta

    _grant_addon(db, compliance_user.org_id, AddonKey.quarterly_compliance_report)
    resp = client.post(
        "/api/v1/board-reports",
        headers=_auth(compliance_user),
        json={
            "report_ref": f"CO-Q-{uuid.uuid4().hex[:8]}",
            "report_type": "quarterly_compliance",
            "period": "q1",
            "period_start": str(date.today() - timedelta(days=90)),
            "period_end": str(date.today()),
        },
    )
    assert resp.status_code == 201, resp.text


def test_other_board_report_types_not_gated(client, compliance_user):
    """board_aml, risk_committee, and annual_aml stay free — only
    quarterly_compliance is gated behind the new add-on."""
    from datetime import date, timedelta

    resp = client.post(
        "/api/v1/board-reports",
        headers=_auth(compliance_user),
        json={
            "report_ref": f"BR-{uuid.uuid4().hex[:8]}",
            "report_type": "board_aml",
            "period": "q1",
            "period_start": str(date.today() - timedelta(days=90)),
            "period_end": str(date.today()),
        },
    )
    assert resp.status_code == 201, resp.text
