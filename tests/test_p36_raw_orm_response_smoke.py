"""
P36: five endpoints in risk_assessment.py have no response_model, so
FastAPI serialises their raw SQLAlchemy return value via jsonable_encoder's
vars()-based fallback. Each of them called db.refresh(x) *before* _log(),
which issues its own db.commit() -- with SQLAlchemy's default
expire_on_commit=True, that second commit expires every attribute on `x`
again. Unlike normal attribute access (item.name), which SQLAlchemy
transparently reloads via its instrumented-attribute descriptor,
vars(item)/jsonable_encoder's fallback reads __dict__ directly and never
triggers that reload -- so the response body was silently `{}` instead of
the created/updated object, on every one of these five endpoints. Routes
elsewhere in the codebase that already declare response_model=... aren't
affected (pydantic's from_attributes validation reads each field via
getattr, which does trigger the reload) -- confirmed by auditing every
route sharing the same commit/refresh/_log/return shape.

Fixed by moving refresh() to be the last DB call before return, in all
five endpoints. Each test below asserts the real field values are present
in the JSON response body, not just a 200/201 status code.
"""

import uuid
from datetime import date

from app.services.org_service import seed_permission_catalog_and_roles
from tests.conftest import _auth


def _register_and_promote(client, db, email: str) -> tuple[str, dict]:
    seed_permission_catalog_and_roles(db)
    resp = client.post(
        "/api/v1/auth/register",
        json={
            "email": email,
            "full_name": "P36 Test User",
            "password": "SecurePass123!",
        },
    )
    assert resp.status_code == 201, resp.text
    org_id = resp.json()["org_id"]

    from app.models.user import User, UserRole

    user = db.query(User).filter_by(email=email).first()
    user.role = UserRole.mlro
    db.commit()
    db.refresh(user)

    selected = client.post(
        f"/api/v1/organisations/{org_id}/select-industry",
        json={"industry_type": "banking"},
        headers=_auth(user),
    )
    assert selected.status_code == 200, selected.text
    return org_id, _auth(user)


def _get_category_id(client, headers) -> str:
    resp = client.get("/api/v1/risk/framework", headers=headers)
    assert resp.status_code == 200, resp.text
    return resp.json()["categories"][0]["id"]


def test_add_custom_factor_returns_real_fields(client, db):
    _, headers = _register_and_promote(
        client, db, f"p36-factor-{uuid.uuid4().hex[:6]}@test.com"
    )
    category_id = _get_category_id(client, headers)

    resp = client.post(
        f"/api/v1/risk/framework/categories/{category_id}/factors"
        f"?name=P36 Test Factor&description=desc&rationale=rationale",
        headers=headers,
    )
    assert resp.status_code == 200, resp.text
    body = resp.json()
    assert body != {}
    assert body["name"] == "P36 Test Factor"
    assert body["id"]
    assert body["category_id"] == category_id


def test_create_mitigation_library_item_returns_real_fields(client, db):
    _, headers = _register_and_promote(
        client, db, f"p36-mli-create-{uuid.uuid4().hex[:6]}@test.com"
    )
    name = f"P36 Mitigation {uuid.uuid4().hex[:6]}"
    resp = client.post(
        f"/api/v1/risk/mitigation-library?name={name}&category=other&control_weighting=0.2",
        headers=headers,
    )
    assert resp.status_code == 200, resp.text
    body = resp.json()
    assert body != {}
    assert body["name"] == name
    assert body["control_weighting"] == 0.2
    assert body["id"]


def test_update_mitigation_library_item_returns_real_fields(client, db):
    _, headers = _register_and_promote(
        client, db, f"p36-mli-update-{uuid.uuid4().hex[:6]}@test.com"
    )
    create_resp = client.post(
        "/api/v1/risk/mitigation-library?name=Original Name&category=other&control_weighting=0.1",
        headers=headers,
    )
    assert create_resp.status_code == 200, create_resp.text
    item_id = create_resp.json()["id"]

    resp = client.patch(
        f"/api/v1/risk/mitigation-library/{item_id}?name=Updated Name",
        headers=headers,
    )
    assert resp.status_code == 200, resp.text
    body = resp.json()
    assert body != {}
    assert body["name"] == "Updated Name"
    assert body["id"] == item_id


def test_add_and_update_mitigation_return_real_fields(client, db):
    _, headers = _register_and_promote(
        client, db, f"p36-mit-{uuid.uuid4().hex[:6]}@test.com"
    )
    run_resp = client.post(
        "/api/v1/risk/assessments"
        f"?title=P36 Test Run&assessment_date={date.today().isoformat()}",
        headers=headers,
    )
    assert run_resp.status_code == 201, run_resp.text
    run_id = run_resp.json()["id"]

    add_resp = client.post(
        f"/api/v1/risk/assessments/{run_id}/mitigations"
        "?risk_description=desc&mitigation_action=action&owner_id=owner1"
        f"&due_date={date.today().isoformat()}",
        headers=headers,
    )
    assert add_resp.status_code == 201, add_resp.text
    add_body = add_resp.json()
    assert add_body != {}
    assert add_body["risk_description"] == "desc"
    assert add_body["mitigation_action"] == "action"
    mit_id = add_body["id"]

    update_resp = client.patch(
        f"/api/v1/risk/assessments/{run_id}/mitigations/{mit_id}"
        "?status=in_progress&completion_notes=working on it",
        headers=headers,
    )
    assert update_resp.status_code == 200, update_resp.text
    update_body = update_resp.json()
    assert update_body != {}
    assert update_body["status"] == "in_progress"
    assert update_body["completion_notes"] == "working on it"
    assert update_body["id"] == mit_id
