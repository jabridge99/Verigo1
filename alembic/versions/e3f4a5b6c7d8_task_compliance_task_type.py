"""Add compliance_task value to tasktype enum

Stage 7 (AML/CTF Program Module) needs a way to assign and track general
compliance tasks (obligations from the AML/CTF Program, not tied to a
specific case or customer investigation) using the existing Task model --
case_id/customer_id are already nullable, so nothing else needs to
change, but the existing TaskType values are all case/customer-flavored
(request_sof, submit_smr, etc.), so a dedicated value keeps these
reportable/filterable rather than overloading "other".

Revision ID: e3f4a5b6c7d8
Revises: d2e3f4a5b6c7
Create Date: 2026-09-08
"""

from alembic import op

revision = "e3f4a5b6c7d8"
down_revision = "d2e3f4a5b6c7"
branch_labels = None
depends_on = None


def upgrade() -> None:
    bind = op.get_bind()
    if bind.dialect.name == "postgresql":
        op.execute("ALTER TYPE tasktype ADD VALUE IF NOT EXISTS 'compliance_task'")


def downgrade() -> None:
    # Postgres cannot drop a single enum value without recreating the type;
    # left as a no-op, consistent with other enum-value migrations here.
    pass
