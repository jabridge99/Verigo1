"""
Smoke test for a confirmed crash across the entire IFTI-E module
(app/api/routes/ifti_e.py -- AUSTRAC IFTI-E electronic funds transfer
reporting): every route used `current_user.organisation_id`, which does
not exist on User at all (the real fields are `org_id`/`industry_id`,
or the newer `primary_organisation_id` -- confirmed via mypy's own
suggestion once the SQLAlchemy mypy plugin was enabled, which is what
surfaced this). Every one of this module's 9 endpoints raised
AttributeError on every call -- this reporting module has never worked.

Fixed to current_user.org_id, matching get_ifti_e()/list_ifti_e()'s own
`org_id` parameter (filtered against IFTIERecord.industry_id) -- the
dominant tenant-scoping convention used everywhere else in this
codebase, not the newer/separate primary_organisation_id concept.
"""

from tests.conftest import _auth


def test_list_ifti_e_records_does_not_500(client, admin_user):
    resp = client.get("/api/v1/ifti-e", headers=_auth(admin_user))
    assert resp.status_code == 200


def test_create_ifti_e_record_does_not_500(client, admin_user):
    resp = client.post(
        "/api/v1/ifti-e",
        headers=_auth(admin_user),
        json={
            "direction": "outgoing",
            "mode": "swift",
            "date_received": "01/01/2026",
            "date_available": "01/01/2026",
            "total_amount": 5000.0,
            "swift_msg": "MT103 test message",
        },
    )
    assert resp.status_code == 201
    body = resp.json()
    assert body["ifti_e_id"].startswith("IFTIE-")
