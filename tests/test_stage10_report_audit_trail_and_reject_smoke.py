"""
Stage 10 (Australian Regulatory Reporting): "Every report should maintain:
who created it, when, what information was used, what changes were made,
who approved it, submission status" -- app/api/routes/reports.py only ever
audited the final "submit" step for IFTI/TTR/SMR reports (5 log_action()
calls total across ~30 mutating endpoints). The whole maker-checker chain
Stage 10 explicitly asks to be recorded -- draft, update, review, approve/
MLRO sign-off, acknowledge, reject, redraft -- was unaudited. Fixed by
wiring every mutating endpoint into the audit trail, same pattern as
Stage 9's cases.py fix.

A second, independent bug surfaced investigating the reject/redraft flow:
redraft_ttr and redraft_smr both guard on `status == rejected`, but only
IFTI had a working /reject endpoint -- nothing could ever set a TTR or
SMR report's status to rejected, making their redraft endpoints
permanently unreachable dead code. Added POST /reports/ttr/{id}/reject
and POST /reports/smr/{id}/reject, mirroring the existing reject_ifti.
"""

import uuid

from app.models.case import Case, CaseSeverity, CaseType
from app.models.user import UserRole
from tests.conftest import _auth, _make_user


def _create_customer(client, headers, tag: str) -> str:
    resp = client.post(
        "/api/v1/customers/",
        json={
            "full_name": f"Stage 10 Customer {tag}",
            "email": f"s10-{tag}-{uuid.uuid4().hex[:6]}@example.com",
            "phone": "+61400000094",
            "date_of_birth": "1985-03-20",
            "nationality": "AU",
            "country_of_residence": "AU",
            "id_number": f"DL{uuid.uuid4().hex[:8]}",
            "id_type": "drivers_licence",
            "address": "1 Regulatory Report St, Sydney NSW 2000",
            "industry": "banking",
        },
        headers=headers,
    )
    assert resp.status_code == 201, resp.text
    return resp.json()["id"]


def _create_txn(client, headers, customer_id: str, amount: float, tag: str) -> str:
    ref = f"TXN-S10-{tag}-{uuid.uuid4().hex[:8]}"
    resp = client.post(
        "/api/v1/transactions/",
        json={
            "transaction_ref": ref,
            "reference": ref,
            "customer_id": customer_id,
            "transaction_type": "deposit",
            "direction": "incoming",
            "payment_method": "cash",
            "amount": amount,
            "currency": "AUD",
            "is_cross_border": False,
            "description": "Large cash deposit",
            "transaction_date": "2026-06-01T10:00:00",
        },
        headers=headers,
    )
    assert resp.status_code == 201, resp.text
    return resp.json()["id"]


def _same_org_users(db):
    compliance = _make_user(db, UserRole.compliance)
    mlro = _make_user(db, UserRole.mlro, industry_id=compliance.org_id)
    return compliance, _auth(compliance), mlro, _auth(mlro)


def _audit_actions(client, headers, entity_type: str, entity_id: str) -> set:
    resp = client.get(
        f"/api/v1/audit/?entity_type={entity_type}&entity_id={entity_id}",
        headers=headers,
    )
    assert resp.status_code == 200, resp.text
    return {e["action"] for e in resp.json()}


def test_ttr_lifecycle_is_fully_audited(client, db):
    compliance, compliance_headers, mlro, mlro_headers = _same_org_users(db)
    cid = _create_customer(client, compliance_headers, "ttr-audit")
    txn_id = _create_txn(client, compliance_headers, cid, 15000.00, "ttr-audit")

    drafted = client.post(
        f"/api/v1/reports/ttr/generate-from-transaction/{txn_id}",
        headers=compliance_headers,
    )
    assert drafted.status_code == 201, drafted.text
    report_id = drafted.json()["id"]

    updated = client.patch(
        f"/api/v1/reports/ttr/{report_id}",
        json={"transfer_reference": "Updated reference"},
        headers=compliance_headers,
    )
    assert updated.status_code == 200, updated.text

    reviewed = client.post(
        f"/api/v1/reports/ttr/{report_id}/review", headers=compliance_headers
    )
    assert reviewed.status_code == 200, reviewed.text

    approved = client.post(
        f"/api/v1/reports/ttr/{report_id}/approve", headers=mlro_headers
    )
    assert approved.status_code == 200, approved.text

    actions = _audit_actions(client, mlro_headers, "ttr_report", report_id)
    assert "ttr_drafted" in actions
    assert "ttr_updated" in actions
    assert "ttr_reviewed" in actions
    assert "ttr_approved" in actions


def test_ttr_reject_and_redraft_round_trip(client, db):
    """
    Before this fix, redraft_ttr's `status == rejected` guard could never
    be satisfied -- there was no way to reject a TTR at all.
    """
    compliance, compliance_headers, mlro, mlro_headers = _same_org_users(db)
    cid = _create_customer(client, compliance_headers, "ttr-reject")
    txn_id = _create_txn(client, compliance_headers, cid, 12000.00, "ttr-reject")

    drafted = client.post(
        f"/api/v1/reports/ttr/generate-from-transaction/{txn_id}",
        headers=compliance_headers,
    )
    report_id = drafted.json()["id"]

    rejected = client.post(
        f"/api/v1/reports/ttr/{report_id}/reject",
        params={"reason": "Incorrect transaction linked."},
        headers=mlro_headers,
    )
    assert rejected.status_code == 200, rejected.text
    assert rejected.json()["status"] == "rejected"

    redrafted = client.post(
        f"/api/v1/reports/ttr/{report_id}/redraft",
        headers=compliance_headers,
    )
    assert redrafted.status_code == 200, redrafted.text
    assert redrafted.json()["status"] == "draft"

    actions = _audit_actions(client, mlro_headers, "ttr_report", report_id)
    assert "ttr_rejected" in actions
    assert "ttr_redrafted" in actions


def test_smr_lifecycle_is_fully_audited(client, db):
    compliance, compliance_headers, mlro, mlro_headers = _same_org_users(db)
    cid = _create_customer(client, compliance_headers, "smr-audit")

    case = Case(
        case_ref=f"CASE-{uuid.uuid4().hex[:8]}",
        org_id=compliance.org_id,
        customer_id=cid,
        case_type=CaseType.smr_candidate,
        severity=CaseSeverity.high,
        title="Suspicious structuring pattern",
        is_smr_candidate=True,
        smr_considered=True,
        created_by=compliance.id,
    )
    db.add(case)
    db.commit()
    db.refresh(case)

    drafted = client.post(
        f"/api/v1/reports/smr/generate-from-case/{case.id}",
        params={"suspicion_grounds": "Unusual structuring pattern detected"},
        headers=mlro_headers,
    )
    assert drafted.status_code == 201, drafted.text
    report_id = drafted.json()["id"]

    reviewed = client.post(
        f"/api/v1/reports/smr/{report_id}/review", headers=compliance_headers
    )
    assert reviewed.status_code == 200, reviewed.text

    signed_off = client.post(
        f"/api/v1/reports/smr/{report_id}/mlro-sign-off", headers=mlro_headers
    )
    assert signed_off.status_code == 200, signed_off.text

    actions = _audit_actions(client, mlro_headers, "smr_report", report_id)
    assert "smr_drafted" in actions
    assert "smr_reviewed" in actions
    assert "smr_mlro_signed_off" in actions


def test_smr_reject_and_redraft_round_trip(client, db):
    """
    Same dead-code shape as TTR: redraft_smr's `status == rejected` guard
    was previously unreachable -- no endpoint could ever set it.
    """
    compliance, compliance_headers, mlro, mlro_headers = _same_org_users(db)
    cid = _create_customer(client, compliance_headers, "smr-reject")

    case = Case(
        case_ref=f"CASE-{uuid.uuid4().hex[:8]}",
        org_id=compliance.org_id,
        customer_id=cid,
        case_type=CaseType.smr_candidate,
        severity=CaseSeverity.high,
        title="Suspicious structuring pattern",
        is_smr_candidate=True,
        smr_considered=True,
        created_by=compliance.id,
    )
    db.add(case)
    db.commit()
    db.refresh(case)

    drafted = client.post(
        f"/api/v1/reports/smr/generate-from-case/{case.id}",
        params={"suspicion_grounds": "Unusual structuring pattern detected"},
        headers=mlro_headers,
    )
    report_id = drafted.json()["id"]

    rejected = client.post(
        f"/api/v1/reports/smr/{report_id}/reject",
        params={"reason": "Insufficient grounds recorded."},
        headers=mlro_headers,
    )
    assert rejected.status_code == 200, rejected.text
    assert rejected.json()["status"] == "rejected"

    redrafted = client.post(
        f"/api/v1/reports/smr/{report_id}/redraft",
        headers=compliance_headers,
    )
    assert redrafted.status_code == 200, redrafted.text
    assert redrafted.json()["status"] == "draft"

    actions = _audit_actions(client, mlro_headers, "smr_report", report_id)
    assert "smr_rejected" in actions
    assert "smr_redrafted" in actions
