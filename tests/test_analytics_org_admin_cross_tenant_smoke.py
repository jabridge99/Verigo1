"""
Smoke test for a confirmed cross-tenant leak in app/api/routes/analytics.py:
_industry()/_organisation() gated the `industry_id` query-param override on
`current_user.role == "admin"` -- the per-organisation role any tenant
obtains for itself via normal self-serve signup, not a platform-wide flag
-- the same recurring mistake fixed elsewhere this session (is_super_admin
is the only real global flag). Any organisation's own admin could pass
another organisation's id as `?industry_id=` and read that organisation's
analytics data.

This also caused a real mypy error: _organisation() was annotated to
return Optional[int], but every service function it feeds expects
Optional[str] (organisation ids are strings everywhere else in this
codebase) -- the wrong return type followed directly from the wrong
scoping logic (an org admin's own primary_organisation_id was the only
value ever meant to flow through, and the annotation was never actually
exercised with a real value to catch the mismatch).
"""

from app.models.customer import Customer, CustomerStatus, RiskLevel
from tests.conftest import _auth, _make_org


def _make_customer(db, org, risk_level=RiskLevel.high):
    import uuid

    c = Customer(
        customer_ref=f"CUST-{uuid.uuid4().hex[:10].upper()}",
        org_id=org.id,
        full_name="Test Customer",
        status=CustomerStatus.active,
        risk_level=risk_level,
    )
    db.add(c)
    db.commit()
    return c


def test_org_admin_cannot_read_other_orgs_analytics_via_industry_override(
    client, db, admin_user
):
    other_org = _make_org(db)
    _make_customer(db, other_org)

    resp = client.get(
        f"/api/v1/analytics/customers/risk-breakdown?industry_id={other_org.id}",
        headers=_auth(admin_user),
    )
    assert resp.status_code == 200
    body = resp.json()
    assert body["total"] == 0, (
        "another org's admin must not see this org's customer analytics"
    )


def test_super_admin_retains_cross_tenant_analytics_override(
    client, db, super_admin_user
):
    other_org = _make_org(db)
    _make_customer(db, other_org)

    resp = client.get(
        f"/api/v1/analytics/customers/risk-breakdown?industry_id={other_org.id}",
        headers=_auth(super_admin_user),
    )
    assert resp.status_code == 200
    body = resp.json()
    assert body["total"] == 1
