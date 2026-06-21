"""make_users_org_id_nullable

Global super-admins (is_super_admin=True, e.g. seed_master_admin) are not
tenant-scoped and have no org. org_id was nullable=False, which crashed
app startup whenever MASTER_ADMIN_EMAIL/PASSWORD created a master admin.

Revision ID: a1b2c3d4e5f6
Revises: f73383da4e36
Create Date: 2026-06-21 03:35:00.000000

"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

# revision identifiers, used by Alembic.
revision: str = 'a1b2c3d4e5f6'
down_revision: Union[str, None] = 'f73383da4e36'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.alter_column('users', 'org_id', existing_type=sa.String(), nullable=True)


def downgrade() -> None:
    op.alter_column('users', 'org_id', existing_type=sa.String(), nullable=False)
