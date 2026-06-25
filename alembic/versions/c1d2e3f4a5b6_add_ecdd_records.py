"""add_ecdd_records

Adds ecdd_records table backing the Enhanced Customer Due Diligence
questionnaire (web/app/ecdd/page.tsx, /api/v1/reports/ecdd/). Previously the
frontend silently fell back to demo data because no model or route existed.

Revision ID: c1d2e3f4a5b6
Revises: b4c5d6e7f8a9
Create Date: 2026-06-23 00:00:00.000000

"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

# revision identifiers, used by Alembic.
revision: str = 'c1d2e3f4a5b6'
down_revision: Union[str, None] = 'b4c5d6e7f8a9'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        'ecdd_records',
        sa.Column('id', sa.String(), primary_key=True),
        sa.Column('org_id', sa.String(), sa.ForeignKey('organisations.id', ondelete='CASCADE'), nullable=False),
        sa.Column('ecdd_id', sa.String(length=40), unique=True),
        sa.Column('customer_id', sa.String(), sa.ForeignKey('customers.id'), nullable=False),
        sa.Column('trigger_reason', sa.Text(), nullable=False),
        sa.Column('pep_status', sa.Boolean(), server_default=sa.false()),
        sa.Column('adverse_media_found', sa.Boolean(), server_default=sa.false()),
        sa.Column('adverse_media_details', sa.Text()),
        sa.Column('beneficial_owner_verified', sa.Boolean(), server_default=sa.false()),
        sa.Column('beneficial_owner_details', sa.Text()),
        sa.Column('source_of_wealth_verified', sa.Boolean(), server_default=sa.false()),
        sa.Column('source_of_funds', sa.Text()),
        sa.Column('source_of_wealth_notes', sa.Text()),
        sa.Column('purpose_of_transaction', sa.Text()),
        sa.Column('high_tax_risk', sa.Boolean(), server_default=sa.false()),
        sa.Column('tax_risk_notes', sa.Text()),
        sa.Column('investment_legitimacy_notes', sa.Text()),
        sa.Column('analyst_notes', sa.Text()),
        sa.Column('enhanced_risk_score', sa.Float(), server_default='0'),
        sa.Column('recommendation', sa.String(length=20)),
        sa.Column('status', sa.Enum('pending', 'completed', name='ecddstatus'), nullable=False, server_default='pending'),
        sa.Column('created_by', sa.String()),
        sa.Column('completed_by', sa.String()),
        sa.Column('completed_at', sa.DateTime(timezone=True)),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column('updated_at', sa.DateTime(timezone=True)),
    )
    op.create_index('ix_ecdd_records_org_id', 'ecdd_records', ['org_id'])
    op.create_index('ix_ecdd_records_ecdd_id', 'ecdd_records', ['ecdd_id'])
    op.create_index('ix_ecdd_records_customer_id', 'ecdd_records', ['customer_id'])
    op.create_index('ix_ecdd_records_status', 'ecdd_records', ['status'])


def downgrade() -> None:
    op.drop_index('ix_ecdd_records_status', table_name='ecdd_records')
    op.drop_index('ix_ecdd_records_customer_id', table_name='ecdd_records')
    op.drop_index('ix_ecdd_records_ecdd_id', table_name='ecdd_records')
    op.drop_index('ix_ecdd_records_org_id', table_name='ecdd_records')
    op.drop_table('ecdd_records')
    sa.Enum(name='ecddstatus').drop(op.get_bind(), checkfirst=True)
