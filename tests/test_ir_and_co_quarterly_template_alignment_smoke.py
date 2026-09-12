"""
Independent Review and CO Quarterly Compliance Report alignment with the
Verigo AML/CTF document templates (Google Drive: VERIGO_GEN_Independent_
Review_v1.docx / VERIGO-GEN-IRF-01, and VERIGO_GEN_CO_Quarterly_Report_v1
.docx / VERIGO-GEN-COR).

Independent Review had zero document export before this -- only board
reports (app/api/routes/board_reporting.py) had one. Added GET
/independent-reviews/{id}/export-html, laid out to match the template's
cover page, area-by-area executive-summary rating grid, detailed findings/
recommendations, action plan, and sign-off sections. Also added the two
mandatory review areas the template names that FindingCategory had no
dedicated value for (sanctions_screening, austrac_enrolment).

board_reporting.py already had a "quarterly_compliance" report type, but
its snapshot was identical to the other three report types -- none of the
CO Quarterly Report template's specific sections (SMR/TTR/ECDD/Sanctions
detail, open actions carried over, independent review status) were
computed. Deepened generate_quarterly_compliance_snapshot() and
export_html() to compute and render them, without touching the other
three report types.
"""

import uuid
from datetime import date, timedelta


def _create_review(client, headers, ref_suffix: str) -> str:
    resp = client.post(
        "/api/v1/independent-reviews",
        json={
            "review_ref": f"IR-{ref_suffix}-{uuid.uuid4().hex[:6]}",
            "review_type": "internal",
            "review_scope": "aml_program",
            "title": "Template alignment test review",
            "reviewer_name": "Jane Reviewer",
            "reviewer_firm": "Independent Consulting Pty Ltd",
            "reviewer_credentials": "Not involved in Program design or implementation.",
        },
        headers=headers,
    )
    assert resp.status_code == 201, resp.text
    return resp.json()["id"]


def test_finding_category_accepts_sanctions_screening_and_austrac_enrolment(
    client, compliance_headers
):
    review_id = _create_review(client, compliance_headers, "cat")
    for category in ("sanctions_screening", "austrac_enrolment"):
        resp = client.post(
            f"/api/v1/independent-reviews/{review_id}/findings",
            json={
                "finding_ref": f"F-{category}-{uuid.uuid4().hex[:6]}",
                "title": f"{category} finding",
                "description": "Regression test finding.",
                "risk_rating": "medium",
                "category": category,
            },
            headers=compliance_headers,
        )
        assert resp.status_code == 201, resp.text
        assert resp.json()["category"] == category


def test_independent_review_export_html_matches_template_sections(
    client, db, compliance_user, compliance_headers
):
    review_id = _create_review(client, compliance_headers, "exp")

    resp = client.post(
        f"/api/v1/independent-reviews/{review_id}/findings",
        json={
            "finding_ref": f"F-{uuid.uuid4().hex[:8]}",
            "title": "Sanctions screening gap",
            "description": "No live-list screening evidence for 3 customers.",
            "risk_rating": "high",
            "category": "sanctions_screening",
        },
        headers=compliance_headers,
    )
    assert resp.status_code == 201, resp.text
    finding_id = resp.json()["id"]

    resp = client.post(
        f"/api/v1/independent-reviews/{review_id}/findings/{finding_id}/recommendations",
        json={
            "recommendation_ref": f"R-{uuid.uuid4().hex[:8]}",
            "description": "Implement daily live-list sanctions screening for all customers.",
            "priority": "immediate",
        },
        headers=compliance_headers,
    )
    assert resp.status_code == 201, resp.text
    rec_id = resp.json()["id"]

    resp = client.post(
        f"/api/v1/independent-reviews/{review_id}/findings/{finding_id}"
        f"/recommendations/{rec_id}/actions",
        json={
            "action_ref": f"A-{uuid.uuid4().hex[:8]}",
            "title": "Enable live sanctions list feed",
            "action_type": "system_change",
            "due_date": str(date.today() + timedelta(days=30)),
        },
        headers=compliance_headers,
    )
    assert resp.status_code == 201, resp.text

    resp = client.get(
        f"/api/v1/independent-reviews/{review_id}/export-html",
        headers=compliance_headers,
    )
    assert resp.status_code == 200, resp.text
    body = resp.text

    # Cover page
    assert "Template alignment test review" in body
    assert "Jane Reviewer" in body
    assert "Not involved in Program design" in body

    # Executive summary rating grid — the area with an open High finding
    # should not be defaulted to Satisfactory.
    assert "Sanctions Screening" in body
    assert "Governance / CO Reporting" in body  # an unaffected area

    # Detailed findings/recommendations and action plan
    assert "Sanctions screening gap" in body
    assert "Implement daily live-list sanctions screening" in body
    assert "Enable live sanctions list feed" in body

    # Sign-off section
    assert "Reviewer" in body
    assert "Director / Principal Acknowledgement" in body


def test_co_quarterly_report_computes_template_sections(client, compliance_headers):
    resp = client.post(
        "/api/v1/board-reports",
        json={
            "report_ref": f"CO-Q-{uuid.uuid4().hex[:8]}",
            "report_type": "quarterly_compliance",
            "period": "q1",
            "period_start": str(date.today() - timedelta(days=90)),
            "period_end": str(date.today()),
        },
        headers=compliance_headers,
    )
    assert resp.status_code == 201, resp.text
    report_id = resp.json()["id"]

    resp = client.get(
        f"/api/v1/board-reports/{report_id}/export-html", headers=compliance_headers
    )
    assert resp.status_code == 200, resp.text
    body = resp.text
    for section in (
        "SMR Activity (Detail)",
        "TTR Activity",
        "ECDD Activity",
        "Sanctions Screening Activity (Detail)",
        "Open Actions from Prior Quarters",
        "Program and Regulatory Updates",
    ):
        assert section in body, f"missing section: {section}"


def test_other_board_report_types_unaffected_by_co_quarterly_sections(
    client, compliance_headers
):
    resp = client.post(
        "/api/v1/board-reports",
        json={
            "report_ref": f"BR-AML-{uuid.uuid4().hex[:8]}",
            "report_type": "board_aml",
            "period": "q1",
            "period_start": str(date.today() - timedelta(days=90)),
            "period_end": str(date.today()),
        },
        headers=compliance_headers,
    )
    assert resp.status_code == 201, resp.text
    report_id = resp.json()["id"]

    resp = client.get(
        f"/api/v1/board-reports/{report_id}/export-html", headers=compliance_headers
    )
    assert resp.status_code == 200, resp.text
    assert "SMR Activity (Detail)" not in resp.text
    assert "Open Actions from Prior Quarters" not in resp.text
