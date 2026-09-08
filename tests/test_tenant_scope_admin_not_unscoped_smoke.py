"""
Smoke test for a confirmed cross-tenant leak in app/services/tenant_scope.py:

is_unscoped() treated `UserRole.admin` as globally unscoped, exactly like
`is_super_admin`. UserRole.admin is a per-organisation role any tenant
obtains for itself via normal self-serve signup, not a platform-wide flag
— the same mistake already fixed in ifti.py, storage.py, documents.py,
billing.py, security_monitor.py and tenants.py. Every consumer of this
shared module (app/api/routes/onboarding.py and app/api/routes/
retention.py, confirmed by a repo-wide search) inherited the same flaw.

This file tests the shared helper directly; the end-to-end HTTP-level
exploitability of the two worst consequences (onboarding applicant PII
leaking across tenants, and one tenant's admin being able to release
another tenant's legal hold) is covered by:
  - tests/test_onboarding_org_admin_cross_tenant_smoke.py
  - tests/test_retention_org_admin_cross_tenant_smoke.py
"""

from app.services.tenant_scope import (
    assert_tenant,
    is_unscoped,
    scope_fields,
    scope_query,
)
from tests.conftest import UserRole, _make_org, _make_user


def test_org_admin_is_not_unscoped(db):
    admin = _make_user(db, UserRole.admin)
    assert is_unscoped(admin) is False


def test_super_admin_is_unscoped(db, super_admin_user):
    assert is_unscoped(super_admin_user) is True


def test_scope_fields_stamps_org_admins_own_org(db):
    admin = _make_user(db, UserRole.admin)
    fields = scope_fields(admin)
    assert fields.get("industry_id") == admin.industry_id


def test_scope_fields_empty_for_super_admin(db, super_admin_user):
    assert scope_fields(super_admin_user) == {}


def test_assert_tenant_blocks_org_admin_from_other_org_record(db):
    admin = _make_user(db, UserRole.admin)
    other_org = _make_org(db)
    from fastapi import HTTPException

    try:
        assert_tenant(admin, None, other_org.id)
        raised = False
    except HTTPException as e:
        raised = True
        assert e.status_code == 403
    assert raised, "org admin must not bypass tenant scoping on another org's record"


def test_assert_tenant_allows_super_admin_any_record(db, super_admin_user):
    other_org = _make_org(db)
    assert_tenant(super_admin_user, None, other_org.id)  # must not raise


def test_scope_query_filters_for_org_admin(db):
    from app.models.onboarding import OnboardingSession

    admin = _make_user(db, UserRole.admin)
    q = scope_query(db.query(OnboardingSession), OnboardingSession, admin)
    compiled = str(q)
    assert "industry_id" in compiled or "organisation_id" in compiled
