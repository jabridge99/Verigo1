"""
Smoke test for two more cross-tenant IDOR fixes found during the Critical
#14 sweep:

1. documents.py delete_document(): the legal_hold check (HTTPException 409)
   ran against a doc fetched with no tenant filter, BEFORE the org-scope
   check that only happened inside svc.delete_document(). A non-admin user
   (e.g. mlro, who is org-scoped) could DELETE another org's document by id
   and learn from the 409-vs-404 response whether it exists and is under
   legal hold, before any tenant check occurred. Fixed by calling
   _assert_tenant() right after the doc lookup, before the legal_hold check.

2. risk_assessment.py get_score_history(): validated that run_id belonged
   to the caller's org via _get_run(), but then queried RiskScoreHistory by
   factor_score_id alone with no org filter — a compliance+ user could read
   another org's risk-factor score-change audit trail by supplying their
   own (valid) run_id alongside a guessed/enumerated factor_score_id from a
   different org. Fixed by adding RiskScoreHistory.org_id == org_id_for(...)
   to the query.
"""

import uuid
from datetime import date, datetime, timezone

from app.models.document import Document, DocumentCategory, DocumentStatus
from app.models.risk_engine import AssessmentStatus, RiskAssessmentRun, RiskScoreHistory
from tests.conftest import UserRole, _auth, _make_org, _make_user


def _make_document(db, org_id, legal_hold=True) -> Document:
    doc = Document(
        doc_id=f"doc_{uuid.uuid4().hex[:10]}",
        filename="confidential.pdf",
        stored_name=f"stored_{uuid.uuid4().hex[:10]}.pdf",
        mime_type="application/pdf",
        size_bytes=123,
        category=DocumentCategory.other,
        uploaded_by="someone",
        industry_id=org_id,
        status=DocumentStatus.active,
        legal_hold=legal_hold,
        sha256_hash=uuid.uuid4().hex,
    )
    db.add(doc)
    db.commit()
    db.refresh(doc)
    return doc


def test_delete_document_denies_cross_tenant_before_legal_hold_leak(
    client, db, compliance_user
):
    other_org = _make_org(db)
    other_doc = _make_document(db, other_org.id, legal_hold=True)

    resp = client.delete(
        f"/api/v1/documents/{other_doc.doc_id}", headers=_auth(compliance_user)
    )
    # Must be denied on tenant grounds, not leak legal-hold status via 409.
    assert resp.status_code == 403


def _make_run(db, org_id) -> RiskAssessmentRun:
    run = RiskAssessmentRun(
        framework_id=f"rf_{uuid.uuid4().hex[:10]}",
        org_id=org_id,
        title="Test Run",
        assessment_date=date.today(),
        status=AssessmentStatus.draft,
    )
    db.add(run)
    db.commit()
    db.refresh(run)
    return run


def _make_history_row(db, org_id, factor_score_id) -> RiskScoreHistory:
    row = RiskScoreHistory(
        factor_score_id=factor_score_id,
        org_id=org_id,
        assessment_id=f"rar_{uuid.uuid4().hex[:8]}",
        factor_id=f"rfact_{uuid.uuid4().hex[:8]}",
        changed_by="someone",
        changed_at=datetime.now(timezone.utc),
    )
    db.add(row)
    db.commit()
    db.refresh(row)
    return row


def test_score_history_ignores_other_org_factor_score(client, db, compliance_user):
    own_run = _make_run(db, compliance_user.org_id)

    other_org = _make_org(db)
    shared_factor_score_id = f"rfs_{uuid.uuid4().hex[:10]}"
    other_history_row = _make_history_row(db, other_org.id, shared_factor_score_id)

    resp = client.get(
        f"/api/v1/risk/assessments/{own_run.id}/factors/{shared_factor_score_id}/history",
        headers=_auth(compliance_user),
    )
    assert resp.status_code == 200, resp.text
    ids = [row["id"] for row in resp.json()]
    assert other_history_row.id not in ids
