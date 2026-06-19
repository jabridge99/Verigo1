"""Fix audit_logs table name collision

Two distinct AuditLog models (app.models.audit and app.models.audit_log)
both targeted the "audit_logs" table, crashing SQLAlchemy metadata
registration at import time. The legacy simple model now uses
"legacy_audit_logs"; this migration renames the existing table (created
by the legacy model, since the canonical immutable one was added later
and never successfully created its own table due to the collision).

Revision ID: b2c3d4e5f6a7
Revises: a1b2c3d4e5f6
Create Date: 2026-06-17 00:00:00.000000
"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "b2c3d4e5f6a7"
down_revision: Union[str, None] = "a1b2c3d4e5f6"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    bind = op.get_bind()
    inspector = sa.inspect(bind)
    tables = inspector.get_table_names()
    if "audit_logs" in tables and "legacy_audit_logs" not in tables:
        # Only the legacy simple schema (log_id, entity_type, actor) could have
        # been created under this name pre-fix; the canonical immutable model
        # (org_id, event_type, actor_id) never successfully registered due to
        # the table-name collision this migration resolves.
        cols = {c["name"] for c in inspector.get_columns("audit_logs")}
        if "log_id" in cols and "entity_type" in cols:
            op.rename_table("audit_logs", "legacy_audit_logs")


def downgrade() -> None:
    bind = op.get_bind()
    inspector = sa.inspect(bind)
    if "legacy_audit_logs" in inspector.get_table_names():
        op.rename_table("legacy_audit_logs", "audit_logs")
