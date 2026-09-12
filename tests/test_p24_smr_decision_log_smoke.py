"""
Smoke test for P24's SMR Internal Decision Log — the one genuinely new
table added to close the cross-cutting operational-log gap identified
across the Remittance/VASP/Legal/Real Estate/Accountants content rewrites
(TMP Alert Log and Sanctions Screening Log already existed as
TransactionAlert and ScreeningRecord; this is the one that didn't).

Covers: create -> assess (suspicion formed, SMR deadline set) -> lodge,
the clear-without-SMR path, and org-scoped tenant isolation.
"""

from app.models.smr_decision_log import SMRDecisionOutcome
from tests.conftest import _auth, _make_org


def test_create_assess_and_lodge(client, compliance_user):
    create_resp = client.post(
        "/api/v1/smr-decision-logs",
        headers=_auth(compliance_user),
        json={
            "matter_source": "staff_escalation",
            "suspicion_category": "trust_account_third_party_funds",
            "risk_matrix_ref": "PR-01",
            "description": "Unexplained third-party funds received into trust account.",
        },
    )
    assert create_resp.status_code == 201, create_resp.text
    body = create_resp.json()
    assert body["outcome"] == SMRDecisionOutcome.under_assessment.value
    assert body["suspicion_formed"] is False
    decision_id = body["id"]

    assess_resp = client.post(
        f"/api/v1/smr-decision-logs/{decision_id}/assess",
        headers=_auth(compliance_user),
        json={
            "suspicion_formed": True,
            "suspicion_type": "money_laundering",
            "is_terrorism_financing_indicator": False,
            "reasons": "Source of funds could not be established after follow-up.",
        },
    )
    assert assess_resp.status_code == 200, assess_resp.text
    assessed = assess_resp.json()
    assert assessed["suspicion_formed"] is True
    assert assessed["outcome"] == SMRDecisionOutcome.smr_to_be_lodged.value
    assert assessed["smr_deadline"] is not None

    lodge_resp = client.post(
        f"/api/v1/smr-decision-logs/{decision_id}/lodge",
        headers=_auth(compliance_user),
        json={
            "austrac_reference": "AUSTRAC-REF-12345",
            "tipping_off_check_confirmed": True,
            "director_notified": True,
        },
    )
    assert lodge_resp.status_code == 200, lodge_resp.text
    lodged = lodge_resp.json()
    assert lodged["outcome"] == SMRDecisionOutcome.smr_lodged.value
    assert lodged["austrac_reference"] == "AUSTRAC-REF-12345"
    assert lodged["director_notified"] is True


def test_lodge_requires_tipping_off_confirmation(client, compliance_user):
    create_resp = client.post(
        "/api/v1/smr-decision-logs",
        headers=_auth(compliance_user),
        json={"matter_source": "co_self_identification"},
    )
    decision_id = create_resp.json()["id"]
    client.post(
        f"/api/v1/smr-decision-logs/{decision_id}/assess",
        headers=_auth(compliance_user),
        json={"suspicion_formed": True, "reasons": "Reasoning."},
    )

    resp = client.post(
        f"/api/v1/smr-decision-logs/{decision_id}/lodge",
        headers=_auth(compliance_user),
        json={
            "austrac_reference": "AUSTRAC-REF-99999",
            "tipping_off_check_confirmed": False,
        },
    )
    assert resp.status_code == 400


def test_clear_without_smr(client, compliance_user):
    create_resp = client.post(
        "/api/v1/smr-decision-logs",
        headers=_auth(compliance_user),
        json={"matter_source": "tmp_alert", "description": "False positive on review."},
    )
    decision_id = create_resp.json()["id"]

    assess_resp = client.post(
        f"/api/v1/smr-decision-logs/{decision_id}/assess",
        headers=_auth(compliance_user),
        json={
            "suspicion_formed": False,
            "reasons": "Transaction consistent with customer's known profile.",
        },
    )
    assert assess_resp.status_code == 200
    assert assess_resp.json()["outcome"] == SMRDecisionOutcome.smr_not_lodged.value

    close_resp = client.post(
        f"/api/v1/smr-decision-logs/{decision_id}/close",
        headers=_auth(compliance_user),
        json={"outcome": "smr_not_lodged", "post_decision_notes": "Cleared, no SMR."},
    )
    assert close_resp.status_code == 200, close_resp.text


def test_decision_log_is_org_scoped(client, db, compliance_user):
    other_org = _make_org(db)
    from app.models.smr_decision_log import SMRDecisionLog, SMRMatterSource

    other_row = SMRDecisionLog(
        id="smrdl_other_org_test",
        decision_ref="SMRDL-OTHER-00001",
        org_id=other_org.id,
        matter_source=SMRMatterSource.staff_escalation,
        suspicion_formed=False,
        created_by="someone",
    )
    db.add(other_row)
    db.commit()

    resp = client.get(
        f"/api/v1/smr-decision-logs/{other_row.id}",
        headers=_auth(compliance_user),
    )
    assert resp.status_code == 404

    list_resp = client.get(
        "/api/v1/smr-decision-logs",
        headers=_auth(compliance_user),
    )
    assert list_resp.status_code == 200
    assert other_row.id not in {row["id"] for row in list_resp.json()}
