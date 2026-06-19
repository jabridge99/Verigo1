"""Phase C — organisation risk_profile + auto-generated AML program

Revision ID: c1a2b3d4e5f6
Revises: ffafae2ef332
Create Date: 2026-06-17
"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

# revision identifiers, used by Alembic.
revision: str = 'c1a2b3d4e5f6'
down_revision: Union[str, None] = 'ffafae2ef332'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        "organisations",
        sa.Column(
            "risk_profile",
            sa.Enum("low", "standard", "high", name="riskprofile"),
            nullable=True,
        ),
    )

    # NOTE: this migration originally created Integer-PK "aml_programs" /
    # "aml_program_items" tables here, but those table names/shapes were
    # superseded by the org_id/string-id "aml_programs" model in
    # app/models/aml_solution.py (created earlier in the migration graph by
    # 06699922bb99) and by app/models/aml_program.py's "aml_program_records" /
    # "aml_program_items". Creating them here collided with the real
    # "aml_programs" table and left "aml_program_items" with the wrong shape,
    # so the create_table calls were removed.


def downgrade() -> None:
    op.drop_column("organisations", "risk_profile")
