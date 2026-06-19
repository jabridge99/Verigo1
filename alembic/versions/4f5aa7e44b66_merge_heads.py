"""merge heads

Revision ID: 4f5aa7e44b66
Revises: 5842723a96f2, b2c3d4e5f6a8, d4e5f6a7b8c9
Create Date: 2026-06-19 06:12:40.443604

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '4f5aa7e44b66'
down_revision: Union[str, None] = ('5842723a96f2', 'b2c3d4e5f6a8', 'd4e5f6a7b8c9')
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    pass


def downgrade() -> None:
    pass
