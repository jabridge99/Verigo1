"""remediation_control_id

Governance Control Register: app/api/routes/governance/controls.py's whole
remediation subsystem (create/list/update remediation actions, and the
auto-created remediation records finalise_test() raises for critical/high
findings) has always filtered and constructed ControlRemediationAction by a
control_id that the model never actually had -- every one of those code
paths raised at runtime. This adds the missing column (and created_by,
which the same routes also pass into the constructor and the model was
missing) and relaxes test_id to nullable, since a remediation action can be
raised directly against a control without an originating test.

Revision ID: c2d3e4f5a6b7
Revises: b1c2d3e4f5a6
Create Date: 2026-09-08 00:00:00.000000

"""

from typing import Sequence, Union

import sqlalchemy as sa

from alembic import op

# revision identifiers, used by Alembic.
revision: str = "c2d3e4f5a6b7"
down_revision: Union[str, None] = "b1c2d3e4f5a6"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    bind = op.get_bind()
    inspector = sa.inspect(bind)

    cra_columns = {c["name"] for c in inspector.get_columns("control_remediation_actions")}
    if "control_id" not in cra_columns:
        op.add_column(
            "control_remediation_actions",
            sa.Column("control_id", sa.String(), nullable=True),
        )
        op.execute(
            """
            UPDATE control_remediation_actions AS cra
            SET control_id = ct.control_id
            FROM control_tests AS ct
            WHERE cra.test_id = ct.id
            """
        )
        op.alter_column(
            "control_remediation_actions", "control_id", nullable=False
        )
        op.create_foreign_key(
            "fk_control_remediation_actions_control_id",
            "control_remediation_actions",
            "governance_controls",
            ["control_id"],
            ["id"],
            ondelete="CASCADE",
        )
        op.create_index(
            "ix_control_remediation_actions_control_id",
            "control_remediation_actions",
            ["control_id"],
        )
    if "created_by" not in cra_columns:
        op.add_column(
            "control_remediation_actions",
            sa.Column("created_by", sa.String(), nullable=True),
        )

    op.alter_column(
        "control_remediation_actions", "test_id", existing_type=sa.String(), nullable=True
    )

    ctf_columns = {c["name"] for c in inspector.get_columns("control_test_findings")}
    if "created_by" not in ctf_columns:
        op.add_column(
            "control_test_findings",
            sa.Column("created_by", sa.String(), nullable=True),
        )


def downgrade() -> None:
    op.drop_column("control_test_findings", "created_by")
    op.alter_column(
        "control_remediation_actions", "test_id", existing_type=sa.String(), nullable=False
    )
    op.drop_column("control_remediation_actions", "created_by")
    op.drop_index(
        "ix_control_remediation_actions_control_id",
        table_name="control_remediation_actions",
    )
    op.drop_constraint(
        "fk_control_remediation_actions_control_id",
        "control_remediation_actions",
        type_="foreignkey",
    )
    op.drop_column("control_remediation_actions", "control_id")
