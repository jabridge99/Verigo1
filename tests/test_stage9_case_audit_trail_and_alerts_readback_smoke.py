"""
Stage 9 (Case Management): "Maintain a complete audit trail" -- the stage's
own explicitly-named requirement -- had zero coverage in app/api/routes/cases.py.
Every other mutable AML/CTF record in this codebase (customers, alerts,
reports, documents, organisations) writes to the audit trail via
app.services.audit_service.log_action() on every state change; cases.py
never did, for any of its 12 mutating endpoints (create, update, assign,
escalate, status transition, close, notes, evidence, evidence verification,
link-alert, SMR consider, SMR lodge). A compliance officer could open,
investigate, escalate and close a case with no queryable record of who did
what, when -- exactly the "what happened? when? who did it?" Stage 9 and
Stage 11 (Audit & Evidence) both require.

Fixed by adding a log_action() call to every case-mutating endpoint, same
pattern already used by alerts.py/customers.py/auth.py. Confirmed reachable
through the real, already-existing GET /audit/ endpoint (which merges both
audit-log tables in this codebase), not just written to a table nothing reads.

A second, smaller gap surfaced alongside: CaseAlert links (written at case
creation, via /link-alert, and via /alerts/{id}/create-case) were never
read back anywhere -- a case could be linked to the very alert that
triggered it with no way for an investigator to see that link from the
case itself, undermining the "review alerts" step of the investigation
workflow. Fixed by adding GET /cases/{case_id}/alerts.
"""

import uuid

from app.models.monitoring import TransactionAlert
from app.models.organisation import Organisation
from app.services.org_service import _seed_default_monitoring_rules
from tests.conftest import _auth


def _make_customer_and_high_risk_txn(client, headers, tag: str) -> str:
    customer = client.post(
        "/api/v1/customers/",
        json={
            "full_name": f"Stage 9 Customer {tag}",
            "email": f"s9-{tag}-{uuid.uuid4().hex[:6]}@example.com",
            "phone": "+61400000095",
            "date_of_birth": "1990-01-01",
            "nationality": "AU",
            "country_of_residence": "AU",
            "id_number": f"PP{uuid.uuid4().hex[:8]}",
            "id_type": "passport",
            "address": "1 Case Test St, Sydney NSW 2000",
            "industry": "banking",
        },
        headers=headers,
    )
    assert customer.status_code == 201, customer.text
    customer_id = customer.json()["id"]

    ref = f"TXN-S9-{uuid.uuid4().hex[:8]}"
    txn = client.post(
        "/api/v1/transactions/",
        json={
            "transaction_ref": ref,
            "reference": ref,
            "customer_id": customer_id,
            "transaction_type": "transfer",
            "direction": "outgoing",
            "payment_method": "bank_transfer",
            "amount": 5000.00,
            "currency": "AUD",
            "is_cross_border": True,
            "country_destination": "KP",
            "description": "Transfer to high-risk jurisdiction",
            "transaction_date": "2026-06-01T10:00:00",
        },
        headers=headers,
    )
    assert txn.status_code == 201, txn.text
    return txn.json()["id"]


def test_case_lifecycle_actions_are_all_written_to_the_audit_trail(
    client, db, admin_user
):
    org = db.query(Organisation).filter_by(id=admin_user.org_id).first()
    _seed_default_monitoring_rules(db, org.id, admin_user.id)
    db.commit()

    headers = _auth(admin_user)

    created = client.post(
        "/api/v1/cases",
        json={"title": "Audit trail test case", "severity": "high"},
        headers=headers,
    )
    assert created.status_code == 201, created.text
    case_id = created.json()["id"]

    assign = client.post(
        f"/api/v1/cases/{case_id}/assign",
        json={"assign_to": admin_user.id, "assign_by": admin_user.id},
        headers=headers,
    )
    assert assign.status_code == 200, assign.text

    note = client.post(
        f"/api/v1/cases/{case_id}/notes",
        json={
            "note_type": "investigation_note",
            "content": "Reviewed transaction history.",
        },
        headers=headers,
    )
    assert note.status_code == 201, note.text

    status_change = client.post(
        f"/api/v1/cases/{case_id}/status",
        json={"new_status": "under_investigation"},
        headers=headers,
    )
    assert status_change.status_code == 200, status_change.text

    status_change2 = client.post(
        f"/api/v1/cases/{case_id}/status",
        json={"new_status": "decision"},
        headers=headers,
    )
    assert status_change2.status_code == 200, status_change2.text

    closed = client.post(
        f"/api/v1/cases/{case_id}/close",
        json={
            "status": "closed_no_action",
            "outcome": "no_suspicious_activity",
            "closure_reason": "No adverse findings after review.",
        },
        headers=headers,
    )
    assert closed.status_code == 200, closed.text

    audit = client.get(
        f"/api/v1/audit/?entity_type=case&entity_id={case_id}", headers=headers
    )
    assert audit.status_code == 200, audit.text
    entries = audit.json()
    actions = {e["action"] for e in entries}

    assert "case_opened" in actions
    assert "case_assigned" in actions
    assert "case_note_added" in actions
    assert "case_status_changed" in actions
    assert "case_closed" in actions
    # Every entry correctly attributes to the real acting user, not "system".
    assert all(e["actor"] == admin_user.email for e in entries)


def test_case_notes_content_is_not_leaked_into_the_audit_trail(client, db, admin_user):
    org = db.query(Organisation).filter_by(id=admin_user.org_id).first()
    _seed_default_monitoring_rules(db, org.id, admin_user.id)
    db.commit()
    headers = _auth(admin_user)

    created = client.post(
        "/api/v1/cases",
        json={"title": "Confidentiality test case", "severity": "low"},
        headers=headers,
    )
    case_id = created.json()["id"]

    secret_content = "SECRET-INVESTIGATION-DETAIL-98765"
    note = client.post(
        f"/api/v1/cases/{case_id}/notes",
        json={"note_type": "investigation_note", "content": secret_content},
        headers=headers,
    )
    assert note.status_code == 201, note.text

    audit = client.get(
        f"/api/v1/audit/?entity_type=case&entity_id={case_id}", headers=headers
    )
    for entry in audit.json():
        assert secret_content not in str(entry)


def test_case_alerts_endpoint_returns_the_alert_that_triggered_the_case(
    client, db, admin_user
):
    org = db.query(Organisation).filter_by(id=admin_user.org_id).first()
    _seed_default_monitoring_rules(db, org.id, admin_user.id)
    db.commit()
    headers = _auth(admin_user)

    txn_id = _make_customer_and_high_risk_txn(client, headers, "alerts-readback")
    alert = (
        db.query(TransactionAlert)
        .filter(TransactionAlert.transaction_id == txn_id)
        .first()
    )
    assert alert is not None

    created = client.post(f"/api/v1/alerts/{alert.id}/create-case", headers=headers)
    assert created.status_code == 201, created.text
    case_id = created.json()["case_id"]

    linked = client.get(f"/api/v1/cases/{case_id}/alerts", headers=headers)
    assert linked.status_code == 200, linked.text
    body = linked.json()
    assert len(body) == 1
    assert body[0]["id"] == alert.id
