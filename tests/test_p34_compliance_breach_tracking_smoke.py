"""
P34: real coverage for compliance breach tracking (app/models/compliance_breach.py,
app/api/routes/compliance_breach.py) -- previously no structured "compliance
breach" model existed anywhere, so the CO Quarterly Compliance Report
template's (VERIGO-GEN-COR) "Breaches Identified This Quarter" section had
nothing real to compute from.

Tests go through the real API: create/list/get/update/remediate/close, RBAC
(compliance/mlro can log a breach, analyst cannot; only mlro can give the
final close/risk-accept sign-off), tenant isolation, and the quarterly
aggregation actually feeding into the CO Quarterly Report export.
"""

import uuid
from datetime import date, timedelta

from app.models.billing import AddonKey, AddonStatus, SubscriptionAddon
from app.models.compliance_breach import BreachStatus
from app.models.user import UserRole
from tests.conftest import _auth, _make_user

BASE = "/api/v1/compliance-breaches"


def _setup(db):
    admin = _make_user(db, UserRole.admin)
    org_id = admin.org_id
    compliance = _make_user(db, UserRole.compliance, industry_id=org_id)
    mlro = _make_user(db, UserRole.mlro, industry_id=org_id)
    analyst = _make_user(db, UserRole.analyst, industry_id=org_id)
    return admin, compliance, mlro, analyst


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


def _create_breach(client, headers, **overrides):
    payload = dict(
        title="Missed SMR lodgement deadline",
        description="SMR for customer X lodged 2 days after the 3-business-day deadline.",
        severity="high",
        identified_date=str(date.today()),
    )
    payload.update(overrides)
    return client.post(BASE, json=payload, headers=headers)


class TestCreateAndRbac:
    def test_compliance_can_create_a_breach(self, client, db):
        admin, compliance, mlro, analyst = _setup(db)
        resp = _create_breach(client, _auth(compliance))
        assert resp.status_code == 201, resp.text
        body = resp.json()
        assert body["status"] == "open"
        assert body["severity"] == "high"
        assert body["identified_by"] == compliance.id

    def test_mlro_can_create_a_breach(self, client, db):
        admin, compliance, mlro, analyst = _setup(db)
        resp = _create_breach(client, _auth(mlro))
        assert resp.status_code == 201, resp.text

    def test_analyst_cannot_create_a_breach(self, client, db):
        admin, compliance, mlro, analyst = _setup(db)
        resp = _create_breach(client, _auth(analyst))
        assert resp.status_code == 403


class TestListGetUpdate:
    def test_list_and_get_round_trip(self, client, db):
        admin, compliance, mlro, analyst = _setup(db)
        breach_id = _create_breach(client, _auth(compliance)).json()["id"]

        list_resp = client.get(BASE, headers=_auth(analyst))
        assert list_resp.status_code == 200
        assert any(b["id"] == breach_id for b in list_resp.json()["items"])

        get_resp = client.get(f"{BASE}/{breach_id}", headers=_auth(analyst))
        assert get_resp.status_code == 200
        assert get_resp.json()["title"] == "Missed SMR lodgement deadline"

    def test_list_filters_by_severity_and_status(self, client, db):
        admin, compliance, mlro, analyst = _setup(db)
        headers = _auth(compliance)
        _create_breach(client, headers, severity="critical")
        _create_breach(client, headers, severity="low")

        resp = client.get(f"{BASE}?severity=critical", headers=headers)
        assert resp.status_code == 200
        assert all(b["severity"] == "critical" for b in resp.json()["items"])
        assert resp.json()["total"] == 1

    def test_update_reported_to_austrac_stamps_reported_at(self, client, db):
        admin, compliance, mlro, analyst = _setup(db)
        headers = _auth(compliance)
        breach_id = _create_breach(client, headers).json()["id"]

        resp = client.patch(
            f"{BASE}/{breach_id}",
            json={"reported_to_austrac": True, "austrac_reference": "AUSTRAC-REF-001"},
            headers=headers,
        )
        assert resp.status_code == 200, resp.text
        body = resp.json()
        assert body["reported_to_austrac"] is True
        assert body["austrac_reference"] == "AUSTRAC-REF-001"
        assert body["austrac_reported_at"] is not None

    def test_analyst_cannot_update_a_breach(self, client, db):
        admin, compliance, mlro, analyst = _setup(db)
        breach_id = _create_breach(client, _auth(compliance)).json()["id"]
        resp = client.patch(
            f"{BASE}/{breach_id}", json={"title": "hijacked"}, headers=_auth(analyst)
        )
        assert resp.status_code == 403

    def test_another_orgs_breach_is_not_visible(self, client, db):
        admin, compliance, mlro, analyst = _setup(db)
        other_admin = _make_user(db, UserRole.admin)
        other_compliance = _make_user(
            db, UserRole.compliance, industry_id=other_admin.org_id
        )
        other_breach_id = _create_breach(client, _auth(other_compliance)).json()["id"]

        resp = client.get(f"{BASE}/{other_breach_id}", headers=_auth(compliance))
        assert resp.status_code == 404

        list_resp = client.get(BASE, headers=_auth(compliance))
        assert not any(
            b["id"] == other_breach_id for b in list_resp.json()["items"]
        )


class TestRemediateAndClose:
    def test_remediate_then_close_lifecycle(self, client, db):
        admin, compliance, mlro, analyst = _setup(db)
        breach_id = _create_breach(client, _auth(compliance)).json()["id"]

        remediate_resp = client.post(
            f"{BASE}/{breach_id}/remediate",
            json={"remediation_notes": "Retrained staff on SMR deadlines."},
            headers=_auth(compliance),
        )
        assert remediate_resp.status_code == 200, remediate_resp.text
        assert remediate_resp.json()["status"] == "remediated"
        assert remediate_resp.json()["remediated_date"] == str(date.today())

        close_resp = client.post(
            f"{BASE}/{breach_id}/close",
            json={"status": "closed", "notes": "Confirmed by MLRO."},
            headers=_auth(mlro),
        )
        assert close_resp.status_code == 200, close_resp.text
        assert close_resp.json()["status"] == "closed"
        assert close_resp.json()["closed_by"] == mlro.id

    def test_compliance_cannot_perform_final_close(self, client, db):
        admin, compliance, mlro, analyst = _setup(db)
        breach_id = _create_breach(client, _auth(compliance)).json()["id"]
        client.post(
            f"{BASE}/{breach_id}/remediate",
            json={"remediation_notes": "Fixed."},
            headers=_auth(compliance),
        )
        resp = client.post(
            f"{BASE}/{breach_id}/close",
            json={"status": "closed"},
            headers=_auth(compliance),
        )
        assert resp.status_code == 403

    def test_cannot_remediate_an_already_remediated_breach(self, client, db):
        admin, compliance, mlro, analyst = _setup(db)
        breach_id = _create_breach(client, _auth(compliance)).json()["id"]
        client.post(
            f"{BASE}/{breach_id}/remediate",
            json={"remediation_notes": "Fixed."},
            headers=_auth(compliance),
        )
        resp = client.post(
            f"{BASE}/{breach_id}/remediate",
            json={"remediation_notes": "Fixed again."},
            headers=_auth(compliance),
        )
        assert resp.status_code == 422

    def test_cannot_edit_a_closed_breach(self, client, db):
        admin, compliance, mlro, analyst = _setup(db)
        breach_id = _create_breach(client, _auth(compliance)).json()["id"]
        client.post(
            f"{BASE}/{breach_id}/close",
            json={"status": "risk_accepted"},
            headers=_auth(mlro),
        )
        resp = client.patch(
            f"{BASE}/{breach_id}", json={"title": "too late"}, headers=_auth(compliance)
        )
        assert resp.status_code == 422

    def test_risk_accepted_is_a_valid_final_close_status(self, client, db):
        admin, compliance, mlro, analyst = _setup(db)
        breach_id = _create_breach(client, _auth(compliance)).json()["id"]
        resp = client.post(
            f"{BASE}/{breach_id}/close",
            json={"status": "risk_accepted", "notes": "Board accepted residual risk."},
            headers=_auth(mlro),
        )
        assert resp.status_code == 200, resp.text
        assert resp.json()["status"] == "risk_accepted"


class TestQuarterlyReportIntegration:
    def test_breaches_feed_the_co_quarterly_report(self, client, db):
        admin, compliance, mlro, analyst = _setup(db)
        headers = _auth(compliance)
        _grant_addon(db, admin.org_id, AddonKey.quarterly_compliance_report)

        # In-quarter: one critical (still open, reported to AUSTRAC), one
        # high (remediated).
        critical_id = _create_breach(
            client, headers, severity="critical", title="Critical breach"
        ).json()["id"]
        client.patch(
            f"{BASE}/{critical_id}",
            json={"reported_to_austrac": True},
            headers=headers,
        )
        high_id = _create_breach(
            client, headers, severity="high", title="High breach"
        ).json()["id"]
        client.post(
            f"{BASE}/{high_id}/remediate",
            json={"remediation_notes": "Fixed."},
            headers=headers,
        )

        # Outside the quarter -- must not be counted.
        _create_breach(
            client,
            headers,
            severity="critical",
            title="Old breach",
            identified_date=str(date.today() - timedelta(days=400)),
        )

        report_resp = client.post(
            "/api/v1/board-reports",
            json={
                "report_ref": f"CO-Q-BREACH-{uuid.uuid4().hex[:8]}",
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
        assert "Critical breach" in body
        assert "High breach" in body
        assert "Old breach" not in body

    def test_breaches_from_another_org_do_not_leak_into_the_report(self, client, db):
        admin, compliance, mlro, analyst = _setup(db)
        _grant_addon(db, admin.org_id, AddonKey.quarterly_compliance_report)

        other_admin = _make_user(db, UserRole.admin)
        other_compliance = _make_user(
            db, UserRole.compliance, industry_id=other_admin.org_id
        )
        _create_breach(
            client, _auth(other_compliance), title="Other org's breach"
        )

        report_resp = client.post(
            "/api/v1/board-reports",
            json={
                "report_ref": f"CO-Q-ISOL-{uuid.uuid4().hex[:8]}",
                "report_type": "quarterly_compliance",
                "period": "q1",
                "period_start": str(date.today() - timedelta(days=90)),
                "period_end": str(date.today()),
            },
            headers=_auth(compliance),
        )
        report_id = report_resp.json()["id"]
        html_resp = client.get(
            f"/api/v1/board-reports/{report_id}/export-html", headers=_auth(compliance)
        )
        assert "Other org's breach" not in html_resp.text
        assert "Total breaches identified this quarter" in html_resp.text
