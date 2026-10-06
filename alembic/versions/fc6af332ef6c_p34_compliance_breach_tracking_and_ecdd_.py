"""p34 compliance breach tracking and ecdd rejection type

P34: two structured-data gaps in the CO Quarterly Compliance Report
template (VERIGO-GEN-COR):

1. No "compliance breach" tracking model existed anywhere, so the
   template's "Breaches Identified This Quarter" section had nothing real
   to compute from. Adds compliance_breaches (app/models/compliance_breach.py)
   -- a standalone log (most breaches are self-identified during BAU, not
   surfaced by a formal review/test cycle, hence not folded into
   ReviewFinding/ControlTestFinding, which both require a parent
   review/test record).

2. ECDDRecord couldn't distinguish "relationship exited" (an existing
   customer offboarded after review) from "service declined" (a new
   applicant never onboarded) -- the template tracks these as separate
   metrics since they carry different regulatory implications. Adds
   ecdd_records.rejection_type, set by the compliance officer at decision
   time (app/api/routes/reports.py's decide_ecdd()).

Revision ID: fc6af332ef6c
Revises: 3de01cf6adc4
Create Date: 2026-09-16

"""

from typing import Sequence, Union

import sqlalchemy as sa

from alembic import op

revision: str = "fc6af332ef6c"
down_revision: Union[str, None] = "3de01cf6adc4"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    bind = op.get_bind()
    inspector = sa.inspect(bind)

    # ── compliance_breaches ──────────────────────────────────────────────────
    if "compliance_breaches" not in inspector.get_table_names():
        breach_severity = sa.Enum(
            "critical", "high", "medium", "low", name="breachseverity"
        )
        breach_status = sa.Enum(
            "open", "remediated", "closed", "risk_accepted", name="breachstatus"
        )
        # Enum types are created automatically as part of create_table's own
        # DDL emission (checkfirst) -- an explicit .create() call first would
        # double-create and fail with DuplicateObject.

        op.create_table(
            "compliance_breaches",
            sa.Column("id", sa.String(), primary_key=True),
            sa.Column(
                "org_id",
                sa.String(),
                sa.ForeignKey("organisations.id", ondelete="CASCADE"),
                nullable=False,
            ),
            sa.Column("title", sa.String(500), nullable=False),
            sa.Column("description", sa.Text(), nullable=False),
            sa.Column("severity", breach_severity, nullable=False),
            sa.Column(
                "status", breach_status, nullable=False, server_default="open"
            ),
            sa.Column("identified_date", sa.Date(), nullable=False),
            sa.Column(
                "identified_by",
                sa.String(),
                sa.ForeignKey("users.id", ondelete="SET NULL"),
                nullable=True,
            ),
            sa.Column(
                "source_review_id",
                sa.String(),
                sa.ForeignKey("independent_reviews.id", ondelete="SET NULL"),
                nullable=True,
            ),
            sa.Column(
                "source_control_test_id",
                sa.String(),
                sa.ForeignKey("control_tests.id", ondelete="SET NULL"),
                nullable=True,
            ),
            sa.Column(
                "reported_to_austrac", sa.Boolean(), nullable=True, default=False
            ),
            sa.Column("austrac_reference", sa.String(100), nullable=True),
            sa.Column(
                "austrac_reported_at", sa.DateTime(timezone=True), nullable=True
            ),
            sa.Column("remediation_notes", sa.Text(), nullable=True),
            sa.Column("remediated_date", sa.Date(), nullable=True),
            sa.Column(
                "closed_by",
                sa.String(),
                sa.ForeignKey("users.id", ondelete="SET NULL"),
                nullable=True,
            ),
            sa.Column("closed_at", sa.DateTime(timezone=True), nullable=True),
            sa.Column("created_by", sa.String(), nullable=False),
            sa.Column(
                "created_at", sa.DateTime(timezone=True), server_default=sa.func.now()
            ),
            sa.Column("updated_at", sa.DateTime(timezone=True), nullable=True),
        )
        op.create_index(
            "ix_compliance_breaches_org_id",
            "compliance_breaches",
            ["org_id"],
            unique=False,
        )
        op.create_index(
            "ix_compliance_breaches_severity",
            "compliance_breaches",
            ["severity"],
            unique=False,
        )
        op.create_index(
            "ix_compliance_breaches_status",
            "compliance_breaches",
            ["status"],
            unique=False,
        )
        op.create_index(
            "ix_compliance_breaches_identified_date",
            "compliance_breaches",
            ["identified_date"],
            unique=False,
        )

    # ── ecdd_records.rejection_type ──────────────────────────────────────────
    existing_columns = {c["name"] for c in inspector.get_columns("ecdd_records")}
    if "rejection_type" not in existing_columns:
        ecdd_rejection_type = sa.Enum(
            "service_declined", "relationship_exited", name="ecddrejectiontype"
        )
        # Unlike create_table (which auto-creates enum types for its own
        # columns), add_column does NOT -- it must be created explicitly first.
        if bind.dialect.name == "postgresql":
            ecdd_rejection_type.create(bind, checkfirst=True)
        op.add_column(
            "ecdd_records", sa.Column("rejection_type", ecdd_rejection_type)
        )


def downgrade() -> None:
    bind = op.get_bind()
    is_pg = bind.dialect.name == "postgresql"

    op.drop_column("ecdd_records", "rejection_type")
    if is_pg:
        op.execute("DROP TYPE IF EXISTS ecddrejectiontype")

    op.drop_table("compliance_breaches")
    if is_pg:
        for enum_name in ("breachseverity", "breachstatus"):
            op.execute(f"DROP TYPE IF EXISTS {enum_name}")
