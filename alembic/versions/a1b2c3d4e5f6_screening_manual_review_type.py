"""Add manual_review value to screeningtype enum

Identity verification composite scoring needs a "manual scan" category
(human reviewer sign-off) alongside the existing pep/sanctions/adverse_media
types, captured in the same unified ScreeningRecord table rather than a
new parallel model.

Revision ID: a1b2c3d4e5f6
Revises: d4e5f6a7b8c9
Create Date: 2026-06-24
"""
from alembic import op

revision = "a1b2c3d4e5f6"
down_revision = "d4e5f6a7b8c9"
branch_labels = None
depends_on = None


def upgrade() -> None:
    bind = op.get_bind()
    if bind.dialect.name == "postgresql":
        op.execute("ALTER TYPE screeningtype ADD VALUE IF NOT EXISTS 'manual_review'")


def downgrade() -> None:
    # Postgres cannot drop a single enum value without recreating the type;
    # left as a no-op, consistent with append-only screening record history.
    pass
