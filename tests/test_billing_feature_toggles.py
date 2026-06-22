"""
Phase E — billing: admin-toggleable plan features, and dedicated
activate/terminate controls for admin-managed (Enterprise/VVIP) plans.
"""

from app.models.user import UserRole
from tests.conftest import _make_user, _auth


def test_plans_endpoint_reflects_feature_toggle_state(client, db):
    res = client.get("/api/v1/billing/plans")
    assert res.status_code == 200
    starter = next(p for p in res.json() if p["plan"] == "starter")
    assert "AML transaction monitoring" in starter["features"]


def test_admin_can_view_and_toggle_feature_matrix(client, db):
    admin = _make_user(db, UserRole.admin, industry_id=None)
    admin.is_super_admin = True
    db.commit()
    headers = _auth(admin)

    res = client.get("/api/v1/billing/admin/features", headers=headers)
    assert res.status_code == 200
    rows = res.json()
    row = next(r for r in rows if r["code"] == "white_label_branding")
    assert row["plans"]["enterprise"] is True
    assert row["plans"]["starter"] is False

    res = client.patch(
        "/api/v1/billing/admin/features/starter/white_label_branding",
        json={"enabled": True},
        headers=headers,
    )
    assert res.status_code == 200, res.text
    assert res.json()["plans"]["starter"] is True

    # Toggle propagates to the public plans listing.
    res = client.get("/api/v1/billing/plans")
    starter = next(p for p in res.json() if p["plan"] == "starter")
    assert "White-label branding" in starter["features"]

    res = client.patch(
        "/api/v1/billing/admin/features/enterprise/white_label_branding",
        json={"enabled": False},
        headers=headers,
    )
    assert res.status_code == 200
    assert res.json()["plans"]["enterprise"] is False


def test_non_admin_cannot_toggle_features(client, db):
    viewer = _make_user(db, UserRole.viewer, industry_id="IND-VIEW-001")
    headers = _auth(viewer)
    res = client.get("/api/v1/billing/admin/features", headers=headers)
    assert res.status_code == 403


def test_admin_activate_and_terminate_enterprise_subscription(client, db):
    admin = _make_user(db, UserRole.admin, industry_id=None)
    admin.is_super_admin = True
    db.commit()
    headers = _auth(admin)

    res = client.post(
        "/api/v1/billing/admin/IND-ENT-001/trial",
        headers=headers,
    )
    assert res.status_code == 200, res.text

    res = client.patch(
        "/api/v1/billing/admin/IND-ENT-001",
        json={"plan": "enterprise", "status": "active"},
        headers=headers,
    )
    assert res.status_code == 200

    res = client.post("/api/v1/billing/admin/IND-ENT-001/terminate", headers=headers)
    assert res.status_code == 200, res.text
    assert res.json()["status"] == "canceled"

    res = client.post("/api/v1/billing/admin/IND-ENT-001/activate", headers=headers)
    assert res.status_code == 200, res.text
    assert res.json()["status"] == "active"
