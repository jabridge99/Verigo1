"""Phase E — billing: feature catalogue + per-plan feature toggles

Revision ID: e3c4d5f6a7b8
Revises: d2b3c4e5f6a7
Create Date: 2026-06-17
"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

# revision identifiers, used by Alembic.
revision: str = 'e3c4d5f6a7b8'
down_revision: Union[str, None] = 'd2b3c4e5f6a7'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        'features',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('code', sa.String(60), nullable=False),
        sa.Column('name', sa.String(200), nullable=False),
        sa.Column('category', sa.String(60), nullable=True),
        sa.Column('description', sa.Text(), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=True),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('code'),
    )
    op.create_index(op.f('ix_features_code'), 'features', ['code'], unique=True)
    op.create_index(op.f('ix_features_id'), 'features', ['id'], unique=False)

    op.create_table(
        'plan_feature_toggles',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column(
            'plan',
            sa.Enum('starter', 'professional', 'enterprise', 'vvip', 'free_trial', name='billingplan', create_type=False),
            nullable=False,
        ),
        sa.Column('feature_code', sa.String(60), nullable=False),
        sa.Column('enabled', sa.Boolean(), nullable=False),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=True),
        sa.Column('updated_at', sa.DateTime(timezone=True), nullable=True),
        sa.ForeignKeyConstraint(['feature_code'], ['features.code']),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('plan', 'feature_code', name='uq_plan_feature'),
    )
    op.create_index(op.f('ix_plan_feature_toggles_id'), 'plan_feature_toggles', ['id'], unique=False)
    op.create_index(op.f('ix_plan_feature_toggles_plan'), 'plan_feature_toggles', ['plan'], unique=False)
    op.create_index(op.f('ix_plan_feature_toggles_feature_code'), 'plan_feature_toggles', ['feature_code'], unique=False)


def downgrade() -> None:
    op.drop_index(op.f('ix_plan_feature_toggles_feature_code'), table_name='plan_feature_toggles')
    op.drop_index(op.f('ix_plan_feature_toggles_plan'), table_name='plan_feature_toggles')
    op.drop_index(op.f('ix_plan_feature_toggles_id'), table_name='plan_feature_toggles')
    op.drop_table('plan_feature_toggles')
    op.drop_index(op.f('ix_features_id'), table_name='features')
    op.drop_index(op.f('ix_features_code'), table_name='features')
    op.drop_table('features')
