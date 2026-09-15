"""
SMR (Suspicious Matter Report) Internal Decision Log.

Every real VERIGO document suite reviewed this session (Remittance, VASP,
Legal, Real Estate, Accountants) requires an append-only decision-log
entry for EVERY escalated suspicion — whether or not it results in an SMR
being lodged, and whether or not it ever becomes a Case. AUSTRAC may audit
the decision-making process itself, so "no SMR was lodged" must be as
retrievable and as well-evidenced as "an SMR was lodged".

This is distinct from `Case`'s existing `is_smr_candidate`/`smr_considered`/
`smr_lodged` boolean workflow fields (app/models/case.py) — those summarise
the SMR position of a single, already-opened Case. Many suspicions are
raised, assessed by the Compliance Officer, and cleared WITHOUT ever
becoming a Case at all; those still require a permanent decision-log
record under every real Program reviewed this session. Where a decision
does relate to an existing Case, `case_id` links the two records, and the
Case's own summary flags remain the fast-glance workflow state.

Also distinct from `TransactionAlert` (app/models/monitoring.py, the TMP
Alert Log) and `ScreeningRecord` (app/models/screening.py, the Sanctions
Screening Log) — both of those already exist and are not duplicated here.
A decision log entry may originate from either of them (`tmp_alert_id`),
from an ECDD case (`ecdd_case_id`, see app/models/professional_assessment.py),
from a staff escalation with no automated trigger at all, or from the
Compliance Officer's own review.

DISCLAIMER: This module records the entity's own suspicion-assessment
decisions. The platform does not determine whether a matter is
suspicious, does not form a suspicion on the entity's behalf, and does
not lodge SMRs with AUSTRAC. All decisions remain with the reporting
entity's Compliance Officer.
"""

import enum
from uuid import uuid4

from sqlalchemy import (
    Boolean,
    Column,
    Date,
    DateTime,
    Enum,
    ForeignKey,
    String,
    Text,
    func,
)
from sqlalchemy.orm import relationship

from app.db.database import Base

# ── Enums ─────────────────────────────────────────────────────────────────────


class SMRMatterSource(str, enum.Enum):
    staff_escalation = "staff_escalation"
    tmp_alert = "tmp_alert"
    ocdd_review = "ocdd_review"
    ecdd_process = "ecdd_process"
    external_notification = "external_notification"
    co_self_identification = "co_self_identification"


class SMRSuspicionType(str, enum.Enum):
    money_laundering = "money_laundering"
    terrorism_financing = "terrorism_financing"
    proliferation_financing = "proliferation_financing"
    tax_evasion = "tax_evasion"
    proceeds_of_crime = "proceeds_of_crime"
    identity_fraud = "identity_fraud"
    other = "other"


class SMRDecisionOutcome(str, enum.Enum):
    under_assessment = "under_assessment"
    smr_to_be_lodged = "smr_to_be_lodged"
    smr_lodged = "smr_lodged"
    smr_not_lodged = "smr_not_lodged"


class SMRContinueDealings(str, enum.Enum):
    continue_normal = "continue_normal"
    austrac_afp_directed_cessation = "austrac_afp_directed_cessation"
    pending_direction = "pending_direction"


# ── Model ─────────────────────────────────────────────────────────────────────


class SMRDecisionLog(Base):
    """
    One record per escalated suspicion, from initial escalation through to
    the Compliance Officer's documented decision and (if applicable) SMR
    lodgement. Append-only in spirit: status moves forward through the
    workflow but the record itself is never deleted, matching the real
    documents' 7-year retention requirement for this record type.
    """

    __tablename__ = "smr_decision_logs"

    id = Column(String, primary_key=True, default=lambda: f"smrdl_{uuid4().hex[:12]}")
    decision_ref = Column(String(30), unique=True, nullable=False, index=True)
    org_id = Column(
        String,
        ForeignKey("organisations.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    customer_id = Column(
        String,
        ForeignKey("customers.id", ondelete="SET NULL"),
        nullable=True,
        index=True,
    )
    case_id = Column(
        String, ForeignKey("cases.id", ondelete="SET NULL"), nullable=True, index=True
    )
    tmp_alert_id = Column(
        String,
        ForeignKey("transaction_alerts.id", ondelete="SET NULL"),
        nullable=True,
        index=True,
    )
    ecdd_case_id = Column(
        String,
        ForeignKey("professional_assessments.id", ondelete="SET NULL"),
        nullable=True,
        index=True,
    )
    related_transaction_id = Column(
        String, ForeignKey("transactions.id", ondelete="SET NULL"), nullable=True
    )

    # ── Matter identification ────────────────────────────────────────────────
    matter_source = Column(Enum(SMRMatterSource), nullable=False)
    identifying_employee = Column(
        String
    )  # user_id, where matter_source is staff-raised
    suspicion_category = Column(String(100))
    # Free-text/short-code, e.g. "entity_formation_no_purpose",
    # "trust_account_third_party_funds" — deliberately not a fixed enum since
    # every sector's real Risk Matrix defines its own suspicion categories.
    risk_matrix_ref = Column(String(50))  # e.g. "PR-01", "EF-01"
    description = Column(Text)  # facts and circumstances giving rise to the suspicion

    # ── Compliance Officer assessment ────────────────────────────────────────
    co_user_id = Column(String)  # user_id of the assessing Compliance Officer
    suspicion_formed = Column(Boolean, nullable=False, default=False)
    # Human decision only — never auto-set by the platform.
    suspicion_formed_at = Column(DateTime(timezone=True))
    suspicion_type = Column(Enum(SMRSuspicionType))
    is_terrorism_financing_indicator = Column(Boolean, default=False)
    reasons = Column(Text)  # CO's documented reasoning, whichever way the decision goes
    enhanced_monitoring_applied = Column(Boolean, default=False)

    # ── SMR deadline and lodgement ───────────────────────────────────────────
    # s.41 AML/CTF Act: 24 hours (terrorism financing) or 3 business days
    # (all other matters) from suspicion_formed_at — consistent across every
    # real sector document reviewed this session.
    smr_deadline = Column(DateTime(timezone=True))
    outcome = Column(
        Enum(SMRDecisionOutcome), default=SMRDecisionOutcome.under_assessment
    )
    smr_lodged_at = Column(DateTime(timezone=True))
    austrac_reference = Column(String(100))

    # ── Tipping-off and post-decision ────────────────────────────────────────
    tipping_off_check_confirmed = Column(Boolean, default=False)
    director_notified = Column(Boolean, default=False)
    director_notified_at = Column(DateTime(timezone=True))
    continue_dealings = Column(Enum(SMRContinueDealings))
    post_decision_notes = Column(Text)
    next_review_date = Column(Date)

    created_by = Column(String, nullable=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())

    # ── Relationships ─────────────────────────────────────────────────────────
    organisation = relationship("Organisation")
    customer = relationship("Customer")
    case = relationship("Case")
    tmp_alert = relationship("TransactionAlert")
    ecdd_case = relationship("ProfessionalAssessment")
