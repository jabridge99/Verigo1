"""make training_assignments assigned_by nullable

training_assignments.assigned_by was NOT NULL + FK(users.id), but
risk_triggered_training_service.py's system-initiated flows (risk-event
auto-assignment, regulatory update broadcast) have no human actor to
attribute the assignment to. That code hard-coded the literal string
"system" for assigned_by, which is not a real users.id and violates the
FK on Postgres (SQLite doesn't enforce it, so this went undetected until
tested against real Postgres) -- every risk-triggered or regulatory-update
training assignment would crash with a ForeignKeyViolation in production.

Fix: assigned_by is now nullable, matching GovernanceTrainingRecord's
existing assigned_by column (already nullable + ondelete=SET NULL) which
was already designed to tolerate no owner. The service now passes None
instead of "system" for these system-initiated assignments, and the real
actor id when one exists (manual fire, regulatory update publish).

Revision ID: 181b4a494ffe
Revises: 19838395f614
Create Date: 2026-09-16 00:32:21.658300

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '181b4a494ffe'
down_revision: Union[str, None] = '19838395f614'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.alter_column(
        "training_assignments",
        "assigned_by",
        existing_type=sa.String(),
        nullable=True,
    )
    op.drop_constraint(
        "training_assignments_assigned_by_fkey", "training_assignments", type_="foreignkey"
    )
    op.create_foreign_key(
        "training_assignments_assigned_by_fkey",
        "training_assignments",
        "users",
        ["assigned_by"],
        ["id"],
        ondelete="SET NULL",
    )


def downgrade() -> None:
    # Not reversible once any row has assigned_by = NULL (system-initiated
    # assignments) -- there is no human actor to backfill it with.
    pass
