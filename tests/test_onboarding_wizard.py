"""
Phase D — onboarding wizard: company details, compliance officer, and
the "complete first customer" step that closes out org setup.
"""

from app.models.user import UserRole
from app.services.org_service import seed_permission_catalog_and_roles
from tests.conftest import _make_user, _auth


def _create_org(client, headers, name="Test Remitco", industry_id="banking-au"):
    res = client.post("/api/v1/organisations", json={"name": name, "industry_id": industry_id}, headers=headers)
    assert res.status_code == 201, res.text
    return res.json()


def test_company_details_and_compliance_officer_via_patch(client, db):
    seed_permission_catalog_and_roles(db)
    owner = _make_user(db, UserRole.analyst, industry_id=None)
    headers = _auth(owner)
    org = _create_org(client, headers)

    res = client.patch(
        f"/api/v1/organisations/{org['org_id']}",
        json={
            "abn": "12 345 678 901",
            "business_address": "1 Example St, Sydney NSW 2000",
            "phone": "+61 2 9000 0000",
        },
        headers=headers,
    )
    assert res.status_code == 200, res.text
    body = res.json()
    assert body["abn"] == "12 345 678 901"
    assert body["business_address"] == "1 Example St, Sydney NSW 2000"

    res = client.patch(
        f"/api/v1/organisations/{org['org_id']}",
        json={
            "compliance_officer_name": "Jane Smith",
            "compliance_officer_email": "jane@testremitco.com",
        },
        headers=headers,
    )
    assert res.status_code == 200, res.text
    body = res.json()
    assert body["compliance_officer_name"] == "Jane Smith"
    assert body["compliance_officer_email"] == "jane@testremitco.com"


def test_full_onboarding_wizard_flow_through_first_customer(client, db):
    seed_permission_catalog_and_roles(db)
    owner = _make_user(db, UserRole.analyst, industry_id=None)
    headers = _auth(owner)

    org = _create_org(client, headers, industry_id="digital-currency-exchange")

    client.patch(
        f"/api/v1/organisations/{org['org_id']}",
        json={"abn": "98 765 432 100", "business_address": "2 Test Ave", "phone": "0400000000"},
        headers=headers,
    )
    client.patch(
        f"/api/v1/organisations/{org['org_id']}",
        json={"compliance_officer_name": "Alex MLRO", "compliance_officer_email": "alex@testremitco.com"},
        headers=headers,
    )
    res = client.patch(
        f"/api/v1/organisations/{org['org_id']}", json={"risk_profile": "high"}, headers=headers
    )
    assert res.status_code == 200

    res = client.post(f"/api/v1/organisations/{org['org_id']}/aml-program/generate", headers=headers)
    assert res.status_code == 201, res.text

    res = client.post(
        "/api/v1/customers/",
        json={
            "full_name": "First Customer",
            "date_of_birth": "1990-01-01",
            "nationality": "Australian",
            "country_of_residence": "Australia",
            "id_number": "ID123456",
            "id_type": "passport",
            "address": "3 Customer Rd",
            "email": "first.customer@example.com",
            "phone": "0411111111",
            "industry": "vasp",
        },
        headers=headers,
    )
    assert res.status_code == 201, res.text
    assert res.json()["full_name"] == "First Customer"
