"""api_usage_counters

P40: PLAN_CATALOGUE's api_calls_month limit was defined and advertised but
had nothing to attach to -- app/services/api_key_service.py's
authenticate_api_key() existed but was never called from any real
request-auth path, so there was no concept of "API-key-authenticated
traffic" distinct from ordinary browser/JWT session traffic to meter.

Adds app/api/deps.py::get_current_user() support for an X-API-Key header
as an alternative to the Bearer JWT, and this table to back
billing_service.py's record_api_call(), which meters only that path
against the org's monthly cap.

Revision ID: d472643f4d3b
Revises: b2c3d4e5f6a7
Create Date: 2026-09-10

"""

from typing import Sequence, Union

import sqlalchemy as sa

from alembic import op

# revision identifiers, used by Alembic.
revision: str = "d472643f4d3b"
down_revision: Union[str, None] = "b2c3d4e5f6a7"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Guarded: a database created fresh via create_all() against the
    # current models already has this table (see app/models/billing.py's
    # ApiUsageCounter). This migration is what creates it on a database
    # that predates that model.
    bind = op.get_bind()
    inspector = sa.inspect(bind)
    if "api_usage_counters" in inspector.get_table_names():
        return

    op.create_table(
        "api_usage_counters",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("org_id", sa.String(length=100), nullable=False),
        sa.Column("period", sa.String(length=7), nullable=False),
        sa.Column("count", sa.Integer(), nullable=False, server_default="0"),
        sa.Column(
            "created_at", sa.DateTime(timezone=True), server_default=sa.func.now()
        ),
        sa.Column("updated_at", sa.DateTime(timezone=True)),
        sa.UniqueConstraint("org_id", "period", name="uq_api_usage_org_period"),
    )
    op.create_index("ix_api_usage_counters_org_id", "api_usage_counters", ["org_id"])


def downgrade() -> None:
    op.drop_index("ix_api_usage_counters_org_id", table_name="api_usage_counters")
    op.drop_table("api_usage_counters")
