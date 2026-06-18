"""Align industrytype enum with AUSTRAC taxonomy

Revision ID: 5842723a96f2
Revises: ffafae2ef332
Create Date: 2026-06-17 00:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '5842723a96f2'
down_revision: Union[str, None] = 'ffafae2ef332'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

OLD_VALUES = ('banking', 'fintech', 'insurance', 'real_estate', 'cryptocurrency', 'other')
NEW_VALUES = (
    'remittance', 'vasp', 'bullion_dealers',
    'accountants', 'conveyancers', 'legal_professionals', 'real_estate',
    'precious_metals', 'pubs_clubs',
    'banking', 'bookmakers_betting', 'casinos', 'financial_services', 'superannuation',
    'other',
)

# Best-effort mapping from the old ad-hoc values to the closest AUSTRAC category.
OLD_TO_NEW = {
    'banking': 'banking',
    'fintech': 'financial_services',
    'insurance': 'financial_services',
    'real_estate': 'real_estate',
    'cryptocurrency': 'vasp',
    'other': 'other',
}
# Inverse mapping used on downgrade — anything that doesn't map back cleanly falls to 'other'.
NEW_TO_OLD = {
    'banking': 'banking',
    'financial_services': 'fintech',
    'real_estate': 'real_estate',
    'vasp': 'cryptocurrency',
    'other': 'other',
}


def _rebuild_enum(values: tuple[str, ...], mapping: dict[str, str]) -> None:
    op.execute('ALTER TYPE industrytype RENAME TO industrytype_old')

    new_enum = sa.Enum(*values, name='industrytype')
    new_enum.create(op.get_bind())

    case_clauses = ' '.join(f"WHEN '{old}' THEN '{new}'" for old, new in mapping.items())
    op.execute(
        f"""
        ALTER TABLE customers
        ALTER COLUMN industry TYPE industrytype
        USING (
            CASE industry::text
                {case_clauses}
                ELSE 'other'
            END
        )::industrytype
        """
    )

    op.execute('DROP TYPE industrytype_old')


def upgrade() -> None:
    _rebuild_enum(NEW_VALUES, OLD_TO_NEW)


def downgrade() -> None:
    _rebuild_enum(OLD_VALUES, NEW_TO_OLD)
