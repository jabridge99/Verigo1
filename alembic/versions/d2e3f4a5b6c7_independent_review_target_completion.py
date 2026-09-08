"""independent_review_target_completion

app/services/notification_scheduler.py's check_independent_review_due()
(part of the daily scheduled deadline check) has always queried
IndependentReview.target_completion, a column that has never existed on
the model -- silently caught by the function's own try/except and logged,
so this notification has never fired once. There was also no field
anywhere (model, create/update schema) for setting a review's target
completion date in the first place. Adds the column and wires it through
the create/update API so it can actually be set.

Revision ID: d2e3f4a5b6c7
Revises: c2d3e4f5a6b7
Create Date: 2026-09-08 00:00:00.000000

"""

from typing import Sequence, Union

import sqlalchemy as sa

from alembic import op

# revision identifiers, used by Alembic.
revision: str = "d2e3f4a5b6c7"
down_revision: Union[str, None] = "c2d3e4f5a6b7"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    bind = op.get_bind()
    inspector = sa.inspect(bind)
    columns = {c["name"] for c in inspector.get_columns("independent_reviews")}
    if "target_completion_date" not in columns:
        op.add_column(
            "independent_reviews",
            sa.Column("target_completion_date", sa.Date(), nullable=True),
        )
        op.create_index(
            "ix_independent_reviews_target_completion_date",
            "independent_reviews",
            ["target_completion_date"],
        )


def downgrade() -> None:
    op.drop_index(
        "ix_independent_reviews_target_completion_date",
        table_name="independent_reviews",
    )
    op.drop_column("independent_reviews", "target_completion_date")
