"""baseline_sync_with_models

Squashed baseline replacing the prior 20-revision history, which had
drifted from the ORM models (e.g. transactions.id was Integer in
migrations but String in app.models.transaction). This revision creates
the full current schema via Base.metadata so table/FK ordering is always
correct, and is meant to be applied only to an empty database (or paired
with `alembic stamp head` on a database whose schema already matches the
current models, e.g. one built by create_all()).

Revision ID: f73383da4e36
Revises:
Create Date: 2026-06-20 13:17:30.729185

"""
from typing import Sequence, Union

from alembic import op

import app.models  # noqa: F401 — registers all tables on Base.metadata
from app.db.database import Base

# revision identifiers, used by Alembic.
revision: str = 'f73383da4e36'
down_revision: Union[str, None] = None
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    Base.metadata.create_all(bind=op.get_bind())


def downgrade() -> None:
    Base.metadata.drop_all(bind=op.get_bind())
