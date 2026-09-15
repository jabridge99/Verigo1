"""widen_organisation_abn_column

organisations.abn was VARCHAR(11) -- exactly the raw digit count of an
ABN, but the org-settings PATCH endpoint accepts and round-trips the
human-formatted value as entered ("XX XXX XXX XXX", 14 chars with
spaces), not a normalised 11-digit string. SQLite doesn't enforce
VARCHAR length limits so this passed silently there; real Postgres
truncation-checking rejects the insert outright. Found via P52's
Postgres test triage (test_onboarding_wizard.py's PATCH round-trip test).

Widened to 20 to leave headroom for other real-world punctuation
(hyphens) beyond the plain spaced format.

Revision ID: 82cdd805f838
Revises: 410a0ddbee2b
Create Date: 2026-09-15 00:00:00.000000

"""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

# revision identifiers, used by Alembic.
revision: str = "82cdd805f838"
down_revision: Union[str, None] = "410a0ddbee2b"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.alter_column(
        "organisations",
        "abn",
        existing_type=sa.String(length=11),
        type_=sa.String(length=20),
        existing_nullable=True,
    )


def downgrade() -> None:
    op.alter_column(
        "organisations",
        "abn",
        existing_type=sa.String(length=20),
        type_=sa.String(length=11),
        existing_nullable=True,
    )
