"""
Smoke test for Critical #14 (continued): app/api/routes/ifti.py's
status-changing endpoints fetched the IFTIRecord by id only and mutated
its status with no tenant check, unlike the sibling get_record(),
update_record(), and delete_record() endpoints in the same file — any
compliance/mlro user could flip another org's IFTI record to under_review
or submitted by guessing/enumerating its ifti_id.

P28 replaced the bare draft/ready/submitted workflow with a full
maker-checker chain (review/approve/submit/acknowledge/reject/redraft);
these tests were ported onto /review and /submit, the two endpoints that
correspond to the original /ready and /submitted this test covered.
"""

import uuid
from datetime import date

from app.models.ifti import IFTIDirection, IFTIRecord, IFTIStatus
from tests.conftest import UserRole, _auth, _make_org, _make_user


def _make_ifti_record(db, org_id, status=IFTIStatus.draft, **overrides) -> IFTIRecord:
    record = IFTIRecord(
        ifti_id=f"IFTI-{uuid.uuid4().hex[:12].upper()}",
        industry_id=org_id,
        direction=IFTIDirection.outgoing,
        created_by="someone",
        date_received=date.today(),
        date_available=date.today(),
        total_amount=1000.0,
        status=status,
        **overrides,
    )
    db.add(record)
    db.commit()
    db.refresh(record)
    return record


def test_review_denied_for_other_org_record(client, db, compliance_user):
    other_org = _make_org(db)
    record = _make_ifti_record(db, other_org.id)

    resp = client.post(
        f"/api/v1/ifti/{record.ifti_id}/review",
        headers=_auth(compliance_user),
    )
    assert resp.status_code == 403

    db.refresh(record)
    assert record.status != IFTIStatus.under_review


def test_submit_denied_for_other_org_record(client, db):
    other_org = _make_org(db)
    record = _make_ifti_record(
        db, other_org.id, status=IFTIStatus.approved, reviewed_by="maker"
    )

    mlro_in_another_org = _make_user(db, UserRole.mlro)

    resp = client.post(
        f"/api/v1/ifti/{record.ifti_id}/submit",
        headers=_auth(mlro_in_another_org),
    )
    assert resp.status_code == 403

    db.refresh(record)
    assert record.status != IFTIStatus.submitted


def test_review_succeeds_for_own_org_record(client, db, compliance_user):
    record = _make_ifti_record(db, compliance_user.org_id)

    resp = client.post(
        f"/api/v1/ifti/{record.ifti_id}/review",
        headers=_auth(compliance_user),
    )
    assert resp.status_code == 200, resp.text
    assert resp.json()["status"] == IFTIStatus.under_review.value
