"""Phase F — per-tenant storage backend override

Revision ID: f4d5e6a7b8c9
Revises: e3c4d5f6a7b8
Create Date: 2026-06-17
"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

# revision identifiers, used by Alembic.
revision: str = 'f4d5e6a7b8c9'
down_revision: Union[str, None] = 'e3c4d5f6a7b8'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column("industry_tenants", sa.Column("storage_config", sa.JSON(), nullable=True))


def downgrade() -> None:
    op.drop_column("industry_tenants", "storage_config")
