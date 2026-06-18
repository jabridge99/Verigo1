"""Add subscription_addons table for enterprise add-on purchases

Revision ID: d4e5f6a7b8c9
Revises: c3d4e5f6a7b8
Create Date: 2026-06-18 00:00:00.000000
"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "d4e5f6a7b8c9"
down_revision: Union[str, None] = "c3d4e5f6a7b8"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "subscription_addons",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("addon_id", sa.String(length=60), nullable=False),
        sa.Column("org_id", sa.String(length=100), nullable=False),
        sa.Column(
            "addon_key",
            sa.Enum("enterprise_crypto_screening", name="addonkey"),
            nullable=False,
        ),
        sa.Column(
            "status",
            sa.Enum("active", "canceled", name="addonstatus"),
            nullable=False,
        ),
        sa.Column("price_aud", sa.Float(), nullable=True),
        sa.Column("stripe_subscription_id", sa.String(length=100), nullable=True),
        sa.Column("purchased_at", sa.DateTime(timezone=True), server_default=sa.text("(CURRENT_TIMESTAMP)"), nullable=True),
        sa.Column("canceled_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("(CURRENT_TIMESTAMP)"), nullable=True),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(op.f("ix_subscription_addons_addon_id"), "subscription_addons", ["addon_id"], unique=True)
    op.create_index(op.f("ix_subscription_addons_org_id"), "subscription_addons", ["org_id"])


def downgrade() -> None:
    op.drop_table("subscription_addons")
