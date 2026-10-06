"""
P30/P31: web/app/reporting/page.tsx had the same demo-data-masking bug
already found and fixed on the MLRO, monitoring, and audit pages this
session -- DEMO_REPORTS/DEMO_SUMMARY shown whenever a real fetch returned
zero rows, silently kept forever for an org with a genuinely empty reports
dashboard. Separately, reporting_summary() (app/services/reporting_service.py)
returned a completely different shape ({ifti, ttr, smr, overdue: {...},
total_filed}), keyed by str(StatusEnum.member) (e.g. "IFTIStatus.draft", not
"draft") -- the frontend's Summary interface (total/by_type/by_status/
overdue/due_soon/draft/under_review/submitted) could never actually be
populated from it, so the KPI bar stayed on demo numbers regardless of
whether real reports existed.

Fixed by rewriting reporting_summary() to return the shape the frontend
already expects, with real enum .value strings, merging IFTI/TTR/SMR counts
(IFTIStatus and ReportStatus share the same value set). Removed DEMO_REPORTS/
DEMO_SUMMARY from reporting/page.tsx so a real empty or failed fetch shows a
real empty/error state, matching the pattern already applied to the other
pages this session.
"""

import uuid
from datetime import date, timedelta

from app.models.report import ReportStatus, SMRReport, TTRReport


def _make_ttr(db, org_id, status=ReportStatus.draft, due_date=None) -> TTRReport:
    ttr = TTRReport(
        org_id=org_id,
        report_ref=f"TTR-{uuid.uuid4().hex[:10]}",
        status=status,
        transaction_date=date.today(),
        total_amount=15000.0,
        due_date=due_date,
    )
    db.add(ttr)
    db.commit()
    return ttr


def _make_smr(db, org_id, status=ReportStatus.draft, due_date=None) -> SMRReport:
    smr = SMRReport(
        org_id=org_id,
        report_ref=f"SMR-{uuid.uuid4().hex[:10]}",
        status=status,
        matter_date=date.today(),
        suspicion_grounds="Unusual structuring pattern observed.",
        due_date=due_date,
    )
    db.add(smr)
    db.commit()
    return smr


def test_summary_shape_matches_frontend_contract(
    client, db, compliance_user, compliance_headers
):
    org_id = compliance_user.org_id
    _make_ttr(db, org_id)
    _make_smr(db, org_id)

    resp = client.get("/api/v1/reports/summary", headers=compliance_headers)
    assert resp.status_code == 200, resp.text
    data = resp.json()

    # Exactly the shape web/app/reporting/page.tsx's `Summary` interface reads.
    for key in (
        "total",
        "by_type",
        "by_status",
        "overdue",
        "due_soon",
        "draft",
        "under_review",
        "submitted",
    ):
        assert key in data, f"missing key: {key}"

    # Real enum values, not str(StatusEnum.member) ("ReportStatus.draft").
    assert "draft" in data["by_status"]
    assert all("." not in k for k in data["by_status"])
    assert data["by_status"]["draft"] >= 2
    assert data["draft"] == data["by_status"]["draft"]

    assert data["by_type"]["ttr"] >= 1
    assert data["by_type"]["smr"] >= 1
    assert data["total"] >= 2


def test_overdue_and_due_soon_computed_correctly(
    client, db, compliance_user, compliance_headers
):
    org_id = compliance_user.org_id
    today = date.today()
    _make_ttr(db, org_id, due_date=today - timedelta(days=1))  # overdue
    _make_ttr(db, org_id, due_date=today + timedelta(days=2))  # due soon
    _make_ttr(db, org_id, due_date=today + timedelta(days=30))  # neither

    resp = client.get("/api/v1/reports/summary", headers=compliance_headers)
    assert resp.status_code == 200, resp.text
    data = resp.json()
    assert data["overdue"] == 1
    assert data["due_soon"] == 1


def test_submitted_report_with_past_due_date_not_counted_overdue(
    client, db, compliance_user, compliance_headers
):
    org_id = compliance_user.org_id
    _make_ttr(
        db,
        org_id,
        status=ReportStatus.submitted,
        due_date=date.today() - timedelta(days=5),
    )

    resp = client.get("/api/v1/reports/summary", headers=compliance_headers)
    assert resp.status_code == 200, resp.text
    data = resp.json()
    assert data["overdue"] == 0
    assert data["by_status"]["submitted"] >= 1


def test_new_org_has_zero_reports_not_demo_data(client, compliance_headers):
    resp = client.get("/api/v1/reports/summary", headers=compliance_headers)
    assert resp.status_code == 200, resp.text
    data = resp.json()
    assert data["total"] == 0
    assert data["draft"] == 0
