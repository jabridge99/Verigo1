"""
Smoke test for a confirmed crash in
app/services/program_retention_service.py's request_old_version():
when settings.master_admin_email is configured, it called
org.org_id -- Organisation has no such attribute (its PK is `id`,
confirmed via mypy once the SQLAlchemy plugin was enabled). Every
lapsed-customer request for an archived AML program version would
raise AttributeError while trying to alert the admin.
"""

from app.models.aml_program import AMLProgramRecord, AMLProgramVersion
from app.services.program_retention_service import request_old_version


def test_request_old_version_does_not_crash_sending_admin_alert(db, admin_user, monkeypatch):
    from app.config import settings

    monkeypatch.setattr(settings, "master_admin_email", "ops@example.com")

    program = AMLProgramRecord(
        program_id="PROG-TEST-0001",
        organisation_id=admin_user.org_id,
        industry_id=admin_user.org_id,
        risk_profile="medium",
        version=2,
    )
    db.add(program)
    db.commit()
    db.refresh(program)

    old_version = AMLProgramVersion(
        program_id=program.id,
        organisation_id=admin_user.org_id,
        version=1,
        industry_id=admin_user.org_id,
        risk_profile="medium",
        items_snapshot=[],
        item_count=0,
        content_hash="abc123",
        qr_token="qr-test-0001",
    )
    db.add(old_version)
    db.commit()

    from app.models.organisation import Organisation

    org = db.query(Organisation).filter(Organisation.id == admin_user.org_id).first()

    result = request_old_version(db, org, program, version=1, requested_by=admin_user.id)
    assert result.id == old_version.id
