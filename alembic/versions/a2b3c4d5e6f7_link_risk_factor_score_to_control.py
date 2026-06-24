"""link_risk_factor_score_to_control

Verification Marketplace / Mitigation Library / Question Library gap-closing
(Phase 0/1, additive): adds source_control_id to risk_factor_scores so a
factor's control_effectiveness can be derived from a tested GovernanceControl
instead of always being manually entered. No new tables, no renamed tables —
the risk_engine.ControlEffectiveness Python enum was renamed to
ControlEffectivenessScore in app code only (it was never bound to a DB
column; control_effectiveness columns remain plain Integer), so there is no
schema impact from that rename.

Revision ID: a2b3c4d5e6f7
Revises: c1d2e3f4a5b6
Create Date: 2026-06-24 00:00:00.000000

"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

# revision identifiers, used by Alembic.
revision: str = 'a2b3c4d5e6f7'
down_revision: Union[str, None] = 'c1d2e3f4a5b6'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        'risk_factor_scores',
        sa.Column('source_control_id', sa.String(), nullable=True),
    )
    op.create_index(
        'ix_risk_factor_scores_source_control_id',
        'risk_factor_scores',
        ['source_control_id'],
    )
    op.create_foreign_key(
        'fk_risk_factor_scores_source_control_id',
        'risk_factor_scores',
        'governance_controls',
        ['source_control_id'],
        ['id'],
    )
    op.add_column(
        'customer_risk_score_history',
        sa.Column('inherent_score', sa.Float(), nullable=True),
    )
    op.add_column(
        'customer_risk_score_history',
        sa.Column('residual_score', sa.Float(), nullable=True),
    )
    op.add_column(
        'customer_risk_score_history',
        sa.Column('control_effectiveness_score', sa.Integer(), nullable=True),
    )


def downgrade() -> None:
    op.drop_column('customer_risk_score_history', 'control_effectiveness_score')
    op.drop_column('customer_risk_score_history', 'residual_score')
    op.drop_column('customer_risk_score_history', 'inherent_score')
    op.drop_constraint(
        'fk_risk_factor_scores_source_control_id',
        'risk_factor_scores',
        type_='foreignkey',
    )
    op.drop_index(
        'ix_risk_factor_scores_source_control_id', table_name='risk_factor_scores'
    )
    op.drop_column('risk_factor_scores', 'source_control_id')
