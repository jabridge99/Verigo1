"""
Smoke test: POST /alerts/{id}/review accepted resolution="dismissed" or
"cleared" with review_notes left blank/None — an AML alert could be waved
through with zero recorded justification, leaving no audit trail for why a
potentially suspicious transaction was cleared. Fixed by requiring a
non-empty review_notes for those two resolutions.
"""

from tests.test_audit_logging_smoke import _make_alert
from tests.test_reports import _create_customer


def test_dismiss_without_review_notes_rejected(client, db, compliance_headers, compliance_user):
    customer_id = _create_customer(client, compliance_headers)
    alert = _make_alert(db, compliance_user.org_id, customer_id)

    resp = client.post(
        f"/api/v1/alerts/{alert.id}/review",
        json={"resolution": "dismissed", "is_false_positive": True},
        headers=compliance_headers,
    )
    assert resp.status_code == 400
    assert "review_notes" in resp.text


def test_dismiss_with_blank_review_notes_rejected(client, db, compliance_headers, compliance_user):
    customer_id = _create_customer(client, compliance_headers)
    alert = _make_alert(db, compliance_user.org_id, customer_id)

    resp = client.post(
        f"/api/v1/alerts/{alert.id}/review",
        json={"resolution": "cleared", "review_notes": "   "},
        headers=compliance_headers,
    )
    assert resp.status_code == 400


def test_dismiss_with_review_notes_succeeds(client, db, compliance_headers, compliance_user):
    customer_id = _create_customer(client, compliance_headers)
    alert = _make_alert(db, compliance_user.org_id, customer_id)

    resp = client.post(
        f"/api/v1/alerts/{alert.id}/review",
        json={"resolution": "dismissed", "review_notes": "Confirmed false positive after KYC review"},
        headers=compliance_headers,
    )
    assert resp.status_code == 200, resp.text


def test_escalation_does_not_require_review_notes(client, db, compliance_headers, compliance_user):
    customer_id = _create_customer(client, compliance_headers)
    alert = _make_alert(db, compliance_user.org_id, customer_id)

    resp = client.post(
        f"/api/v1/alerts/{alert.id}/review",
        json={"resolution": "escalated_to_case"},
        headers=compliance_headers,
    )
    assert resp.status_code == 200, resp.text
