"""notification_dedupe_key

Critical #12 (idempotency half — no scheduler exists yet to apply a
distributed lock to, see commit message for full context): notifications
had no way to dedupe, so any caller invoked twice for the same logical
event (a retried request, or a future scheduled reminder job run twice)
would create duplicate notifications and duplicate emails. Adds a unique,
nullable dedupe_key column callers can pass to make notification creation
idempotent.

Revision ID: d3e4f5a6b7c8
Revises: c7d8e9f0a1b2
Create Date: 2026-06-21 00:00:00.000000

"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

# revision identifiers, used by Alembic.
revision: str = 'd3e4f5a6b7c8'
down_revision: Union[str, None] = 'c7d8e9f0a1b2'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        'notifications', sa.Column('dedupe_key', sa.String(length=150), nullable=True)
    )
    op.create_index(
        op.f('ix_notifications_dedupe_key'),
        'notifications',
        ['dedupe_key'],
        unique=True,
    )


def downgrade() -> None:
    op.drop_index(op.f('ix_notifications_dedupe_key'), table_name='notifications')
    op.drop_column('notifications', 'dedupe_key')
