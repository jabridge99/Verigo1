"""
P34: ECDDRecord couldn't distinguish "relationship exited" (an existing
customer offboarded after review) from "service declined" (a new applicant
never onboarded) -- the CO Quarterly Compliance Report template
(VERIGO-GEN-COR) tracks these as separate metrics, since they carry
different regulatory implications (an exit can itself warrant an SMR
consideration; a decline never onboarded the risk in the first place).

Tests go through the real API: /reports/ecdd/ create, then
PATCH .../decision, asserting rejection_type is required when rejecting,
validated against the real enum, cleared on any re-decision away from
rejected, and correctly split in the CO Quarterly Report's ECDD section.
"""

import uuid
from datetime import date, timedelta

from app.models.billing import AddonKey, AddonStatus, SubscriptionAddon
from app.models.customer import Customer, CustomerStatus, CustomerType, RiskLevel
from app.models.report import ECDDRecord
from app.models.user import UserRole
from tests.conftest import _auth, _make_user

BASE = "/api/v1/reports/ecdd"


def _customer(db, org_id, **overrides):
    defaults = dict(
        customer_ref=f"CUST-{uuid.uuid4().hex[:8]}",
        org_id=org_id,
        customer_type=CustomerType.individual,
        full_name="Test Customer",
        risk_level=RiskLevel.low,
        status=CustomerStatus.active,
    )
    defaults.update(overrides)
    c = Customer(**defaults)
    db.add(c)
    db.commit()
    db.refresh(c)
    return c


def _setup(db):
    admin = _make_user(db, UserRole.admin)
    org_id = admin.org_id
    compliance = _make_user(db, UserRole.compliance, industry_id=org_id)
    analyst = _make_user(db, UserRole.analyst, industry_id=org_id)
    return admin, compliance, analyst


def _create_ecdd(client, headers, customer_id):
    resp = client.post(
        f"{BASE}/",
        json={"customer_id": customer_id, "trigger_reason": "pep_match"},
        headers=headers,
    )
    assert resp.status_code == 201, resp.text
    # decide_ecdd() looks up by the human-readable ecdd_id (ECDD-XXXX...),
    # not the primary key id.
    return resp.json()["ecdd_id"]


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


class TestRejectionTypeRequiredAndValidated:
    def test_rejecting_without_rejection_type_is_a_400(self, client, db):
        admin, compliance, analyst = _setup(db)
        customer = _customer(db, admin.org_id)
        ecdd_id = _create_ecdd(client, _auth(analyst), customer.id)

        resp = client.patch(
            f"{BASE}/{ecdd_id}/decision",
            json={"status": "rejected", "decision_notes": "Declining service."},
            headers=_auth(compliance),
        )
        assert resp.status_code == 400
        assert "rejection_type" in resp.json()["detail"]

    def test_rejecting_with_invalid_rejection_type_is_a_400(self, client, db):
        admin, compliance, analyst = _setup(db)
        customer = _customer(db, admin.org_id)
        ecdd_id = _create_ecdd(client, _auth(analyst), customer.id)

        resp = client.patch(
            f"{BASE}/{ecdd_id}/decision",
            json={
                "status": "rejected",
                "decision_notes": "Declining service.",
                "rejection_type": "not_a_real_type",
            },
            headers=_auth(compliance),
        )
        assert resp.status_code == 400

    def test_service_declined_round_trips(self, client, db):
        admin, compliance, analyst = _setup(db)
        customer = _customer(db, admin.org_id)
        ecdd_id = _create_ecdd(client, _auth(analyst), customer.id)

        resp = client.patch(
            f"{BASE}/{ecdd_id}/decision",
            json={
                "status": "rejected",
                "decision_notes": "New applicant, unacceptable risk.",
                "rejection_type": "service_declined",
            },
            headers=_auth(compliance),
        )
        assert resp.status_code == 200, resp.text
        assert resp.json()["rejection_type"] == "service_declined"

    def test_relationship_exited_round_trips(self, client, db):
        admin, compliance, analyst = _setup(db)
        customer = _customer(db, admin.org_id)
        ecdd_id = _create_ecdd(client, _auth(analyst), customer.id)

        resp = client.patch(
            f"{BASE}/{ecdd_id}/decision",
            json={
                "status": "rejected",
                "decision_notes": "Existing customer, offboarding after EDD review.",
                "rejection_type": "relationship_exited",
            },
            headers=_auth(compliance),
        )
        assert resp.status_code == 200, resp.text
        assert resp.json()["rejection_type"] == "relationship_exited"

    def test_approving_does_not_require_rejection_type(self, client, db):
        admin, compliance, analyst = _setup(db)
        customer = _customer(db, admin.org_id)
        ecdd_id = _create_ecdd(client, _auth(analyst), customer.id)

        resp = client.patch(
            f"{BASE}/{ecdd_id}/decision",
            json={"status": "completed", "decision_notes": "Approved."},
            headers=_auth(compliance),
        )
        assert resp.status_code == 200, resp.text
        assert resp.json()["rejection_type"] is None

    def test_reverting_a_rejection_clears_rejection_type(self, client, db):
        admin, compliance, analyst = _setup(db)
        customer = _customer(db, admin.org_id)
        ecdd_id = _create_ecdd(client, _auth(analyst), customer.id)

        client.patch(
            f"{BASE}/{ecdd_id}/decision",
            json={
                "status": "rejected",
                "decision_notes": "Declining.",
                "rejection_type": "service_declined",
            },
            headers=_auth(compliance),
        )
        # Mistaken rejection -- reverted back to pending for re-assessment.
        revert_resp = client.patch(
            f"{BASE}/{ecdd_id}/decision",
            json={"status": "pending", "decision_notes": "Reverting for re-review."},
            headers=_auth(compliance),
        )
        assert revert_resp.status_code == 200, revert_resp.text
        assert revert_resp.json()["rejection_type"] is None

        db.expire_all()
        record = db.query(ECDDRecord).filter_by(ecdd_id=ecdd_id).first()
        assert record.rejection_type is None


class TestQuarterlyReportSplit:
    def test_declined_and_relationship_exited_are_counted_separately(
        self, client, db
    ):
        admin, compliance, analyst = _setup(db)
        headers = _auth(compliance)
        _grant_addon(db, admin.org_id, AddonKey.quarterly_compliance_report)

        declined_customer = _customer(db, admin.org_id, full_name="Declined Applicant")
        exited_customer = _customer(db, admin.org_id, full_name="Exited Customer")

        declined_ecdd = _create_ecdd(client, _auth(analyst), declined_customer.id)
        client.patch(
            f"{BASE}/{declined_ecdd}/decision",
            json={
                "status": "rejected",
                "decision_notes": "Never onboarded.",
                "rejection_type": "service_declined",
            },
            headers=headers,
        )

        exited_ecdd = _create_ecdd(client, _auth(analyst), exited_customer.id)
        client.patch(
            f"{BASE}/{exited_ecdd}/decision",
            json={
                "status": "rejected",
                "decision_notes": "Offboarded existing customer.",
                "rejection_type": "relationship_exited",
            },
            headers=headers,
        )

        report_resp = client.post(
            "/api/v1/board-reports",
            json={
                "report_ref": f"CO-Q-ECDD-{uuid.uuid4().hex[:8]}",
                "report_type": "quarterly_compliance",
                "period": "q1",
                "period_start": str(date.today() - timedelta(days=90)),
                "period_end": str(date.today()),
            },
            headers=headers,
        )
        assert report_resp.status_code == 201, report_resp.text
        report_id = report_resp.json()["id"]

        html_resp = client.get(
            f"/api/v1/board-reports/{report_id}/export-html", headers=headers
        )
        assert html_resp.status_code == 200, html_resp.text
        body = html_resp.text
        assert "ECDD cases declined — service never established" in body
        assert "Existing relationships exited following EDD review" in body

        # Exactly one of each -- confirms the split, not just both rows present.
        import re

        declined_row = re.search(
            r"ECDD cases declined — service never established</td><td>(\d+)</td>",
            body,
        )
        exited_row = re.search(
            r"Existing relationships exited following EDD review</td><td>(\d+)</td>",
            body,
        )
        assert declined_row.group(1) == "1"
        assert exited_row.group(1) == "1"
