"""split_controlstatus_enum_type

P37: app/models/aml_solution.py's Control.status and
app/models/governance_controls.py's GovernanceControl.status each declare
their own, differently-valued ControlStatus enum, but neither gave its
column an explicit Postgres type name -- so both were silently sharing one
underlying `controlstatus` type. Whichever table's column SQLAlchemy's
metadata-sorted create_all() processed first "won" the type's value set;
on this repo's current migration chain that's aml_solution.py's four
values (effective/partially_effective/ineffective/not_tested), which does
not include "active" -- the one value org_service.py's
_seed_aml_solution_and_risk_framework() always writes when seeding a new
org's governance controls. Every new-org registration's GovernanceControl
insert has therefore been failing with psycopg2.errors.InvalidTextRepresentation
wherever a database was actually built from this migration chain.

Splits the shared type into two explicitly-named ones matching each
model's real value set: governance_control_status (the live table) and
legacy_control_status (app/models/aml_solution.py's Control -- confirmed
dead code, never instantiated anywhere in app/, so its column carries no
data to preserve). governance_controls.status's existing data is
preserved via a straight text cast, which is exactly what every row
already is ('active', per the only value the seeding code ever writes).

Idempotent both ways, because the two possible starting states are real:
on a database that already has the old shared `controlstatus` type (any
database built before this fix -- production, most likely, and any
existing dev database), upgrade() performs the split. On a brand new
database built *after* this fix, the baseline migration's
`Base.metadata.create_all()` reads the now-fixed model definitions
directly and creates the two split types itself -- there is no shared
`controlstatus` type to find, so upgrade() is a no-op there. downgrade()
mirrors the same check in reverse.

Revision ID: 96e0b54fc153
Revises: d472643f4d3b
Create Date: 2026-09-11
"""

import sqlalchemy as sa

from alembic import op

revision = "96e0b54fc153"
down_revision = "d472643f4d3b"
branch_labels = None
depends_on = None

GOVERNANCE_CONTROL_STATUS_VALUES = (
    "active",
    "inactive",
    "under_review",
    "remediation",
    "suspended",
)
LEGACY_CONTROL_STATUS_VALUES = (
    "effective",
    "partially_effective",
    "ineffective",
    "not_tested",
)


def _pg_type_exists(bind, name: str) -> bool:
    return (
        bind.execute(
            sa.text("SELECT 1 FROM pg_type WHERE typname = :name"), {"name": name}
        ).first()
        is not None
    )


def upgrade() -> None:
    bind = op.get_bind()
    if bind.dialect.name != "postgresql":
        # SQLite (and this repo's test suite) has no shared named enum
        # types -- Enum() is emulated per-column as a CHECK constraint, so
        # there's nothing to split there.
        return

    if not _pg_type_exists(bind, "controlstatus"):
        # Nothing to split: a fresh database built after this fix already
        # gets the two distinctly-named types straight from the baseline
        # migration's create_all() reading the current (fixed) models.
        return

    op.execute(
        "CREATE TYPE governance_control_status AS ENUM "
        f"({', '.join(repr(v) for v in GOVERNANCE_CONTROL_STATUS_VALUES)})"
    )
    op.execute(
        "CREATE TYPE legacy_control_status AS ENUM "
        f"({', '.join(repr(v) for v in LEGACY_CONTROL_STATUS_VALUES)})"
    )

    op.execute(
        "ALTER TABLE governance_controls "
        "ALTER COLUMN status TYPE governance_control_status "
        "USING status::text::governance_control_status"
    )
    op.execute(
        "ALTER TABLE controls "
        "ALTER COLUMN status TYPE legacy_control_status "
        "USING status::text::legacy_control_status"
    )

    op.execute("DROP TYPE controlstatus")


def downgrade() -> None:
    bind = op.get_bind()
    if bind.dialect.name != "postgresql":
        return

    if _pg_type_exists(bind, "controlstatus"):
        # upgrade() was a no-op (fresh-baseline path) -- nothing to undo.
        return
    if not _pg_type_exists(bind, "governance_control_status") or not _pg_type_exists(
        bind, "legacy_control_status"
    ):
        # Neither split state nor pre-split state -- unexpected, leave alone.
        return

    all_values = (*LEGACY_CONTROL_STATUS_VALUES, *GOVERNANCE_CONTROL_STATUS_VALUES)
    op.execute(
        f"CREATE TYPE controlstatus AS ENUM ({', '.join(repr(v) for v in all_values)})"
    )

    op.execute(
        "ALTER TABLE governance_controls "
        "ALTER COLUMN status TYPE controlstatus USING status::text::controlstatus"
    )
    op.execute(
        "ALTER TABLE controls "
        "ALTER COLUMN status TYPE controlstatus USING status::text::controlstatus"
    )

    op.execute("DROP TYPE governance_control_status")
    op.execute("DROP TYPE legacy_control_status")
