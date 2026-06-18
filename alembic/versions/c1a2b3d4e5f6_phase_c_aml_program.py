"""Phase C — organisation risk_profile + auto-generated AML program

Revision ID: c1a2b3d4e5f6
Revises: ffafae2ef332
Create Date: 2026-06-17
"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

# revision identifiers, used by Alembic.
revision: str = 'c1a2b3d4e5f6'
down_revision: Union[str, None] = 'ffafae2ef332'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        "organisations",
        sa.Column(
            "risk_profile",
            sa.Enum("low", "standard", "high", name="riskprofile"),
            nullable=True,
        ),
    )

    op.create_table(
        "aml_programs",
        sa.Column("id", sa.Integer(), primary_key=True, index=True),
        sa.Column("program_id", sa.String(60), unique=True, index=True, nullable=False),
        sa.Column(
            "organisation_id",
            sa.Integer(),
            sa.ForeignKey("organisations.id"),
            unique=True,
            index=True,
            nullable=False,
        ),
        sa.Column("industry_id", sa.String(100), nullable=False),
        sa.Column("risk_profile", sa.String(20), nullable=False),
        sa.Column(
            "status",
            sa.Enum("draft", "active", name="amlprogramstatus"),
            server_default="active",
        ),
        sa.Column("version", sa.Integer(), server_default="1"),
        sa.Column("generated_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(timezone=True)),
    )

    op.create_table(
        "aml_program_items",
        sa.Column("id", sa.Integer(), primary_key=True, index=True),
        sa.Column(
            "program_id",
            sa.Integer(),
            sa.ForeignKey("aml_programs.id"),
            index=True,
            nullable=False,
        ),
        sa.Column("category", sa.String(50), nullable=False),
        sa.Column("title", sa.String(200), nullable=False),
        sa.Column("description", sa.Text()),
        sa.Column("review_frequency", sa.String(50)),
        sa.Column("is_required", sa.Boolean(), server_default=sa.true()),
        sa.Column("sort_order", sa.Integer(), server_default="0"),
    )


def downgrade() -> None:
    op.drop_table("aml_program_items")
    op.drop_table("aml_programs")
    op.drop_column("organisations", "risk_profile")
