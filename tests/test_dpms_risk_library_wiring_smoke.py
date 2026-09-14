"""
DPMS sector rewrite (PARKING_LOT.md P21): the AML side of the industry
mapping (app/templates/aml/factory.py) already routed both
IndustryType.bullion_dealers and IndustryType.precious_metals to the real
"dpms" template, but the equivalent risk mapping
(app/templates/risk/factory.py's INDUSTRY_MODULE_MAP) mapped both to the
generic "other" risk library instead of a dedicated one -- there was no
"dpms" risk module to route to until this round. Every DPMS org's risk
framework was seeded with generic factors, never the sector's own real
20-row ISO 31000 Risk Matrix (VERIGO_DPMS_Risk_Matrix_v1.xlsx).

Fixed by adding app/templates/risk/industries/dpms.py (20 real factors:
CT-01/02/03, CR-01..04, PR-01..05, SG-01/02, DC-01/02, ER-01/02, PC-01/02)
and pointing both industry types at it.
"""

from app.models.risk_engine import RiskFactor
from app.models.user import User
from app.services.org_service import seed_permission_catalog_and_roles
from tests.conftest import _auth


def _register_and_select(client, db, email: str, industry_type: str) -> str:
    seed_permission_catalog_and_roles(db)
    resp = client.post(
        "/api/v1/auth/register",
        json={"email": email, "full_name": "DPMS Owner", "password": "SecurePass123!"},
    )
    assert resp.status_code == 201, resp.text
    org_id = resp.json()["org_id"]

    user = db.query(User).filter_by(email=email).first()
    headers = _auth(user)

    selected = client.post(
        f"/api/v1/organisations/{org_id}/select-industry",
        json={"industry_type": industry_type},
        headers=headers,
    )
    assert selected.status_code == 200, selected.text
    return org_id


def test_precious_metals_gets_the_real_dpms_risk_factors(client, db):
    org_id = _register_and_select(
        client, db, "dpms_risk_precious_metals@test.com", "precious_metals"
    )
    refs = {
        r[0]
        for r in db.query(RiskFactor.factor_ref)
        .filter(RiskFactor.org_id == org_id)
        .all()
    }
    # Real Risk Matrix IDs -- not present in the generic "other" library.
    assert {"CT-01", "CT-02", "PR-01", "SG-01"}.issubset(refs)
    assert len(refs) == 20


def test_bullion_dealers_gets_the_same_dpms_risk_factors(client, db):
    org_id = _register_and_select(
        client, db, "dpms_risk_bullion@test.com", "bullion_dealers"
    )
    refs = {
        r[0]
        for r in db.query(RiskFactor.factor_ref)
        .filter(RiskFactor.org_id == org_id)
        .all()
    }
    assert {"CT-01", "CT-02", "PR-01", "SG-01"}.issubset(refs)
    assert len(refs) == 20
