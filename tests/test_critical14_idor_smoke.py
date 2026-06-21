"""
Smoke test for Critical #14: cross-tenant IDOR fixes.

1. app/api/routes/documents.py get_document() called
   _assert_tenant(current_user, doc) with the whole Document object instead
   of doc.industry_id (a string) — every other call site in the file passes
   the industry_id string. Fixed to pass doc.industry_id.

2. app/api/routes/rule_builder.py create_decision_panel() fetched the
   Transaction row by id only (no org_id filter), unlike the sibling
   Customer/TransactionAlert queries in the same function, letting any
   compliance-or-above user pull another org's transaction AML risk
   signals (amount, cross-border/structuring/near-threshold flags) into
   the decision panel response by guessing/enumerating a transaction id.
"""

import uuid
from datetime import datetime, timezone

from app.models.customer import Customer, CustomerStatus, CustomerType
from app.models.transaction import (
    Transaction,
    TransactionDirection,
    TransactionType,
    PaymentMethod,
)
from tests.conftest import _auth, _make_org, _make_user, UserRole


def _make_customer(db, org_id) -> Customer:
    customer = Customer(
        customer_ref=f"CUST-{uuid.uuid4().hex[:8]}",
        org_id=org_id,
        customer_type=CustomerType.individual,
        status=CustomerStatus.active,
        full_name="Jane Doe",
    )
    db.add(customer)
    db.commit()
    db.refresh(customer)
    return customer


def _make_transaction(db, org_id, customer_id, amount=50000.0) -> Transaction:
    txn = Transaction(
        transaction_ref=f"TXN-{uuid.uuid4().hex[:8]}",
        org_id=org_id,
        customer_id=customer_id,
        transaction_type=TransactionType.transfer,
        direction=TransactionDirection.outgoing,
        payment_method=PaymentMethod.bank_transfer,
        amount=amount,
        amount_aud=amount,
        is_cross_border=True,
        is_structuring_suspect=True,
        transaction_date=datetime.now(timezone.utc),
    )
    db.add(txn)
    db.commit()
    db.refresh(txn)
    return txn


def test_decision_support_ignores_other_org_transaction(client, db, compliance_user):
    """A compliance user supplying a transaction_id from a different org must
    not have that transaction's risk signals leaked into the panel."""
    own_customer = _make_customer(db, compliance_user.org_id)

    other_org = _make_org(db)
    other_customer = _make_customer(db, other_org.id)
    other_txn = _make_transaction(db, other_org.id, other_customer.id, amount=999999.0)

    resp = client.post(
        "/api/v1/rule-builder/decision-support",
        params={"customer_id": own_customer.id, "transaction_id": other_txn.id},
        headers=_auth(compliance_user),
    )
    assert resp.status_code == 201, resp.text
    body = resp.json()
    # The other org's transaction must not have been used to populate signals.
    assert body.get("potential_ttr") is not True
    assert body.get("amount_aud", 0) != 999999.0


def test_get_document_other_tenant_denied(client, db, compliance_user):
    """get_document() must deny cross-tenant access via 403, not crash or
    succeed, when called with a doc.industry_id from a different org."""
    other_org = _make_org(db)
    other_user = _make_user(db, UserRole.compliance, industry_id=other_org.id)

    upload = client.post(
        "/api/v1/documents",
        files={"file": ("test.txt", b"hello world", "text/plain")},
        headers=_auth(other_user),
    )
    assert upload.status_code == 201, upload.text
    doc_id = upload.json()["doc_id"]

    same_org_resp = client.get(f"/api/v1/documents/{doc_id}", headers=_auth(other_user))
    assert same_org_resp.status_code == 200

    cross_org_resp = client.get(f"/api/v1/documents/{doc_id}", headers=_auth(compliance_user))
    assert cross_org_resp.status_code == 403
