"""
Parking lot P26, fixed: POST /alerts/{alert_id}/create-case has existed since
Stage 8 (creates a Case pre-linked to the alert via CaseAlert, and escalates
the alert) but had no frontend entry point anywhere -- the monitoring page's
alert detail panel had a "Create Case" link that pointed at /mlro with query
params the MLRO page never reads, so it silently dropped the alert linkage.
An analyst investigating a real alert had no way to actually open a linked
case from it.

Fixed the frontend (web/app/monitoring/page.tsx) to call this endpoint
directly. This is the first backend test coverage the endpoint itself has
ever had -- verified through the real pipeline (transaction creation ->
automatic monitoring -> alert -> create-case), not a hand-built alert row.
"""

import uuid

from app.models.case import CaseAlert
from app.models.monitoring import AlertStatus, TransactionAlert
from app.models.organisation import Organisation
from app.services.org_service import _seed_default_monitoring_rules
from tests.conftest import _auth


def test_create_case_from_alert_links_alert_and_escalates_it(client, db, admin_user):
    org = db.query(Organisation).filter_by(id=admin_user.org_id).first()
    _seed_default_monitoring_rules(db, org.id, admin_user.id)
    db.commit()

    headers = _auth(admin_user)
    customer = client.post(
        "/api/v1/customers/",
        json={
            "full_name": "Alert Case Bridge Customer",
            "email": f"acb-{uuid.uuid4().hex[:6]}@example.com",
            "phone": "+61400000098",
            "date_of_birth": "1990-01-01",
            "nationality": "AU",
            "country_of_residence": "AU",
            "id_number": "PP66666666",
            "id_type": "passport",
            "address": "1 Bridge St, Sydney NSW 2000",
            "industry": "banking",
        },
        headers=headers,
    )
    assert customer.status_code == 201, customer.text
    customer_id = customer.json()["id"]

    ref = f"TXN-BRIDGE-{uuid.uuid4().hex[:8]}"
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
    txn_id = txn.json()["id"]

    alert = (
        db.query(TransactionAlert)
        .filter(TransactionAlert.transaction_id == txn_id)
        .first()
    )
    assert alert is not None

    created = client.post(f"/api/v1/alerts/{alert.id}/create-case", headers=headers)
    assert created.status_code == 201, created.text
    body = created.json()
    assert body["case_id"]
    assert body["case_ref"].startswith("CASE-")

    link = db.query(CaseAlert).filter(CaseAlert.alert_id == alert.id).first()
    assert link is not None
    assert link.case_id == body["case_id"]

    db.refresh(alert)
    assert alert.status == AlertStatus.escalated


def test_create_case_from_alert_rejects_closed_alert(client, db, admin_user):
    org = db.query(Organisation).filter_by(id=admin_user.org_id).first()
    _seed_default_monitoring_rules(db, org.id, admin_user.id)
    db.commit()

    headers = _auth(admin_user)
    customer = client.post(
        "/api/v1/customers/",
        json={
            "full_name": "Closed Alert Customer",
            "email": f"clac-{uuid.uuid4().hex[:6]}@example.com",
            "phone": "+61400000091",
            "date_of_birth": "1990-01-01",
            "nationality": "AU",
            "country_of_residence": "AU",
            "id_number": "PP55555555",
            "id_type": "passport",
            "address": "1 Closed St, Sydney NSW 2000",
            "industry": "banking",
        },
        headers=headers,
    )
    customer_id = customer.json()["id"]

    ref = f"TXN-CLOSED-{uuid.uuid4().hex[:8]}"
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
    txn_id = txn.json()["id"]
    alert = (
        db.query(TransactionAlert)
        .filter(TransactionAlert.transaction_id == txn_id)
        .first()
    )
    alert.status = AlertStatus.resolved
    db.commit()

    resp = client.post(f"/api/v1/alerts/{alert.id}/create-case", headers=headers)
    assert resp.status_code == 409, resp.text
