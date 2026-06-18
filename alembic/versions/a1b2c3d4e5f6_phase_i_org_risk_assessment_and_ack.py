"""Phase I — onboarding risk assessment + AML accountability sign-off

Revision ID: a1b2c3d4e5f6
Revises: f4d5e6a7b8c9
Create Date: 2026-06-18
"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

# revision identifiers, used by Alembic.
revision: str = 'a1b2c3d4e5f6'
down_revision: Union[str, None] = 'f4d5e6a7b8c9'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column("organisations", sa.Column("risk_assessment", sa.JSON(), nullable=True))
    op.add_column("organisations", sa.Column("risk_assessment_generated_at", sa.DateTime(timezone=True), nullable=True))
    op.add_column("organisations", sa.Column("aml_accountability_ack", sa.Boolean(), nullable=True, server_default=sa.false()))
    op.add_column("organisations", sa.Column("aml_accountability_ack_at", sa.DateTime(timezone=True), nullable=True))
    op.add_column("organisations", sa.Column("aml_accountability_ack_by", sa.String(200), nullable=True))


def downgrade() -> None:
    op.drop_column("organisations", "aml_accountability_ack_by")
    op.drop_column("organisations", "aml_accountability_ack_at")
    op.drop_column("organisations", "aml_accountability_ack")
    op.drop_column("organisations", "risk_assessment_generated_at")
    op.drop_column("organisations", "risk_assessment")
