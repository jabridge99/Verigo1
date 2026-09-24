"""
Stage 11 (Audit & Evidence): inspecting the real /audit endpoint's coverage
(the same one Stages 9-10 wired cases.py and reports.py into) surfaced two
more completely unaudited domains -- app/api/routes/kyc.py's review_kyc()
(the actual approve/reject decision on a customer's identity verification)
and app/api/routes/transactions.py's create_transaction()/update_transaction()
(the core AML transaction record). Both are squarely what Stage 11 asks
for -- "customer history", "what happened, when, who did it, why" -- and
neither wrote a single audit entry.

Also fixed alongside (not covered by this test file): web/app/audit/page.tsx
had the same demo-data-masking bug found repeatedly this session (a
hardcoded DEMO_LOGS array shown whenever a real fetch returned zero rows),
and its entity-type/role filter lists were entirely fictional -- none of
"report"/"ecdd"/"kyc"/"transaction" match any real entity_type the backend
actually writes (the real ones are ifti_report/ttr_report/smr_report/
ecdd_record/case/customer/document/aml_program/organisation/user).
"""

import uuid

from app.models.customer import Customer, CustomerStatus
from tests.conftest import _auth


def _create_customer(client, headers, tag: str) -> str:
    resp = client.post(
        "/api/v1/customers/",
        json={
            "full_name": f"Stage 11 Customer {tag}",
            "email": f"s11-{tag}-{uuid.uuid4().hex[:6]}@example.com",
            "phone": "+61400000093",
            "date_of_birth": "1990-01-01",
            "nationality": "AU",
            "country_of_residence": "AU",
            "id_number": f"PP{uuid.uuid4().hex[:8]}",
            "id_type": "passport",
            "address": "1 Audit Test St, Sydney NSW 2000",
            "industry": "banking",
        },
        headers=headers,
    )
    assert resp.status_code == 201, resp.text
    return resp.json()["id"]


def _audit_actions(client, headers, entity_type: str, entity_id: str) -> set:
    resp = client.get(
        f"/api/v1/audit/?entity_type={entity_type}&entity_id={entity_id}",
        headers=headers,
    )
    assert resp.status_code == 200, resp.text
    return {e["action"] for e in resp.json()}


def test_kyc_review_rejection_is_audited(client, db, admin_user):
    headers = _auth(admin_user)
    cid = _create_customer(client, headers, "kyc-reject")

    reviewed = client.post(
        f"/api/v1/kyc/{cid}/review",
        params={
            "approve": False,
            "rejection_reason": "Identity could not be verified.",
        },
        headers=headers,
    )
    assert reviewed.status_code == 200, reviewed.text
    assert reviewed.json()["status"] == "rejected"

    customer = db.query(Customer).filter(Customer.id == cid).first()
    assert customer.status == CustomerStatus.rejected

    actions = _audit_actions(client, headers, "customer", cid)
    assert "kyc_reviewed" in actions


def test_transaction_create_and_update_are_audited(client, db, admin_user):
    headers = _auth(admin_user)
    cid = _create_customer(client, headers, "txn-audit")

    ref = f"TXN-S11-{uuid.uuid4().hex[:8]}"
    created = client.post(
        "/api/v1/transactions/",
        json={
            "transaction_ref": ref,
            "reference": ref,
            "customer_id": cid,
            "transaction_type": "transfer",
            "direction": "outgoing",
            "payment_method": "bank_transfer",
            "amount": 2500.00,
            "currency": "AUD",
            "is_cross_border": False,
            "description": "Regular transfer",
            "transaction_date": "2026-06-01T10:00:00",
        },
        headers=headers,
    )
    assert created.status_code == 201, created.text
    txn_id = created.json()["id"]

    updated = client.patch(
        f"/api/v1/transactions/{txn_id}",
        json={"description": "Corrected description"},
        headers=headers,
    )
    assert updated.status_code == 200, updated.text

    actions = _audit_actions(client, headers, "transaction", txn_id)
    assert "transaction_recorded" in actions
    assert "transaction_updated" in actions
