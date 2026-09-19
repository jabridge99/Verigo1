"""
Found digging into P45's "decorative Integration Hub" investigation: the
still-linked (footer nav, mobile nav, its own /connectors frontend page)
legacy Connector Marketplace's GET /connectors/ never called
get_credentials() (imported but unused) or returned anything -- the
handler body computed an unused, tautological `industry_id` and fell off
the end, returning None. FastAPI's response_model=List[ConnectorResponse]
then rejected the None with a ResponseValidationError on every single
request, regardless of whether any credentials existed.

Fixed by actually calling get_credentials(), the same helper every other
connectors.py handler already uses.
"""

import uuid

from app.models.connector import ConnectorCredential, ConnectorProvider, ConnectorStatus


def _make_credential(db, org_id, provider=ConnectorProvider.sumsub):
    cred = ConnectorCredential(
        credential_id=f"conn_{uuid.uuid4().hex[:10]}",
        industry_id=org_id,
        provider=provider,
        label="Test credential",
        encrypted_credentials="ciphertext",
        key_hint="1234",
        status=ConnectorStatus.active,
    )
    db.add(cred)
    db.commit()
    return cred


def test_list_connectors_returns_empty_list_not_500(client, admin_headers):
    resp = client.get("/api/v1/connectors/", headers=admin_headers)
    assert resp.status_code == 200, resp.text
    assert resp.json() == []


def test_list_connectors_returns_real_stored_credentials(
    client, admin_headers, admin_user, db
):
    _make_credential(db, admin_user.org_id)

    resp = client.get("/api/v1/connectors/", headers=admin_headers)
    assert resp.status_code == 200, resp.text
    body = resp.json()
    assert len(body) == 1
    assert body[0]["provider"] == "sumsub"
    assert body[0]["key_hint"] == "1234"


def test_list_connectors_filters_by_provider(client, admin_headers, admin_user, db):
    _make_credential(db, admin_user.org_id, provider=ConnectorProvider.sumsub)
    _make_credential(db, admin_user.org_id, provider=ConnectorProvider.sendgrid)

    resp = client.get("/api/v1/connectors/?provider=sendgrid", headers=admin_headers)
    assert resp.status_code == 200, resp.text
    body = resp.json()
    assert len(body) == 1
    assert body[0]["provider"] == "sendgrid"
