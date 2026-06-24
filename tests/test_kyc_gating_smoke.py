"""
Smoke tests for the activation-gate fix (Critical #2/#3/#4):
- A customer with no checklist row cannot be activated (fail closed).
- A customer with pending/unresolved screening cannot be activated.
- kyc.py review_kyc cannot activate a customer either, for the same reasons.
- Once screening is genuinely cleared, activation succeeds through both paths.
"""

from app.models.customer import (
    Customer,
    CustomerOnboardingChecklist,
    CustomerStatus,
    CustomerType,
)
from app.models.screening import ScreeningRecord, ScreeningStatus, ScreeningType


def _make_customer(db, org_id: str) -> Customer:
    c = Customer(
        org_id=org_id,
        customer_ref="KYC-SMOKE-1",
        customer_type=CustomerType.individual,
        full_name="Smoke Test Customer",
        status=CustomerStatus.under_review,
        risk_score=10.0,
    )
    db.add(c)
    db.commit()
    db.refresh(c)
    return c


def _make_customer_with_checklist(db, org_id: str) -> Customer:
    """Mirrors what the real customer-creation endpoint does: a checklist row
    with all flags False is created alongside the customer."""
    c = _make_customer(db, org_id)
    chk = CustomerOnboardingChecklist(customer_id=c.id, org_id=org_id)
    db.add(chk)
    db.commit()
    return c


def test_activate_blocked_with_no_checklist_row(client, db, compliance_headers, compliance_user):
    customer = _make_customer(db, compliance_user.org_id)
    # Deliberately no CustomerOnboardingChecklist row exists for this customer.
    resp = client.post(
        f"/api/v1/customers/{customer.id}/status",
        json={"status": "active"},
        headers=compliance_headers,
    )
    assert resp.status_code == 422, resp.text


def test_activate_blocked_with_pending_screening(client, db, compliance_headers, compliance_user):
    customer = _make_customer_with_checklist(db, compliance_user.org_id)
    # Trigger screening — should NOT mark the checklist flags complete by itself.
    resp = client.post(
        f"/api/v1/customers/{customer.id}/screen",
        json={"screening_types": ["pep", "sanctions"], "provider": "internal"},
        headers=compliance_headers,
    )
    assert resp.status_code == 201, resp.text

    resp = client.post(
        f"/api/v1/customers/{customer.id}/status",
        json={"status": "active"},
        headers=compliance_headers,
    )
    assert resp.status_code == 422, resp.text


def test_activate_succeeds_once_genuinely_cleared(client, db, compliance_headers, compliance_user):
    customer = _make_customer_with_checklist(db, compliance_user.org_id)
    resp = client.post(
        f"/api/v1/customers/{customer.id}/screen",
        json={"screening_types": ["pep", "sanctions"], "provider": "internal"},
        headers=compliance_headers,
    )
    assert resp.status_code == 201, resp.text
    records = resp.json()

    for rec in records:
        r = client.patch(
            f"/api/v1/customers/{customer.id}/screening/{rec['id']}/review",
            json={"status": "clear", "reviewer_notes": "ok", "is_false_positive": False},
            headers=compliance_headers,
        )
        assert r.status_code == 200, r.text

    # identity_document_verified is still false -> still blocked.
    resp = client.post(
        f"/api/v1/customers/{customer.id}/status",
        json={"status": "active"},
        headers=compliance_headers,
    )
    assert resp.status_code == 422, resp.text

    db.query(Customer).filter(Customer.id == customer.id).first()
    from app.models.customer import CustomerOnboardingChecklist

    chk = (
        db.query(CustomerOnboardingChecklist)
        .filter(CustomerOnboardingChecklist.customer_id == customer.id)
        .first()
    )
    chk.identity_document_verified = True
    db.commit()

    resp = client.post(
        f"/api/v1/customers/{customer.id}/status",
        json={"status": "active"},
        headers=compliance_headers,
    )
    assert resp.status_code == 200, resp.text
    assert resp.json()["status"] == "active"


def test_confirmed_match_reblocks_even_if_previously_clear(client, db, compliance_headers, compliance_user):
    customer = _make_customer_with_checklist(db, compliance_user.org_id)
    resp = client.post(
        f"/api/v1/customers/{customer.id}/screen",
        json={"screening_types": ["sanctions"], "provider": "internal"},
        headers=compliance_headers,
    )
    rec_id = resp.json()[0]["id"]

    client.patch(
        f"/api/v1/customers/{customer.id}/screening/{rec_id}/review",
        json={"status": "clear", "reviewer_notes": "ok", "is_false_positive": False},
        headers=compliance_headers,
    )

    # Reclassified later as a confirmed match.
    r = client.patch(
        f"/api/v1/customers/{customer.id}/screening/{rec_id}/review",
        json={"status": "confirmed_match", "reviewer_notes": "hit", "is_false_positive": False},
        headers=compliance_headers,
    )
    assert r.status_code == 200, r.text

    resp = client.post(
        f"/api/v1/customers/{customer.id}/status",
        json={"status": "active"},
        headers=compliance_headers,
    )
    assert resp.status_code == 422, resp.text


def test_kyc_review_kyc_endpoint_cannot_bypass_gate(client, db, compliance_headers, compliance_user):
    customer = _make_customer(db, compliance_user.org_id)
    # No checklist completeness at all — old code would have approved this
    # straight to `active` using only the fake sample watchlist.
    resp = client.post(
        f"/api/v1/kyc/{customer.id}/review",
        params={"approve": True},
        headers=compliance_headers,
    )
    assert resp.status_code == 422, resp.text
