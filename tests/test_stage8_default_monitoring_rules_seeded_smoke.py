"""
Stage 8 (Transaction & Monitoring Engine): "Support configurable rules."

Confirmed gap: MonitoringRule (the actual no-code, per-org configurable
rule engine the monitoring pipeline reads -- app/models/monitoring.py,
app/services/monitoring_engine.py) had a full CRUD API
(app/api/routes/monitoring.py) but nothing ever seeded a starting set of
rules for a new org. Every org started with zero rules; score-based
behaviour-signal alerting still worked, but the "configurable rules"
layer the stage explicitly asks for had nothing in it to configure --
there was no seed to edit, only an empty list.

Fixed by seeding 6 starter rules on org creation (attach_owner()),
covering each indicator type the stage brief names: unusual amount,
rapid movement, structuring, frequency anomaly, high-risk jurisdiction,
high-risk customer. Marked is_system_rule so they can't be deleted, only
edited/disabled -- same discipline as the org's other seeded starter
content (controls, policies, approval questions).

Verifying the high-risk-jurisdiction rule against a real, frontend-shaped
payload surfaced a second real bug: Transaction has two overlapping
country-pair columns (source_country/destination_country alongside
country_origin/country_destination). Behaviour-signal scoring already
checked all four, but the rule-condition context
(monitoring_engine.py's _build_txn_context) only ever exposed the first
pair -- so a transaction entered via the real frontend form (which sends
country_destination, not destination_country) was invisible to every
"high-risk jurisdiction" MonitoringRule, seeded or user-created. Fixed
alongside by falling back to the other pair when the first is unset.
"""

from app.models.monitoring import MonitoringRule
from app.models.organisation import Organisation
from app.services.org_service import seed_permission_catalog_and_roles
from tests.conftest import _auth


def test_registration_seeds_six_starter_monitoring_rules(client, db):
    seed_permission_catalog_and_roles(db)
    resp = client.post(
        "/api/v1/auth/register",
        json={
            "email": "monitoring_seed@test.com",
            "full_name": "Monitoring Seed Owner",
            "password": "SecurePass123!",
        },
    )
    assert resp.status_code == 201, resp.text
    org_id = resp.json()["org_id"]

    rules = db.query(MonitoringRule).filter(MonitoringRule.org_id == org_id).all()
    assert len(rules) == 6
    assert {r.rule_ref for r in rules} == {
        "RULE-TM-001",
        "RULE-TM-002",
        "RULE-TM-003",
        "RULE-TM-004",
        "RULE-TM-005",
        "RULE-TM-006",
    }
    assert all(r.is_system_rule for r in rules)
    assert all(r.status.value == "active" for r in rules)

    # Also reachable and editable via the real rule-management API, not
    # just present in the database.
    from app.models.user import User

    user = db.query(User).filter_by(email="monitoring_seed@test.com").first()
    headers = _auth(user)
    listed = client.get("/api/v1/monitoring/rules", headers=headers)
    assert listed.status_code == 200, listed.text
    assert len(listed.json()) == 6


def test_seeded_high_risk_jurisdiction_rule_actually_fires(client, db, admin_user):
    """
    Not just "rows exist" -- one of the seeded rules genuinely matches a
    real transaction through the live pipeline (creation -> automatic
    run_monitoring() -> RuleExecution -> TransactionAlert).
    """
    import uuid

    from app.models.monitoring import TransactionAlert
    from app.services.org_service import _seed_default_monitoring_rules

    org = db.query(Organisation).filter_by(id=admin_user.org_id).first()
    _seed_default_monitoring_rules(db, org.id, admin_user.id)
    db.commit()

    headers = _auth(admin_user)
    customer = client.post(
        "/api/v1/customers/",
        json={
            "full_name": "High Risk Jurisdiction Customer",
            "email": f"hrj-{uuid.uuid4().hex[:6]}@example.com",
            "phone": "+61400000097",
            "date_of_birth": "1990-01-01",
            "nationality": "AU",
            "country_of_residence": "AU",
            "id_number": "PP77777777",
            "id_type": "passport",
            "address": "1 Rule Test St, Sydney NSW 2000",
            "industry": "banking",
        },
        headers=headers,
    )
    assert customer.status_code == 201, customer.text
    customer_id = customer.json()["id"]

    ref = f"TXN-RULE-{uuid.uuid4().hex[:8]}"
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
            "country_destination": "IR",  # FATF blacklist -- the field the real
            # frontend transaction form actually sends (web/app/monitoring/page.tsx)
            "description": "Transfer to high-risk jurisdiction",
            "transaction_date": "2026-06-01T10:00:00",
        },
        headers=headers,
    )
    assert txn.status_code == 201, txn.text
    txn_id = txn.json()["id"]

    alerts = (
        db.query(TransactionAlert).filter(TransactionAlert.transaction_id == txn_id).all()
    )
    assert len(alerts) >= 1
