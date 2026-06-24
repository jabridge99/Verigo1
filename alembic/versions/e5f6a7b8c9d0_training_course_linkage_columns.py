"""training_course_linkage_columns

Training Suite gap-closing (additive, no new tables): adds static linkage
columns to the existing TrainingCourse model so courses can declare which
industries they target and which controls/risk-factor categories they
evidence staff competency for, without introducing a new join table.

Revision ID: e5f6a7b8c9d0
Revises: d3e4f5a6b7c8
Create Date: 2026-06-23 00:00:00.000000

"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

# revision identifiers, used by Alembic.
revision: str = 'e5f6a7b8c9d0'
down_revision: Union[str, None] = 'd3e4f5a6b7c8'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        'training_courses', sa.Column('applicable_industries', sa.JSON(), nullable=True)
    )
    op.add_column(
        'training_courses', sa.Column('linked_control_ids', sa.JSON(), nullable=True)
    )
    op.add_column(
        'training_courses', sa.Column('linked_risk_factor_categories', sa.JSON(), nullable=True)
    )


def downgrade() -> None:
    op.drop_column('training_courses', 'linked_risk_factor_categories')
    op.drop_column('training_courses', 'linked_control_ids')
    op.drop_column('training_courses', 'applicable_industries')
