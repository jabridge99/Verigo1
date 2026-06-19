"""Add usage_records table for metered third-party verification billing

Revision ID: c3d4e5f6a7b8
Revises: b2c3d4e5f6a7
Create Date: 2026-06-18 00:00:00.000000
"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "c3d4e5f6a7b8"
down_revision: Union[str, None] = "b2c3d4e5f6a7"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "usage_records",
        sa.Column("id", sa.String(), nullable=False),
        sa.Column("org_id", sa.String(), nullable=False),
        sa.Column("customer_id", sa.String(), nullable=True),
        sa.Column(
            "event_type",
            sa.Enum(
                "identity_verification",
                "business_verification",
                "address_verification",
                "sanctions_screening",
                "other",
                name="usageeventtype",
            ),
            nullable=False,
        ),
        sa.Column("provider", sa.String(length=50), nullable=False),
        sa.Column("provider_reference", sa.String(length=255), nullable=True),
        sa.Column(
            "status",
            sa.Enum("pending", "completed", "failed", "voided", name="usagerecordstatus"),
            nullable=False,
        ),
        sa.Column("unit_cost_aud", sa.Float(), nullable=False),
        sa.Column("markup_pct", sa.Float(), nullable=False),
        sa.Column("billed_amount_aud", sa.Float(), nullable=False),
        sa.Column("invoiced", sa.Boolean(), nullable=True),
        sa.Column("invoice_id", sa.String(length=60), nullable=True),
        sa.Column("invoiced_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("(CURRENT_TIMESTAMP)"), nullable=True),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(op.f("ix_usage_records_org_id"), "usage_records", ["org_id"])
    op.create_index(op.f("ix_usage_records_customer_id"), "usage_records", ["customer_id"])
    op.create_index(op.f("ix_usage_records_event_type"), "usage_records", ["event_type"])
    op.create_index(op.f("ix_usage_records_provider_reference"), "usage_records", ["provider_reference"])
    op.create_index(op.f("ix_usage_records_status"), "usage_records", ["status"])
    op.create_index(op.f("ix_usage_records_invoiced"), "usage_records", ["invoiced"])
    op.create_index(op.f("ix_usage_records_invoice_id"), "usage_records", ["invoice_id"])
    op.create_index(op.f("ix_usage_records_created_at"), "usage_records", ["created_at"])


def downgrade() -> None:
    op.drop_table("usage_records")
