"""
Customers — aggregated read-only workspace and synthesized timeline views.
Part of the customers route package; see __init__.py for the combined
router.
"""

from typing import List

from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

from app.api.deps import org_id_for, require_analyst_or_above
from app.db.database import get_db
from app.models.audit_log import AuditLog
from app.models.case import Case
from app.models.customer import (
    BeneficialOwner,
    CorporateDocument,
    CustomerNote,
    CustomerOnboardingChecklist,
    CustomerReview,
    CustomerRiskScoreHistory,
)
from app.models.document import Document
from app.models.marketplace import VerificationOrder
from app.models.risk_matrix import (
    CustomerQuestionResponse,
    OrgApprovalQuestion,
    QuestionContext,
)
from app.models.screening import ScreeningAlert, ScreeningRecord
from app.models.transaction import Transaction
from app.models.user import User
from app.services.risk_matrix_service import compute_question_score

from ._shared import _get_customer

router = APIRouter()

DISCLAIMER = (
    "All CDD/EDD assessments, risk ratings, and compliance decisions "
    "remain the responsibility of the reporting entity."
)


def _customer_checklist_summary(customer_id: str, org_id: str, db: Session) -> dict:
    questions = (
        db.query(OrgApprovalQuestion)
        .filter(
            OrgApprovalQuestion.org_id == org_id,
            OrgApprovalQuestion.is_active == True,
            OrgApprovalQuestion.context == QuestionContext.customer,
        )
        .all()
    )
    responses = (
        db.query(CustomerQuestionResponse)
        .filter(CustomerQuestionResponse.customer_id == customer_id)
        .all()
    )
    response_map = {r.question_id: r for r in responses}
    answered_required = [
        q for q in questions if q.is_required and response_map.get(q.id) is not None
    ]
    required = [q for q in questions if q.is_required]
    return {
        "questions_configured": len(questions),
        "questions_answered": len(responses),
        "complete": len(questions) > 0 and len(answered_required) == len(required),
        "question_score": compute_question_score(responses) if responses else None,
    }


# ── Customer Workspace (aggregated, read-only) ─────────────────────────────────
# A single call that assembles everything an officer needs for one customer —
# avoids forcing the UI to fan out across a dozen endpoints to render one screen.
# All data here already exists via the per-resource endpoints above; this is a
# read-only join, not a new source of truth.


@router.get("/{customer_id}/workspace")
def get_customer_workspace(
    customer_id: str,
    current_user: User = Depends(require_analyst_or_above),
    db: Session = Depends(get_db),
):
    customer = _get_customer(customer_id, org_id_for(current_user), db)
    can_see_confidential = current_user.role.value in ("admin", "mlro")

    business_detail = customer.business_detail if customer.business_detail_id else None

    beneficial_owners = (
        db.query(BeneficialOwner)
        .filter(BeneficialOwner.customer_id == customer_id)
        .order_by(BeneficialOwner.created_at)
        .all()
    )

    documents = (
        db.query(Document)
        .filter(Document.entity_type == "customer", Document.entity_id == customer_id)
        .order_by(Document.created_at.desc())
        .all()
    )
    corporate_documents = (
        db.query(CorporateDocument)
        .filter(CorporateDocument.customer_id == customer_id)
        .order_by(CorporateDocument.created_at.desc())
        .all()
    )

    screenings = (
        db.query(ScreeningRecord)
        .filter(ScreeningRecord.customer_id == customer_id)
        .order_by(ScreeningRecord.screened_at.desc())
        .all()
    )
    latest_screening_by_type = {}
    for s in screenings:
        if s.screening_type not in latest_screening_by_type:
            latest_screening_by_type[s.screening_type.value] = s
    open_alerts = (
        db.query(ScreeningAlert)
        .filter(
            ScreeningAlert.customer_id == customer_id,
            ScreeningAlert.status.notin_(["dismissed", "closed"]),
        )
        .order_by(ScreeningAlert.created_at.desc())
        .all()
    )

    checklist = (
        db.query(CustomerOnboardingChecklist)
        .filter(CustomerOnboardingChecklist.customer_id == customer_id)
        .first()
    )

    risk_history = (
        db.query(CustomerRiskScoreHistory)
        .filter(CustomerRiskScoreHistory.customer_id == customer_id)
        .order_by(CustomerRiskScoreHistory.scored_at.desc())
        .limit(10)
        .all()
    )

    reviews = (
        db.query(CustomerReview)
        .filter(CustomerReview.customer_id == customer_id)
        .order_by(CustomerReview.review_date.desc())
        .all()
    )

    notes_q = db.query(CustomerNote).filter(CustomerNote.customer_id == customer_id)
    if not can_see_confidential:
        notes_q = notes_q.filter(CustomerNote.is_confidential == False)
    notes = notes_q.order_by(CustomerNote.created_at.desc()).all()

    cases = (
        db.query(Case)
        .filter(Case.customer_id == customer_id)
        .order_by(Case.created_at.desc())
        .all()
    )

    transactions = (
        db.query(Transaction)
        .filter(Transaction.customer_id == customer_id)
        .order_by(Transaction.created_at.desc())
        .limit(25)
        .all()
    )
    txn_count = (
        db.query(Transaction).filter(Transaction.customer_id == customer_id).count()
    )
    txn_volume = sum(t.amount_aud or t.amount or 0.0 for t in transactions)

    return {
        "customer": customer,
        "business_detail": business_detail,
        "beneficial_owners": beneficial_owners,
        "documents": documents,
        "corporate_documents": corporate_documents,
        "screening": {
            "records": screenings,
            "latest_by_type": {
                k: {
                    "status": v.status.value,
                    "screened_at": v.screened_at,
                    "provider": v.provider.value if v.provider else None,
                }
                for k, v in latest_screening_by_type.items()
            },
            "open_alerts": open_alerts,
        },
        "onboarding_checklist": checklist,
        "risk": {
            "risk_score": customer.risk_score,
            "risk_level": customer.risk_level.value if customer.risk_level else None,
            "inherent_score": risk_history[0].inherent_score if risk_history else None,
            "residual_score": risk_history[0].residual_score if risk_history else None,
            "control_effectiveness_score": (
                risk_history[0].control_effectiveness_score if risk_history else None
            ),
            "trend": [
                {
                    "scored_at": h.scored_at,
                    "risk_score": h.risk_score,
                    "risk_level": h.risk_level.value if h.risk_level else None,
                }
                for h in reversed(risk_history)
            ],
            "history": risk_history,
        },
        "verification": {
            "orders": [
                {
                    "id": o.id,
                    "provider_id": o.provider_id,
                    "status": o.status.value,
                    "evidence_url": o.evidence_url,
                    "reviewed_by": o.reviewed_by,
                    "created_at": o.created_at,
                    "completed_at": o.completed_at,
                }
                for o in db.query(VerificationOrder)
                .filter(
                    VerificationOrder.entity_type == "customer",
                    VerificationOrder.entity_id == customer_id,
                )
                .order_by(VerificationOrder.created_at.desc())
                .all()
            ],
        },
        "checklist_completion": _customer_checklist_summary(
            customer_id, customer.org_id, db
        ),
        "sof_sow": {
            "source_of_funds": customer.source_of_funds,
            "source_of_funds_verified": customer.source_of_funds_verified,
            "source_of_wealth": customer.source_of_wealth,
            "source_of_wealth_verified": customer.source_of_wealth_verified,
        },
        "cdd": {
            "cdd_level": customer.cdd_level.value if customer.cdd_level else None,
            "last_reviewed_date": customer.last_reviewed_date,
            "last_reviewed_by": customer.last_reviewed_by,
            "next_review_date": customer.next_review_date,
        },
        "reviews": reviews,
        "notes": notes,
        "cases": {
            "open": [
                c
                for c in cases
                if c.status.value
                not in ("closed_no_action", "closed_smr_filed", "closed_no_smr")
            ],
            "closed": [
                c
                for c in cases
                if c.status.value
                in ("closed_no_action", "closed_smr_filed", "closed_no_smr")
            ],
            "escalated": [c for c in cases if c.escalated_to],
            "smr_linked": [c for c in cases if c.smr_lodged or c.is_smr_candidate],
        },
        "transactions": {
            "recent": transactions,
            "total_count": txn_count,
            "recent_volume_aud": txn_volume,
        },
        "assigned_officer": customer.relationship_manager,
        "disclaimer": DISCLAIMER,
    }


# ── Customer Timeline (synthesized, read-only) ─────────────────────────────────
# Chronological feed assembled from existing audit/case/transaction/review/
# screening records — there is no separate "timeline" table to keep in sync.


@router.get("/{customer_id}/timeline")
def get_customer_timeline(
    customer_id: str,
    limit: int = Query(200, le=500),
    current_user: User = Depends(require_analyst_or_above),
    db: Session = Depends(get_db),
):
    customer = _get_customer(customer_id, org_id_for(current_user), db)
    events: List[dict] = []

    events.append(
        {
            "type": "customer_created",
            "label": "Customer created",
            "at": customer.created_at,
            "actor": customer.onboarded_by,
        }
    )

    audit_rows = (
        db.query(AuditLog)
        .filter(
            AuditLog.org_id == customer.org_id,
            AuditLog.object_type == "Customer",
            AuditLog.object_id == customer_id,
        )
        .order_by(AuditLog.created_at.desc())
        .limit(limit)
        .all()
    )
    for a in audit_rows:
        events.append(
            {
                "type": a.event_type.value,
                "label": a.action,
                "at": a.created_at,
                "actor": a.actor_id,
                "detail": a.new_value,
            }
        )

    for r in db.query(CustomerReview).filter(CustomerReview.customer_id == customer_id):
        events.append(
            {
                "type": "review",
                "label": f"{r.review_type or 'Periodic'} review completed",
                "at": r.review_date,
                "actor": r.reviewed_by,
            }
        )

    for c in db.query(Case).filter(Case.customer_id == customer_id):
        events.append(
            {
                "type": "case",
                "label": f"Case {c.case_ref} ({c.case_type.value}) — {c.status.value}",
                "at": c.created_at,
                "actor": c.created_by,
            }
        )

    for s in (
        db.query(ScreeningRecord)
        .filter(ScreeningRecord.customer_id == customer_id)
        .order_by(ScreeningRecord.screened_at.desc())
        .limit(50)
    ):
        events.append(
            {
                "type": "screening",
                "label": f"{s.screening_type.value} screening — {s.status.value}",
                "at": s.screened_at,
                "actor": s.triggered_by,
            }
        )

    txn_count = (
        db.query(Transaction).filter(Transaction.customer_id == customer_id).count()
    )
    for t in (
        db.query(Transaction)
        .filter(Transaction.customer_id == customer_id)
        .order_by(Transaction.created_at.desc())
        .limit(50)
    ):
        events.append(
            {
                "type": "transaction",
                "label": f"Transaction {t.direction.value} {t.amount} — risk {t.risk_score}",
                "at": t.created_at,
            }
        )

    events = [e for e in events if e["at"] is not None]
    events.sort(key=lambda e: e["at"], reverse=True)
    return {
        "customer_id": customer_id,
        "total_events": len(events),
        "transaction_count": txn_count,
        "events": events[:limit],
    }
