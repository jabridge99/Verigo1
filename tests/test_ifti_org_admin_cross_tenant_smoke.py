"""
Smoke test for a confirmed cross-tenant data leak in app/api/routes/ifti.py:

Every endpoint gated its tenant-scoping check on `current_user.role !=
UserRole.admin`, but `UserRole.admin` is a per-organisation role that any
tenant obtains for itself via normal self-serve signup (see
tests/conftest.py::admin_user, which is NOT is_super_admin). The check
should instead gate on the platform-wide `current_user.is_super_admin`
flag, matching the pattern already used in storage.py, documents.py,
security_monitor.py, billing.py and tenants.py.

As written prior to the fix, any organisation's own `admin` user could
list, read, export, edit, mark-submitted, or delete every other
organisation's IFTI-DRA records. A true `is_super_admin` user is still
meant to retain cross-tenant read/write access, and that is verified too.
"""

import uuid
from datetime import date

from app.models.ifti import IFTIDirection, IFTIRecord
from tests.conftest import _auth, _make_org


def _make_ifti_record(db, org_id) -> IFTIRecord:
    record = IFTIRecord(
        ifti_id=f"IFTI-{uuid.uuid4().hex[:12].upper()}",
        industry_id=org_id,
        direction=IFTIDirection.outgoing,
        created_by="someone",
        date_received=date.today(),
        date_available=date.today(),
        total_amount=1000.0,
    )
    db.add(record)
    db.commit()
    db.refresh(record)
    return record


def test_org_admin_cannot_list_other_orgs_records(client, db, admin_user):
    other_org = _make_org(db)
    _make_ifti_record(db, other_org.id)

    resp = client.get("/api/v1/ifti/", headers=_auth(admin_user))
    assert resp.status_code == 200
    assert resp.json() == []


def test_org_admin_cannot_read_other_orgs_record(client, db, admin_user):
    other_org = _make_org(db)
    record = _make_ifti_record(db, other_org.id)

    resp = client.get(f"/api/v1/ifti/{record.ifti_id}", headers=_auth(admin_user))
    assert resp.status_code == 403


def test_org_admin_cannot_edit_other_orgs_record(client, db, admin_user):
    other_org = _make_org(db)
    record = _make_ifti_record(db, other_org.id)

    resp = client.patch(
        f"/api/v1/ifti/{record.ifti_id}",
        json={
            "direction": "outgoing",
            "date_received": "01/01/2026",
            "date_available": "01/01/2026",
            "total_amount": 500.0,
        },
        headers=_auth(admin_user),
    )
    assert resp.status_code == 403


def test_org_admin_cannot_delete_other_orgs_record(client, db, admin_user):
    other_org = _make_org(db)
    record = _make_ifti_record(db, other_org.id)

    resp = client.delete(f"/api/v1/ifti/{record.ifti_id}", headers=_auth(admin_user))
    assert resp.status_code == 403

    db.refresh(record)
    assert record.ifti_id  # still exists


def test_org_admin_cannot_export_other_orgs_records(client, db, admin_user):
    other_org = _make_org(db)
    _make_ifti_record(db, other_org.id)

    resp = client.get(
        "/api/v1/ifti/export/outgoing",
        headers=_auth(admin_user),
    )
    # No records visible in the admin's own (empty) org -> 404, never the
    # other org's data.
    assert resp.status_code == 404


def test_org_admin_cannot_batch_export_other_orgs_record(client, db, admin_user):
    other_org = _make_org(db)
    record = _make_ifti_record(db, other_org.id)

    resp = client.post(
        "/api/v1/ifti/export/batch?direction=outgoing",
        json=[record.ifti_id],
        headers=_auth(admin_user),
    )
    assert resp.status_code == 404


def test_org_admin_can_still_manage_own_org_record(client, db, admin_user):
    record = _make_ifti_record(db, admin_user.org_id)

    resp = client.get(f"/api/v1/ifti/{record.ifti_id}", headers=_auth(admin_user))
    assert resp.status_code == 200
    assert resp.json()["ifti_id"] == record.ifti_id


def test_super_admin_retains_cross_tenant_read(client, db, super_admin_user):
    other_org = _make_org(db)
    record = _make_ifti_record(db, other_org.id)

    resp = client.get(f"/api/v1/ifti/{record.ifti_id}", headers=_auth(super_admin_user))
    assert resp.status_code == 200
    assert resp.json()["ifti_id"] == record.ifti_id


def test_super_admin_sees_all_orgs_in_list(client, db, super_admin_user):
    other_org = _make_org(db)
    record = _make_ifti_record(db, other_org.id)

    resp = client.get("/api/v1/ifti/", headers=_auth(super_admin_user))
    assert resp.status_code == 200
    ids = {r["ifti_id"] for r in resp.json()}
    assert record.ifti_id in ids
