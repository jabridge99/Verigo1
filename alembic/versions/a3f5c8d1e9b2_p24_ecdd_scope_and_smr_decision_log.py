"""p24_ecdd_scope_and_smr_decision_log

P24: every real VERIGO document suite (Remittance, VASP, Legal, Real
Estate, Accountants) requires a structured, per-instance record for
escalated ECDD matters and SMR suspicion decisions -- app/models/aml_program.py
only held flat Text narrative columns before this. Investigation found the
TMP Alert Log and Sanctions Screening Log concepts already exist as
TransactionAlert (monitoring.py) and ScreeningRecord (screening.py); no new
tables are needed for those. Two real gaps remained:

1. ECDD case tracking (ProfessionalAssessment, professional_assessment.py)
   was scoped to only 6 "professional services" industries -- Remittance,
   VASP and DPMS had no structured ECDD case file at all. This migration
   adds those 3 values to the existing professionalservicetype enum.

2. There was no standalone SMR Internal Decision Log -- Case's own
   is_smr_candidate/smr_considered/smr_lodged fields only cover suspicions
   that become a full Case, but every real Program requires a retained
   decision record for every escalated suspicion, including one cleared
   without ever becoming a Case and a documented decision NOT to lodge.
   This migration creates smr_decision_logs for that purpose.

Revision ID: a3f5c8d1e9b2
Revises: 0d8a1fc0b65b
Create Date: 2026-09-11
"""

from typing import Sequence, Union

import sqlalchemy as sa

from alembic import op

revision: str = "a3f5c8d1e9b2"
down_revision: Union[str, None] = "0d8a1fc0b65b"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    bind = op.get_bind()

    if bind.dialect.name == "postgresql":
        for value in ("remittance", "vasp", "dpms"):
            op.execute(
                f"ALTER TYPE professionalservicetype ADD VALUE IF NOT EXISTS '{value}'"
            )

    inspector = sa.inspect(bind)
    if "smr_decision_logs" in inspector.get_table_names():
        # Already created by Base.metadata.create_all() -- e.g. this repo's
        # own baseline_sync_with_models migration applied to a genuinely
        # fresh database, which builds every table from the current model
        # state (SMRDecisionLog included) rather than replaying history.
        # An existing database that ran the full migration chain before
        # this model existed does not have the table yet, so the explicit
        # create below still runs for it.
        return

    smr_matter_source = sa.Enum(
        "staff_escalation",
        "tmp_alert",
        "ocdd_review",
        "ecdd_process",
        "external_notification",
        "co_self_identification",
        name="smrmattersource",
    )
    smr_suspicion_type = sa.Enum(
        "money_laundering",
        "terrorism_financing",
        "proliferation_financing",
        "tax_evasion",
        "proceeds_of_crime",
        "identity_fraud",
        "other",
        name="smrsuspiciontype",
    )
    smr_decision_outcome = sa.Enum(
        "under_assessment",
        "smr_to_be_lodged",
        "smr_lodged",
        "smr_not_lodged",
        name="smrdecisionoutcome",
    )
    smr_continue_dealings = sa.Enum(
        "continue_normal",
        "austrac_afp_directed_cessation",
        "pending_direction",
        name="smrcontinuedealings",
    )

    op.create_table(
        "smr_decision_logs",
        sa.Column("id", sa.String(), primary_key=True),
        sa.Column("decision_ref", sa.String(30), nullable=False, unique=True),
        sa.Column(
            "org_id",
            sa.String(),
            sa.ForeignKey("organisations.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column(
            "customer_id",
            sa.String(),
            sa.ForeignKey("customers.id", ondelete="SET NULL"),
            nullable=True,
        ),
        sa.Column(
            "case_id",
            sa.String(),
            sa.ForeignKey("cases.id", ondelete="SET NULL"),
            nullable=True,
        ),
        sa.Column(
            "tmp_alert_id",
            sa.String(),
            sa.ForeignKey("transaction_alerts.id", ondelete="SET NULL"),
            nullable=True,
        ),
        sa.Column(
            "ecdd_case_id",
            sa.String(),
            sa.ForeignKey("professional_assessments.id", ondelete="SET NULL"),
            nullable=True,
        ),
        sa.Column(
            "related_transaction_id",
            sa.String(),
            sa.ForeignKey("transactions.id", ondelete="SET NULL"),
            nullable=True,
        ),
        sa.Column("matter_source", smr_matter_source, nullable=False),
        sa.Column("identifying_employee", sa.String(), nullable=True),
        sa.Column("suspicion_category", sa.String(100), nullable=True),
        sa.Column("risk_matrix_ref", sa.String(50), nullable=True),
        sa.Column("description", sa.Text(), nullable=True),
        sa.Column("co_user_id", sa.String(), nullable=True),
        sa.Column("suspicion_formed", sa.Boolean(), nullable=False, default=False),
        sa.Column("suspicion_formed_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("suspicion_type", smr_suspicion_type, nullable=True),
        sa.Column(
            "is_terrorism_financing_indicator",
            sa.Boolean(),
            nullable=True,
            default=False,
        ),
        sa.Column("reasons", sa.Text(), nullable=True),
        sa.Column(
            "enhanced_monitoring_applied", sa.Boolean(), nullable=True, default=False
        ),
        sa.Column("smr_deadline", sa.DateTime(timezone=True), nullable=True),
        sa.Column(
            "outcome",
            smr_decision_outcome,
            nullable=True,
            server_default="under_assessment",
        ),
        sa.Column("smr_lodged_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("austrac_reference", sa.String(100), nullable=True),
        sa.Column(
            "tipping_off_check_confirmed", sa.Boolean(), nullable=True, default=False
        ),
        sa.Column("director_notified", sa.Boolean(), nullable=True, default=False),
        sa.Column("director_notified_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("continue_dealings", smr_continue_dealings, nullable=True),
        sa.Column("post_decision_notes", sa.Text(), nullable=True),
        sa.Column("next_review_date", sa.Date(), nullable=True),
        sa.Column("created_by", sa.String(), nullable=False),
        sa.Column(
            "created_at", sa.DateTime(timezone=True), server_default=sa.func.now()
        ),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=True),
    )
    op.create_index(
        "ix_smr_decision_logs_decision_ref",
        "smr_decision_logs",
        ["decision_ref"],
        unique=True,
    )
    op.create_index(
        "ix_smr_decision_logs_org_id", "smr_decision_logs", ["org_id"], unique=False
    )
    op.create_index(
        "ix_smr_decision_logs_customer_id",
        "smr_decision_logs",
        ["customer_id"],
        unique=False,
    )
    op.create_index(
        "ix_smr_decision_logs_case_id", "smr_decision_logs", ["case_id"], unique=False
    )
    op.create_index(
        "ix_smr_decision_logs_tmp_alert_id",
        "smr_decision_logs",
        ["tmp_alert_id"],
        unique=False,
    )
    op.create_index(
        "ix_smr_decision_logs_ecdd_case_id",
        "smr_decision_logs",
        ["ecdd_case_id"],
        unique=False,
    )


def downgrade() -> None:
    op.drop_table("smr_decision_logs")
    bind = op.get_bind()
    if bind.dialect.name == "postgresql":
        for enum_name in (
            "smrmattersource",
            "smrsuspiciontype",
            "smrdecisionoutcome",
            "smrcontinuedealings",
        ):
            op.execute(f"DROP TYPE IF EXISTS {enum_name}")
    # Postgres cannot drop enum values from professionalservicetype without
    # recreating the type; remittance/vasp/dpms are left in place,
    # consistent with other enum-value migrations in this repo.
