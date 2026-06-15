"""
Transaction API — bank-grade AML/CTF transaction register.

Roles:
  POST /transactions — analyst+
  GET  /transactions — analyst+
  GET  /transactions/{id} — analyst+
  PATCH /transactions/{id} — compliance+
  POST /transactions/{id}/run-monitoring — compliance+
  GET  /transactions/{id}/receipt — analyst+  (full receipt for reporting)
  GET  /transactions/{id}/summary — analyst+  (lightweight summary)
"""
from datetime import datetime, timezone
from typing import Optional
from uuid import uuid4

from fastapi import APIRouter, Depends, HTTPException, Query, status
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app.api.deps import (
    Pagination,
    get_current_user,
    org_id_for,
    require_analyst_or_above,
    require_compliance_or_above,
)
from app.db.database import get_db
from app.models.case import Case, CaseAlert
from app.models.customer import Customer
from app.models.monitoring import TransactionAlert
from app.models.transaction import (
    Transaction,
    TransactionCryptoDetail,
    TransactionStatus,
)
from app.models.user import User
from app.schemas.transaction import (
    TransactionCreate,
    TransactionListOut,
    TransactionOut,
    TransactionUpdate,
)
from app.models.regulatory_recommendation import RegulatoryRecommendation, RecommendationStatus
from app.models.risk_matrix import OrgApprovalQuestion, OrgMonitoringConfig, QuestionAnswer, TransactionQuestionResponse
from app.schemas.transaction_receipt import TransactionReceipt, build_receipt
from app.services.monitoring_engine import run_monitoring
from app.services.risk_matrix_service import compute_final_approval_score, compute_question_score

router = APIRouter(prefix="/transactions", tags=["Transactions"])


def _get_transaction_or_404(txn_id: str, org_id: str, db: Session) -> Transaction:
    txn = db.query(Transaction).filter(
        Transaction.id == txn_id,
        Transaction.org_id == org_id,
    ).first()
    if not txn:
        raise HTTPException(status_code=404, detail="Transaction not found.")
    return txn


@router.post("", response_model=TransactionOut, status_code=status.HTTP_201_CREATED)
def create_transaction(
    payload: TransactionCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_analyst_or_above),
):
    """Record a new transaction. Risk scoring and monitoring are handled separately."""
    org_id = org_id_for(current_user)

    # Verify customer belongs to org
    customer = db.query(Customer).filter(
        Customer.id == payload.customer_id,
        Customer.org_id == org_id,
    ).first()
    if not customer:
        raise HTTPException(status_code=404, detail="Customer not found.")

    # Check for duplicate ref
    existing = db.query(Transaction).filter(
        Transaction.transaction_ref == payload.transaction_ref,
        Transaction.org_id == org_id,
    ).first()
    if existing:
        raise HTTPException(status_code=409, detail="Transaction reference already exists.")

    txn = Transaction(
        id=f"txn_{uuid4().hex[:12]}",
        org_id=org_id,
        created_by=current_user.id,
        **payload.model_dump(exclude={"crypto_detail"}),
    )
    db.add(txn)

    if payload.crypto_detail:
        crypto = TransactionCryptoDetail(
            id=f"cdet_{uuid4().hex[:10]}",
            transaction_id=txn.id,
            org_id=org_id,
            **payload.crypto_detail.model_dump(),
        )
        db.add(crypto)

    db.commit()
    db.refresh(txn)
    return txn


@router.get("", response_model=list[TransactionListOut])
def list_transactions(
    customer_id: Optional[str] = Query(None),
    status: Optional[TransactionStatus] = Query(None),
    is_cross_border: Optional[bool] = Query(None),
    min_amount_aud: Optional[float] = Query(None),
    from_date: Optional[datetime] = Query(None),
    to_date: Optional[datetime] = Query(None),
    pagination: Pagination = Depends(),
    db: Session = Depends(get_db),
    current_user: User = Depends(require_analyst_or_above),
):
    org_id = org_id_for(current_user)
    q = db.query(Transaction).filter(Transaction.org_id == org_id)

    if customer_id:
        q = q.filter(Transaction.customer_id == customer_id)
    if status:
        q = q.filter(Transaction.status == status)
    if is_cross_border is not None:
        q = q.filter(Transaction.is_cross_border == is_cross_border)
    if min_amount_aud is not None:
        q = q.filter(Transaction.amount_aud >= min_amount_aud)
    if from_date:
        q = q.filter(Transaction.transaction_date >= from_date)
    if to_date:
        q = q.filter(Transaction.transaction_date <= to_date)

    q = q.order_by(Transaction.transaction_date.desc())
    return pagination.apply(q).all()


@router.get("/{txn_id}", response_model=TransactionOut)
def get_transaction(
    txn_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_analyst_or_above),
):
    return _get_transaction_or_404(txn_id, org_id_for(current_user), db)


@router.patch("/{txn_id}", response_model=TransactionOut)
def update_transaction(
    txn_id: str,
    payload: TransactionUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_compliance_or_above),
):
    """Update non-risk fields. Risk fields are engine-only and cannot be patched."""
    txn = _get_transaction_or_404(txn_id, org_id_for(current_user), db)

    if txn.status == TransactionStatus.completed:
        raise HTTPException(
            status_code=409,
            detail="Completed transactions are immutable.",
        )

    for k, v in payload.model_dump(exclude_none=True).items():
        setattr(txn, k, v)

    txn.updated_at = datetime.now(timezone.utc)
    db.commit()
    db.refresh(txn)
    return txn


@router.post("/{txn_id}/run-monitoring", status_code=status.HTTP_200_OK)
def run_monitoring_on_transaction(
    txn_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_compliance_or_above),
):
    """
    Manually trigger the monitoring engine against a specific transaction.
    This is automatically triggered on transaction creation in production;
    this endpoint supports re-evaluation and backfill use cases.

    DISCLAIMER: Alerts generated are indicators for human review only.
    """
    org_id = org_id_for(current_user)
    txn = _get_transaction_or_404(txn_id, org_id, db)

    customer = db.query(Customer).filter(
        Customer.id == txn.customer_id,
        Customer.org_id == org_id,
    ).first()
    if not customer:
        raise HTTPException(status_code=404, detail="Customer not found.")

    alerts = run_monitoring(txn, customer, db)
    db.commit()

    return {
        "transaction_id": txn_id,
        "alerts_generated": len(alerts),
        "alert_ids": [a.id for a in alerts],
        "disclaimer": (
            "Alerts are generated for human review only. "
            "No alert constitutes a finding of suspicious activity or criminal conduct."
        ),
    }


@router.get("/{txn_id}/receipt", response_model=TransactionReceipt)
def get_transaction_receipt(
    txn_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_analyst_or_above),
):
    """
    Full transaction receipt — includes all AML flags, linked alerts, linked cases,
    crypto screening detail, customer snapshot, and the AUSTRAC reporting block.

    Use this endpoint to:
    - Print or export a transaction record for compliance files
    - Pre-populate AUSTRAC report forms (TTR, IFTI, SMR supplementary)
    - Attach to case files as evidence

    DISCLAIMER: This receipt is a structured compliance workflow document.
    It does not constitute a report to AUSTRAC or any regulator.
    """
    org_id = org_id_for(current_user)
    txn = _get_transaction_or_404(txn_id, org_id, db)

    customer = db.query(Customer).filter(
        Customer.id == txn.customer_id,
        Customer.org_id == org_id,
    ).first()
    if not customer:
        raise HTTPException(status_code=404, detail="Customer not found.")

    # Load all alerts linked to this transaction
    alerts = db.query(TransactionAlert).filter(
        TransactionAlert.transaction_id == txn_id,
        TransactionAlert.org_id == org_id,
    ).order_by(TransactionAlert.trigger_date.desc()).all()

    # Load all cases linked via CaseAlert
    case_ids = db.query(CaseAlert.case_id).filter(
        CaseAlert.transaction_id == txn_id,
    ).distinct().all()
    case_ids_list = [r[0] for r in case_ids]

    # Also get cases linked via alert
    alert_ids = [a.id for a in alerts]
    if alert_ids:
        alert_case_ids = db.query(CaseAlert.case_id).filter(
            CaseAlert.alert_id.in_(alert_ids),
        ).distinct().all()
        case_ids_list = list(set(case_ids_list + [r[0] for r in alert_case_ids]))

    cases = []
    if case_ids_list:
        cases = db.query(Case).filter(
            Case.id.in_(case_ids_list),
            Case.org_id == org_id,
        ).all()

    return build_receipt(txn, customer, alerts, cases, generated_by=current_user.id)


@router.get("/{txn_id}/summary")
def get_transaction_summary(
    txn_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_analyst_or_above),
):
    """
    Lightweight transaction summary — key fields, AML flags, and alert/case counts.
    Suitable for display in dashboards and list views.
    """
    org_id = org_id_for(current_user)
    txn = _get_transaction_or_404(txn_id, org_id, db)

    alert_count = db.query(TransactionAlert).filter(
        TransactionAlert.transaction_id == txn_id,
        TransactionAlert.org_id == org_id,
    ).count()

    open_alert_count = db.query(TransactionAlert).filter(
        TransactionAlert.transaction_id == txn_id,
        TransactionAlert.org_id == org_id,
        TransactionAlert.status.notin_(["dismissed", "resolved"]),
    ).count()

    smr_candidate_count = db.query(TransactionAlert).filter(
        TransactionAlert.transaction_id == txn_id,
        TransactionAlert.org_id == org_id,
        TransactionAlert.is_smr_candidate == True,
    ).count()

    amount_aud = txn.amount_aud or txn.amount
    TTR_THRESHOLD = 10_000.0

    return {
        "transaction_id": txn.id,
        "transaction_ref": txn.transaction_ref,
        "transaction_date": txn.transaction_date,
        "transaction_type": txn.transaction_type.value,
        "direction": txn.direction.value,
        "payment_method": txn.payment_method.value,
        "status": txn.status.value,
        "currency": txn.currency,
        "amount": txn.amount,
        "amount_aud": amount_aud,
        "is_cross_border": txn.is_cross_border,
        "source_country": txn.source_country,
        "destination_country": txn.destination_country,
        "counterparty_name": txn.counterparty_name,
        "aml_flags": {
            "is_near_threshold": txn.is_near_threshold,
            "is_round_number": txn.is_round_number,
            "is_structuring_suspect": txn.is_structuring_suspect,
            "is_cash_intensive": txn.is_cash_intensive,
            "is_ttr_reportable": amount_aud >= TTR_THRESHOLD,
            "is_ifti_reportable": txn.is_cross_border,
        },
        "risk_score": txn.risk_score,
        "behaviour_score": txn.behaviour_score,
        "alert_count": alert_count,
        "open_alert_count": open_alert_count,
        "smr_candidate_count": smr_candidate_count,
        "customer_id": txn.customer_id,
        "disclaimer": (
            "This summary is for compliance workflow support only. "
            "It does not constitute a report to AUSTRAC or any regulator."
        ),
    }


@router.get("/{txn_id}/recommendations")
def get_transaction_recommendations(
    txn_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_analyst_or_above),
):
    """
    Regulatory decision support recommendations for this transaction.
    Generated automatically after monitoring runs — surfaces what the compliance
    officer should consider next based on transaction signals, customer risk,
    and alert outputs.

    DISCLAIMER: Recommendations are compliance workflow guidance only.
    The reporting entity bears sole responsibility for all regulatory decisions.
    """
    org_id = org_id_for(current_user)
    _get_transaction_or_404(txn_id, org_id, db)  # 404 if not found or wrong org

    recs = (
        db.query(RegulatoryRecommendation)
        .filter(
            RegulatoryRecommendation.transaction_id == txn_id,
            RegulatoryRecommendation.org_id == org_id,
        )
        .order_by(RegulatoryRecommendation.created_at.desc())
        .all()
    )

    return {
        "transaction_id": txn_id,
        "recommendation_count": len(recs),
        "pending_count": sum(1 for r in recs if r.status == RecommendationStatus.pending),
        "recommendations": [
            {
                "id": r.id,
                "recommendation_type": r.recommendation_type.value,
                "priority": r.priority.value,
                "status": r.status.value,
                "title": r.title,
                "recommendation_text": r.recommendation_text,
                "regulatory_basis": r.regulatory_basis,
                "rationale": r.rationale,
                "alert_id": r.alert_id,
                "actioned_by": r.actioned_by,
                "actioned_at": r.actioned_at,
                "created_at": r.created_at,
            }
            for r in recs
        ],
        "disclaimer": (
            "Recommendations are compliance workflow guidance only. "
            "The reporting entity bears sole responsibility for all regulatory decisions."
        ),
    }


# ── Pre-Approval Question Checklist ───────────────────────────────────────────

class QuestionAnswerItem(BaseModel):
    question_id: str
    answer: QuestionAnswer
    notes: Optional[str] = None


class AnswerQuestionsRequest(BaseModel):
    answers: list[QuestionAnswerItem]


@router.get("/{txn_id}/approval-checklist")
def get_approval_checklist(
    txn_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_compliance_or_above),
):
    """
    Return the org's pre-approval checklist questions and any existing answers
    for this transaction, plus the computed final approval score.

    The checklist is answered before approving/resolving a transaction.
    The question_score contributes custom_question_weight % of the final score.

    DISCLAIMER: Approval scores support the compliance workflow only.
    All regulatory decisions remain with the reporting entity.
    """
    org_id = org_id_for(current_user)
    txn = _get_transaction_or_404(txn_id, org_id, db)

    questions = (
        db.query(OrgApprovalQuestion)
        .filter(
            OrgApprovalQuestion.org_id == org_id,
            OrgApprovalQuestion.is_active == True,
        )
        .order_by(OrgApprovalQuestion.question_order)
        .all()
    )

    responses = (
        db.query(TransactionQuestionResponse)
        .filter(
            TransactionQuestionResponse.transaction_id == txn_id,
            TransactionQuestionResponse.org_id == org_id,
        )
        .all()
    )
    response_map = {r.question_id: r for r in responses}

    config = db.query(OrgMonitoringConfig).filter(
        OrgMonitoringConfig.org_id == org_id
    ).first()
    q_weight = getattr(config, "custom_question_weight", 0.20) if config else 0.20

    # Get the latest alert score for this transaction
    from app.models.monitoring import TransactionAlert, AlertStatus
    latest_alert = (
        db.query(TransactionAlert)
        .filter(
            TransactionAlert.transaction_id == txn_id,
            TransactionAlert.org_id == org_id,
        )
        .order_by(TransactionAlert.trigger_date.desc())
        .first()
    )
    base_alert_score = (latest_alert.alert_score if latest_alert else 0.0) or 0.0
    risk_matrix_score = getattr(latest_alert, "risk_matrix_score", None) if latest_alert else None
    risk_matrix_level = getattr(latest_alert, "risk_matrix_level", None) if latest_alert else None

    question_score = compute_question_score(responses) if responses else None
    final_score, score_detail = compute_final_approval_score(
        base_alert_score, question_score, q_weight
    )

    items = []
    for q in questions:
        r = response_map.get(q.id)
        items.append({
            "question_id": q.id,
            "question_order": q.question_order,
            "question_text": q.question_text,
            "help_text": q.help_text,
            "industry_context": q.industry_context,
            "is_required": q.is_required,
            "compliant_answer": q.compliant_answer.value if q.compliant_answer else "yes",
            "answer": r.answer.value if r else None,
            "notes": r.notes if r else None,
            "answered_by": r.answered_by if r else None,
            "answered_at": r.answered_at if r else None,
        })

    return {
        "transaction_id": txn_id,
        "questions_configured": len(questions),
        "questions_answered": len([i for i in items if i["answer"] is not None]),
        "checklist_complete": len(questions) > 0 and all(
            i["answer"] is not None for i in items if i["is_required"]
        ),
        "base_alert_score": base_alert_score,
        "risk_matrix_score": risk_matrix_score,
        "risk_matrix_level": risk_matrix_level,
        "question_score": question_score,
        "custom_question_weight": q_weight,
        "final_approval_score": final_score,
        "score_detail": score_detail,
        "questions": items,
        "disclaimer": (
            "Approval scores support the compliance workflow only. "
            "All regulatory decisions remain with the reporting entity."
        ),
    }


@router.post("/{txn_id}/answer-questions", status_code=200)
def answer_approval_questions(
    txn_id: str,
    payload: AnswerQuestionsRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_compliance_or_above),
):
    """
    Submit or update answers to the pre-approval checklist questions.

    Each answer is upserted (existing answer updated if already submitted).
    After all required questions are answered, the final_approval_score is
    computed and stored on the most recent alert for this transaction.

    Answer semantics:
      yes             — compliant (lower risk contribution)
      no              — non-compliant (flags a concern, higher risk)
      not_applicable  — excluded from score calculation

    DISCLAIMER: Answers are compliance workflow records only.
    """
    org_id = org_id_for(current_user)
    _get_transaction_or_404(txn_id, org_id, db)

    # Validate all question IDs belong to this org
    question_ids = [a.question_id for a in payload.answers]
    valid_questions = (
        db.query(OrgApprovalQuestion)
        .filter(
            OrgApprovalQuestion.id.in_(question_ids),
            OrgApprovalQuestion.org_id == org_id,
            OrgApprovalQuestion.is_active == True,
        )
        .all()
    )
    valid_ids = {q.id for q in valid_questions}
    invalid = [qid for qid in question_ids if qid not in valid_ids]
    if invalid:
        raise HTTPException(400, f"Unknown or inactive question IDs: {invalid}")

    now = datetime.now(timezone.utc)
    saved = []
    for item in payload.answers:
        existing = (
            db.query(TransactionQuestionResponse)
            .filter(
                TransactionQuestionResponse.transaction_id == txn_id,
                TransactionQuestionResponse.question_id == item.question_id,
            )
            .first()
        )
        if existing:
            existing.answer = item.answer
            existing.notes = item.notes
            existing.answered_by = current_user.id
            existing.answered_at = now
            saved.append(existing)
        else:
            r = TransactionQuestionResponse(
                id=f"tqr_{uuid4().hex[:10]}",
                transaction_id=txn_id,
                question_id=item.question_id,
                org_id=org_id,
                answer=item.answer,
                notes=item.notes,
                answered_by=current_user.id,
                answered_at=now,
            )
            db.add(r)
            saved.append(r)

    db.flush()

    # Recompute final approval score and persist to the latest alert
    all_responses = (
        db.query(TransactionQuestionResponse)
        .filter(
            TransactionQuestionResponse.transaction_id == txn_id,
            TransactionQuestionResponse.org_id == org_id,
        )
        .all()
    )
    config = db.query(OrgMonitoringConfig).filter(
        OrgMonitoringConfig.org_id == org_id
    ).first()
    q_weight = getattr(config, "custom_question_weight", 0.20) if config else 0.20

    from app.models.monitoring import TransactionAlert
    latest_alert = (
        db.query(TransactionAlert)
        .filter(
            TransactionAlert.transaction_id == txn_id,
            TransactionAlert.org_id == org_id,
        )
        .order_by(TransactionAlert.trigger_date.desc())
        .first()
    )

    question_score = compute_question_score(all_responses)
    base_alert_score = (latest_alert.alert_score if latest_alert else 0.0) or 0.0
    final_score, score_detail = compute_final_approval_score(base_alert_score, question_score, q_weight)

    if latest_alert:
        latest_alert.question_score = question_score
        latest_alert.final_approval_score = final_score
        latest_alert.approval_score_detail = score_detail

    db.commit()

    return {
        "transaction_id": txn_id,
        "answers_submitted": len(saved),
        "question_score": question_score,
        "base_alert_score": base_alert_score,
        "final_approval_score": final_score,
        "score_detail": score_detail,
        "disclaimer": (
            "Approval scores support the compliance workflow only. "
            "All regulatory decisions remain with the reporting entity."
        ),
    }
