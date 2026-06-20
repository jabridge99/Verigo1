"""AML program retention — versioned snapshots, throttled retrieval, ToS

Revision ID: b2c3d4e5f6a7
Revises: a1b2c3d4e5f6
Create Date: 2026-06-18
"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

# revision identifiers, used by Alembic.
revision: str = 'b2c3d4e5f6a7'
down_revision: Union[str, None] = 'a1b2c3d4e5f6'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column("organisations", sa.Column("retention_terms_accepted", sa.Boolean(), nullable=True, server_default=sa.false()))
    op.add_column("organisations", sa.Column("retention_terms_accepted_at", sa.DateTime(timezone=True), nullable=True))
    op.add_column("organisations", sa.Column("retention_terms_accepted_by", sa.String(200), nullable=True))
    op.add_column("organisations", sa.Column("retention_terms_version", sa.String(20), nullable=True))

    op.create_table(
        "aml_program_versions",
        sa.Column("id", sa.Integer(), primary_key=True, index=True),
        sa.Column("program_id", sa.String(), sa.ForeignKey("aml_programs.id"), index=True, nullable=False),
        sa.Column("organisation_id", sa.String(), sa.ForeignKey("organisations.id"), index=True, nullable=False),
        sa.Column("version", sa.Integer(), nullable=False),
        sa.Column("industry_id", sa.String(100), nullable=False),
        sa.Column("risk_profile", sa.String(20), nullable=False),
        sa.Column("items_snapshot", sa.JSON(), nullable=False),
        sa.Column("item_count", sa.Integer(), nullable=False),
        sa.Column("content_hash", sa.String(64), nullable=False),
        sa.Column("qr_token", sa.String(40), unique=True, index=True, nullable=False),
        sa.Column("generated_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
    )

    op.create_table(
        "version_retrieval_requests",
        sa.Column("id", sa.Integer(), primary_key=True, index=True),
        sa.Column("organisation_id", sa.String(), sa.ForeignKey("organisations.id"), index=True, nullable=False),
        sa.Column("version", sa.Integer(), nullable=False),
        sa.Column("requested_by", sa.String(200), nullable=False),
        sa.Column("requested_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
    )


def downgrade() -> None:
    op.drop_table("version_retrieval_requests")
    op.drop_table("aml_program_versions")
    op.drop_column("organisations", "retention_terms_version")
    op.drop_column("organisations", "retention_terms_accepted_by")
    op.drop_column("organisations", "retention_terms_accepted_at")
    op.drop_column("organisations", "retention_terms_accepted")
