"""
Smoke test for a confirmed cross-tenant leak in app/api/routes/onboarding.py,
rooted in app/services/tenant_scope.py's is_unscoped() treating the
per-organisation UserRole.admin role as globally unscoped (fixed alongside
this test — see tests/test_tenant_scope_admin_not_unscoped_smoke.py).

Before the fix: any organisation's own admin could list and read every
other organisation's onboarding sessions -- full applicant PII (name,
email, phone, company) -- via GET /onboarding/sessions and
GET /onboarding/sessions/{id}, despite the module's own docstring
claiming "Tenant isolation enforced on list/get/audit/reminder/delete."
"""

import uuid
from datetime import datetime, timedelta, timezone

from app.models.onboarding import OnboardingSession
from tests.conftest import _auth, _make_org


def _make_session(db, org) -> OnboardingSession:
    s = OnboardingSession(
        session_id=f"OBS-{uuid.uuid4().hex[:10].upper()}",
        industry_id=org.id,
        organisation_id=org.id,
        applicant_name="Secret Applicant",
        applicant_email="secret-applicant@example.com",
        invite_token=uuid.uuid4().hex,
        invite_expires_at=datetime.now(timezone.utc) + timedelta(days=7),
    )
    db.add(s)
    db.commit()
    db.refresh(s)
    return s


def test_org_admin_cannot_list_other_orgs_sessions(client, db, admin_user):
    other_org = _make_org(db)
    _make_session(db, other_org)

    resp = client.get("/api/v1/onboarding/sessions", headers=_auth(admin_user))
    assert resp.status_code == 200
    assert resp.json() == []


def test_org_admin_cannot_read_other_orgs_session(client, db, admin_user):
    other_org = _make_org(db)
    session = _make_session(db, other_org)

    resp = client.get(
        f"/api/v1/onboarding/sessions/{session.session_id}", headers=_auth(admin_user)
    )
    assert resp.status_code == 403


def test_org_admin_cannot_list_other_orgs_batches(client, db, admin_user):
    from app.models.onboarding import ImportBatch

    other_org = _make_org(db)
    batch = ImportBatch(
        batch_id=f"BATCH-{uuid.uuid4().hex[:10].upper()}",
        industry_id=other_org.id,
        organisation_id=other_org.id,
        source="csv",
    )
    db.add(batch)
    db.commit()

    resp = client.get("/api/v1/onboarding/batches", headers=_auth(admin_user))
    assert resp.status_code == 200
    assert resp.json() == []


def test_org_admin_can_still_read_own_org_session(client, db, admin_user):
    session = _make_session(db, type("O", (), {"id": admin_user.org_id})())
    resp = client.get(
        f"/api/v1/onboarding/sessions/{session.session_id}", headers=_auth(admin_user)
    )
    assert resp.status_code == 200
    assert resp.json()["session_id"] == session.session_id


def test_super_admin_retains_cross_tenant_visibility(client, db, super_admin_user):
    other_org = _make_org(db)
    session = _make_session(db, other_org)

    resp = client.get("/api/v1/onboarding/sessions", headers=_auth(super_admin_user))
    assert resp.status_code == 200
    ids = {s["session_id"] for s in resp.json()}
    assert session.session_id in ids
