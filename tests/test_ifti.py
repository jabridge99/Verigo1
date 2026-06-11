"""
Tests for IFTI report creation, status workflow, tenant isolation, and Excel export.
"""

import pytest


IFTI_OUT_PAYLOAD = {
    "direction": "outgoing",
    "date_received": "01/06/2025",
    "date_available": "02/06/2025",
    "currency_code": "AUD",
    "total_amount": 15000.00,
    "transfer_type": "Money",
    "oc_full_name": "John Smith",
    "oc_address": "123 Main St",
    "oc_city": "Melbourne",
    "oc_state": "VIC",
    "oc_postcode": "3000",
    "oc_country": "Australia",
    "bc_full_name": "Receiver Corp",
    "bc_country": "United States",
    "reason_for_transfer": "Business payment",
    "reporter_full_name": "Compliance Officer",
    "reporter_email": "compliance@test.com",
}

IFTI_IN_PAYLOAD = {
    **IFTI_OUT_PAYLOAD,
    "direction": "incoming",
}


class TestIFTICreate:
    def test_unauthenticated_cannot_create(self, client):
        resp = client.post("/api/v1/ifti/", json=IFTI_OUT_PAYLOAD)
        assert resp.status_code == 401

    def test_analyst_cannot_create(self, client, analyst_headers):
        resp = client.post("/api/v1/ifti/", json=IFTI_OUT_PAYLOAD, headers=analyst_headers)
        assert resp.status_code == 403

    def test_compliance_can_create_out(self, client, compliance_headers):
        resp = client.post("/api/v1/ifti/", json=IFTI_OUT_PAYLOAD, headers=compliance_headers)
        assert resp.status_code == 201
        data = resp.json()
        assert data["direction"] == "outgoing"
        assert data["status"] == "draft"
        assert data["ifti_id"].startswith("IFTI-")

    def test_compliance_can_create_in(self, client, compliance_headers):
        resp = client.post("/api/v1/ifti/", json=IFTI_IN_PAYLOAD, headers=compliance_headers)
        assert resp.status_code == 201
        assert resp.json()["direction"] == "incoming"

    def test_industry_id_set_from_session(self, client, compliance_user, compliance_headers):
        resp = client.post("/api/v1/ifti/", json=IFTI_OUT_PAYLOAD, headers=compliance_headers)
        assert resp.status_code == 201
        assert resp.json()["industry_id"] == compliance_user.industry_id


class TestIFTIList:
    def test_analyst_can_list(self, client, analyst_headers):
        resp = client.get("/api/v1/ifti/", headers=analyst_headers)
        assert resp.status_code == 200
        assert isinstance(resp.json(), list)

    def test_viewer_cannot_list(self, client, viewer_headers):
        resp = client.get("/api/v1/ifti/", headers=viewer_headers)
        assert resp.status_code == 403

    def test_unauthenticated_cannot_list(self, client):
        resp = client.get("/api/v1/ifti/")
        assert resp.status_code == 401

    def test_tenant_isolation_on_list(self, client, db, compliance_headers):
        from tests.conftest import _make_user, _auth
        from app.models.user import UserRole

        other_user = _make_user(db, UserRole.compliance, industry_id="IND-IFTI-OTHER")
        other_headers = _auth(other_user)

        # Create record as other tenant
        resp = client.post("/api/v1/ifti/", json=IFTI_OUT_PAYLOAD, headers=other_headers)
        assert resp.status_code == 201
        other_ifti_id = resp.json()["ifti_id"]

        # Original compliance user should not see it
        list_resp = client.get("/api/v1/ifti/", headers=compliance_headers)
        ids = [r["ifti_id"] for r in list_resp.json()]
        assert other_ifti_id not in ids


class TestIFTIWorkflow:
    def _create(self, client, headers):
        resp = client.post("/api/v1/ifti/", json=IFTI_OUT_PAYLOAD, headers=headers)
        assert resp.status_code == 201
        return resp.json()["ifti_id"]

    def test_mark_ready(self, client, compliance_headers):
        ifti_id = self._create(client, compliance_headers)
        resp = client.post(f"/api/v1/ifti/{ifti_id}/ready", headers=compliance_headers)
        assert resp.status_code == 200
        assert resp.json()["status"] == "ready"

    def test_mark_submitted_requires_mlro(self, client, compliance_headers, mlro_headers):
        ifti_id = self._create(client, compliance_headers)

        # Compliance cannot submit
        resp = client.post(f"/api/v1/ifti/{ifti_id}/submitted", headers=compliance_headers)
        assert resp.status_code == 403

        # MLRO can submit
        resp = client.post(f"/api/v1/ifti/{ifti_id}/submitted", headers=mlro_headers)
        assert resp.status_code == 200
        assert resp.json()["status"] == "submitted"

    def test_cannot_edit_submitted(self, client, compliance_headers, mlro_headers):
        ifti_id = self._create(client, compliance_headers)
        client.post(f"/api/v1/ifti/{ifti_id}/submitted", headers=mlro_headers)

        resp = client.patch(f"/api/v1/ifti/{ifti_id}", json=IFTI_OUT_PAYLOAD, headers=compliance_headers)
        assert resp.status_code == 400

    def test_cannot_delete_submitted(self, client, compliance_headers, mlro_headers):
        ifti_id = self._create(client, compliance_headers)
        client.post(f"/api/v1/ifti/{ifti_id}/submitted", headers=mlro_headers)

        resp = client.delete(f"/api/v1/ifti/{ifti_id}", headers=compliance_headers)
        assert resp.status_code == 400

    def test_delete_draft(self, client, compliance_headers):
        ifti_id = self._create(client, compliance_headers)
        resp = client.delete(f"/api/v1/ifti/{ifti_id}", headers=compliance_headers)
        assert resp.status_code == 204

        get_resp = client.get(f"/api/v1/ifti/{ifti_id}", headers=compliance_headers)
        assert get_resp.status_code == 404


class TestIFTIExport:
    def test_export_returns_xlsx(self, client, compliance_headers):
        client.post("/api/v1/ifti/", json=IFTI_OUT_PAYLOAD, headers=compliance_headers)
        resp = client.get("/api/v1/ifti/export/outgoing", headers=compliance_headers)
        assert resp.status_code == 200
        assert resp.headers["content-type"] == "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
        assert "X-Record-Count" in resp.headers
        # Verify it's a valid xlsx (PK zip magic bytes)
        assert resp.content[:4] == b"PK\x03\x04"

    def test_export_in_returns_xlsx(self, client, compliance_headers):
        client.post("/api/v1/ifti/", json=IFTI_IN_PAYLOAD, headers=compliance_headers)
        resp = client.get("/api/v1/ifti/export/incoming", headers=compliance_headers)
        assert resp.status_code == 200
        assert resp.content[:4] == b"PK\x03\x04"

    def test_export_empty_returns_404(self, client, db, compliance_headers):
        from tests.conftest import _make_user, _auth
        from app.models.user import UserRole
        # Use a tenant with no IFTI records
        empty_user = _make_user(db, UserRole.compliance, industry_id="IND-EMPTY-IFTI")
        empty_headers = _auth(empty_user)
        resp = client.get("/api/v1/ifti/export/outgoing", headers=empty_headers)
        assert resp.status_code == 404

    def test_analyst_cannot_export(self, client, analyst_headers):
        resp = client.get("/api/v1/ifti/export/outgoing", headers=analyst_headers)
        assert resp.status_code == 403
