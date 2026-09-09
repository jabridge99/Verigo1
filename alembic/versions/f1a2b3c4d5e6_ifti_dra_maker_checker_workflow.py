"""ifti_dra_maker_checker_workflow

P28: of three parallel IFTI backends, app/api/routes/ifti.py + IFTIRecord is
the one that actually matches the user's real workflow (AUSTRAC IFTI-DRA --
fill the official Excel template via generate_ifti_excel(), then lodge it
through AUSTRAC Online) -- its Excel export is schema-accurate, but the
record only had a bare draft/ready/submitted status with no maker-checker
and no audit trail. app/api/routes/reports.py's IFTI section had the full
maker-checker/audit workflow but no Excel export at all, so could never
produce a file usable for a real AUSTRAC lodgement. This migration ports
the reports.py workflow shape onto IFTIRecord so ifti.py becomes canonical;
the reports.py IFTI routes are retired in the same change (its IFTIReport
model/table is left in place -- app/models/ifti_receipt.py's IFTIReceipt
still carries an optional FK to it for historical/receipt-linkage rows).

Revision ID: f1a2b3c4d5e6
Revises: e3f4a5b6c7d8
Create Date: 2026-09-09
"""

from typing import Sequence, Union

import sqlalchemy as sa

from alembic import op

revision: str = "f1a2b3c4d5e6"
down_revision: Union[str, None] = "e3f4a5b6c7d8"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

_NEW_COLUMNS = [
    ("reviewed_by", sa.String(60)),
    ("approved_by", sa.String(60)),
    ("approved_at", sa.DateTime(timezone=True)),
    ("rejected_reason", sa.String(500)),
    ("submission_reference", sa.String(100)),
    ("acknowledged_at", sa.DateTime(timezone=True)),
    ("due_date", sa.Date()),
    ("reporter_austrac_id", sa.String(50)),
]


def upgrade() -> None:
    bind = op.get_bind()

    if bind.dialect.name == "postgresql":
        for value in ("under_review", "approved", "acknowledged", "rejected"):
            op.execute(f"ALTER TYPE iftistatus ADD VALUE IF NOT EXISTS '{value}'")

    inspector = sa.inspect(bind)
    columns = {c["name"] for c in inspector.get_columns("ifti_records")}
    for name, coltype in _NEW_COLUMNS:
        if name not in columns:
            op.add_column("ifti_records", sa.Column(name, coltype, nullable=True))


def downgrade() -> None:
    for name, _ in reversed(_NEW_COLUMNS):
        op.drop_column("ifti_records", name)
    # Postgres cannot drop enum values without recreating the type; the
    # under_review/approved/acknowledged/rejected statuses are left in
    # place, consistent with other enum-value migrations here.
