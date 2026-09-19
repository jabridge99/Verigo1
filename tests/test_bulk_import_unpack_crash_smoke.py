"""
Smoke test for a confirmed crash in app/api/routes/onboarding.py:
import_csv()/import_excel() did `rows, warnings = parse_csv(content)`, a
2-value unpack, but app/services/bulk_import.py's parse_csv()/parse_excel()
both return a 3-tuple `(rows, warnings, errors)` (their own docstrings say
so). Every call to POST /onboarding/import/csv or /import/excel raised
`ValueError: too many values to unpack` -- the CSV/Excel bulk customer
onboarding import feature has never worked.
"""

import io

from tests.conftest import _auth


def _give_primary_org(db, user):
    # create_session() stamps Customer.org_id from
    # scope_fields(user)["organisation_id"] (== user.primary_organisation_id),
    # which a real registered admin has (app/services/org_service.py sets it
    # during POST /auth/register) but the raw _make_user() test fixture does
    # not -- set it explicitly so this test reflects a real registered user.
    user.primary_organisation_id = user.org_id
    db.commit()


def test_import_csv_does_not_500(client, db, admin_user):
    _give_primary_org(db, admin_user)
    csv_bytes = b"full_name,email\nJane Doe,jane@example.com\n"
    resp = client.post(
        "/api/v1/onboarding/import/csv",
        headers=_auth(admin_user),
        files={"file": ("customers.csv", io.BytesIO(csv_bytes), "text/csv")},
    )
    assert resp.status_code == 201
    body = resp.json()
    assert body["success_rows"] == 1
    assert body["error_rows"] == 0


def test_import_csv_surfaces_parse_level_row_errors(client, db, admin_user):
    # Missing both full_name and email (phone alone isn't enough) -- fails
    # _validate_row() inside parse_csv(), before bulk_create_sessions() is
    # ever called, so this failure must be merged into the batch's own
    # error list to be visible to the caller at all.
    _give_primary_org(db, admin_user)
    csv_bytes = b"full_name,email,phone\n,,0400000000\n"
    resp = client.post(
        "/api/v1/onboarding/import/csv",
        headers=_auth(admin_user),
        files={"file": ("customers.csv", io.BytesIO(csv_bytes), "text/csv")},
    )
    assert resp.status_code == 201
    body = resp.json()
    assert body["error_rows"] == 1
    assert body["errors"]
