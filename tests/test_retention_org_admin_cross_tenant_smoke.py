"""
Smoke test for confirmed cross-tenant bugs in app/api/routes/retention.py,
where five endpoints independently checked `current_user.role ==
UserRole.admin` (the per-organisation role) instead of the global
`is_super_admin` flag -- the same bug class fixed via
app/services/tenant_scope.py for onboarding.py.

The most serious of the five: release_hold(). app/services/
retention_service.py's release_legal_hold() only enforces its ownership
check `elif industry_id and hold.industry_id != industry_id: raise
PermissionError(...)` when industry_id is truthy. Under the old code, any
organisation's own admin had industry_id=None passed to this function (the
same "unscoped" treatment as a real super-admin), which skipped the
ownership check entirely -- meaning any org's admin could release any
other org's legal hold with no restriction at all. A legal hold exists
specifically to block deletion of evidence under litigation/regulatory
hold; being able to lift another tenant's hold is a real evidence-
preservation risk, not just a confidentiality leak.
"""

import uuid

from app.models.retention import EntityScope, LegalHold
from tests.conftest import _auth, _make_org


def _make_hold(db, org, active=True) -> LegalHold:
    h = LegalHold(
        hold_id=f"HOLD-{uuid.uuid4().hex[:10].upper()}",
        industry_id=org.id,
        organisation_id=org.id,
        entity_scope=EntityScope.customer,
        entity_id=f"cust_{uuid.uuid4().hex[:10]}",
        reason="Pending regulatory inquiry",
        held_by="usr_someone",
        active=active,
    )
    db.add(h)
    db.commit()
    db.refresh(h)
    return h


def test_org_admin_cannot_release_other_orgs_legal_hold(client, db, admin_user):
    other_org = _make_org(db)
    hold = _make_hold(db, other_org)

    resp = client.post(
        f"/api/v1/retention/holds/{hold.hold_id}/release", headers=_auth(admin_user)
    )
    assert resp.status_code == 403

    db.refresh(hold)
    assert hold.active is True, "another org's admin must not be able to lift this hold"


def test_org_admin_cannot_list_other_orgs_legal_holds(client, db, admin_user):
    other_org = _make_org(db)
    _make_hold(db, other_org)

    resp = client.get("/api/v1/retention/holds", headers=_auth(admin_user))
    assert resp.status_code == 200
    assert resp.json() == []


def test_org_admin_can_still_release_own_orgs_legal_hold(client, db, admin_user):
    from app.models.organisation import Organisation

    own_org = (
        db.query(Organisation).filter(Organisation.id == admin_user.org_id).first()
    )
    hold = _make_hold(db, own_org)

    resp = client.post(
        f"/api/v1/retention/holds/{hold.hold_id}/release", headers=_auth(admin_user)
    )
    assert resp.status_code == 200

    db.refresh(hold)
    assert hold.active is False


def test_super_admin_retains_cross_tenant_release(client, db, super_admin_user):
    other_org = _make_org(db)
    hold = _make_hold(db, other_org)

    resp = client.post(
        f"/api/v1/retention/holds/{hold.hold_id}/release",
        headers=_auth(super_admin_user),
    )
    assert resp.status_code == 200

    db.refresh(hold)
    assert hold.active is False
