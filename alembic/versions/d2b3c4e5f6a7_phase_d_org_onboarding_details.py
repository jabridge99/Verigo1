"""Phase D — organisation company details + compliance officer

Revision ID: d2b3c4e5f6a7
Revises: c1a2b3d4e5f6
Create Date: 2026-06-17
"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

# revision identifiers, used by Alembic.
revision: str = 'd2b3c4e5f6a7'
down_revision: Union[str, None] = 'c1a2b3d4e5f6'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # "abn" already exists on organisations (added by 06699922bb99); skip it
    # here to avoid a duplicate-column error.
    op.add_column("organisations", sa.Column("business_address", sa.String(300), nullable=True))
    op.add_column("organisations", sa.Column("phone", sa.String(50), nullable=True))
    op.add_column("organisations", sa.Column("compliance_officer_name", sa.String(200), nullable=True))
    op.add_column("organisations", sa.Column("compliance_officer_email", sa.String(200), nullable=True))


def downgrade() -> None:
    op.drop_column("organisations", "compliance_officer_email")
    op.drop_column("organisations", "compliance_officer_name")
    op.drop_column("organisations", "phone")
    op.drop_column("organisations", "business_address")
