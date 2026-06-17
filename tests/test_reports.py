"""
Tests for SMR report generation, maker-checker enforcement, and tenant isolation.
"""

import uuid

import pytest

from app.models.case import Case, CaseType, CaseSeverity

CUSTOMER_PAYLOAD = {
    "full_name": "Report Test Customer",
    "email": "report-customer@example.com",
    "phone": "+61400000099",
    "date_of_birth": "1985-03-20",
    "nationality": "AU",
    "country_of_residence": "AU",
    "id_number": "DL99887766",
    "id_type": "drivers_licence",
    "address": "99 Report St, Sydney NSW 2000",
    "industry": "banking",
}


def _create_customer(client, headers):
    resp = client.post("/api/v1/customers/", json={
        **CUSTOMER_PAYLOAD,
        "email": f"rpt-{uuid.uuid4().hex[:6]}@example.com",
    }, headers=headers)
    assert resp.status_code == 201, f"Customer create failed: {resp.text}"
    return resp.json()["id"]


def _create_smr_candidate_case(db, org_id, customer_id, created_by):
    """Directly create a Case flagged as SMR-considered, ready for SMR generation."""
    case = Case(
        case_ref=f"CASE-{uuid.uuid4().hex[:8]}",
        org_id=org_id,
        customer_id=customer_id,
        case_type=CaseType.smr_candidate,
        severity=CaseSeverity.high,
        title="Suspicious transaction pattern",
        is_smr_candidate=True,
        smr_considered=True,
        created_by=created_by,
    )
    db.add(case)
    db.commit()
    db.refresh(case)
    return case


def _generate_smr(client, db, headers, mlro_headers, user):
    cid = _create_customer(client, headers)
    case = _create_smr_candidate_case(db, user.org_id, cid, user.id)
    resp = client.post(
        f"/api/v1/reports/smr/generate-from-case/{case.id}",
        params={"suspicion_grounds": "Unusual structuring pattern detected"},
        headers=mlro_headers,
    )
    assert resp.status_code == 201, f"SMR generate failed: {resp.text}"
    return resp.json()["id"]


def _same_org_users(db):
    """Create a compliance user and an MLRO user sharing the same org."""
    from tests.conftest import _make_user, _auth
    from app.models.user import UserRole

    compliance = _make_user(db, UserRole.compliance)
    mlro = _make_user(db, UserRole.mlro, org_id=compliance.org_id)
    return compliance, _auth(compliance), mlro, _auth(mlro)


class TestSMRGenerate:
    def test_unauthenticated_cannot_generate(self, client):
        resp = client.post("/api/v1/reports/smr/generate-from-case/case_nonexistent",
                            params={"suspicion_grounds": "x"})
        assert resp.status_code == 401

    def test_analyst_cannot_generate(self, client, compliance_headers, analyst_headers):
        cid = _create_customer(client, compliance_headers)
        resp = client.post(
            "/api/v1/reports/smr/generate-from-case/case_nonexistent",
            params={"suspicion_grounds": "x"},
            headers=analyst_headers,
        )
        assert resp.status_code == 403

    def test_mlro_can_generate(self, client, db):
        compliance, compliance_headers, mlro, mlro_headers = _same_org_users(db)
        report_id = _generate_smr(client, db, compliance_headers, mlro_headers, compliance)
        assert report_id


class TestMakerChecker:
    def test_reviewer_cannot_sign_off_own_review(self, client, db):
        compliance, compliance_headers, mlro, mlro_headers = _same_org_users(db)
        report_id = _generate_smr(client, db, compliance_headers, mlro_headers, compliance)

        review_resp = client.post(f"/api/v1/reports/smr/{report_id}/review", headers=mlro_headers)
        assert review_resp.status_code == 200

        # Same person who reviewed cannot sign off (maker-checker)
        sign_off_resp = client.post(f"/api/v1/reports/smr/{report_id}/mlro-sign-off", headers=mlro_headers)
        assert sign_off_resp.status_code in (403, 409)

    def test_different_user_can_sign_off(self, client, db):
        from tests.conftest import _make_user, _auth
        from app.models.user import UserRole

        compliance, compliance_headers, mlro, mlro_headers = _same_org_users(db)
        report_id = _generate_smr(client, db, compliance_headers, mlro_headers, compliance)

        review_resp = client.post(f"/api/v1/reports/smr/{report_id}/review", headers=compliance_headers)
        assert review_resp.status_code == 200

        other_mlro = _make_user(db, UserRole.mlro, org_id=mlro.org_id)
        other_mlro_headers = _auth(other_mlro)
        sign_off_resp = client.post(f"/api/v1/reports/smr/{report_id}/mlro-sign-off", headers=other_mlro_headers)
        assert sign_off_resp.status_code == 200


class TestSMRTenantIsolation:
    def test_cannot_access_other_tenant_report(self, client, db, mlro_headers):
        other_compliance, other_compliance_headers, other_mlro, other_mlro_headers = _same_org_users(db)

        report_id = _generate_smr(client, db, other_compliance_headers, other_mlro_headers, other_compliance)

        get_resp = client.get(f"/api/v1/reports/smr/{report_id}", headers=mlro_headers)
        assert get_resp.status_code in (403, 404)
