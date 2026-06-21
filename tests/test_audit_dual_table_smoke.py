"""
Smoke test for Critical #7: GET /api/v1/audit/ only read app.models.audit
.LegacyAuditLog, silently missing every event written to the newer
app.models.audit_log.AuditLog table used by customers.py, governance,
risk_assessment, aml_solution, and customer_workflow. It now merges both.
"""

import uuid

from app.models.audit import LegacyAuditLog
from app.models.audit_log import AuditEventType, AuditLog as NewAuditLog


def test_audit_list_includes_both_legacy_and_new_tables(client, db, compliance_headers, compliance_user):
    legacy = LegacyAuditLog(
        log_id=f"LOG-{uuid.uuid4().hex[:10].upper()}",
        action="legacy_test_action",
        entity_type="customer",
        entity_id="cust_legacy_1",
        actor=compliance_user.email,
        actor_role="compliance",
        organisation_id=compliance_user.org_id,
    )
    db.add(legacy)

    new = NewAuditLog(
        org_id=compliance_user.org_id,
        actor_id=compliance_user.id,
        actor_role="compliance",
        event_type=AuditEventType.customer_created,
        action="new_test_action",
        object_type="Customer",
        object_id="cust_new_1",
    )
    db.add(new)
    db.commit()

    resp = client.get("/api/v1/audit/", headers=compliance_headers)
    assert resp.status_code == 200, resp.text
    actions = {row["action"] for row in resp.json()}
    assert "legacy_test_action" in actions
    assert "new_test_action" in actions


def test_audit_get_by_id_works_for_new_table_entry(client, db, compliance_headers, compliance_user):
    new = NewAuditLog(
        org_id=compliance_user.org_id,
        actor_id=compliance_user.id,
        actor_role="compliance",
        event_type=AuditEventType.customer_created,
        action="new_lookup_action",
        object_type="Customer",
        object_id="cust_new_2",
    )
    db.add(new)
    db.commit()
    db.refresh(new)

    resp = client.get(f"/api/v1/audit/{new.id}", headers=compliance_headers)
    assert resp.status_code == 200, resp.text
    assert resp.json()["action"] == "new_lookup_action"
