"""
Smoke tests for Critical #6: dismissing/reviewing an alert and submitting an
AUSTRAC report (IFTI/TTR/SMR) previously wrote zero entries to the audit
trail (LegacyAuditLog), even though both are compliance-sensitive,
state-changing actions. Both now call audit_service.log_action.
"""

import uuid
from datetime import date, datetime, timezone

from app.models.audit import LegacyAuditLog
from app.models.monitoring import (
    AlertCategory,
    AlertSeverity,
    AlertStatus,
    AlertType,
    TransactionAlert,
)
from app.models.report import ReportStatus, SMRDesignatedSvc, SMROffenceType, SMRReport, SMRSuspReason
from app.models.transaction import (
    PaymentMethod,
    Transaction,
    TransactionDirection,
    TransactionType,
)


def _make_alert(db, org_id, customer_id) -> TransactionAlert:
    txn = Transaction(
        transaction_ref=f"TXN-{uuid.uuid4().hex[:8]}",
        org_id=org_id,
        customer_id=customer_id,
        transaction_type=TransactionType.transfer,
        direction=TransactionDirection.outgoing,
        payment_method=PaymentMethod.bank_transfer,
        amount=5000.0,
        transaction_date=datetime.now(timezone.utc),
    )
    db.add(txn)
    db.commit()
    db.refresh(txn)

    alert = TransactionAlert(
        alert_ref=f"ALRT-{uuid.uuid4().hex[:8]}",
        org_id=org_id,
        transaction_id=txn.id,
        customer_id=customer_id,
        alert_type=AlertType.manual,
        category=AlertCategory.high_value,
        severity=AlertSeverity.medium,
        status=AlertStatus.generated,
        title="Smoke test alert",
    )
    db.add(alert)
    db.commit()
    db.refresh(alert)
    return alert


def test_alert_review_writes_audit_log(client, db, compliance_headers, compliance_user):
    from tests.test_reports import _create_customer

    customer_id = _create_customer(client, compliance_headers)
    alert = _make_alert(db, compliance_user.org_id, customer_id)

    before = db.query(LegacyAuditLog).filter(LegacyAuditLog.entity_id == alert.id).count()
    assert before == 0

    resp = client.post(
        f"/api/v1/alerts/{alert.id}/review",
        json={"resolution": "dismissed", "review_notes": "false positive", "is_false_positive": True},
        headers=compliance_headers,
    )
    assert resp.status_code == 200, resp.text

    logs = db.query(LegacyAuditLog).filter(LegacyAuditLog.entity_id == alert.id).all()
    assert len(logs) == 1
    assert logs[0].action == "alert_reviewed"
    assert logs[0].actor == compliance_user.email


def _make_valid_smr(db, org_id, mlro_id) -> SMRReport:
    report = SMRReport(
        report_ref=f"SMR-{uuid.uuid4().hex[:8]}",
        org_id=org_id,
        status=ReportStatus.approved,
        matter_date=date(2024, 1, 1),
        suspicion_grounds="Unusual structuring pattern detected over several weeks",
        designated_svcs=[SMRDesignatedSvc.account.value if hasattr(SMRDesignatedSvc, "account") else list(SMRDesignatedSvc)[0].value],
        susp_reason_codes=[list(SMRSuspReason)[0].value],
        offence_type=list(SMROffenceType)[0].value,
        grand_total=1000.0,
        mlro_sign_off=True,
        reporter_name="Test Reporter",
        reporter_austrac_id="AUSTRAC123",
    )
    db.add(report)
    db.commit()
    db.refresh(report)
    return report


def test_smr_submit_writes_audit_log(client, db, mlro_headers, mlro_user):
    report = _make_valid_smr(db, mlro_user.org_id, mlro_user.id)

    before = db.query(LegacyAuditLog).filter(LegacyAuditLog.entity_id == report.id).count()
    assert before == 0

    resp = client.post(
        f"/api/v1/reports/smr/{report.id}/submit",
        params={"submission_reference": "REF-001"},
        headers=mlro_headers,
    )
    assert resp.status_code == 200, resp.text

    logs = db.query(LegacyAuditLog).filter(LegacyAuditLog.entity_id == report.id).all()
    assert len(logs) == 1
    assert logs[0].action == "smr_submitted"
    assert logs[0].actor == mlro_user.email
