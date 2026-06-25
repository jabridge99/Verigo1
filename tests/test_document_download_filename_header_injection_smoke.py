"""
Smoke test: GET /documents/{id}/download interpolated the client-supplied
filename unescaped into a quoted Content-Disposition header value. A
filename containing a double-quote could break out of the quoted string and
inject extra Content-Disposition parameters (e.g. spoofing the filename a
browser displays/saves as). Fixed by stripping quotes/backslashes from the
ASCII fallback name and RFC 5987-encoding the real filename.
"""

from app.models.user import UserRole
from tests.conftest import _auth, _make_user


def test_download_filename_with_quote_does_not_break_out_of_header(client, db):
    user = _make_user(db, UserRole.analyst, industry_id="IND-DOC-INJ")
    headers = _auth(user)

    malicious_name = 'evil.pdf"; filename="trusted.pdf'
    res = client.post(
        "/api/v1/documents",
        files={"file": (malicious_name, b"%PDF-1.4 test", "application/pdf")},
        data={"category": "other"},
        headers=headers,
    )
    assert res.status_code == 201, res.text
    doc_id = res.json()["doc_id"]

    res = client.get(f"/api/v1/documents/{doc_id}/download", headers=headers)
    assert res.status_code == 200

    cd = res.headers["content-disposition"]
    # The malicious filename's embedded quote must not let it break out of
    # the quoted ASCII filename param — there must be exactly one quoted
    # value (the opening/closing pair), with no extra "filename=" parameter
    # smuggled in via the injected quote.
    ascii_param = cd.split("filename*=")[0]
    assert ascii_param.count('"') == 2
