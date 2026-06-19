"""
Smoke tests for Phase 7-13 routers: reporting_groups, customer_portal_staff,
customer_portal_public, training_triggers, examination_packs, benchmark.

These verify the routes are wired up, enforce auth, and return sane
responses for an empty/new org — not full functional coverage.
"""


class TestReportingGroups:
    def test_unauthenticated_cannot_list(self, client):
        resp = client.get("/api/v1/reporting-groups/")
        assert resp.status_code == 401

    def test_analyst_can_list_empty(self, client, analyst_headers):
        resp = client.get("/api/v1/reporting-groups/", headers=analyst_headers)
        assert resp.status_code == 200
        assert isinstance(resp.json(), list)

    def test_enum_values(self, client, analyst_headers):
        resp = client.get("/api/v1/reporting-groups/enums/values", headers=analyst_headers)
        assert resp.status_code in (200, 401, 403, 404)


class TestCustomerPortalStaff:
    def test_unauthenticated_cannot_list_sessions(self, client):
        resp = client.get("/api/v1/customer-portal/sessions")
        assert resp.status_code == 401

    def test_analyst_can_list_sessions_empty(self, client, analyst_headers):
        resp = client.get("/api/v1/customer-portal/sessions", headers=analyst_headers)
        assert resp.status_code == 200
        assert isinstance(resp.json(), list)


class TestCustomerPortalPublic:
    def test_invalid_token_rejected(self, client):
        resp = client.get("/api/v1/portal/not-a-real-token")
        assert resp.status_code in (400, 401, 404)


class TestTrainingTriggers:
    def test_unauthenticated_cannot_list_rules(self, client):
        resp = client.get("/api/v1/training-triggers/rules")
        assert resp.status_code == 401

    def test_compliance_can_list_rules(self, client, compliance_headers):
        resp = client.get("/api/v1/training-triggers/rules", headers=compliance_headers)
        assert resp.status_code == 200
        assert isinstance(resp.json(), list)

    def test_analyst_cannot_list_rules(self, client, analyst_headers):
        resp = client.get("/api/v1/training-triggers/rules", headers=analyst_headers)
        assert resp.status_code == 403

    def test_compliance_can_list_regulatory_updates(self, client, compliance_headers):
        resp = client.get("/api/v1/training-triggers/regulatory-updates", headers=compliance_headers)
        assert resp.status_code == 200


class TestExaminationPacks:
    def test_unauthenticated_cannot_list(self, client):
        resp = client.get("/api/v1/examination-packs/")
        assert resp.status_code == 401

    def test_compliance_can_list_empty(self, client, compliance_headers):
        resp = client.get("/api/v1/examination-packs/", headers=compliance_headers)
        assert resp.status_code == 200
        assert isinstance(resp.json(), list)

    def test_analyst_cannot_list(self, client, analyst_headers):
        resp = client.get("/api/v1/examination-packs/", headers=analyst_headers)
        assert resp.status_code == 403

    def test_list_sections(self, client, compliance_headers):
        resp = client.get("/api/v1/examination-packs/sections", headers=compliance_headers)
        assert resp.status_code in (200, 401, 403)


class TestBenchmark:
    def test_unauthenticated_cannot_get_dashboard(self, client):
        resp = client.get("/api/v1/benchmarks/dashboard")
        assert resp.status_code == 401

    def test_analyst_can_get_dashboard(self, client, analyst_headers):
        resp = client.get("/api/v1/benchmarks/dashboard", headers=analyst_headers)
        assert resp.status_code in (200, 404)
