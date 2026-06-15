"""
Risk Matrix Configuration and Pre-Approval Question Models.

OrgMonitoringConfig  — per-org alert score weight settings and custom question weight.
OrgApprovalQuestion  — 3-5 industry-specific questions answered before approval.
TransactionQuestionResponse — answers per transaction (immutable once submitted).

DISCLAIMER: Risk matrix scores and approval question results are compliance
workflow tools. All regulatory decisions remain with the reporting entity.
"""
import enum
from uuid import uuid4

from sqlalchemy import (
    Boolean, Column, DateTime, Enum, Float,
    ForeignKey, Integer, String, Text, UniqueConstraint, func,
)

from app.db.database import Base


class QuestionAnswer(str, enum.Enum):
    yes             = "yes"
    no              = "no"
    not_applicable  = "not_applicable"


class OrgMonitoringConfig(Base):
    """
    Per-organisation monitoring weight configuration.
    Exactly one row per org — created on first access (upsert).

    Alert score formula (base weights, must be adjusted together):
      alert_score = behaviour * behaviour_weight
                  + rule      * rule_weight
                  + customer  * customer_risk_weight
                  + matrix    * risk_matrix_weight

    Approval score (applied at review time):
      final = alert_score * (1 - custom_question_weight)
            + question_score * custom_question_weight
    """
    __tablename__ = "org_monitoring_configs"

    id      = Column(String, primary_key=True, default=lambda: f"omc_{uuid4().hex[:10]}")
    org_id  = Column(String, ForeignKey("organisations.id", ondelete="CASCADE"),
                     nullable=False, unique=True, index=True)

    # ── Base alert score component weights ─────────────────────────────────────
    # Must sum to 1.0; validated in the API layer, not enforced at DB level.
    behaviour_weight        = Column(Float, default=0.30, nullable=False)
    rule_weight             = Column(Float, default=0.25, nullable=False)
    customer_risk_weight    = Column(Float, default=0.10, nullable=False)
    risk_matrix_weight      = Column(Float, default=0.35, nullable=False)

    # ── Custom question weight (0.00 – 0.40) ───────────────────────────────────
    # Proportion of the final approval score contributed by answered questions.
    # Remaining (1 - custom_question_weight) comes from alert_score.
    custom_question_weight  = Column(Float, default=0.20, nullable=False)

    # ── Risk matrix dimension weights ──────────────────────────────────────────
    # Must sum to 1.0 within the matrix sub-score.
    matrix_customer_weight      = Column(Float, default=0.30, nullable=False)
    matrix_geographic_weight    = Column(Float, default=0.25, nullable=False)
    matrix_product_weight       = Column(Float, default=0.20, nullable=False)
    matrix_transaction_weight   = Column(Float, default=0.25, nullable=False)

    updated_by  = Column(String)
    created_at  = Column(DateTime(timezone=True), server_default=func.now())
    updated_at  = Column(DateTime(timezone=True), onupdate=func.now())


class OrgApprovalQuestion(Base):
    """
    Industry-specific pre-approval checklist questions configured by the org.

    Each org may have 3–5 active questions. These are presented to the
    compliance officer when reviewing/approving an alert or transaction.
    Answers feed into a question_score that contributes custom_question_weight
    percent of the final approval score.

    DISCLAIMER: Questions are compliance workflow prompts only.
    """
    __tablename__ = "org_approval_questions"

    id      = Column(String, primary_key=True, default=lambda: f"oaq_{uuid4().hex[:10]}")
    org_id  = Column(String, ForeignKey("organisations.id", ondelete="CASCADE"),
                     nullable=False, index=True)

    question_text       = Column(String(500), nullable=False)
    question_order      = Column(Integer, default=1)        # 1–5 display order
    is_required         = Column(Boolean, default=True)
    is_active           = Column(Boolean, default=True, nullable=False, index=True)
    industry_context    = Column(String(200))               # e.g. "Remittance" or "Crypto"
    help_text           = Column(String(500))               # guidance shown to reviewer

    # A "yes" answer means compliant (lower risk); "no" means non-compliant (flag).
    # "not_applicable" is excluded from the score calculation.
    compliant_answer    = Column(Enum(QuestionAnswer), default=QuestionAnswer.yes)

    created_by  = Column(String)
    created_at  = Column(DateTime(timezone=True), server_default=func.now())
    updated_at  = Column(DateTime(timezone=True), onupdate=func.now())


class TransactionQuestionResponse(Base):
    """
    Immutable record of a compliance officer's answer to a pre-approval question.

    Score calculation:
      answered = [r for r in responses if r.answer != not_applicable]
      compliant = [r for r in answered if r.answer == question.compliant_answer]
      question_score = len(compliant) / len(answered) * 100   (0 if no answered)

    question_score feeds into final_approval_score on the alert.
    """
    __tablename__ = "transaction_question_responses"
    __table_args__ = (
        UniqueConstraint("transaction_id", "question_id", name="uq_txn_question"),
    )

    id              = Column(String, primary_key=True, default=lambda: f"tqr_{uuid4().hex[:10]}")
    transaction_id  = Column(String, ForeignKey("transactions.id", ondelete="CASCADE"),
                             nullable=False, index=True)
    question_id     = Column(String, ForeignKey("org_approval_questions.id", ondelete="CASCADE"),
                             nullable=False, index=True)
    org_id          = Column(String, nullable=False, index=True)

    answer          = Column(Enum(QuestionAnswer), nullable=False)
    notes           = Column(Text)

    answered_by     = Column(String, nullable=False)    # user_id
    answered_at     = Column(DateTime(timezone=True), server_default=func.now())
