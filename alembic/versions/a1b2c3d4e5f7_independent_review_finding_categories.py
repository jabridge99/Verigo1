"""independent_review_finding_categories

Aligns app/models/independent_review.py's FindingCategory with the two
mandatory review areas named by the Verigo Independent Review Framework
template (VERIGO-GEN-IRF-01, from the Google Drive AML/CTF document
library) that had no dedicated category before: Sanctions Screening and
AUSTRAC Enrolment. Both would otherwise have to be filed under "other",
losing area-specific tracking the template requires.

Revision ID: a1b2c3d4e5f7
Revises: f1a2b3c4d5e6
Create Date: 2026-09-09
"""

from typing import Sequence, Union

from alembic import op

revision: str = "a1b2c3d4e5f7"
down_revision: Union[str, None] = "f1a2b3c4d5e6"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    bind = op.get_bind()
    if bind.dialect.name == "postgresql":
        for value in ("sanctions_screening", "austrac_enrolment"):
            op.execute(f"ALTER TYPE findingcategory ADD VALUE IF NOT EXISTS '{value}'")


def downgrade() -> None:
    # Postgres cannot drop enum values without recreating the type; left as
    # a no-op, consistent with other enum-value migrations here.
    pass
