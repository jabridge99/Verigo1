"""
Parking lot P21, fixed: DPMS (Dealers in Precious Metals & Stones -- both
IndustryType.bullion_dealers and IndustryType.precious_metals) used to map
to the generic "other" AML template. That template's ttr_procedures says
the organisation does not accept physical currency and any cash offered
must be declined -- factually backwards for DPMS, whose own first
monitoring rule (DPMS-01, from the real VERIGO DPMS TMP Guideline) is built
entirely around DPMS routinely accepting large cash transactions
(cash >= AUD $10,000 triggers mandatory CDD and TTR, not refusal).

An org onboarded as DPMS under the old mapping got a Program that actively
told it to refuse the cash transactions its own designated service exists
to handle -- undermining, not supporting, real AML/CTF compliance
capability. Fixed by adding a dedicated dpms.py template with the correct
cash/TTR procedure and the sector's own concrete monitoring thresholds.
"""

from app.models.aml_solution import AMLProgram, AMLSolution
from app.services.org_service import seed_permission_catalog_and_roles
from tests.conftest import _auth


def _register_and_select(client, db, email: str, industry_type: str) -> str:
    seed_permission_catalog_and_roles(db)
    resp = client.post(
        "/api/v1/auth/register",
        json={"email": email, "full_name": "DPMS Owner", "password": "SecurePass123!"},
    )
    assert resp.status_code == 201, resp.text
    org_id = resp.json()["org_id"]

    from app.models.user import User

    user = db.query(User).filter_by(email=email).first()
    headers = _auth(user)

    selected = client.post(
        f"/api/v1/organisations/{org_id}/select-industry",
        json={"industry_type": industry_type},
        headers=headers,
    )
    assert selected.status_code == 200, selected.text
    return org_id


def test_precious_metals_ttr_procedures_require_cash_reporting_not_refusal(client, db):
    org_id = _register_and_select(
        client, db, "dpms_precious_metals@test.com", "precious_metals"
    )

    solution = db.query(AMLSolution).filter_by(org_id=org_id).first()
    assert solution.template_industry == "precious_metals"

    program = db.query(AMLProgram).filter_by(org_id=org_id).first()
    ttr = program.ttr_procedures

    # The bug: the old "other" fallback said cash must be declined and TTR
    # doesn't apply. Neither claim may appear anywhere in the real text.
    assert "must be declined" not in ttr
    assert "does not accept physical currency" not in ttr

    # The fix: DPMS-01's actual rule -- cash >= $10,000 triggers CDD/TTR.
    assert "$10,000" in ttr
    assert "DPMS-01" in ttr


def test_bullion_dealers_gets_the_same_dpms_template(client, db):
    org_id = _register_and_select(
        client, db, "dpms_bullion@test.com", "bullion_dealers"
    )

    solution = db.query(AMLSolution).filter_by(org_id=org_id).first()
    assert solution.template_industry == "bullion_dealers"

    program = db.query(AMLProgram).filter_by(org_id=org_id).first()
    assert "must be declined" not in program.ttr_procedures
    assert "$10,000" in program.ttr_procedures
    assert "sanctioned" in program.ttr_procedures.lower()
