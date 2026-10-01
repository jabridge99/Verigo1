"""
P10: the customer risk engine's 5-dimension weights (assess_customer_risk's
`weights` param) have always existed but nothing ever passed them -- every
org, regardless of industry, was scored with the same flat
customer/product/geographic/channel/transaction split. Fixed by deriving a
per-org weight set from the org's own already-seeded, already-customisable
Enterprise-Wide Risk Assessment framework (RiskFramework.category_weights)
via the new get_org_risk_weights(), and wiring it into both real call sites
(POST /customers/{id}/workflow/assess-risk and POST /customers/{id}/rescore)
instead of inventing a third, separate weight-storage mechanism.
"""

import uuid

from app.models.user import UserRole
from app.services.customer_risk_engine import DEFAULT_WEIGHTS, get_org_risk_weights
from app.services.org_service import seed_permission_catalog_and_roles
from tests.conftest import _auth


def _register_and_select(
    client, db, email: str, industry_type: str
) -> tuple[str, dict]:
    seed_permission_catalog_and_roles(db)
    resp = client.post(
        "/api/v1/auth/register",
        json={
            "email": email,
            "full_name": "Weights Owner",
            "password": "SecurePass123!",
        },
    )
    assert resp.status_code == 201, resp.text
    org_id = resp.json()["org_id"]

    from app.models.user import User

    user = db.query(User).filter_by(email=email).first()
    # Self-registration assigns UserRole.analyst; /customers/{id}/rescore
    # requires require_compliance_or_above -- promote so the returned
    # headers can actually call it.
    user.role = UserRole.compliance
    db.commit()
    db.refresh(user)
    headers = _auth(user)

    selected = client.post(
        f"/api/v1/organisations/{org_id}/select-industry",
        json={"industry_type": industry_type},
        headers=headers,
    )
    assert selected.status_code == 200, selected.text
    return org_id, headers


def _create_customer(client, headers):
    payload = {
        "full_name": "Weights Test Customer",
        "email": f"weights-{uuid.uuid4().hex[:8]}@example.com",
        "phone": "+61400000099",
        "date_of_birth": "1985-03-20",
        "nationality": "AU",
        "country_of_residence": "AU",
        "id_number": "DL99887766",
        "id_type": "drivers_licence",
        "address": "1 Weights St, Sydney NSW 2000",
        "industry": "banking",
    }
    resp = client.post("/api/v1/customers/", json=payload, headers=headers)
    assert resp.status_code == 201, resp.text
    return resp.json()["id"]


def test_no_framework_falls_back_to_default_weights(db):
    assert get_org_risk_weights(db, "org-with-no-framework") == DEFAULT_WEIGHTS


def test_org_gets_industry_specific_weights_not_the_flat_default(client, db):
    org_id, _ = _register_and_select(
        client, db, "weights_legal_owner@test.com", "legal_professionals"
    )
    weights = get_org_risk_weights(db, org_id)

    assert weights != DEFAULT_WEIGHTS
    assert set(weights) == set(DEFAULT_WEIGHTS)
    assert abs(sum(weights.values()) - 1.0) < 1e-6


def test_different_industries_get_different_weights(client, db):
    legal_org, _ = _register_and_select(
        client, db, "weights_legal2@test.com", "legal_professionals"
    )
    dpms_org, _ = _register_and_select(
        client, db, "weights_dpms@test.com", "precious_metals"
    )

    legal_weights = get_org_risk_weights(db, legal_org)
    dpms_weights = get_org_risk_weights(db, dpms_org)

    assert legal_weights != dpms_weights
    # DPMS's real Risk Matrix weights cash/structuring transactions as the
    # dominant category (CT-01/CT-02 are its two highest inherent scores);
    # Legal's weights customer CDD-refusal highest (CR-01) instead.
    assert dpms_weights["transaction"] > legal_weights["transaction"]
    assert legal_weights["customer"] > dpms_weights["customer"]


def test_rescore_endpoint_produces_different_scores_across_industries(client, db):
    """End-to-end: two orgs, identical customer risk inputs, different
    industries -- the real /rescore endpoint must now produce different
    overall scores, proving the weights are actually wired into the
    production code path, not just the helper function in isolation."""
    legal_org, legal_headers = _register_and_select(
        client, db, "weights_legal_e2e@test.com", "legal_professionals"
    )
    dpms_org, dpms_headers = _register_and_select(
        client, db, "weights_dpms_e2e@test.com", "precious_metals"
    )

    legal_customer_id = _create_customer(client, legal_headers)
    dpms_customer_id = _create_customer(client, dpms_headers)

    legal_resp = client.post(
        f"/api/v1/customers/{legal_customer_id}/rescore", headers=legal_headers
    )
    dpms_resp = client.post(
        f"/api/v1/customers/{dpms_customer_id}/rescore", headers=dpms_headers
    )
    assert legal_resp.status_code == 200, legal_resp.text
    assert dpms_resp.status_code == 200, dpms_resp.text

    # Same customer inputs, only the org's industry differs -- before this
    # fix both orgs used the same flat DEFAULT_WEIGHTS, so these scores
    # would have been byte-for-byte identical regardless of industry.
    assert legal_resp.json()["risk_score"] != dpms_resp.json()["risk_score"]
