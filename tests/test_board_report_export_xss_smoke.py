"""
Smoke test: board_reporting.export_html() interpolated report.title,
report.executive_summary, and report.mlro_commentary directly into raw HTML
with no escaping. All three fields are free-text, settable by a
compliance-role user via POST/PATCH /board-reports, so a malicious or
compromised compliance account could plant a <script> payload that
executes in the browser of anyone who opens the exported report — including
board members and executives, who are the report's intended audience.
Fixed by html.escape()-ing all three fields before interpolation.
"""

from datetime import date

from app.models.board_report import BoardReport, BoardReportType, ReportPeriod
from tests.conftest import _auth


def _make_report(db, org_id, payload) -> BoardReport:
    report = BoardReport(
        report_ref="BR-TEST-XSS-001",
        org_id=org_id,
        report_type=BoardReportType.board_aml,
        period=ReportPeriod.q1,
        period_start=date(2026, 1, 1),
        period_end=date(2026, 3, 31),
        report_year=2026,
        title=payload,
        executive_summary=payload,
        mlro_commentary=payload,
        key_messages=[],
        snapshot_data={},
        created_by="tester",
    )
    db.add(report)
    db.commit()
    db.refresh(report)
    return report


def test_export_html_escapes_user_supplied_fields(client, db, compliance_user):
    payload = "<script>alert(1)</script>"
    report = _make_report(db, compliance_user.org_id, payload)

    html_resp = client.get(
        f"/api/v1/board-reports/{report.id}/export-html",
        headers=_auth(compliance_user),
    )
    assert html_resp.status_code == 200, html_resp.text
    body = html_resp.text
    assert "<script>alert(1)</script>" not in body
    assert "&lt;script&gt;alert(1)&lt;/script&gt;" in body
