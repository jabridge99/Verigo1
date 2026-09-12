"""
Stage 8 (Transaction & Monitoring Engine).

Confirmed gap: POST /transactions never actually called run_monitoring()
-- the whole Transaction -> Rules -> Alert pipeline was inert on real
transaction creation. The manual /transactions/{id}/run-monitoring
endpoint's own docstring claimed "this is automatically triggered on
transaction creation in production" -- false as the code stood; only the
frontend's manual "for testing/demo" form compensated by calling that
endpoint itself, client-side, right after creating the transaction.

Fixed by calling run_monitoring() directly inside create_transaction().
This test creates a transaction via the real API (not the manual
re-evaluation endpoint) for a PEP customer sending a cross-border
transfer to a FATF-blacklisted country, and confirms an alert exists
without ever calling /run-monitoring.
"""

import uuid

from app.models.customer import Customer
from app.models.monitoring import TransactionAlert
from tests.conftest import _auth


def _create_customer(client, headers) -> str:
    resp = client.post(
        "/api/v1/customers/",
        json={
            "full_name": "Stage8 Auto-Monitor Customer",
            "email": f"stage8-monitor-{uuid.uuid4().hex[:6]}@example.com",
            "phone": "+61400000098",
            "date_of_birth": "1975-03-01",
            "nationality": "AU",
            "country_of_residence": "AU",
            "id_number": "PP88888888",
            "id_type": "passport",
            "address": "1 Monitoring St, Sydney NSW 2000",
            "industry": "banking",
        },
        headers=headers,
    )
    assert resp.status_code == 201, resp.text
    return resp.json()["id"]


def test_creating_a_transaction_automatically_runs_monitoring(
    client, db, admin_user
):
    headers = _auth(admin_user)
    customer_id = _create_customer(client, headers)
    customer = db.query(Customer).filter(Customer.id == customer_id).first()
    customer.is_pep = True
    db.commit()

    ref = f"TXN-STAGE8-{uuid.uuid4().hex[:8]}"
    created = client.post(
        "/api/v1/transactions/",
        json={
            "transaction_ref": ref,
            "reference": ref,
            "customer_id": customer_id,
            "transaction_type": "transfer",
            "direction": "outgoing",
            "payment_method": "bank_transfer",
            "amount": 250000.00,
            "currency": "AUD",
            "is_cross_border": True,
            "country_destination": "KP",  # FATF blacklist
            "description": "Large cross-border transfer",
            "counterparty_name": "Offshore Corp",
            "destination_account_number": "999888777",
            "destination_bank_name": "Foreign Bank",
            "transaction_date": "2026-06-01T10:00:00",
        },
        headers=headers,
    )
    assert created.status_code == 201, created.text
    txn_id = created.json()["id"]

    # No call to /run-monitoring anywhere in this test -- if an alert
    # exists, creation itself triggered the engine.
    alerts = (
        db.query(TransactionAlert)
        .filter(TransactionAlert.transaction_id == txn_id)
        .all()
    )
    assert len(alerts) >= 1, (
        "Transaction creation did not automatically trigger monitoring — "
        "a PEP customer sending a cross-border transfer to a FATF-"
        "blacklisted country should generate at least one alert without "
        "ever calling /run-monitoring."
    )
