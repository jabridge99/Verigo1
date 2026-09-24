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
revision: str = "a2b3c4d5e6f7"
down_revision: Union[str, None] = "c1d2e3f4a5b6"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Guarded: on a database created fresh via the f73383da4e36 baseline
    # (create_all() against the *current* model, which already declares
    # these columns/index/FK), they already exist. On a database that
    # predates that baseline, this migration is what adds them.
    bind = op.get_bind()
    inspector = sa.inspect(bind)

    rfs_columns = {c["name"] for c in inspector.get_columns("risk_factor_scores")}
    if "source_control_id" not in rfs_columns:
        op.add_column(
            "risk_factor_scores",
            sa.Column("source_control_id", sa.String(), nullable=True),
        )
    rfs_indexes = {ix["name"] for ix in inspector.get_indexes("risk_factor_scores")}
    if "ix_risk_factor_scores_source_control_id" not in rfs_indexes:
        op.create_index(
            "ix_risk_factor_scores_source_control_id",
            "risk_factor_scores",
            ["source_control_id"],
        )
    rfs_fks = {fk["name"] for fk in inspector.get_foreign_keys("risk_factor_scores")}
    if "fk_risk_factor_scores_source_control_id" not in rfs_fks:
        op.create_foreign_key(
            "fk_risk_factor_scores_source_control_id",
            "risk_factor_scores",
            "governance_controls",
            ["source_control_id"],
            ["id"],
        )

    crsh_columns = {
        c["name"] for c in inspector.get_columns("customer_risk_score_history")
    }
    for name in ("inherent_score", "residual_score"):
        if name not in crsh_columns:
            op.add_column(
                "customer_risk_score_history",
                sa.Column(name, sa.Float(), nullable=True),
            )
    if "control_effectiveness_score" not in crsh_columns:
        op.add_column(
            "customer_risk_score_history",
            sa.Column("control_effectiveness_score", sa.Integer(), nullable=True),
        )


def downgrade() -> None:
    op.drop_column("customer_risk_score_history", "control_effectiveness_score")
    op.drop_column("customer_risk_score_history", "residual_score")
    op.drop_column("customer_risk_score_history", "inherent_score")
    op.drop_constraint(
        "fk_risk_factor_scores_source_control_id",
        "risk_factor_scores",
        type_="foreignkey",
    )
    op.drop_index(
        "ix_risk_factor_scores_source_control_id", table_name="risk_factor_scores"
    )
    op.drop_column("risk_factor_scores", "source_control_id")
