"""ECDD single-page assessment rework

Reworks ecdd_records for a single-page assessment (replacing the old 7-step
wizard): trigger_reason moves from free-text to the AUSTRAC/FATF-aligned
EDDTrigger enum (shared with the broader EDD workflow), status gains a
'rejected' value alongside pending/completed, and the manual decision is now
reversible — decided_by/decided_at/last_revised_at replace completed_by/
completed_at, with decision_notes capturing the accept/reject rationale.

Revision ID: b1c2d3e4f5a6
Revises: a9b8c7d6e5f4, e4f5a6b7c8d9
Create Date: 2026-06-24
"""
import sqlalchemy as sa
from alembic import op

revision = "b1c2d3e4f5a6"
down_revision = ("a9b8c7d6e5f4", "e4f5a6b7c8d9")
branch_labels = None
depends_on = None

_EDD_TRIGGER_VALUES = [
    "pep_match", "sanctions_match", "adverse_media", "high_risk_country",
    "high_risk_score", "complex_ownership", "high_value_customer",
    "crypto_exposure", "cash_intensive", "unusual_activity",
    "compliance_discretion", "other",
]


def upgrade() -> None:
    bind = op.get_bind()
    is_pg = bind.dialect.name == "postgresql"

    if is_pg:
        op.execute("ALTER TYPE ecddstatus ADD VALUE IF NOT EXISTS 'rejected'")
        eddtrigger = sa.Enum(*_EDD_TRIGGER_VALUES, name="eddtrigger")
        eddtrigger.create(bind, checkfirst=True)

    op.add_column("ecdd_records", sa.Column("trigger_reason_other", sa.Text()))
    op.add_column("ecdd_records", sa.Column("decision_notes", sa.Text()))
    op.add_column("ecdd_records", sa.Column("decided_by", sa.String()))
    op.add_column("ecdd_records", sa.Column("decided_at", sa.DateTime(timezone=True)))
    op.add_column("ecdd_records", sa.Column("last_revised_at", sa.DateTime(timezone=True)))

    # Pre-existing free-text trigger_reason values can't be reliably mapped to
    # a specific AUSTRAC/FATF category — preserve them verbatim in the new
    # "other" detail field and tag the record as 'other'.
    op.execute("UPDATE ecdd_records SET trigger_reason_other = trigger_reason")

    if is_pg:
        op.execute(
            "ALTER TABLE ecdd_records "
            "ALTER COLUMN trigger_reason TYPE eddtrigger "
            "USING 'other'::eddtrigger"
        )
        op.execute(
            "UPDATE ecdd_records SET decided_by = completed_by, decided_at = completed_at"
        )
        op.drop_column("ecdd_records", "completed_by")
        op.drop_column("ecdd_records", "completed_at")
    else:
        op.execute("UPDATE ecdd_records SET trigger_reason = 'other'")


def downgrade() -> None:
    bind = op.get_bind()
    is_pg = bind.dialect.name == "postgresql"

    if is_pg:
        op.add_column("ecdd_records", sa.Column("completed_by", sa.String()))
        op.add_column("ecdd_records", sa.Column("completed_at", sa.DateTime(timezone=True)))
        op.execute(
            "UPDATE ecdd_records SET completed_by = decided_by, completed_at = decided_at"
        )
        op.execute("ALTER TABLE ecdd_records ALTER COLUMN trigger_reason TYPE text")
        sa.Enum(name="eddtrigger").drop(bind, checkfirst=True)
        # Postgres cannot drop a single enum value from ecddstatus without
        # recreating the type; 'rejected' is left in place.

    op.execute("UPDATE ecdd_records SET trigger_reason = trigger_reason_other WHERE trigger_reason_other IS NOT NULL")
    op.drop_column("ecdd_records", "last_revised_at")
    op.drop_column("ecdd_records", "decided_at")
    op.drop_column("ecdd_records", "decided_by")
    op.drop_column("ecdd_records", "decision_notes")
    op.drop_column("ecdd_records", "trigger_reason_other")
