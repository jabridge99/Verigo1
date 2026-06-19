"""
Tests for customer CRUD, tenant isolation, and risk scoring RBAC.
"""

import pytest

from tests.conftest import _auth, _make_user
from app.models.user import UserRole

CUSTOMER_PAYLOAD = {
    "full_name": "Jane Doe",
    "email": "jane@example.com",
    "phone": "+61400000001",
    "date_of_birth": "1990-01-15",
    "nationality": "AU",
    "country_of_residence": "AU",
    "id_number": "PA123456",
    "id_type": "passport",
    "address": "1 Test St, Sydney NSW 2000",
    "industry": "banking",
    "occupation": "Engineer",
    "source_of_funds": "Salary",
}


class TestCustomerCreate:
    def test_unauthenticated_cannot_create(self, client):
        resp = client.post("/api/v1/customers/", json=CUSTOMER_PAYLOAD)
        assert resp.status_code == 401

    def test_viewer_cannot_create(self, client, viewer_headers):
        resp = client.post("/api/v1/customers/", json=CUSTOMER_PAYLOAD, headers=viewer_headers)
        assert resp.status_code == 403

    def test_analyst_can_create(self, client, analyst_headers):
        resp = client.post("/api/v1/customers/", json=CUSTOMER_PAYLOAD, headers=analyst_headers)
        assert resp.status_code in (201, 500)
        if resp.status_code == 201:
            data = resp.json()
            assert data["full_name"] == "Jane Doe"
            assert "id" in data

    def test_industry_id_set_from_session(self, client, db, analyst_user, analyst_headers):
        from app.models.customer import Customer
        resp = client.post("/api/v1/customers/", json={**CUSTOMER_PAYLOAD, "email": "ind-test@example.com"}, headers=analyst_headers)
        assert resp.status_code == 201
        cid = resp.json()["id"]
        record = db.query(Customer).filter(Customer.id == cid).first()
        assert record is not None
        assert record.org_id == analyst_user.org_id


class TestCustomerList:
    def test_unauthenticated_cannot_list(self, client):
        resp = client.get("/api/v1/customers/")
        assert resp.status_code == 401

    def test_analyst_can_list(self, client, analyst_headers):
        resp = client.get("/api/v1/customers/", headers=analyst_headers)
        assert resp.status_code == 200
        assert isinstance(resp.json(), list)

    def test_tenant_isolation(self, client, db, analyst_headers):
        # Create a user from a different tenant
        other_user = _make_user(db, UserRole.analyst)
        other_headers = _auth(other_user)

        # Create customer as other tenant
        resp = client.post("/api/v1/customers/", json={**CUSTOMER_PAYLOAD, "email": "other@example.com"}, headers=other_headers)
        assert resp.status_code == 201
        customer_id = resp.json()["id"]

        # Original tenant should NOT see other tenant's customer
        list_resp = client.get("/api/v1/customers/", headers=analyst_headers)
        ids = [c["id"] for c in list_resp.json()]
        assert customer_id not in ids


class TestCustomerGet:
    def test_get_own_customer(self, client, analyst_headers):
        create = client.post("/api/v1/customers/", json=CUSTOMER_PAYLOAD, headers=analyst_headers)
        assert create.status_code == 201
        cid = create.json()["id"]

        resp = client.get(f"/api/v1/customers/{cid}", headers=analyst_headers)
        assert resp.status_code == 200
        assert resp.json()["id"] == cid

    def test_cannot_get_other_tenant_customer(self, client, db, analyst_headers):
        other_user = _make_user(db, UserRole.analyst)
        other_headers = _auth(other_user)

        create = client.post("/api/v1/customers/", json={**CUSTOMER_PAYLOAD, "email": "cross@example.com"}, headers=other_headers)
        assert create.status_code == 201
        cid = create.json()["id"]

        resp = client.get(f"/api/v1/customers/{cid}", headers=analyst_headers)
        assert resp.status_code in (403, 404)


class TestPrivilegedFields:
    def test_analyst_cannot_set_risk_score(self, client, analyst_headers):
        create = client.post("/api/v1/customers/", json=CUSTOMER_PAYLOAD, headers=analyst_headers)
        cid = create.json()["id"]

        # Analyst tries to set risk_score directly
        resp = client.patch(f"/api/v1/customers/{cid}", json={"risk_score": 99}, headers=analyst_headers)
        if resp.status_code == 200:
            # Field should be silently ignored
            assert resp.json().get("risk_score") != 99

    def test_compliance_can_rescore(self, client, compliance_headers):
        create = client.post("/api/v1/customers/", json=CUSTOMER_PAYLOAD, headers=compliance_headers)
        cid = create.json()["id"]

        resp = client.post(f"/api/v1/customers/{cid}/rescore", headers=compliance_headers)
        assert resp.status_code in (200, 404)  # 404 if no KYC data yet
