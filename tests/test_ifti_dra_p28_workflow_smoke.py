"""
P28: of three parallel IFTI backends found in Stage 10 (app/api/routes/ifti.py
+ IFTIRecord, app/api/routes/ifti_e.py + IFTIERecord, app/api/routes/reports.py's
IFTI section + IFTIReport), only ifti.py's produces an AUSTRAC-template-accurate
Excel export -- the one the user's actual workflow needs (fill the official
IFTI-DRA spreadsheet, lodge it via AUSTRAC Online) -- but it had no
maker-checker or audit trail. reports.py's IFTI section had that workflow but
no export capability at all. This ports the workflow onto ifti.py (now
canonical) and retires reports.py's IFTI-only routes; ifti_e.py (IFTI-E,
a different AUSTRAC report subtype for banks/ADIs) is untouched/out of scope.

Covers:
- generate-from-transaction pre-fills a draft IFTIRecord from a cross-border
  transaction + its customer
- every workflow step (draft/review/approve/submit/reject/redraft/delete)
  writes an audit trail entry, reachable via GET /audit/?entity_type=ifti_record
- reports.py's old /reports/ifti* routes are gone
- reporting_summary() reflects IFTIRecord counts, not the retired IFTIReport
"""

import uuid

from app.models.user import UserRole
from tests.conftest import _auth, _make_user


def _create_customer(client, headers, tag: str) -> str:
    resp = client.post(
        "/api/v1/customers/",
        json={
            "full_name": f"P28 Customer {tag}",
            "email": f"p28-{tag}-{uuid.uuid4().hex[:6]}@example.com",
            "phone": "+61400000094",
            "date_of_birth": "1985-05-05",
            "nationality": "AU",
            "country_of_residence": "AU",
            "id_number": f"PP{uuid.uuid4().hex[:8]}",
            "id_type": "passport",
            "address": "1 IFTI Test St, Sydney NSW 2000",
            "industry": "banking",
        },
        headers=headers,
    )
    assert resp.status_code == 201, resp.text
    return resp.json()["id"]


def _create_cross_border_txn(client, headers, customer_id: str) -> str:
    ref = f"TXN-P28-{uuid.uuid4().hex[:8]}"
    resp = client.post(
        "/api/v1/transactions/",
        json={
            "transaction_ref": ref,
            "reference": ref,
            "customer_id": customer_id,
            "transaction_type": "transfer",
            "direction": "outgoing",
            "payment_method": "bank_transfer",
            "amount": 25000.00,
            "currency": "AUD",
            "is_cross_border": True,
            "destination_account_name": "Overseas Recipient",
            "destination_bank_name": "Foreign Bank Ltd",
            "destination_country": "US",
            "description": "Cross-border business payment",
            "transaction_date": "2026-06-15T10:00:00",
        },
        headers=headers,
    )
    assert resp.status_code == 201, resp.text
    return resp.json()["id"]


def _audit_actions(client, headers, entity_id: str) -> set:
    resp = client.get(
        f"/api/v1/audit/?entity_type=ifti_record&entity_id={entity_id}",
        headers=headers,
    )
    assert resp.status_code == 200, resp.text
    return {e["action"] for e in resp.json()}


def test_generate_from_transaction_prefills_draft(client, compliance_headers, db):
    cid = _create_customer(client, compliance_headers, "gen")
    txn_id = _create_cross_border_txn(client, compliance_headers, cid)

    resp = client.post(
        f"/api/v1/ifti/generate-from-transaction/{txn_id}",
        headers=compliance_headers,
    )
    assert resp.status_code == 201, resp.text
    data = resp.json()
    assert data["status"] == "draft"
    assert data["direction"] == "outgoing"
    assert data["total_amount"] == 25000.0
    assert data["oc_full_name"] == "P28 Customer gen"
    assert data["bc_full_name"] == "Overseas Recipient"

    actions = _audit_actions(client, compliance_headers, data["ifti_id"])
    assert "ifti_drafted" in actions


def test_generate_from_transaction_rejects_domestic(client, compliance_headers):
    cid = _create_customer(client, compliance_headers, "domestic")
    ref = f"TXN-P28-{uuid.uuid4().hex[:8]}"
    resp = client.post(
        "/api/v1/transactions/",
        json={
            "transaction_ref": ref,
            "reference": ref,
            "customer_id": cid,
            "transaction_type": "transfer",
            "direction": "outgoing",
            "payment_method": "bank_transfer",
            "amount": 5000.00,
            "currency": "AUD",
            "is_cross_border": False,
            "description": "Domestic transfer",
            "transaction_date": "2026-06-15T10:00:00",
        },
        headers=compliance_headers,
    )
    assert resp.status_code == 201, resp.text
    txn_id = resp.json()["id"]

    resp = client.post(
        f"/api/v1/ifti/generate-from-transaction/{txn_id}",
        headers=compliance_headers,
    )
    assert resp.status_code == 422


def test_full_workflow_is_fully_audited(
    client, db, compliance_user, compliance_headers
):
    mlro = _make_user(db, UserRole.mlro, industry_id=compliance_user.org_id)
    mlro_headers = _auth(mlro)

    payload = {
        "direction": "outgoing",
        "date_received": "01/06/2026",
        "date_available": "02/06/2026",
        "currency_code": "AUD",
        "total_amount": 9000.00,
        "reporter_full_name": "Compliance Officer",
        "reporter_email": "compliance@test.com",
        "reporter_austrac_id": "87654321",
    }
    resp = client.post("/api/v1/ifti/", json=payload, headers=compliance_headers)
    assert resp.status_code == 201, resp.text
    ifti_id = resp.json()["ifti_id"]

    assert (
        client.post(
            f"/api/v1/ifti/{ifti_id}/review", headers=compliance_headers
        ).status_code
        == 200
    )
    assert (
        client.post(f"/api/v1/ifti/{ifti_id}/approve", headers=mlro_headers).status_code
        == 200
    )
    assert (
        client.post(f"/api/v1/ifti/{ifti_id}/submit", headers=mlro_headers).status_code
        == 200
    )
    assert (
        client.post(
            f"/api/v1/ifti/{ifti_id}/acknowledge", headers=compliance_headers
        ).status_code
        == 200
    )

    actions = _audit_actions(client, compliance_headers, ifti_id)
    assert {
        "ifti_drafted",
        "ifti_reviewed",
        "ifti_approved",
        "ifti_submitted",
        "ifti_acknowledged",
    } <= actions


def test_reject_redraft_cycle_is_audited(
    client, db, compliance_user, compliance_headers
):
    mlro = _make_user(db, UserRole.mlro, industry_id=compliance_user.org_id)
    mlro_headers = _auth(mlro)

    payload = {
        "direction": "incoming",
        "date_received": "01/06/2026",
        "date_available": "02/06/2026",
        "currency_code": "AUD",
        "total_amount": 3000.00,
    }
    resp = client.post("/api/v1/ifti/", json=payload, headers=compliance_headers)
    ifti_id = resp.json()["ifti_id"]

    client.post(f"/api/v1/ifti/{ifti_id}/review", headers=compliance_headers)
    resp = client.post(
        f"/api/v1/ifti/{ifti_id}/reject",
        params={"reason": "Incorrect beneficiary details."},
        headers=mlro_headers,
    )
    assert resp.status_code == 200, resp.text
    assert resp.json()["status"] == "rejected"

    resp = client.post(f"/api/v1/ifti/{ifti_id}/redraft", headers=compliance_headers)
    assert resp.status_code == 200, resp.text
    assert resp.json()["status"] == "draft"

    actions = _audit_actions(client, compliance_headers, ifti_id)
    assert {"ifti_rejected", "ifti_redrafted"} <= actions


def test_delete_is_audited(client, compliance_headers):
    payload = {
        "direction": "outgoing",
        "date_received": "01/06/2026",
        "date_available": "02/06/2026",
        "currency_code": "AUD",
        "total_amount": 1500.00,
    }
    resp = client.post("/api/v1/ifti/", json=payload, headers=compliance_headers)
    ifti_id = resp.json()["ifti_id"]

    resp = client.delete(f"/api/v1/ifti/{ifti_id}", headers=compliance_headers)
    assert resp.status_code == 204

    actions = _audit_actions(client, compliance_headers, ifti_id)
    assert "ifti_deleted" in actions


def test_reports_ifti_routes_are_gone(client, compliance_headers):
    resp = client.get("/api/v1/reports/ifti", headers=compliance_headers)
    assert resp.status_code == 404

    resp = client.post(
        "/api/v1/reports/ifti/generate-from-transaction/some-id",
        headers=compliance_headers,
    )
    assert resp.status_code == 404


def test_reporting_summary_reflects_ifti_records(client, compliance_headers):
    payload = {
        "direction": "outgoing",
        "date_received": "01/06/2026",
        "date_available": "02/06/2026",
        "currency_code": "AUD",
        "total_amount": 4200.00,
    }
    client.post("/api/v1/ifti/", json=payload, headers=compliance_headers)

    resp = client.get("/api/v1/reports/summary", headers=compliance_headers)
    assert resp.status_code == 200, resp.text
    data = resp.json()
    # _count_by_status()'s dict keys are str(StatusEnum.member), which for a
    # (str, Enum) mixin is "IFTIStatus.draft" not "draft" -- a pre-existing
    # formatting quirk shared with the ttr/smr counts in the same summary,
    # not something P28 introduced or is fixing here.
    assert sum(data["ifti"].values()) >= 1
